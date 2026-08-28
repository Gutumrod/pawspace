# 📋 Pawstia PMS — Product Requirement Document (PRD) (V1 Lean MVP)

> **Document Status:** Authoritative Target Contract (Final Hardened Edition)
> **Product Scope:** Pet Hotel & Pet Daycare Management OS (Single-Store Focus)
> **Brand identity:** Commercial candidate `Pawstia PMS`; legacy/internal repository identity remains `PawSpace` / `PS01` pending a dedicated brand-migration pass.
> **Target Release:** Sprint 1–2 (Lean MVP)
> **Authored By:** Antigravity (for CEO: Khun Free)

---

## 1. ปัญหาและตำแหน่งผลิตภัณฑ์ (Problem & Positioning)

### นิยามตำแหน่งผลิตภัณฑ์ (Authoritative Positioning Statement)
> **"Pawstia PMS คือ Pet Hotel OS ที่จัดการห้อง การเข้าพัก และ Daily Care Report ผ่าน LINE โดยร้านยังมีสำเนาส่งออกของข้อมูลลูกค้าและรายการจองอยู่ใน Google Sheets"**

### ปัญหาหลักที่แก้ใน V1:
1. **การจองห้องชนกัน (Double Booking):** การจดลงสมุดหรือ Excel เสี่ยงต่อการรับสัตว์เลี้ยงซ้ำห้องในช่วงเทศกาล
2. **ภาระการส่งรายงานประจำวัน (Daily Care Report Chaos):** พี่เลี้ยงต้องใช้แชทส่วนตัวส่งรูปน้องให้เจ้าของทีละคน วุ่นวาย รูปกระจัดกระจาย และไม่มีบันทึกย้อนหลัง
3. **ความกลัวข้อมูลสูญหาย (Data Lock-in Fear):** ร้านค้าไม่กล้าใช้ซอฟต์แวร์ใหม่เพราะกลัวข้อมูลประวัติติดอยู่ในระบบ

---

## 2. ขอบเขตโครงการและข้อกำหนด Non-Goals (Scope & Boundaries)

### 🎯 เป้าหมายหลักของ V1 (V1 Goals)
* **Goal 1 (Operations):** พนักงานหน้าร้านจัดการการจอง เช็คอิน เช็คเอาท์ และควบคุมสถานะห้องพักผ่าน **Authoritative Security Definer RPCs** โดยมี Database Constraints และ Deterministic Lock Ordering คุ้มกันไม่ให้เกิดการจองซ้อนทั้งระดับห้องและระดับสัตว์เลี้ยง
* **Goal 2 (Daily Care Report):** พนักงานถ่ายรูป (1–4 รูป) และส่ง Daily Report (กิน/ขับถ่าย/อารมณ์ + รูป) เข้า LINE เจ้าของสัตว์ได้ภายใน **ไม่เกิน 15 วินาทีต่อตัว** พร้อมระบบ Dual Idempotency (`idempotency_key` และ `X-Line-Retry-Key`) และรูปภาพเปิดดูได้ตลอดอายุการใช้งานของข้อมูล
* **Goal 3 (Data Ownership):** ข้อมูลลูกค้าและรายการจองถูกส่งออกเป็นสำเนา (One-way Export Replica) ลง Google Sheets ของร้านค้าตามโมเดล Pet-Centric (`Record_ID = pet_id`)

### 🚫 สิ่งที่อยู่นอกขอบเขต V1 อย่างเด็ดขาด (Explicit Non-Goals)
1. **ไม่ทำระบบคลินิกรักษา/คลังยา (Clinic & Pharmacy):** เป็น Medical workflow ที่ซับซ้อนเกินไป
2. **ไม่ทำระบบคิวกรูมมิ่ง (Grooming Queue):** กรูมมิ่งเป็นเรื่อง Resource/Stylist Scheduling คนละแบบกับ Room Matrix
3. **ไม่ทำระบบตรวจสลิป/บิลอัตโนมัติ (SlipOK / Billing Automation / e-Tax):** ยกไป future paid-launch/add-on stage หลัง Core Loop นิ่ง
4. **ไม่ทำ Google Drive Photo Sync ใน V1:** เก็บรูปใน Supabase Storage Bucket ก่อนใน MVP Google Drive ยังเป็น future commercial-stage capability
5. **ไม่ทำ Digital Pet Passport และ Full RTSP/HLS Multi-Camera Platform ใน V1:** Engineering Phase 8 มี bounded visitor-camera access แบบ tenant-scoped แล้ว; advanced multi-camera streaming/bridge ยังเป็น future expansion
6. **ไม่ทำระบบควบคุมหลายสาขา (Multi-Branch Control):** รองรับเฉพาะร้านสาขาเดี่ยวใน V1 Multi-Branch ยังเป็น future expansion

---

## 3. The Core Daily Loop

```
[1. สัตว์เลี้ยงเข้าพัก] ──► [2. ผังห้องไม่ชน] ──► [3. ดูข้อมูลอาหาร/ยา] ──► [4. ส่ง Daily Report 15 วิ] ──► [5. เจ้าของได้ LINE]
```

---

## 4. ข้อกำหนดฟังก์ชันและสัญญาทางสถาปัตยกรรม (Authoritative Target Contracts)

### V1 Business Date Semantics
* วันที่เช็คอิน, `report_date` และ maintenance calendar ใช้ `Asia/Bangkok` เป็น business timezone ใน V1
* ห้ามใช้ PostgreSQL session `CURRENT_DATE` ตรง ๆ เพราะ Supabase อาจรัน session เป็น UTC และทำให้ช่วง 00:00–06:59 เวลาไทยคลาดหนึ่งวัน

### 🔴 หมวดที่ 1: การจอง กรรมสิทธิ์ และ Concurrency Control

#### 1. Authoritative Booking Creation & Direct Mutation Lock
* **การสร้างการจอง (`create_booking` RPC):**
  * ปิดกั้น Direct Client INSERT บนตาราง `bookings`
  * การสร้างการจองต้องผ่าน RPC `create_booking()` ซึ่งจะกำหนด `shop_id = current_staff_shop_id()` และ `booking_status = 'confirmed'` เสมอ
  * ตรวจสอบว่า Owner และ Room อยู่ใน Shop เดียวกัน, วันที่ถูกต้อง (`check_out > check_in`), และห้องไม่ติดช่วงเวลา Maintenance
  * Maintenance window ต้องเป็นทั้งคู่ NULL หรือทั้งคู่มีค่าและ `maintenance_until >= maintenance_from`; partial-NULL ถูกปฏิเสธ
  * การเริ่ม Maintenance ที่ครอบคลุมวันปัจจุบันห้ามเขียนทับห้องสถานะ `occupied` หรือ `cleaning`; ห้อง `cleaning` ต้องผ่าน `mark_room_clean()` ก่อนเสมอ
* **Strict Same-Owner Invariant (Decision 1A):**
  * สัตว์เลี้ยงทุกตัวใน Booking เดียวกัน **ต้องเป็นของเจ้าของ (`booking.owner_id`) คนเดียวกันเท่านั้น**
  * ตรวจสอบใน `add_pet_to_booking` หากไม่ตรงกันระบบจะปฏิเสธทันที
  * `bookings.owner_id` เป็นฟิลด์ **Immutable (ห้ามแก้ไขหลังสร้าง)**
* **Pet Owner Mutation Lock:**
  * Browser ไม่มี Generic Pet UPDATE; การย้าย owner ต้องผ่าน `transfer_pet_owner()` (Manager/Owner) และห้ามทำขณะมี Active Booking (`confirmed`, `checked_in`) โดย Trigger เป็น DB-level backstop

#### 2. Concurrency-Safe Pet No-Overlap (Decision 2A) & Deterministic Lock Ordering
* **กฎ:** สัตว์เลี้ยงตัวเดียวกัน **ห้ามมี Active Booking (`confirmed`, `checked_in`) ซ้อนทับกันในช่วงวันเดียวกัน** แม้จะอยู่คนละห้องก็ตาม
* **Deterministic Global Lock Ordering Contract:**
  * ทุก Booking-aggregate Mutation RPC ที่แตะหลาย entity ต้อง Acquire Lock ตามลำดับเดียวกันเสมอเพื่อป้องกัน Deadlock:
    1. **Lock Booking:** `SELECT ... FROM bookings WHERE id = p_booking_id FOR UPDATE;`
    2. **Lock Pets:** `SELECT ... FROM pets WHERE id IN (...) ORDER BY id FOR UPDATE;` (Sort ตาม Pet UUID)
    3. **Lock Room:** `SELECT ... FROM rooms WHERE id = p_room_id FOR UPDATE;`
* **Pet No-Overlap Serialization:**
  * ใน RPC `add_pet_to_booking` ระบบจะ Lock แถวของสัตว์เลี้ยงก่อนตรวจสอบ Overlap ทำให้คำขอจองสัตว์ตัวเดียวกันในเวลาเดียวกันถูกจัดคิวอย่างปลอดภัย (Deterministic 1 ผ่าน, 1 ถูกปฏิเสธ)

#### 3. Authoritative Booking State Machine & Operational Check-In (Decision A1 & 3A)
วงจรสถานะการจองถูกล็อกแบบ Strict Linear Lifecycle:

```
[confirmed] ───────► [checked_in] ───────► [checked_out] (Terminal)
     │
     └─────────────► [cancelled] (Terminal)
```

* **กติกาการเปลี่ยนสถานะ (`update_booking_status` RPC):**
  1. `confirmed ➔ checked_in`:
     * **Decision A1:** ตรวจสอบ `pawspace_business_date() = check_in_date` โดย V1 ใช้เขตเวลา `Asia/Bangkok` (หากมาก่อนเวลา ต้องแก้กำหนดการผ่าน RPC `update_booking_schedule()` ก่อน)
     * **Room State:** ห้องพักต้องมีสถานะเป็น `available` เท่านั้น (หากเป็น `occupied`, `cleaning`, หรือ `maintenance` จะถูกปฏิเสธทันที)
     * **Membership:** Booking ต้องมีสัตว์เลี้ยงลงทะเบียนไว้อย่างน้อย 1 ตัว (`>= 1 Pet`)
     * เมื่อสำเร็จ ➔ `bookings.booking_status = 'checked_in'`, `rooms.status = 'occupied'`
  2. `checked_in ➔ checked_out`:
     * ทำได้ทุกเวลา ➔ `bookings.booking_status = 'checked_out'`, `rooms.status = 'cleaning'`
  3. `confirmed ➔ cancelled`:
     * ทำได้เฉพาะก่อนเช็คอิน ➔ ปล่อยห้องและสัตว์เลี้ยงทันที
  4. **ข้อห้ามเด็ดขาด (Illegal Transitions):**
     * ห้ามกดยกเลิกหลังเช็คอินแล้ว และห้ามย้อนสถานะกลับทุกกรณี
* **การแก้ไขกำหนดการจอง (`update_booking_schedule` RPC):**
  * อนุญาตให้แก้ไขวันเข้าพัก/ย้ายห้องได้ **เฉพาะ Booking สถานะ `confirmed` เท่านั้น** (หาก `checked_in` แล้วจะถูกปฏิเสธ)
  * Re-validate Overlap, Maintenance Window, และ Room Capacity ซ้ำเสมอ

#### 4. Pet Removal (`remove_pet_from_booking` RPC)
* อนุญาตให้ถอดสัตว์เลี้ยงออกจาก Booking ได้ **เฉพาะ Booking สถานะ `confirmed` เท่านั้น** (ห้ามถอดออกขณะ `checked_in`, `checked_out`, หรือ `cancelled`)

---

### 🔴 หมวดที่ 2: Daily Care Report & LINE Delivery Lifecycle

#### 5. Multiple Daily Reports with Atomic Technical Idempotency (Decision 5A)
* ส่ง Daily Report ได้หลายครั้งต่อวันแบบ Uncapped
* Client ส่ง `idempotency_key` UUID v4; uniqueness เป็น `(shop_id, idempotency_key)` และเก็บ `request_fingerprint` ของ canonical payload เพื่อ reject การ reuse key เดิมกับข้อมูลคนละชุด
* `create_daily_report()` ต้องรองรับ concurrent duplicate แบบ atomic: สร้างได้เพียง 1 row, caller ทุกตัว resolve เป็น report เดิม, ไม่มี unhandled unique violation และไม่มี LINE job ซ้ำ
* การสร้าง report ต้อง serialize กับ Booking lifecycle โดย lock Booking ก่อนตรวจ `checked_in`; ห้ามเกิด stale report commit หลัง concurrent checkout

#### 6. DB-Level Daily Report Membership Integrity
* `daily_reports(shop_id, booking_id, pet_id)` ต้อง FK ไป `booking_pets(shop_id, booking_id, pet_id)`
* Report สร้างได้เฉพาะ Pet ที่อยู่ใน Booking นั้นจริง และต้องมีรูป 1–4 รูปตาม canonical statuses ใน PRD

#### 7. Authoritative Creation & LINE Delivery Lifecycle
* Browser ห้าม INSERT/UPDATE `daily_reports` โดยตรง
* `create_daily_report()` กำหนด `pending`, retry count 0 และ persistent `line_delivery_retry_key`
* Worker claim `pending -> sending` แบบ atomic พร้อม `line_delivery_started_at`; success/duplicate-accepted -> `sent`; failure -> `failed` + retry count/error; stale `sending` เกิน lease window ต้องกู้ด้วย retry key เดิม
* Manual retry ต้องผ่าน `retry_daily_report_delivery()` เฉพาะ `failed -> pending` และ **reuse retry key เดิม** ทุกครั้ง
* worker crash หลังส่งแต่ก่อน mark sent ต้อง recover/retry ด้วย key เดิมเพื่อไม่ให้ลูกค้าได้ข้อความซ้ำ
* รูปภาพอยู่ตาม Media Retention Policy เดิม (30 วันหลังสิ้นสุดสัญญา)

#### 8. LINE Identity Isolation & LIFF Claim Flow (Decision 6A)
* Browser ห้าม INSERT/UPDATE `pet_owners` โดยตรง; สร้างลูกค้าผ่าน `create_pet_owner()` ซึ่งกำหนด LINE identity fields เป็น NULL เอง
* `generate_line_claim_token(owner_id)` สร้าง token แบบสุ่ม, เก็บเฉพาะ SHA-256 hash, TTL 48 ชั่วโมง และห้าม log plaintext token
* `reset_line_link(owner_id)` เป็น Manager/Owner action สำหรับ re-link
* consume เป็น **server-only**: trusted LIFF/LINE backend ต้อง verify LINE-issued identity ก่อน แล้วเรียก internal consume function; Browser ส่ง `line_user_id` เองไม่ได้
* token หมดอายุ, ใช้ซ้ำ, หรือ expected shop ไม่ตรง ต้องถูกปฏิเสธแบบ atomic

---

### 🔴 หมวดที่ 3: ระบบผู้ใช้งาน สิทธิ์ และ Operational Cleaning

#### 9. Staff Authentication & Permission Matrix (Decision 7A, 8A, B1)
* V1 ใช้ Supabase Auth Email + Password
* staff ที่ `is_active=false` ต้องเสียสิทธิ์ DB/RPC ทันที แม้ Auth session เดิมยังไม่หมดอายุ
* Owner เท่านั้นที่ invite/disable/remove/change role ผ่าน trusted Staff Management Server Service
* ห้าม disable/remove/demote จนร้านไม่มี active owner เหลือเลย
* การสร้าง Shop + Owner คนแรกใช้ trusted tenant bootstrap service; Browser ไม่มี direct INSERT `shops/staff_users`

| Capability | owner | manager | staff | Authoritative Gateway |
| :--- | :---: | :---: | :---: | :--- |
| ดูข้อมูลร้าน/ห้อง/จอง/ลูกค้า | ✅ | ✅ | ✅ | SELECT RLS |
| สร้าง/แก้ booking และสถานะ | ✅ | ✅ | ✅ | Booking RPCs |
| เพิ่ม/ถอด Pet ใน Booking | ✅ | ✅ | ✅ | `add_pet_to_booking()` / `remove_pet_from_booking()` |
| Daily Report / manual retry | ✅ | ✅ | ✅ | `create_daily_report()` / `retry_daily_report_delivery()` |
| สร้าง/แก้ลูกค้าและ Pet | ✅ | ✅ | ✅ | `create_pet_owner()`, `create_pet()`, profile RPCs |
| ย้ายเจ้าของ Pet | ✅ | ✅ | ❌ | `transfer_pet_owner()` |
| ลบลูกค้า / Pet | ✅ | ✅ | ❌ | `delete_pet_owner()` / `delete_pet()` |
| สร้าง/แก้ Room config | ✅ | ✅ | ❌ | `create_room()` / `update_room_config()` |
| Maintenance | ✅ | ✅ | ❌ | `set_room_maintenance()` |
| Mark room clean | ✅ | ✅ | ✅ | `mark_room_clean()` |
| Reset LINE link | ✅ | ✅ | ❌ | `reset_line_link()` |
| จัดการ Staff/Role | ✅ | ❌ | ❌ | Owner Staff Management Server Service |
| Google Sheet connection | ✅ | ✅ | ❌ | proof-of-control server flow / `disconnect_google_sheet()` |

---

### 🔴 หมวดที่ 4: การซิงก์ข้อมูล Google Sheets และโมเดลราคา

#### 10. Google Sheets Verified Binding + System-Owned Transactional Outbox (Decision 9A)
* Browser อ่าน queue/mapping ได้ตาม RLS แต่ห้าม INSERT/UPDATE/DELETE โดยตรง
* การ bind Sheet ต้องเป็น proof-of-control: Manager/Owner ขอ nonce อายุ 15 นาที, วาง nonce ใน `PawSpace_Config!B1`, trusted server อ่าน cell จาก Sheet ID จริงและ verify requester/tenant ก่อนเรียก internal connect; Browser bind `google_sheet_id` ตรงไม่ได้
* `google_sheet_id` ต้อง unique ต่อระบบเพื่อห้าม Sheet เดียว bind หลาย tenant
* Authoritative business mutation ต้อง enqueue `sync_queue` **ใน transaction เดียวกัน**; enqueue fail = business mutation rollback
* Customers Sheet: 1 row = 1 Pet, `Record_ID = pet_id`; Bookings Sheet: `Record_ID = booking_id`
* verified connect ต้อง clear mapping เก่าและ seed full snapshot ของ Pets + Bookings
* Worker ใช้ `shops.google_sheet_id` ของ tenant และ Service Account จาก trusted secret/Vault; ห้ามใช้ global sheet target ใน production
* V1 worker concurrency = 1; claim ตาม retry/queue order, มี processing lease + stale recovery + bounded backoff, และทุก event re-read source-of-truth ก่อนเขียน Sheet; UPSERT ของ Pet ที่ถูกลบแล้วต้อง converge เป็น DELETE
#### 11. Pricing & Feature Gating Enforcement (Decision 10A & C2)
* **Historical commercial-stage intent:** ช่วงก่อน monetization เคยไม่บังคับ hard quota
* **Current implementation (Engineering Phase 13):** บังคับ authoritative quota แล้วที่ database boundary — Starter: 10 ห้อง / 300 pet records; Pro/Enterprise/valid Founding Member: unlimited
* **Decision C2:** Founding Member 10 ร้านแรก ได้รับสิทธิ์ **Pro Entitlement @ 990 บ./ด. ตลอดชีพ** ตราบเท่าที่ต่ออายุต่อเนื่อง (Non-transferable และไม่รวม Future Paid Add-ons)
