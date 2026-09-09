# H3D — PS01 Customer LINE Data API Path Replacement

**Date:** 2026-09-09 (Asia/Bangkok)
**Product:** PS01 / Pawstia PMS
**Execution branch:** `work/ps01-h3d-data-api-20260909`
**Base commit:** `c21c27c18f57ee2c54172c0d08697ab02b184b4a`
**Isolated worktree:** `D:\AI-Workspace\runtime\worktrees\ps01-h3d-data-api-20260909`
**Environment:** WSTERA LAB (`ykxlqnshaaxmzzocpjlj`) only — Production LOCKED
**Status:** `H3D STATIC IMPLEMENTATION — LIVE SMOKE BLOCKED ON HOSTED OPERATOR ACTION`

## Source-of-Truth References

1. House brief: `docs/platform/shared-runtime/BRIEF-CLAUDE-H3D-H5-HOUSE-A-LONG-RUN-EXECUTION-2026-09-09.md` (House repo)
2. `docs/platform/shared-runtime/DESIGN-H2-SHARED-RUNTIME-ISOLATION-EXECUTION-BOUNDARY-2026-09-08.md` (House repo) — H3D workflow
3. `docs/platform/shared-runtime/evidence/H3B-POST-APPLY-RUNTIME-BOUNDARY-2026-09-08.md` (House repo)
4. `docs/platform/shared-runtime/evidence/H3C-FINAL-CLOSURE-2026-09-09.md` (House repo)
5. `docs/platform/shared-runtime/evidence/H3D-START-SNAPSHOT-2026-09-09.json` (House repo) — read-only LAB start snapshot for this run
6. PS01 contract: `docs/PS01-SHARED-RUNTIME-ISOLATION-CONTRACT-2026-09-07.md`
7. PS01 handoff: `docs/daily/HANDOFF-PS01-BOOKING-V2-SHARED-RUNTIME-CONTINUATION-2026-09-08.md`
8. Adapters: `lib/ps01-runtime-db.ts` (pooler, becomes rollback/reference), `lib/ps01-runtime.ts` (repurposed as active Data API adapter), `lib/line-booking-server.ts`, `lib/line-booking-core.ts`, `lib/env.ts`

## 1. Goal (House brief §7)

Replace the active PS01 Customer LINE server path so it no longer uses the reusable PostgreSQL pooler login `ps01_runtime_login`. Target active path:

```
LINE -> Next.js server -> Supabase Data API (PostgREST)
     -> short-lived Auth-issued JWT, role=ps01_line_runtime
     -> exact PS01 gateway RPC (3 allowlisted names only)
```

## 2. Verified starting state (from H3D-START-SNAPSHOT-2026-09-09.json)

- `ps01_line_runtime`: NOLOGIN, NOINHERIT, no createrole/createdb/bypassrls; `USAGE` on `ps01` only; **no** `local_service` / `ps01_internal` / `mt01` / `cron` / `auth` / `storage` USAGE (net USAGE remains as the known H1 PUBLIC leak, neutralised at the execution boundary per H2).
- `ps01_line_runtime` EXECUTE set = exactly the 3 Customer LINE V2 RPCs (`get_customer_booking_context_v2_internal`, `quote_customer_booking_v2_internal`, `submit_booking_request_v2_internal`), all `SECURITY DEFINER`, owned by `ps01_migrator`.
- Direct PS01 relation write grants for `ps01_line_runtime`: **0**.
- `public.rls_auto_enable()` EXECUTE for `ps01_line_runtime`: **false**. `ps01.ps01_request_user_id()` EXECUTE: **false**.
- `authenticator` has `ps01_line_runtime` granted `WITH SET TRUE, INHERIT FALSE` (PostgREST role-switch pattern).
- `wstera_platform_internal.custom_access_token_hook` exists (SECURITY INVOKER), `wstera_platform_internal.runtime_token_grants` exists with **0 rows**. Hosted Custom Access Token Hook is **disabled** (operator-confirmed at H3C closure; not DB-readable).
- Global migration ledger: 41 rows, latest `20260909013819 h3c_ps01_request_helpers_search_path_hardening`. All rows beyond H1's 37 are explained House H3B + 3×H3C migrations.
- Storage buckets 2, cron jobs 8, extensions 8, Data API schemas `public, graphql_public, local_service, ps01` — all match the expected H3C boundary. **No unexplained collateral delta.**
- H3C proof identities = 0, runtime-token grants = 0. H3C is not regressed.

## 3. Implementation (static / source)

### 3.1 `lib/ps01-runtime.ts` — repurpose as the active Data API adapter

Currently dead code (no importers). Rework into a server-only adapter that **implements `Ps01RuntimeRpcClient`** (the existing contract in `lib/line-booking-core.ts`), not a raw `SupabaseClient`.

- `getPs01LineRuntimeClient(): Ps01RuntimeRpcClient`
- Underlying transport: `createClient(url, anonKey, { ...ps01DatabaseOptions(), auth: { persistSession:false, autoRefreshToken:false }, global: { headers: { Authorization: \`Bearer \${runtimeJwt}\` } } })`.
- **Local defense-in-depth allowlist**: exactly the 3 RPC names. Any other name returns `{ data: null, error: { message: "PS01 runtime RPC is not allowlisted: <name>" } }` **without** issuing a network call. No generic/dynamic RPC-name pass-through.
- Maps supabase `{ data, error }` to the contract shape `{ data, error: { message } | null }`.
- No `SUPABASE_SERVICE_ROLE_KEY`, no `service_role`, no `local_service`, no `.schema(` override, no direct-table / admin fallback on RPC failure.
- Schema pin stays via `ps01DatabaseOptions()` (client `db.schema` option), satisfying the boundary verifier.

### 3.2 `lib/env.ts` — token contract fix

- `requirePs01RuntimeEnv()` reads **`PS01_LINE_RUNTIME_JWT`** (was `PS01_RUNTIME_JWT`). Error text: `role=ps01_line_runtime` (was `role=ps01_runtime`).
- `requirePs01RuntimeDatabaseEnv()` / `PS01_RUNTIME_DB_*` **retained unchanged** as rollback/reference only (no active caller after this change). Removed only after H3D replacement proof is green (brief §7).

### 3.3 `lib/line-booking-server.ts` — route swap

Replace all 3 `getPs01RuntimeDatabaseClient()` call sites + the import with `getPs01LineRuntimeClient()` from `./ps01-runtime`. No other logic change; `line-booking-core.ts` already depends only on the `Ps01RuntimeRpcClient` interface.

### 3.4 `.env.example`

Active Customer LINE path = `PS01_LINE_RUNTIME_JWT` (Data API). `PS01_RUNTIME_DB_*` demoted to "rollback/reference only".

### 3.5 `scripts/verify-ps01-shared-runtime-boundary.mjs`

- Assert `lib/line-booking-server.ts` routes through the Data API adapter (`getPs01LineRuntimeClient`) and **does not** import `ps01-runtime-db` or reference `PS01_RUNTIME_DB_`.
- Assert `lib/ps01-runtime.ts`: contains the 3 RPC names + an allowlist reject + `ps01_line_runtime`; contains no `service_role` / `SUPABASE_SERVICE_ROLE_KEY` / `local_service`.
- Keep the existing `lib/ps01-runtime-db.ts` reference-file checks (allowlist, fail-closed on `ps01_runtime_login.`).

### 3.6 New focused test — `tests/h3d_data_api_runtime.test.ts`

Pure unit (no DB / no local Supabase). Asserts:
1. missing `PS01_LINE_RUNTIME_JWT` → `requirePs01RuntimeEnv()` throws (fail closed).
2. adapter rejects a 4th / unallowlisted RPC name **without** a network call.
3. adapter forwards each of the 3 allowlisted names to the underlying client.
4. adapter surfaces underlying `error` as `{ message }` and never falls back to a table/admin path.
5. `lib/line-booking-server.ts` source imports the Data API adapter, not `ps01-runtime-db`, and has no `PS01_RUNTIME_DB_` / service-role reference.
6. `lib/ps01-runtime.ts` source consults no service-role / admin credential.

## 4. Static gates to run (brief §7)

- `npx tsx tests/h3d_data_api_runtime.test.ts`
- existing pure-core regression: `npx tsx tests/phase11_customer_self_booking.test.ts` is **DB-backed** and cannot run here (local Supabase unavailable — no Docker on this host); recorded as environment limitation, not a pass.
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm build`
- `pnpm build:ps01-baseline` (generator) + `pnpm test:ps01-boundary` (verifier)
- source scans: no active Customer LINE dependency on `PS01_RUNTIME_DB_*` or `lib/ps01-runtime-db.ts`.

## 5. H3D live LAB smoke — BLOCKED (hosted operator action required)

The non-mutating live smoke (valid LINE test identity/config → customer context → quote through the real PS01 server action, plus cross-shop denial and no-DB-fallback) requires:

1. a LAB-only Auth service identity provisioned through a supported Auth Admin path;
2. one finite `ps01_line_runtime` row in `wstera_platform_internal.runtime_token_grants`;
3. the **hosted Custom Access Token Hook enabled** in the Supabase Dashboard (field-level) so Auth stamps `role=ps01_line_runtime` on the issued JWT;
4. a fresh Auth-issued token injected only into the live server process env;
5. identity-first teardown afterwards.

Step 3 is a hosted Dashboard action that only the authorized operator can perform (same constraint recorded at H3C closure: "no DB/catalog surface exists in this session to independently read/change hosted Auth hook configuration"). The operator is not available for this run.

Per brief §7 / §13 / §17B: complete all static H3D work, write the `H3D-LIVE-ACTION-REQUIRED` blocker (House repo), and **STOP before H3D PASS**. Do not proceed to H3E.

Blocker: `docs/platform/shared-runtime/evidence/H3D-LIVE-ACTION-REQUIRED-2026-09-09.md` (House repo).

## 6. What is NOT changed by H3D

- No LAB mutation (only the read-only start snapshot was taken).
- Historical PS01 migrations untouched. `supabase/migrations/*` untouched.
- No BK01 / `local_service` / MT01 / managed-surface access.
- `ps01_runtime_login` still LOGIN (retired only in H3E, after replacement proof).
- No `service_role` / project signing material in source, env, or evidence.
