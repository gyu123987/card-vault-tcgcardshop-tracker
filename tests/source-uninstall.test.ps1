$ErrorActionPreference='Stop'
. "$PSScriptRoot\..\desktop\Uninstall-Source.ps1"
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('CardVault-source-test-'+[guid]::NewGuid().ToString('N'))
try {
    $testRoot=$fixture
    $fixture=Join-Path $testRoot 'installation'
    New-Item -ItemType Directory -Force -Path "$fixture\data","$fixture\public\assets","$fixture\.tools\asset-env","$fixture\.tools\source-launcher","$fixture\.git" | Out-Null
    '{"name":"card-vault"}' | Set-Content "$fixture\package.json"
    foreach ($name in @('server.mjs','Start-CardVault.ps1','.git\keep','unrelated.txt')) {'Keep' | Set-Content (Join-Path $fixture $name)}
    $plan=@{app=$fixture;game=(Join-Path ([IO.Path]::GetTempPath()) 'game-protected');saves=(Join-Path ([IO.Path]::GetTempPath()) 'save-protected');process=2147483647;fullRemovalConfirmed=$true}
    if (@(Get-SourceRemovalTargets $plan).Count -ne 1 -or (Get-SourceRemovalTargets $plan) -ne $fixture) {throw 'Wrong cleanup scope'}
    $unsafe=@{app=$fixture;game=$plan.game;saves="$fixture\data\game-saves";fullRemovalConfirmed=$true}
    $rejected=$false;try {Get-SourceRemovalTargets $unsafe | Out-Null}catch{$rejected=$true};if(-not $rejected){throw 'Protected save location accepted'}
    $unconfirmed=@{app=$fixture;game=$plan.game;saves=$plan.saves};$rejected=$false;try{Get-SourceRemovalTargets $unconfirmed | Out-Null}catch{$rejected=$true};if(-not $rejected){throw 'Unconfirmed removal accepted'}
    'Keep outside installation' | Set-Content (Join-Path $testRoot 'outside.txt')
    $helper=Join-Path $testRoot 'test-helper.ps1';Copy-Item "$PSScriptRoot\..\desktop\Uninstall-Source.ps1" $helper
    $planFile=Join-Path $testRoot 'test-plan.json';$plan|ConvertTo-Json|Set-Content $planFile
    & powershell -NoProfile -ExecutionPolicy Bypass -File $helper -PlanPath $planFile
    if($LASTEXITCODE -ne 0){throw 'Source cleanup failed'}
    if(Test-Path -LiteralPath $fixture){throw 'Installation folder remains'}
    if(-not(Test-Path -LiteralPath (Join-Path $testRoot 'outside.txt'))){throw 'File outside installation deleted'}
    Write-Output 'Confirmed source uninstall removed the full disposable installation and preserved outside files.'
}finally{
    $resolved=[IO.Path]::GetFullPath($testRoot)
    if(-not $resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike 'CardVault-source-test-*'){throw 'Unsafe fixture cleanup'}
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
