# 📊 Pawstia PMS — Current Implementation Status & Codebase Reality

> **Last reconciled:** 2026-09-06
> **Repository:** `Gutumrod/pawspace`
> **Internal product ID:** `PS01`
> **Current verification HEAD at reconciliation:** `fdd10e7` on `verify/phase13-closure-2026-09-01`
> **Commercial brand candidate:** `Pawstia PMS — Pet Management System by WSTERA`
> **Rule:** This file reports current reality only. Historical phase claims belong in `PHASE*_IMPLEMENTATION_EVIDENCE.md`, `REVIEW-*.md`, and handoff files.

---

## 0. 2026-09-06 verification update
- Phase 13 is **CLOSED**. The full isolated Supabase verification matrix passed in CI run `33743691064`, and final evidence is committed in `PHASE13_IMPLEMENTATION_EVIDENCE.md` (independent closure date 2026-09-03).
- Historical note (kept as provenance): prior run `33494605562` failed the historical Phase 1 isolation regression. That defect was remediated (legacy `trial`→`trialing` normalization order fixed) and the full matrix re-passed in the closure run; the regression contract was not weakened.
- Owner direction 2026-09-06 = **BUILD-TO-SELL**. Council Product Gate PASS and Business/Market Gate PASS for PS01. Immediate ticket is `PS-SR-01` (canonical landing/reconciliation of the closed Phase 13 evidence); it is a documentation reconciliation, not a verification rerun.
- Booking Stage 4 is complete; `PS-A2` Project B admission remains a separate explicitly-tracked track.
- Portfolio `P0a-C1` is not re-decided by this reconciliation.

## 1. Current gate status

| Area | Status | Reality |
|---|---|---|
| Engineering Phase 1–12 | **CLOSED / previously reviewer-verified** | Dedicated evidence/review files exist for the delivered phases |
| Engineering Phase 13 | **CLOSED** | Independent evidence in `PHASE13_IMPLEMENTATION_EVIDENCE.md`; CI run `33743691064` passed the full isolated matrix |
| Phase 13 evidence | **PRESENT** | `PHASE13_IMPLEMENTATION_EVIDENCE.md` exists (closure dated 2026-09-03) |
| Payment collection | **NOT IMPLEMENTED** | No Stripe/PromptPay/SlipOK/payment provider contract; not a Phase 13 blocker |
| Production deployment | **NOT VERIFIED** | No commercial-production gate has been closed |
| Closed Beta business validation | **NOT COMPLETED** | Technical readiness is not evidence of real-store adoption; downstream of PS-SR-04 |
| Brand | **CANDIDATE LOCKED** | `Pawstia PMS`; internal identifiers remain `PawSpace` / `PS01` for now |

---

## 2. Implemented product capabilities

- Supabase Auth + tenant/staff authorization and hardened RLS/RPC boundaries.
- Room setup, room status, maintenance, booking, pet assignment, check-in/out, and cleaning lifecycle.
- Customer/pet CRM and guarded ownership mutations.
- Daily Care Report media pipeline, storage, delivery queue, LINE transport and retry semantics.
- Verified LINE identity claim flow.
- Google Sheets proof-of-control binding, one-way export replica and worker.
- Bounded tenant-scoped visitor camera access.
- Owner/manager dashboard and commercial entitlement visibility.
- Customer self-booking through LINE LIFF.
- Pilot onboarding, CSV preview/import, authoritative import audit and integration-readiness checks.
- Subscription lifecycle + commercial access authority + append-only subscription audit.
- Starter hard quotas: 10 rooms / 300 current pet records; Pro/Enterprise/valid Founding Member unlimited.

---

## 3. Phase 13 reality

Implemented in:
- `supabase/migrations/20260825141500_phase13_subscription_lifecycle.sql`
- `supabase/migrations/20260825141700_phase13_bootstrap_trialing_remediation.sql`
- `supabase/tests/phase13_subscription_lifecycle.sql`
- `supabase/tests/phase13_lifecycle_matrix.sql`
- `supabase/tests/phase13_csv_atomicity.sql`
- `lib/dashboard-service.ts`
- `app/dashboard/page.tsx`

Implemented concepts include:
- one authoritative `shop_subscriptions` record per shop;
- 8 lifecycle states;
- compatibility protection for legacy `shops.subscription_status` (legacy `trial` normalized to canonical `trialing`);
- package / offer / billing interval authority;
- Founding Member continuity;
- commercial-access resolver using authoritative DB time;
- service-role lifecycle/package mutation RPCs;
- subscription audit log;
- database-level commercial mutation blocking;
- room/pet quota triggers (with concurrency + CSV atomicity coverage);
- owner/manager commercial status DTO/UI.

**Phase 13 is CLOSED.** The dedicated SQL tests plus CI run `33743691064` proved the mandatory matrix from the Phase 13
brief against an isolated Supabase stack: fresh migration replay + DB lint, Phase 1/2/3 historical-boundary regressions,
current-schema DB suites, quota concurrency races, CSV atomicity, lifecycle transition/timing matrix, legacy
`trial`→`trialing` incremental upgrade, Phase 7 worker-claim regression, Phase 10 browser E2E, and typecheck/lint/build/
`git diff --check`. No production migration was applied; this is isolated CI evidence, not production deployment.

---

## 4. Integration reality

### LINE
Current production-intent code uses per-shop server-side configuration from:
`LINE_CHANNEL_ACCESS_TOKENS_JSON[shopId]`

This is server-only but is **not the same claim as Supabase Vault**. Vault remains a target secret-management option until actually adopted and verified.

Owner decision BM-2 (2026-09-04 Council): LINE OA is store-owned / merchant-owned for closed beta and paid production;
merchant bears OA/message charges; Pawstia provides integration/setup support and discloses cost clearly. WSTERA/Pawstia
OA line is for internal development / controlled demo / non-commercial test only.

### Google Sheets
A tenant-specific `shops.google_sheet_id` plus proof-of-control flow and trusted service credentials are implemented. Production credentials still require environment/secret-management operational hardening.

### Camera
Bounded public visitor-camera capability already exists from Engineering Phase 8. The future roadmap item is the broader RTSP/HLS multi-camera platform, not the basic bounded camera feature.

---

## 5. Verification environment

On 2026-08-28, Windows local Supabase verification is blocked because Docker Engine is unavailable on the PC. Due prior machine-instability concerns, Windows Docker is not a required path.

Phase 13 verification used an ephemeral GitHub Actions Ubuntu runner successfully (CI run `33743691064`).

Preferred verification path:
1. GitHub Actions ephemeral Ubuntu runner for supabase db start, supabase test db, TypeScript regressions and static gates;
2. isolated Supabase cloud staging/test project for remote integration/E2E validation;
3. macOS local stack when available;
4. Windows Docker only after separate machine-stability work.

Never run destructive reset/test commands against production.

## 6. Next gates (PS-SR-02 onward)

Owner direction 2026-09-06 = BUILD-TO-SELL. Phase 13 landing is the completed `PS-SR-01` reconciliation; execute one
immediate ticket at a time with Secretary gate review between tickets.

1. **PS-SR-02** — Staging + release engineering: isolated staging, migration pipeline, environment separation, deploy/rollback, two-tenant smoke, release record. No destructive production reset.
2. **PS-SR-03** — Integration resilience + recovery: LINE delivery/retry/reconciliation, Sheets recovery, LIFF identity, storage/media recovery, observability, backup/restore, incident runbooks under injected failure.
3. **PS-SR-04** — Controlled real-store Closed Beta: start with 1 store, gated expansion toward first 10; measure onboarding, booking integrity, staff learning, LINE/Sheets reliability, support burden, incidents, willingness-to-pay.
4. **PS-SR-05** — Commercial/payment contract lock: after beta evidence, lock provider/rail, trial expiry, upgrade/downgrade, failed-payment grace, cancel/refund, Founding continuity, reconciliation, offboarding/export/retention.
5. **PS-SR-06** — Payment collection + paid launch: only after PS-SR-05 approval; signed/idempotent events, authoritative subscription transitions, replay/out-of-order tests, controlled payment/refund rehearsal, support, Owner GO.

---

## 7. Source-of-truth priority

1. `docs/PRD.md`
2. `docs/SYSTEM_ARCHITECTURE.md`
3. `docs/ROADMAP.md`
4. `docs/BUSINESS_MODEL.md`
5. `docs/IMPLEMENTATION_STATUS.md` for current implementation reality
6. phase briefs for execution contracts
7. evidence/review files for historical verification
8. `docs/BUILD-TO-SELL-EXECUTION-2026-09-06.md` for the current build-to-sell execution wave

When docs and executable code disagree, do not silently promote code claims. Reconcile the contract and rerun the relevant executable gate.
