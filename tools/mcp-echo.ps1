$ErrorActionPreference = 'Stop'

function Send-Json($Message) {
    $json = ConvertTo-Json -InputObject $Message -Depth 20 -Compress
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
}

function Send-RpcError($Id, [int]$Code, [string]$Message) {
    Send-Json @{
        jsonrpc = '2.0'
        id      = $Id
        error   = @{
            code    = $Code
            message = $Message
        }
    }
}

function New-ToolResult([string]$Text, [bool]$IsError = $false) {
    return @{
        content = @(
            @{
                type = 'text'
                text = $Text
            }
        )
        isError = $IsError
    }
}

function Test-JsonNumber($Value) {
    if ($null -eq $Value -or $Value -is [bool]) {
        return $false
    }

    return $Value -is [sbyte] -or $Value -is [byte] -or
        $Value -is [int16] -or $Value -is [uint16] -or
        $Value -is [int32] -or $Value -is [uint32] -or
        $Value -is [int64] -or $Value -is [uint64] -or
        $Value -is [single] -or $Value -is [double] -or
        $Value -is [decimal]
}

function Get-ToolDefinitions {
    return @(
        @{
            name        = 'echo'
            description = 'Return the supplied text unchanged.'
            inputSchema = @{
                type       = 'object'
                properties = @{
                    text = @{ type = 'string'; description = 'Text to echo.' }
                }
                required   = @('text')
                additionalProperties = $false
            }
        },
        @{
            name        = 'get_time'
            description = 'Return the current UTC timestamp in ISO 8601 format.'
            inputSchema = @{
                type                 = 'object'
                properties           = @{}
                additionalProperties = $false
            }
        },
        @{
            name        = 'calculate'
            description = 'Apply one basic arithmetic operation to two numbers.'
            inputSchema = @{
                type       = 'object'
                properties = @{
                    operation = @{
                        type = 'string'
                        enum = @('add', 'subtract', 'multiply', 'divide')
                    }
                    a = @{ type = 'number' }
                    b = @{ type = 'number' }
                }
                required             = @('operation', 'a', 'b')
                additionalProperties = $false
            }
        }
    )
}

function Invoke-Tool([string]$Name, $Arguments) {
    if ($null -eq $Arguments -or $Arguments -isnot [System.Management.Automation.PSCustomObject]) {
        return New-ToolResult 'Arguments must be a JSON object.' $true
    }

    switch ($Name) {
        'echo' {
            $textProperty = $Arguments.PSObject.Properties['text']
            if ($null -eq $textProperty -or $textProperty.Value -isnot [string]) {
                return New-ToolResult 'The text argument must be a string.' $true
            }
            return New-ToolResult $textProperty.Value
        }
        'get_time' {
            return New-ToolResult ([DateTimeOffset]::UtcNow.ToString('o'))
        }
        'calculate' {
            $operationProperty = $Arguments.PSObject.Properties['operation']
            $aProperty = $Arguments.PSObject.Properties['a']
            $bProperty = $Arguments.PSObject.Properties['b']
            if ($null -eq $operationProperty -or $operationProperty.Value -isnot [string] -or
                $null -eq $aProperty -or $null -eq $bProperty -or
                -not (Test-JsonNumber $aProperty.Value) -or
                -not (Test-JsonNumber $bProperty.Value)) {
                return New-ToolResult 'Arguments require operation and numeric a and b values.' $true
            }

            $left = [double]$aProperty.Value
            $right = [double]$bProperty.Value
            switch ($operationProperty.Value) {
                'add'      { $value = $left + $right }
                'subtract' { $value = $left - $right }
                'multiply' { $value = $left * $right }
                'divide' {
                    if ($right -eq 0) {
                        return New-ToolResult 'Cannot divide by zero.' $true
                    }
                    $value = $left / $right
                }
                default {
                    return New-ToolResult 'Operation must be add, subtract, multiply, or divide.' $true
                }
            }

            if ([double]::IsNaN($value) -or [double]::IsInfinity($value)) {
                return New-ToolResult 'The arithmetic result is outside the supported finite number range.' $true
            }
            return New-ToolResult $value.ToString('R', [Globalization.CultureInfo]::InvariantCulture)
        }
        default {
            Send-RpcError $script:CurrentRequestId -32602 'Unknown tool.'
            return $null
        }
    }
}

while ($null -ne ($line = [Console]::In.ReadLine())) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }

    $request = $null
    try {
        $request = ConvertFrom-Json -InputObject $line -ErrorAction Stop
    }
    catch {
        Send-RpcError $null -32700 'Parse error.'
        continue
    }

    $idProperty = $request.PSObject.Properties['id']
    $methodProperty = $request.PSObject.Properties['method']
    if ($null -eq $methodProperty -or $methodProperty.Value -isnot [string]) {
        if ($null -ne $idProperty) {
            Send-RpcError $idProperty.Value -32600 'Invalid request.'
        }
        continue
    }

    $requestId = if ($null -ne $idProperty) { $idProperty.Value } else { $null }
    $script:CurrentRequestId = $requestId
    $method = $methodProperty.Value
    $parameters = $request.params

    switch ($method) {
        'initialize' {
            if ($null -ne $idProperty) {
                Send-Json @{
                    jsonrpc = '2.0'
                    id      = $requestId
                    result  = @{
                        protocolVersion = '2024-11-05'
                        capabilities    = @{ tools = @{} }
                        serverInfo      = @{
                            name    = 'module13-mcp-echo'
                            version = '1.0.0'
                        }
                    }
                }
            }
        }
        'notifications/initialized' {
        }
        'ping' {
            if ($null -ne $idProperty) {
                Send-Json @{ jsonrpc = '2.0'; id = $requestId; result = @{} }
            }
        }
        'tools/list' {
            if ($null -ne $idProperty) {
                Send-Json @{
                    jsonrpc = '2.0'
                    id      = $requestId
                    result  = @{ tools = @(Get-ToolDefinitions) }
                }
            }
        }
        'tools/call' {
            if ($null -eq $idProperty) {
                continue
            }
            $nameProperty = if ($null -ne $parameters) {
                $parameters.PSObject.Properties['name']
            } else {
                $null
            }
            if ($null -eq $nameProperty -or $nameProperty.Value -isnot [string]) {
                Send-RpcError $requestId -32602 'Tool name is required.'
                continue
            }

            $argumentProperty = $parameters.PSObject.Properties['arguments']
            $arguments = if ($null -ne $argumentProperty) { $argumentProperty.Value } else { $null }
            $result = Invoke-Tool $nameProperty.Value $arguments
            if ($null -ne $result) {
                Send-Json @{ jsonrpc = '2.0'; id = $requestId; result = $result }
            }
        }
        default {
            if ($null -ne $idProperty) {
                Send-RpcError $requestId -32601 'Method not found.'
            }
        }
    }
}
