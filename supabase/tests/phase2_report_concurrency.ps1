param([string]$DbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
$ErrorActionPreference = "Stop"
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { throw "psql is required" }
$dir=$PSScriptRoot
& psql $DbUrl -v ON_ERROR_STOP=1 -f (Join-Path $dir "phase2_report_concurrency_setup.sql")
if ($LASTEXITCODE -ne 0) { throw "report concurrency setup failed" }
$dupFile=Join-Path $dir "phase2_report_duplicate_worker.sql"
$j1=Start-Job -ScriptBlock { param($url,$f) & psql $url -v ON_ERROR_STOP=1 -f $f; $LASTEXITCODE } -ArgumentList $DbUrl,$dupFile
$j2=Start-Job -ScriptBlock { param($url,$f) & psql $url -v ON_ERROR_STOP=1 -f $f; $LASTEXITCODE } -ArgumentList $DbUrl,$dupFile
Wait-Job $j1,$j2 | Out-Null
$e1=[int](Receive-Job $j1 | Select-Object -Last 1); $e2=[int](Receive-Job $j2 | Select-Object -Last 1)
Remove-Job $j1,$j2 -Force
if ($e1 -ne 0 -or $e2 -ne 0) { throw "duplicate report callers must both succeed: $e1/$e2" }
$checkout=Join-Path $dir "phase2_report_checkout_worker.sql"; $report=Join-Path $dir "phase2_report_race_worker.sql"
$jc=Start-Job -ScriptBlock { param($url,$f) & psql $url -v ON_ERROR_STOP=1 -f $f; $LASTEXITCODE } -ArgumentList $DbUrl,$checkout
Start-Sleep -Milliseconds 250
$jr=Start-Job -ScriptBlock { param($url,$f) & psql $url -v ON_ERROR_STOP=1 -f $f; $LASTEXITCODE } -ArgumentList $DbUrl,$report
Wait-Job $jc,$jr | Out-Null
$ec=[int](Receive-Job $jc | Select-Object -Last 1); $er=[int](Receive-Job $jr | Select-Object -Last 1)
Remove-Job $jc,$jr -Force
if ($ec -ne 0) { throw "checkout worker failed: $ec" }
if ($er -eq 0) { throw "report racing behind checkout should be rejected" }
& psql $DbUrl -v ON_ERROR_STOP=1 -f (Join-Path $dir "phase2_report_concurrency_verify.sql")
if ($LASTEXITCODE -ne 0) { throw "report concurrency verification failed" }
Write-Host "daily-report duplicate and checkout-race concurrency checks passed"
