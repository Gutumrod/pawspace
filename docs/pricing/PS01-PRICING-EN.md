# PawSpace / Pawstia PMS (PS01) — Pricing and packages (English edition)
# PS01 — ราคาและแพ็กเกจ (ฉบับภาษาอังกฤษ)

> This document is the **pricing and packages** summary for PS01, written for conversations with shops and for checking against the product's real screens.
> Every figure here is quoted from exactly two places in the repository: `docs/BUSINESS_MODEL.md` §2 (Addendum A-2, owner-approved 2026-09-26) and `lib/entitlements.ts` (`CANONICAL_PACKAGES`). No figure was invented, rounded, or currency-converted.
> The Thai edition is `docs/pricing/PS01-PRICING-TH.md` — both editions have the same numbered sections in the same order.
> Fields the shop owner or the product owner must fill in use one consistent marker across both editions: `{{OWNER_INPUT:...}}` (the full list is in `docs/pricing/PS01-PRICING-OWNER-INPUTS.md`).

---

## 1. What this document is, and where the prices come from · เอกสารนี้คืออะไร และราคามาจากไหน

This document summarises what is actually for sale in the current version of PS01 (a pet-hotel operating system), together with the limits the repository really enforces. It is not advertising copy.

The prices shown are **monthly**, in two currencies the owner approved separately (Thai baht and US dollars). The US-dollar figures are approved constants, not the result of a currency conversion, and they are not stored in the package catalog database.
(Source: `docs/BUSINESS_MODEL.md` §2 — "THB และ USD เป็นราคาคงที่แยกกัน ไม่แปลงค่าเงินอัตโนมัติ … USD ยังไม่อยู่ใน schema ของ catalog" [THB and USD are separate fixed prices, no automatic conversion; USD is not yet in the catalog schema] · `supabase/migrations/20260926120000_ps01_pricing_a2.sql`, which updates only the baht price and adds no USD column)

This document is **not yet published as a public web page**, because the product's real web address is not confirmed anywhere in the repository.
(Source: `docs/COMMERCIAL_READINESS.md`, Brand section — "Production web address/routing confirmed" is still unchecked · `docs/PRODUCT_ONE_PAGER.md` — "production web address not confirmed")
The field to fill once the web address is confirmed: `{{OWNER_INPUT:APP_URL}}`

---

## 2. All packages at a glance · แพ็กเกจทั้งหมดในที่เดียว

| Package | Monthly price | For sale? | Rooms | Pet records | Annual price |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Starter** | **590 THB / 17 USD** | Yes | up to **10** | up to **300** | None (not approved) |
| **Pro** | **990 THB / 28 USD** | Yes | **Unlimited** | **Unlimited** | None (not approved) |
| **Enterprise** | **No price shown** | **Not for sale** | — | — | None |
| **Founding Member (C2)** | **990 THB / 28 USD** | Offer for the founding-shop group | Unlimited (Pro entitlements) | Unlimited | None (not approved) |

* The figures 590 / 17 and 990 / 28 come from two places that agree: the Addendum A-2 table in `docs/BUSINESS_MODEL.md` §2 and the `monthlyPrice` values in `lib/entitlements.ts` `CANONICAL_PACKAGES`.
* The room and pet-record limits are not just text on a page — the system enforces them at the database boundary (see section 9).
* **There is no annual option in any case** (see section 6).
* This document shows no customer counts, no ratings, no testimonials and no comparison with any named competitor, because no such real data exists in the repository and none may be invented.

---

## 3. Starter: what is included and what is not · แพ็ก Starter — มีอะไร และไม่มีอะไร

**Price:** 590 THB or 17 USD per month (no annual price)

**Included**
* Up to **10 rooms** — the system enforces this ceiling at the database; adding a room beyond it is rejected
* Up to **300 pet records** — enforced at the database as well
* Daily Care Reports with 1–4 photos, delivered into the pet owner's LINE chat
* An export replica of customer and booking data into the shop's own Google Sheets (Pet-Centric model)
* All front-desk operations: the room matrix with clash-proof booking, check-in and check-out, and room cleaning

**Not included**
* Unlimited rooms and pet records — that is the Pro entitlement
* Any premium support tier — this package defines no support tier at all
* Any future paid add-on — the system never grants that entitlement to any package and rejects payloads that claim it
* Any Enterprise entitlement, and no promise of Enterprise features later
* Anything the product deliberately does not do (clinic/pharmacy, grooming queue, automatic slip verification or e-tax invoices, Google Drive photo sync, digital pet passport, multi-camera RTSP/HLS streaming, multi-branch control — see sections 5 and 8)

(Source: `lib/entitlements.ts` `CANONICAL_PACKAGES.starter` — `monthlyPrice: 590`, `annualPrice: null`, `availableForSale: true`, `roomLimit: 10`, `petHistoryLimit: 300`, `supportTier: null` · `docs/BUSINESS_MODEL.md` §2 · `docs/PRD.md` §11 · quota enforcement: `supabase/migrations/20260825141500_phase13_subscription_lifecycle.sql` (`enforce_room_commercial_quota`, `enforce_pet_commercial_quota`) · report and sheet-replica features: `docs/PRD.md` §2 · `lib/google-sheet-records.ts`)

---

## 4. Pro: what is included and what is not · แพ็ก Pro — มีอะไร และไม่มีอะไร

**Price:** 990 THB or 28 USD per month (no annual price)

**Included**
* **Unlimited** rooms (the system applies no room ceiling to this package)
* **Unlimited** pet records (the system applies no pet-record ceiling to this package)
* Daily Care Reports with 1–4 photos, delivered into the pet owner's LINE chat
* An export replica of customer and booking data into the shop's own Google Sheets
* All front-desk operations, the same as Starter

**Not included**
* Any premium support tier — this package defines none either
* Any future paid add-on
* Any Enterprise entitlement, and no promise about future features
* Anything the product deliberately does not do (the same list as section 3 and section 8)

(Source: `lib/entitlements.ts` `CANONICAL_PACKAGES.pro` — `monthlyPrice: 990`, `annualPrice: null`, `availableForSale: true`, `roomLimit: null`, `petHistoryLimit: null`, `supportTier: null` · `docs/BUSINESS_MODEL.md` §2 · `docs/PRD.md` §11)

---

## 5. Enterprise: no price, and why · แพ็ก Enterprise — ไม่แสดงราคา เพราะอะไร

* **Status:** not for sale — this document therefore shows no price for Enterprise, not even one figure
* **Why:** the features of this package do not exist in the product yet (Source: Addendum A-2 — "Enterprise ยังไม่ขาย — ฟีเจอร์ยังไม่มีจริง" [Enterprise not for sale — the features do not exist yet])
* The system already closes this package off: the catalog sets `available_for_sale` to false for Enterprise, and the screen that reads the catalog sees only packages that are for sale
* Any attempt to assign this package to a shop is rejected outright by the database (message: `COMMERCIAL_PACKAGE_NOT_AVAILABLE`)
* This is not a "more expensive tier" for customers to choose, and it must not be offered by promising future features

(Source: `lib/entitlements.ts` `CANONICAL_PACKAGES.enterprise` — `availableForSale: false` · `supabase/migrations/20260926120000_ps01_pricing_a2.sql` — `available_for_sale = (id <> 'enterprise')`, the `commercial_packages_select_policy` policy exposes only for-sale packages to authenticated users, and `set_shop_commercial_package` raises `COMMERCIAL_PACKAGE_NOT_AVAILABLE` · `docs/BUSINESS_MODEL.md` §2 · `docs/PRD.md` §11)

---

## 6. There is no annual option at all · ไม่มีแพ็กรายปีในทุกกรณี

* **No annual option exists for any package** — Starter, Pro or Enterprise — so this document shows no annual price anywhere
* Annual prices are not owner-approved, so they must not be offered, agreed with a customer, or invented
* The system closes the route already: the annual price is cleared for every package, and an attempt to select or assign an annual billing interval is rejected with `ANNUAL_PRICE_NOT_APPROVED`
* Annual billing can only open once the owner approves a price — this document does not guess what it will be or when

(Source: `lib/entitlements.ts` — `annualPrice: null` for `starter`, `pro` and `enterprise` · `docs/BUSINESS_MODEL.md` §2 — "ราคาต่อปียังไม่ได้รับอนุมัติและห้ามเสนอหรือกำหนดเอง; migration ของ A-2 จะตั้ง `annual_price = NULL` และปิดการ assign รายปีจนกว่าจะมีราคาอนุมัติ" [annual prices are not approved and must not be offered or set; the A-2 migration sets `annual_price = NULL` and closes annual assignment until an approved price exists] · `supabase/migrations/20260926120000_ps01_pricing_a2.sql` — `annual_price = NULL` and the `ANNUAL_PRICE_NOT_APPROVED` rejection)

---

## 7. The Founding Member offer (C2) · ข้อเสนอ Founding Member (C2)

* **Price:** 990 THB / 28 USD per month (the same as the current Pro price)
* **Entitlement:** equivalent to the Pro package — unlimited rooms and unlimited pet records. The system resolves this entitlement itself when a shop holds the offer, so no ceiling has to be set by hand
* **Terms that are enforced:**
  1. The entitlement persists **only as long as the subscription does not lapse**. If that continuity lapses the system will not restore it, and refuses any attempt to reinstate it.
  2. The entitlement is bound to **one shop** and is **not transferable** to another shop.
  3. It **excludes** future paid add-ons.
* The system pins this offer to Starter + monthly billing only; any attempt to change that is rejected
* This document states no number of shops that have taken the offer, because no such data exists in the repository

(Source: `docs/BUSINESS_MODEL.md` §2 (the founding-shop benefits section) · `lib/entitlements.ts` — the `founding_member` branch returning `packageName: "Starter (Founding Member Pro)"`, `monthlyPrice: 990`, `annualPrice: null` and the Pro ceilings · `supabase/migrations/20260926120000_ps01_pricing_a2.sql` — "Founding Member must retain Starter monthly commercial identity" and "Founding Member continuity has lapsed and cannot be restored." · `supabase/migrations/20260825141500_phase13_subscription_lifecycle.sql` — the Founding entitlement resolved from still-valid continuity)

---

## 8. Payment is not part of this product yet · การชำระเงิน: ยังไม่มีในผลิตภัณฑ์นี้

* **This product does not collect money from anyone yet.** There is no checkout screen, no buy button and no purchase link, so this document **creates no button or link that pretends to buy** — doing so would mislead the reader
* The system contains only a subscription lifecycle state that gates access; it is connected to no payment provider and performs no real charge
* When a shop reaches a state without commercial access, the screen shows a **Commercial access blocked** panel and business mutations are suspended — that is a system mechanism, not a payment demand
* **What may be said to a customer today:** quote the approved prices from this document and say plainly **"waiting for a payment channel"** — payment cannot be accepted yet
* **What the product deliberately does not do** (out of scope for V1): clinic/pharmacy · grooming queue · automatic bank-slip verification and automatic receipts/tax invoices · Google Drive photo sync · digital pet passport · multi-camera RTSP/HLS streaming · multi-branch control. Following the owner's approved direction it also **adds no POS and no bathing or grooming service**; the focus is pet hotel/boarding with photo reports through LINE

(Source: `docs/COMMERCIAL_READINESS.md`, "Before Paid Launch" — "Payment collection absent. No payment/billing integration exists anywhere in the product by design" · `docs/CURRENT_STATUS.md` — "Payment/deposit remains deferred" · `docs/PS01-PRICING-A2-IMPLEMENTATION-2026-09-26.md` — "the current app has no customer pricing/checkout page" · `docs/PRD.md` §2 (Explicit Non-Goals) and §11 · `app/dashboard/page.tsx` — the Commercial access blocked panel · `lib/dashboard-service.ts` — the subscription lifecycle payload · Addendum A-2 — no POS, no bathing/grooming)

---

## 9. Where a shop sees its own package and quotas · ร้านดูแพ็กและโควตาของตัวเองได้ที่ไหน

* The **dashboard** page (owner and manager only) has a **Plan & Entitlements** card showing the package name, the offer (Founding or Standard), the lifecycle state, rooms used against the ceiling, and pet records used against the ceiling
* The **Subscription lifecycle** card on the same page shows the trial end, the current period end, the grace-period end and whether Founding continuity is valid
* The **Active Integrations & Modules** card shows the LINE and Google Sheets connection states
* The room and pet-record ceilings are enforced in the database, not merely hidden in the UI: at the ceiling, adding a room or a pet is rejected with `ROOM_QUOTA_EXCEEDED` or `PET_QUOTA_EXCEEDED`
* Address to open: `{{OWNER_INPUT:APP_URL}}`, then the system's dashboard page

(Source: `app/dashboard/page.tsx` · `lib/dashboard-service.ts` (the `entitlement` and `commercialStatus` payload shapes) · `lib/entitlements.ts` · `supabase/migrations/20260825141500_phase13_subscription_lifecycle.sql` (`enforce_room_commercial_quota`, `enforce_pet_commercial_quota`) · `docs/PRD.md` §11)

---

## 10. Owner inputs still required · สิ่งที่ต้องรอเจ้าของร้านหรือเจ้าของผลิตภัณฑ์เติม

This document does not invent the following values, because the repository holds no confirmed ones:

* `{{OWNER_INPUT:APP_URL}}` — the product's real web address (not confirmed in the repository); used in section 1 and section 9
* `{{OWNER_INPUT:SUPPORT_CONTACT}}` — the written support channel for package and pricing questions

The full list of fields, with explanations and occurrence counts, is in one file: `docs/pricing/PS01-PRICING-OWNER-INPUTS.md`
There is no field for "price", because every price in this document is quoted from already-approved documents rather than filled in again.

---

## 11. FAQ · คำถามที่พบบ่อย

1. **Is there a buy button to press?** — No, and this document creates none. The product has no payment system yet (section 8).
2. **Can payment be taken today?** — No. It must wait for a payment channel.
3. **What does the annual plan cost?** — There is no annual plan. Annual prices are not approved, so they must not be offered (section 6).
4. **What does Enterprise cost?** — No price is shown and it is not for sale, because its features do not exist in the product (section 5).
5. **How do Starter and Pro differ?** — Only in the room and pet-record ceilings; the usable features are the same (sections 3 and 4).
6. **Is the USD figure converted from the baht figure?** — No. Both currencies are separately approved fixed prices and the system performs no conversion (section 1).
7. **Can the Founding entitlement be transferred to another shop?** — No. It is bound to one shop and persists only while the subscription does not lapse (section 7).
8. **Are there customer reviews or reference results?** — Not in this document, and none may be invented, because no such real data exists in the repository.
9. **Can the prices change?** — Pricing is the product owner's decision alone. This document invents no price, discount or coupon.
10. **Who do I ask if I have a package problem?** — The product's written support channel at `{{OWNER_INPUT:SUPPORT_CONTACT}}` (still to be filled in, because the repository holds no confirmed channel).

(Source: every answer refers to a section of this document, which in turn cites `docs/BUSINESS_MODEL.md` §2 · `docs/PRD.md` §2 and §11 · `lib/entitlements.ts` · `docs/COMMERCIAL_READINESS.md` · locked rules L-06 (no overclaiming) and L-07 (prices come from the owner only))

---

> **Limits of this document:** this is a document, not a screen, and not a payment system. It confirms only what the repository records and enforces. It carries no business outcome guarantee, no service-level agreement, and no real customer data.
