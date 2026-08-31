# BRIEF — Pawstia PMS Sell-Ready Execution

> **Status:** EXECUTION PLAN — NOT LAUNCH AUTHORIZATION
> **Source of truth:** `PRD.md` → `SYSTEM_ARCHITECTURE.md` → `ROADMAP.md` → `BUSINESS_MODEL.md` → `IMPLEMENTATION_STATUS.md`
> **Purpose:** พา Pawstia จาก implemented-but-unverified commercial foundation ไปถึง paid single-store SaaS ที่ร้านจริงพึ่งพาได้ โดยไม่เอา visual polish, schema presence หรือ beta demo มาแทน production evidence

## 1. Sell-ready destination

Pawstia ถือว่า **SELL READY** เมื่อร้านจริงสามารถ onboard/import, จัดการ booking/room/pet, ส่ง Daily Report ผ่าน LINE, sync Google Sheets, ใช้ LIFF, เริ่ม trial, ชำระเงิน, เปลี่ยนแพ็กเกจ, ต่ออายุ, suspend/reactivate และยกเลิกได้ โดย:

- tenant/RLS/RPC, lifecycle, quota, queue/retry และ audit ผ่าน clean DB/concurrency/negative gates;
- real-store Closed Beta พิสูจน์ daily operation, delivery reliability, learning curve, support burden และ willingness-to-pay;
- payment events เปลี่ยน entitlement ผ่าน authoritative subscription transition domain เท่านั้น;
- staging/production, monitoring, backup+storage recovery, rollback, incident/support และ reconciliation ถูกทดลองจริง;
- Terms/Privacy/DPA/subprocessors, retention/DSAR, legal operator, brand/channel และ support promises ตรงกับระบบจริง;
- ไม่มี unresolved CRITICAL/HIGH และไม่มี MEDIUM ที่ไม่ได้รับ explicit acceptance;
- independent launch review และ owner GO ผ่าน.

## 2. Priority correction

Warm Hospitality สำคัญต่อความน่าใช้ แต่ **ไม่ใช่ critical path แรกของ paid readiness**. ลำดับคือ Phase 13 verification → staging/operations → real-store beta → commercial/payment contract → payment integration → paid launch. Redesign ทำคู่ขนานได้เฉพาะเมื่อไม่แตะ business logic, RLS, schema, queue, entitlement และไม่แย่ง verification capacity.

## 3. Invariants

- ไม่บังคับ Windows Docker; ใช้ GitHub Actions ephemeral Ubuntu และ isolated Supabase test/staging.
- ห้ามใช้ production data แทน test environmentหรือ destructive reset production.
- Payment webhook ห้ามเขียน raw subscription state โดยตรง.
- Module Hub เป็น read-only/copy-and-own; adapter ห้ามแทน Pawstia tenant-scoped Postgres authority.
- Starter = 10 rooms / 300 current pets; Pro/Enterprise/valid Founding Member unlimited ตาม contract ปัจจุบัน.
- Per-shop LINE credentials ต้อง server-only; ห้ามอ้าง Vault จน implement/verify จริง.
- Public media, retention, DSAR และ vendor-transfer claims ต้องผ่าน risk/legal reviewก่อนขาย.

## 4. Execution tickets

### PS-SR-01 — Close Phase 13 independently

รัน clean migration replay; 9→10→11 rooms; 299→300→301 pets; concurrent quota races; CSV over-quota atomic rollback/duplicates; full lifecycle/timing; tenant/role negatives; audit immutability; Pro/Enterprise/Founding unlimited; Phase 9/12/full regressions. ต้องมี CI/staging outputs, `PHASE13_IMPLEMENTATION_EVIDENCE.md`, diff/security scan และ independent PASS. Missing DB gate = BLOCKED.

### PS-SR-02 — Warm Hospitality presentation pass

ทำตาม approved brief/reference โดย freeze business/schema/RLS/entitlement. Gate: TypeScript/lint/build, Phase 10 E2E, multi-viewport Playwright/manual, accessibility/loading/error states, BOM/diff scan และ independent visual/behavior review. Ticket นี้ห้ามประกาศ Phase 13/production ready.

### PS-SR-03 — Staging and release engineering

สร้าง isolated Supabase staging, separate credentials, migration pipeline, versioned release, environment inventory, deploy/rollback, test tenancy, CI gates และ release record. Gate: bootstrap from zero, migration replay, rollback rehearsal, two-tenant smoke, secrets scan และ named release owner.

### PS-SR-04 — Observability, delivery and data recovery

ครอบคลุม app/DB/auth/storage, LINE queue/retry/dead-letter/reconciliation, Sheets backlog/recovery, audit/log correlation, DB+media backup, restore drill และ incident runbook. Gate: injected failures produce safe actionable signals; duplicate/timeout/restart recovery; proven RPO/RTO; incident drill.

### PS-SR-05 — Privacy/legal/support operations lock

ล็อก legal operator, Terms, Privacy, DPA, verified subprocessors/regions/transfers, public-media risk, retention/termination, DSAR/export/delete, breach process, support channel/hours/escalation, formal brand/trademark และ production channels. ต้องมี external/legal reviewเมื่อจำเป็น และ staging procedure exercise.

### PS-SR-06 — Controlled real-store Closed Beta

เริ่ม 1 ร้าน แล้ว 3/5/10 หลัง cohort gate: ทดสอบ import, booking, check-in/out, Daily Report, LINE, Sheets, LIFF, roles, support/recovery. วัด onboarding time, booking failures, LINE success/retry, Sheets recovery, staff learning, support burden, usage, incidents และ willingness-to-pay. ทุก cohort ต้องมี go/hold/rollback decision.

### PS-SR-07 — Commercial lifecycle and payment contract lock

ล็อก provider/rail, trial expiry, upgrade/downgrade, suspension/reactivation, monthly/yearly renewal, Founding continuity, cancel/refund/proration, failed payment/grace, invoice/tax responsibility, reconciliation และ offboarding/export/retention. ต้องมี approved transition table mapping every event to one authoritative transition.

### PS-SR-08 — Payment collection integration

ทำ checkout/admin flow, signed webhook validation, atomic unique-event claim, processing states, retry/lease/dead-letter, authoritative transition RPC, audit, refund/cancel และ operator reconciliation. Gate: provider sandbox E2E; duplicate/concurrent/non-consecutive replay (`A → B → A`); out-of-order, timeout/retry, payment-success/transition-failure, refund/cancel mismatch; cross-tenant/role negatives; no raw writes.

### PS-SR-09 — Paid production launch gate

ต้องผ่าน staging rehearsal, production migration/deploy/rollback plan, controlled real payment/refund เมื่ออนุมัติ, alerts, DB+media recovery, LINE/Sheets failure drill, staffed support/reconciliation, legal/brand/channel complete, independent code/security/operations review และ owner GO.

### PS-SR-10 — Progressive commercial rollout

ขยาย founding store → small cohort → 10 stores ตาม observed health/support/billing evidence. SEV-1, data-integrity, cross-tenant หรือ billing-authority failure ต้องหยุด expansion และเข้า rollback/incident process.

## 5. Global verification

ทุก ticket ต้องบันทึก HEAD/base, environment, migrations, files, commands/outputs, manual checks, limitations, diff/security scan, reviewer และ verdict. Static tests แทน migration replay, RLS, concurrency, provider-backed behavior, production smoke, restore หรือ real-store acceptance ไม่ได้.

## 6. Immediate next action

ทำ **PS-SR-01 ก่อน**. PS-SR-02 ทำได้เฉพาะ behavior-frozen track. ห้ามเริ่ม payment integration จน Closed Beta evidence และ PS-SR-07 approved.
