# 📋 PawSpace — Product Requirement Document (PRD) (V1 Lean MVP)

> **Document Status:** Locked & Production-Ready (Single Source of Truth)  
> **Product Scope:** Pet Hotel & Pet Daycare Management OS  
> **Target Release:** Sprint 1–2 (Lean MVP)

---

## 1. ปัญหาและตำแหน่งผลิตภัณฑ์ (Problem & Positioning)

### นิยามผลิตภัณฑ์ (Positioning Statement)
> **"PawSpace คือ Pet Hotel OS ที่จัดการห้อง การเข้าพัก และ Daily Care Report ผ่าน LINE โดยร้านยังมีสำเนาส่งออกของข้อมูลลูกค้าและรายการจองอยู่ใน Google Sheets"**

### ปัญหาที่แก้ใน V1:
1. **การจองห้องชนกัน (Double Booking):** การจดลงสมุดหรือ Excel เสี่ยงต่อการรับหมาแมวซ้ำห้องในช่วงเทศกาล
2. **ภาระการส่งรายงานประจำวัน (Daily Report Chaos):** พี่เลี้ยงต้องใช้แชทส่วนตัวส่งรูปน้องให้เจ้าของทีละคน วุ่นวายและรูปกระจัดกระจาย
3. **ความกลัวข้อมูลสูญหาย (Data Lock-in):** ร้านค้าไม่กล้าใช้ซอฟต์แวร์ใหม่เพราะกลัวข้อมูลประวัติติดอยู่ในระบบ

---

## 2. ขอบเขตโครงการ (Scope Lock)

### 🎯 เป้าหมายของ V1 MVP (Goals)
* **Goal 1:** พนักงานหน้าร้านบันทึกการจอง เช็คอิน เช็คเอาท์ และเปลี่ยนสถานะทำความสะอาดห้องได้แบบไร้รอยต่อ โดยมี DB Engine คุ้มกันไม่ให้ห้องชนกันที่ระดับฐานข้อมูล
* **Goal 2:** พนักงานถ่ายรูป (1–4 รูป) และส่ง Daily Report (กิน/ขับถ่าย/อารมณ์) เข้า LINE เจ้าของสัตว์ได้ภายใน **ไม่เกิน 15 วินาทีต่อตัว** พร้อมรูปภาพแสดงผลถาวรใน LINE Flex Message
* **Goal 3:** ข้อมูลลูกค้าและรายการจองถูกซิงก์เข้า Google Sheets ของร้านค้าตาม `Record_ID` (แก้ปัญหาแถวเลื่อน) แบบอัตโนมัติ

### 🚫 สิ่งที่อยู่นอกขอบเขต V1 อย่างเด็ดขาด (Explicit Non-Goals)
1. **ไม่ทำระบบคลินิกรักษา/คลังยา (Clinic & Pharmacy):** เป็น Medical workflow ที่ซับซ้อนเกินไป
2. **ไม่ทำระบบคิวกรูมมิ่ง (Grooming Queue):** กรูมมิ่งเป็นเรื่อง Resource/Stylist Scheduling คนละแบบกับ Room Matrix
3. **ไม่ทำระบบตรวจสลิป/บิลอัตโนมัติ (SlipOK / Billing Automation / e-Tax):** ยกไป Phase 3 หลัง Core Loop นิ่ง
4. **ไม่ทำ Google Drive Photo Sync ใน V1:** เก็บรูปใน Supabase Storage Bucket ก่อนใน MVP ยก Google Drive ไป Phase 2
5. **ไม่ทำ Digital Pet Passport & Live Camera Stream:** ยกไป Phase 3–4
6. **ไม่ทำระบบควบคุมหลายสาขา (Multi-Branch Control):** รองรับเฉพาะร้านสาขาเดี่ยวใน V1 ยก Multi-Branch ไป Phase 4

---

## 3. The Core Daily Loop

```
[1. สัตว์เลี้ยงเข้าพัก] ──► [2. ผังห้องไม่ชน] ──► [3. ดูข้อมูลอาหาร/ยา] ──► [4. ส่ง Daily Report 15 วิ] ──► [5. เจ้าของได้ LINE]
```

---

## 4. ข้อกำหนดฟังก์ชัน V1 (MVP Requirements: P0 Only)

```
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│ P0-A: Shop Operation    │ P0-B: Killer Feature    │ P0-C: Differentiator    │
│ - Tenant & Hardened RLS │ - 1-Click Daily Report  │ - Google Sheets Sync    │
│ - Room Matrix (GiST)    │ - 1–4 Photo Cardinality │ - Record_ID Key Lookup  │
│ - Multi-pet Booking RPC │ - Atomic LIFF Claim     │ - Auto Retry Queue      │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

### 🔴 P0-A: Shop Operation & Room Matrix

#### 1. Tenant Setup & Staff Auth
* ร้านค้ามี Slug แยกข้อมูลเด็ดขาด คุ้มครองด้วย Supabase Row-Level Security (RLS) ครบทุกตาราง (Non-Recursive RLS via `is_shop_owner()`)
* ตาราง `staff_users` ผูกกับ `auth.users.id` ของ Supabase พร้อมบทบาท `owner`, `manager`, `staff`

#### 2. Room Setup & Visual Matrix
* ตั้งค่าห้องพัก: หมายเลขห้อง, ประเภทห้อง (Standard, Deluxe, VIP, Cat Condo), ความจุ (`capacity_pets`), ราคา/คืน
* หน้าจอผังห้อง (Visual Matrix Grid): แสดงสถานะห้องเรียลไทม์:
  * 🟢 **Available (ว่าง):** พร้อมรับการจอง
  * 🔵 **Occupied (มีสัตว์พัก):** แสดงชื่อน้องหมาแมว และวันที่เช็คเอาท์
  * 🟠 **Cleaning (รอทำความสะอาด):** หลังเช็คเอาท์ต้องทำความสะอาดก่อนเปิดรับตัวใหม่
  * ⚪ **Maintenance (ปิดปรับปรุง)**

#### 3. Pet & Owner CRM & Atomic LIFF Claim Flow
* **Owner Profile:** ชื่อ, เบอร์โทร, `line_user_id` (ผูกผ่าน verified token), เบอร์ติดต่อฉุกเฉิน
* **Pet Profile:** ชื่อ, สายพันธุ์, เพศ, วันเกิด, น้ำหนัก, รูปถ่าย, **อาหารเฉพาะ, ยาประจำตัว, พฤติกรรมที่ต้องระวัง**
* **Atomic LIFF Claim Protocol (P0 Specification):**
  1. พนักงานสร้างข้อมูล Pet Owner ในระบบ ➔ Backend สร้าง Secure One-Time Token และเก็บ `line_claim_token_hash` พร้อม `line_claim_expires_at` ลงในฐานข้อมูล
  2. ระบบแสดง QR Code / ลิงก์ LIFF ให้ลูกค้าสแกน
  3. ลูกค้าเปิด LIFF ใน LINE ➔ หน้าบ้าน LIFF ส่ง ID Token/Access Token + Raw Claim Token ไปยัง Backend
  4. Backend ตรวจสอบ ID Token กับ LINE Platform เพื่อดึง `line_user_id` ที่แท้จริง (ห้ามเชื่อ ID ที่ Client ส่งมาตรงๆ)
  5. Backend เรียกคำสั่ง SQL Atomic Consume:
     ```sql
     UPDATE pet_owners
     SET line_user_id = p_verified_line_user_id,
         line_claim_used_at = now()
     WHERE line_claim_token_hash = p_token_hash
       AND line_claim_used_at IS NULL
       AND line_claim_expires_at > now()
     RETURNING id;
     ```
     หากคืนค่า 0 แถว แสดงว่า Token หมดอายุหรือถูกใช้ไปแล้ว ป้องกัน Double-Claim หรือ Replay Attack

#### 4. Booking & Double-Booking Prevention (Enforced at Database Level)
* รองรับการจองห้องพักแบบ **1 Booking ต่อสัตว์เลี้ยงหลายตัวได้ (Multi-Pet per Room)** ผ่านตาราง `booking_pets`
* **Concurrency-Safe Capacity Enforcement:** เพิ่มสัตว์ผ่าน RPC `add_pet_to_booking` ที่มี Row-Locking (`FOR UPDATE`) โดย RPC ดึง `shop_id` จาก Session ภายในตัว ป้องกัน Cross-Tenant Attack และสกัดกั้นไม่ให้เพิ่มสัตว์เกินความจุห้อง (`count(booking_pets) <= rooms.capacity_pets`)
* ปิดไม่ให้ Client ยิง `INSERT INTO booking_pets` ตรงผ่าน RLS เพื่อบังคับให้ต้องผ่าน RPC เท่านั้น
* **Database-Level Constraint:** บังคับใช้ PostgreSQL Exclusion Constraint (`EXCLUDE USING gist`) บนช่วงวันที่เข้าพัก `[check_in_date, check_out_date)` ป้องกันการจองช่วงเวลาเดียวกันในห้องเดียวกันที่ระดับฐานข้อมูล

---

### 🔴 P0-B: Killer Feature — 1-Click LINE Daily Report

#### 1. Daily Report Form on iPad/Web
* พนักงานเลือกห้อง/สัตว์เลี้ยง ➔ ระบบมี Trigger ตรวจสอบว่าสัตว์เลี้ยงลงทะเบียนใน Booking นั้นจริง
* อัปโหลดรูปถ่ายน้องหมาแมว **1–4 รูป** (บังคับเงื่อนไข `cardinality(photo_urls) BETWEEN 1 AND 4` ที่ระดับ Database)
* จัดเก็บรูปภาพใน Storage Bucket `daily-report-photos` (Public CDN Read with Secure Unpredictable UUIDs) เพื่อให้รูปภาพใน LINE Flex Message เปิดดูได้ถาวรโดยไม่หมดอายุ
* กดเลือกสถานะแบบ One-touch (4 ระดับมาตรฐาน):
  * **อาหาร (Food):** `กินหมด` | `กินครึ่งเดียว` | `กินน้อย` | `ไม่ยอมกิน`
  * **การขับถ่าย (Excretion):** `ปกติ` | `ถ่ายเหลว` | `ไม่ถ่าย`
  * **อารมณ์ (Mood):** `ร่าเริง` | `สงบ` | `เครียด/คิดถึงบ้าน`
* ช่องพิมพ์หมายเหตุสั้นๆ ของพี่เลี้ยง (Staff Note)

#### 2. LINE Flex Message Dispatcher
* กดปุ่ม "ส่งรายงาน" ➔ ระบบสร้างการ์ด **LINE Flex Message** รูปแบบการ์ดน่ารัก (รูปภาพเด่น + Badge สถานะ + ข้อความพี่เลี้ยง) ส่งตรงเข้าแชท LINE เจ้าของสัตว์ทันที

---

### 🔴 P0-C: Differentiator — Idempotent Google Sheets Sync

#### 1. Record_ID Key Lookup (Anti-Row-Shift)
* **Sheet "Customers":** บันทึก `[Record_ID (Col A - Protected Range), ชื่อเจ้าของ, เบอร์โทร, LINE ID, ชื่อสัตว์เลี้ยง, สายพันธุ์, ข้อควรระวัง]`
* **Sheet "Bookings":** บันทึก `[Booking_ID (Col A - Protected Range), ห้อง, วันที่เข้า, วันที่ออก, สัตว์เลี้ยง, ยอดเงิน, สถานะ]`
* **Sync Strategy:**
  * อ่าน Column A เพื่อหาพิกัดแถวของ `Record_ID`
  * **ถ้าพบ Record_ID ในแถว N:** อัปเดตทับเฉพาะแถว `A{N}:G{N}`
  * **ถ้าไม่พบ Record_ID:** ยิง API `append` ท้ายตาราง
  * **Error Handling:** หากพบ `Record_ID` ซ้ำกันใน Sheet ให้ Fail ทันทีและแจ้งเตือน ห้ามเขียนทับแบบสุ่ม

#### 2. Retry Queue & Resiliency
* หาก Google Sheets API ขัดข้อง ให้บันทึก Transaction ลงคิว `sync_queue` และมี Background Worker รัน Retry อัตโนมัติ

---

## 5. แผนพัฒนาในเฟสถัดไป (Future Horizons)

* **Phase 2 (Closed Beta):** Google Drive Photo Backup per Pet, Onboarding Pilot 5–10 ร้าน
* **Phase 3 (Monetization & Billing):** SlipOK QR Verification, Auto Billing & e-Tax, Subscription Paywall, Pilot กล้องสดผ่าน Third-party App Sharing
* **Phase 4 (Expansion):** Multi-Branch Control, Grooming Queue Module, Vaccine Auto-Recall, Live RTSP/HLS Camera Bridge
