[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$TaskName = 'USF-PLAN Weekly Report Worker',
    [string]$TaskScript = '.\scripts\run-local-report-worker.ps1',
    [string]$CredentialTarget = 'USF-PLAN/WorkerToken',
    [string]$StartTime = '09:00',
    [ValidateSet('MON')]
    [string]$DayOfWeek = 'MON'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$taskScriptPath = Join-Path $repositoryRoot $TaskScript
if (-not (Test-Path $taskScriptPath)) {
    throw "The scheduled worker script '$taskScriptPath' was not found."
}
if (-not (Get-Command schtasks.exe -ErrorAction SilentlyContinue)) {
    throw 'The Windows Task Scheduler command is unavailable on this machine.'
}

$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$taskScriptPath`" -CredentialTarget `"$CredentialTarget`""
$createArgs = @(
    '/Create',
    '/TN', $TaskName,
    '/TR', $taskCommand,
    '/SC', 'WEEKLY',
    '/D', $DayOfWeek,
    '/ST', $StartTime,
    '/RU', $env:USERNAME,
    '/RL', 'HIGHEST',
    '/F'
)

if (-not $PSCmdlet.ShouldProcess($TaskName, "Create scheduled task for every $DayOfWeek at $StartTime America/New_York")) {
    Write-Output "Would create task '$TaskName' with schedule: every $DayOfWeek at $StartTime America/New_York."
    Write-Output "Command: $taskCommand"
    return
}

& schtasks.exe @createArgs
if ($LASTEXITCODE -ne 0) {
    throw "Task Scheduler registration failed for '$TaskName'."
}

Write-Output "Scheduled task '$TaskName' is registered for every $DayOfWeek at $StartTime America/New_York in the signed-in session."
