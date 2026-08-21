# PawSpace Phase 9 — Reviewer Gate 1

Date: 2026-08-21
Reviewer: ChatGPT Gate 1
Repository: `Gutumrod/pawspace`
Local path: `D:\AI-Workspace\projects\saas-product-hub\products\PawSpace`
Baseline HEAD: `5611c52` (`feat(camera): implement Phase 8 public visitor camera access`)

## Verdict

`PHASE FAILED — FIX REQUIRED BEFORE PHASE 10`

The Manus completion report is not accepted as Phase 9 evidence. Local files exist, but executable and source review found correctness, security, and acceptance-test blockers.

## Verified Good Boundaries

- Phase 9 files were written to the real local PawSpace repository.
- Local `master` still preserves Phase 7–8 and is ahead of `origin/master` by 2 commits.
- No Phase 1–8 migration was modified.
- `supabase/config.toml` has no diff.
- No Stripe, PromptPay, SlipOK, checkout, payment webhook, or hard commercial quota enforcement was introduced.
- Module Hub remains read-only/clean.
- GitHub Issue #3 remains OPEN.
## Blocking Finding 1 — Dashboard queries the wrong schema

`lib/dashboard-service.ts` does not match the actual Phase 1–8 database:

- selects `bookings.status`, but the real column is `bookings.booking_status`;
- selects `daily_reports.delivery_status`, but the real column is `daily_reports.line_delivery_status`;
- queries nonexistent `line_shop_links`;
- queries nonexistent `google_sheet_bindings`;
- queries nonexistent `public_visitor_cameras` (Phase 8 uses `camera_settings`).

The service ignores Supabase query errors and converts null/error results into zero/false summaries. This can silently render false operational data instead of failing visibly.

Correct integration-state sources must be derived from actual Phase 5–8 state, e.g. verified owner LINE linkage, `shops.google_sheet_id`, and `camera_settings.is_enabled`, without exposing secrets.
## Blocking Finding 2 — Business date violates locked Asia/Bangkok semantics

`lib/dashboard-service.ts` uses:

`new Date().toISOString().split('T')[0]`

That is a UTC date, not the PawSpace V1 business date. Between 00:00–06:59 Asia/Bangkok it can report the previous calendar day. Reuse the authoritative Bangkok business-date contract (`pawspace_business_date()` or an equivalent exact server helper).

## Blocking Finding 3 — Entitlement RPC is broken at runtime

`supabase db lint --local` reports an error in `get_shop_effective_entitlement(uuid)`:

`column reference "package_id" is ambiguous`

A direct local Postgres call reproduced the same runtime error. Qualify the assignment-table columns / output-variable names and add executable RPC tests.
## Blocking Finding 4 — Browser/database role privileges are too broad

A live privilege probe after `supabase db reset` showed Supabase default grants were not fully revoked:

- `anon` and `authenticated` have INSERT/UPDATE/DELETE/TRUNCATE on `commercial_packages`;
- `anon` and `authenticated` retain TRUNCATE on `shop_commercial_assignments`;
- `anon` has EXECUTE on `get_shop_effective_entitlement(uuid)`.

A transaction-scoped security probe confirmed `SET ROLE authenticated; TRUNCATE shop_commercial_assignments, commercial_packages CASCADE;` succeeds.

This violates Acceptance 57/56 and the brief's explicit browser-authority rule. Use `REVOKE ALL ... FROM PUBLIC, anon, authenticated` on new authority tables, then grant only the narrow SELECT/EXECUTE permissions required. Explicitly verify `anon` cannot execute the entitlement RPC.
## Blocking Finding 5 — Package facts were invented beyond Source of Truth

Current Phase 9 code/migration invents package facts not present in `docs/BUSINESS_MODEL.md`:

- Starter `staff_limit = 3`;
- Pro `staff_limit = 10`;
- Pro `support_tier = priority`;
- Enterprise `support_tier = dedicated`.

The Source of Truth explicitly documents Enterprise as unlimited staff with **Priority Support**; it does not define Starter/Pro staff limits or Pro priority support. Phase 9 must represent only documented facts and must not silently infer commercial limits.

## Blocking Finding 6 — Founding Member / canonical resolver semantics are inconsistent

Founding Member C2 is documented as effective **Pro entitlement @ 990 THB/month**. Current implementation models it as `packageId='starter'` plus `founding_member`, while borrowing Pro limits. The SQL RPC can return `package_id='starter'` together with `package_name='Pro'`; the TypeScript resolver returns `packageId='starter'` with `packageName='Starter (Founding Member Pro)'`.

This is not one canonical entitlement result. DB package facts, TypeScript package constants, SQL resolution, and TypeScript resolution duplicate authority and can drift. Refactor to one authoritative package catalog/resolution contract and expose explicit base/effective plan semantics if both are needed.
## Blocking Finding 7 — Acceptance 61 test matrix is largely missing

Delivered tests cover only a small pure entitlement subset. Missing executable evidence includes:

- DB privilege/RLS negative tests;
- Owner allowed / Manager allowed / Staff denied;
- inactive/no-membership denial;
- tenant A cannot read tenant B dashboard/entitlement;
- empty tenant dashboard;
- DB fixture changes reflected in dashboard DTO;
- client DTO excludes secrets/admin fields;
- Founding Member non-transferability / future paid add-ons exclusion;
- no-hard-limit regression against existing mutation RPCs.

The implementation evidence therefore overstates completion relative to the required brief.

## Blocking Finding 8 — Required lint gate fails

Independent execution:

- Phase 9 entitlement runner: PASS for its limited assertions;
- `pnpm exec tsc --noEmit`: PASS;
- `pnpm lint`: **FAIL** — 2 errors (`no-require-imports`) plus 3 unused-variable warnings;
- `pnpm build`: PASS;
- `supabase db reset`: PASS;
- `supabase db lint --local`: reports the entitlement RPC error above.

A passing build does not override the failed lint/security/runtime gates.
## Regression Evidence

- Phase 7 Google Sheets SQL regression: PASS.
- Phase 8 Camera Access SQL regression: PASS.

So Phase 9 has not broken those tested Phase 7–8 database contracts. The Phase 9 blockers are within its own new read model, entitlement migration/privileges, and missing test coverage.

## Required Corrections Before Gate 1 Re-review

1. Fix dashboard queries to actual schema and fail closed on query errors instead of silently returning zero/false.
2. Use Asia/Bangkok business-date semantics.
3. Fix and executable-test the entitlement RPC.
4. Lock new table/function privileges down explicitly; prove anon/authenticated cannot mutate/truncate authority data and anon cannot call tenant entitlement RPC.
5. Remove invented commercial facts; use only Source-of-Truth package data.
6. Make Founding Member resolve unambiguously to effective Pro entitlement at the 990 THB/month offer, with one canonical resolver/result contract.
7. Add the full Acceptance 54–61 security/dashboard/tenant test matrix.
8. Make `pnpm lint` pass; remove duplicate/generated `lib/entitlements.js` / ad-hoc CommonJS runner if they are not legitimate source artifacts.
9. Do not catch every dashboard runtime error and relabel it as Unauthorized; preserve deterministic auth denial while surfacing/logging safe internal data failures.
10. Rename the Phase 9 migration to a timestamp after Phase 8 (`20260821150000`) before commit so clean migration order reflects actual phase dependency/order.

Do not commit/push and do not start Phase 10 until this review returns PASS.
