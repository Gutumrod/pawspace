# PS01 Pawstia — Build-to-Sell Execution Brief

**Owner direction:** BUILD-TO-SELL.
**Verified baseline:** branch `verify/phase13-closure-2026-09-01`, HEAD `fdd10e7`, clean tree.
**Verified closure:** Phase 13 independent evidence exists; CI run 33743691064 passed the full isolated matrix. Do not repeat the old failure narrative.
**Council:** Product PASS; Business/Market PASS after BM-1/BM-2.

## Commercial boundary locked by Council
- Founding Member C2: first 10 stores only, invitation-only closed-beta/founding cohort, THB 990/month, continuous subscription required, shop-bound and non-transferable.
- Founding THB 990 is not proof of general public Pro WTP.
- Store-owned/merchant-owned LINE OA; merchant bears OA/message charges. Pawstia provides integration/setup support.
- Public Starter/Pro/Enterprise pricing remains a downstream market hypothesis.

## Sell-ready destination
A real pet-hospitality store can onboard, operate booking/room/pet workflows, send Daily Reports, use LINE/Sheets/LIFF, survive integration failures, recover data, obtain support, and move through a controlled paid lifecycle without cross-tenant or entitlement ambiguity.

## Execution sequence
### PS-SR-01 — Land/reconcile Phase 13 closure
Verify the closure branch diff/evidence, reconcile stale status docs, and move the independently passing Phase 13 result into the canonical development line according to repository policy. Do not weaken tests to merge it.

### PS-SR-02 — Staging + release engineering
Create/prove isolated staging, migration pipeline, environment separation, deploy/rollback, two-tenant smoke and release record. No destructive production reset.

### PS-SR-03 — Integration resilience + recovery
Exercise LINE delivery/retry/reconciliation, Sheets recovery, LIFF identity, storage/media recovery, observability, backup/restore and incident runbooks under injected failure.

### PS-SR-04 — Controlled real-store Closed Beta
Start with 1 store, then gated expansion toward the first 10. Measure onboarding time, booking integrity, staff learning, LINE/Sheets reliability, support burden, incidents and willingness-to-pay.

### PS-SR-05 — Commercial/payment contract lock
After beta evidence, lock provider/rail, trial expiry, upgrade/downgrade, failed-payment grace, cancel/refund, Founding continuity, reconciliation and offboarding/export/retention before payment integration.

### PS-SR-06 — Payment collection + paid launch
Implement payment collection only after PS-SR-05 approval. Require signed/idempotent events, authoritative subscription transitions, replay/out-of-order tests, controlled payment/refund rehearsal, support and Owner GO.

## Immediate next ticket
**Start PS-SR-01.** Phase 13 verification itself is already closed; the job is canonical reconciliation/landing, not another verification loop.

## Definition of done
- Phase 13 is canonical, not stranded on a verification branch.
- Staging/deploy/rollback/recovery are proven.
- At least one real-store beta loop is completed with evidence.
- LINE cost ownership and Founding terms are represented accurately.
- Payment cannot bypass the authoritative subscription transition domain.