# PS01 Agent Test — POST

Date: 2026-09-09 (Asia/Bangkok)
Product: PS01 / Pawstia PMS
Test branch: `work/ps01-h3d-data-api-20260909`
Baseline HEAD: `4efee706d39b8aa66d2b610793c987d9f6e1f948`
Verdict: `STATIC / PURE REGRESSION PASS — LIVE H3D + DB ACCEPTANCE NOT RE-PROVEN`

## Executed evidence

| Gate | Result | Evidence |
|---|---|---|
| `git diff --check` | PASS | no whitespace error |
| H3D Data API runtime static proof | PASS | 7/7 |
| Booking V2 focused contract test | PASS | 8/8 |
| Phase 8 camera core | PASS | 22/22 |
| Phase 9 entitlements | PASS | 5/5 |
| TypeScript `--noEmit` | PASS | exit 0 |
| ESLint | PASS | exit 0 |
| Next production build | PASS | Next 16.3.1, 13/13 pages/routes generated |
| PS01 baseline generator | PASS* | 14 migrations, source hash unchanged |
| PS01 boundary verifier | PASS | 14/14 canonical migrations, no core admin-client dependency |

Source hash after generator:
`6cda75d1aec8e12326662fe2c2db017c3be7d012ce961d9d1bef0c6d1748c044`

## New focused regression added

New test-only file:
`tests/booking_v2_contract.test.ts`

It proves without DB/network:
1. Bangkok local datetime -> UTC conversion and round-trip.
2. impossible calendar values are rejected.
3. timezone-free timestamp is rejected.
4. duplicate pets are rejected.
5. valid payload canonicalizes timestamp and trims special request.
6. invalid payload stops before LINE verification/runtime RPC.
7. quote path verifies LINE and calls exactly `quote_customer_booking_v2_internal`.
8. submit path calls exactly `submit_booking_request_v2_internal`; `not linked` maps correctly.

## Not freshly proven in this run

The prior transactional LAB Booking V2 acceptance was reported 21/21, but was not rerun because the current window explicitly avoids LAB mutation while House is changing shared runtime.
Therefore HOUR/DAY/MONTH DB duration, overlap, capacity, maintenance, quote snapshot, Staff/Customer parity, lifecycle, and cross-shop database behavior remain `HISTORICAL PASS / FRESH RUN PENDING`.

H3D live Customer LINE smoke remains `BLOCKED`, not PASS, until House completes hosted Auth hook/runtime fixture prerequisites.

## Defects / test-infrastructure findings

### T-01 — Generator dirties Windows worktree by EOL only

`pnpm build:ps01-baseline` marked 3 generated SQL files modified.
`git diff --ignore-space-at-eol --exit-code` proved generated content was identical; only LF/CRLF differed.
The test run restored only those generated files afterwards.
Recommendation: enforce canonical LF in generator output and/or `.gitattributes`, then assert clean diff after generation.

### T-02 — `tsx` execution is not pinned/reproducible under current pnpm policy

The repo documents/runs `npx tsx`; `tsx` is not a devDependency.
Observed cache version was `tsx 4.23.13`.
Attempting to pin it caused pnpm to reject `esbuild@0.28.2` build scripts under the existing supply-chain policy.
No `pnpm approve-builds` was performed. All package/workspace/lockfile changes from that attempt were restored.
Recommendation: House/Owner explicitly decide the trusted test runner dependency/policy; do not silently weaken build-script controls.

### T-03 — Historical integration tests are not LAB-safe routine smoke

Several historical tests require `SUPABASE_SERVICE_ROLE_KEY` for fixture setup and contain fixed ephemeral test passwords in source.
These are test fixtures, not discovered production secrets, but they should be moved to an isolated integration tier and hardened to generated/env-supplied credentials before routine use.

### T-04 — Documentation drift

H3D evidence references `docs/daily/HANDOFF-PS01-BOOKING-V2-SHARED-RUNTIME-CONTINUATION-2026-09-08.md`, but that handoff exists in the staging worktree and is absent from the pushed H3D branch.
The older handoff also describes the pooler path as active; H3D supersedes that acceptance target.
Recommendation: copy/update a canonical handoff in the active branch and mark the pooler gate explicitly superseded.
## Final preflight rerun

After the testing documents and focused Booking V2 test were finalized, the non-mutating preflight was rerun from the same baseline HEAD.

- `git diff --check`: PASS.
- H3D static proof: 7/7 PASS.
- Booking V2 focused contract: 8/8 PASS.
- Phase 8 camera core: 22/22 PASS.
- Phase 9 entitlements: 5/5 PASS.
- `pnpm exec tsc --noEmit`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS; Next 16.3.1 generated 13/13 routes/pages.
- `pnpm test:ps01-boundary`: PASS; 14/14 migrations, no core admin-client dependency.
- H3D + Booking V2 were then rerun with explicit `npx --yes tsx@4.23.13`: 7/7 and 8/8 PASS.
- Final branch divergence: `0/0` against `origin/work/ps01-h3d-data-api-20260909`.
- Final tracked dependency/config state was unchanged; only `docs/testing/` and `tests/booking_v2_contract.test.ts` are untracked additions.

This does not change the verdict for live H3D or DB-backed acceptance: those remain pending House readiness and a fresh LAB test window.
