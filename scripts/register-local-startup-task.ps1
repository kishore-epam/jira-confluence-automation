[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$TaskName = 'USF-PLAN Local API Startup',
    [string]$StartupScript = '.\scripts\start-local-services-on-logon.ps1',
    [switch]$DescribeOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$startupScriptPath = Join-Path $repositoryRoot $StartupScript
if (-not (Test-Path -LiteralPath $startupScriptPath -PathType Leaf)) {
    throw "The local startup script '$startupScriptPath' was not found."
}

$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$startupScriptPath`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $repositoryRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable:$false -MultipleInstances IgnoreNew
$definition = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings
$description = [ordered]@{
    taskName = $TaskName
    trigger = 'AtLogOn'
    user = $currentUser
    logonType = 'Interactive'
    startWhenAvailable = $false
    action = $action.Execute
    arguments = $arguments
    workingDirectory = $repositoryRoot
    starts = @('PostgreSQL', 'Express API')
    viteStartsOnDemand = $true
}

if ($DescribeOnly) {
    $description | ConvertTo-Json -Compress
    return
}

if ($PSCmdlet.ShouldProcess($TaskName, "Register local PostgreSQL and API startup at logon for $currentUser")) {
    Register-ScheduledTask -TaskName $TaskName -InputObject $definition -Force | Out-Null
    Write-Output "Startup task '$TaskName' registered for $currentUser at logon."
}
else {
    $description | ConvertTo-Json -Compress
}
