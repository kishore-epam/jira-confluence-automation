[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$CredentialTarget = 'USF-PLAN/WorkerToken',
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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
$credentialPassword = $null
$credentialUsername = $null
$passwordBytes = $null

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
        throw "Credential target '$CredentialTarget' must contain a UTF-16 secret value."
    }

    $passwordBytes = New-Object byte[] $credential.CredentialBlobSize
    [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $passwordBytes, 0, $passwordBytes.Length)
    $credentialUsername = $credential.UserName
    $credentialPassword = [Text.Encoding]::Unicode.GetString($passwordBytes).TrimEnd([char]0)
    [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
    $passwordBytes = $null

    if ([string]::IsNullOrWhiteSpace($credentialUsername) -or [string]::IsNullOrWhiteSpace($credentialPassword)) {
        throw "Credential target '$CredentialTarget' must contain a username and token."
    }

    $requiredDirectories = @('data\inputs', 'data\reports', 'data\logs')
    foreach ($relativeDirectory in $requiredDirectories) {
        $fullPath = Join-Path $ProjectRoot $relativeDirectory
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
    }

    $healthUrl = 'http://127.0.0.1:3000/healthz'
    try {
        $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -ne 200) {
            throw "Health check returned $($response.StatusCode)."
        }
    }
    catch {
        throw "The local API is unavailable at $healthUrl; the scheduled worker cannot run safely."
    }

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker Desktop is required for the local PostgreSQL service.'
    }

    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        throw 'Python 3.12 is required for the report-generation worker.'
    }

    if (-not $PSCmdlet.ShouldProcess($CredentialTarget, 'Verify worker prerequisites')) {
        Write-Output 'Worker preflight: Credential Manager, loopback API, Docker, and Python prerequisites are available.'
        return
    }

    Write-Output 'Worker prerequisites verified; the scheduled task is ready to call the project worker entry point.'
}
finally {
    if ($credentialPointer -ne [IntPtr]::Zero) {
        [UsfPlan.WorkerCredential]::CredFree($credentialPointer)
    }
    $credentialPointer = [IntPtr]::Zero
    $credentialUsername = $null
    $credentialPassword = $null
    if ($passwordBytes) {
        [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
    }
}
