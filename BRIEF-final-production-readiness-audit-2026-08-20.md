# 🛡️ PawSpace — Final Architecture Review Gate

> **Date:** 2026-08-20
> **Repository:** `Gutumrod/pawspace`
> **Local Path:** `D:\AI-Workspace\projects\saas-product-hub\products\PawSpace`
> **Scope of this gate:** Documentation Target Contract only
> **Final Verdict:** **READY FOR DEEP IMPLEMENTATION — TARGET MIGRATION MAY START**

---

## What this verdict means

`READY FOR DEEP IMPLEMENTATION` หมายถึง PRD + SYSTEM_ARCHITECTURE มี contract เพียงพอให้ Coding Agent เริ่มเขียน **Target Migration ก้อนแรก** โดยไม่ต้องเดา security/invariant หลัก. Final mechanical sweep ผ่านแล้ว แต่ verdict นี้ยังเป็นเฉพาะ Architecture/Documentation Gate ไม่ใช่ production readiness.

ไม่ได้หมายความว่า repository ปัจจุบัน production-ready. Hardened RPC/RLS/constraints/workers ยังเป็น `DOCUMENTED` จนกว่า migration/code/tests จริงจะถูกสร้างและตรวจไฟล์จริง.

---

## Reviewer Corrections Applied

รอบนี้ Reviewer แก้ไฟล์จริงโดยตรงและปิดช่องว่างที่ยังเหลือจาก audit ก่อนหน้า:

1. **Zero Generic Browser DML** — revoke INSERT/UPDATE/DELETE บน business tables และเหลือ SELECT RLS + authoritative RPC/server services
2. **Customer/LINE creation bypass** — `pet_owners` สร้างผ่าน `create_pet_owner()` เท่านั้น; LINE identity fields system-controlled
3. **Pet mutation surface** — create/update/transfer/delete แยก gateway; owner reassignment ห้ามระหว่าง active booking
4. **Room creation/config/maintenance** — authoritative gateways; partial-NULL maintenance ถูก reject ทั้ง schema/RPC
5. **Maintenance lifecycle + stale state** — partial-NULL ถูกปิด; ห้ามเริ่ม maintenance วันนี้ขณะห้อง `cleaning`/`occupied`; check-in self-heal stored `maintenance` ที่หมดช่วงแล้วโดยไม่ bypass `mark_room_clean()`
6. **Business timezone** — V1 business date ใช้ `Asia/Bangkok`; `report_date` และ check-in ไม่อิง DB session `CURRENT_DATE`
7. **Daily Report vs Checkout race** — lock Booking ก่อน validate `checked_in`
8. **Atomic report idempotency** — `(shop_id,idempotency_key)` + `request_fingerprint` + conflict convergence; key reuse กับ payload ต่างกันถูก reject
9. **LINE retry lifecycle** — persistent `line_delivery_retry_key`; `line_delivery_started_at` เป็น worker lease/recovery timestamp; manual retry/recovery reuse key เดิมและ reset lease state อย่างชัดเจน
10. **LINE claim hardening** — random token, SHA-256 hash-at-rest, TTL 48h, single-use, trusted server identity verification, internal consume เป็น service-role-only
11. **Disabled staff enforcement** — helper ทุกตัว require `is_active=true`; session เก่าของ disabled staff ใช้งาน DB/RPC ไม่ได้
12. **Owner-only staff management** — trusted server service + last-active-owner invariant + cross-tenant rejection
13. **Tenant bootstrap** — first Shop/Owner provisioning เป็น trusted server action; Browser insert `shops/staff_users` ไม่ได้
14. **Google Sheets proof-of-control binding + transactional outbox** — Browser bind Sheet ID ตรงไม่ได้; trusted server verify per-shop nonce ใน Sheet ก่อนเรียก internal service-role bind; `google_sheet_id` unique ข้าม tenant; หลัง verified bind จึง seed full snapshot และ business mutation + enqueue อยู่ transaction เดียวกัน
15. **V1 Sheet worker ordering/recovery** — concurrency=1, queue order deterministic, `processing_started_at` + `next_attempt_at` เป็น lease/backoff metadata, stale `processing` recover ได้, re-read source before external write, deleted Pet converges to DELETE
16. **Table privilege defense-in-depth** — ไม่มี mutation RLS policy และมี explicit table DML revoke สำหรับ Browser roles
17. **Canonical schema hardening** — role/status/counter fields สำคัญเป็น `NOT NULL`; LINE/Sync worker state มี explicit lease/recovery metadata
18. **SQL document integrity** — function dollar-quoting เคยตรวจสมดุลแล้ว และ trigger helper ถูก revoke direct execute; จะตรวจซ้ำอีกครั้งใน final mechanical sweep

---

## Locked Mutation Surface

| Entity | Browser DML | Target mutation path |
| :--- | :---: | :--- |
| `shops` | ❌ | profile RPC; Google Sheet bind ผ่าน proof-of-control trusted server flow; subscription system-owned |
| `staff_users` | ❌ | trusted Owner-only staff service |
| `pet_owners` | ❌ | create/profile/delete + LINE claim/reset gateways |
| `pets` | ❌ | create/profile/transfer/delete gateways |
| `rooms` | ❌ | create/config/maintenance/clean gateways |
| `bookings` | ❌ | create/schedule/status RPCs |
| `booking_pets` | ❌ | add/remove RPCs |
| `daily_reports` | ❌ | create/retry RPCs; delivery fields worker-owned |
| `google_sync_mappings` | ❌ | worker-owned |
| `sync_queue` | ❌ | internal outbox + worker-owned |

---

## Architecture Gate Acceptance

ก่อนเริ่ม Target Migration ตรวจแล้วว่า:

- Source-of-truth hierarchy ไม่ขัดกับ decisions 1–10 / A1 / B1 / C2
- no known Browser invariant mutation bypass เหลือใน Target Contract
- booking/pet concurrency มี deterministic lock contract
- daily report creation serialize กับ checkout และ concurrent idempotency มี defined behavior
- LINE identity/retry boundaries แยก Browser vs trusted server/worker ชัด
- Google Sheets bind มี proof-of-control + unique tenant binding; sync มี transactional outbox, worker lease/retry และ V1 ordering contract
- current repository reality ยังถูกระบุเป็น baseline/documented ไม่หลอกว่า implementation มีแล้ว

---

## Final Mechanical Checks — PASSED

- trailing whitespace / conflict-marker check: passed
- `git diff --check`: passed
- SQL function/dollar-quote/search-path/privilege counts: passed
- Browser mutation policy scan: passed
- internal-only service-role grants: passed
- non-document change check: passed (`README.md` + Markdown docs only; no code/migration/config changed)

---

## Next Phase (after final sweep passes)

ให้เริ่ม **Phase 1: Target Database Migration + Executable DB Tests** เท่านั้นก่อน.

Coding Agent ต้อง implement จาก `docs/SYSTEM_ARCHITECTURE.md` โดยไม่ redesign product decisions และต้องส่งกลับ:

1. migration files จริง
2. SQL/RPC/RLS diff
3. executable negative/concurrency tests
4. test output
5. git status/diff

Reviewer ต้องเปิดไฟล์จริงตรวจอีกครั้งก่อนปล่อย Auth/Backend/UI phase ต่อไป.
