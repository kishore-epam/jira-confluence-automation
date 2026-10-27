[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$ProjectRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

$databaseScript = Join-Path $ProjectRoot 'scripts\start-local-database.ps1'
$backendScript = Join-Path $ProjectRoot 'scripts\start-local-backend.ps1'
foreach ($scriptPath in @($databaseScript, $backendScript)) {
    if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
        throw "Required local startup script '$scriptPath' was not found."
    }
}

if (-not $PSCmdlet.ShouldProcess($ProjectRoot, 'Start local PostgreSQL and Express API')) {
    Write-Output 'Would start PostgreSQL using Windows Credential Manager, then start the Express API using its local credential wrapper.'
    return
}

& $databaseScript

& $backendScript
