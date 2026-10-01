param([string]$GameDirectory)
$ErrorActionPreference = 'Stop'
$vaultRoot = $PSScriptRoot
$vaultPython = Join-Path $vaultRoot '.tools\asset-env\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $vaultPython)) {
    $launcher = Get-Command py -ErrorAction SilentlyContinue
    if (-not $launcher) { throw 'Install Python 3.12 from python.org with the Python launcher, then retry Retrieve Game Assets.cmd.' }
    & $launcher.Source -3.12 -m venv (Join-Path $vaultRoot '.tools\asset-env')
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 is required. Install it from python.org and retry.' }
}
Write-Host 'Preparing local asset tools from PyPI. Game artwork is read only from your installation.'
& $vaultPython -m pip install -r (Join-Path $vaultRoot 'tools\requirements-assets.txt')
if ($LASTEXITCODE -ne 0) { throw 'Could not install extraction dependencies. Check your internet connection and retry.' }
$vaultArguments = @((Join-Path $vaultRoot 'tools\retrieve_assets.py'))
if ($GameDirectory) { $vaultArguments += @('--game', $GameDirectory) }
& $vaultPython @vaultArguments
if ($LASTEXITCODE -ne 0) { throw 'Asset extraction failed. Check the error above; game files and saves were not modified.' }
