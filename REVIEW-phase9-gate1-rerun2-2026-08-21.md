# PawSpace Phase 9 — Gate 1 Re-review #2

Date: 2026-08-21
Branch: `master`
Baseline HEAD: `5611c52` (`feat(camera): implement Phase 8 public visitor camera access`)

## Verdict

`PHASE FAILED — FIX REQUIRED BEFORE PHASE 10`

This rerun confirms that the major Phase 9 entitlement security defect is fixed, but Phase 9 still does not satisfy Acceptance 61 and the prior fail-closed/dashboard-error-handling corrections.

## Verified Fixes

- `get_shop_effective_entitlement()` now rejects authenticated callers whose `current_staff_shop_id()` is NULL.
- Direct probe confirmed: no-membership denied, inactive membership denied, same-tenant allowed, cross-tenant denied.
- `anon` has no EXECUTE on the entitlement RPC.
- Commercial table browser DML/TRUNCATE privileges remain revoked.
- Dashboard now uses Phase 8 `get_camera_staff_settings()` instead of direct `camera_settings` SELECT.
- Founding Member SQL and TypeScript now both identify the base package as `starter`, with Pro room/pet entitlements, 990 THB/month, and undefined (`NULL`) Founding annual price.
- Migration order is Phase 8 before Phase 9.
## BLOCKER 1 — Phase 9 SQL Acceptance Test Does Not Run

Executed:

`pnpm exec supabase test db supabase/tests/phase9_commercial_entitlements.sql`

Actual result:

- syntax error at standalone `RAISE NOTICE` (line 94)
- `Tests=0`
- `Result: FAIL`
- non-zero test-container exit

The file also has no pgTAP `plan()` / assertions compatible with the existing Supabase DB test style. It must be converted into an executable pgTAP suite and independently rerun.

This alone prevents Acceptance 61 from passing.

## BLOCKER 2 — Required Phase 9 Negative/Test Matrix Is Still Missing

The new SQL file only checks object presence, table DML privilege leakage, and service-role entitlement values. It does not test the security cases that caught the previous defect.

Still missing executable Phase 9 coverage for:
- no-membership authenticated caller denied;
- inactive staff denied;
- same-tenant entitlement allowed;
- cross-tenant entitlement denied;
- anon cannot execute entitlement RPC;
- owner dashboard access allowed;
- manager dashboard access allowed;
- staff dashboard access denied;
- empty-tenant dashboard summary;
- live DB fixture changes reflected in dashboard output;
- dashboard DTO excludes secrets/admin-only fields;
- no-hard-commercial-quota regression;
- Founding Member does not imply future paid add-ons.
## BLOCKER 3 — Dashboard Still Does Not Fully Fail Closed

`lib/dashboard-service.ts` improved core query error handling, but still silently converts several failures into fallback values:

- `pawspace_business_date()` error falls back to local `Intl.DateTimeFormat` instead of failing closed.
- LINE linked-count query does not inspect its `error` field.
- `get_camera_staff_settings()` error is ignored and becomes `cameraEnabled = false`.
- entitlement RPC failure silently falls back to direct assignment SELECT + TypeScript resolver.
- fallback assignment SELECT does not inspect its `error` field.

The prior review explicitly required integration-query errors to be checked rather than converted into false/default status. A temporary permission/network/RPC failure must not be shown as a real business state such as Camera Offline or default Starter.

Required correction: check and handle every query/RPC error deterministically. For authoritative commercial state, prefer failing closed over silently switching authority when the RPC fails.

## BLOCKER 4 — Undocumented Support Labels Are Still Rendered

`support_tier = 'standard'` remains seeded for Starter and Pro and is rendered in the dashboard as a customer-visible commercial fact.

Current Source of Truth documents Enterprise Priority Support, but does not define a Starter/Pro `standard` support entitlement. The previous review required undocumented support labels to be removed/undefined or explicitly added to Source of Truth through a product decision.

## Gate Evidence

- `supabase db reset` — PASS, Phase 1–9 applied in correct order.
- `supabase db lint --local` — no errors; one warning: unused `v_target_pkg` in Phase 9 RPC.
- Phase 9 SQL DB test — FAIL, 0 tests executed.
- Phase 9 TypeScript entitlement tests — PASS, 5/5.
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm lint` — PASS, no reported warnings/errors.
- `pnpm build` — PASS; `/dashboard` compiled as dynamic route.
- Phase 7 DB regression — PASS.
- Phase 8 DB regression — PASS.
- `git diff --check` — clean.
- `supabase/config.toml` — no diff.
- Phase 1–8 migrations — no diff.
- GitHub Issue #3 — still OPEN.
- No new Stripe/PromptPay/SlipOK/payment/hard-quota implementation detected.
## Required Corrections Before Next Review

1. Repair `supabase/tests/phase9_commercial_entitlements.sql` into a valid pgTAP suite that actually executes under `supabase test db`.
2. Add the missing no-membership, inactive, same-tenant, cross-tenant, and anon-execute negative assertions to that DB suite.
3. Add executable dashboard authorization/security coverage for owner, manager, staff, inactive/no-membership, tenant isolation, empty state, and live DB-derived summary behavior.
4. Add explicit assertions for no hard quota enforcement and no implicit future-paid-add-on entitlement.
5. Make dashboard data loading fully fail closed: inspect LINE, camera, business-date, entitlement RPC, and fallback-query errors; do not translate operational failures into false/default commercial/integration state.
6. Remove the silent entitlement-authority fallback, or prove/document one single authoritative fallback contract with explicit error handling.
7. Stop rendering undocumented Starter/Pro support tiers, or obtain an explicit Source-of-Truth product decision first.
8. Remove the unused `v_target_pkg` warning.
9. Update `PHASE9_IMPLEMENTATION_EVIDENCE.md` with the actual Phase 9 SQL test command/result and complete raw pass/fail totals.
10. Re-run reset + DB lint + Phase 7/8 regressions + Phase 9 DB tests + Phase 9 TS tests + tsc + lint + build + diff/state review before requesting Gate 1 again.

Do not commit/push and do not start Phase 10 until the reviewer verdict changes to:

`PHASE PASSED — READY TO RELEASE NEXT PHASE`
