# PS01 Pricing — Owner Input Inventory
# ราคาและแพ็กเกจ PS01 — รายการช่องที่เจ้าของต้องเติมเอง

This file lists every placeholder used anywhere in the three PS01 pricing/runbook documents, each with a one-line explanation.
ไฟล์นี้รวบรวมช่องที่ต้องให้เจ้าของเติมเองทุกช่องที่ปรากฏในเอกสารราคาและคู่มือซ้อมของ PS01 พร้อมคำอธิบายหนึ่งบรรทัด

Marker / เครื่องหมายที่ใช้: **`{{OWNER_INPUT:…}}`** (ชื่อช่องเป็นตัวพิมพ์ใหญ่ทั้งหมด) — one consistent marker across all three files.
This template mention is the marker's own description, not a fillable field; the two fillable names are listed in the table below.
ข้อความบรรทัดนี้เป็นการอธิบายตัวเครื่องหมายเอง ไม่ใช่ช่องที่ต้องเติม — ช่องที่ต้องเติมมี 2 ช่องตามตารางด้านล่าง
Placeholders are unfilled on purpose: no web address, no support channel, no email, no phone number, no LINE id and no business name is invented anywhere.
ช่องทั้งหมดถูกเว้นว่างไว้โดยเจตนา เอกสารไม่กำหนดที่อยู่เว็บ ช่องทาง support อีเมล เบอร์โทร LINE ID หรือชื่อธุรกิจขึ้นเอง

Total distinct placeholders / จำนวนช่องที่ไม่ซ้ำกัน: **2**

| # | Placeholder | ต้องเติมอะไร / What to fill in | ปรากฏที่ / Where it appears | ความถี่ / Count |
| :--: | :--- | :--- | :--- | :--: |
| 1 | `{{OWNER_INPUT:APP_URL}}` | ที่อยู่เว็บจริงของผลิตภัณฑ์ ที่พนักงานเปิดใช้ระบบ และที่เจ้าของร้านใช้เปิดหน้าจอ — the product's real web address, used by staff and by the shop owner to open the screens | TH §1, TH §9 · EN §1, EN §9 · Runbook §0, §1, §4 | 9 |
| 2 | `{{OWNER_INPUT:SUPPORT_CONTACT}}` | ช่องทางติดต่อแบบข้อความสำหรับคำถามเรื่องแพ็ก ราคา และการแจ้งปัญหา — the written support channel for package, pricing and problem reports | TH §10, TH §11 · EN §10, EN §11 · Runbook §12 | 5 |

Total occurrences across the three files / จำนวนครั้งที่ปรากฏในเอกสารทั้งสามไฟล์: **14** (5 in the Thai pricing file, 5 in the English pricing file, 4 in the Thai runbook).

Notes for the Owner / หมายเหตุถึงเจ้าของ

1. `{{OWNER_INPUT:APP_URL}}` ยังเว้นว่างเพราะรีโพซิทอรีไม่ยืนยันที่อยู่เว็บจริงของผลิตภัณฑ์ (สถานะในเอกสารความพร้อมเชิงพาณิชย์ยังไม่ติ๊ก และโบรชัวร์ระบุว่า "production web address not confirmed") ถ้าเปลี่ยนที่อยู่ภายหลัง ต้องแก้ทั้งสามไฟล์พร้อมกัน
   `{{OWNER_INPUT:APP_URL}}` is blank because the repository confirms no real product web address (the commercial-readiness checklist is unticked and the one-pager says "production web address not confirmed"). If the address changes later, update all three files together.
2. `{{OWNER_INPUT:SUPPORT_CONTACT}}` ยังเว้นว่างเพราะไม่มีช่องทาง support ที่ยืนยันแล้วในรีโพซิทอรี และการช่วยเหลือถูกกำหนดให้เป็นแบบข้อความเท่านั้น (ไม่มี live call)
   `{{OWNER_INPUT:SUPPORT_CONTACT}}` is blank because the repository holds no confirmed support channel, and support is fixed as text-only (no live call).
3. **ไม่มีช่องสำหรับราคา** เพราะราคาทุกตัวในเอกสารถูกคัดมาจากเอกสารที่อนุมัติแล้ว (Owner Addendum A-2) ไม่ใช่ค่าที่เจ้าของต้องเติมใหม่ การกำหนดราคาเป็นอำนาจของเจ้าของแต่เพียงผู้เดียว และต้องผ่านการอนุมัติเป็นลายลักษณ์อักษรก่อนจึงจะแก้เอกสารได้
   **There is no field for price**, because every price in the documents is quoted from already-approved documents (Owner Addendum A-2) rather than filled in again. Pricing is the owner's decision alone and requires explicit approval before any document is changed.
4. `{{OWNER_INPUT:APP_URL}}` ทำหน้าที่เป็นที่อยู่สำหรับเปิดระบบเท่านั้น **ไม่ได้** ทำหน้าที่เป็นลิงก์ซื้อ เพราะผลิตภัณฑ์ยังไม่มีช่องทางชำระเงิน และเอกสารทั้งสามไฟล์ไม่มีปุ่มหรือลิงก์ที่ทำท่าจะซื้อ
   `{{OWNER_INPUT:APP_URL}}` serves only as the address for opening the system; it is **not** a purchase link, because the product has no payment channel and none of the three files contains a button or link that pretends to buy.

Inline values (not owner constants) / ค่าในตัวขั้นตอน (ไม่ใช่ค่าคงที่ของเจ้าของ)

นอกจาก 2 ช่องข้างบน คู่มือซ้อมยังมีค่าสองตัวที่ **ไม่ได้** ใช้เครื่องหมาย `{{OWNER_INPUT:…}}` เพราะไม่ใช่ค่าคงที่ที่เจ้าของตั้งครั้งเดียว แต่เป็นค่าที่ระบบสร้างขึ้นใหม่ทุกครั้ง จึงบันทึกไว้ที่นี่เพื่อให้รายการครบ:
Besides the two fields above, the runbook contains two values that deliberately do **not** use the `{{OWNER_INPUT:…}}` marker because they are not constants the owner sets once — the system generates them afresh each time. They are recorded here so the inventory is complete:

| Value | ความหมาย / Meaning | ค่ามาจากไหน / Where it comes from | ปรากฏที่ / Where |
| :--- | :--- | :--- | :--- |
| โทเค็นผูก LINE / the LINE claim token | โทเค็นยืนยันตัวตนของลูกค้ารายนั้น | ระบบสร้างให้ทุกครั้งที่กด "สร้าง LINE claim" และแสดงบนหน้าจอ อายุ 48 ชั่วโมง ห้ามบันทึกหรือส่งต่อ / generated each time staff press "สร้าง LINE claim", shown on screen, 48-hour life, never recorded or forwarded | Runbook §4 |
| รหัสร้าน / the shop identifier | ตัวระบุร้านที่ตัวลิงก์ผูก LINE ต้องใช้ตรวจว่าตรงกับร้านจริง | ค่าที่ระบบมีอยู่แล้ว **หน้าจอไม่แสดงให้พนักงานเห็น** จึงต้องให้ผู้ให้บริการเตรียมลิงก์สำเร็จรูปหรือรูป QR ให้ / held by the system and **not displayed to staff**, so the provider must supply a ready-made link or QR | Runbook §4, §11 |

หมายเหตุ: ข้อความบรรทัดที่อธิบายตัวเครื่องหมายเอง (ในคำนำของเอกสารทั้งสามไฟล์และในไฟล์นี้) ใช้รูป `{{OWNER_INPUT:…}}` ซึ่งเป็นคำอธิบาย ไม่ใช่ช่องที่ต้องเติม และไม่นับรวมใน 2 ช่อง
Note: the lines that describe the marker itself (in each document's preamble and in this file) use the shape `{{OWNER_INPUT:…}}` — a description, not a fillable field, and not counted among the two.
