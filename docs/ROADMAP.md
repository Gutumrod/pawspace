# 🗺️ PawSpace — Product Roadmap & Execution Milestones

> **Document Status:** Locked & Harmonized with PRD Invariants
> **Execution Strategy:** Build Core Loop First ➔ Validate with Pilot Stores ➔ Monetize & Gate ➔ Expand

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
* **เป้าหมาย:** สร้างระบบพื้นฐานที่ตอบโจทย์ The Core Daily Loop ตามสัญญา Product Decisions 10 ข้ออย่างเคร่งครัด
* **สิ่งที่ส่งมอบ (Deliverables):**
  1. **Shop Setup & Staff Auth (Decision 7A & 8A):**
     * Supabase Auth Email/Password + Lean 2-Tier RLS Matrix (`owner/manager` vs `staff`)
     * ตั้งค่าประเภทห้อง, ความจุ (`capacity_pets`), ราคา, และช่วงปิดปรับปรุง (`maintenance_from/until`)
  2. **Room Matrix & Strict Booking Engine (Decision 1A, 2A, 3A, 4A):**
     * ผังห้องพักแสดงสถานะ (Available, Occupied, Cleaning, Maintenance)
     * ระบบจองพร้อม PostgreSQL GiST Exclusion Constraint ป้องกันห้องชน
     * RPC `add_pet_to_booking` บังคับ Invariants: เจ้าของเดียวกัน (1A), สัตว์เลี้ยงไม่จองซ้อน (2A), ไม่ทับช่วง Maintenance (4A), และคุมความจุห้องด้วย Row Lock
     * State Machine สำหรับการเช็คอิน/เช็คเอาท์/ยกเลิก (3A)
     * Verified LIFF Claim Flow ผูก LINE (TTL 48h + Re-link) (6A)
  3. **1-Click Daily Care Report via LINE (Decision 5A):**
     * พี่เลี้ยงอัปโหลดรูป 1–4 รูป (`cardinality BETWEEN 1 AND 4`) + ติ๊กสถานะ อาหาร (4 ระดับ)/ขับถ่าย/อารมณ์ + Note
     * รองรับการส่งหลายครั้งต่อวัน พร้อมระบบป้องกันการกดซ้ำ (`idempotency_key`)
     * จัดเก็บรูปใน Storage Bucket `daily-report-photos` (Public CDN Read) แสดงผลในการ์ด LINE Flex Message ได้ตลอดอายุการใช้งานตาม Retention Policy (พร้อม Dual Idempotency & X-Line-Retry-Key)
  4. **Pet-Centric Google Sheets Sync (Decision 9A):**
     * ซิงก์สำเนา One-way Replica ลง Google Sheets ของร้านค้าโดยใช้ `Record_ID = pet_id` ใน Column A
     * มีตาราง `sync_queue` สำรองข้อมูลกรณี API ขัดข้อง

---

### 🧪 Phase 2: Closed Beta & Real-World Validation (สัปดาห์ที่ 3)
* **เป้าหมาย:** นำระบบไปให้โรงแรมสัตว์เลี้ยงจริง 5–10 ร้านทดลองใช้งานเพื่อเก็บ Feedback
* **สิ่งที่ส่งมอบ (Deliverables):**
  1. **Direct Outreach:** ทักหาโรงแรมหมาแมว 30 ร้านใน กทม./ปริมณฑล มอบสิทธิ์ทดลองใช้ฟรี 30 วัน พร้อมฟรีบริการช่วยจัดผังห้องและนำเข้าข้อมูลเดิม
  2. **White-Glove Onboarding:** ช่วยร้านนำเข้ารายชื่อลูกค้าเดิมและผังห้องลงระบบ
  3. **Google Drive Photo Backup:** เพิ่มระบบแบ็กอัปรูปสัตว์เลี้ยงแยกโฟลเดอร์ลง Google Drive ของร้าน
  4. **UX Polishing:** ปรับจูน UI หน้าร้านบน iPad ให้พนักงานกดง่ายที่สุดตามฟีดแบ็กจริง

---

### 💰 Phase 3: Commercial Launch & Monetization (สัปดาห์ที่ 4)
* **เป้าหมาย:** เปิดระบบรับชำระเงินและเริ่มบังคับใช้ Feature Limit ตามแพ็กเกจ (Decision 10A)
* **สิ่งที่ส่งมอบ (Deliverables):**
  1. **Billing & Subscription Paywall:** ระบบตัดเงินรายเดือน/รายปี (Starter 990 บ. / Pro 1,490 บ.)
  2. **Feature Gating Enforcement:** เริ่มล็อกโควตาห้องและสัตว์เลี้ยงสำหรับแพ็กเกจ Starter (10 ห้อง / 300 สัตว์เลี้ยง)
  3. **PromptPay QR & SlipOK Verification:** ระบบสร้าง QR สแกนจ่ายและตรวจสลิปโอนเงินปลอมอัตโนมัติ
  4. **B2B2C Add-on Pilot:** ทดสอบขายป้ายชื่อ Smart Tag และทดลองเปิดฟังก์ชันแชร์ลิงก์กล้องของห้องพัก (Third-party Cam Sharing)

---

### 📈 Phase 4: Long-Term Expansion (เดือนที่ 2 เป็นต้นไป)
* **เป้าหมาย:** สเกลสู่ 50–100 ร้าน และขยายโมดูลเฉพาะทาง
* **สิ่งที่ส่งมอบ (Deliverables):**
  1. **Multi-Branch Control Module:** แดชบอร์ดรวมและระบบจัดการหลายสาขาสำหรับธุรกิจที่มีหลายสาขา
  2. **Grooming Queue Module:** ระบบคิวอาบน้ำตัดขนและคำนวณค่าคอมมิชชั่นช่าง
  3. **Vaccine Auto-Recall Engine:** บอทเตือนฉีดวัคซีนและหยอดยาเห็บหมัดเข้า LINE เจ้าของล่วงหน้า
  4. **Live RTSP/HLS Camera Bridge:** ระบบสตรีมมิ่งกล้องสดฝังในแอป
