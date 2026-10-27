[CmdletBinding()]
param(
    [string]$CredentialTarget = 'USF-PLAN/PostgreSQL'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not ('UsfPlan.AppCredential' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace UsfPlan
{
    public static class AppCredential
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
    if (-not [UsfPlan.AppCredential]::CredRead($CredentialTarget, 1, 0, [ref]$credentialPointer)) {
        $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "Windows Credential Manager target '$CredentialTarget' is unavailable (Win32 error $errorCode)."
    }

    $credential = [Runtime.InteropServices.Marshal]::PtrToStructure(
        $credentialPointer,
        [type][UsfPlan.AppCredential+NativeCredential]
    )
    if ($credential.CredentialBlobSize -eq 0 -or ($credential.CredentialBlobSize % 2) -ne 0) {
        throw "Credential target '$CredentialTarget' must contain a UTF-16 password."
    }

    $passwordBytes = New-Object byte[] $credential.CredentialBlobSize
    [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $passwordBytes, 0, $passwordBytes.Length)
    $credentialUsername = $credential.UserName
    $credentialPassword = [Text.Encoding]::Unicode.GetString($passwordBytes).TrimEnd([char]0)
    [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
    $passwordBytes = $null

    if ([string]::IsNullOrWhiteSpace($credentialUsername) -or [string]::IsNullOrEmpty($credentialPassword)) {
        throw "Credential target '$CredentialTarget' must contain a username and password."
    }

    $repositoryRoot = Split-Path -Parent $PSScriptRoot
    foreach ($directory in @('data\inputs', 'data\reports', 'data\logs')) {
        $fullPath = Join-Path $repositoryRoot $directory
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $userGrant = "*$sid`:(OI)(CI)F"
        & icacls.exe $fullPath /inheritance:r /grant:r $userGrant '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not apply the required local ACL to '$directory'."
        }
    }

    [Environment]::SetEnvironmentVariable('PGHOST', '127.0.0.1', 'Process')
    [Environment]::SetEnvironmentVariable('PGPORT', '5432', 'Process')
    [Environment]::SetEnvironmentVariable('PGDATABASE', 'usf_plan', 'Process')
    [Environment]::SetEnvironmentVariable('PGUSER', $credentialUsername, 'Process')
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $credentialPassword, 'Process')

    Push-Location $repositoryRoot
    try {
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            & npm.exe --prefix backend start
            $npmExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        if ($npmExitCode -ne 0) {
            throw "The backend exited with code $npmExitCode."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    [Environment]::SetEnvironmentVariable('PGHOST', $null, 'Process')
    [Environment]::SetEnvironmentVariable('PGPORT', $null, 'Process')
    [Environment]::SetEnvironmentVariable('PGDATABASE', $null, 'Process')
    [Environment]::SetEnvironmentVariable('PGUSER', $null, 'Process')
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $null, 'Process')

    if ($passwordBytes) {
        [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
    }
    if ($credentialPointer -ne [IntPtr]::Zero) {
        [UsfPlan.AppCredential]::CredFree($credentialPointer)
    }
    $credentialUsername = $null
    $credentialPassword = $null
}
