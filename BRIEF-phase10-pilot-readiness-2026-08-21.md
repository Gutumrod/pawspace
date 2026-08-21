# PawSpace — Phase 10 Pilot Readiness Execution Brief

Date: 2026-08-21
Repository: `Gutumrod/pawspace`
Local path: `D:\AI-Workspace\projects\saas-product-hub\products\PawSpace`
Branch: `master`
Required baseline: `485d941` (`feat(dashboard): implement Phase 9 owner/manager dashboard + commercial entitlements`)

## Phase 10 Identity

**Phase 10 = Pilot Readiness / Closed-Beta Integration Phase.**

This is NOT a feature-expansion phase and NOT the old Roadmap "Phase 3 Monetization" phase.
The goal is to make the already-built Phase 1–9 capabilities usable end-to-end by one real single-store pet hotel without mock operational data.

## Mandatory workflow

`Explain → Check Module Hub → Compatibility Gate → Implement → Test → Inspect → Reviewer Verdict`

Do not commit/push until Reviewer Gate passes.## Source of Truth Priority

1. `docs/PRD.md`
2. `docs/SYSTEM_ARCHITECTURE.md`
3. `docs/ROADMAP.md`
4. `docs/BUSINESS_MODEL.md`
5. `docs/IMPLEMENTATION_STATUS.md`
6. `README.md`
7. Phase 9 final review/evidence

If documents conflict, do not invent a new product rule. Stop at the narrower safe interpretation and record the conflict for Reviewer.

## Locked Phase 10 Scope — Only Four Workstreams

### A. Live Staff Operations Surface
Replace the current mock/preview operational home with authenticated, tenant-scoped live data.

One canonical operations route must support active `owner`, `manager`, and `staff`. Unauthenticated, inactive, or no-membership sessions are denied.

Minimum live views:
- Room Matrix with `available / occupied / cleaning / maintenance`
- today's/upcoming check-ins and active stays
- booking/pet/owner context needed by staff
- Daily Report delivery state
- safe integration status only; never secrets### B. Pilot-Critical Mutations — UI/Server Wiring Only
Use existing authoritative RPCs/services. Do not create generic CRUD bypasses.

Required pilot flows:
- Login/logout with active staff membership enforcement
- Owner-only staff management: invite, enable/disable, role change, remove
- Owner/Manager room setup: create room, edit room config, maintenance
- Customer + Pet: create and edit the minimum profile data required for booking
- Booking: create, assign/remove pets, reschedule confirmed booking, check-in, check-out, cancel
- Cleaning: mark room clean
- LINE owner linking: generate claim flow; manager/owner reset only
- Daily Report: real 1–4 image upload, canonical statuses/note, send through existing pipeline, display delivery status, retry failed delivery
- Google Sheets: existing verified bind/disconnect flow and status

Destructive Customer/Pet deletion and pet-owner transfer do not need new UI in Phase 10 unless a real pilot blocker is proven. Existing backend contracts must remain intact.

### C. Pilot UX Hardening
- iPad-first and mobile-usable
- keep Apple-like, soft pastel, pet-friendly visual language already chosen for PawSpace
- clear loading, empty, success, validation, forbidden, integration-failure states
- no mock operational numbers, fake activity feed, fake dates, or preview toasts on the canonical pilot route
- do not perform a design-system rewrite or introduce a heavy UI framework### D. Pilot E2E & Release Evidence
Add a real browser/HTTP runtime E2E harness for the pilot path. Prefer Playwright or an equivalent browser-driven harness against a running Next.js server + local Supabase.

The E2E suite must cover at minimum:
- valid owner login reaches authorized app
- valid manager reaches operations but not owner-only staff controls
- valid staff reaches operations but not manager/owner controls
- inactive/no-membership login is rejected and no usable app session remains
- owner invite flow creates a usable login path
- owner remove flow removes authoritative membership and exercises Auth cleanup behavior
- room setup → owner/pet → booking → add pet → check-in → Daily Report → check-out → cleaning → mark clean
- cross-tenant access cannot expose or mutate another shop

If the new real HTTP/browser harness genuinely covers the existing GitHub Issue #3 cases, reference the executable evidence and only then close Issue #3. Otherwise leave it OPEN.

External LINE/Google calls must not be required for CI/local E2E. Use existing local/mock transport boundaries for automation, then provide a separate manual Pilot Smoke Checklist for real credentials.

## Explicit Non-Scope — Do Not Implement in Phase 10

- Billing UI, checkout, Stripe, payment core, invoices, payment webhooks
- PromptPay QR, SlipOK, e-Tax, receipt automation
- hard enforcement of Starter 10-room / 300-pet limits
- automatic subscription renewal, expiry, past_due/grace-period processing
- customer upgrade/downgrade/cancel plan controls
- automatic Founding Member continuity verification
- Google Drive photo backup
- grooming queue, clinic/pharmacy, vaccine recall, digital pet passport
- multi-branch management
- new camera streaming architecture or changes to the Phase 8 access contract
- paid camera/add-on checkout
- AI receptionist / AI workflow / LINE OA AI expansion
- automatic legacy-data import pipeline
- analytics/reporting suite beyond operational data required by the pilot
- public marketing website redesign

Phase 10 may DISPLAY Phase 9 plan/entitlement information, but may not enforce or collect payment from it.

## Database / Authority Constraint
Prefer zero new business mutation authority. Existing Phase 1–9 RPCs remain authoritative.
A Phase 10 migration is permitted only for a narrow read model, missing privilege-safe query surface, or test/support requirement that cannot safely be implemented with existing RLS/RPCs.

Any new read RPC must derive tenant from authenticated context, fail closed, expose a narrow DTO, and never return integration credentials, token hashes, service keys, raw camera feed URLs, claim secrets, or private internal error details.

## Module Hub Compatibility Gate

Module Hub was inspected at `D:\AI-Workspace\projects\modules-hub` including `README.md`, `INDEX.md`, `SECURITY.md`, and `modules/REGISTRY.md`.

Phase 10 verdict: **`NOT NEEDED`**.

Reason: Phase 10 adds no new generic platform capability. It wires PawSpace-owned Phase 1–9 auth, tenant, booking, LINE, storage, sync, camera, and entitlement boundaries into a pilot UI and E2E harness. Copying Auth/Tenant/Subscription/Import/Health modules now would create duplicate authority or broaden scope during pilot hardening.

Do not modify Module Hub. Do not import across repositories.

## Role Matrix for Pilot UI

- Owner: operations + staff management + room config + integrations
- Manager: operations + room config + LINE reset + Google Sheet management; no staff-account/role management
- Staff: core operations, booking lifecycle, customer/pet creation/edit needed for daily work, Daily Report, mark clean; no room configuration/maintenance, staff management, or integration administration

The database/RPC contract wins over UI visibility. Hiding a button is not authorization.

## Data / Error Rules

- `Asia/Bangkok` business date only
- no browser `service_role`
- no generic DML on invariant-bearing tables
- no silent fallback from DB/integration errors to fake success/zero/offline state
- user-facing errors must be safe and actionable; logs may contain diagnostic codes but no secrets
- loading/empty/error states must not leak cross-tenant existence information## Acceptance Gates

### Gate 62 — No Mock Pilot Surface
Canonical pilot operations route contains no seeded rooms, fake customers, fake activity, hard-coded shop identity, or preview-only mutation behavior.

### Gate 63 — Role & Tenant Authorization
Owner/Manager/Staff permissions match the locked matrix; inactive/no-membership/unauthenticated are denied; tenant A cannot read or mutate tenant B.

### Gate 64 — Core Daily Loop UI
Executable browser flow proves real room/customer/pet/booking/check-in/report/check-out/clean lifecycle through existing authoritative gateways.

### Gate 65 — Daily Report Delivery Surface
1–4 real files accepted according to Phase 6 rules; successful creation shows persistent delivery state; failed delivery exposes authorized retry without minting a new retry key.

### Gate 66 — Pilot Setup Controls
Owner can manage staff; Owner/Manager can configure rooms and Google Sheet binding; LINE claim/reset obeys existing role rules.

### Gate 67 — Integration Safety
No LINE/Google/camera secret is rendered or bundled client-side. External outage is visible as an error/degraded state, never fake success.

### Gate 68 — Responsive Pilot UX
Primary operations are usable at iPad landscape/portrait and modern phone widths. Critical controls are keyboard/focus accessible and destructive actions require explicit confirmation.### Gate 69 — Real Runtime E2E
A browser/HTTP test runs against a real Next.js runtime and local Supabase. Pure static inspection or direct RPC-only tests are insufficient for this gate.

### Gate 70 — Regression Safety
Phase 4–9 executable suites still pass. No committed Phase 1–9 migration is rewritten unless a blocking defect is independently proven and documented.

### Gate 71 — Production Build Gates
Required minimum:
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- `pnpm exec supabase db reset`
- `pnpm exec supabase db lint --local`
- relevant Phase 7/8/9 DB regression suites
- Phase 10 E2E suite

### Gate 72 — Pilot Runbook
Create `PHASE10_PILOT_RUNBOOK.md` containing:
- required env/credentials by integration, without secret values
- one-store onboarding sequence
- how to create first Owner/Manager/Staff
- room setup
- LINE owner-link setup
- Google Sheet binding
- daily opening/closing smoke checks
- rollback / disable-integration steps
- known limitations and manual checks

## Required Implementation Evidence
Create `PHASE10_IMPLEMENTATION_EVIDENCE.md` with exact commands and raw totals/results. Do not write only `PASS`.## Recommended Implementation Order

1. Verify baseline/git status and re-read SoT + Phase 9 final review.
2. Inventory current mock UI and existing server actions/services/RPCs.
3. Add only missing thin service/action wrappers over existing RPCs.
4. Build live operational read model(s) with strict tenant/role boundaries.
5. Replace preview operations UI with live Room/Booking/Customer/Pet/Daily Report flows.
6. Add owner/manager setup controls needed for one-store pilot.
7. Add real browser/HTTP E2E harness and fix only defects proven by it.
8. Run complete regression/build/security gates.
9. Write Pilot Runbook + Implementation Evidence.
10. Stop for Reviewer Gate. No Phase 11 work.

## Commit / Push Rule

Do not commit or push implementation merely because tests from the implementer pass.
Reviewer must inspect local files, diff, repository state, SQL privileges, client bundles/surfaces, and executable evidence first.

Only after Reviewer verdict:

`PHASE PASSED — PILOT READY`

may the Phase 10 implementation be committed/pushed.

## Implementer Final Claim

The implementer may end only with:

`IMPLEMENTATION COMPLETE — AWAITING PHASE 10 REVIEWER GATE`

Do not claim production-ready, commercial-ready, billing-ready, or 100% complete.