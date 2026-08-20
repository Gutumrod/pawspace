# 📊 PawSpace — Current Implementation Status & Codebase Reality

> **Last Verified:** 2026-08-20 (Phase 1 + Phase 2 gateway/RLS/concurrency suites executed for real by Claude against a local Supabase/Postgres instance — not a static review)
> **Repository:** `Gutumrod/pawspace`
> **Branch:** `master`
> **Current Stage:** Phase 1 + Phase 2 schema/RPC/RLS layer implemented and executable-test-verified. Application layer (UI wiring, live integrations) still preview/stub.
> **Architecture Review Gate:** **PHASE 1 + PHASE 2 DATABASE LAYER VERIFIED — APPLICATION INTEGRATION NEXT**

---

## Status Legend

* **`DOCUMENTED`** — Requirement/SQL contract ถูกนิยามใน PRD + SYSTEM_ARCHITECTURE แต่ยังไม่อยู่ใน migration ปัจจุบัน
* **`SCHEMA IMPLEMENTED`** — มี SQL อยู่ใน migration ปัจจุบัน
* **`UI PREVIEW`** — UI/interaction ใช้ mock data
* **`CODE FOUNDATION`** — มี project/helper/type foundation
* **`ADAPTER/STUB`** — มี interface/payload mock แต่ยังไม่มี live transport
* **`LIVE INTEGRATION`** — ต่อ third-party/database จริง
* **`VERIFIED`** — ผ่าน executable tests ที่รันจริงกับฐานข้อมูลจริงแล้ว (มีบันทึกผลรันจริงแนบ ไม่ใช่แค่มีไฟล์ test หรือรายงานจาก Agent)

---

## Repository vs Target Architecture Reality

| Component | Current Status | Reality |
| :--- | :---: | :--- |
| Application Foundation | `CODE FOUNDATION` | Next.js 16.3.1, React 19, Tailwind, TypeScript, pnpm |
| Operations Dashboard | `UI PREVIEW` | KPI / Room Matrix / Daily Report Drawer / Activity Feed ยังใช้ mock preview ไม่ได้ต่อกับ RPC layer ด้านล่างนี้จริง |
| Database Schema (Phase 1 + Phase 2) | `VERIFIED` | `supabase/migrations/20260220000000_initial_schema.sql` + `20260820020000_phase2_authoritative_gateways.sql` ทั้งคู่ apply สำเร็จบน Postgres 17.6.1.106 จริง (`supabase db reset`, `supabase db lint --local` → no schema errors) |
| Phase 1 Negative Tests (`phase1_schema.sql`) | `VERIFIED` | รันจริงกับ migration 1 แบบแยกเดี่ยว: ครบ 13 assertion ผ่านหมด รวมถึงยืนยันว่า Phase 2 ไม่หลุดเข้ามาใน migration 1 จริง |
| Phase 2 RPC/RLS Negative Tests (`phase2_rpc_rls.sql`) | `VERIFIED` | รันจริงกับ migration รวม: function ครบ 19 ตัว, ไม่มี DML grant หลุดให้ `authenticated`, direct-INSERT ถูก block จริง, cross-tenant/wrong-owner ถูกปฏิเสธจริง, capacity/transfer/state-machine/immutable owner_id ผ่านจริง, forced-outbox-failure rollback จริง, disabled-staff เสีย RLS visibility จริง — exit 0, ตรวจ container log แล้วไม่มี crash |
| Same-Pet Overlap Concurrency | `VERIFIED` | รัน 2 worker พร้อมกันจริงผ่านคนละ DB session: 1 คำขอสำเร็จ อีกคำขอโดน `Pet Conflict` จริง, verify เหลือ assignment แถวเดียวจริง |
| Daily Report Duplicate Idempotency Concurrency | `VERIFIED` | รัน `create_daily_report` เดียวกัน (idempotency key เดียวกัน) พร้อมกัน 2 session จริง: ทั้งคู่ได้ `report_id` เดียวกันจริง |
| Daily Report vs Checkout Race | `VERIFIED` | รัน checkout (`update_booking_status → checked_out`) แข่งกับ `create_daily_report` จริงผ่าน `FOR UPDATE` + `pg_sleep`: checkout ชนะจริง, report ที่ตามหลังถูก reject จริงด้วย "Booking is currently checked_out", ไม่มี stale report ถูก commit |
| Booking Gateways (`create_booking`, schedule/status RPCs) | `VERIFIED` | ครอบคลุมโดย `phase2_rpc_rls.sql` ด้านบน |
| Pet Assignment Concurrency (`add_pet_to_booking`, `remove_pet_from_booking`) | `VERIFIED` | ครอบคลุมโดย same-pet concurrency test ด้านบน |
| Room Gateways (`create_room`, config, maintenance, mark-clean) | `SCHEMA IMPLEMENTED` | มีใน migration และผ่าน static/lint แล้ว แต่ยังไม่มี negative test เจาะจงแยกสำหรับ maintenance-window edge case ในชุดที่รันจริงรอบนี้ |
| Business Date Semantics (`pawspace_business_date()`) | `VERIFIED` | ใช้จริงในทุก RPC ที่ทดสอบด้านบน (check-in date gate, maintenance state, report_date default) ผ่านจริงในทุก test |
| Daily Report Gateway (`create_daily_report`, delivery tracking) | `VERIFIED` (create + idempotency + checkout-race) | worker lease/retry (`retry_daily_report_delivery`, stale `sending` recovery) ยังไม่มี test แยกในรอบนี้ — ยังเป็น `DOCUMENTED` เฉพาะส่วนนั้น |
| Customer / Pet Gateways | `VERIFIED` (core creation/cross-tenant paths) | ครอบคลุมโดย `phase2_rpc_rls.sql`; `delete_pet`/`delete_pet_owner`/`transfer_pet_owner` เจาะจงยังไม่มี negative test แยก |
| LINE Claim Flow | `DOCUMENTED` | RPC มีใน migration แต่ยังไม่มี test file แยกสำหรับ TTL/hash/single-use/cross-tenant-reject ในรอบนี้ |
| Staff / Tenant Bootstrap | `DOCUMENTED` | ยังไม่มี test |
| Google Sheets Binding + Outbox | `SCHEMA IMPLEMENTED` | ตารางและ `enqueue_sync_event` ผ่าน permission test แล้ว (`has_function_privilege` check) แต่ proof-of-control binding flow และ worker เองยังไม่มี test |
| RLS + Table Privilege Lockdown | `VERIFIED` | ยืนยันจริงจาก `phase2_rpc_rls.sql`: ไม่มี DML grant หลุด, disabled staff เสีย visibility จริง |
| LINE Flex Message Adapter | `ADAPTER/STUB` | `lib/integrations.ts::sendDailyReport()` ปฏิเสธการยิงจริงเสมอ แม้ config ครบ |
| Google Sheets Adapter | `ADAPTER/STUB` | `lib/integrations.ts::enqueueSheetSync()` ปฏิเสธการยิงจริงเสมอ แม้ config ครบ |

---

## Known bug found and fixed during this verification pass

`supabase/tests/phase2_rpc_rls.sql` originally called a `REVOKE`d `SECURITY DEFINER` function from a PL/pgSQL `DO` block and caught `insufficient_privilege` to assert the permission was denied. That exact pattern **segfaults this Postgres build** (`supabase/postgres:17.6.1.106`, signal 11), confirmed reproducible 3 times independently before the fix. Fixed by switching to the already-working static-check pattern (`has_function_privilege(...)`) used elsewhere in the same file. Re-verified clean (exit 0, no crash in container logs) after the fix. See `BRIEF-phase2-crash-fix-2026-08-20.md` for the original repro.

Separately, `enqueue_sync_event`'s `digest()` call needed to be schema-qualified as `extensions.digest()` — with `search_path` locked to `public, pg_temp` inside `SECURITY DEFINER` functions, the unqualified call couldn't resolve `pgcrypto`'s function. Fixed and re-verified.

---

## Integration Boundary Warning

Global env ใน `.env.example` / `lib/integrations.ts` เช่น `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TARGET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID` เป็น **preview-only** และห้ามใช้เป็น production multi-tenant contract.

Production target ต้อง:
1. LINE secret เป็น per-shop trusted secret/Vault
2. Google Sheet target ใช้เฉพาะ `shops.google_sheet_id` ที่ผ่าน trusted proof-of-control binding ของ tenant แล้ว; Browser ห้าม bind Sheet ID โดยตรง
3. LINE recipient ใช้ verified `pet_owners.line_user_id`
4. Browser ห้ามถือ `service_role` หรือ integration secret

---

## Promotion Rule

ห้ามเปลี่ยน hardened components จาก `DOCUMENTED` เป็น implemented/verified จากเอกสารหรือรายงาน Agent เพียงอย่างเดียว. ต้องตรวจ migration/code จริงและ executable negative/concurrency tests ก่อนทุกครั้ง — รอบนี้ Claude รันทุก test เองจริงกับ Postgres 17.6.1.106 ผ่าน Docker/Supabase CLI local stack ก่อนจะ mark `VERIFIED` ในตารางด้านบน ไม่ได้เชื่อจากรายงานเพียงอย่างเดียว.
