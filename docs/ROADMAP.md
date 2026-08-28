# 🗺️ Pawstia PMS — Product Roadmap & Execution Milestones

> **Document Status:** Reconciled 2026-08-28
> **Brand:** Commercial candidate `Pawstia PMS`; internal repository identity remains `PawSpace` / `PS01`.
> **Numbering rule:** **Engineering Phase** and **Commercial Stage** are different systems. Never use `Phase 1–4` for commercial stages again.

---

## 1. Current engineering baseline

| Engineering execution | Current state |
|---|---|
| Phase 1–3 | CLOSED — foundation, authoritative DB/RLS/auth/tenant boundaries |
| Phase 4–6 | CLOSED — booking backend, LINE claim, Daily Report + LINE delivery |
| Phase 7–9 | CLOSED — Google Sheets sync, bounded visitor camera, entitlements/dashboard |
| Phase 10 | CLOSED — live operations UI + browser E2E |
| Design Implementation Pass | CLOSED |
| Phase 11 / 11.1 | CLOSED — customer LIFF booking + design alignment |
| Phase 12 | CLOSED — onboarding/import/Closed Beta technical readiness |
| Phase 13 | **IMPLEMENTED / COMMITTED — FINAL RE-VERIFICATION PENDING** |
| Payment collection | **NOT IMPLEMENTED** |
| Production deployment | **NOT VERIFIED / NOT LAUNCHED** |

Phase 13 must not be marked CLOSED until its mandatory lifecycle/quota/concurrency/regression matrix is rerun and `PHASE13_IMPLEMENTATION_EVIDENCE.md` exists.

---
## 2. Commercial roadmap

### Stage A — Core Product
Goal: make the daily operating loop trustworthy.

Scope now implemented:
- tenant/staff auth and authoritative mutation boundaries;
- room matrix, booking, check-in/out, cleaning and maintenance lifecycle;
- customer/pet CRM;
- Daily Care Report with media + LINE delivery;
- Google Sheets one-way export replica;
- customer self-booking via LIFF;
- onboarding/import flow;
- owner/manager dashboard;
- subscription/entitlement foundation.

### Stage B — Closed Beta
Goal: validate Pawstia PMS with real pet hotels before charging broadly.

Execution:
1. Start with 1 real store, then 3, 5, and 10.
2. Measure onboarding time, booking failures, LINE delivery success, Sheets sync failures, staff learning curve, support burden, and Daily Report usage.
3. Validate pricing/willingness-to-pay and Founding Member conversion assumptions.
4. Fix operational friction before payment automation.

Do not call technical `PILOT READY` the same thing as successful real-world beta validation.

### Stage C — Paid Launch
Prerequisites:
- Phase 13 independently closed;
- payment collection integrated through the same authoritative subscription transition domain;
- trial/upgrade/downgrade/suspension/reactivation commercial rules finalized;
- staging and production deployment contracts;
- monitoring, backup/restore drill, incident response, and support process;
- Terms/Privacy/DPA/subprocessor review;
- final brand/channel decision.

Payment webhooks must never write raw subscription state directly.

### Stage D — Expansion
Only after real beta/paid usage supports the investment:
- advanced multi-branch control;
- grooming workflow;
- vaccine/recall automation;
- advanced RTSP/HLS multi-camera capabilities;
- other paid add-ons validated from customer demand.

---

## 3. Immediate execution order

1. Documentation reconciliation — **this pass**
2. Phase 13 final executable verification
3. Staging + production-readiness implementation
4. Real-store Closed Beta
5. Payment integration and Paid Launch gate
6. Expansion only from validated demand

---

## 4. Verification environment decision

Do **not** require Docker Desktop on the Windows PC for Phase 13 verification.

Preferred order:
1. **GitHub Actions ephemeral Ubuntu runner** — run the Supabase local stack and database/TS regression suites away from the Windows PC.
2. **Isolated Supabase cloud staging/test project** — use for remote integration/E2E and deployment validation, never production data.
3. macOS local Supabase/Docker stack when the Mac is available and stable.
4. Windows Docker only after the machine stability issue is intentionally resolved.

Production data must never be used as a substitute for the test environment.
