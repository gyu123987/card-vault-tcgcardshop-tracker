$ErrorActionPreference = 'Stop'
$vaultRoot = $PSScriptRoot
$vaultUrl = 'http://127.0.0.1:4317'
New-Item -ItemType Directory -Path (Join-Path $vaultRoot 'data') -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $vaultRoot 'data/catalog.json')) -or -not (Test-Path -LiteralPath (Join-Path $vaultRoot 'public/assets/render-data.json'))) {
    Write-Host 'First run: retrieving card assets from your installed game.'
    & (Join-Path $vaultRoot 'Retrieve-GameAssets.ps1')
}
try { $null = Invoke-RestMethod "$vaultUrl/api/state" -TimeoutSec 2 } catch {
    $vaultNode = (Get-Command node -ErrorAction Stop).Source
    Start-Process -FilePath $vaultNode -ArgumentList 'server.mjs' -WorkingDirectory $vaultRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $vaultRoot 'data/server.log') -RedirectStandardError (Join-Path $vaultRoot 'data/server-error.log')
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 300
        try { $null = Invoke-RestMethod "$vaultUrl/api/state" -TimeoutSec 2; break } catch { if ($attempt -eq 29) { throw 'Card Vault could not start. Check data/server-error.log.' } }
    }
}
Start-Process $vaultUrl
