# 📊 PawSpace — Current Implementation Status & Codebase Reality

> **Last Verified:** 2026-08-20
> **Repository:** `Gutumrod/pawspace`
> **Branch:** `master`
> **Current Stage:** Phase 1 Schema Implemented (Untested Live) / Phase 2 Gateway Contract Documented / UI Preview
> **Architecture Review Gate:** **READY FOR DEEP IMPLEMENTATION — DOCUMENTATION CONTRACT ONLY**
> **Notice:** `SYSTEM_ARCHITECTURE.md` คือ Target Contract ที่ผ่าน review สำหรับเริ่มเขียน Target Migration แล้ว. Phase 1 schema (ตาราง/constraint/index) ถูก implement จริงใน migration แล้วและมี executable test file คู่กัน แต่ RPC/RLS/helper function/worker contract (Phase 2) ทั้งหมดยังเป็น `DOCUMENTED` และ **ยังไม่ live** จนกว่าจะมี migration แยกของ Phase 2 จริง

---

## Status Legend

* **`DOCUMENTED`** — Requirement/SQL contract ถูกนิยามใน PRD + SYSTEM_ARCHITECTURE แต่ยังไม่อยู่ใน migration ปัจจุบัน
* **`SCHEMA IMPLEMENTED`** — มี SQL อยู่ใน migration ปัจจุบัน แต่ไม่ได้หมายความว่า hardened target contract ใหม่ถูก implement แล้ว
* **`TEST WRITTEN — NOT YET RUN`** — มี executable test file ครอบคลุม capability นี้แล้ว แต่ยังไม่มีบันทึกว่ารันจริงกับฐานข้อมูลแล้วผ่าน
* **`UI PREVIEW`** — UI/interaction ใช้ mock data
* **`CODE FOUNDATION`** — มี project/helper/type foundation
* **`ADAPTER/STUB`** — มี interface/payload mock แต่ยังไม่มี live transport
* **`LIVE INTEGRATION`** — ต่อ third-party/database จริง
* **`VERIFIED`** — ผ่าน executable tests/E2E ตาม acceptance criteria แล้ว (ต้องมีบันทึกผลรันจริง ไม่ใช่แค่มีไฟล์ test)

---

## Repository vs Target Architecture Reality

| Component | Current Status | Reality |
| :--- | :---: | :--- |
| Application Foundation | `CODE FOUNDATION` | Next.js 16.3.1, React 19, Tailwind, TypeScript, pnpm |
| Operations Dashboard | `UI PREVIEW` | KPI / Room Matrix / Daily Report Drawer / Activity Feed ยังใช้ mock preview |
| Phase 1 Database Schema | `SCHEMA IMPLEMENTED` | `supabase/migrations/20260220000000_initial_schema.sql` — ตาราง 10 ตัว, exclusion constraint, composite FK tenant-isolation, CHECK constraints (photo count, maintenance window, sync_queue status/attempts), indexes. ตรงกับ `SYSTEM_ARCHITECTURE.md` §4 ทุก column ที่เทียบแล้ว |
| Phase 1 Executable Tests | `TEST WRITTEN — NOT YET RUN` | `supabase/tests/phase1_schema.sql` — 13 assertion ครอบคลุม cross-tenant FK, exclusion constraint (รวม cancelled-booking exemption), maintenance window partial-NULL rejection, daily-report membership FK, Asia/Bangkok business date default, 1–4 photo cardinality, idempotency key uniqueness, LINE retry key uniqueness, sync_queue status/attempts CHECK, และยืนยันว่า Phase 2 RPC/RLS ยังไม่หลุดเข้ามาใน Phase 1. **ยังไม่มีบันทึกว่ารันจริงกับ Postgres/Supabase แล้วผ่านทุกข้อ** — ต้องรันก่อนเลื่อนเป็น `VERIFIED` |
| Booking Gateways (`create_booking`, schedule/status RPCs) | `DOCUMENTED` | นิยามเต็มใน SYSTEM_ARCHITECTURE.md §6 พร้อม lock ordering แต่ไม่อยู่ใน migration ปัจจุบัน — Phase 1 test ยืนยันว่าตั้งใจไม่ให้อยู่ |
| Pet Assignment Concurrency (`add_pet_to_booking`, `remove_pet_from_booking`) | `DOCUMENTED` | Booking → Pets(sorted) → Room lock order, same-owner/no-overlap, confirmed-only removal — ยังไม่อยู่ใน migration |
| Room Gateways (`create_room`, config, maintenance, mark-clean) | `DOCUMENTED` | partial-NULL maintenance rejected ที่ระดับ RPC + DB CHECK (CHECK มีใน migration แล้ว, RPC logic ยังไม่มี) |
| Business Date Semantics | `SCHEMA IMPLEMENTED (default only)` | `daily_reports.report_date DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date)` มีใน migration แล้ว และมี test ยืนยัน; ฟังก์ชัน `pawspace_business_date()` ที่ RPC อื่นเรียกใช้ยังเป็น `DOCUMENTED` เท่านั้น |
| Daily Report Gateway (`create_daily_report`, delivery tracking) | `DOCUMENTED` | คอลัมน์รองรับ (`idempotency_key`, `request_fingerprint`, `line_delivery_*`) มีใน migration แล้ว แต่ RPC ที่เขียนคอลัมน์เหล่านี้อย่างถูกต้อง (dedup, fingerprint conflict, worker lease) ยังไม่อยู่ใน migration |
| Customer / Pet Gateways | `DOCUMENTED` | Browser generic DML ปิดตาม Phase 2 เท่านั้น; Phase 1 ยังไม่มี RLS เลยจึงยังไม่ได้ปิดจริง |
| LINE Claim Flow | `DOCUMENTED` | คอลัมน์ (`line_claim_token_hash`, `line_claim_expires_at`, `line_claim_used_at`) มีใน migration แล้ว; RPC 48h token/hash/single-use/cross-tenant-reject ยังไม่อยู่ใน migration |
| Staff / Tenant Bootstrap | `DOCUMENTED` | active-staff authorization, Owner-only management, last-active-owner invariant, trusted bootstrap service — ยังไม่มีโค้ด |
| Google Sheets Binding + Outbox | `DOCUMENTED` | ตาราง `google_sync_mappings`/`sync_queue` และคอลัมน์ lease/retry มีใน migration แล้ว; proof-of-control binding RPC, worker, transactional enqueue ยังไม่อยู่ใน migration |
| RLS + Table Privilege Lockdown | `DOCUMENTED` | **ยืนยันจากทั้ง migration และ test:** ไม่มี `ENABLE ROW LEVEL SECURITY` หรือ policy ใดๆ ใน Phase 1 migration ปัจจุบัน — ตั้งใจแยกไป Phase 2 ตามคอมเมนต์บรรทัดแรกของ migration |
| Security Definer Helper Functions (`current_staff_shop_id`, `is_shop_owner`, ฯลฯ) | `DOCUMENTED` | ยืนยันไม่มีใน migration ปัจจุบัน — Phase 1 test raise exception ถ้าเจอ |
| LINE Flex Message Adapter | `ADAPTER/STUB` | `lib/integrations.ts::sendDailyReport()` ปฏิเสธการยิงจริงเสมอ แม้ config ครบ (verified by reading source) |
| Google Sheets Adapter | `ADAPTER/STUB` | `lib/integrations.ts::enqueueSheetSync()` ปฏิเสธการยิงจริงเสมอ แม้ config ครบ (verified by reading source) |

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

ห้ามเปลี่ยน hardened components จาก `DOCUMENTED` เป็น implemented/verified จากเอกสารหรือรายงาน Agent เพียงอย่างเดียว. ต้องตรวจ migration/code จริงและ executable negative/concurrency tests ก่อนทุกครั้ง.

`TEST WRITTEN — NOT YET RUN` ไม่ใช่ `VERIFIED` — ต้องมีบันทึกผลรันจริง (เช่น `psql` output หรือ CI log) แนบก่อนเลื่อนสถานะ.
