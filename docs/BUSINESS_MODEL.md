# 💼 Pawstia PMS — Business Model & Monetization Strategy

> **Document Status:** Aligned & Reality-Checked (Single Source of Truth)
> **Target Market (V1):** Pet Hotels & Pet Daycare Centers (Single-Location Focus)
> **CEO Decision Locked:** Decision C = C2 (Founding Member Pro Entitlement)

---

## 1. คุณค่าหลักและการวางตำแหน่ง (Value Proposition)

* **คุณค่าต่อร้านค้า (B2B):** จัดการห้องพักไม่มีชน + พนักงานส่งรายงานเข้า LINE ได้ใน 15 วิ + ข้อมูลลูกค้าและรายการจองมี Data Export Replica อยู่ใน Google Sheets ของร้าน
* **คุณค่าต่อเจ้าของสัตว์ (B2C):** สบายใจ ได้รับการ์ดสรุปสภาพน้องหมาแมวทาง LINE ทุกวันโดยไม่ต้องโหลดแอป

---

## 2. โครงสร้างราคาและแพ็กเกจ V1 (B2B Subscription Packages)

| แพ็กเกจ | ราคาต่อเดือน | ราคาต่อปี (ประหยัด 2 เดือน) | สิทธิ์ที่ได้รับใน V1 ปัจจุบัน (Single-Store) | จังหวะการจำกัดสิทธิ์ (Enforcement Timing) |
| :--- | :--- | :--- | :--- | :--- |
| **Starter** | **990 บ. / ด.** | 9,900 บ. / ปี | สูงสุด 10 ห้องพัก, ประวัติสัตว์เลี้ยง 300 ตัว, ส่ง Daily Report LINE, ซิงก์ Google Sheets | **Implemented at authoritative DB boundaries in Engineering Phase 13** |
| **Pro** 🌟 | **1,490 บ. / ด.** | 14,900 บ. / ปี | ห้องพักไม่จำกัด, ประวัติสัตว์เลี้ยงไม่จำกัด, ส่ง Daily Report LINE, ซิงก์ Google Sheets | ใช้งานได้ไม่จำกัด |
| **Enterprise (Single-Store Pro Plus)** | **2,490 บ. / ด.** | 24,900 บ. / ปี | บัญชีพนักงานไม่จำกัด, ข้อตกลง SLA ตอบกลับด่วนพิเศษ (Priority Support) | ใช้งานได้ไม่จำกัด |

* **🎁 สิทธิประโยชน์พิเศษสำหรับกลุ่มร้านบุกเบิก (Founding Member Package — Decision C2):**
  * **ราคาพิเศษ:** **990 บาท / เดือน** (จากราคา Pro ปกติ 1,490 บาท)
  * **สิทธิ์การใช้งาน (Entitlement):** ได้รับสิทธิ์เทียบเท่า **แพ็กเกจ Pro (ห้องพักไม่จำกัด / ประวัติสัตว์เลี้ยงไม่จำกัด)**
  * **เงื่อนไขสำคัญ (Terms):**
    1. สิทธิ์นี้คงอยู่ตลอดไปตราบเท่าที่รักษาสถานะ Subscription ต่อเนื่องโดยไม่ขาดการต่ออายุ
    2. สิทธิ์เป็นแบบเฉพาะร้าน ไม่สามารถโอนสิทธิ์ให้ร้านอื่นได้ (Non-transferable)
    3. ไม่ครอบคลุมบริการเสริมที่มีค่าใช้จ่ายเพิ่มเติมในอนาคต (Excluding future paid add-ons)
* **นโยบายค่าบริการ Onboarding & นำเข้าข้อมูล (Onboarding Policy):**
  * **ช่วง Closed Beta / Founding 10 ร้านแรก:** ฟรี บริการช่วยนำเข้าข้อมูลและเซ็ตอัปผังห้อง
  * **หลังช่วง Beta (ปกติ):** บริการเสริมนำเข้าข้อมูลและจัดผังห้อง (Optional Setup) ราคา **3,000 – 5,000 บาท / ร้าน**

---

### แผนบริการเสริมและฟีเจอร์ระยะยาว (Planned Add-ons & Future Horizons)

* **Google Drive Photo Backup (future commercial stage):** แบ็กอัปรูปสัตว์เลี้ยงลง Google Drive ของร้าน
* **SlipOK & Auto e-Tax (future paid-launch/add-on stage; not implemented):** ระบบตรวจสลิปโอนเงินอัตโนมัติและออกใบเสร็จ
* **Advanced Camera Add-on (future expansion):** bounded visitor camera access already exists; broader paid multi-camera/RTSP-HLS capability remains future work
* **Multi-Branch Control Module (future expansion):** แดชบอร์ดรวมและระบบจัดการหลายสาขาสำหรับธุรกิจที่มีหลายสาขา

---

## 3. สมมติฐานทางธุรกิจที่ต้องทดสอบ (Business Hypotheses to Validate)

| รายการสมมติฐาน (Hypothesis) | ตัวเลขที่ตั้งเป้าไว้ | วิธีการทดสอบและเก็บข้อมูลจริง (Validation Method) |
| :--- | :--- | :--- |
| **H1: Market Pain Intensity** | ร้านค้าส่วนใหญ่ยังใช้สมุด/Excel และพบปัญหาห้องชน/ส่งรูปยาก | สัมภาษณ์เชิงลึกกับ 30 ร้านค้าใน Commercial Stage B outreach |
| **H2: Trial to Paid Conversion** | ร้านค้าที่ทดลองใช้ฟรี 30 วัน จะต่ออายุแบบจ่ายเงิน > 40% | วัดผล Conversion Rate เมื่อครบช่วงทดลองใช้งานฟรี |
| **H3: Willingness to Pay** | ราคา 990–1,490 บ./ด. เป็นราคาที่ร้านค้าตัดสินใจจ่ายได้ทันที | เสนอราคาช่วงท้ายของ Beta Test เพื่อดูอัตราการตอบรับ |
| **H4: B2C Add-on Revenue** | เจ้าของสัตว์ยินดีจ่ายค่าบริการเสริมเมื่อเปิดใช้งาน | เปิดฟังก์ชันให้เจ้าของสัตว์กดซื้อใน Commercial Stage C–D เพื่อวัด Take-up Rate |

---

## 4. กลยุทธ์การเจาะตลาด 10 ร้านแรก (0-to-1 Sales Playbook)

1. **List Building:** รวบรวมรายชื่อ 50 โรงแรมหมาแมวในเขต กทม./ปริมณฑล จาก Google Maps และ Facebook
2. **Direct Outreach:** ทักหาเจ้าของร้านด้วยข้อเสนอ *"ทดลองใช้ฟรี 30 วัน + ฟรีบริการช่วยนำเข้าข้อมูลและเซ็ตอัปผังห้อง"*
3. **Closing Conversion:** สิ้นสุด 30 วัน มอบสิทธิ์ราคาพิเศษ **Founding Member Pro Package (990 บ./ด.)** สำหรับ 10 ร้านแรกที่ให้ Feedback
