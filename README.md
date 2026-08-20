# 🐾 PawSpace — Pet Hotel & Daycare OS

> **"Pet Hotel OS ที่จัดการห้อง การเข้าพัก และ Daily Care Report ผ่าน LINE โดยร้านยังมีสำเนาส่งออกของข้อมูลลูกค้าและรายการจองอยู่ใน Google Sheets"**

---

## 🎯 ตำแหน่งผลิตภัณฑ์ (Product Positioning)

**PawSpace** คือระบบปฏิบัติการสำหรับ **โรงแรมสัตว์เลี้ยง (Pet Hotel) และศูนย์รับฝากเลี้ยงกลางวัน (Pet Daycare)** โดยเฉพาะ (Single-Store Focus สำหรับ V1)

### แกนหลัก 3 เสาของ PawSpace:
1. **Room Matrix & Strict Booking Engine:** ผังห้องพักแบบ Real-time จัดการจอง เช็คอิน เช็คเอาท์ และสถานะทำความสะอาด โดยมี Database Exclusion Constraint ป้องกันการจองห้องชน และ RPC ป้องกันการจองซ้อนของสัตว์เลี้ยง
2. **Pet Care Workflow (The Core Daily Loop):** ระบบประวัติสัตว์เลี้ยง + พนักงานกดบันทึกสถานะ (กิน/ขับถ่าย/อารมณ์ + แนบรูป 1–4 รูป) ภายใน 15 วินาที แล้วระบบส่งเป็นการ์ด **LINE Flex Message** ถึงเจ้าของสัตว์ทันทีพร้อมเปิดดูได้ตลอดอายุการใช้งาน
3. **Data Ownership (Differentiator):** ฐานข้อมูลหลักรันบน Supabase แต่ข้อมูลลูกค้าและรายการจองจะถูก **Sync สำเนาส่งออกไปยัง Google Sheets ของร้านค้า (Pet-Centric Record_ID Lookup)** เสมอ

---

## 🔁 The Core Daily Loop (หัวใจที่ทำให้ร้านเปิดใช้ทุกวัน)

```
[หมา/แมวเข้าพัก] ──► [ห้องไม่ชน] ──► [พนักงานดูข้อมูลน้อง] ──► [กดส่ง Daily Report 15 วิ] ──► [เจ้าของได้รับ LINE ทันที]
```

---

## 🏗️ สารบัญเอกสารแม่บท (Master Documentation Suite)

### 🛠️ หมวดผลิตภัณฑ์และเทคนิค (Product & Engineering)
| เอกสาร | ลำดับความสำคัญ | สถานะ | รายละเอียด |
| :--- | :---: | :---: | :--- |
| 📋 [`docs/PRD.md`](./docs/PRD.md) | **Priority 1** | **Locked / Authoritative Target** | ข้อกำหนดฟังก์ชัน Lean MVP (P0-A, P0-B, P0-C) พร้อมกฎ Product Decisions ทั้ง 10 ข้อ (รวม A1, B1, C2) |
| 🏛️ [`docs/SYSTEM_ARCHITECTURE.md`](./docs/SYSTEM_ARCHITECTURE.md) | **Priority 2** | **Target Implementation Specification** | สถาปัตยกรรม Next.js 16.x + PostgreSQL Schema, Strict Invariants, 2-Tier RLS, Capacity Locking, และ Media Delivery Contract |
| 🗺️ [`docs/ROADMAP.md`](./docs/ROADMAP.md) | **Priority 3** | **Locked / Ready** | แผนผังการส่งมอบ 4 เฟส (Phase 1 Core MVP ➔ Phase 2 Beta ➔ Phase 3 Monetization & Gating ➔ Phase 4 Expansion) |
| 💼 [`docs/BUSINESS_MODEL.md`](./docs/BUSINESS_MODEL.md) | **Priority 4** | **Locked / Ready** | โมเดลราคา V1 ที่แม่นยำ, การเริ่ม Gating ใน Phase 3, และตารางสมมติฐานทางธุรกิจ (Hypotheses H1–H4) |
| 📊 [`docs/IMPLEMENTATION_STATUS.md`](./docs/IMPLEMENTATION_STATUS.md) | **Tracking** | **Active Baseline** | สถานะความคืบหน้าระดับโค้ดจริงใน Repository แยกสถานะชัดเจน (Foundation / Preview / Pending Live) |

### 💼 หมวดการตลาด ปฏิบัติการ และกฎหมาย (Go-To-Market & Operations)
| เอกสาร | ลำดับความสำคัญ | สถานะ | รายละเอียด |
| :--- | :---: | :---: | :--- |
| 🎯 [`docs/SALES_PLAYBOOK.md`](./docs/SALES_PLAYBOOK.md) | Derived | **Ready** | สคริปต์ทักแชทลูกค้า 3 แบบ, วิธีตอบข้อโต้แย้ง 5 ข้อหลัก (Objection Handling) และสคริปต์ปิดการขาย |
| 📄 [`docs/PRODUCT_ONE_PAGER.md`](./docs/PRODUCT_ONE_PAGER.md) | Derived | **Ready** | โบรชัวร์สรุปจุดขาย 1 หน้า (PDF/LINE Layout) ที่ตัดข้อความเกินจริงและสอดคล้องกับ PRD |
| 📖 [`docs/ONBOARDING_SOP.md`](./docs/ONBOARDING_SOP.md) | Derived | **Ready** | คู่มือการใช้งานหน้าร้าน 3 นาที บน iPad พร้อมขั้นตอนผูก LINE ผ่าน Custom LIFF Claim Flow (TTL 48h) |
| ⚖️ [`docs/TERMS_AND_PRIVACY.md`](./docs/TERMS_AND_PRIVACY.md) | Legal Review | **Draft Framework** | ร่างกรอบข้อตกลงการให้บริการ, นโยบาย PDPA (Data Controller/Processor), และการแยก Public Media Bucket |

---

## 📦 ขอบเขต MVP (V1 Scope Lock)

* **P0-A (Shop Operation):** Tenant/Auth (Supabase Auth Email/Password + 2-Tier RLS), Room Setup (Maintenance Date Range), Owner/Pet CRM, Booking (DB Collision Constraint, Strict Same-Owner, No-Overlap, Concurrency-Safe Capacity Lock), Check-in/out Linear State Machine, Custom LIFF Claim Flow
* **P0-B (Killer Feature):** Daily Report (รูป 1–4 รูป `cardinality BETWEEN 1 AND 4`, Storage Bucket `daily-report-photos` สำหรับ LINE Flex Message, สถานะ กิน 4 ระดับ/ขับถ่าย/อารมณ์, Multiple Reports per Day + Idempotency Protection), ยิง LINE Flex Message
* **P0-C (Differentiator):** Google Sheets One-way Export Sync (Pet-Centric `Record_ID = pet_id` Lookup บน Protected Column A) + Retry Queue
* 🚫 **สิ่งที่ตัดออกจาก MVP (ยกไป Phase ถัดไป):** SlipOK, Auto Billing, e-Tax, Google Drive, Digital Pet Passport, Live Camera, Grooming Queue, Clinic Module, Multi-Branch
