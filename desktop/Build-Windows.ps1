param([string]$PythonCommand = 'py')
$ErrorActionPreference = 'Stop'
$vaultRoot = Split-Path -Parent $PSScriptRoot
$build = Join-Path $vaultRoot '.tools\desktop-build'
$package = Join-Path $vaultRoot 'dist\CardVault-Windows'
New-Item -ItemType Directory -Force -Path $build,$package | Out-Null
# Refuse to merge a release with a previous package or its personal data.
if (Test-Path -LiteralPath (Join-Path $package 'Card Vault.exe')) { throw 'dist/CardVault-Windows already exists. Move the old package aside before rebuilding.' }
function Fetch($Url, $Name) {
    $dest = Join-Path $build $Name
    if (-not (Test-Path -LiteralPath $dest)) { Invoke-WebRequest -Uri $Url -OutFile $dest -UseBasicParsing }
    return $dest
}
$nodeVersion='22.22.0'
$nodeName="node-v$nodeVersion-win-x64.zip"
$nodeZip=Fetch "https://nodejs.org/dist/v$nodeVersion/$nodeName" $nodeName
$sums=Fetch "https://nodejs.org/dist/v$nodeVersion/SHASUMS256.txt" "node-$nodeVersion-SHASUMS256.txt"
$expected=((Get-Content $sums | Where-Object { $_.EndsWith("  $nodeName") }) -split '\s+')[0]
if (-not $expected -or (Get-FileHash $nodeZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Node archive checksum mismatch.' }
$pythonZip=Fetch 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip' 'python-3.12.10-embed-amd64.zip'
# Published archive checksum on the Python 3.12.10 release page (transport uses HTTPS).
if ((Get-FileHash $pythonZip -Algorithm MD5).Hash.ToLowerInvariant() -ne 'fe8ef205f2e9c3ba44d0cf9954e1abd3') { throw 'Python archive checksum mismatch.' }
$nodeExtract=Join-Path $build 'node'
Expand-Archive -LiteralPath $nodeZip -DestinationPath $nodeExtract -Force
$nodeRuntime=Join-Path $package 'runtime\node'
$pythonRuntime=Join-Path $package 'runtime\python'
New-Item -ItemType Directory -Force -Path $nodeRuntime,$pythonRuntime | Out-Null
Copy-Item -LiteralPath (Join-Path $nodeExtract "node-v$nodeVersion-win-x64\node.exe") -Destination $nodeRuntime
Copy-Item -LiteralPath (Join-Path $nodeExtract "node-v$nodeVersion-win-x64\LICENSE") -Destination $nodeRuntime
Expand-Archive -LiteralPath $pythonZip -DestinationPath $pythonRuntime -Force
@('python312.zip','.','Lib/site-packages','import site') | Set-Content -LiteralPath (Join-Path $pythonRuntime 'python312._pth') -Encoding ASCII
$pythonArgs=@()
if ([IO.Path]::GetFileNameWithoutExtension($PythonCommand) -eq 'py') { $pythonArgs=@('-3.12') }
& $PythonCommand @pythonArgs -m pip install --target (Join-Path $pythonRuntime 'Lib\site-packages') -r (Join-Path $vaultRoot 'tools\requirements-assets.txt')
if ($LASTEXITCODE -ne 0) { throw 'Could not bundle extraction dependencies.' }
$app=Join-Path $package 'app'
New-Item -ItemType Directory -Force -Path "$app\public","$app\tools" | Out-Null
foreach($name in @('server.mjs','package.json','lib')) { Copy-Item -LiteralPath (Join-Path $vaultRoot $name) -Destination $app -Recurse }
foreach($name in @('app.js','card-renderer.js','index.html','style.css','fonts')) { Copy-Item -LiteralPath (Join-Path $vaultRoot "public\$name") -Destination "$app\public" -Recurse }
foreach($name in @('retrieve_assets.py','extract_catalog.py','render_assets.py','economy_assets.py')) { Copy-Item -LiteralPath (Join-Path $vaultRoot "tools\$name") -Destination "$app\tools" }
Copy-Item -LiteralPath (Join-Path $vaultRoot 'THIRD_PARTY_NOTICES.md') -Destination $package
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'START-HERE.txt') -Destination $package
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Uninstall-CardVault.ps1') -Destination $package
'CardVault portable package' | Set-Content -LiteralPath (Join-Path $package 'card-vault-package.txt') -Encoding ASCII
$version=(Get-Content -LiteralPath (Join-Path $vaultRoot 'package.json') | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Use a numeric major.minor.patch release version.' }
$icon=Join-Path $build 'card-vault.ico'
& (Join-Path $PSScriptRoot 'Generate-Icon.ps1') -Output $icon
$versionSource=Join-Path $build 'Version.cs'
@("using System.Reflection;", "[assembly: AssemblyVersion(`"$version.0`")]", "[assembly: AssemblyFileVersion(`"$version.0`")]", "[assembly: AssemblyInformationalVersion(`"$version`")]", '[assembly: AssemblyProduct("Card Vault")]') | Set-Content -LiteralPath $versionSource -Encoding UTF8
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/win32icon:$icon" "/out:$package\Card Vault.exe" $versionSource (Join-Path $PSScriptRoot 'CardVault.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
# Assert distribution never includes game content or private app records.
if ((Test-Path "$app\data") -or (Test-Path "$app\public\assets")) { throw 'Private/generated content found in package.' }
$packageRoot=(Resolve-Path -LiteralPath $package).Path
Get-ChildItem -LiteralPath $packageRoot -Directory -Recurse -Filter '__pycache__' | ForEach-Object {
    $cachePath=[IO.Path]::GetFullPath($_.FullName)
    if (-not $cachePath.StartsWith($packageRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Cache cleanup escaped the package.' }
    Remove-Item -LiteralPath $cachePath -Recurse -Force
}
Compress-Archive -LiteralPath $package -DestinationPath (Join-Path $vaultRoot 'dist\CardVault-Windows.zip') -Force
$zip=Join-Path $vaultRoot 'dist\CardVault-Windows.zip'
((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()+'  CardVault-Windows.zip') | Set-Content -LiteralPath (Join-Path $vaultRoot 'dist\CardVault-Windows.sha256') -Encoding ASCII
Write-Host "Ready: $package\Card Vault.exe"
