param(
    [Parameter(Mandatory = $true)]
    [string]$WorkspaceRoot
)

$ErrorActionPreference = 'Stop'

$script:WorkspaceRoot = [System.IO.Path]::GetFullPath($WorkspaceRoot)
$script:WorkspaceRootPrefix = $script:WorkspaceRoot
if (-not $script:WorkspaceRootPrefix.EndsWith('\')) {
    $script:WorkspaceRootPrefix += '\'
}

function Send-Json($Message) {
    $json = ConvertTo-Json -InputObject $Message -Depth 20 -Compress
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
}

function Send-RpcError($Id, [int]$Code, [string]$Message) {
    Send-Json @{
        jsonrpc = '2.0'
        id      = $Id
        error   = @{ code = $Code; message = $Message }
    }
}

function New-ToolResult([string]$Text, [bool]$IsError = $false) {
    return @{
        content = @(@{ type = 'text'; text = $Text })
        isError = $IsError
    }
}

function Resolve-WorkspacePath([string]$RelativePath) {
    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        throw 'A workspace-relative path is required.'
    }
    if ([System.IO.Path]::IsPathRooted($RelativePath)) {
        throw 'Paths must be relative to the workspace.'
    }

    $normalizedPath = $RelativePath.Replace('/', '\')
    if ($normalizedPath -eq '.') {
        $segments = @()
    }
    else {
        $segments = $normalizedPath.Split([char[]]@('\'))
        foreach ($segment in $segments) {
            if ([string]::IsNullOrEmpty($segment) -or $segment -eq '.' -or $segment -eq '..') {
                throw 'Paths cannot contain empty, current-directory, or parent-directory segments.'
            }
            foreach ($invalidCharacter in [System.IO.Path]::GetInvalidFileNameChars()) {
                if ($segment.Contains([string]$invalidCharacter)) {
                    throw 'The path contains an invalid character.'
                }
            }
        }
    }

    $fullPath = [System.IO.Path]::GetFullPath((Join-Path -Path $script:WorkspaceRoot -ChildPath $normalizedPath))
    if ($fullPath -ne $script:WorkspaceRoot -and
        -not $fullPath.StartsWith($script:WorkspaceRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Paths must remain inside the workspace.'
    }
    return $fullPath
}

function Assert-NoReparsePoints([string]$FullPath) {
    if ($FullPath -eq $script:WorkspaceRoot) {
        return
    }

    $relativePath = $FullPath.Substring($script:WorkspaceRootPrefix.Length)
    $currentPath = $script:WorkspaceRoot
    foreach ($segment in $relativePath.Split([char[]]@('\'))) {
        $currentPath = Join-Path -Path $currentPath -ChildPath $segment
        $item = Get-Item -LiteralPath $currentPath -Force -ErrorAction Stop
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Paths through symbolic links or junctions are not allowed.'
        }
    }
}

function Get-ToolDefinitions {
    return @(
        @{
            name        = 'list_workspace_files'
            description = 'List files under a workspace-relative directory without following links.'
            inputSchema = @{
                type       = 'object'
                properties = @{
                    relative_path = @{ type = 'string'; description = 'Workspace-relative directory; defaults to the workspace root.' }
                }
                additionalProperties = $false
            }
        },
        @{
            name        = 'get_file_info'
            description = 'Return metadata for a file inside the workspace.'
            inputSchema = @{
                type       = 'object'
                properties = @{
                    path = @{ type = 'string'; description = 'Workspace-relative file path.' }
                }
                required             = @('path')
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
        'list_workspace_files' {
            $pathProperty = $Arguments.PSObject.Properties['relative_path']
            $relativePath = if ($null -eq $pathProperty) { '.' } else { $pathProperty.Value }
            if ($relativePath -isnot [string]) {
                return New-ToolResult 'relative_path must be a string.' $true
            }

            $directoryPath = Resolve-WorkspacePath $relativePath
            Assert-NoReparsePoints $directoryPath
            $directory = Get-Item -LiteralPath $directoryPath -Force -ErrorAction Stop
            if (-not $directory.PSIsContainer) {
                return New-ToolResult 'relative_path must identify a directory.' $true
            }

            $pending = New-Object 'System.Collections.Generic.Stack[string]'
            $files = New-Object 'System.Collections.Generic.List[string]'
            $pending.Push($directory.FullName)
            $truncated = $false
            while ($pending.Count -gt 0 -and -not $truncated) {
                $currentDirectory = $pending.Pop()
                foreach ($child in Get-ChildItem -LiteralPath $currentDirectory -Force -ErrorAction Stop) {
                    if (($child.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                        continue
                    }
                    if ($child.PSIsContainer) {
                        $pending.Push($child.FullName)
                    }
                    else {
                        $files.Add($child.FullName.Substring($script:WorkspaceRootPrefix.Length))
                        if ($files.Count -ge 2000) {
                            $truncated = $true
                            break
                        }
                    }
                }
            }

            $result = @{
                files     = @($files | Sort-Object)
                truncated = $truncated
            }
            return New-ToolResult (ConvertTo-Json -InputObject $result -Depth 5 -Compress)
        }
        'get_file_info' {
            $pathProperty = $Arguments.PSObject.Properties['path']
            if ($null -eq $pathProperty -or $pathProperty.Value -isnot [string]) {
                return New-ToolResult 'path must be a workspace-relative string.' $true
            }

            $filePath = Resolve-WorkspacePath $pathProperty.Value
            Assert-NoReparsePoints $filePath
            $file = Get-Item -LiteralPath $filePath -Force -ErrorAction Stop
            if ($file.PSIsContainer) {
                return New-ToolResult 'path must identify a file.' $true
            }

            $result = @{
                path             = $file.FullName.Substring($script:WorkspaceRootPrefix.Length)
                length           = $file.Length
                lastWriteTimeUtc = $file.LastWriteTimeUtc.ToString('o')
                attributes       = $file.Attributes.ToString()
            }
            return New-ToolResult (ConvertTo-Json -InputObject $result -Depth 5 -Compress)
        }
        default {
            return $null
        }
    }
}

while ($null -ne ($line = [Console]::In.ReadLine())) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }

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
                        serverInfo      = @{ name = 'workspace-inspector-windows'; version = '1.0.0' }
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
                Send-Json @{ jsonrpc = '2.0'; id = $requestId; result = @{ tools = @(Get-ToolDefinitions) } }
            }
        }
        'tools/call' {
            if ($null -eq $idProperty) {
                continue
            }
            $nameProperty = if ($null -ne $parameters) { $parameters.PSObject.Properties['name'] } else { $null }
            if ($null -eq $nameProperty -or $nameProperty.Value -isnot [string]) {
                Send-RpcError $requestId -32602 'Tool name is required.'
                continue
            }

            $argumentProperty = $parameters.PSObject.Properties['arguments']
            $arguments = if ($null -ne $argumentProperty) { $argumentProperty.Value } else { $null }
            try {
                $result = Invoke-Tool $nameProperty.Value $arguments
                if ($null -eq $result) {
                    Send-RpcError $requestId -32602 'Unknown tool.'
                }
                else {
                    Send-Json @{ jsonrpc = '2.0'; id = $requestId; result = $result }
                }
            }
            catch {
                Send-Json @{
                    jsonrpc = '2.0'
                    id      = $requestId
                    result  = (New-ToolResult 'The path is invalid, unavailable, or outside the workspace.' $true)
                }
            }
        }
        default {
            if ($null -ne $idProperty) {
                Send-RpcError $requestId -32601 'Method not found.'
            }
        }
    }
}