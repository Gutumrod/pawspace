# PawSpace Phase 9 — Gate 1 Re-Review

Date: 2026-08-21
Branch: `master`
Baseline HEAD: `5611c52` (`feat(camera): implement Phase 8 public visitor camera access`)
Review basis: corrected local working tree after first Gate 1 failure.

## Verdict

`PHASE FAILED — FIX REQUIRED BEFORE PHASE 10`

The second implementation is materially improved, but executable review still found authorization, dashboard-runtime, canonical-entitlement, and acceptance-test gaps.

## Confirmed Fixes

- Phase 9 migration renamed to `20260821160000_phase9_commercial_entitlements.sql`, after Phase 8.
- `supabase db reset` applies Phase 1–9 in correct order.
- `supabase db lint --local` reports no schema errors.
- Dashboard now uses `booking_status` and `line_delivery_status`.
- Dashboard business date uses `pawspace_business_date()` with an Asia/Bangkok fallback.
- Previous ambiguous `package_id` SQL error is fixed.
- Previous commercial table DML/TRUNCATE privilege leak is fixed.
- `anon` no longer has EXECUTE on `get_shop_effective_entitlement(uuid)`.
- `authenticated` TRUNCATE on commercial tables is denied in an executable transaction probe.
- `pnpm exec tsc --noEmit` passes.
- `pnpm lint` passes.
- `pnpm build` passes and `/dashboard` is in the production route manifest.
- `npx --yes tsx --test tests/phase9_entitlements.test.ts` passes 5/5.
- Phase 7 Google Sync regression test passes.
- Phase 8 Camera Access DB regression test passes.
- `supabase/config.toml` has no diff.
- No Phase 1–8 migration was modified.
- No Stripe / PromptPay / SlipOK / checkout / hard-quota implementation was found in Phase 9 files.
- GitHub Issue #3 remains OPEN.

## BLOCKER 1 — Authenticated User Without Membership Can Read Any Shop Entitlement

The RPC currently checks:

```sql
IF auth.role() = 'authenticated' AND current_staff_shop_id() <> p_shop_id THEN
    RAISE EXCEPTION ...;
END IF;
```

`current_staff_shop_id()` returns NULL when the authenticated user has no active PawSpace staff membership. In PostgreSQL, `NULL <> UUID` evaluates to NULL, and `IF NULL` does not enter the branch.
Executable repro after a fresh `supabase db reset`:

- role: `authenticated`
- JWT subject: valid UUID with no row in `staff_users`
- `current_staff_shop_id()` returned NULL
- calling `get_shop_effective_entitlement(<arbitrary existing shop UUID>)` returned Starter entitlement successfully

This violates Acceptance 54/58 and the disabled/no-membership tenant contract.

Required correction: for `authenticated`, require `current_staff_shop_id()` to be non-NULL AND exactly equal to `p_shop_id`; otherwise reject. Keep service-role behavior explicitly separated rather than relying on NULL semantics.

## BLOCKER 2 — Dashboard Camera Status Uses a Table Authenticated Users Cannot Read

`lib/dashboard-service.ts` queries `camera_settings` directly with the authenticated Supabase session client.

Phase 8 intentionally revoked all browser/authenticated table privileges on `camera_settings`. Executable probe:

```text
SET ROLE authenticated;
SELECT ... FROM camera_settings;
=> permission denied / CAMERA_DIRECT_SELECT_DENIED
```

The dashboard ignores the camera query error and converts the NULL count to `false`, so an enabled camera can be shown as `Offline` instead of failing or using the approved Phase 8 read gateway.

Required correction: use the existing `get_camera_staff_settings()` RPC (or another Phase-8-compatible trusted read path) and check its error. Do not re-grant direct SELECT to weaken Phase 8.
## BLOCKER 3 — Founding Member Has Two Conflicting Canonical Results

For the same Founding Member input (`starter` + `founding_member`):

- SQL RPC returns `package_id = pro`
- TypeScript `resolveEffectiveEntitlement()` returns `packageId = starter`

Both return Pro room/pet limits at 990 THB/month, but the identity of the effective package changes depending on which resolver ran. `dashboard-service.ts` normally uses the RPC and silently falls back to the TypeScript resolver on RPC failure, so a transient DB/RPC error can change the dashboard's commercial identity.

This violates the Phase 9 requirement for one canonical entitlement resolver/API.

Required correction: choose one explicit contract (for example `basePackageId` + `effectivePlanId`, or one consistent `packageId`) and make SQL, TypeScript, dashboard DTO, tests, and evidence agree. Do not silently fall back to a semantically different resolver when the authoritative RPC fails.

### Additional commercial-source issue

The Source of Truth states Founding Member C2 as **Pro entitlement at 990 THB/month**. It does not explicitly define a Founding annual price. Current SQL/TS invent `annualPrice = 9900` for the Founding offer. Either remove/mark that value as not defined for Founding, or obtain an explicit product decision and update Source of Truth before treating it as canonical.

`supportTier = standard` for Starter/Pro is also not a documented customer promise; Enterprise Priority Support is documented. Avoid rendering undocumented support labels as commercial facts unless Source of Truth is updated.
## BLOCKER 4 — Acceptance 54–61 Test Matrix Is Still Missing

There is still no `supabase/tests/phase9_*.sql` (or equivalent DB negative suite) and no executable dashboard authorization/tenant test.

The delivered Phase 9 test file contains only 5 pure entitlement tests. It does not prove:

- Owner dashboard access allowed;
- Manager dashboard access allowed;
- Staff denied;
- inactive/no-membership denied;
- tenant A cannot read tenant B dashboard/entitlement;
- empty tenant returns a valid summary;
- live DB fixture changes alter the dashboard summary (not mock data);
- client-facing DTO excludes secret/admin fields;
- commercial table/RPC privilege lockdown;
- Founding Member shop binding/non-transferability;
- future paid add-ons are not implicitly granted;
- no-hard-commercial-limit regression.

The no-membership RPC bypass found by this review is exactly the kind of defect these required negative tests were meant to catch.

## Test Runner Note

The test file is not runnable with plain `node --test --experimental-strip-types` because its extensionless TypeScript import cannot be resolved. It does run locally with:

```text
npx --yes tsx --test tests/phase9_entitlements.test.ts
5 passed, 0 failed
```

The evidence file should record the exact command and raw total rather than only saying `PASS`.
## Required Corrections Before Next Review

1. Fix `get_shop_effective_entitlement()` so authenticated callers with NULL/no active membership are rejected.
2. Add DB negative tests for anon/authenticated privileges, no-membership, inactive user, same-tenant, and cross-tenant entitlement access.
3. Replace direct `camera_settings` SELECT with the existing Phase 8 authorized read RPC/path; check all integration query errors instead of converting errors to false status.
4. Unify SQL and TypeScript Founding Member semantics into one canonical entitlement contract and remove semantically different silent fallback behavior.
5. Do not invent Founding annual pricing or undocumented support-tier promises; either represent them as undefined/null or update Source of Truth through an explicit product decision.
6. Add executable dashboard/security tests covering Acceptance 54–61, including owner/manager/staff/no-membership and tenant A/B cases plus live DB fixture evidence.
7. Add explicit no-hard-quota and future-paid-add-on exclusion assertions.
8. Update `PHASE9_IMPLEMENTATION_EVIDENCE.md` with exact commands, raw pass/fail totals, known limitations, and the new tests.
9. Re-run clean DB reset + db lint + Phase 7/8 regressions + Phase 9 DB tests + entitlement tests + tsc + lint + build + diff/security review.
10. Do not commit/push and do not start Phase 10 until reviewer verdict changes to PASS.

## Current Gate

`PHASE FAILED — FIX REQUIRED BEFORE PHASE 10`
