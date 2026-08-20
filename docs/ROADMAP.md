# 🗺️ PawSpace — Product Roadmap & Execution Milestones

> **Document Status:** Locked & Aligned with Lean PRD  
> **Execution Strategy:** Build Core Loop First ➔ Validate with Pilot Stores ➔ Monetize ➔ Expand

---

## 🚧 Implementation Checkpoint — 2026-08-20

Phase 1 เริ่ม implementation แล้ว โดยรอบ foundation ปัจจุบันขึ้นโครง application, UI และ database schema สำคัญเรียบร้อย

### Foundation ที่ขึ้นโค้ดแล้ว

- Next.js application baseline
- Operations Dashboard preview
- Room Matrix preview
- Upcoming Check-ins / Activity / KPI UI
- Daily Care Report Drawer preview
- Supabase initial schema
- tenant/RLS foundation
- booking GiST exclusion constraint
- multi-pet capacity RPC foundation
- atomic LIFF claim RPC foundation
- Daily Report schema
- Google sync mapping + retry/outbox schema
- LINE/Google integration adapter boundaries

### Phase 1 ที่ยังต้องทำให้ Functional ก่อน Closed Beta

- live Supabase Auth + staff/shop context
- database-backed Room/Owner/Pet/Booking CRUD
- live check-in/check-out and room status flow
- Daily Report persistence + Storage upload
- live LINE Messaging API transport
- live Google Sheets sync worker/transport
- RLS/concurrency/end-to-end verification
- automated tests + typecheck + CI quality gate

รายละเอียดสถานะราย capability ดูที่ [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md)

---

## 🎯 ไทม์ไลน์ภาพรวม (Phase Overview)

```
[Sprint 1–2 (2 สัปดาห์)] ───► [Sprint 3 (สัปดาห์ 3)] ───► [Sprint 4 (สัปดาห์ 4)] ───► [Month 2+]
   Phase 1: Lean MVP            Phase 2: Closed Beta        Phase 3: Monetization       Phase 4: Expansion
(P0-A, P0-B, P0-C Core)        (Pilot 5-10 Pet Hotels)     (Subscription + Paywall)    (Grooming, Vaccine, Cam)
```

---

## 📅 รายละเอียดการดำเนินงานรายเฟส

### 🚀 Phase 1: Lean MVP (สัปดาห์ที่ 1–2) — *Focus: The Core Daily Loop*
* **สถานะ:** **IN PROGRESS — Foundation implemented; functional integration pending**
* **เป้าหมาย:** สร้างระบบพื้นฐานที่ตอบโจทย์ The Core Daily Loop ให้สมบูรณ์และเสถียรที่สุด
* **สิ่งที่ส่งมอบ (Deliverables):**
  1. **Shop Setup & Staff Auth (P0-A):**
     * Supabase Auth mapping กับ `staff_users` + Row-Level Security (RLS) ครบทุกตาราง
     * ตั้งค่าประเภทห้อง, ความจุ (`capacity_pets`), และราคา
  2. **Room Matrix & Multi-Pet Booking (P0-A):**
     * ผังห้องพักแสดงสถานะ (Available, Occupied, Cleaning)
     * ระบบจองพร้อม PostgreSQL GiST Exclusion Constraint ป้องกันห้องชนที่ระดับฐานข้อมูล
     * บันทึกสัตว์เลี้ยงหลายตัวต่อ 1 Booking พร้อม Concurrency-Safe RPC (`add_pet_to_booking`) คุมความจุห้อง
     * Verified LIFF Claim Flow สำหรับผูก LINE Account
  3. **1-Click Daily Care Report via LINE (P0-B):**
     * หน้าจอพี่เลี้ยง: อัปโหลดรูป 1–4 รูป (`cardinality BETWEEN 1 AND 4` ใน DB) + ติ๊กสถานะ อาหาร (4 ระดับ)/ขับถ่าย/อารมณ์ + Note
     * รูปจัดเก็บใน Storage Bucket `daily-report-photos` (Public CDN Read with Secure Unpredictable UUIDs)
     * ยิงการ์ด LINE Flex Message เข้าแชทเจ้าของสัตว์ทันที (แสดงผลถาวรไม่หมดอายุ)
  4. **Idempotent Google Sheets Sync (P0-C):**
     * ซิงก์สำเนาข้อมูลลูกค้าและรายการจองลง Sheet ของร้านค้าโดยใช้ `Record_ID` Key Lookup (แก้ปัญหาแถวเลื่อน)
     * มีตาราง `sync_queue` สำรองข้อมูลกรณี API ขัดข้อง

---

### 🧪 Phase 2: Closed Beta & Real-World Validation (สัปดาห์ที่ 3)
* **สถานะ:** **NOT STARTED — Blocked by functional Phase 1 completion**
* **เป้าหมาย:** นำระบบไปให้โรงแรมสัตว์เลี้ยงจริง 5–10 ร้านทดลองใช้งานเพื่อเก็บ Feedback
* **สิ่งที่ส่งมอบ (Deliverables):**
  1. **Direct Outreach:** ทักหาโรงแรมหมาแมว 30 ร้านใน กทม./ปริมณฑล มอบสิทธิ์ทดลองใช้ฟรี 30 วัน พร้อมฟรีบริการช่วยจัดผังห้องและนำเข้าข้อมูลเดิม
  2. **White-Glove Onboarding:** ช่วยร้านนำเข้ารายชื่อลูกค้าเดิมและผังห้องลงระบบ
  3. **Google Drive Photo Backup:** เพิ่มระบบแบ็กอัปรูปสัตว์เลี้ยงแยกโฟลเดอร์ลง Google Drive ของร้าน
  4. **UX Polishing:** ปรับจูน UI หน้าร้านบน iPad ให้พนักงานกดง่ายที่สุดตามฟีดแบ็กจริง

---

### 💰 Phase 3: Commercial Launch & Monetization (สัปดาห์ที่ 4)
* **สถานะ:** **NOT STARTED**
* **เป้าหมาย:** เปลี่ยนร้านค้าทดลองให้เป็นลูกค้าจ่ายเงินจริง (First Paying Customers)
* **สิ่งที่ส่งมอบ (Deliverables):**
  1. **Billing & Subscription Paywall:** ระบบตัดเงินรายเดือน/รายปี (Starter 990 บ. / Pro 1,490 บ.)
  2. **PromptPay QR & SlipOK Verification:** ระบบสร้าง QR สแกนจ่ายและตรวจสลิปโอนเงินปลอมอัตโนมัติ
  3. **B2B2C Add-on Pilot:** ทดสอบขายป้ายชื่อ Smart Tag และทดลองเปิดฟังก์ชันแชร์ลิงก์กล้องของห้องพัก (Third-party Cam Sharing)

---

### 📈 Phase 4: Long-Term Expansion (เดือนที่ 2 เป็นต้นไป)
* **สถานะ:** **NOT STARTED**
* **เป้าหมาย:** สเกลสู่ 50–100 ร้าน และขยายโมดูลเฉพาะทาง
* **สิ่งที่ส่งมอบ (Deliverables):**
  1. **Grooming Queue Module:** ระบบคิวอาบน้ำตัดขนและคำนวณค่าคอมมิชชั่นช่าง
  2. **Vaccine Auto-Recall Engine:** บอทเตือนฉีดวัคซีนและหยอดยาเห็บหมัดเข้า LINE เจ้าของล่วงหน้า
  3. **Live RTSP/HLS Camera Bridge:** ระบบสตรีมมิ่งกล้องสดฝังในแอป
  4. **Multi-Branch Control:** แดชบอร์ดรวมสำหรับเจ้าของธุรกิจที่มีมากกว่า 1 สาขา
