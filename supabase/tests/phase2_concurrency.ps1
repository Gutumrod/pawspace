param([string]$DbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
$ErrorActionPreference = "Stop"
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { throw "psql is required" }
$dir = $PSScriptRoot
& psql $DbUrl -v ON_ERROR_STOP=1 -f (Join-Path $dir "phase2_concurrency_setup.sql")
if ($LASTEXITCODE -ne 0) { throw "Concurrency setup failed" }
$j1 = Start-Job -ScriptBlock { param($url,$f) & psql $url -v ON_ERROR_STOP=1 -f $f; if ($LASTEXITCODE -ne 0) { throw "worker1 expected conflict or failed" } } -ArgumentList $DbUrl,(Join-Path $dir "phase2_concurrency_worker1.sql")
$j2 = Start-Job -ScriptBlock { param($url,$f) & psql $url -v ON_ERROR_STOP=1 -f $f; if ($LASTEXITCODE -ne 0) { throw "worker2 expected conflict or failed" } } -ArgumentList $DbUrl,(Join-Path $dir "phase2_concurrency_worker2.sql")
Wait-Job $j1,$j2 | Out-Null
Receive-Job $j1 -ErrorAction SilentlyContinue | Out-Host
Receive-Job $j2 -ErrorAction SilentlyContinue | Out-Host
& psql $DbUrl -v ON_ERROR_STOP=1 -f (Join-Path $dir "phase2_concurrency_verify.sql")
if ($LASTEXITCODE -ne 0) { throw "Concurrency verification failed" }
Write-Host "same-pet overlap race converged to exactly one assignment"
Remove-Job $j1,$j2 -Force
