[CmdletBinding()]
param(
    [string]$CredentialTarget = 'USF-PLAN/PostgreSQL',
    [ValidateRange(1, 600)]
    [int]$WaitTimeoutSeconds = 120
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not ('UsfPlan.CredentialNative' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace UsfPlan
{
    public static class CredentialNative
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

try {
    if (-not [UsfPlan.CredentialNative]::CredRead($CredentialTarget, 1, 0, [ref]$credentialPointer)) {
        $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "Windows Credential Manager target '$CredentialTarget' is unavailable (Win32 error $errorCode)."
    }

    $credential = [Runtime.InteropServices.Marshal]::PtrToStructure(
        $credentialPointer,
        [type][UsfPlan.CredentialNative+NativeCredential]
    )

    if ($credential.CredentialBlobSize -eq 0 -or ($credential.CredentialBlobSize % 2) -ne 0) {
        throw "Credential target '$CredentialTarget' must contain a UTF-16 password."
    }

    $passwordBytes = New-Object byte[] $credential.CredentialBlobSize
    [Runtime.InteropServices.Marshal]::Copy(
        $credential.CredentialBlob,
        $passwordBytes,
        0,
        $passwordBytes.Length
    )
    $credentialUsername = $credential.UserName
    $credentialPassword = [Text.Encoding]::Unicode.GetString($passwordBytes).TrimEnd([char]0)
    [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)

    if ([string]::IsNullOrWhiteSpace($credentialUsername) -or [string]::IsNullOrEmpty($credentialPassword)) {
        throw "Credential target '$CredentialTarget' must contain a username and password."
    }

    [Environment]::SetEnvironmentVariable('POSTGRES_DB', 'usf_plan', 'Process')
    [Environment]::SetEnvironmentVariable('POSTGRES_USER', $credentialUsername, 'Process')
    [Environment]::SetEnvironmentVariable('POSTGRES_PASSWORD', $credentialPassword, 'Process')

    $repositoryRoot = Split-Path -Parent $PSScriptRoot
    Push-Location $repositoryRoot
    try {
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $composeOutput = & docker compose up -d --wait --wait-timeout $WaitTimeoutSeconds 2>&1
            $composeExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        foreach ($line in $composeOutput) {
            $safeLine = [string]$line
            if ($credentialPassword.Length -gt 0) {
                $safeLine = $safeLine.Replace($credentialPassword, '[REDACTED]')
            }
            if (-not [string]::IsNullOrEmpty($credentialUsername)) {
                $safeLine = $safeLine.Replace($credentialUsername, '[REDACTED]')
            }
            Write-Output $safeLine
        }

        if ($composeExitCode -ne 0) {
            throw "Docker Compose failed with exit code $composeExitCode."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    [Environment]::SetEnvironmentVariable('POSTGRES_DB', $null, 'Process')
    [Environment]::SetEnvironmentVariable('POSTGRES_USER', $null, 'Process')
    [Environment]::SetEnvironmentVariable('POSTGRES_PASSWORD', $null, 'Process')

    if ($credentialPointer -ne [IntPtr]::Zero) {
        [UsfPlan.CredentialNative]::CredFree($credentialPointer)
    }

    $credentialUsername = $null
    $credentialPassword = $null
}
