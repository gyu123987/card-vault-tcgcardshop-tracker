param([string]$PlanPath,[switch]$ValidateOnly)
$ErrorActionPreference='Stop'
function Get-SourceRemovalTargets($plan) {
    $sourceRoot=[IO.Path]::GetFullPath($plan.app).TrimEnd('\')
    if ((Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json).name -ne 'card-vault' -or -not (Test-Path -LiteralPath (Join-Path $sourceRoot 'server.mjs')) -or -not (Test-Path -LiteralPath (Join-Path $sourceRoot 'Start-CardVault.ps1'))) { throw 'Not a Card Vault source installation.' }
    $targets=@('data','public\assets','.tools\asset-env','.tools\source-launcher') | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $sourceRoot $_)) }
    foreach ($target in $targets) {
        if (-not $target.StartsWith($sourceRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Removal escaped the source installation.' }
        foreach ($protected in @($plan.game,$plan.saves,$env:USERPROFILE,$env:WINDIR,$env:LOCALAPPDATA)) {
            if (-not $protected) {continue}
            $path=[IO.Path]::GetFullPath($protected).TrimEnd('\')
            if ($target -eq $path -or $path.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Removal contains a protected location.' }
            if (($protected -eq $plan.game -or $protected -eq $plan.saves) -and $target.StartsWith($path+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Removal overlaps game files or saves.' }
        }
        $cursor=$target
        while ($cursor) {
            if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked folders cannot be removed automatically.' }
            $cursor=Split-Path -Parent $cursor
        }
        if ((Test-Path -LiteralPath $target) -and (Get-ChildItem -LiteralPath $target -Recurse -Force | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint} | Select-Object -First 1)) { throw 'Linked content cannot be removed automatically.' }
    }
    return $targets
}
if ($PlanPath) {
    try {
        $plan=Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json
        $targets=Get-SourceRemovalTargets $plan
        if ($ValidateOnly) {exit 0}
        $launcher=Get-Process -Id $plan.process -ErrorAction SilentlyContinue
        if ($launcher -and -not $launcher.WaitForExit(30000)) {throw 'Launcher is still running.'}
        $targets=Get-SourceRemovalTargets $plan
        foreach ($target in $targets) {if (Test-Path -LiteralPath $target) {Remove-Item -LiteralPath $target -Recurse -Force}}
        Remove-Item -LiteralPath $PlanPath -Force
        Remove-Item -LiteralPath $PSCommandPath -Force
    } catch {
        Add-Type -AssemblyName System.Windows.Forms
        [Windows.Forms.MessageBox]::Show("Cleanup could not finish: $($_.Exception.Message)",'Card Vault') | Out-Null
        exit 1
    }
}
