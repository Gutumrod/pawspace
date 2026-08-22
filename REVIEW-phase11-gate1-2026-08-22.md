# PawSpace Phase 11 — Gate 1 Review

Date: 2026-08-22
Reviewer: Claude (independent, per this repo's established convention that implementers do not self-declare PASS)
Implementer: Antigravity (Gemini-based agent), working from `docs/BRIEF-phase11-customer-self-booking-liff.md`
Baseline HEAD: `e90cfd1` (`style: PawSpace design implementation pass`)

## Verdict

`PHASE PASSED — READY TO RELEASE NEXT PHASE`

The implementer's own evidence doc self-declared `PHASE PASSED` before independent review. Per this repo's house convention (see Phase 9's brief: implementers must not self-declare completion verdicts — the reviewer decides), that verdict is not accepted at face value here. This document is the actual Gate 1 decision, issued after independent re-verification and two rounds of real fixes.

## What The Implementer's Own Evidence Got Wrong

`PHASE11_IMPLEMENTATION_EVIDENCE.md` claimed all gates passed but never actually ran two of them:

- **`pnpm lint` was never run.** It fails on first check: `react-hooks/set-state-in-effect` (error) in `LineBookingClient.tsx`, plus an unused-import warning in the test file.
- **`git diff --check` was never run.** It fails on first check: trailing blank lines at EOF in `app/actions/booking.ts` and `lib/operations-service.ts`.
- **`supabase db lint --local` was never run** (or was run and the warning silently dropped from the evidence doc). It reports `decline_booking_request`'s `p_reason` parameter as unused — because the column to store it didn't exist. The staff UI collects a decline reason via `window.prompt(...)` and it was being silently discarded.

None of these are described anywhere in the implementer's evidence. `tsc` and `pnpm build` were genuinely run and genuinely passed — those parts of the report are accurate.

## Independently Verified: Security (the part the brief flagged as highest-risk)

The brief explicitly called out the Phase 9 NULL-membership-bypass bug class as the most likely failure mode here, because Phase 11 introduces PawSpace's first non-staff-authenticated write actor. Read `supabase/migrations/20260822000000_phase11_customer_booking_requests.sql` in full and confirmed the implementer avoided it structurally, not just by luck:

- `submit_booking_request_internal` and `get_customer_booking_context_internal` are granted **only to `service_role`**, revoked from `PUBLIC, anon, authenticated`. There is no path for a customer's own Supabase session (if one even existed) to call these directly — every call is server-mediated through `lib/line-booking-server.ts`, which re-verifies the LINE ID token on every single request via `verifyLineIdToken` before ever touching the database. This is the same trust boundary Phase 5's claim flow already established, correctly reused rather than reinvented.
- Owner resolution is `WHERE shop_id = p_shop_id AND line_user_id = btrim(p_verified_line_user_id)` — a LINE identity linked to shop A supplying shop B's ID simply matches no row and gets an explicit `RAISE EXCEPTION`, not a silent wrong-tenant success. Confirmed by Test 3 (cross-tenant rejection) passing.
- `confirm_booking_request` / `decline_booking_request` check `IF v_shop_id IS NULL THEN RAISE EXCEPTION` **before** using `v_shop_id` in any query — the NULL check is ordered correctly, unlike the Phase 9 rerun-1 bug where a NULL comparison silently failed to reject.
- `get_customer_booking_context_internal`'s occupied-ranges query returns only `roomId`/`checkIn`/`checkOut` — no other customer's name, phone, or booking identity. Verified by Test 7d.

This is a genuinely well-executed security boundary for the riskiest part of the brief.

## Independently Verified: Executable Evidence (Claude re-run, on a fully reset local stack)

- `pnpm exec tsc --noEmit` — PASS.
- `pnpm lint` — **FAIL initially** (see above), fixed, then PASS.
- `pnpm build` — PASS; `/line/book` present as a dynamic route.
- `git diff --check` — **FAIL initially** (see above), fixed, then PASS.
- `supabase db reset` — PASS; migrations 1–11 (using this repo's actual file timestamps, the 8th migration file) applied cleanly in order.
- `supabase db lint --local` — **1 warning initially** (unused `p_reason`), fixed by adding and wiring a `decline_reason` column, then clean.
- `tests/phase11_customer_self_booking.test.ts` — **45/45 passed**, confirmed twice (before and after the `decline_reason` fix).
- Regression, rerun for real: Phase 3 (33/33 internally, outer harness reports pass), Phase 4 (21/21), Phase 5 (32/32) — all clean. These three were chosen because Phase 11 touches `app/actions/booking.ts`, `app/operations-client.tsx`, and reuses the Phase 5 LINE ID token module.
- Phase 7/8/9 SQL regressions — all PASS.
- Phase 10 E2E suite (`tests/e2e/phase10-pilot.spec.ts`, unmodified) — **8/8 passed** on a fresh stack after all Phase 11 changes, confirming the existing staff Operations pilot flow (which Phase 11 modified directly) has no regression.
- Module Hub (`D:\AI-Workspace\projects\modules-hub`) — untouched; the gate was actually executed with four real candidates checked and rationale recorded (`line-oa-ai-module`, `auth-supabase`, `tenant-context`, `payment`), all correctly `NOT NEEDED`.

## Fixes Applied During This Review

1. `app/line/book/LineBookingClient.tsx` — moved the initial check-in/check-out date computation from a `useEffect` that called `setState` synchronously (an eslint error under this repo's react-hooks rules) into lazy `useState(() => ...)` initializers. Removed the now-unused `useEffect` import.
2. `tests/phase11_customer_self_booking.test.ts` — removed an unused `verifyLineIdToken` import.
3. `app/actions/booking.ts`, `lib/operations-service.ts` — trimmed trailing blank lines at EOF that `git diff --check` correctly flagged.
4. `lib/operations-service.ts` — removed `confirmBookingRequest`/`declineBookingRequest`, a complete duplicate of the RPC-calling logic already implemented (and actually used) in `app/actions/booking.ts`'s `confirmBookingRequestAction`/`declineBookingRequestAction`. Confirmed via grep that nothing imported the `lib/operations-service.ts` versions — dead code, not a second code path in production.
5. `supabase/migrations/20260822000000_phase11_customer_booking_requests.sql` — added `decline_reason TEXT` to `booking_requests` and wired `decline_booking_request(p_reason)` to store it (`NULLIF(btrim(COALESCE(p_reason,'')),'')`). Previously the staff UI's decline-reason prompt was collected and sent to the RPC, which silently discarded it. Safe to add now because this migration is still unshipped/uncommitted; no data migration or backward-compatibility concern.

All fixes reverified: full gate sweep (tsc/lint/build/diff-check/db lint) clean, Phase 11 suite still 45/45, Phase 10 E2E still 8/8.

## One Known, Accepted Follow-Up (Not Blocking)

`app/line/book/page.tsx` and `LineBookingClient.tsx` are styled with raw Tailwind utility classes (`bg-slate-50`, `rounded-3xl`, `text-emerald-700`, etc.) instead of the PawSpace design tokens established by the Design Implementation Pass (`app/globals.css`'s `.card`, `--deep`, `--mint`, `.pilot-*` classes). The Phase 11 brief (§9) explicitly asked for the latter: "go through the already-adapted `app/globals.css` classes so the whole product stays visually consistent, not a second design system."

This is a real deviation from the brief, but customers never see `/login`, `/`, or `/dashboard` — `/line/book` and `/line/claim` are their only surfaces, and `/line/claim` (Phase 5, predates the Design Pass) already has its own separate look. Restyling `/line/book` to match `app/globals.css` properly is a contained, low-risk follow-up but touches enough markup that it deserves its own focused pass rather than being rushed inside this review. Recorded here rather than silently accepted or silently fixed.

## Non-Scope Confirmation

Re-checked against the brief's §6: no payment/deposit code path (Test 10 asserts this directly), no customer-facing cancellation/reschedule/check-in-out, no new service categories, no changes to Phase 1–10 migrations or contracts. `create_booking()`'s staff-only signature and behavior are unchanged (Test 11 + full Phase 4 regression confirm this).

## Repository State at This Verdict

Phase 11 is uncommitted at this review boundary, same convention as every prior phase. Local `master` remains at `e90cfd1`, one commit ahead of `origin/master` (the Design Implementation Pass, also not yet pushed). Nothing has been pushed during this review.
