# 🐾 PawSpace — Pet Hotel & Daycare OS

> **"Pet Hotel OS ที่จัดการห้อง การเข้าพัก และ Daily Care Report ผ่าน LINE โดยร้านยังมีสำเนาส่งออกของข้อมูลลูกค้าและรายการจองอยู่ใน Google Sheets"**

---

## 🎯 ตำแหน่งผลิตภัณฑ์ (Product Positioning)

**PawSpace** คือระบบปฏิบัติการสำหรับ **โรงแรมสัตว์เลี้ยง (Pet Hotel) และศูนย์รับฝากเลี้ยงกลางวัน (Pet Daycare)** โดยเฉพาะ (ไม่ปะปนกับคลินิกหรือร้านตัดขนใน V1)

### แกนหลัก 3 เสาของ PawSpace:
1. **Room Matrix:** ผังห้องพักแบบ Real-time จัดการจอง เช็คอิน เช็คเอาท์ และสถานะทำความสะอาด โดยมี Database Exclusion Constraint ป้องกันการจองห้องชน
2. **Pet Care Workflow (The Core Daily Loop):** ระบบประวัติสัตว์เลี้ยง + พนักงานกดบันทึกสถานะ (กิน/ขับถ่าย/อารมณ์ + แนบรูป 1–4 รูป) ภายใน 15 วินาที แล้วระบบส่งเป็นการ์ด **LINE Flex Message** ถึงเจ้าของสัตว์ทันที
3. **Data Ownership (Differentiator):** ฐานข้อมูลหลักรันบน Supabase แต่ข้อมูลลูกค้าและรายการจองจะถูก **Sync สำเนาส่งออกไปยัง Google Sheets ของร้านค้า (Record_ID Key Lookup)** เสมอ

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
| 📋 [`docs/PRD.md`](./docs/PRD.md) | **Priority 1** | **Locked / Ready** | ข้อกำหนดฟังก์ชัน Lean MVP (P0-A, P0-B, P0-C), LIFF Claim Flow และ DB Constraints |
| 🏛️ [`docs/SYSTEM_ARCHITECTURE.md`](./docs/SYSTEM_ARCHITECTURE.md) | **Priority 2** | **Production-Ready Specification** | สถาปัตยกรรมระบบ, Composite FK Tenant-Isolation, Complete RLS, Storage RLS, RPC Capacity Locking, Supabase Vault และ ID-based Google Sync |
| 🗺️ [`docs/ROADMAP.md`](./docs/ROADMAP.md) | **Priority 3** | **Locked / Ready** | แผนผังการส่งมอบที่สอดคล้องกับ PRD (Phase 1 Core MVP ➔ Phase 2 Drive & Beta ➔ Phase 3 Monetization ➔ Phase 4 Expansion) |
| 💼 [`docs/BUSINESS_MODEL.md`](./docs/BUSINESS_MODEL.md) | **Priority 4** | **Locked / Ready** | โมเดลราคา V1 ที่แม่นยำ และตารางสมมติฐานทางธุรกิจ (Hypotheses H1–H4) |

### 💼 หมวดการตลาด ปฏิบัติการ และกฎหมาย (Go-To-Market & Operations)
| เอกสาร | ลำดับความสำคัญ | สถานะ | รายละเอียด |
| :--- | :---: | :---: | :--- |
| 🎯 [`docs/SALES_PLAYBOOK.md`](./docs/SALES_PLAYBOOK.md) | Derived | **Ready** | สคริปต์ทักแชทลูกค้า 3 แบบ, วิธีตอบข้อโต้แย้ง 5 ข้อหลัก (Objection Handling) และสคริปต์ปิดการขาย |
| 📄 [`docs/PRODUCT_ONE_PAGER.md`](./docs/PRODUCT_ONE_PAGER.md) | Derived | **Ready** | โบรชัวร์สรุปจุดขาย 1 หน้า (PDF/LINE Layout) ที่ตัดข้อความเกินจริงและสอดคล้องกับ PRD |
| 📖 [`docs/ONBOARDING_SOP.md`](./docs/ONBOARDING_SOP.md) | Derived | **Ready** | คู่มือการใช้งานหน้าร้าน 3 นาที บน iPad พร้อมขั้นตอนผูก LINE ผ่าน Custom LIFF Claim Flow |
| ⚖️ [`docs/TERMS_AND_PRIVACY.md`](./docs/TERMS_AND_PRIVACY.md) | Legal Review | **Draft Framework** | ร่างกรอบข้อตกลงการให้บริการ, นโยบาย PDPA (Data Controller/Processor), Subprocessors และขอบเขต Google Sheets Replica |

---

## 📦 ขอบเขต MVP (V1 Scope Lock)

* **P0-A (Shop Operation):** Tenant/Auth (Supabase Auth + Complete RLS), Room Setup, Owner/Pet CRM, Booking (DB Collision Constraint & Concurrency-Safe RPC Capacity Lock), Check-in/out, Room Cleaning Status, Custom LIFF Claim Flow
* **P0-B (Killer Feature):** Daily Report (รูป 1–4 รูป `cardinality BETWEEN 1 AND 4`, Storage Bucket `daily-report-photos` สำหรับ LINE Flex Message, สถานะ กิน 4 ระดับ/ขับถ่าย/อารมณ์, Note), ยิง LINE Flex Message
* **P0-C (Differentiator):** Google Sheets Idempotent Sync (`Record_ID` Key Lookup บน Protected Column A) + Retry Queue
* 🚫 **สิ่งที่ตัดออกจาก MVP (ยกไป Phase ถัดไป):** SlipOK, Auto Billing, e-Tax, Google Drive, Digital Pet Passport, Live Camera, Grooming Queue, Clinic Module
