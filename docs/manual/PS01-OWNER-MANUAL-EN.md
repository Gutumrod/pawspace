# PawSpace / Pawstia PMS (PS01) Shop-Owner Manual — English edition
# คู่มือเจ้าของร้าน PawSpace / Pawstia PMS (PS01) — ฉบับภาษาอังกฤษ

> This manual states only what this repository actually documents. Every step cites the source file it was checked against.
> The Thai edition lives at `docs/manual/PS01-OWNER-MANUAL-TH.md` — both editions have the same numbered sections in the same order.
> Fields the shop owner must fill in use one marker throughout: `{{OWNER_INPUT:...}}` (full list in `docs/manual/PS01-MANUAL-OWNER-INPUTS.md`).

---

## 1. What the product is and who it is for

PawSpace / Pawstia PMS is an operating system for **pet hotels and pet daycare centres**, focused on a single location in V1. It has three pillars: a room matrix with a booking engine that prevents double-booking, a Daily Care Report with photos delivered into the pet owner's LINE chat, and an export replica of customer and booking data that lives in the shop's own Google Sheet.
(Source: `README.md` section Product Positioning · `docs/PRD.md` §1 and §3 · `docs/PRODUCT_ONE_PAGER.md`)

The main users are the shop owner and front-desk staff working in a browser on an iPad, phone or shop computer. Pet owners do not install anything: they receive reports inside the LINE app they already use.
(Source: `docs/ONBOARDING_SOP.md` opening lines · `app/login/page.tsx`)

V1 deliberately leaves out clinic and pharmacy workflows, grooming queues, automated slip verification and e-tax billing, Google Drive photo sync, and multi-branch control.
(Source: `docs/PRD.md` §2 Non-Goals)

A note on names: the repository and the live screens still use the internal names **PawSpace / PS01**, while the commercial-name candidate is **Pawstia PMS**, which has not yet passed formal trademark clearance.
(Source: `README.md` Brand status · `docs/COMMERCIAL_READINESS.md` section Brand)

The shop name customers see, and the web address your staff open, come from the shop profile, so the owner must decide these values: shop name `{{OWNER_INPUT:SHOP_NAME}}` and app address `{{OWNER_INPUT:APP_URL}}`.

---

## 2. Signing in and the staff roles

1. Open a browser (Safari or Chrome on an iPad both work) and go to `{{OWNER_INPUT:APP_URL}}`. The system sends you to the sign-in page titled **PawSpace — Pet Hotel Operations**, headed "เข้าสู่ระบบสำหรับพนักงาน".
   (Source: `app/login/page.tsx`)
2. Enter the **Email** and **Password**, then press **"เข้าสู่ระบบ"**. Authentication is Supabase Auth with email and password. If either value is wrong the page shows a message asking you to check the email or password again.
   (Source: `app/login/page.tsx` · `app/actions/auth.ts` · `docs/PRD.md` §9)
3. After a successful sign-in the system opens the main operations screen, **PawSpace — Operations**. It has five tabs in this order: **ภาพรวม (Overview) · การจอง (Bookings) · ลูกค้า & สัตว์ (Customers & Pets) · Daily Report · ตั้งค่าร้าน (Shop settings)**, with an **"ออกจากระบบ"** (sign out) button at the top right. The left sidebar shows the shop name, your name, your role, and today's "Business date" in the Asia/Bangkok timezone.
   (Source: `app/page.tsx` · `app/operations-client.tsx` navigation and sidebar)
4. There are three roles — **owner · manager · staff** — and permissions are enforced in the database, not merely hidden on screen:
   * **owner** — everything, including staff management (invite, disable, remove, change role). Only an owner sees that panel.
   * **manager** — can run bookings, rooms, customers, pets, reports, LINE reset and Google Sheets connection, but cannot manage staff.
   * **staff** — can run the whole front-desk workflow (book, check in, check out, add customers and pets, send reports, mark a room clean) but cannot change room settings, reset LINE links, or touch integrations. The screen tells them: "สิทธิ์ Staff ใช้งาน core operations ได้ แต่ไม่มีสิทธิ์ตั้งค่าห้องหรือ integration" (staff may use core operations but may not change rooms or integrations).
   (Source: `docs/PRD.md` §9 permission matrix · `app/operations-client.tsx` `canManage` / `isOwner` and the Shop settings tab · `app/actions/line-claim.ts` and `app/actions/operations.ts` for server-side enforcement)
5. **Adding a staff member:** the owner opens **ตั้งค่าร้าน**, finds the **Staff management** card, fills in email, name and an optional temporary password, picks a role and presses **"Invite"**. The staff list then offers **Disable / Enable** and a role dropdown.
   (Source: `app/operations-client.tsx` Staff management card)
6. Two owner/manager screens sit alongside the operations screen: the **owner dashboard** at `/dashboard` (room status, today's bookings, today's reports, package and quota usage) and the **Onboarding Hub** at `/onboarding` (room setup, CSV customer import, staff setup, shop profile). Staff-role users cannot open either screen.
   (Source: `app/dashboard/page.tsx` · `app/onboarding/page.tsx` and `app/onboarding/OnboardingClient.tsx`)

---

## 3. Setting up rooms

1. Open the **ตั้งค่าร้าน** tab (owner or manager only). The **Room setup** card appears there.
   (Source: `app/operations-client.tsx` Shop settings tab)
2. Fill in all four fields for the new room:
   * **เลขห้อง (Room number/name)** — a number or a name, your choice
   * **ประเภท (Type)** — one of `Standard` · `Deluxe` · `VIP` · `Cat Condo`
   * **ความจุ (Capacity)** — the maximum number of pets the room accepts, at least 1
   * **ราคาต่อคืน (Price per night)** — the room's base rate; 0 is allowed if you do not want to use figures yet
   (Source: `app/operations-client.tsx` Room setup card · `docs/SYSTEM_ARCHITECTURE.md` `rooms` table (`room_type`, `capacity_pets`, `base_price_per_night`))
3. Press **"เพิ่มห้อง"** (add room). On success the notice reads "เพิ่มห้อง สำเร็จ" and the room appears on the Overview tab immediately.
   (Source: `app/operations-client.tsx` `run` helper and `createRoomAction`)
4. For bulk room setup, an owner or manager can open the **Onboarding Hub** at `/onboarding`, tab **🚪 Room Matrix Setup**, which offers the same **Add New Room to Matrix** form plus a count of existing rooms. In that form capacity is capped at 10 pets.
   (Source: `app/onboarding/OnboardingClient.tsx` Room Matrix Setup tab)
5. **Editing a room** — on each room card in the ตั้งค่าร้าน tab, change the number, type, capacity or price and press **"บันทึก config"** (save config).
   (Source: `app/operations-client.tsx` room edit form · `app/actions/operations.ts` `updateRoomAction`)
6. **Closing a room for maintenance** — in the same card, set the "from" and "until" dates and press **"บันทึก maintenance"**, or press **"Clear"** to remove the window. The rules require both dates together or neither: a single-sided entry is rejected, and a maintenance window covering the current period cannot be written over an occupied or cleaning room.
   (Source: `app/operations-client.tsx` maintenance form · `docs/PRD.md` §3.1 · `docs/SYSTEM_ARCHITECTURE.md` `rooms` table and test matrix #4, #14A)
7. The room statuses staff see on the **ภาพรวม** cards are **ว่าง (available) · มีสัตว์พัก (occupied) · รอทำความสะอาด (cleaning) · ปิดปรับปรุง (maintenance)**. Available reads green, cleaning orange, maintenance grey.
   (Source: `app/operations-client.tsx` `roomStatusLabel` · `docs/PRODUCT_ONE_PAGER.md` Visual Room Matrix feature)
8. **Room quota:** the product documents cap the Starter package at 10 rooms and leave Pro unlimited; the system enforces this at the database boundary. If a new room will not save, check the shop's package first.
   (Source: `docs/PRD.md` §11 · `docs/BUSINESS_MODEL.md` §2)

---

## 4. Adding a customer and their pets

1. Open the **ลูกค้า & สัตว์** tab and use the **"เพิ่มลูกค้า"** (add customer) form.
   (Source: `app/operations-client.tsx` Customers & Pets tab)
2. **ชื่อ (first name)** and **โทรศัพท์ (phone)** are required; **นามสกุล · เบอร์ฉุกเฉิน · ที่อยู่** (last name, emergency phone, address) are optional. Press **"บันทึกลูกค้า"**; success shows "เพิ่มลูกค้า สำเร็จ".
   (Source: `app/operations-client.tsx` customer form · `app/actions/operations.ts` `createOwnerAction` · `docs/SYSTEM_ARCHITECTURE.md` `pet_owners` table)
3. The phone number must be unique within the shop, because the database enforces that. The system owns the customer's LINE identifiers, so staff never type LINE fields by hand.
   (Source: `docs/SYSTEM_ARCHITECTURE.md` `pet_owners` table (`UNIQUE (shop_id, phone)`, LINE fields system-controlled) · `docs/PRD.md` §8)
4. **Adding that customer's pet** — use the inline form at the bottom of the customer's card: enter the **ชื่อสัตว์ (pet name)**, pick **ชนิด (species: dog or cat)**, add breed, special care notes and allergies, then press **"+ เพิ่มสัตว์"**.
   (Source: `app/operations-client.tsx` pet form inside the customer card · `app/actions/operations.ts` `createPetAction`)
5. **Editing a pet** — each pet card has a form for name, species, breed, gender, birth date, weight, special care notes and allergies, saved with **"บันทึกสัตว์"**. Fill the care notes and allergies carefully: they are what the caregiver relies on during the stay.
   (Source: `app/operations-client.tsx` pet edit form · `docs/SYSTEM_ARCHITECTURE.md` `pets` table (`special_care_notes`, `allergies`))
6. **Editing a customer** — change name, phone or address on the customer card and press **"บันทึกข้อมูล"**.
   (Source: `app/operations-client.tsx` customer edit form)
7. **If you already keep the guest list elsewhere:** an owner or manager can open the **Onboarding Hub** at `/onboarding`, tab **📥 CSV Data Import**, paste CSV data (the **Load Sample CSV** button shows the expected columns), press **"Validate & Preview (Zero DB Writes)"** to review without writing, then press **"Confirm & Import"**. The preview flags invalid rows and rows whose phone number already belongs to a different customer name in this shop.
   (Source: `app/onboarding/OnboardingClient.tsx` CSV Data Import tab)

---

## 5. Linking a pet owner's LINE

1. Go to the **ลูกค้า & สัตว์** tab. Each customer card shows the LINE state as **linked** or **not linked**, next to a **"สร้าง LINE claim"** button.
   (Source: `app/operations-client.tsx` customer card)
2. Press **"สร้าง LINE claim"**. The system generates a verification token for that customer and reports "สร้าง LINE claim token แล้ว · อายุ 48 ชั่วโมง" (48-hour lifetime), displaying it in the **LINE claim token** box, which warns: "แสดงเฉพาะครั้งนี้เพื่อส่งเข้า claim flow ห้ามบันทึกลง log" — shown once, never log it.
   (Source: `app/operations-client.tsx` LINE claim token box · `app/actions/line-claim.ts` (`expiresInHours: 48`) · `docs/PRD.md` §8 (48-hour TTL, hash-only storage, no plaintext logging))
3. To hand it over, send the customer the LINE claim link built from that token plus the shop identifier, using the `token` and `shop` parameters of the `/line/claim` page — for example `{{OWNER_INPUT:APP_URL}}/line/claim?token=<token>&shop=<shop-id>`.
   (Source: `app/line/claim/page.tsx` (`searchParams.token`, `searchParams.shop`))
4. The customer opens that link on their phone. The page is titled **"เชื่อม LINE กับ PawSpace"** and runs automatically through LINE LIFF: it asks the customer to log in to LINE, then verifies the identity. Success shows **"เชื่อม LINE สำเร็จแล้ว สามารถปิดหน้านี้ได้"**; an expired, already-used or wrong-shop link shows **"ลิงก์นี้หมดอายุ ถูกใช้แล้ว หรือไม่ตรงกับร้าน กรุณาขอลิงก์ใหม่"**.
   (Source: `app/line/claim/page.tsx` · `app/line/claim/LineClaimClient.tsx` · `app/api/line/claim/route.ts` · `docs/PRD.md` §8)
5. **When a customer changes LINE accounts or needs re-linking:** an owner or manager presses **"Reset LINE"** on that customer's card (a confirmation box appears first) and then issues a new claim. Staff-role users do not see the button, and the server rejects the request from staff anyway.
   (Source: `app/operations-client.tsx` Reset LINE button gated by `canManage` · `app/actions/line-claim.ts` `resetLineLinkAction` · `docs/PRD.md` §8)
6. The claim token is stored and validated server-side only. Staff never type or transmit the customer's LINE credentials, and the token should not be copied into notebooks, chat threads or log files.
   (Source: `docs/PRD.md` §8 · `docs/SYSTEM_ARCHITECTURE.md` §2 and the `pet_owners` table)

> **Where the older guide and the code disagree:** the existing quick-start guide (`docs/ONBOARDING_SOP.md` §1) tells staff to have the customer **scan a QR code**, but nothing in this repository generates a QR image (a repository-wide search finds the word QR only in that SOP document), and the real screen in `app/operations-client.tsx` displays the **token as text**, not a QR image. This manual therefore follows the code: staff send the **claim link** for the customer to open on their phone. If the shop wants an actual QR code, the provider must add a QR generator first.

---

## 6. Creating a booking and checking in

1. Open the **การจอง** tab. At the top, a panel titled **"คำขอจองจากลูกค้าทาง LINE (n)"** lists customer requests waiting for a decision. Review the details (customer name, phone, requested room, dates, pets, estimated amount and any special request) and choose **"✓ ยืนยันการจอง (Confirm)"** or **"✕ ปฏิเสธ (Decline)"**; declining prompts for a reason, which may be left blank.
   (Source: `app/operations-client.tsx` booking-request panel · `app/actions/booking.ts` `confirmBookingRequestAction` / `declineBookingRequestAction` · `docs/CURRENT_STATUS.md` (Customer LINE request → Staff confirmation flow))
2. **Creating a booking yourself:** use the **"สร้างการจอง"** form in the same tab. Pick the **ลูกค้า (customer)**, the **ห้อง (room)**, set **Check-in** (defaults to today) and **Check-out**, add a total amount and any special request, then press **"สร้าง Booking"**.
   (Source: `app/operations-client.tsx` booking form · `docs/ONBOARDING_SOP.md` §2)
3. **Putting pets in the room:** on a booking card in `confirmed` status, choose one of that customer's pets from the **"เลือกสัตว์"** dropdown and press **"เพิ่มสัตว์"**. To take a pet out, press **"ถอด <pet name>"**. Both actions are available only while the booking is still `confirmed`.
   (Source: `app/operations-client.tsx` add/remove pet buttons · `docs/PRD.md` §3.4 (removal only while confirmed) · §3.1 (every pet in a booking must belong to the same owner))
4. **Moving dates or changing room:** on a `confirmed` booking the inline form below offers **ห้อง · Check-in · Check-out · ยอดรวม**; edit and press **"บันทึกกำหนดการ"**. The system re-checks room overlap, the maintenance window and room capacity every time.
   (Source: `app/operations-client.tsx` schedule form · `docs/PRD.md` §3.3)
5. **Checking in when the pet arrives:** confirm the room is free and the booking holds at least one pet (the Check-in button stays disabled with none), then press **"Check-in"** on the booking card. The booking becomes `checked_in` and the room becomes **มีสัตว์พัก (occupied)**. Check-in is only accepted on the booking's own check-in date, measured in the Asia/Bangkok business timezone, and only into an available room.
   (Source: `app/operations-client.tsx` Check-in button · `docs/PRD.md` §3.3 (Decision A1) · `docs/SYSTEM_ARCHITECTURE.md` test matrix #6, #7, #8)
6. **If a customer arrives early:** first change the check-in date to today (step 4), then check in. The system re-validates the room and the pets for you.
   (Source: `docs/ONBOARDING_SOP.md` §2 · `docs/PRD.md` §3.3)
7. **Cancelling a booking:** press **"Cancel"** on the booking card and confirm the prompt. Cancellation is only possible before check-in, never afterwards, and a finished status can never be rolled back.
   (Source: `app/operations-client.tsx` Cancel button · `docs/PRD.md` §3.3 points 3 and 4)

---

## 7. Sending the Daily Report with photos

1. Open the **Daily Report** tab and use the **"สร้าง Daily Report"** form. If no pet is currently staying, the send button stays disabled.
   (Source: `app/operations-client.tsx` Daily Report tab)
2. Choose the **Booking** from those currently staying (only `checked_in` bookings are listed) and the **สัตว์ (pet)** that belongs to that booking.
   (Source: `app/operations-client.tsx` Booking and pet fields · `docs/PRD.md` §6 (a report can only be created for a pet actually in that booking))
3. Tick the three status groups as you actually observed them:
   * **อาหาร (food)** — `กินหมด` · `ครึ่งหนึ่ง` · `กินน้อย` · `ไม่กิน`
   * **ขับถ่าย (excretion)** — `ปกติ` · `ถ่ายเหลว` · `ยังไม่ถ่าย`
   * **อารมณ์ (mood)** — `ร่าเริง` · `สงบ` · `เครียด`
   (Source: `app/operations-client.tsx` food/excretion/mood selects · `app/api/daily-reports/route.ts` accepted values)
4. Optionally type a short **Note** (up to 4,000 characters) about the pet's day.
   (Source: `app/operations-client.tsx` Note field with `maxLength={4000}` · `app/api/daily-reports/route.ts`)
5. Attach **1–4 photos**, taken now or picked from the album. At least one photo is required and more than four is rejected.
   (Source: `app/operations-client.tsx` photo field `multiple required` · `lib/daily-report-media.ts` (`DAILY_REPORT_MAX_PHOTOS = 4`) · `app/api/daily-reports/route.ts` (1–4 photo check) · `docs/PRD.md` §6)
6. Press **"สร้างและเข้าคิวส่ง LINE"** (create and queue for LINE). The notice reads **"สร้าง Daily Report แล้ว"**. Photos are uploaded into the product's storage and the report is queued for delivery into the pet owner's LINE chat.
   (Source: `app/operations-client.tsx` `submitDailyReport` · `app/api/daily-reports/route.ts` · `lib/daily-report-storage.ts` · `docs/SYSTEM_ARCHITECTURE.md` (Supabase Storage bucket `daily-report-photos`))
7. Created reports appear in the list below the form with a delivery badge **pending · sent · failed**, the retry count, and the note the staff member typed.
   (Source: `app/operations-client.tsx` report list · `docs/PRD.md` §7 (`pending → sending → sent` / `failed` lifecycle))
8. You may send several reports a day, one per care round; the system carries duplicate protection so an accidental double press does not create a second report.
   (Source: `docs/PRD.md` §5 · `app/api/daily-reports/route.ts` (`idempotencyKey`))
9. **Photos:** the product documentation places report photos and data inside the system, and **does not sync them to Google Drive** in this release — that is a future capability. Retention follows the repository's stated policy.
   (Source: `docs/PRD.md` §2 Non-Goal 4 · §7 Media Retention Policy)

> **Where the older guide and the code disagree:** the existing guide (`docs/ONBOARDING_SOP.md` §3) tells staff to press a **"ส่ง Daily Report 📸"** button **on the room card in the room matrix**, and says the system sends a LINE Flex Message immediately. The real screen in `app/operations-client.tsx` instead uses a **form on the Daily Report tab** whose button reads **"สร้างและเข้าคิวส่ง LINE"**, and the report is **queued** for a background sender rather than transmitted the instant it is submitted. This manual therefore follows the code and has staff wait for the `sent` badge. Two option labels also differ: the guide says "กินครึ่งเดียว" and "ไม่ยอมกิน", while the live screen says "ครึ่งหนึ่ง" and "ไม่กิน".

---

## 8. Checking out

1. When the owner comes to collect the pet, open the **การจอง** tab, find the booking card in `checked_in` status and press **"Check-out"**.
   (Source: `app/operations-client.tsx` Check-out button · `app/actions/booking.ts` `updateBookingStatusAction`)
2. The booking becomes `checked_out` and the room automatically becomes **รอทำความสะอาด (cleaning)**. The system does this so no new pet can be placed into a room that has not been cleaned.
   (Source: `docs/PRD.md` §3.3 point 2 · `docs/ONBOARDING_SOP.md` §4)
3. Once cleaning and disinfection are done, go back to the **ภาพรวม** tab: the cleaning room's card offers a **"Mark clean"** button. Press it, the notice reads "ทำเครื่องหมายห้องสะอาด สำเร็จ", and the room returns to **ว่าง (available)** ready for the next booking.
   (Source: `app/operations-client.tsx` Mark clean button · `app/actions/booking.ts` `markRoomCleanAction` · `docs/ONBOARDING_SOP.md` §4 point 3)
4. Check-out is not date-restricted and can happen at any time; once a booking is checked out it cannot be rolled back, whereas check-in remains bound to the scheduled date.
   (Source: `docs/PRD.md` §3.3)

---

## 9. The Google Sheets export replica and what it does not include

1. **Connecting for the first time** (owner or manager only): open the **ตั้งค่าร้าน** tab and find the **Google Sheets** card, captioned "Verified proof-of-control เท่านั้น · PawSpace_Config!B1".
   (Source: `app/operations-client.tsx` Google Sheets card)
2. Press **"สร้าง verification token"**. The system generates a proof-of-control token for the sheet, valid for **15 minutes**, and displays it for copying.
   (Source: `app/actions/google-sheet.ts` (`expiresInSeconds: 900`) · `docs/SYSTEM_ARCHITECTURE.md` §8 Proof-of-Control Binding (15-minute TTL))
3. Paste the token into cell **`PawSpace_Config!B1`** of the Google Sheet you want to connect, then come back and paste the **Google Sheet ID** into the field labelled "Google Sheet ID หลังวาง token ที่ B1" and press **"Verify & bind"**.
   (Source: `app/operations-client.tsx` bind form · `docs/SYSTEM_ARCHITECTURE.md` §8)
4. Once connected, the **ภาพรวม** tab's KPI card shows **"เชื่อมแล้ว"** for Google Sheets, and a **"Disconnect"** button becomes available to undo the connection later.
   (Source: `app/operations-client.tsx` KPI and Disconnect button · `app/actions/google-sheet.ts` `disconnectGoogleSheetAction`)
5. **What the replica contains** — the destination workbook has two sheets:
   * **Customers** — one row per pet, with columns `Record_ID` (the pet identifier), `Pet_Name`, `Species`, `Breed`, `Gender`, `Birth_Date`, `Weight_kg`, `Avatar_URL`, `Special_Care_Notes`, `Allergies`, `Owner_ID`, `Owner_First_Name`, `Owner_Last_Name`, `Owner_Phone`, `Owner_Emergency_Phone`, `Owner_Address`, `Created_At`
   * **Bookings** — columns `Record_ID` (the booking identifier), `Owner_ID`, `Owner_Name`, `Room_ID`, `Room_Number`, `Room_Type`, `Check_In_Date`, `Check_Out_Date`, `Booking_Status`, `Total_Amount`, `Special_Requests`, `Pet_IDs`, `Pet_Names`, `Created_At`
   (Source: `lib/google-sheet-records.ts` (`CUSTOMER_HEADERS`, `BOOKING_HEADERS`, `CUSTOMER_SHEET_NAME`, `BOOKING_SHEET_NAME`) · `docs/PRD.md` §10)
6. **The copy flows one way.** The product database is authoritative and the Google Sheet is an export replica: edits made in the sheet never flow back, and each worker pass re-reads the source of truth before writing, so rows carry the latest values (a row for a deleted pet converges to a delete).
   (Source: `docs/PRD.md` §10 · `docs/SYSTEM_ARCHITECTURE.md` §8 V1 Worker Ordering Contract · `lib/google-sync-worker-core.ts`)
7. **What the replica does not include (and must not be treated as replacing the system):**
   * **No Daily Care Report or report photos** — neither the reports nor the images are in the replica.
   * **No staff, role or permission data.**
   * **No package, billing or payment-collection data.**
   * **No camera data,** and **no photo backup to Google Drive** in this release.
   * **No other shop settings** beyond the columns listed above.
   (Source: `lib/google-sheet-records.ts` (only these two column sets) · `lib/integrations.ts` (`entityType: "pet_customer" | "booking"`) · `docs/PRD.md` §2 Non-Goal 4 · `app/dashboard/page.tsx` (integrations card))
8. **Two cautions:** a Google Sheet can be bound to only one shop in the system, and connecting a sheet clears the previous mapping and seeds a full fresh snapshot of pets and bookings the first time.
   (Source: `docs/PRD.md` §10 · `docs/SYSTEM_ARCHITECTURE.md` §8 and test matrix #44, #35)
9. **Sync timing:** the repository states no guaranteed interval (there is no documented SLA), so do not promise customers that data will appear in the sheet within a given number of seconds or minutes. Treat the product database as the live truth and the sheet as a copy that follows behind.
   (Source: `docs/SYSTEM_ARCHITECTURE.md` §8 (worker concurrency = 1 and bounded backoff, but no SLA figure) — see section 13 of the WU4 note, which records this as behaviour that could not be verified from the repository)

---

## 10. What to do when LINE delivery fails

1. The report data is **not lost** when delivery fails: the report is stored in the system before it is queued, and it is shown with a **failed** badge and a retry count.
   (Source: `docs/ONBOARDING_SOP.md` §3 point 7 · `docs/PRD.md` §7 · `app/operations-client.tsx` report list)
2. On the **Daily Report** tab, any report in **failed** status offers a **"Retry delivery"** button. Press it to resend immediately; the system reuses the same duplicate-protection key for that report so the pet owner does not receive the message twice.
   (Source: `app/operations-client.tsx` Retry delivery button · `app/actions/daily-report.ts` `retryDailyReportDeliveryAction` · `docs/PRD.md` §7)
3. If retrying still fails, check these two things in order:
   * **Is the customer's LINE linked?** Go to the **ลูกค้า & สัตว์** tab and look for **linked** or **not linked** on that customer's card. If it is not linked, follow section 5 (create a LINE claim, or Reset LINE).
   * **Is the shop's LINE configured?** The KPI card on the **ภาพรวม** tab shows **LINE configured / not configured**. If it says *not configured*, the problem is system-side configuration rather than the report itself — raise it with the provider through the text channel in section 11.
   (Source: `app/operations-client.tsx` LINE KPI · `docs/PRD.md` §7 (the worker routes by shop and the recipient is the linked owner) · `docs/SYSTEM_ARCHITECTURE.md` §8 LINE Delivery)
4. A failed report stays viewable in the system, so there is no need to re-shoot the photos. If you must reach the pet owner before delivery succeeds, use your shop's own other channels as a temporary measure.
   (Source: `docs/ONBOARDING_SOP.md` §3 point 7 · `app/operations-client.tsx` report list showing stored reports)

---

## 11. Support: text message only

1. **Support for this product is answered by written message only** (ticket, bug report, written explanation). **There is no live call or scheduled live session**, and consulting or installation work is not included in the price.
   (Source: locked rule L-13 in `D:/AI-Workspace/vault/06-Agent-Logs/WSTERA-House/PLAN-HOUSE-LOCKED-v1-2026-09-25.md`, line L-13)
2. **Contact channel:** `{{OWNER_INPUT:SUPPORT_CONTACT}}` — the product owner must supply this value. This manual deliberately does not invent an email address, phone number, LINE ID or business name, because the repository has no confirmed support channel yet (the project log records `SUPPORT_EMAIL` and `LINE_OA_ID` as still awaiting an owner decision).
   (Source: `docs/PRODUCT_ONE_PAGER.md` contact block still marked `TBD` · `docs/COMMERCIAL_READINESS.md` section Operations ("Customer support process active" not ticked) · `D:/AI-Workspace/vault/06-Agent-Logs/WSTERA-House/STATUS-HOUSE.md` item O-4)
3. **Response hours:** `{{OWNER_INPUT:SUPPORT_HOURS}}` — also to be supplied by the owner. The repository commits to no response time, so do not promise customers a window before the owner sets one.
4. **What to include in a support message** so it can be resolved quickly: the tab and screen where it happened, the customer, pet or booking in question, the exact error text on screen (for example the `failed` badge with its retry count), and the time it occurred. **Never send LINE claim tokens, passwords or any secret through chat channels.**
   (Source: `app/operations-client.tsx` warning inside the token box · locked rule L-11 in `PLAN-HOUSE-LOCKED-v1-2026-09-25.md` (secrets live only in host/`.secrets`))

---

## 12. Payment and packages

1. **This product does not collect payment yet.** There is no checkout screen and no billing system, so **buying a package is not available**, and the product does not take money from shops or from pet owners.
   (Source: `docs/COMMERCIAL_READINESS.md` section Before Paid Launch ("Payment collection absent") · `docs/CURRENT_STATUS.md` ("Payment/deposit remains deferred") · `docs/PS01-PRICING-A2-IMPLEMENTATION-2026-09-26.md` ("the current app has no customer pricing/checkout page"))
2. **The prices the repository documents** (per Owner Addendum A-2, dated 2026-09-26) are listed below, and **these prices can change**. The figures are quoted exactly as the documents record them, with no rounding and no currency conversion:
   * **Starter** — **590 THB / 17 USD per month** (10 rooms and 300 pet records)
   * **Pro** — **990 THB / 28 USD per month** (unlimited rooms and pet records)
   * **Enterprise** — **not for sale**
   * **No annual plan** — annual pricing is not approved
   (Source: `docs/BUSINESS_MODEL.md` §2 · `docs/PRD.md` §11 · `D:/AI-Workspace/vault/06-Agent-Logs/WSTERA-House/STATUS-HOUSE.md` Addendum A-2 · `docs/PS01-PRICING-A2-IMPLEMENTATION-2026-09-26.md`)
3. **Where to see the shop's package and entitlements:** an owner or manager opens the **dashboard** at `/dashboard`. The **Plan & Entitlements** card shows the package name, rooms used against the quota, pet records used, and the billing status; the **Subscription lifecycle** card shows the trial end, current period end and grace period end.
   (Source: `app/dashboard/page.tsx`)
4. **Still to be supplied by the owner:** the provider's legal entity name `{{OWNER_INPUT:PROVIDER_LEGAL_NAME}}` and a data-protection contact `{{OWNER_INPUT:PRIVACY_CONTACT}}`, because the repository's terms and privacy documents are still drafts with those fields left blank.
   (Source: `docs/TERMS_AND_PRIVACY.md` (legal entity/operator TBD) · `D:/AI-Workspace/vault/06-Agent-Logs/WSTERA-House/STATUS-HOUSE.md` (the L-15 draft still awaits owner input))

---

## 13. FAQ

**Q: Does the customer need to install an app?**
No. Customers receive reports and view photos inside the LINE app they already use; they open a verification link once to link the account.
(Source: `docs/ONBOARDING_SOP.md` FAQ · `app/line/claim/page.tsx`)

**Q: Where are customer and booking data stored?**
The live data sits in the product database, with a one-way export replica into the shop's Google Sheet, as described in section 9.
(Source: `docs/ONBOARDING_SOP.md` FAQ · `docs/PRD.md` §10)

**Q: Can I send more than one report per day for the same pet?**
Yes, the number of daily reports is not capped, and the system guards against accidental duplicate submissions.
(Source: `docs/PRD.md` §5)

**Q: What if the LINE linking link has expired?**
Issue a new claim for the customer, or — if the customer switched LINE accounts — have an owner or manager press "Reset LINE" and then issue a new claim.
(Source: `docs/PRD.md` §8 · `app/operations-client.tsx` Reset LINE button)

**Q: Can a booking be cancelled after check-in?**
No. Cancellation is possible only before check-in, and a terminal status (checked out or cancelled) can never be reversed.
(Source: `docs/PRD.md` §3.3 points 3 and 4)

**Q: Is there an annual plan?**
Not yet. Annual pricing is not approved and the product does not collect payment at all.
(Source: `docs/PRD.md` §11 · `docs/PS01-PRICING-A2-IMPLEMENTATION-2026-09-26.md`)

**Q: How long are report photos kept?**
The repository documents a media retention policy of 30 days after the end of the contract, but there is no document confirming the actual setting in the environment a shop runs on, so confirm the current policy with the provider before promising retention to a customer.
(Source: `docs/PRD.md` §7 Media Retention Policy · section 13 of `docs/house-swarm-5a/WU4-MANUAL.md` records this as behaviour that could not be verified from the repository)
