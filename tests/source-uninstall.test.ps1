$ErrorActionPreference='Stop'
. "$PSScriptRoot\..\desktop\Uninstall-Source.ps1"
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('CardVault-source-test-'+[guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Force -Path "$fixture\data","$fixture\public\assets","$fixture\.tools\asset-env","$fixture\.tools\source-launcher","$fixture\.git" | Out-Null
    '{"name":"card-vault"}' | Set-Content "$fixture\package.json"
    foreach ($name in @('server.mjs','Start-CardVault.ps1','.git\keep','unrelated.txt')) {'Keep' | Set-Content (Join-Path $fixture $name)}
    $plan=@{app=$fixture;game=(Join-Path ([IO.Path]::GetTempPath()) 'game-protected');saves=(Join-Path ([IO.Path]::GetTempPath()) 'save-protected');process=2147483647}
    if (@(Get-SourceRemovalTargets $plan).Count -ne 4) {throw 'Wrong cleanup scope'}
    $unsafe=@{app=$fixture;game=$plan.game;saves="$fixture\data\game-saves"}
    $rejected=$false;try {Get-SourceRemovalTargets $unsafe | Out-Null}catch{$rejected=$true};if(-not $rejected){throw 'Protected save location accepted'}
    $helper=Join-Path $fixture 'test-helper.ps1';Copy-Item "$PSScriptRoot\..\desktop\Uninstall-Source.ps1" $helper
    $planFile=Join-Path $fixture 'test-plan.json';$plan|ConvertTo-Json|Set-Content $planFile
    & powershell -NoProfile -ExecutionPolicy Bypass -File $helper -PlanPath $planFile
    if($LASTEXITCODE -ne 0){throw 'Source cleanup failed'}
    foreach($name in @('data','public\assets','.tools\asset-env','.tools\source-launcher')){if(Test-Path (Join-Path $fixture $name)){throw 'Generated data remains'}}
    foreach($name in @('server.mjs','package.json','Start-CardVault.ps1','.git\keep','unrelated.txt')){if(-not(Test-Path (Join-Path $fixture $name))){throw 'Source or unrelated data deleted'}}
    Write-Output 'Source uninstall safely removed only generated data in a disposable fixture.'
}finally{
    $resolved=[IO.Path]::GetFullPath($fixture)
    if(-not $resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike 'CardVault-source-test-*'){throw 'Unsafe fixture cleanup'}
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
