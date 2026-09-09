# PS01 Owner Manual Test — PRE / Runbook

Date: 2026-09-09 (Asia/Bangkok)
Tester: Owner
Environment target: WSTERA LAB only
Status: `PREPARED — DO NOT START UNTIL HOUSE RETURNS H3D/LAB READY`

## Purpose

This is the human acceptance run. The Owner tests real product behavior; the agent records expected behavior and later writes POST evidence from the Owner's actual results.

## Gate 0 — mandatory before clicking anything

Do not start this run while House is mutating WSTERA LAB/shared runtime.
Start only when all are true:

- House confirms H3D/LAB prerequisites are ready for PS01 testing.
- Test surface points to WSTERA LAB, never Production.
- Staff test account is available through normal Auth login.
- Customer LIFF test is enabled only if the hosted Custom Access Token Hook + finite `ps01_line_runtime` grant + fresh short-lived token path are ready.
- No service-role/admin credential is entered in browser/manual steps.

If any condition is missing: record `BLOCKED / NOT RUN`; do not create a workaround.

## Evidence format for every case

Record:
- Case ID
- timestamp
- input/selection used
- expected result
- actual result
- `PASS | FAIL | BLOCKED | NOT RUN`
- screenshot or short note when UI/result is important

Use obvious LAB-only test names such as `TEST-PS01-20260909-*`; do not reuse real customer data.

## A. Staff smoke + setup

### O-01 — Login and dashboard
1. Login with the designated LAB Staff/Owner account.
2. Open Operations/Dashboard.
Expected: correct shop appears; no auth loop, blank page, or cross-shop data.

### O-02 — Room + Rate Plans
1. Open Setup.
2. Create/choose a LAB test room.
3. Verify default `1 DAY` plan exists for a newly created room.
4. Add `1 HOUR`, `3 HOUR`, `1 DAY`, `7 DAY`, `1 MONTH` plans with distinct prices.
Expected: all plans save under that room; HOUR/DAY/MONTH are available; no manual nightly-only restriction.

## B. Staff Booking V2 behavior

### O-03 — 1 HOUR quote snapshot
1. Create/select LAB customer + pet.
2. Create Booking V2 with the test room, `1 HOUR` plan, and a future Bangkok start time.
Expected: booking is `confirmed`; displayed end time is +1 hour; displayed quoted unit/quantity/price exactly match the selected plan; there is no editable total-price field.

### O-04 — 3 HOUR duration
Create a non-conflicting booking using `3 HOUR`.
Expected: displayed end time is exactly +3 hours and quoted price is the package price, not `1-hour price × 3` unless those happen to be equal by configuration.

### O-05 — overlap rejection + back-to-back acceptance
1. With a confirmed booking `[T, T+1h)`, attempt another booking for the same room/pet that starts inside that interval.
2. Then attempt a booking that starts exactly at `T+1h`.
Expected: overlapping attempt is rejected; exact back-to-back start is accepted.

### O-06 — DAY and calendar MONTH
1. Create/use `1 DAY` at a non-conflicting time.
2. Create/use `1 MONTH` from a safe test date.
Expected: DAY resolves one day; MONTH resolves by calendar month semantics, not fixed 30 days; UI renders Bangkok times consistently.

### O-07 — maintenance and capacity
1. Set a maintenance window on the test room and try to book inside it.
2. Clear maintenance, set room capacity lower than the number of selected pets, and try again.
Expected: maintenance collision is rejected; capacity violation is rejected; valid booking works again after the conflicting condition is removed.

### O-08 — inactive Rate Plan
1. Disable one test Rate Plan in Setup.
2. Try to create a new booking with that plan.
Expected: inactive plan is unavailable/rejected for new booking work; existing historical booking data remains readable.

### O-09 — historical quote preservation
1. Create a Booking V2 with a known package price.
2. Change that Rate Plan price in Setup.
3. Re-open/refresh the booking list.
Expected: the existing booking still shows its original quoted price; only future quotes/bookings use the new price.

### O-10 — lifecycle + cleaning
1. Check in a valid confirmed booking.
2. Check it out.
3. Return to Overview and inspect Room Matrix.
4. When room status is `cleaning`, click `Mark clean`.
Expected: `confirmed -> checked_in -> checked_out`; room becomes `cleaning`; `Mark clean` returns it to `available`.

## C. Customer LINE / H3D live path

Run this section only after Gate 0 confirms H3D live prerequisites are ready.

### O-11 — linked customer LIFF context
1. Open the PS01 booking LIFF with the designated LAB LINE identity.
2. Confirm the expected shop, pets, rooms and active Rate Plans appear.
Expected: only that linked customer's/shop's data appears; no admin/pooler fallback error is exposed.

### O-12 — Customer quote parity
1. Select the same room, pet, Rate Plan and Bangkok start time used in a Staff case.
2. Wait for the Customer quote card.
Expected: unit, quantity, start, end and price match the Staff/shared-engine result exactly.

### O-13 — Customer request -> Staff confirm
1. Submit the customer request.
2. Open Staff Bookings.
3. Find the pending LINE request and confirm it.
Expected: Customer sees request success; Staff sees the same quote snapshot; confirmation creates the booking only after availability is revalidated.

### O-14 — decline path
Submit a second safe test request and decline it from Staff with a test reason.
Expected: request is no longer pending/confirmable and no booking inventory is created for the declined request.

### O-15 — confirmation revalidation race
If two test requests can safely be created for the same room/time without disturbing other testers:
1. Submit two requests that overlap the same room/time.
2. Confirm the first.
3. Try to confirm the second.
Expected: request creation itself does not reserve inventory; first valid confirmation succeeds; second confirmation is rejected after fresh availability validation.

### O-16 — cross-shop isolation
Run only if House provides a second LAB shop fixture.
1. Use Customer identity linked to Shop A.
2. Attempt the Shop B path/link or select any Shop B identifier available only to the tester.
Expected: Shop A identity cannot read/use Shop B pets, rooms, Rate Plans, quote, requests or bookings.
If no second-shop fixture exists, record `NOT RUN — FIXTURE MISSING`; do not fabricate one during this run.

## Exit / cleanup

- Do not delete evidence before POST is written.
- Cancel/finish only the LAB test bookings needed to return rooms to a usable state.
- Mark test rooms clean where appropriate.
- Do not directly edit Supabase tables for cleanup.
- Do not remove House runtime identities/grants/tokens unless House's own teardown procedure says so.
- Record anything left behind by `TEST-PS01-20260909-*` name for controlled cleanup later.

## Manual acceptance rule

Overall Owner manual verdict can be `PASS` only when all required Staff cases pass and the H3D Customer cases required for this release pass. Optional fixture-dependent cases may be `NOT RUN` only when the missing fixture is explicitly documented.
