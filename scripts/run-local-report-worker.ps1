[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$CredentialTarget = 'USF-PLAN/WorkerToken',
    [string]$ProjectRoot,
    [string]$ScheduledTriggerUtc
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

$easternZone = [TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time')
if ($ScheduledTriggerUtc) {
    $trigger = [DateTimeOffset]::MinValue
    $validTimestamp = $ScheduledTriggerUtc -match '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$'
    if ($validTimestamp) {
        $validTimestamp = [DateTimeOffset]::TryParse(
            $ScheduledTriggerUtc,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::AssumeUniversal,
            [ref]$trigger
        )
    }
    if (-not $validTimestamp) {
        throw 'ScheduledTriggerUtc must be a valid ISO-8601 timestamp.'
    }
    $trigger = $trigger.ToUniversalTime()
}
else {
    $easternNow = [TimeZoneInfo]::ConvertTime([DateTimeOffset]::UtcNow, $easternZone)
    $daysSinceMonday = (([int]$easternNow.DayOfWeek + 6) % 7)
    $anchorLocal = $easternNow.Date.AddDays(-$daysSinceMonday).AddHours(9)
    if ($easternNow.DateTime -lt $anchorLocal) {
        $anchorLocal = $anchorLocal.AddDays(-7)
    }
    $anchorUtc = [TimeZoneInfo]::ConvertTimeToUtc(
        [DateTime]::SpecifyKind($anchorLocal, [DateTimeKind]::Unspecified),
        $easternZone
    )
    $trigger = [DateTimeOffset]::new($anchorUtc)
}

$triggerLocal = [TimeZoneInfo]::ConvertTime($trigger, $easternZone)
if (
    $triggerLocal.DayOfWeek -ne [DayOfWeek]::Monday -or
    $triggerLocal.Hour -ne 9 -or
    $triggerLocal.Minute -ne 0 -or
    $triggerLocal.Second -ne 0 -or
    $triggerLocal.Millisecond -ne 0
) {
    throw 'The reporting-period anchor must be a Monday 09:00 America/New_York scheduled trigger.'
}

$periodEndLocalDate = $triggerLocal.ToString('yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
$triggerUtc = $trigger.ToString('yyyy-MM-ddTHH:mm:ssZ', [Globalization.CultureInfo]::InvariantCulture)
$workerScript = Join-Path $ProjectRoot 'scripts\report-worker.py'
$workerArguments = @(
    '--period-end-local-date', $periodEndLocalDate,
    '--scheduled-trigger-utc', $triggerUtc
)
$plan = [ordered]@{
    worker = $workerScript
    periodEndLocalDate = $periodEndLocalDate
    scheduledTriggerUtc = $triggerUtc
    workerArguments = $workerArguments
    timeZone = 'America/New_York'
    missedTriggerBehavior = 'DoNotStartWhenAvailable'
}

if (-not $PSCmdlet.ShouldProcess($workerScript, "Run report worker for reporting period ending $periodEndLocalDate")) {
    $plan | ConvertTo-Json -Compress
    return
}

if (-not (Test-Path -LiteralPath $workerScript -PathType Leaf)) {
    throw "The runnable report worker '$workerScript' is not implemented. Report-worker integration is blocked on T-028; no report was started."
}
if ((Get-TimeZone).Id -ne 'Eastern Standard Time') {
    throw 'Set the Windows time zone to Eastern Standard Time (US & Canada) before running the scheduled worker.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker Desktop is required for the local PostgreSQL service.'
}
& docker info --format '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Desktop is unavailable; the scheduled worker cannot run safely.'
}
if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw 'The Python launcher is unavailable; Python 3.12 is required for report generation.'
}
$pythonVersion = & py -3.12 --version 2>&1
if ($LASTEXITCODE -ne 0 -or $pythonVersion -notmatch '^Python 3\.12(?:\.|$)') {
    throw 'Python 3.12 is unavailable; the scheduled worker cannot run safely.'
}

$health = $null
try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/healthz' -Method Get -TimeoutSec 10
}
catch {
    throw 'The loopback API or database is unavailable; the scheduled worker cannot run safely.'
}
if ($health.api -ne 'ready' -or $health.database -ne 'ready') {
    throw 'The loopback API database health check failed; the scheduled worker cannot run safely.'
}

$updateUri = "http://127.0.0.1:3000/api/v1/project-updates?periodEnd=$periodEndLocalDate"
try {
    $periodUpdate = Invoke-RestMethod -Uri $updateUri -Method Get -TimeoutSec 10
}
catch {
    throw 'The project-manager update could not be verified for the scheduled reporting period.'
}
if (-not $periodUpdate.complete -or -not $periodUpdate.update) {
    throw "A complete project-manager update is unavailable for reporting period $periodEndLocalDate."
}

if (-not ('UsfPlan.WorkerCredential' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace UsfPlan
{
    public static class WorkerCredential
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct NativeCredential
        {
            public UInt32 Flags;
            public UInt32 Type;
            [MarshalAs(UnmanagedType.LPWStr)] public string TargetName;
            [MarshalAs(UnmanagedType.LPWStr)] public string Comment;
            public long LastWritten;
            public UInt32 CredentialBlobSize;
            public IntPtr CredentialBlob;
            public UInt32 Persist;
            public UInt32 AttributeCount;
            public IntPtr Attributes;
            [MarshalAs(UnmanagedType.LPWStr)] public string TargetAlias;
            [MarshalAs(UnmanagedType.LPWStr)] public string UserName;
        }

        [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);

        [DllImport("advapi32.dll", SetLastError = false)]
        public static extern void CredFree(IntPtr buffer);
    }
}
'@
}

$credentialPointer = [IntPtr]::Zero
$passwordBytes = $null
$workerToken = $null
try {
    if (-not [UsfPlan.WorkerCredential]::CredRead($CredentialTarget, 1, 0, [ref]$credentialPointer)) {
        $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "Windows Credential Manager target '$CredentialTarget' is unavailable (Win32 error $errorCode)."
    }

    $credential = [Runtime.InteropServices.Marshal]::PtrToStructure(
        $credentialPointer,
        [type][UsfPlan.WorkerCredential+NativeCredential]
    )
    if ($credential.CredentialBlobSize -eq 0 -or ($credential.CredentialBlobSize % 2) -ne 0) {
        throw "Credential target '$CredentialTarget' must contain a UTF-16 token."
    }

    $passwordBytes = New-Object byte[] $credential.CredentialBlobSize
    [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $passwordBytes, 0, $passwordBytes.Length)
    $workerToken = [Text.Encoding]::Unicode.GetString($passwordBytes).TrimEnd([char]0)
    [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
    $passwordBytes = $null
    if ([string]::IsNullOrWhiteSpace($workerToken)) {
        throw "Credential target '$CredentialTarget' must contain a worker token."
    }

    [Environment]::SetEnvironmentVariable('USF_PLAN_WORKER_TOKEN', $workerToken, 'Process')
    & py -3.12 $workerScript @workerArguments
    if ($LASTEXITCODE -ne 0) {
        throw "The report worker failed with exit code $LASTEXITCODE."
    }
}
finally {
    [Environment]::SetEnvironmentVariable('USF_PLAN_WORKER_TOKEN', $null, 'Process')
    if ($passwordBytes) {
        [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
    }
    if ($credentialPointer -ne [IntPtr]::Zero) {
        [UsfPlan.WorkerCredential]::CredFree($credentialPointer)
    }
    $workerToken = $null
}
