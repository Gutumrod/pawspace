# PawSpace — Phase 13 Continuation / Remediation Brief

Repository: `Gutumrod/pawspace`
Local path: `D:\AI-Workspace\projects\saas-product-hub\products\PawSpace`
Branch: `master`
Last independently verified pre-Phase13 baseline: `dc5281e`

## Current status override — 2026-08-28

This brief is now a **historical remediation contract**. The Phase 13 implementation described below was committed at `97c9fd6`; repository HEAD is later and the working tree was clean at documentation reconciliation. Do not treat the old "partially present in the working tree" wording as current state.

Phase 13 is **not yet independently CLOSED** because the complete mandatory test matrix has not been freshly rerun and `PHASE13_IMPLEMENTATION_EVIDENCE.md` is still missing.

## Critical handoff rule

Phase 13 implementation is already partially present in the working tree.
**Do not reset, checkout, clean, discard, or restart implementation from zero.**
Inspect the real repository state first and continue only from the current files.

Before editing, record:
- `git status --short --branch`
- `git rev-parse HEAD`
- `git rev-parse origin/master`
- current Phase 13 migration/test/evidence files
- Docker/Supabase local availability

Read Source of Truth in this order:
`AGENTS.md → docs/PRD.md → docs/SYSTEM_ARCHITECTURE.md → docs/BUSINESS_MODEL.md → docs/ROADMAP.md → docs/COMMERCIAL_READINESS.md → docs/PRODUCTION_OPERATIONS.md → docs/IMPLEMENTATION_STATUS.md → PHASE9_IMPLEMENTATION_EVIDENCE.md → PHASE12_IMPLEMENTATION_EVIDENCE.md → docs/BRIEF-phase13-subscription-lifecycle-entitlement-enforcement.md`.

## Current implementation already present

At the latest verified working state, Phase 13 includes partial work in:
- `supabase/migrations/20260825141500_phase13_subscription_lifecycle.sql`
- `supabase/migrations/20260825141600_phase13_subscription_hardening.sql`
- `lib/dashboard-service.ts`
- `docs/BRIEF-phase13-subscription-lifecycle-entitlement-enforcement.md`

Implemented or partially implemented already:
- canonical `shop_subscriptions`
- 8 lifecycle states
- legacy `shops.subscription_status` compatibility mirror/protection
- authoritative entitlement resolver using database time
- owner/manager commercial-status RPC
- subscription transition RPC with transition matrix and retry/idempotency concept
- append-only subscription audit structure
- Starter room/pet hard-quota triggers with subscription-row locking
- Founding Member continuity handling
- dashboard server DTO extension
- authoritative `billing_interval` work started

Do not assume any of the above is correct merely because it exists. Inspect and test it.

## Remaining work — must finish before Phase 13 can pass

### 1. Finish commercial package/offer mutation authority
Complete and verify `set_shop_commercial_package()` so it:
- is service-role/trusted only;
- supports authoritative `billing_interval` (`monthly` / `annual`);
- validates package/offer combinations;
- enforces Founding Member = Starter commercial identity;
- does not allow Founding Member restoration after continuity was lost;
- validates bounded reason/source and non-forgeable actor semantics;
- is idempotent for retryable operations;
- updates compatibility assignment without creating an independent authority;
- writes audit in the same DB transaction.

### 2. Close lifecycle consistency gaps
Verify all allowed and illegal transitions from the Phase 13 master brief.
Terminal `cancelled` / `expired` must block commercial mutations.
Founding Member continuity must be permanently lost after a terminal lapse and must not silently reappear on reactivation/package edits.
`cancel_at_period_end` and `grace_period` access must depend on authoritative DB timestamps.
Direct browser updates to lifecycle/commercial tables must remain impossible.

### 3. Enforce commercial access beyond quota checks
Review every authoritative commercial mutation path touched by Phase 1–12.
Suspended/cancelled/expired shops must fail closed for business mutations, not only new room/pet inserts.
Apply the minimum centralized DB/server boundary necessary; do not scatter plan checks across UI code.
Preserve read-only owner/manager access to account/subscription status.

### 4. Complete quota enforcement and regression compatibility
Room quota contract:
- Starter standard: 10 rooms maximum.
- Pro / Enterprise / valid Founding Member: unlimited.
- prove 9→10 succeeds, 10→11 fails, and concurrent requests cannot produce 11.

Pet quota contract:
- Starter standard: 300 current pet rows maximum.
- Pro / Enterprise / valid Founding Member: unlimited.
- prove 299→300 succeeds, 300→301 fails, and concurrent creation/import cannot exceed 300.
- Phase 12 CSV duplicate/skipped rows must not consume quota.
- an over-quota CSV batch must roll back atomically with no partial owner/pet/sync/import-audit writes.

Update only the stale Phase 9 test assertion that explicitly expected Starter to exceed its room limit.
Do **not** rewrite the passed Phase 9 migration.
All other Phase 9 commercial facts/authorization assertions must stay green.

### 5. Finish Owner/Manager UI
Update `app/dashboard/page.tsx` minimally to show authoritative:
- effective package;
- Founding Member status;
- lifecycle status;
- trial/current-period/grace end when applicable;
- room usage / effective limit;
- pet usage / effective limit;
- clear blocked notice for suspended/cancelled/expired states.

No fake payment, upgrade, PromptPay, SlipOK, invoice, or checkout UI.
Keep the existing Design.md presentation language; no broad redesign.

### 6. Add dedicated Phase 13 executable tests
Create Phase 13 DB/domain tests covering at minimum:
- 30-day subscription initialization;
- all required allowed transitions;
- important illegal transitions;
- activation, past-due, grace, suspension/reactivation;
- cancel-at-period-end before/after period end;
- cancelled/expired terminal behavior;
- lifecycle idempotency and idempotency-key conflict;
- package/offer/billing-interval mutation authority;
- Founding Member effective Pro limits at 990 THB/month;
- Founding Member continuity loss;
- owner/manager read authorization;
- plain staff, inactive user, no-membership, cross-tenant mutation rejection;
- anonymous/authenticated generic DML privilege probes;
- immutable audit log and no false audit on failed mutations;
- tenant-scoped room/pet counts and unlimited Pro/Enterprise paths;
- room/pet concurrency safety;
- Phase 12 CSV duplicate and over-quota atomic rollback behavior.

Also rerun directly affected Phase 9 and Phase 12 tests.
If an existing test conflicts only because Phase 13 intentionally supersedes Phase 9's non-enforcement assumption, update that assertion narrowly and document why.

### 7. Small server compatibility cleanup
Validate lifecycle status values in `lib/dashboard-service.ts` rather than blindly casting arbitrary strings.
If `lib/tenant-context.ts` is touched, replace legacy fallback `"trial"` with the canonical `"trialing"` lifecycle value.
Do not expose secrets or raw commercial admin metadata to browser DTOs.

## Required verification gates

Run from a fresh local baseline; do not reuse stale output:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
git diff --check
pnpm exec supabase db reset
pnpm exec supabase db lint --local
```

Then run:
- dedicated Phase 13 SQL/security/lifecycle/quota tests;
- Phase 13 TypeScript/domain tests if added;
- Phase 9 entitlement regression;
- Phase 12 onboarding/import regression;
- every earlier suite whose production mutation surface was changed.

Docker Desktop/Supabase local stack is required for DB gates. Previous execution was blocked because the Docker daemon was not available; re-check rather than assuming it is still down.

## Evidence and completion

Create `PHASE13_IMPLEMENTATION_EVIDENCE.md` only after executing the real gates.
Record exact commands, exact pass/fail results, migrations changed, tests changed, security probes, and known non-scope.
Do not write `PASS`, `READY`, or `100%` from implementation claims alone.

Before commit, independently inspect `git diff`, `git diff --check`, `git status`, migration ordering, and absence of unrelated scope drift.
Commit/push only when all required gates are green.
Suggested commit message: `feat: enforce phase 13 subscription lifecycle`.
After push, prove `HEAD == origin/master` and working tree is clean.
