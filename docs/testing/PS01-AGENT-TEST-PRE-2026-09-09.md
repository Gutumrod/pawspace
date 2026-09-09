# PS01 Agent Test — PRE

Date: 2026-09-09 (Asia/Bangkok)
Product: PS01 / Pawstia PMS
Mode: verification only / no LAB mutation

## Baseline

- Active worktree: `D:\AI-Workspace\runtime\worktrees\ps01-h3d-data-api-20260909`
- Branch: `work/ps01-h3d-data-api-20260909`
- HEAD: `4efee706d39b8aa66d2b610793c987d9f6e1f948`
- Remote divergence before test: `0/0`
- Working tree before test: clean
- Booking V2 checkpoint parent: `c21c27c`
- H3D changes active Customer LINE runtime from DB pooler to Supabase Data API + short-lived JWT role `ps01_line_runtime`.

## Source of truth read before testing

1. Local handoff: `PawSpace-pssr02-staging/docs/daily/HANDOFF-PS01-BOOKING-V2-SHARED-RUNTIME-CONTINUATION-2026-09-08.md`
2. H3D evidence: `docs/daily/H3D-DATA-API-PATH-REPLACEMENT-2026-09-09.md`
3. Booking V2 continuation brief: `docs/daily/BRIEF-PS01-BOOKING-V2-CONTINUATION-2026-09-08.md`
4. Runtime isolation contract: `docs/PS01-SHARED-RUNTIME-ISOLATION-CONTRACT-2026-09-07.md`

## Important supersession

The older handoff Gate A/C used `ps01_runtime_login` over the PostgreSQL pooler.
That is no longer the acceptance target for the active Customer LINE path after H3D.
The active target is Data API -> `ps01_line_runtime` -> exactly 3 allowlisted PS01 RPCs.
The pooler adapter remains rollback/reference only until House completes H3D/H3E.

## Test objectives

1. Prove repository hygiene before and after the run.
2. Prove H3D fails closed without the runtime token.
3. Prove only the 3 Customer Booking V2 RPCs can pass the local adapter allowlist.
4. Prove Customer LINE server code does not fall back to pooler/service-role/admin paths.
5. Prove TypeScript, lint and production build remain green.
6. Prove shared-runtime generated artifacts are reproducible and the boundary verifier stays green.
7. Detect regressions in existing non-mutating test suites where they can run without a database.
8. Separate product defects from environment/prerequisite blockers.

## Booking V2 functional acceptance that must remain covered

- HOUR: 1-hour and multi-hour packages
- DAY: single-day and multi-day packages
- MONTH: calendar-month semantics in Bangkok timezone
- overlap rejection and exact back-to-back acceptance
- maintenance collision
- room/pet capacity and overlap rules
- inactive Rate Plan rejection for new work
- quote snapshot preservation after price changes
- Staff/Customer quote and duration parity
- customer request -> staff confirm/decline
- check-in -> active stay -> check-out -> cleaning -> available
- Shop A cannot use Shop B Rate Plans/bookings
- legacy V1 records remain compatible while new V1 creation is rejected

These DB-backed behaviors were previously reported 21/21 in LAB, but this run will not claim them as freshly re-proven unless an executable non-destructive proof is actually run.

## Planned agent commands

```powershell
git diff --check
npx tsx --conditions=react-server tests/h3d_data_api_runtime.test.ts
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm build:ps01-baseline
pnpm test:ps01-boundary
```

Additional existing tests may be executed only after classifying whether they require a DB/external service. No test is allowed to mutate WSTERA LAB during this waiting window.

## PASS rules

- A command is PASS only from captured exit/result evidence.
- A DB-backed requirement is NOT PASS merely because source/static gates pass.
- A missing hosted hook, identity fixture, runtime-token grant, or test identity is a BLOCKER/NOT RUN, not a product PASS.
- No grant/security relaxation is allowed to make a test pass.
- No service-role/admin fallback is allowed in the Customer LINE data plane.

## STOP rules

STOP before any action that would:
- mutate WSTERA LAB while House work is in progress;
- touch BK01 / `local_service`;
- change Production or Production secrets;
- change hosted Auth configuration;
- provision/delete Auth identities or runtime-token grants;
- alter migrations, grants, RLS, or runtime authority just for test convenience.
