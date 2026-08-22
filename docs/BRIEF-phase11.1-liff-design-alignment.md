# PawSpace — Phase 11.1 LIFF Design Alignment Pass

Status: **PLANNED — DESIGN-ONLY**
Project: `PawSpace`
Target surface: `/line/book`
Dependency baseline: **Phase 11 Customer Self-Booking PASS**

## 1. Purpose

Phase 11.1 exists to visually align the new customer self-booking LIFF surface with the PawSpace design language already established by the Design Implementation Pass.

This phase must not change booking behavior, LINE identity verification, tenant authority, RPC contracts, database semantics, staff review workflow, or any other Phase 11 functional/security guarantee.

Highest-order rule:

> **Presentation alignment only. Preserve Phase 11 behavior exactly.**

If any desired visual change requires modifying business logic, authorization, data flow, RPC behavior, database shape, integration contracts, or test expectations, that change is **OUT OF SCOPE**.

## 2. Source of Truth

Read these files from local disk before editing:

1. `AGENTS.md`
2. `docs/Design.md`
3. `docs/BRIEF-design-implementation-pass.md`
4. `docs/BRIEF-phase11-customer-self-booking-liff.md`
5. `PHASE11_IMPLEMENTATION_EVIDENCE.md`
6. `REVIEW-phase11-gate1-2026-08-22.md` if present
7. `app/globals.css`
8. `app/line/book/page.tsx`
9. `app/line/book/LineBookingClient.tsx`

## 3. Scope

Allowed changes are restricted to presentation concerns for the customer booking LIFF flow:

- page composition and visual hierarchy
- PawSpace design-token usage
- spacing, typography, colors, borders, radii, shadows
- button, input, select, card, badge, notice, loading, success, and error presentation
- responsive behavior for LINE in-app browser/mobile widths
- focus-visible and disabled states
- reduced-motion behavior
- decorative pet-friendly accents with no data or authority meaning
- extraction of dumb/presentational components if it does not move business logic

Primary files expected to change:

- `app/line/book/page.tsx`
- `app/line/book/LineBookingClient.tsx`
- `app/globals.css`
- optional new presentational component files under `app/line/book/` or `components/`

No dependency installation is required or allowed unless separately approved.

## 4. Hard No-Touch Boundary

Do not modify:

- `supabase/migrations/**`
- `booking_requests` schema, constraints, RLS, grants, or RPCs
- LINE ID-token verification behavior
- `lib/line-booking-server.ts`
- `lib/line-booking-core.ts` business behavior
- `app/actions/line-booking.ts`
- staff confirm/decline authority or booking promotion logic
- booking collision logic, pricing calculations, date validation, or room availability semantics
- customer identity resolution or tenant isolation
- `/line/claim` behavior
- payment/deposit functionality
- Phase 11 tests or assertions merely to accommodate styling changes
- Phase 1–11 migration history
- deployment config, environment variables, credentials, or secrets

## 5. Behavior Freeze

The following Phase 11 behavior is frozen and must remain identical:

- customer identity is verified through LINE on the trusted server boundary
- browser-supplied identity is never authoritative
- customer can only access pets linked to the verified owner/shop context
- cross-tenant requests remain rejected
- request-first flow remains `requested` until staff action
- customer submission does not directly create a confirmed blocking booking
- staff confirmation/decline behavior remains unchanged
- decline reason semantics remain unchanged
- room availability and date validation remain unchanged
- no customer cancellation, reschedule, check-in, or check-out capability is added
- no payment flow is added

No UI treatment may imply that a request is already confirmed when its actual state is only `requested`.

## 6. Visual Target

Use the same PawSpace formula already adopted elsewhere:

`Apple-like Layout + Pet Friendly + Soft Pastel + Rounded Cards + Subtle 3D + Clear Hierarchy`

For `/line/book`, optimize specifically for a LINE in-app browser rather than desktop SaaS navigation.
Required emphasis:

- mobile-first, single-column primary flow
- clear progress from identity/context loading → selection → submission → result
- high readability in 320–480px widths
- 44×44px minimum interactive targets
- clear selected states that do not rely on color alone
- clear distinction between informational text and actionable controls
- primary CTA must look tactile and obvious without appearing game-like
- error/success messaging must remain semantically accurate
- no fake pets, rooms, prices, availability, or booking states

## 7. Required Component States

Where applicable, every interactive element must support:

- Default
- Hover where meaningful
- Focus-visible
- Pressed
- Disabled
- Loading
- Error
- Success
- Reduced motion

Form controls must preserve native semantics, labels, required attributes, input types, and existing validation behavior.
## 8. LIFF-Specific UX Rules

The customer is expected to use this page inside LINE. Therefore:

- do not introduce desktop sidebar/navigation
- avoid horizontal overflow at 320px
- keep primary action reachable without tiny controls
- allow content to expand safely for Thai text and LINE profile-derived names
- account for mobile browser safe spacing and virtual keyboard pressure
- do not hide critical status behind hover-only interactions
- do not auto-submit selections merely for visual convenience
- do not replace explicit confirmation copy with decorative ambiguity

## 9. Design Token Alignment

Prefer existing `app/globals.css` PawSpace tokens/classes over raw one-off Tailwind color/radius/shadow values when equivalent tokens already exist.

This phase should remove the Phase 11 review's accepted visual inconsistency: `/line/book` currently uses raw Tailwind styling in places instead of the established PawSpace design system.

Do not perform a repository-wide CSS cleanup. Only align what `/line/book` needs.

If a new reusable token/class is necessary, it must:

- represent a presentational concept only
- not encode business state semantics beyond visual treatment
- be named consistently with the existing PawSpace CSS system
- not break `/login`, `/`, or `/dashboard`

## 10. Required Workflow

Execute in this order:

1. **Inspect** — read Source of Truth files, current LIFF UI, current PawSpace CSS, and real git state.
2. **Baseline** — record current modified/untracked files before any Phase 11.1 edit.
3. **Behavior Map** — identify every existing event handler, server-action call, validation branch, loading/error/success state, and data-derived condition that must remain unchanged.
4. **Design Map** — map existing PawSpace tokens/components onto `/line/book` without changing logic.
5. **Implement** — presentation-only edits.
6. **Static Gates** — `pnpm lint`, `pnpm build`, `git diff --check`.
7. **Phase 11 Regression** — rerun the dedicated Phase 11 suite; expected baseline is 45/45.
8. **Phase 10 E2E Regression** — rerun the existing unmodified Phase 10 E2E suite; expected baseline is 8/8.
9. **Visual Inspect** — inspect `/line/book` at minimum 320px, 390px, 430px, and a wider mobile/tablet viewport.
10. **Diff Audit** — prove no forbidden business/security files were changed by this pass.
11. **Reviewer Verdict** — independent review before declaring pass.

Do not change test assertions merely because styling breaks a selector. Preserve stable test hooks such as `data-testid` where already present.

## 11. Git / File Guardrail

Before editing, capture:

```powershell
git status --short
git diff --name-only
git rev-parse --short HEAD
```

Pre-existing changes must be recorded separately and must not be silently attributed to Phase 11.1.
If the final diff includes any of these from Phase 11.1, stop for review:

- `supabase/**`
- `lib/line-booking-server.ts`
- `lib/line-booking-core.ts`
- `app/actions/**`
- unrelated API routes
- auth/tenant/entitlement/service-layer logic
- package manager manifests or lockfiles
- `.env*` or deployment configuration

## 12. Acceptance Criteria

Phase 11.1 passes only when all are true:

- `/line/book` visibly matches the PawSpace Design Implementation Pass
- raw one-off styling is reduced in favor of established PawSpace tokens/classes where practical
- mobile widths 320–480px have no horizontal layout break
- Thai copy remains readable and no operational information is clipped
- touch targets and keyboard focus remain accessible
- loading, disabled, error, success, and selected states remain visible and truthful
- no fake operational/customer data is introduced
- request-first semantics are unchanged
- LINE verification and tenant isolation are unchanged
- Phase 11 dedicated regression remains 45/45 or the current verified equivalent without weakened assertions
- Phase 10 E2E remains 8/8 or the current verified equivalent without weakened assertions
- `pnpm lint`, `pnpm build`, and `git diff --check` pass
- forbidden-file diff audit is clean
- independent reviewer confirms the change is presentation-only

## 13. Visual Inspection Checklist

Inspect at minimum:
- initial LIFF/context loading
- linked-customer happy path
- pet selection
- room selection/availability presentation
- date input state
- estimated booking information if already provided by Phase 11
- submit enabled/disabled states
- pending submission state
- explicit request-created success state
- authorization/identity error presentation
- server/network error presentation
- long Thai/customer/pet/shop names
- reduced-motion behavior
- focus-visible navigation

## 14. Deliverables

1. `/line/book` design alignment implementation.
2. `PHASE11.1_DESIGN_EVIDENCE.md` documenting baseline, files changed, design rationale, visual inspection, static gates, regression results, and forbidden-file audit.
3. No modification to Phase 11 functional evidence except an optional cross-reference after independent review.
4. Reviewer verdict exactly one of:
   - `PHASE 11.1 DESIGN ALIGNMENT — PASSED`
   - `PHASE 11.1 DESIGN ALIGNMENT — FAILED / FIX REQUIRED`

## 15. Stop Conditions

Stop and report before proceeding if:

- visual work requires altering LINE identity/session behavior
- a design change requires altering booking/request data contracts
- a new dependency appears necessary
- an existing Phase 11 test must be weakened or rewritten to pass
- a change would affect staff authority, tenant isolation, room collision, pricing, or confirmation/decline semantics
- existing PawSpace tokens cannot support the design without a repository-wide refactor

Phase 11.1 has no authority to fix unrelated technical debt discovered during implementation. Record unrelated findings separately.

> **Final rule: make the Phase 11 customer booking flow look like PawSpace; do not make it behave differently.**
