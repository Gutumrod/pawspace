# PawSpace — Phase 11 Implementation Brief: Customer Self-Booking via LINE LIFF

Status: **PLANNED — NOT STARTED**
Project: `PawSpace`
Baseline HEAD: `e90cfd1` (`style: PawSpace design implementation pass`) — local `master` is ahead of `origin/master` by 1 commit at brief time; do not lose it.

## 1. Why This Phase Exists

PawSpace's current product is staff-only: every booking, room, and customer record is created by a staff member inside the Operations UI. Customers only ever *receive* something from PawSpace — a Daily Report pushed to LINE after linking their identity once via the Phase 5 LIFF claim flow (`app/line/claim`). They have no way to initiate a stay themselves.

The business reason to close this gap: when a shop owner is pitched PawSpace, "the back office is great, but where's the page my customers book from?" is the first objection. Right now customers still book by chatting the shop's LINE OA directly, same as before PawSpace existed. Phase 11 makes booking-through-LINE a first-class flow inside PawSpace instead of a side-channel conversation the system never sees.

**This is a deliberate, sequenced next phase — not a gap that was missed.** Phases 1–10 intentionally built the operational core (rooms, bookings, Daily Report trust-building) before touching customer-initiated writes, because customer-initiated writes are the highest-risk surface in the whole system: it is the first time a non-staff actor gets to create data.

## 2. Product Decision PawSpace Must Get Before Implementation Starts

**Do not start implementation until this is decided by the human, not inferred by whoever picks up this brief.**

Customer-submitted bookings can land in the system as one of two shapes:

- **A. Request-first (recommended default):** the customer submits desired room type + dates through LIFF; it lands as a new `requested` booking state that a staff member must explicitly confirm or decline in the existing Operations UI before it becomes a real `confirmed` booking that blocks the room calendar. No new instant-confirm write path into `bookings` from an unauthenticated-by-staff actor.
- **B. Instant-confirm:** the customer's submission immediately creates a `confirmed` booking exactly like `create_booking()` does today for staff, blocking the room for that window right away.

Recommendation: **A**. Reasoning already discussed with the human: PawSpace has no deposit/payment collection (explicitly out of scope, see §6), so instant-confirm exposes the shop to no-show risk with zero recourse, and removes the human vetting touchpoint (checking the pet's condition, special needs, previous no-show history) that phone/chat booking currently provides for free. Request-first keeps the customer-facing surface real and useful without silently making the business more fragile.

If the human picks B instead, this brief's RPC/data-model/test sections below must be revised before implementation — do not implement B against a brief written for A.

## 3. Source of Truth Reading Order

Read from local disk before writing any code:

1. `AGENTS.md` (Module Hub reuse gate — mandatory)
2. `docs/PRD.md`, especially the flow diagram (`สัตว์เลี้ยงเข้าพัก → ผังห้องไม่ชน → ... → เจ้าของได้ LINE`) and the RLS capability matrix
3. `docs/SYSTEM_ARCHITECTURE.md` — booking/room authority model, LINE identity isolation section
4. `docs/BUSINESS_MODEL.md` — confirm no deposit/payment mechanic exists to accidentally imply
5. `docs/Design.md` — visual language only (see §9 below; do not treat its example screens as requirements, same caveat as the Design Implementation Pass)
6. `supabase/migrations/20260820020000_phase2_authoritative_gateways.sql` — `create_booking`, `add_pet_to_booking` current authority (staff-only, `current_staff_shop_id()` gate)
7. `supabase/migrations/20260820221500_phase5_line_claim.sql` — existing LINE identity verification/claim pattern to reuse, not reinvent
8. `lib/line-claim-core.ts`, `lib/line-claim-server.ts`, `lib/line-id-token.ts`, `app/line/claim/*` — existing verified-LINE-identity pattern
9. `REVIEW-phase9-gate1-rerun-2026-08-21.md` — read this one specifically for the NULL-membership entitlement RPC bypass that got through two review rounds before being caught. The same bug class (an authorization check that is silently falsy instead of explicitly rejecting) is the single most likely way Phase 11 goes wrong, because it introduces PawSpace's first ever non-staff authenticated actor.

## 4. Locked Scope

- A LIFF-hosted customer booking-request surface: pick an already-linked pet, a date range, and (if the shop exposes it) a room type; submit.
- A trusted server boundary that re-verifies the LINE ID token on every submission (never trust a browser-supplied `line_user_id` or `pet_owner_id` — same rule Phase 5 already enforces).
- Exactly one new customer-authority RPC (or a tightly scoped set) for creating a booking **request** row, gated by verified LINE identity + existing `pet_owners.line_user_id` link, never by staff session.
- Staff-side UI in the existing Operations "การจอง" (Bookings) tab to see, confirm, or decline pending requests — reuse `app/operations-client.tsx`'s existing patterns, do not fork a parallel UI system.
- Tenant isolation identical in rigor to every prior phase: a customer linked to shop A must never be able to submit, see, or affect shop B's rooms/availability.
- Room availability read for the customer surface must not leak other customers' identities, contact info, or any booking detail beyond "available / not available" for the requested window.

## 5. Hard No-Touch Boundary

Same categories every phase in this repo has honored, restated for this one:

- Do not modify Phase 1–10 migrations. Add a new migration only.
- Do not change `create_booking()`'s existing staff-only contract or its signature. The new customer path is additive, not a modification of the staff path.
- Do not touch Phase 7 (Google Sheets), Phase 8 (camera), Phase 9 (entitlements) contracts.
- Do not implement payment, deposit collection, Stripe, PromptPay, SlipOK, or any charge-of-money code path.
- Do not implement booking cancellation-by-customer, rescheduling-by-customer, or check-in/check-out-by-customer. Request submission only.
- Do not weaken `pet_owners`/`bookings`/`rooms` RLS to make this easier — every new capability must be its own explicit `SECURITY DEFINER` RPC with its own explicit grant, matching the pattern every prior phase used.
- Do not silently reuse the Phase 5 one-time claim-token mechanism as an ongoing session. It was designed for a single identity-link event, not repeated authenticated visits — read §7 before assuming it's reusable as-is.

## 6. Explicit Non-Scope

- No payment or deposit collection of any kind.
- No customer account/password — identity is LINE-verified per visit through LIFF, same trust model as Phase 5.
- No customer-facing cancellation, rescheduling, or check-in/out control.
- No multi-shop discovery/marketplace (the customer must already be linked to a specific shop via the existing Phase 5 LIFF claim).
- No SMS/email channel — LINE only, matching the whole product's design.
- No changes to the `Grooming / Clinic / Walking / Vaccine` service categories from `Design.md` — those remain visual examples only, not new PawSpace service types. Phase 11 books **rooms** (existing `rooms`/`bookings` domain), not new service categories.

## 7. Required Architecture Boundaries

### Identity / Session
- Every request-creation call must independently re-verify the LINE ID token server-side (reuse `verifyLineIdToken` / the Phase 5 pattern). Do not cache a "logged in" client-side boolean and trust it for the write.
- Decide and document explicitly whether each submission carries a fresh LIFF ID token (simplest, stateless, recommended) or whether a new short-lived customer session primitive is introduced. If the latter, it needs its own explicit expiry and revocation story — do not leave it open-ended.
- The `pet_owner_id` used for the booking request must be resolved server-side from the verified `line_user_id` looked up against `pet_owners.line_user_id` for the specific shop — never accept a browser-supplied `pet_owner_id`.

### Authorization
- New RPC(s) must reject explicitly (`RAISE EXCEPTION`) on: unverified identity, `line_user_id` not linked to any `pet_owners` row in the target shop, pet not owned by that `line_user_id`, or shop mismatch. No branch may fall through to a default-allow because a check evaluated to `NULL` — this is exactly the Phase 9 rerun-1 bug class; write the negative test for it before writing the happy path.
- Staff confirm/decline actions remain gated by existing `requireManagerOrOwnerContext()`/staff RPC patterns — Owner/Manager only, or Owner/Manager/Staff if the human decides Staff should triage requests too (state this decision explicitly in the implementation evidence; don't assume).

### Tenant Isolation
- A customer's LINE identity is linked to exactly one shop's `pet_owners` row per the Phase 5 model. Availability reads and request writes must be scoped to that shop only, verified server-side, never trusted from a client-supplied `shop_id`.
- Negative test required: a LINE identity linked to shop A attempting to submit a request against shop B's room IDs must be rejected, not silently scoped.

### Database Authority
- New table (e.g. `booking_requests` or a new `booking_status` value plus a `requested_by` discriminator column on `bookings` — pick one, document why, and get it right the first time; changing the shape later touches the staff confirm UI too) needs RLS enabled and `REVOKE ALL ... FROM PUBLIC, anon, authenticated` before granting only the exact RPCs needed.
- `anon` must never have direct table access. `authenticated` (the role LIFF-verified customers will hold, same as staff) must not have direct INSERT/UPDATE on `bookings`/`rooms` — only through the new RPC, exactly like every existing write path in this codebase.
- Room availability must be computed the same way `create_booking()`'s existing collision logic works (reuse the GiST exclusion constraint / existing overlap check) so the customer-facing "available" answer can never disagree with what staff would see if they tried to book the same slot.

### Core Logic Split
- Pure availability-window/date logic (no DB, no secrets) should be a plain module with no `server-only` guard, testable via `npx tsx`, matching the established Phase 5–9 split (`*-core.ts` pattern).
- The LIFF page itself follows the existing `app/line/claim/LineClaimClient.tsx` pattern: dumb client component, LIFF SDK for identity, POST to a trusted server action/route handler that does the real work.

## 8. Suggested Data Model (Equivalent Hardened Design Acceptable)

Not mandatory naming, but preserve the contract:

- A way to represent a booking's origin/state distinct from staff-created `confirmed` bookings — either a `status = 'requested'` value the existing `bookings` table already has room for (check current CHECK constraint before assuming), or a separate `booking_requests` table with a promotion path into `bookings` on staff confirm. Pick the one that lets the room calendar correctly *not* block the slot for a mere request (a `requested` row must not collide-block other bookings the way `confirmed`/`checked_in` do) while still letting staff see it.
- `requested_by_line_user_id` or equivalent — never delete this even after promotion to a real booking; it's the only staff-facing evidence of which customer self-submitted it.
- `requested_at` timestamp; consider (but do not build unless decided) an expiry for stale unconfirmed requests.

## 9. Visual Direction

Reuse the Design Implementation Pass's design language exactly (`app/globals.css` tokens already exist — pastel surfaces, rounded Soft 3D cards, 44×44px touch targets, focus-visible states). This is a LIFF page inside LINE's in-app browser: mobile-only, no desktop layout needed, no sidebar. Do not re-derive tokens from `Design.md`'s example screens directly — go through the already-adapted `app/globals.css` classes so the whole product stays visually consistent, not a second design system.

## 10. Required Test Matrix

Minimum, matching this repo's established rigor (every recent phase shipped with a negative-test suite; Phase 9 needed three failed gate rounds to get this right — do not repeat that here by skipping negatives up front):

**Identity/authorization**
1. Valid LINE identity + linked pet_owner in the target shop → request succeeds.
2. LINE identity with no linked `pet_owners` row anywhere → rejected, explicit error, no default-allow.
3. LINE identity linked to shop A, target shop_id = B → rejected.
4. Forged/expired/unverifiable LINE ID token → rejected before any DB write.
5. Client-supplied `pet_owner_id` that doesn't match the server-resolved owner for that LINE identity → rejected (proves the server ignores browser-supplied identity).

**Booking logic**
6. Requested window overlapping an existing `confirmed`/`checked_in` booking on that room → rejected or flagged, never silently double-booked.
7. Two concurrent requests for the same room/window → at most one is confirmable; the race is resolved deterministically (reuse existing GiST/locking pattern, do not hand-roll new concurrency logic).
8. Staff confirm promotes a `requested` row to a real blocking booking; staff decline leaves the room untouched and does not silently confirm.
9. A request for a shop that has no rooms of the requested type → clear rejection, not a crash.

**Non-scope regression**
10. No payment/charge code path is reachable from the new RPC or route handler.
11. Existing staff `create_booking()` behavior and signature are unchanged (rerun Phase 4 regression).
12. Existing Phase 5 LIFF claim flow is unaffected (rerun its regression suite).

## 11. Module Hub Compatibility Gate

Per `AGENTS.md`, before writing code, read Module Hub's `README.md`/`INDEX.md`/`SECURITY.md`/`modules/REGISTRY.md` fresh and inspect the actual current source of any candidate. Pre-review candidates worth checking (not pre-approved — inspect for real before using):

- `modules/line-oa-ai-module` — check if it has any relevant LIFF/booking-request pattern; likely `NOT NEEDED` or `ADAPTER ONLY` given it's AI-chat-shaped, not booking-shaped, but verify rather than assume.
- `modules/auth` / `modules/auth-supabase` — likely `NOT NEEDED`; PawSpace's LINE-verified-identity model is already established by Phase 5 and should not be replaced by a generic auth module.
- `modules/tenant-context` — likely `NOT NEEDED` for the same reason PawSpace has never used it; the codebase's own `current_staff_shop_id()` / RLS pattern is the established authority.

No module in the registry currently targets "customer self-service booking" specifically — expect the verdict to be mostly `NOT NEEDED`, but the gate must still be executed and recorded, not skipped because it looks unlikely to apply.

## 12. Required Workflow

`Explain Phase → Check Module Hub → Compatibility Gate → Confirm §2's product decision (A vs B) is settled → Implement DB/RPC → Implement pure availability/date core → Implement server boundary → Implement LIFF client page → Implement staff-side confirm/decline in Operations UI → Test (full matrix) → Regression (Phase 4 + Phase 5 suites) → Inspect (diff, privileges, client exposure) → Reviewer Verdict`

Do not commit/push until Reviewer Gate 1 passes. Expect at least one review round to catch something — every phase so far has (Phase 9 needed three). Build in time for that instead of treating first-pass as the plan.

## 13. Deliverables

1. New migration (`booking_requests` or equivalent), RLS/privileges locked down and explicitly tested.
2. Pure core module (availability/date logic), no `server-only`.
3. Server-only trusted boundary (LINE ID token re-verification, RPC call).
4. LIFF client page, reusing existing design tokens.
5. Staff-side confirm/decline UI inside the existing Operations Bookings tab.
6. Full test matrix from §10, executed for real against local Supabase, raw pass/fail counts recorded.
7. `PHASE11_IMPLEMENTATION_EVIDENCE.md` in the same format as prior phases: baseline, Source of Truth read, Module Hub verdicts, files changed, exact test commands + raw results, static gates, known limitations.
8. Reviewer Verdict: `PHASE PASSED — READY TO RELEASE NEXT PHASE` or `PHASE FAILED — FIX REQUIRED`.

## 14. Stop Conditions

Stop and report before proceeding if:
- §2's product decision (request-first vs instant-confirm) has not been explicitly confirmed by the human.
- Implementing this would require weakening any existing RLS policy, staff-only RPC contract, or tenant-isolation guarantee from Phases 1–10.
- Implementing this would require introducing payment/deposit logic to make the request model "safe enough" — that's a signal the human needs to make a bigger decision first, not that this phase should quietly grow to include billing.

**This phase does not have authority to change PawSpace's no-payment, no-customer-account, LINE-only product boundary established in Phases 1–10.**
