param([switch]$BuildOnly)
$ErrorActionPreference = 'Stop'
$vaultRoot = $PSScriptRoot
$vaultNode = (Get-Command node -ErrorAction Stop).Source
$vaultPython = Join-Path $vaultRoot '.tools\asset-env\Scripts\python.exe'
$vaultPythonArgs = ''
if (-not (Test-Path -LiteralPath $vaultPython)) {
    $vaultPy = Get-Command py -ErrorAction SilentlyContinue
    if ($vaultPy) { $vaultPython=$vaultPy.Source; $vaultPythonArgs='-3.12' }
    else { $vaultPython=(Get-Command python -ErrorAction Stop).Source }
}
$vaultBuild = Join-Path $vaultRoot '.tools\source-launcher'
New-Item -ItemType Directory -Path $vaultBuild -Force | Out-Null
$vaultVersion=(Get-Content -LiteralPath (Join-Path $vaultRoot 'package.json') | ConvertFrom-Json).version
if ($vaultVersion -notmatch '^\d+\.\d+\.\d+$') {throw 'Use a numeric major.minor.patch version.'}
$vaultVersionFile=Join-Path $vaultBuild 'Version.cs'
@('using System.Reflection;',"[assembly: AssemblyVersion(`"$vaultVersion.0`")]","[assembly: AssemblyInformationalVersion(`"$vaultVersion`")]") | Set-Content -LiteralPath $vaultVersionFile -Encoding UTF8
$vaultExe=Join-Path $vaultBuild 'Card Vault.exe'
$vaultIcon=Join-Path $vaultBuild 'card-vault.ico'
& (Join-Path $vaultRoot 'desktop\Generate-Icon.ps1') -Output $vaultIcon
$vaultCompiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $vaultCompiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/win32icon:$vaultIcon" "/out:$vaultExe" $vaultVersionFile (Join-Path $vaultRoot 'desktop\CardVault.cs')
if ($LASTEXITCODE -ne 0) { throw 'Could not build the source launcher. Close any running Card Vault launcher and retry.' }
if ($BuildOnly) {Write-Output $vaultExe;return}
$env:CARD_VAULT_SOURCE_ROOT=$vaultRoot
$env:CARD_VAULT_SOURCE_NODE=$vaultNode
$env:CARD_VAULT_SOURCE_PYTHON=$vaultPython
$env:CARD_VAULT_SOURCE_PYTHON_ARGS=$vaultPythonArgs
$env:CARD_VAULT_HOME=Join-Path $vaultRoot 'data'
Start-Process -FilePath $vaultExe -WorkingDirectory $vaultRoot
