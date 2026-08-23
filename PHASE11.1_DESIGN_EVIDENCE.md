# PawSpace Phase 11.1 — LIFF Design Alignment Evidence

Date: 2026-08-23  
Scope: Presentation-only design alignment for `/line/book` customer self-booking LIFF surface.  
Baseline HEAD: `295517a`  

---

## 1. Objective & Scope

Phase 11.1 visually aligns the customer self-booking LINE LIFF interface (`/line/book`) with the established PawSpace design system (`docs/Design.md`, `app/globals.css`).

**Behavior Invariant:**
- **Zero modification** to LINE token verification, tenant resolution, RPC contracts, booking request state machines, staff review triage, collision logic, pricing formulas, or database schemas.
- **Zero test assertion modifications**.
- Presentation layer only.

---

## 2. Module Hub Compatibility Gate

Per `AGENTS.md`, Module Hub was evaluated:
- **Verdict:** `NOT NEEDED`
- **Rationale:** Phase 11.1 is a purely presentational CSS and markup alignment on the existing `/line/book` surface.

---

## 3. Review Findings Resolved (Rerun 1)

1. **Submit / Network Error inline presentation:**
   - Replaced browser `alert()` in `LineBookingClient.tsx` (lines 169 & 177) with `submitError` React state.
   - Rendered as an inline `.pilot-notice.error` notice with `⚠️` icon and clear copy directly above the submit button without changing server/submit action semantics.
2. **Room selected state visible non-color indicator:**
   - Added visible `✓` checkmark indicator in `LineBookingClient.tsx` for selected room cards (matching pet selector pattern and `docs/Design.md:678` requirement).
3. **Error notice icons added:**
   - Added `⚠️` icon to pet empty state (`context.pets.length === 0`).
   - Added `⚠️` icon to date validation error notice (`!dateValidation.valid`).
   - Standardized flex layout (`display: flex; align-items: center; gap: 8px`) across all inline error notices.

---

## 4. Design Tokens & Visual Mapping

| Element | Previous Raw Implementation | PawSpace Design System Alignment |
| :--- | :--- | :--- |
| **Page Backdrop** | Raw Tailwind `bg-slate-50` | `.liff-shell` (warm pastel radial gradients on `var(--background)`) |
| **Main Card Shell** | `bg-white border-slate-100` | `.liff-card` (`linear-gradient(180deg, #fff, #fcfcfc)`, `var(--shadow-card)`) |
| **Brand Header** | Text emoji + generic heading | `.liff-header`, `.brand-mark` badge, `.liff-badge` mint status pill |
| **Shop Context Banner** | `bg-amber-50/50 border-amber-100` | `.liff-banner` (`var(--surface-warm)`, `var(--shadow-card)`, verified owner chip) |
| **Pet Selectors** | Raw amber outline buttons | `.liff-pet-card` (Soft 3D card, species emoji, checkmark `✓`, selected blue tint) |
| **Room Selectors** | Raw amber outline list | `.liff-room-card` (elevated card, capacity tag, status chip, price/night, checkmark `✓`) |
| **Form Inputs** | Raw slate-300 inputs | `.liff-input` (min 44px height, 14px radius, soft focus ring with `var(--sky)`) |
| **Alerts / Warnings** | Raw rose/amber text blocks | `.pilot-notice.error` with `⚠️` icon & PawSpace color tokens |
| **Summary Card** | Raw amber-50 box | `.liff-summary-card` (soft peach gradient, crisp price emphasis) |
| **Primary CTA** | Raw amber button | `.primary-button.liff-submit-btn` (tactile 3D gradient, active pressed transform) |
| **Success State** | Raw slate/emerald card | `.liff-success-card` (mint badge `✨`, structured detail card, clear status copy) |

---

## 5. Files Modified

Only 3 presentation files are modified in working tree:
1. `app/globals.css`: Added scoped `.liff-*` classes leveraging existing PawSpace tokens.
2. `app/line/book/page.tsx`: Replaced raw layout wrappers with `.liff-shell`, `.liff-container`, `.liff-card`, and `.liff-header`.
3. `app/line/book/LineBookingClient.tsx`: Aligned loading, error, banner, pet selector, room list (with `✓`), date inputs, inline submit error, summary, CTA, and success card with PawSpace tokens and icons.

---

## 6. Verification & Gate Results

### 1. Static Gates
- `pnpm exec tsc --noEmit` — **PASS**
- `pnpm lint` — **PASS (Clean, 0 errors, 0 warnings)**
- `pnpm build` — **PASS (Compiled in 841ms, static routes generated cleanly)**
- `git diff --check` — **PASS (Clean)**

### 2. Phase 11 Dedicated Regression Suite
Command:
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/run-test.ps1 tests/phase11_customer_self_booking.test.ts
```
Output:
```text
=== PawSpace Phase 11 Customer Self-Booking Tests ===

  [PASS] Core: validateDateRange correctly calculates 3 nights
  [PASS] Core: validateDateRange rejects inverted dates
  [PASS] Core: calculateEstimatedTotal calculates 500 * 3 = 1500
  [PASS] Core: isRoomAvailable allows non-overlapping ranges
  [PASS] Core: isRoomAvailable rejects overlapping ranges
  [PASS] Core: validateLineBookingInput rejects malformed payload
  [PASS] LINE verify request uses configured channel ID
  [PASS] LINE verify request sends ID token, not browser profile
  [PASS] Test 1: Valid LINE identity submits booking request successfully
  [PASS] Test 1b: Request created with status 'requested'
  [PASS] Test 1c: Request calculated total_amount 1500 (3 nights * 500)
  [PASS] Test 1d: Request records verified LINE user ID
  [PASS] LINE verify request uses configured channel ID
  [PASS] LINE verify request sends ID token, not browser profile
  [PASS] Test 2: Unlinked LINE identity is rejected explicitly
  [PASS] LINE verify request uses configured channel ID
  [PASS] LINE verify request sends ID token, not browser profile
  [PASS] Test 3: Cross-tenant booking request is rejected
  [PASS] LINE verify request uses configured channel ID
  [PASS] LINE verify request sends ID token, not browser profile
  [PASS] Test 4: Expired LINE ID token is rejected at security boundary
  [PASS] Test 5: Authenticated client cannot invoke submit_booking_request_internal directly (service_role only)
  [PASS] LINE verify request uses configured channel ID
  [PASS] LINE verify request sends ID token, not browser profile
  [PASS] Test 6: Request overlapping confirmed booking is rejected
  [PASS] LINE verify request uses configured channel ID
  [PASS] LINE verify request sends ID token, not browser profile
  [PASS] Test 7a: Customer context fetched successfully
  [PASS] Test 7b: Customer context returns only owner's pets
  [PASS] Test 7c: Customer context returns shop rooms
  [PASS] Test 7d: Occupied ranges contain zero customer PII
  [PASS] Test 8a: Staff confirms booking request successfully
  [PASS] Test 8b: Promoted booking has status 'confirmed'
  [PASS] Test 8c: Promoted booking has correct check-in date
  [PASS] Test 8d: Promoted booking has pet linked
  [PASS] Test 8e: Request status updated to 'confirmed'
  [PASS] Test 8f: Request links confirmed booking ID
  [PASS] LINE verify request uses configured channel ID
  [PASS] LINE verify request sends ID token, not browser profile
  [PASS] Test 9_pre: Submit 2nd request succeeds
  [PASS] Test 9a: Staff declines booking request successfully
  [PASS] Test 9b: Request marked 'declined'
  [PASS] Test 9c: No booking created for declined request
  [PASS] Test 10: No payment/deposit logic introduced (verified)
  [PASS] Test 11: Phase 4 staff create_booking RPC works with unchanged signature

Cleaning up test users...

=== Phase 11 Result: 45 passed, 0 failed ===
```

### 3. Phase 10 E2E Regression Suite
Command:
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/phase10-e2e.ps1
```
Output:
```text
  ok 1 [chromium] › tests\e2e\phase10-pilot.spec.ts:83:5 › owner login reaches operations and sees owner-only controls (1.2s)
  ok 2 [chromium] › tests\e2e\phase10-pilot.spec.ts:91:5 › manager reaches operations but cannot manage staff (566ms)
  ok 3 [chromium] › tests\e2e\phase10-pilot.spec.ts:98:5 › staff reaches core operations but not manager controls (594ms)
  ok 4 [chromium] › tests\e2e\phase10-pilot.spec.ts:105:5 › inactive and no-membership logins are rejected without PawSpace session cookies (886ms)
  ok 5 [chromium] › tests\e2e\phase10-pilot.spec.ts:115:5 › owner invite creates usable credentials and remove revokes membership plus Auth account (2.6s)
  ok 6 [chromium] › tests\e2e\phase10-pilot.spec.ts:149:5 › Issue #3: no-password invite sends a real email credential flow the recipient can consume (3.5s)
  ok 7 [chromium] › tests\e2e\phase10-pilot.spec.ts:204:5 › pilot core loop runs through real UI and HTTP runtime (4.1s)
  ok 8 [chromium] › tests\e2e\phase10-pilot.spec.ts:273:5 › tenant A cannot expose or mutate tenant B resources (1.3s)

  8 passed (17.9s)
```

---

## 7. Forbidden File Diff Audit

Diff audit confirms zero changes outside presentation layer:
- `supabase/**` — **Untouched**
- `lib/line-booking-server.ts` — **Untouched**
- `lib/line-booking-core.ts` — **Untouched**
- `app/actions/**` — **Untouched**
- `package.json` / `pnpm-lock.yaml` — **Untouched**

```text
Modified files:
- app/globals.css
- app/line/book/LineBookingClient.tsx
- app/line/book/page.tsx
```

---

## 8. Viewports Inspection Matrix

Tested across target mobile viewports for LINE In-App Browser:

| Viewport Width | Layout Behavior | Overflow Check | Touch Target ($\ge 44\text{px}$) | Selected Indicators |
| :--- | :--- | :--- | :--- | :--- |
| **320px** (Small mobile) | Single column stack, compact pet grid | No horizontal overflow | Verified (Cards $\ge 56\text{px}$, Inputs $44\text{px}$, CTA $50\text{px}$) | `✓` visible on Pet & Room |
| **390px** (iPhone standard) | Single column, 2-col pet grid | No horizontal overflow | Verified | `✓` visible on Pet & Room |
| **430px** (iPhone Plus/Max) | Single column, comfortable padding | No horizontal overflow | Verified | `✓` visible on Pet & Room |
| **480px** (Wide mobile) | Single column centered (`max-w-[460px]`) | No horizontal overflow | Verified | `✓` visible on Pet & Room |

---

## 9. Final Status

**`PHASE 11.1 DESIGN ALIGNMENT — PASSED`**


---

## 10. Independent Gate 2 Closure

Independent re-review was completed before commit `1b5e7b9`. The reviewer re-ran the required gates and confirmed the Phase 11.1 diff remained presentation-only.

Recorded Gate 2 results:
- `pnpm exec tsc --noEmit` — **PASS**
- `pnpm lint` — **PASS**
- `pnpm build` — **PASS**
- `git diff --check` — **PASS**
- Phase 11 regression — **45/45 PASS**
- Phase 10 browser E2E — **8/8 PASS**
- Forbidden-file diff audit — **PASS**

Reviewer verdict: **`PHASE 11.1 DESIGN ALIGNMENT — PASSED`**

The earlier `READY FOR RE-REVIEW` status represented the implementer boundary before independent Gate 2 and is superseded by this closure record.
