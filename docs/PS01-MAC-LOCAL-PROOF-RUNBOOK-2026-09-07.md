# PS01 Mac Local Proof Runbook

**Date:** 2026-09-07
**Product:** Pawstia PMS / PS01
**Purpose:** prove PS01 shared-runtime isolation in a local Supabase sandbox before WSTERA LAB
**Hard rule:** this runbook does not link to, reset, push, or mutate WSTERA LAB/Production.

## What this proves

The Mac run must prove:

- generated `ps01` baseline applies to a real Supabase/Postgres stack;
- no PS01 business table lands in `public`;
- PS01 functions do not retain the legacy `public` search path;
- `ps01_runtime` has no elevated PostgreSQL role attributes;
- PS01 Storage uses the `ps01-` bucket name;
- PS01 runtime cannot cross into a foreign test schema;
- a foreign test role cannot read `ps01`;
- project `service_role` has no `USAGE` on `ps01` after baseline hardening;
- local test Owner can authenticate and bootstrap Pawstia core data;
- Pawstia app can start without `SUPABASE_SERVICE_ROLE_KEY`.

## Before running

Required on Mac:

- Docker Desktop running;
- Node.js and pnpm;
- Supabase CLI available as `supabase`;
- branch `build/ps-sr02-staging-2026-09-06` pulled from origin.
## Run sequence

From the PawSpace repository on Mac:

```bash
git fetch origin
git switch build/ps-sr02-staging-2026-09-06
git pull
bash scripts/ps01-mac-local-proof.sh prepare
```

The `prepare` action:

1. checks Docker/Node/pnpm/Supabase CLI;
2. regenerates and verifies the PS01 baseline;
3. creates a temp Supabase workspace outside the repo;
4. copies only PS01 baseline into that temp migration stream;
5. creates required extensions as sandbox/platform prerequisites;
6. starts local Supabase;
7. executes `ps01-db-proof.sql` inside local Postgres;
8. creates a local-only test owner, shop, room, customer, pet and booking.

The repository's 13 historical migrations are not replayed by this sandbox.

Expected terminal markers:

```text
PS01 shared-runtime boundary verification PASS
PS01_DB_PROOF_PASS
PS01_LOCAL_FIXTURE_PASS
PS01_PREPARE_PASS
```
## Open Pawstia after prepare passes

Run:

```bash
bash scripts/ps01-mac-local-proof.sh app
```

Then open:

```text
http://127.0.0.1:3100/login
```

Local test credentials:

```text
Email: owner@ps01.local.test
Password: PawstiaLocal!2026
```

These credentials exist only in the local disposable sandbox.
The app process receives only the local Supabase URL and anon key.
`SUPABASE_SERVICE_ROLE_KEY` is explicitly unset before Next.js starts.

Expected visible fixture:

- shop: Pawstia Local Proof Hotel;
- room: A-01;
- customer: Local Tester;
- pet: Milo;
- one confirmed local-proof booking.
## Stop and remove the sandbox

After testing:

```bash
bash scripts/ps01-mac-local-proof.sh stop
```

The sandbox lives under the Mac temporary directory, not inside the repository.
Stopping it removes the disposable local database state.

## Failure policy

If any proof step fails:

- do not point the script at WSTERA LAB;
- do not use `supabase link`;
- do not use `supabase db push`;
- do not use `supabase db reset --linked`;
- do not substitute production credentials;
- keep the failure output as PS01 evidence and remediate locally.

WSTERA LAB remains blocked until the complete isolated proof passes.

## Why the temp workspace is mandatory

Current Supabase CLI behavior applies migrations when starting/resetting a local project.
Running the normal PawSpace `supabase/` folder would replay the 13 historical migrations that target `public`.
The proof harness therefore copies only the generated PS01 baseline into a disposable Supabase workspace.
