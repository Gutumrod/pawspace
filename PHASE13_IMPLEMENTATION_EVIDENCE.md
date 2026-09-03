# PawSpace Phase 13 — Independent Closure Evidence

Date: 2026-09-03  
Verification branch: `verify/phase13-closure-2026-09-01`  
Verified implementation SHA: `d6f4acfcb29c0041e6027b7109544da3fde1d4fb`  
CI run: [33743691064](https://github.com/Gutumrod/pawspace/actions/runs/33743691064) — **success**

## Defect discovered

The legacy pre-Phase-13 `shops.subscription_status` contract permitted `trial`,
while the Phase 13 canonical contract permits `trialing`. The original Phase 13
migration attempted to update legacy rows before replacing the old check
constraint. A clean replay did not expose this because it had no legacy rows;
the incremental legacy-data upgrade probe did.

## Root cause and fix

`20260220000000_initial_schema.sql` creates the historical check constraint
(`trial`, `active`, `past_due`). In
`20260825141500_phase13_subscription_lifecycle.sql`, the `trial` to `trialing`
normalization originally ran while that constraint was active, so PostgreSQL
rejected it.

Commit `f48637d` changes only the transition order:

1. Drop the historical check.
2. Normalize legacy `trial` rows to canonical `trialing`.
3. Add the Phase 13 canonical check.

The legacy CI probe applies the Phase 13 files incrementally with `psql -f`, so
this sequence is valid even without relying on a wrapper transaction. The
normal migration path uses Supabase CLI ordered migration replay; no remote
migration was applied during this verification.

## Phase 7 regression investigation

CI run `33741421481` initially failed two Phase 7 TypeScript assertions about
the target Google sync event. The Phase 7 test and RPC migration blobs are
identical between `master@767a512` and the verification branch before the
round-3 test change. The worker intentionally claims the globally oldest
eligible queue row; the shared TypeScript test database can contain pending
rows created by earlier suites, while the fixture left its target ordering at
`now()`.

Commit `d6f4acf` makes only the fixture target deterministically oldest
(`next_attempt_at` and `created_at` set to the earliest timestamp). It neither
changes the worker RPC nor weakens the concurrency or tenant-routing
assertions. The full TypeScript suite passed in the closure run.

## Regression proof

The successful CI job executed all of the following against an isolated
Supabase stack:

- fresh migration replay and database lint;
- Phase 1, Phase 2, and Phase 3 historical-boundary regressions;
- current-schema database suites;
- Phase 13 quota concurrency races;
- a real Phase 1–12 baseline row with `subscription_status='trial'`, followed
  by incremental Phase 13 application and an assertion of `trialing`;
- all TypeScript regression suites, including Phase 7 worker claims;
- Phase 10 browser E2E;
- typecheck, lint, build, and `git diff --check`.

Every listed CI step concluded `success` in run `33743691064`.

## Residual risks and boundary

This is isolated CI evidence, not production deployment evidence. No PR was
merged, no remote database migration was applied, and no deployment occurred.
PR #4 remains Draft/Open against `master`.
