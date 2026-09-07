# PS-SR-02 — Staging + Release Engineering Record

**Date:** 2026-09-06
**Branch:** `build/ps-sr02-staging-2026-09-06`
**HEAD:** `3f665558a53b7dec26aee767d866a5533e909a8f`
**Release owner:** Gutumrod
**Status:** EVIDENCE COMPLETE — do not self-certify PASS; see next action.

---

## 1. Branch / HEAD Pre-State

```
$ git log --oneline -5
3f66555 Merge pull request #4 from Gutumrod/verify/phase13-closure-2026-09-01
67de7f3 test(phase8): make signature tamper deterministic
1ead7dc docs(ps01): reconcile phase13 build-to-sell state
fdd10e7 fix(docs): remove evidence whitespace errors
6527987 docs(phase13): record independent closure evidence

$ git status --short
(clean)

$ git diff --check
(no output — exit 0)
```

Execution started from clean canonical master `3f66555` in the dedicated
PS-SR-02 worktree. Working tree was clean before any work began.
**diff-check exit: 0 (PASS)**

---

## 2. Environment / Deployment Inventory (Secret Values REDACTED)

### 2.1 Environment Variable Manifest

Source: `.env.example` — all production/staging values are managed outside
source control. No secrets are committed.

| Variable | Scope | Purpose | Value in source |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser+server) | Supabase project API URL | *(empty — inject per environment)* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser+server) | Supabase anonymous key | *(empty — inject per environment)* |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | Service role — NEVER expose to client | *(empty — inject per environment)* |
| `LINE_CHANNEL_ACCESS_TOKEN` | Server-only | LINE adapter default channel token | *(empty)* |
| `LINE_TARGET_ID` | Server-only | LINE default target ID | *(empty)* |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Server-only | Google Sheets service account JSON | *(empty)* |
| `GOOGLE_SYNC_DISPATCH_SECRET` | Server-only | Internal Google sync dispatch secret | *(empty)* |
| `LINE_LOGIN_CHANNEL_ID` | Server-only | Phase 5 LINE Login channel ID | *(empty)* |
| `NEXT_PUBLIC_LINE_LIFF_ID` | Public | Phase 5 LIFF app ID | *(empty)* |
| `LINE_CHANNEL_ACCESS_TOKENS_JSON` | Server-only | Phase 6 per-shop LINE tokens (JSON object) | *(empty)* |
| `LINE_DISPATCH_SECRET` | Server-only | Phase 6 internal dispatcher secret | *(empty)* |
| `CAMERA_SESSION_SIGNING_SECRET` | Server-only | Phase 8 camera session HMAC secret | *(empty)* |
| `CAMERA_IP_HASH_PEPPER` | Server-only | Phase 8 IP hash pepper | *(empty)* |
| `CAMERA_REQUESTER_IP_HEADER` | Server-only | Edge header for requester IP (e.g. `cf-connecting-ip`) | *(empty)* |
| `CAMERA_ALLOWED_FEED_HOSTS` | Server-only | Comma-separated allowed camera hostnames | *(empty)* |
| `APP_BASE_URL` | Server-only | App origin for Supabase Auth invite/reset redirect links | *(empty — defaults to `http://127.0.0.1:3000`)* |

### 2.2 Secret Separation Policy

- Development (local): credentials resolved from `pnpm exec supabase status -o env`
  (Supabase local stack) at test runtime — never written to disk.
- Staging: requires a **separate isolated Supabase cloud staging project** with
  separate ANON_KEY and SERVICE_ROLE_KEY — not reusing production credentials.
- Production: credentials in `D:\AI-Workspace\.secrets\` (vault — never committed).
- **Status:** Production and staging credentials are fully separate from source
  control. No silent reuse of production credentials.

### 2.3 Staging Provider Inventory

| Provider | Configured | Evidence |
|---|---|---|
| Vercel project | **NOT configured** | No `vercel.json` in repo |
| Supabase cloud staging project | **NOT configured** | No staging project URL/keys in source or .env.example |
| Netlify / Fly / Render | **NOT configured** | No config files found |

**Exact missing staging-provider prerequisites:**

1. No approved Vercel project linked to this repository for staging deploys
2. No isolated Supabase cloud staging project (separate from production) created
3. No staging-environment credentials registered in the secrets vault

Per `PRODUCTION_OPERATIONS.md`: "An isolated Supabase cloud test/staging project
is the next layer for remote integration/E2E and deployment validation, with no
production data."

A fabricated staging deploy has not been created. Per acceptance criteria AC-4,
the exact prerequisites are returned above.

---

## 3. Migration / Bootstrap / Release Commands and Outcomes

### 3.1 Migration Pipeline

13 ordered migration files under `supabase/migrations/`:

```
20260220000000_initial_schema.sql           — Phase 1 base schema + check constraints
20260820020000_phase2_authoritative_gateways.sql
20260820030000_phase3_auth_tenant.sql
20260820221500_phase5_line_claim.sql
20260820233000_phase6_daily_report_line_delivery.sql
20260821094000_phase7_google_sheets_sync.sql
20260821150000_phase8_camera_access.sql
20260821160000_phase9_commercial_entitlements.sql
20260822000000_phase11_customer_booking_requests.sql
20260823170000_phase12_pilot_onboarding.sql
20260825141500_phase13_subscription_lifecycle.sql
20260825141600_phase13_subscription_hardening.sql
20260825141700_phase13_bootstrap_trialing_remediation.sql
```

### 3.2 Phase 13 Migration Key Fix (from PHASE13_IMPLEMENTATION_EVIDENCE.md)

The canonical Phase 13 migration corrects a legacy `subscription_status` check
constraint ordering defect. The order in `20260825141500_phase13_subscription_lifecycle.sql`:

1. `ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_subscription_status_check;`
2. `UPDATE shops SET subscription_status='trialing' WHERE subscription_status='trial';`
3. `ALTER TABLE shops ADD CONSTRAINT shops_subscription_status_check CHECK (...trialing...);`

This sequence is safe for incremental replay (legacy data probe) and clean replay alike.

### 3.3 Reproducible Non-Destructive Bootstrap Commands

**Local development (requires Docker Desktop + Supabase CLI):**

```sh
# Start local Supabase stack
pnpm exec supabase start

# Apply all migrations in order (fresh)
pnpm exec supabase db reset

# Status check (resolves env vars for E2E)
pnpm exec supabase status -o env
```

**Staging cloud project (Supabase Management API / CLI — WHEN prerequisites met):**

```sh
# Link to the isolated staging Supabase project
pnpm exec supabase link --project-ref <STAGING_PROJECT_REF>

# Push migrations (non-destructive — applies only unapplied migrations)
pnpm exec supabase db push

# Verify migration state
pnpm exec supabase migration list
```

**This is non-destructive to production** because:
- Staging project is a separate Supabase cloud project (different project ref)
- `db push` only applies migrations not yet recorded in `supabase_migrations.schema_migrations`
- Production database is never targeted unless the production project ref is explicitly linked

### 3.4 Rollback Procedure

Since Supabase CLI does not support native rollback (down migrations), the
documented rollback path is:

| Scenario | Rollback method |
|---|---|
| Bad staging deploy | Redeploy from prior tagged Git SHA via Vercel redeploy button / CLI |
| Bad staging migration | Restore staging DB from Supabase cloud dashboard point-in-time backup |
| Production incident | Restore from scheduled Supabase cloud backup (backup frequency: to be decided per PRODUCTION_OPERATIONS.md §4) |

For the current pre-production state, rollback is:

```sh
# Redeploy previous staging release (once Vercel project exists)
vercel rollback [deployment-url]

# OR re-link and reset staging DB to clean migration state
pnpm exec supabase link --project-ref <STAGING_PROJECT_REF>
pnpm exec supabase db reset  # staging only — NEVER run on production project ref
```

### 3.5 Versioned Release Naming Convention

Releases are identified by:
- Git branch: `build/ps-sr02-staging-2026-09-06`
- HEAD SHA: `3f665558a53b7dec26aee767d866a5533e909a8f`
- Release record: this document

---

## 4. Staging Deploy / Smoke / Rollback Evidence

**Staging deploy: BLOCKED — missing prerequisites (see §2.3)**

No staging deploy was fabricated. Per acceptance criteria AC-4, the exact
blocking prerequisites are:

1. **No approved Vercel project** — repository has no `vercel.json` and no Vercel
   project configuration. `vercel.json` must be created and a project provisioned
   in the Vercel dashboard before any deploy is possible.
2. **No isolated Supabase cloud staging project** — `PRODUCTION_OPERATIONS.md`
   requires a separate staging Supabase project with no production data. None
   exists; the project must be created in the Supabase dashboard, and staging
   credentials (URL, ANON_KEY, SERVICE_ROLE_KEY) added to the secrets vault.
3. **No staging environment credentials** — without (1) and (2) resolved, staging
   environment variables cannot be injected.

**Next action to unblock staging deploy:**

```
Owner action required:
1. Create an isolated Supabase cloud staging project (no production data)
2. Provision a Vercel project linked to this repository
3. Add staging credentials to D:\AI-Workspace\.secrets\
4. Configure staging environment variables in Vercel dashboard
5. Return project refs to the next PS-SR-02 execution for deploy + smoke
```

---

## 5. Two-Tenant Smoke Evidence

### 5.1 Source of Evidence

The frozen machine check `pnpm run test:e2e` runs `tests/e2e/phase10-pilot.spec.ts`,
which contains an explicit two-tenant cross-leakage test. This test passed in
canonical CI run **33743691064** (GitHub Actions, Ubuntu ephemeral runner).

### 5.2 Tenant Isolation Test (from phase10-pilot.spec.ts)

The spec creates **two shops** (shopA = Tenant A, shopB = Tenant B) with a
**service-role admin client** (bypasses RLS for fixture setup), then logs in
as Tenant A's owner and verifies:

**UI leakage check:**
```ts
await expect(page.getByText("SECRET-B-ROOM")).toHaveCount(0);
```
Tenant A's authenticated session cannot see Tenant B's room in the UI.

**Cross-tenant write attempt (HTTP):**
```ts
const response = await page.evaluate(async ({ bookingId, petId }) => {
  // POST /api/daily-reports with Tenant B's bookingId and petId
  // while authenticated as Tenant A's owner
  ...
  const result = await fetch("/api/daily-reports", { method: "POST", body: form });
  return { status: result.status, body: await result.json() };
}, { bookingId: String(bookingB.id), petId: String(petB.id) });
expect(response.status).toBe(409);  // tenant isolation enforced
```

**Database verification (no ghost write):**
```ts
const { count } = await admin.from("daily_reports")
  .select("id", { count: "exact", head: true })
  .eq("shop_id", shopA)
  .eq("booking_id", bookingB.id);
expect(count).toBe(0);  // no cross-tenant record created
```

### 5.3 Core Operational Continuity Test

The spec also runs a full pilot core loop on Tenant A (shopA):
- Room creation → customer/pet registration → booking creation →
  check-in → daily report generation → check-out → room clean mark

All steps asserted via real UI interactions against the local Supabase stack.

### 5.4 Canonical Evidence Reference

| CI item | Result |
|---|---|
| CI run | 33743691064 |
| Platform | GitHub Actions, Ubuntu ephemeral |
| Phase 10 browser E2E | success |
| Tenant isolation test | success |
| Core loop | success |

**Local E2E is BLOCKED** (see §6). Canonical two-tenant smoke evidence is
CI run 33743691064. No cross-tenant leakage in that run.

---

## 6. Lint / Typecheck / Build / E2E / Diff Results

### 6.1 Machine Check Results

| Check | Command | Exit code | Result |
|---|---|---|---|
| diff-check | `git diff --check` | **0** | PASS |
| write-scope | all changed paths within allowed paths | **0** | PASS |
| typecheck | `pnpm exec tsc --noEmit` | **0** | PASS |
| lint | `pnpm run lint` | **0** | PASS |
| build | `pnpm run build` | **0** | PASS |
| test:e2e | `pnpm run test:e2e` | **1** | **BLOCKED** |

### 6.2 Build Output (exit 0)

```
▲ Next.js 16.3.1 (Turbopack)
✓ Compiled successfully in 9.4s
✓ TypeScript check passed
✓ Static pages generated (13/13)

Routes: / /_not-found /api/camera/* /api/daily-reports /api/internal/*
        /api/line/* /auth/accept-invite /camera/* /dashboard
        /line/* /login /onboarding
```

### 6.3 E2E Blocker — Exact Error

```
$ pnpm run test:e2e
$ node ./scripts/phase10-e2e.mjs

Error: spawnSync pnpm.cmd EINVAL
    at Object.spawnSync (node:internal/child_process:1160:20)
    at spawnSync (node:child_process:928:24)
    at run (scripts/phase10-e2e.mjs:9:18)
    at scripts/phase10-e2e.mjs:26:22
  errno: -4071,
  code: 'EINVAL',
  syscall: 'spawnSync pnpm.cmd',
  path: 'pnpm.cmd',
  spawnargs: [ 'exec', 'supabase', 'status', '-o', 'env' ]

[ELIFECYCLE] Command failed with exit code 1.
exit code: 1
```

**Root causes (two independent blockers, both must be resolved for local E2E):**

1. **Docker Desktop not running** on this Windows machine — Supabase local stack
   (container `supabase_db_PawSpace`) is offline:
   ```
   failed to inspect container health: error during connect:
   open //./pipe/docker_engine: The system cannot find the file specified.
   ```

2. **Windows `spawnSync` limitation** — `scripts/phase10-e2e.mjs` spawns
   `pnpm.cmd` via `spawnSync(pnpm, args, { ... })` without `{shell: true}`.
   On Windows Node.js v24, `.cmd` files cannot be spawned directly without the
   shell option. This is a secondary Windows-local issue; the script was designed
   for the canonical CI runner (Ubuntu).

**Per `PRODUCTION_OPERATIONS.md`:**
> "Windows Docker Desktop is **not a mandatory verification dependency** for
> this product. Preferred database test runner is **GitHub Actions on an
> ephemeral Ubuntu runner**, so the container workload never touches the Windows PC."

**Canonical E2E evidence:** CI run 33743691064 — all steps success including
Phase 10 browser E2E, typecheck, lint, build, and `git diff --check`.

### 6.4 Write-Scope Check

Files written in this PS-SR-02 execution:
- `docs/PS-SR-02-STAGING-RELEASE-2026-09-06.md` — allowed path ✓
- `.secretary-relay/t_bfaa71e0/PS-SR-02-EVIDENCE.json` — allowed relay path ✓

No files written outside allowed paths.

---

## 7. Release Record Summary and Next Action

### 7.1 What Was Proven

| Item | Status | Evidence |
|---|---|---|
| Clean canonical master baseline | PASS | HEAD 3f66555, clean tree, diff-check exit 0 |
| Secret boundary separation | PASS | No secrets in source; .env.example values all empty |
| Production non-destructive | PASS | No production DB touched; no push/merge performed |
| Migration pipeline reproducibility | DOCUMENTED | 13 migrations; Phase 13 fix documented; `supabase db push` is non-destructive |
| Rollback procedure | DOCUMENTED | Vercel redeploy + Supabase point-in-time restore |
| TypeScript check | PASS | `tsc --noEmit` exit 0 |
| Lint | PASS | `eslint` exit 0 |
| Build | PASS | `next build` exit 0, all 13 static pages, all routes compiled |
| Two-tenant smoke | CANONICAL CI PASS | CI run 33743691064; local blocked by Docker offline |
| E2E (local) | BLOCKED | Docker not running + Windows spawnSync limitation (expected per PRODUCTION_OPERATIONS.md) |
| Staging deploy | BLOCKED — PREREQUISITE | No Vercel project; no Supabase cloud staging project |

### 7.2 Limitations

- No live staging deploy or smoke was executed — neither approved Vercel project
  nor Supabase cloud staging project exists.
- Local E2E cannot run on Windows without Docker Desktop running.
- Two-tenant smoke is canonical CI evidence only; no local re-run was performed.

### 7.3 Exact Next Action

**Owner action required (ordered):**

1. **Create isolated Supabase cloud staging project** (Supabase dashboard →
   new project, no production data, separate credentials).
2. **Create Vercel project** linked to this repository (or authorize an
   alternative approved hosting provider).
3. **Register staging credentials** in `D:\AI-Workspace\.secrets\` and
   configure staging environment variables in the Vercel dashboard.
4. **Add `vercel.json`** to the repo with staging configuration (preview
   deployments, environment variable binding).
5. Return project refs and staging URL to the next PS-SR-02 builder session,
   which will then:
   - Run `pnpm exec supabase db push` against the staging project
   - Trigger a Vercel staging deploy from `build/ps-sr02-staging-2026-09-06`
   - Execute `pnpm run test:e2e` against the staging URL
   - Produce deploy identity, smoke, and rollback evidence

**No production mutation, no Phase 13 reopening, and no payment scope
occurred in this execution.**

---

*Release record written: 2026-09-06*
*Relay task: t_bfaa71e0 (SGPT-ps01-sr02-staging-release-002)*
