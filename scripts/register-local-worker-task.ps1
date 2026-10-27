[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$TaskName = 'USF-PLAN Weekly Report Worker',
    [string]$TaskScript = '.\scripts\run-local-report-worker.ps1',
    [string]$CredentialTarget = 'USF-PLAN/WorkerToken',
    [string]$StartTime = '09:00',
    [switch]$DescribeOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$taskScriptPath = Join-Path $repositoryRoot $TaskScript
if (-not (Test-Path -LiteralPath $taskScriptPath -PathType Leaf)) {
    throw "The scheduled worker script '$taskScriptPath' was not found."
}

$parsedTime = [TimeSpan]::Zero
if (-not [TimeSpan]::TryParseExact($StartTime, 'hh\:mm', [Globalization.CultureInfo]::InvariantCulture, [ref]$parsedTime)) {
    throw 'StartTime must use 24-hour HH:mm format.'
}
if ($parsedTime -ne [TimeSpan]::FromHours(9)) {
    throw 'The worker schedule must be Monday at 09:00 America/New_York.'
}

$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$taskScriptPath`" -CredentialTarget `"$CredentialTarget`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $repositoryRoot
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At '09:00'
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable:$false -MultipleInstances IgnoreNew
$definition = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings
$timeZone = [TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time')
$description = [ordered]@{
    taskName = $TaskName
    trigger = 'Weekly Monday 09:00'
    timeZone = 'America/New_York'
    windowsTimeZoneId = $timeZone.Id
    requiresEasternSystemTimeZone = $true
    user = $currentUser
    logonType = 'Interactive'
    startWhenAvailable = $false
    missedTriggerBehavior = 'DoNotStartWhenAvailable'
    multipleInstances = 'IgnoreNew'
    action = $action.Execute
    arguments = $arguments
    workingDirectory = $repositoryRoot
}

if ($DescribeOnly) {
    $description | ConvertTo-Json -Compress
    return
}

if (-not $WhatIfPreference -and (Get-TimeZone).Id -ne 'Eastern Standard Time') {
    throw 'Set the Windows time zone to Eastern Standard Time (US & Canada) before registering the weekly Eastern-time task.'
}

if ($PSCmdlet.ShouldProcess($TaskName, 'Register interactive weekly worker task for Monday 09:00 Eastern')) {
    Register-ScheduledTask -TaskName $TaskName -InputObject $definition -Force | Out-Null
    Write-Output "Scheduled task '$TaskName' registered for Monday 09:00 America/New_York in the signed-in project-manager session."
}
else {
    $description | ConvertTo-Json -Compress
}
