$ErrorActionPreference='Stop'
. "$PSScriptRoot\..\desktop\Uninstall-CardVault.ps1"
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('CardVault-uninstall-test-'+[guid]::NewGuid().ToString('N'))
$previous=$env:LOCALAPPDATA
try {
    $env:LOCALAPPDATA=Join-Path $fixture 'local'
    $app=Join-Path $fixture 'package'
    $data=Join-Path $env:LOCALAPPDATA 'CardVault'
    New-Item -ItemType Directory -Force -Path "$app\app",$data | Out-Null
    'CardVault portable package' | Set-Content "$app\card-vault-package.txt"
    '' | Set-Content "$app\Card Vault.exe"
    '' | Set-Content "$app\app\server.mjs"
    $plan=@{app=$app;data=$data;game=(Join-Path $fixture 'game');saves=(Join-Path $fixture 'saves')}
    $valid=Assert-VaultUninstall $plan
    if ($valid.app -ne $app) { throw 'Valid package rejected' }
    function Reject($candidate) {
        $rejected=$false
        try { Assert-VaultUninstall $candidate | Out-Null } catch { $rejected=$true }
        if (-not $rejected) { throw 'Unsafe plan was accepted' }
    }
    Reject (@{app=$app;data=$env:LOCALAPPDATA;game=$plan.game;saves=$plan.saves})
    Reject (@{app=$app;data=$data;game="$app\game";saves=$plan.saves})
    Reject (@{app=$app;data=$data;game=$plan.game;saves="$data\saves"})
    Reject (@{app=$fixture;data=$data;game=$plan.game;saves=$plan.saves})
    'Wrong marker' | Set-Content "$app\card-vault-package.txt"
    Reject $plan
    'CardVault portable package' | Set-Content "$app\card-vault-package.txt"
    'Keep this unrelated file' | Set-Content "$app\unrelated.txt"
    'Disposable draft' | Set-Content "$data\draft.json"
    $helper=Join-Path $fixture 'cleanup.ps1'
    Copy-Item "$PSScriptRoot\..\desktop\Uninstall-CardVault.ps1" $helper
    $plan.process=2147483647
    $planFile=Join-Path $fixture 'plan.json'
    $plan | ConvertTo-Json | Set-Content $planFile
    & powershell -NoProfile -ExecutionPolicy Bypass -File $helper -PlanPath $planFile
    if ($LASTEXITCODE -ne 0 -or (Test-Path "$app\Card Vault.exe") -or (Test-Path $data) -or -not (Test-Path "$app\unrelated.txt")) { throw 'Fixture uninstall did not preserve its scope' }
    Write-Host 'Uninstall safety checks passed (no real app or user data removed).'
} finally {
    $env:LOCALAPPDATA=$previous
    $resolved=[IO.Path]::GetFullPath($fixture)
    if (-not $resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike 'CardVault-uninstall-test-*') { throw 'Unsafe fixture cleanup' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
