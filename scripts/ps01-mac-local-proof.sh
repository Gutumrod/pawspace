#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SANDBOX="${TMPDIR:-/tmp}/pawstia-ps01-shared-runtime-proof"
PROJECT_ID="ps01_shared_runtime_proof"
ACTION="${1:-prepare}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

need docker
need node
need pnpm
need python3
need supabase

docker info >/dev/null 2>&1 || fail "Docker is installed but not running."

stop_sandbox() {
  if [[ -f "$SANDBOX/supabase/config.toml" ]]; then
    (cd "$SANDBOX" && supabase stop --no-backup >/dev/null 2>&1) || true
  fi
  rm -rf "$SANDBOX"
}
prepare_sandbox() {
  echo "== PS01 Mac Local Proof: preflight =="
  docker --version
  node --version
  pnpm --version
  supabase --version

  (cd "$ROOT" && pnpm run build:ps01-baseline && pnpm run test:ps01-boundary)

  stop_sandbox
  mkdir -p "$SANDBOX/supabase/migrations"
  cp "$ROOT/supabase/config.toml" "$SANDBOX/supabase/config.toml"
  : > "$SANDBOX/supabase/seed.sql"

  python3 - "$SANDBOX/supabase/config.toml" "$PROJECT_ID" <<'PY'
from pathlib import Path
import re, sys
p = Path(sys.argv[1])
project_id = sys.argv[2]
s = p.read_text()
s = re.sub(r'^project_id = ".*"$', f'project_id = "{project_id}"', s, flags=re.M)
s = re.sub(r'^schemas = \[.*\]$', 'schemas = ["ps01", "graphql_public"]', s, flags=re.M)
s = re.sub(r'^extra_search_path = \[.*\]$', 'extra_search_path = ["ps01", "extensions"]', s, flags=re.M)
s = re.sub(r'^site_url = ".*"$', 'site_url = "http://127.0.0.1:3100"', s, flags=re.M)
p.write_text(s)
PY
  cat > "$SANDBOX/supabase/migrations/00000000000000_platform_prereqs.sql" <<'SQL'
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SQL

  cp "$ROOT/supabase/shared-runtime/ps01-baseline.sql" \
    "$SANDBOX/supabase/migrations/20260907000000_ps01_baseline.sql"

  echo "== Starting isolated local Supabase stack =="
  (cd "$SANDBOX" && supabase start)

  local db_container
  db_container="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | grep -i "$PROJECT_ID" | head -n 1 || true)"
  [[ -n "$db_container" ]] || fail "Could not identify PS01 local Postgres container."

  echo "== Running DB isolation assertions =="
  docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
    < "$ROOT/supabase/shared-runtime/ps01-db-proof.sql"

  echo "== Creating local-only Pawstia fixture =="
  local status_output
  status_output="$(cd "$SANDBOX" && supabase status -o env)"
  eval "$(printf '%s\n' "$status_output" | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
  PS01_LOCAL_SUPABASE_URL="$API_URL" \
  PS01_LOCAL_ANON_KEY="$ANON_KEY" \
  PS01_LOCAL_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  node "$ROOT/scripts/ps01-local-test-fixture.mjs"

  echo
  echo "PS01_PREPARE_PASS"
  echo "Sandbox: $SANDBOX"
  echo "Next: $0 app"
  echo "Stop: $0 stop"
}

start_app() {
  [[ -f "$SANDBOX/supabase/config.toml" ]] || fail "Sandbox not prepared. Run: $0 prepare"
  local status_output
  status_output="$(cd "$SANDBOX" && supabase status -o env)" || fail "Local Supabase stack is not running."
  eval "$(printf '%s\n' "$status_output" | grep -E '^(API_URL|ANON_KEY)=')"

  export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
  export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
  export APP_BASE_URL="http://127.0.0.1:3100"
  unset SUPABASE_SERVICE_ROLE_KEY || true

  echo "Starting Pawstia WITHOUT service-role credential."
  echo "Open: http://127.0.0.1:3100/login"
  echo "Login: owner@ps01.local.test"
  echo "Password: PawstiaLocal!2026  (LOCAL TEST ONLY)"
  cd "$ROOT"
  pnpm exec next dev -H 127.0.0.1 -p 3100
}
case "$ACTION" in
  prepare)
    prepare_sandbox
    ;;
  app)
    start_app
    ;;
  stop)
    stop_sandbox
    echo "PS01 local proof sandbox stopped and removed."
    ;;
  status)
    [[ -f "$SANDBOX/supabase/config.toml" ]] || fail "Sandbox not prepared."
    (cd "$SANDBOX" && supabase status)
    ;;
  *)
    fail "Usage: $0 {prepare|app|status|stop}"
    ;;
esac
