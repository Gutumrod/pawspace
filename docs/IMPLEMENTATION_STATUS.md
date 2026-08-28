# 📊 Pawstia PMS — Current Implementation Status & Codebase Reality

> **Last reconciled:** 2026-08-28
> **Repository:** `Gutumrod/pawspace`
> **Internal product ID:** `PS01`
> **Current HEAD at reconciliation:** `2810472`
> **Commercial brand candidate:** `Pawstia PMS — Pet Management System by WSTERA`
> **Rule:** This file reports current reality only. Historical phase claims belong in `PHASE*_IMPLEMENTATION_EVIDENCE.md`, `REVIEW-*.md`, and handoff files.

---

## 1. Current gate status

| Area | Status | Reality |
|---|---|---|
| Engineering Phase 1–12 | **CLOSED / previously reviewer-verified** | Dedicated evidence/review files exist for the delivered phases |
| Engineering Phase 13 | **IMPLEMENTED — RE-VERIFICATION REQUIRED** | Committed at `97c9fd6`; lifecycle, entitlement, quotas, audit, and commercial mutation enforcement exist |
| Phase 13 evidence | **MISSING FINAL EVIDENCE** | `PHASE13_IMPLEMENTATION_EVIDENCE.md` does not yet exist |
| Payment collection | **NOT IMPLEMENTED** | No Stripe/PromptPay/SlipOK/payment provider contract |
| Production deployment | **NOT VERIFIED** | No commercial-production gate has been closed |
| Closed Beta business validation | **NOT COMPLETED** | Technical readiness is not evidence of real-store adoption |
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
- `supabase/migrations/20260825141600_phase13_subscription_hardening.sql`
- `supabase/tests/phase13_subscription_lifecycle.sql`
- `lib/dashboard-service.ts`
- `app/dashboard/page.tsx`
Implemented concepts include:
- one authoritative `shop_subscriptions` record per shop;
- 8 lifecycle states;
- compatibility protection for legacy `shops.subscription_status`;
- package / offer / billing interval authority;
- Founding Member continuity;
- commercial-access resolver using authoritative DB time;
- service-role lifecycle/package mutation RPCs;
- subscription audit log;
- database-level commercial mutation blocking;
- room/pet quota triggers;
- owner/manager commercial status DTO/UI.

**Not enough to mark Phase 13 CLOSED:** the current dedicated SQL test does not yet prove the entire mandatory matrix from the Phase 13 brief.

Missing or insufficiently evidenced areas include:
- 9→10→11 room boundary;
- 299→300→301 pet boundary;
- concurrent room/pet quota races;
- over-quota CSV atomic rollback and duplicate handling under Phase 13;
- complete lifecycle transition/timing matrix;
- tenant/role negative matrix for every commercial mutation path;
- full audit immutability probes;
- Pro/Enterprise/Founding unlimited regression;
- fresh Phase 9 + Phase 12 + affected regressions;
- final evidence document and independent gate.

---
## 4. Integration reality

### LINE
Current production-intent code uses per-shop server-side configuration from:
`LINE_CHANNEL_ACCESS_TOKENS_JSON[shopId]`

This is server-only but is **not the same claim as Supabase Vault**. Vault remains a target secret-management option until actually adopted and verified.

### Google Sheets
A tenant-specific `shops.google_sheet_id` plus proof-of-control flow and trusted service credentials are implemented. Production credentials still require environment/secret-management operational hardening.

### Camera
Bounded public visitor-camera capability already exists from Engineering Phase 8. The future roadmap item is the broader RTSP/HLS multi-camera platform, not the basic bounded camera feature.

---

## 5. Verification environment

On 2026-08-28, Windows local Supabase verification is blocked because Docker Engine is unavailable on the PC. Due prior machine-instability concerns, Windows Docker is not a required path.

Preferred Phase 13 verification:
1. GitHub Actions ephemeral Ubuntu runner for supabase db start, supabase test db, TypeScript regressions and static gates;
2. isolated Supabase cloud staging/test project for remote integration/E2E validation;
3. macOS local stack when available;
4. Windows Docker only after separate machine-stability work.

Never run destructive reset/test commands against production.

## 6. Next gates

1. Complete documentation reconciliation.
2. Build isolated verification environment.
3. Expand Phase 13 mandatory tests.
4. Execute fresh migrations + Phase 13 + regressions.
5. Create `PHASE13_IMPLEMENTATION_EVIDENCE.md`.
6. Independent review and close Phase 13.
7. Implement production operations: staging, deploy/rollback, monitoring, backup/restore, incident/support.
8. Run real-store Closed Beta.
9. Integrate payment only after those gates.

---

## 7. Source-of-truth priority

1. `docs/PRD.md`
2. `docs/SYSTEM_ARCHITECTURE.md`
3. `docs/ROADMAP.md`
4. `docs/BUSINESS_MODEL.md`
5. `docs/IMPLEMENTATION_STATUS.md` for current implementation reality
6. phase briefs for execution contracts
7. evidence/review files for historical verification

When docs and executable code disagree, do not silently promote code claims. Reconcile the contract and rerun the relevant executable gate.
