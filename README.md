# 🐾 Pawstia PMS — Pet Management System by WSTERA

> **"Pet Hotel OS ที่จัดการห้อง การเข้าพัก และ Daily Care Report ผ่าน LINE โดยร้านยังมีสำเนาส่งออกข้อมูลลูกค้าและรายการจองใน Google Sheets"**

> **Brand status (2026-08-28):** Commercial-name candidate is **Pawstia PMS**. Internal repository/project identifiers remain `PawSpace` / `PS01` until a dedicated brand-migration pass. Do not mass-rename SQL functions, migrations, or repository history.

---

## 🎯 Product Positioning

**Pawstia PMS** คือระบบสำหรับ **Pet Hotel และ Pet Daycare** แบบ Single-Store Focus ใน V1

แกนหลัก:
1. **Room Matrix & Strict Booking Engine** — booking/check-in/out/cleaning/maintenance พร้อม authoritative DB invariants.
2. **Pet Care Workflow** — Daily Care Report + รูป 1–4 รูป + LINE delivery.
3. **Data Ownership** — authoritative Supabase data พร้อม Google Sheets one-way export replica.

Customer self-booking ผ่าน LINE LIFF, onboarding/import, owner/manager dashboard และ subscription/entitlement lifecycle ถูกเพิ่มจาก engineering phases หลัง MVP เดิมแล้ว.

---

## 🏗️ Source of Truth

| Document | Priority | Current role |
|---|---:|---|
| [`docs/PRD.md`](./docs/PRD.md) | 1 | Product contract / locked invariants |
| [`docs/SYSTEM_ARCHITECTURE.md`](./docs/SYSTEM_ARCHITECTURE.md) | 2 | Technical target and security contracts |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | 3 | Commercial Stage A–D + engineering execution order |
| [`docs/BUSINESS_MODEL.md`](./docs/BUSINESS_MODEL.md) | 4 | Pricing, offers, hypotheses, GTM |
| [`docs/IMPLEMENTATION_STATUS.md`](./docs/IMPLEMENTATION_STATUS.md) | Tracking | Current codebase reality |
| [`docs/COMMERCIAL_READINESS.md`](./docs/COMMERCIAL_READINESS.md) | Launch gate | Paid-launch readiness checklist |
| [`docs/PRODUCTION_OPERATIONS.md`](./docs/PRODUCTION_OPERATIONS.md) | Operations | Staging/production/monitoring/recovery/support requirements |

**Numbering rule:** Engineering uses **Phase 1–13+**. Commercial roadmap uses **Stage A–D**. Do not mix the two systems.

## 📦 Current V1 / Core Scope

- Tenant/Auth + hardened RLS/RPC authority.
- Room setup, booking, pet assignment, check-in/out, cleaning and maintenance.
- Owner/Pet CRM.
- Daily Care Report + media + LINE delivery/retry.
- Verified LINE identity claim.
- Google Sheets one-way export replica.
- Bounded visitor-camera access.
- Owner/manager dashboard and entitlements.
- Customer self-booking via LIFF.
- Pilot onboarding + CSV import/audit.
- Subscription lifecycle + commercial access + Starter quotas.

## 🚫 Not Yet Commercially Complete

- Payment collection/provider integration.
- Final production deployment/monitoring/backup/restore/support gates.
- Final legal review and formal trademark clearance.
- Real-store Closed Beta validation.
- Advanced multi-branch, grooming, vaccine automation, advanced RTSP/HLS multi-camera platform.

## 🚦 Current Gate

Engineering Phase 13 is **implemented and committed but not independently CLOSED**. The complete mandatory lifecycle/quota/concurrency/regression matrix must be rerun on an isolated test environment and `PHASE13_IMPLEMENTATION_EVIDENCE.md` must be created before promotion.
