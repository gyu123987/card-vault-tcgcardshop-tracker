param([string]$PlanPath, [switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'

function Assert-VaultUninstall($plan) {
    $appRoot = [IO.Path]::GetFullPath($plan.app).TrimEnd('\')
    $dataRoot = [IO.Path]::GetFullPath($plan.data).TrimEnd('\')
    $expected = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CardVault')).TrimEnd('\')
    if ($dataRoot -ne $expected) { throw 'Only the standard Card Vault data folder can be removed automatically.' }
    if ((Get-Content -LiteralPath (Join-Path $appRoot 'card-vault-package.txt') -Raw).Trim() -ne 'CardVault portable package') { throw 'Not a Card Vault package.' }
    if (-not (Test-Path -LiteralPath (Join-Path $appRoot 'Card Vault.exe')) -or -not (Test-Path -LiteralPath (Join-Path $appRoot 'app\server.mjs'))) { throw 'Incomplete package.' }
    foreach ($protected in @($plan.game, $plan.saves, $env:USERPROFILE, $env:WINDIR, $env:LOCALAPPDATA, $dataRoot)) {
        if (-not $protected) { continue }
        $path = [IO.Path]::GetFullPath($protected).TrimEnd('\')
        if ($path -eq $appRoot -or $path.StartsWith($appRoot+'\', [StringComparison]::OrdinalIgnoreCase)) { throw 'App folder contains a protected location.' }
        if (($protected -eq $plan.game -or $protected -eq $plan.saves) -and $appRoot.StartsWith($path+'\', [StringComparison]::OrdinalIgnoreCase)) { throw 'App folder is inside game files or saves.' }
        if (($protected -eq $plan.game -or $protected -eq $plan.saves) -and ($dataRoot -eq $path -or $dataRoot.StartsWith($path+'\', [StringComparison]::OrdinalIgnoreCase) -or $path.StartsWith($dataRoot+'\', [StringComparison]::OrdinalIgnoreCase))) { throw 'Data overlaps game files or saves.' }
    }
    # Never follow junctions or symbolic links during recursive removal.
    foreach ($target in @((Join-Path $appRoot 'app'), (Join-Path $appRoot 'runtime'), $dataRoot)) {
        $cursor = $target
        while ($cursor) {
            if (Test-Path -LiteralPath $cursor) {
                if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked folders cannot be uninstalled automatically.' }
            }
            $cursor = Split-Path -Parent $cursor
        }
        if (Test-Path -LiteralPath $target) {
            if (Get-ChildItem -LiteralPath $target -Force -Recurse | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } | Select-Object -First 1) { throw 'Linked content cannot be uninstalled automatically.' }
        }
    }
    return @{ app=$appRoot; data=$dataRoot }
}

if ($PlanPath) {
    try {
        $plan = Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json
        $paths = Assert-VaultUninstall $plan
        if ($ValidateOnly) { exit 0 }
        $launcher = Get-Process -Id $plan.process -ErrorAction SilentlyContinue
        if ($launcher -and -not $launcher.WaitForExit(30000)) { throw 'Launcher is still running.' }
        $paths = Assert-VaultUninstall $plan
        # Explicit package allowlist preserves unrelated files alongside the app.
        foreach ($name in @('app','runtime','Card Vault.exe','START-HERE.txt','THIRD_PARTY_NOTICES.md','card-vault-package.txt','Uninstall-CardVault.ps1')) {
            $target = [IO.Path]::GetFullPath((Join-Path $paths.app $name))
            if (-not $target.StartsWith($paths.app+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Removal escaped package.' }
            if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force -Recurse }
        }
        if (Test-Path -LiteralPath $paths.data) { Remove-Item -LiteralPath $paths.data -Force -Recurse }
        if (-not (Get-ChildItem -LiteralPath $paths.app -Force | Select-Object -First 1)) { Remove-Item -LiteralPath $paths.app }
        Remove-Item -LiteralPath $PlanPath -Force
        Remove-Item -LiteralPath $PSCommandPath -Force
    } catch {
        Add-Type -AssemblyName System.Windows.Forms
        [Windows.Forms.MessageBox]::Show("Uninstall could not finish: $($_.Exception.Message)", 'Card Vault') | Out-Null
        exit 1
    }
}
