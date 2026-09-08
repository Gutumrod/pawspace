# BRIEF — PS01 Booking V2 Continuation

**Date:** 2026-09-08
**Product:** Pawstia PMS (PS01)
**Mode:** WSTERA BUILD-TO-SELL / STRICT PS01 ONLY
**Owner:** Final authority

## 1. Mission

รับช่วงงาน PS01 ต่อจาก checkpoint `cbc3c73` โดยโฟกัสเฉพาะการออกแบบและเตรียม remediation ของ Booking Model V2 สำหรับ Closed Beta 1 ร้าน

เป้าหมายรอบนี้คือทำให้แกน Room → Rate Plan → Availability → Booking ใช้ได้กับธุรกิจที่คิดราคาแบบชั่วโมง / วัน / เดือน โดย Staff และ Customer ต้องใช้ booking logic ชุดเดียวกัน

## 2. Hard Scope Lock

ทำเฉพาะ PS01 เท่านั้น

- ห้ามแตะ product อื่น
- ห้ามแตะ Payment/Billing ที่ร้านจ่ายให้ WSTERA/Pawstia
- ห้ามเลือก payment provider
- ห้าม mutate WSTERA LAB
- ห้ามแตะ production / production secrets
- ห้ามเปิด Council / Module Hub Scan
- ห้ามแก้ migration จริงจนกว่า design/contract/test plan จะผ่าน Owner review
## 3. Current Verified Baseline

Repository worktree:
`D:\AI-Workspace\projects\saas-product-hub\products\PawSpace-pssr02-staging`

Branch:
`build/ps-sr02-staging-2026-09-06`

Current checkpoint:
`cbc3c736d2c65b9d3ec69cb1db2970fefc48af65`

Latest commit:
`cbc3c73 test(ps01): close Mac shared-runtime proof`

PC was synced on 2026-09-08 and verified at divergence `0/0` before this brief was created.

Mac local shared-runtime proof is CLOSED and evidenced by:
`docs/PS01-MAC-LOCAL-PROOF-EVIDENCE-2026-09-07.md`

Verified Mac proof included: PS01 isolated DB baseline apply, 20 PS01 tables, 76 functions, fixture PASS, real login PASS, DB-backed Staff Operations render PASS, no WSTERA LAB mutation, and no service-role credential in the app runtime.

## 4. Owner Decisions Already Locked

Room must NOT be tied to a single `price per night` model.

A single room may have multiple Rate Plans. Store owner selects:
`HOUR | DAY | MONTH` → enters quantity → enters fixed price.
Closed Beta pricing mode is `FIXED_PACKAGE` only.

Examples:
- 1 HOUR = ฿100
- 3 HOUR = ฿250
- 1 DAY = ฿650
- 7 DAY = ฿3,900
- 1 MONTH = ฿12,000

`MONTH` means calendar month, not fixed 30 days.

Staff booking and Customer self-booking must use the SAME pricing / duration / availability engine.

Booking history must preserve the quoted price at booking time even if the Rate Plan price changes later.

## 5. Current Product Gaps Confirmed from Source

Current Staff Operations:
- room config uses `base_price_per_night`
- booking form uses date-only check-in/check-out
- staff can enter `totalAmount` manually

Current Customer/LINE booking:
- uses `checkInDate` / `checkOutDate`
- computes `basePricePerNight × nights` in customer code
- availability uses date ranges only
- customer path currently depends on LINE identity and an internal admin-client path

Therefore hourly booking is not supported by the current model and pricing logic is duplicated between channels.
## 6. Required Design Pack Before Implementation

Produce a reviewable design/contract pack covering:

1. `room_rate_plans` ownership and fields.
2. Booking V2 time model using `start_at` / `end_at`.
3. Quote snapshot fields such as unit, quantity and quoted price.
4. Duration resolution rules for HOUR / DAY / MONTH.
5. Calendar-month behavior and timezone handling.
6. Availability / overlap / back-to-back rules at timestamp precision.
7. Maintenance collision behavior.
8. Capacity validation.
9. Rate Plan active/inactive behavior.
10. Shared Booking Engine contract for Staff + Customer channels.
11. Legacy date-only Booking compatibility/migration plan.
12. Booking Request → Confirm/Decline compatibility.
13. Shared-runtime authority/security impact, especially Customer booking paths.

Do not implement this pack until it has been reviewed against current source and invariants.

## 7. Target Direction

Conceptually:

`Room → Rate Plans → Shared Booking Engine → Booking / Booking Request`

Rate Plan candidate fields:
`id, shop_id, room_id, unit, quantity, price, is_active`
Booking V2 candidate fields should include at least:
`start_at, end_at, rate_plan_id, quoted_unit, quoted_quantity, quoted_price`

Exact schema names/types are NOT locked by this brief; they must be justified by the design pack.

## 8. Required Test Matrix

The design must be testable for at least:

- 1-hour booking
- 3-hour booking
- same-day hourly overlap rejection
- valid back-to-back hourly bookings
- 1-day booking
- multi-day package
- 1-calendar-month booking
- maintenance collision
- room capacity violation
- inactive Rate Plan rejection for new bookings
- Rate Plan price change does not mutate historical quote
- Staff and Customer produce the same quote/duration
- customer request → staff confirm
- check-in → check-out → cleaning → available
- Shop A cannot read/use Shop B Rate Plans or bookings
- legacy date-only booking survives compatibility/migration path

## 9. UX Direction — Planning Only

Staff flow should move toward:
`Room → Rate Plans → Booking → Check-in → Active Stay → Check-out → Cleaning`

Customer flow should move toward:
`Select Pet → Select Room → Select Rate Plan → Select Start Date/Time → Review End Time + Price → Submit Request`
LINE should be treated as a channel into Customer Booking, not as the owner of booking rules.

Do not beautify major booking UI before the shared engine/data contract is stable; otherwise the UI will likely be reworked twice.

Room Type customization may be reviewed after Booking V2 core. Current hard-coded `standard/deluxe/vip/cat_condo` is known product rigidity but is not the first blocker.

## 10. Explicit Payment Boundary

Payment architecture is being decided elsewhere by Owner/WSTERA House.

This PS01 work may define booking price/quote facts required by operations, but MUST NOT decide:
- how Pawstia charges stores
- subscription billing
- payment provider
- checkout provider
- PromptPay / Stripe / QR implementation
- invoice/collection architecture for WSTERA

If customer-to-store payment later needs to attach to a booking, preserve a clean adapter/boundary but do not implement it in this task.

## 11. Files to Inspect First

Start from real source, especially:
- `supabase/shared-runtime/ps01-baseline.sql`
- `lib/booking-service.ts`
- `lib/operations-service.ts`
- `lib/line-booking-core.ts`
- `lib/line-booking-server.ts`
- `app/actions/booking.ts`
- `app/operations-client.tsx`
- `app/line/book/LineBookingClient.tsx`
- relevant Phase 4 / Phase 11 booking tests and migration evidence
## 12. Execution Order for New Chat

1. Verify branch, HEAD, remote divergence and working tree before any edits.
2. Read this brief and the current Closed Beta reality-check/shared-runtime contract/evidence.
3. Inspect current booking schema/RPCs/services/tests.
4. Produce Booking V2 design/contract pack with explicit compatibility and risk analysis.
5. Review the pack against tenant isolation and existing lifecycle invariants.
6. Present concise Owner decision brief before implementation.
7. Only after Owner approval, create bounded implementation plan.

## 13. Stop Conditions

STOP and return to Owner/Secretary before:
- first schema/migration mutation
- WSTERA LAB apply
- production mutation
- payment/billing work
- weakening RLS/tenant boundaries
- deleting/replacing completed historical migrations
- expanding into unrelated integrations/features

Preserve all completed Phase evidence. New architecture must migrate forward; do not rewrite history.

## 14. Git Rule

Current canonical pushed checkpoint is `cbc3c73`.

This handoff brief itself may be a local uncommitted file when the new chat starts. Verify `git status` first.
Do not commit/push implementation work unless Owner explicitly authorizes the checkpoint.

## 15. First Deliverable

Return to Owner with a concise Thai summary of the proposed Booking V2 data model, invariants, migration compatibility, Staff/Customer shared engine contract, risks, and exact implementation slices.

Do not begin payment work.
