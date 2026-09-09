# PS01 Test Summary + Improvement Plan

Date: 2026-09-09 (Asia/Bangkok)
Scope: PS01 Booking V2 + H3D Customer LINE runtime
Branch baseline: `work/ps01-h3d-data-api-20260909 @ 4efee706`

## Executive verdict

`AGENT STATIC/PURE PASS`
`OWNER MANUAL PENDING`
`LIVE H3D CUSTOMER PROOF BLOCKED ON HOUSE PREREQUISITES`

No PS01 implementation, migration, grant, RLS, WSTERA LAB data, BK01 data, Production, or hosted Auth configuration was changed by this test pass.
The only intentional repo additions are test/evidence files.

## Agent evidence completed

- H3D Data API runtime static: 7/7 PASS.
- New Booking V2 contract regression: 8/8 PASS.
- Phase 8 camera core: 22/22 PASS.
- Phase 9 entitlements: 5/5 PASS.
- TypeScript: PASS.
- ESLint: PASS.
- Next 16.3.1 production build: PASS, 13/13 routes/pages generated.
- shared-runtime generator: PASS, 14 migrations, canonical source hash unchanged.
- shared-runtime boundary verifier: PASS, 14/14 sources and no core admin-client dependency.
## Owner manual-test gate

Owner manual test is prepared but must not start until House confirms the H3D/LAB prerequisites are ready.
Required before Owner test:

- WSTERA LAB only; Production is out of scope.
- Hosted Custom Access Token Hook is active for the intended LAB flow.
- LAB test identities are available for normal Staff authentication and Customer LINE testing.
- `ps01_line_runtime` has only the intended finite runtime grant.
- A fresh Auth-issued runtime JWT is available through runtime environment configuration, not committed source.
- Customer LINE/LIFF configuration is valid for the LAB test identity.
- No browser/manual step uses `service_role`, admin credentials, direct table edits, or a production credential.

If any item above is missing, affected manual cases are `BLOCKED` or `NOT RUN`; no workaround is authorized.
The prepared Owner runbook covers O-01 through O-16: auth/shop isolation, HOUR/DAY/MONTH rate plans, quote behavior, overlap/back-to-back rules, maintenance/capacity, inactive plans, quote snapshot preservation, lifecycle/cleaning, Customer LINE parity/request flow, confirmation revalidation, decline, and cross-shop isolation.

## Fresh-proof boundary

The historical Booking V2 transactional LAB result of 21/21 is retained as prior evidence only.
It was not rerun during this preparation because House is changing the shared runtime and this pass was intentionally non-mutating.
Therefore the current fresh claim is limited to static/pure regression evidence; live H3D and DB-backed acceptance still require the post-House test gate.
## Findings requiring follow-up

### T-01 — Shared-runtime generator EOL churn
Running `pnpm build:ps01-baseline` rewrites generated SQL files with line-ending-only changes on this Windows worktree.
Content comparison proved them identical apart from EOL, and the files were restored.
Recommendation: normalize generated SQL line endings in generator/output policy so a verification command does not dirty a clean tree.

### T-02 — `tsx` test runner is not pinned in project dependencies
The pure TypeScript tests currently run through an available `npx tsx` installation (`tsx 4.23.13`).
An attempt to pin it with pnpm encountered the repository supply-chain policy because an `esbuild` build script would need approval.
No approval was granted and all package/workspace changes from that attempt were restored.
Recommendation: explicitly decide and document the trusted test-runner/build-script policy before changing dependencies; do not silently use `pnpm approve-builds`.

### T-03 — Historical integration tests are not suitable as routine shared-LAB smoke
Several older integration/E2E tests create fixtures with `SUPABASE_SERVICE_ROLE_KEY` and contain fixed test-password strings.
These are historical test fixtures, not evidence of discovered production secrets, but they do not meet the desired routine shared-LAB safety standard.
Recommendation: separate destructive/admin fixture setup into an isolated integration tier and use generated or environment-provided ephemeral credentials.

### T-04 — Documentation drift after H3D
The older continuation handoff describes the PostgreSQL pooler path, while H3D now routes Customer LINE through the Data API adapter.
The H3D branch also does not contain the older handoff at the path referenced by the H3D document.
Recommendation: after House closes the H3D gate, publish one canonical continuation handoff that supersedes the pooler-era runtime description.
## Retest strategy after House returns H3D/LAB ready

1. Reconfirm branch/HEAD/remote divergence and clean pre-existing state.
2. Rerun H3D static, Booking V2 contract, TypeScript, lint, production build, and shared-runtime boundary verification.
3. Execute fresh DB-backed Booking V2 acceptance against WSTERA LAB under the approved fixture/cleanup boundary.
4. Owner executes O-01 through O-16 from the manual runbook; record every result in the Owner POST document.
5. Any failed case gets a defect ID, evidence, severity, remediation, and explicit retest; do not overwrite the original failed observation.
6. Only after fresh DB + Owner manual evidence can the final verdict move to PASS.

## Evidence files

- `docs/testing/PS01-AGENT-TEST-PRE-2026-09-09.md`
- `docs/testing/PS01-AGENT-TEST-POST-2026-09-09.md`
- `docs/testing/PS01-OWNER-MANUAL-TEST-PRE-2026-09-09.md`
- `docs/testing/PS01-OWNER-MANUAL-TEST-POST-2026-09-09.md`
- `docs/testing/PS01-TEST-SUMMARY-AND-IMPROVEMENTS-2026-09-09.md`
- `tests/booking_v2_contract.test.ts`

## Current next action

Do not start Owner manual testing yet.
Wait for House to return the H3D/LAB prerequisites, then run the fresh preflight and DB-backed acceptance before handing O-01 to Owner.
No commit or push is included in this testing preparation without explicit Owner authorization.
## Final preparation status

Final non-mutating preflight completed successfully from `4efee706`.
The exact test runner command was also verified with `tsx@4.23.13` for H3D and Booking V2 focused tests.
Repo dependency/config files remain unchanged; final working-tree additions are limited to testing evidence and the new focused contract test.

Owner testing is **not released yet** because House H3D/LAB prerequisites are still the external gate.
Once House confirms readiness, rerun the fresh LAB/DB acceptance gate first; only then hand the Owner manual runbook to the Owner.
