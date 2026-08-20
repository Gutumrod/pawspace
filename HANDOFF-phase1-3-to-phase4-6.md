# PawSpace Handoff — Phase 1–3 → Phase 4–6

Date: 2026-08-20
Repository: Gutumrod/pawspace
Local path: D:\AI-Workspace\projects\saas-product-hub\products\PawSpace
Branch: master

## Chat / Phase Partition Rule

PawSpace development is intentionally split into **3 Phases per ChatGPT chat** to keep review context bounded and auditable.

- Chat 1: Phase 1–3
- Chat 2: Phase 4–6
- Chat 3: Phase 7–9
- Final Chat: Phase 10 Pilot

A new chat must read this handoff and the current Source of Truth files from local disk before releasing the next Phase.
## Source of Truth Priority

1. docs/PRD.md
2. docs/SYSTEM_ARCHITECTURE.md
3. docs/ROADMAP.md
4. docs/BUSINESS_MODEL.md
5. docs/IMPLEMENTATION_STATUS.md
6. README.md

Architecture/documentation is a contract. Do not redesign product decisions during implementation.

## Closed Phase Baseline

- Phase 1 — Target Database Migration: PASSED
  - commit `6a99790`
- Phase 2 — DB Constraints / RPC / RLS: PASSED
  - commit `90c3b50`
- Phase 3 — Auth + Tenant Context: PASSED after Gate 1 + Claude Gate 2 fixes
  - commit `e8e8be4`

Do not rewrite committed Phase 1–3 migrations unless a blocking defect is proven by executable evidence.
## Known Tracked Gap

GitHub Issue #3 tracks the remaining Phase 3 test gap:

- the fixed Next.js server-action paths are not yet covered by a true HTTP-runtime E2E test
- specifically login rejection behavior, invite-email flow, and Auth cleanup on staff removal need a real Next.js runtime or appropriate harness
- this is a tracked test-coverage gap, not permission to weaken the Phase 3 contract

Phase 4–6 work must not silently close or ignore Issue #3. If later work naturally introduces the required HTTP/E2E harness, add coverage and reference the issue.

## Mandatory Review Workflow

For every Phase:

`Explain → Check Module Hub → Compatibility Gate → Implement → Test → Inspect → Verdict`

Do one Phase at a time. Never release the next Phase until the current Phase receives:

`PHASE PASSED — READY TO RELEASE NEXT PHASE`
## Reviewer Roles

- Implementer may be ChatGPT, AGY, Hermes-dispatched AGY, Claude, or another coding agent.
- ChatGPT is Reviewer Gate 1 and must inspect local files, diff, tests, and git state directly.
- Claude is Reviewer Gate 2 when used for final independent review and commit/push decision.
- Never trust agent self-report, READY/100%, or test summaries without checking the local repository.
- If a technical bug can be proven from the local code/tests, fix or return it through the current review workflow; do not silently advance Phase.

Commit policy:

- Commit boundaries are chosen by testable change groups, not strictly one commit per Phase.
- A Phase may remain uncommitted until a sensible integration checkpoint.
- Do not commit/push merely because implementation reports completion.
- Commit/push only after required review gates pass.

## Mandatory Module Hub Reuse Gate

Module Hub path: `D:\AI-Workspace\projects\modules-hub`

For PawSpace work, Module Hub is READ-ONLY and copy-and-own only.
Before using any Module Hub component:

1. Read Module Hub README.md, INDEX.md, SECURITY.md, and modules/REGISTRY.md from disk.
2. Inspect git status/version/source of the candidate module.
3. Read its MODULE.md, DESIGN.md, integration example, tests, limitations, and host responsibilities.
4. Compare the module contract with PawSpace PRD, SYSTEM_ARCHITECTURE, and locked invariants.
5. Record one status: APPROVED TO REUSE / ADAPTER ONLY / NOT COMPATIBLE / NOT NEEDED.
6. If approved, copy the complete module directory into PawSpace first.
7. Adapt only the PawSpace-owned copy.
8. Never import across repositories and never modify modules-hub for a PawSpace-specific fix.
9. PawSpace host must inject secrets/config; never hard-code credentials or production data.

`Completed` in Module Hub means its own completion gate passed. It does not mean automatic PawSpace compatibility.

## Locked Product / Security Invariants

- Every Pet in a Booking belongs to booking.owner_id.
- A Pet cannot have overlapping active bookings.
- Booking lifecycle: confirmed → checked_in → checked_out OR confirmed → cancelled.
- checked_in cannot be cancelled.
- maintenance cannot overlap active room bookings.
- checked_out rooms must pass cleaning before available.
- Daily Report requests are idempotent while allowing multiple reports per day.
- LINE Claim TTL = 48 hours, hash-at-rest, single-use, trusted-server consume.
- Roles: Owner all; Manager operations but no staff-account/role management; Staff operations.
- Browser has no generic INSERT/UPDATE/DELETE on core business tables.
- Browser never holds service_role.
- Multi-tenant isolation is enforced at every layer.
- Google Sheet binding requires proof-of-control.
- Business date V1 = Asia/Bangkok.

## Next Chat Scope — Phase 4–6

### Phase 4 — Booking Backend

Operational flow:
Booking → Room Assignment → Check-in → Care → Check-out → Cleaning → Available

Includes create booking, add/remove pet, schedule change, availability validation, room assignment, check-in, checkout, cancellation, maintenance, cleaning. Must use Asia/Bangkok business date and preserve Phase 2 authoritative RPC/security boundaries.

Before implementation, inspect Module Hub for reusable pieces and record compatibility. Do not invent a replacement for existing DB-authoritative booking contracts.
### Phase 5 — LINE LIFF Claim

Implement owner ↔ LINE identity claim with 48-hour token TTL, SHA-256 hash-at-rest, single-use consume, relink/reset, trusted-server identity verification, and cross-tenant protection. Browser must not call internal consume directly.

Before implementation, inspect Module Hub candidates such as webhook/http/config/auth helpers, but do not weaken PawSpace claim authority or trusted-server boundaries.

### Phase 6 — Daily Report + LINE Transport

Implement Daily Report persistence, 1–4 photos, storage, idempotency/fingerprint, LINE Flex transport, persistent retry key, X-Line-Retry-Key, pending/sending/sent/failed states, worker lease/recovery, and manual retry. Must test race with checkout.

Module Hub candidates likely include file-storage, notification, job-retry, config-runtime, audit-log, scheduler/event-bus. Each requires contract review before copy-and-own reuse.

## End-of-Chat Rule

After Phase 6 is fully passed, stop this chat group and create a new handoff for Phase 7–9. Do not start Phase 7 in the Phase 4–6 chat unless the user explicitly changes the partition rule.

The next chat should begin by reading this file, AGENTS.md, and the current Source of Truth from local disk before explaining Phase 4.
