$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$status = pnpm exec supabase status -o env
if ($LASTEXITCODE -ne 0) { throw "Local Supabase is not running." }

foreach ($line in $status) {
  if ($line -match '^([A-Z0-9_]+)="(.*)"$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
  }
}

$env:NEXT_PUBLIC_SUPABASE_URL = $env:API_URL
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $env:ANON_KEY
$env:SUPABASE_SERVICE_ROLE_KEY = $env:SERVICE_ROLE_KEY
$env:APP_BASE_URL = "http://127.0.0.1:3100"
$env:NODE_ENV = "test"

if (-not $env:NEXT_PUBLIC_SUPABASE_URL -or -not $env:NEXT_PUBLIC_SUPABASE_ANON_KEY -or -not $env:SUPABASE_SERVICE_ROLE_KEY) {
  throw "Could not resolve local Supabase credentials from supabase status."
}

pnpm build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm exec playwright test tests/e2e/phase10-pilot.spec.ts
exit $LASTEXITCODE
