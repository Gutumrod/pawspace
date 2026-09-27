# PS01 Owner Manual — Owner Input Inventory
# PS01 คู่มือเจ้าของร้าน — รายการช่องที่เจ้าของร้านต้องเติมเอง

This file lists every placeholder used anywhere in the two manuals, each with a one-line explanation.
ไฟล์นี้รวบรวมช่องที่ต้องให้เจ้าของร้านเติมเองทุกช่องที่ปรากฏในคู่มือทั้งสองฉบับ พร้อมคำอธิบายหนึ่งบรรทัด

Marker / เครื่องหมายที่ใช้: **`{{OWNER_INPUT:…}}`** (ชื่อช่องเป็นตัวพิมพ์ใหญ่ทั้งหมด) — one consistent marker across both editions.
This template mention is the marker's own description, not a fillable field; the six fillable names are listed in the table below.
ข้อความบรรทัดนี้เป็นการอธิบายตัวเครื่องหมายเอง ไม่ใช่ช่องที่ต้องเติม — ช่องที่ต้องเติมมี 6 ช่องตามตารางด้านล่าง
Placeholders are unfilled on purpose: no email, phone number, LINE id, business name or web address is invented anywhere in the manuals.
ช่องทั้งหมดถูกเว้นว่างไว้โดยเจตนา คู่มือไม่กำหนดอีเมล เบอร์โทร LINE ID ชื่อธุรกิจ หรือที่อยู่เว็บขึ้นเอง

Total distinct placeholders / จำนวนช่องที่ไม่ซ้ำกัน: **6**
Total occurrences across both manuals / จำนวนครั้งที่ปรากฏในคู่มือทั้งสองฉบับ: **16** (8 in the Thai edition, 8 in the English edition)

| # | Placeholder | ต้องเติมอะไร / What to fill in | ปรากฏที่ / Where it appears | ความถี่ / Count |
| :--: | :--- | :--- | :--- | :--: |
| 1 | `{{OWNER_INPUT:SHOP_NAME}}` | ชื่อร้านที่จะแสดงให้ลูกค้าเห็น — the shop name shown in the product, taken from the shop profile | TH §1, EN §1 | 2 |
| 2 | `{{OWNER_INPUT:APP_URL}}` | ที่อยู่เว็บที่พนักงานเปิดใช้ระบบ และใช้ต่อท้ายเป็นลิงก์ `/line/claim` — the web address staff open, also used to build the `/line/claim` link | TH §1, TH §2, TH §5 (×2), EN §1, EN §2, EN §5 (×2) | 6 |
| 3 | `{{OWNER_INPUT:SUPPORT_CONTACT}}` | ช่องทาง support แบบข้อความของผลิตภัณฑ์ (L-13) — the product's written support channel | TH §11, EN §11 | 2 |
| 4 | `{{OWNER_INPUT:SUPPORT_HOURS}}` | ช่วงเวลาที่ตอบข้อความ support — the hours during which support messages are answered | TH §11, EN §11 | 2 |
| 5 | `{{OWNER_INPUT:PROVIDER_LEGAL_NAME}}` | ชื่อนิติบุคคลผู้ให้บริการ ตามที่เอกสารเงื่อนไข/นโยบายความเป็นส่วนตัวต้องระบุ — the provider's legal entity name required by the terms and privacy documents | TH §12, EN §12 | 2 |
| 6 | `{{OWNER_INPUT:PRIVACY_CONTACT}}` | ช่องทางติดต่อด้านข้อมูลส่วนบุคคล — the data-protection contact channel | TH §12, EN §12 | 2 |

Notes for the Owner / หมายเหตุถึงเจ้าของร้าน

1. `{{OWNER_INPUT:APP_URL}}` ใช้ทั้งเป็นที่อยู่ที่พนักงานเปิด และเป็นฐานของลิงก์ผูก LINE ในหัวข้อ 5 ถ้าเปลี่ยนที่อยู่เว็บภายหลัง ต้องแก้ทั้งสองฉบับพร้อมกัน
   `{{OWNER_INPUT:APP_URL}}` serves both as the address staff open and as the base of the LINE linking link in section 5; if the address changes later, update both editions together.
2. `{{OWNER_INPUT:SUPPORT_CONTACT}}` และ `{{OWNER_INPUT:SUPPORT_HOURS}}` เว้นว่างไว้เพราะรีโพซิทอรีไม่มีช่องทาง support ที่ยืนยันแล้ว และกฎล็อก L-13 กำหนดให้ support เป็นข้อความเท่านั้น (ไม่มี live call)
   These two are left blank because the repository has no confirmed support channel, and locked rule L-13 fixes support as text-only (no live call).
3. `{{OWNER_INPUT:PROVIDER_LEGAL_NAME}}` และ `{{OWNER_INPUT:PRIVACY_CONTACT}}` มาจากช่องว่างในร่างเอกสารกฎหมายของรีโพซิทอรี (`docs/TERMS_AND_PRIVACY.md` ระบุ legal entity/operator เป็น TBD) จึงต้องรอการตัดสินใจของเจ้าของ ไม่ใช่ค่าที่ผู้เขียนคู่มือกำหนดเอง
   These two mirror blanks in the repository's legal drafts (`docs/TERMS_AND_PRIVACY.md` marks the legal entity/operator as TBD) and therefore await an owner decision rather than being authored here.
4. ไม่มีช่องสำหรับราคา เพราะราคาทั้งหมดในคู่มือคัดมาจากเอกสารที่ล็อกไว้แล้ว (Owner Addendum A-2) ไม่ใช่ค่าที่เจ้าของต้องเติมใหม่
   There is no price placeholder: every price in the manuals is quoted from the already-locked documents (Owner Addendum A-2), not something the owner fills in again.

Inline URL placeholders (not owner constants) / ช่องในตัวลิงก์ (ไม่ใช่ค่าคงที่ของเจ้าของร้าน)

นอกจาก 6 ช่องข้างบน คู่มือหัวข้อ 5 ยังมีช่องในตัวลิงก์ผูก LINE สองช่องที่ **ไม่ได้** ใช้เครื่องหมาย `{{OWNER_INPUT:…}}` เพราะไม่ใช่ค่าคงที่ที่เจ้าของตั้งครั้งเดียว แต่เป็นค่าที่เปลี่ยนตามแต่ละครั้งที่ส่งลิงก์ จึงบันทึกไว้ที่นี่เพื่อให้รายการครบ:
The two link parts below appear in section 5. They deliberately do **not** use the `{{OWNER_INPUT:…}}` marker because they are not constants the owner sets once — they change with every link issued. They are recorded here so the inventory is complete:

| Inline value | ความหมาย / Meaning | ค่ามาจากไหน / Where it comes from | ปรากฏที่ / Where |
| :--- | :--- | :--- | :--- |
| `<โทเค็น>` / `<token>` | โทเค็นยืนยันตัวตนของลูกค้ารายนั้น — the per-customer claim token | ระบบสร้างให้ทุกครั้งที่กด "สร้าง LINE claim" และแสดงบนหน้าจอ (อายุ 48 ชั่วโมง) — generated each time staff press "สร้าง LINE claim" and shown on screen (48-hour life) | TH §5, EN §5 |
| `<รหัสร้าน>` / `<shop-id>` | ตัวระบุร้านที่ระบบใช้ตรวจว่าลิงก์ตรงกับร้านจริง — the shop identifier the system checks the link against | ค่าที่ระบบมีอยู่แล้วในโปรไฟล์/บริบทของร้าน หน้าจอไม่แสดงตัวเลขนี้ให้พนักงานเห็น — held by the system in the shop context; the screen does not display it to staff | TH §5, EN §5 |

หมายเหตุ: ข้อความบรรทัดที่อธิบายตัวเครื่องหมายเอง (ในคำนำของคู่มือทั้งสองฉบับและในไฟล์นี้) ใช้รูป `{{OWNER_INPUT:…}}` ซึ่งเป็นคำอธิบาย ไม่ใช่ช่องที่ต้องเติม และไม่นับรวมใน 6 ช่อง
Note: the lines that describe the marker itself (in both manual preambles and in this file) use the shape `{{OWNER_INPUT:…}}` — a description, not a fillable field, and not counted among the six.
