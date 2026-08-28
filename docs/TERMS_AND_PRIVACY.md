# ⚖️ Pawstia PMS — Draft Terms of Service & Privacy Framework

> **⚠️ DOCUMENT STATUS:** `[DRAFT — For Review & Commercial Planning Only / Not for Production Deployment]`
> **วัตถุประสงค์:** ร่างกรอบข้อตกลงการให้บริการและแนวทางปฏิบัติด้านความเป็นส่วนตัวเบื้องต้นสำหรับโครงการ Pawstia PMS (internal project identity: PawSpace/PS01) ก่อนเข้าสู่กระบวนการตรวจทานทางกฎหมายและสัญญาผู้ให้บริการช่วง (Vendor DPA) เต็มรูปแบบ

---

## 1. บทบาทและฐานทางกฎหมายในการประมวลผลข้อมูล (Data Roles & Lawful Basis)

เพื่อให้สอดคล้องกับแนวทางพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA):

* **ร้านค้า / โรงแรมสัตว์เลี้ยง (ผู้ใช้บริการ):** ดำรงสถานะเป็น **ผู้ควบคุมข้อมูลส่วนบุคคล (Data Controller)** มีหน้าที่กำหนดฐานทางกฎหมาย (Lawful Basis) ที่เหมาะสมสำหรับแต่ละกิจกรรมการประมวลผล และขอความยินยอม (Consent) จากเจ้าของสัตว์เลี้ยงในกรณีที่ใช้ความยินยอมเป็นฐานหรือตามที่กฎหมายกำหนด
* **ผู้ให้บริการ Pawstia PMS ภายใต้แบรนด์ WSTERA (legal entity/operator TBD before production):** ดำรงสถานะเป็น **ผู้ประมวลผลข้อมูลส่วนบุคคล (Data Processor)** มีหน้าที่ประมวลผล จัดเก็บ และส่งต่อข้อมูล (เช่น การจัดส่งรายงาน Daily Report ทาง LINE) ตามคำสั่งและการดำเนินการของร้านค้าเท่านั้น

---

## 2. กรรมสิทธิ์ในข้อมูลและการส่งออก (Data Ownership & Export Replica)

1. **กรรมสิทธิ์ของร้านค้า:** ข้อมูลลูกค้า, เบอร์โทรศัพท์, ประวัติสัตว์เลี้ยง, รูปภาพ, และรายการจองทั้งหมดที่บันทึกผ่านระบบ ถือเป็นกรรมสิทธิ์ของร้านค้าผู้ใช้บริการ
2. **นโยบายไม่แสวงหาประโยชน์จากข้อมูล (Zero Data Selling):** ผู้ให้บริการจะไม่นำข้อมูลลูกค้าของร้านค้าไปจำหน่าย, เผยแพร่แก่บุคคลภายนอกที่ไม่เกี่ยวข้อง, หรือใช้เพื่อประโยชน์ทางการตลาดอื่นใดโดยเด็ดขาด
3. **Google Sheets Sync (Customer & Booking Data Export Replica):**
   * ฟังก์ชันการซิงก์ Google Sheets ทำหน้าที่เป็น **"สำเนาส่งออกข้อมูลลูกค้าและรายการจอง (Data Export Replica)"** ลงในบัญชี Google Workspace ของร้านค้า
   * *ขอบเขต:* สำเนาดังกล่าวครอบคลุมเฉพาะข้อมูลตารางลูกค้าและรายการจองแบบ Pet-Centric ไม่ครอบคลุมไฟล์รูปภาพใน Storage, ข้อมูล Daily Reports เชิงลึก, หรือโครงสร้างสิทธิ์ผู้ใช้งาน

---

## 3. ผู้ประมวลผลข้อมูลช่วง (Subprocessors Framework)

> 📌 **หมายเหตุการตรวจสอบ:** รายการนิติบุคคล ประเทศที่ตั้งเซิร์ฟเวอร์ และข้อกำหนดการถ่ายโอนข้อมูลระหว่างประเทศด้านล่างนี้ เป็นกรอบการประเมินเบื้องต้น และจะต้องได้รับการตรวจทานเทียบกับสัญญา Vendor DPA ฉบับจริงก่อนนำขึ้น Production

| ผู้ให้บริการช่วง (Subprocessor) | วัตถุประสงค์การใช้งาน | สถานที่ตั้งเซิร์ฟเวอร์ / การถ่ายโอนข้อมูล |
| :--- | :--- | :--- |
| **Supabase Inc.** | จัดการฐานข้อมูลหลัก (PostgreSQL), Auth และ Storage เก็บรูปภาพ | ต้องยืนยัน production project region และ vendor terms จริงก่อน final legal review |
| **Hosting provider — TBD** | โฮสติ้งเว็บแอปพลิเคชัน/API | ต้องยืนยันผู้ให้บริการและภูมิภาคจริงก่อน Production; ห้ามถือว่าเป็น Vercel โดยอัตโนมัติ |
| **LY Corporation (LINE services)** | ส่งข้อความแจ้งเตือน Daily Report ผ่าน Messaging API / LIFF | ต้องยืนยัน applicable terms / transfer facts จาก production account และ vendor documentation ก่อน final legal review |
| **Google LLC** | ซิงก์ข้อมูลลง Google Sheets ตามคำสั่งของร้านค้า | Global Cloud Infrastructure |

---

## 4. ความปลอดภัย การจัดเก็บไฟล์สื่อ และการสำรองข้อมูล (Security & Media Storage)

1. **การรักษาความปลอดภัยของข้อมูล:**
   * การส่งผ่านข้อมูลกระทำผ่านโปรโตคอล HTTPS / TLS มาตรฐาน
   * **Current implementation:** LINE Channel Access Token ต่อร้านถูกอ่านจาก server-only environment configuration (`LINE_CHANNEL_ACCESS_TOKENS_JSON[shopId]`). **Supabase Vault เป็น target architecture เท่านั้นจนกว่าจะ implement และ verify จริง**
   * ข้อมูลตารางระหว่างร้านค้าถูกแยกขาดจากกันด้วย Supabase Row-Level Security (RLS 2-Tier)
2. **การแยกประเภทพื้นที่จัดเก็บไฟล์สื่อ (Media Storage Architecture):**
   * **รูปถ่าย Daily Report:** จัดเก็บใน Bucket `daily-report-photos` (Public CDN Read with Secure Cryptographic UUID Paths) เพื่อให้รูปภาพในการ์ด LINE Flex Message แสดงผลแก่ลูกค้าได้อย่างต่อเนื่องโดยไม่หมดอายุ
   * **เอกสารสำคัญของระบบ:** เอกสารภายในอื่นๆ (ถ้ามี) จะถูกจัดเก็บใน Private Storage Bucket ที่ควบคุมสิทธิ์ด้วย RLS
3. **การสำรองข้อมูล (Data Backup Scope):**
   * *ฐานข้อมูล (Database):* ในระดับ Production แผนการสำรองข้อมูลอัตโนมัติรายวัน (Automated Daily Backup) จะขึ้นอยู่กับ SLA ของ Supabase Pro Plan
   * *ไฟล์สื่อ (Media Storage):* ไฟล์รูปภาพถูกจัดเก็บใน Supabase Storage ซึ่งแยกจาก Database Backup

---

## 5. กระบวนการจัดการสิทธิของเจ้าของข้อมูลและเหตุละเมิด (DSAR & Incident Procedure)

1. **การใช้สิทธิของเจ้าของข้อมูล (Data Subject Access Request - DSAR):**
   * หากเจ้าของสัตว์เลี้ยงประสงค์จะขอเข้าถึง แก้ไข ลบ หรือระงับการใช้ข้อมูล ร้านค้าในฐานะ Data Controller สามารถดำเนินการจัดการข้อมูลผ่านแดชบอร์ด Pawstia PMS ได้โดยตรง
2. **กระบวนการแจ้งเตือนเหตุละเมิดความปลอดภัย (Breach Notification Procedure):**
   * หาก PawSpace ตรวจพบและยืนยันเหตุละเมิดความปลอดภัยของข้อมูลส่วนบุคคล PawSpace จะแจ้งให้ร้านค้า (Data Controller) ทราบ **โดยไม่ชักช้าหลังยืนยันเหตุ โดยตั้งเป้าหมายแจ้งเตือนภายใน 24 ชั่วโมง** เพื่อให้ร้านค้ามีเวลาเพียงพอในการประเมินและแจ้งต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส. / PDPC) ตามกรอบระยะเวลาทางกฎหมายของตน

---

## 6. การยกเลิกการใช้งานและการทำลายข้อมูล (Termination & Retention)

* เมื่อร้านค้ายกเลิกการใช้งาน ข้อมูลในระบบหลักจะถูกเก็บรักษาไว้เป็นเวลา **30 วัน** เพื่อให้ร้านค้ามีเวลาส่งออกข้อมูล จากนั้นระบบจะดำเนินการลบข้อมูลอย่างปลอดภัย
* ข้อมูลที่ถูกซิงก์ไปยัง Google Sheets ของร้านค้าจะยังคงอยู่ภายใต้การควบคุมของร้านค้าอย่างสมบูรณ์
