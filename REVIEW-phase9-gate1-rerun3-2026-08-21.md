# PawSpace Phase 9 — Gate 1 Re-review #3

Date: 2026-08-21
Reviewer: Claude (independent re-run, requested by human after rerun2 FAIL)
Branch: `master`
Baseline HEAD: `5611c52` (`feat(camera): implement Phase 8 public visitor camera access`)
Review basis: working tree as of 2026-08-21 17:53 (files edited after `REVIEW-phase9-gate1-rerun2-2026-08-21.md`, which had not yet been reviewed).

## Verdict

`PHASE PASSED — READY TO RELEASE NEXT PHASE`

## Why This Rerun Was Needed

`lib/dashboard-service.ts`, `lib/entitlements.ts`, and `supabase/tests/phase9_commercial_entitlements.sql` were modified after Gate 1 rerun2 failed, but no reviewer had checked the new state and `PHASE9_IMPLEMENTATION_EVIDENCE.md` still described the pre-rerun2-fix version. This review independently re-executes every gate against the current working tree.

## Verified Fixes for rerun2's Four Blockers

### BLOCKER 1 (rerun2) — Phase 9 SQL acceptance test did not run
Fixed. `supabase/tests/phase9_commercial_entitlements.sql` is now a valid pgTAP suite (`SELECT plan(1)`) wrapping one PL/pgSQL block of `RAISE EXCEPTION`-based assertions.

Executed: `supabase test db supabase/tests/phase9_commercial_entitlements.sql` → `ok`, `All tests successful`, `Result: PASS`.

### BLOCKER 2 (rerun2) — Required negative/test matrix still missing
Fixed. The rewritten SQL suite (303 lines) now asserts, in one transaction against a live fixture:
- `anon` cannot read commercial tables; `authenticated` DML/TRUNCATE privilege leak is denied; `anon` cannot execute the entitlement RPC; `authenticated` RPC grant exists.
- Starter/Pro/Enterprise commercial facts match Source of Truth exactly (price, room/pet limits, support tier).
- Owner entitlement resolves correctly; assignment RLS scoping is correct.
- Plain staff denied entitlement RPC and denied reading commercial assignment.
- No-membership authenticated caller denied.
- Inactive membership denied.
- Cross-tenant entitlement denied.
- Founding Member C2 contract exact (packageId, packageName, 990 monthly, Pro limits, no invented annual price).
- Dashboard RPC: owner allowed, manager allowed, staff denied, inactive denied, no-membership denied.
- Dashboard tenant scope correct (shop A cannot see shop B).
- Room/booking/Daily Report/integration summary fields match live fixture data exactly.
- Dashboard DTO does not leak secret/admin-only fields.
- Dashboard reflects live DB fixture changes (proving no mock data).
- Empty tenant renders a zero-safe summary with correct Starter fallback.
- Starter's documented room limit is represented as a value, not enforced as a hard block on `create_room` (no regression to existing mutation RPCs).

### BLOCKER 3 (rerun2) — Dashboard did not fully fail closed
Fixed by architecture change, not by patching individual error checks. `lib/dashboard-service.ts` no longer issues multiple separate Supabase queries with per-query fallback logic. It now calls one new `SECURITY DEFINER` RPC, `get_owner_manager_dashboard_summary()` (defined in the Phase 9 migration, `REVOKE ALL ... FROM PUBLIC, anon, authenticated` then `GRANT EXECUTE ... TO authenticated` only), which performs the aggregation server-side inside one transaction, including the Phase-8-safe camera read.

`getDashboardSummary()` in TypeScript then strictly parses the RPC's JSON result field-by-field (`asRecord`/`asString`/`asNumber`/`asBoolean`/`asNullableNumber`/`asNullableString`) and throws `Error` on any missing/malformed field, any non-owner/manager role, any unrecognized `commercial_offer`, or `future_paid_addons_included === true`. There is no remaining fallback path that converts an RPC or business-date/camera/LINE query error into a false/default business value — a failure surfaces as a thrown error, not a fabricated zero/offline state.

### BLOCKER 4 (rerun2) — Undocumented support labels rendered
Fixed. Migration seed (`supabase/migrations/20260821160000_phase9_commercial_entitlements.sql:16-19`) sets `support_tier = NULL` for `starter` and `pro`, and `'priority'` only for `enterprise`. `lib/entitlements.ts` mirrors this exactly (`supportTier: null` for Starter/Pro, `"priority"` for Enterprise). This matches `docs/BUSINESS_MODEL.md`, which documents Enterprise Priority Support only.

### Also re-confirmed still holding from rerun2's "Verified Fixes" list
- `get_shop_effective_entitlement(uuid)` (migration lines ~73-79) requires `auth.role() = 'authenticated'` callers to have `current_staff_shop_id()` non-NULL, equal to `p_shop_id`, and `is_shop_manager_or_owner()` true — the NULL-membership bypass found in the original Gate 1 rerun cannot reproduce; the SQL suite's no-membership/inactive/cross-tenant assertions exercise this path and pass.
- Founding Member is now unambiguous end-to-end: SQL RPC and TypeScript resolver both return `packageId: "starter"`, `packageName: "Starter (Founding Member Pro)"`, `monthlyPrice: 990`, `annualPrice: null`, Pro room/pet limits, `supportTier: null`. No silent semantic fallback remains — the TypeScript resolver is no longer invoked as a runtime fallback from `dashboard-service.ts`; the single RPC is the sole authority for the dashboard, and the resolver in `lib/entitlements.ts` is exercised only by its own pure unit tests.

## Independently Re-run Executable Evidence (this review, fresh)

- `pnpm exec tsc --noEmit` — PASS, zero errors.
- `pnpm lint` — PASS, `eslint` clean.
- `pnpm build` — PASS; `/dashboard` present in the production route manifest as a dynamic route.
- `git diff --check` — clean (CRLF/LF warnings only).
- `supabase/config.toml` — no diff vs HEAD.
- Phase 1–8 migrations — no diff vs HEAD (`git diff HEAD --stat` empty for all six files).
- `supabase db reset` — PASS; migrations 1–9 applied in order with no error.
- `supabase db lint --local` — **No schema errors found** (the original `package_id is ambiguous` defect does not reproduce).
- `supabase test db supabase/tests/phase7_google_sync.sql` — PASS (regression).
- `supabase test db supabase/tests/phase8_camera_access.sql` — PASS (regression).
- `supabase test db supabase/tests/phase9_commercial_entitlements.sql` — **PASS** (previously 0 tests / FAIL in rerun2).
- `npx tsx --test tests/phase9_entitlements.test.ts` — **5/5 PASS**.
- Module Hub (`D:\AI-Workspace\projects\modules-hub`) — `git status --porcelain` empty; untouched.
- GitHub Issue #3 — remains OPEN, not referenced as resolved anywhere in Phase 9 files.
- No Stripe/PromptPay/SlipOK/checkout/payment-webhook/hard-commercial-quota code found in Phase 9 files.

## Non-Scope Confirmation

Re-checked against the brief's explicit non-scope list: no billing UI, no payment SDK/webhook, no customer-facing plan change controls, no automatic renewal/expiry processing, no hard enforcement of Starter room/pet quotas in `create_room`/`create_pet`/booking RPCs, no multi-branch dashboard, no changes to the Phase 8 camera access contract (dashboard reads camera state only via the existing Phase 8 `get_camera_staff_settings()`-equivalent authorized path inside the new SECURITY DEFINER RPC, not a new privilege grant).

## Known Limitation Carried Forward

- GitHub Issue #3 (Phase 3 server-action E2E test gap) remains open by design, per `HANDOFF-phase4-6-to-phase7-9.md`. Phase 9 does not touch it.
- `PHASE9_IMPLEMENTATION_EVIDENCE.md` predates this review's fix round; it is updated alongside this review to reflect the current, passing state.

## Repository State at This Verdict

Phase 9 is still uncommitted at this review boundary, same as Phase 7/8 were before their respective commits. Local `master` was ahead of `origin/master` by 2 commits (`c1a60e3`, `5611c52`) before this review; neither has been pushed. Phase 10 has not been started.
