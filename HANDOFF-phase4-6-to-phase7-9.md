# PawSpace Handoff — Phase 4–6 → Phase 7–9

Date: 2026-08-21
Repository: Gutumrod/pawspace
Local path: D:\AI-Workspace\projects\saas-product-hub\products\PawSpace
Branch: master

## Chat / Phase Partition Rule

Unchanged from `HANDOFF-phase1-3-to-phase4-6.md`:

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

- Phase 1 — Target Database Migration: PASSED — commit `6a99790`
- Phase 2 — DB Constraints / RPC / RLS: PASSED — commit `90c3b50`
- Phase 3 — Auth + Tenant Context: PASSED after Gate 1 + Claude Gate 2 fixes — commit `e8e8be4`
- Phase 4 — Booking Backend Service + Server Actions: PASSED, matched the implementer's report exactly on Claude's independent re-run, no fixes needed — commit `6062924`
- Phase 5 — LINE LIFF Identity Claim: PASSED after Claude completed a truncated test file (`run()` was opened but never closed/called/given a summary footer) — commit `c8f8be7`
- Phase 6 — Daily Report Media + LINE Delivery: PASSED after Claude removed an unnecessary `import "server-only"` from 3 files (`lib/daily-report-media.ts`, `lib/daily-report-storage.ts`, `lib/line-transport.ts`) that made the delivered test suite unable to run at all outside the Next.js build system — commit `2bee03f`

Do not rewrite committed Phase 1–6 migrations unless a blocking defect is proven by executable evidence.

## Known Tracked Gap

GitHub Issue #3 (still open) tracks the Phase 3 server-action test gap:

- the fixed Next.js server-action paths (`lib/auth.ts::loginWithPassword`, `app/actions/staff.ts::removeStaffAction`/`inviteStaffAction`) are not yet covered by a true HTTP-runtime E2E test
- confirmed by direct probe: `next/headers`'s `cookies()` cannot be resolved/invoked outside the actual Next.js request or build runtime, so covering these needs either a real running `next dev`/`next start` server hit over HTTP, or a `next/headers` mock - both meaningfully bigger than a normal bug fix
- this is a tracked test-coverage gap, not permission to weaken the Phase 3 contract

Phase 7–9 work must not silently close or ignore Issue #3. If later work naturally introduces the required HTTP/E2E harness, add coverage and reference the issue.

### New pattern established in Phase 5–6: don't guard pure logic with `"server-only"`

Twice now (Phase 5, Phase 6) a delivered test file could not run because a module it needed to import directly had an `import "server-only"` guard despite touching no secrets or env vars itself (it received credentials/clients as parameters). That package throws unconditionally the instant it's imported outside Next.js's own build system - it is not a soft warning.

Established precedent going forward: only guard the file that actually reads `process.env` / calls `getSupabaseAdminClient()` / holds a secret. Pure business logic that takes credentials as a parameter (e.g. `lib/line-claim-core.ts`, and now the fixed `lib/daily-report-media.ts` / `lib/daily-report-storage.ts` / `lib/line-transport.ts`) should carry no `"server-only"` import, so it stays testable with a plain `npx tsx` script. If Phase 7+ adds new service/library files, follow this split from the start rather than have Claude find and fix it again.

## Mandatory Review Workflow

For every Phase:

`Explain → Check Module Hub → Compatibility Gate → Implement → Test → Inspect → Verdict`

Do one Phase at a time. Never release the next Phase until the current Phase receives:

`PHASE PASSED — READY TO RELEASE NEXT PHASE`

## Reviewer Roles

- Implementer may be ChatGPT, AGY, Hermes-dispatched AGY, Claude, or another coding agent.
- ChatGPT is Reviewer Gate 1 and must inspect local files, diff, tests, and git state directly.
- Claude is Reviewer Gate 2 when used for final independent review and commit/push decision.
- Never trust agent self-report, READY/100%, or test summaries without checking the local repository. Every phase so far (3 through 6) has had at least one claim that didn't hold up until independently re-run - this is not hypothetical caution, it is the observed track record.
- If a technical bug can be proven from the local code/tests, fix or return it through the current review workflow; do not silently advance Phase.

Commit policy:

- Commit boundaries are chosen by testable change groups, not strictly one commit per Phase.
- A Phase may remain uncommitted until a sensible integration checkpoint.
- Do not commit/push merely because implementation reports completion.
- Commit/push only after required review gates pass.

## Mandatory Module Hub Reuse Gate

Module Hub path: `D:\AI-Workspace\projects\modules-hub`

For PawSpace work, Module Hub is READ-ONLY and copy-and-own only. Before using any Module Hub component:

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

So far only Phase 4 ran this gate (verdict: `NOT NEEDED` - confirmed no booking/room module exists in `modules-hub/modules/`). Phases 1–3 predate the gate's existence in `AGENTS.md`; Phases 5–6 did not record an explicit verdict - if Phase 7+ needs a candidate from `webhook`, `http-client`, `config-runtime`, `file-storage`, `notification`, `job-retry`, `audit-log`, or `scheduler`/`event-bus`, run the gate properly and record the result.

## Locked Product / Security Invariants

- Every Pet in a Booking belongs to booking.owner_id.
- A Pet cannot have overlapping active bookings.
- Booking lifecycle: confirmed → checked_in → checked_out OR confirmed → cancelled.
- checked_in cannot be cancelled.
- maintenance cannot overlap active room bookings.
- checked_out rooms must pass cleaning before available.
- Daily Report requests are idempotent (per-tenant idempotency_key + request_fingerprint) while allowing multiple distinct reports per day.
- Daily Report photos: original kept as-uploaded (any of 9 accepted formats); a normalized JPEG/PNG rendition (<=1024px) is what LINE actually receives, since LINE Flex only renders JPEG/PNG.
- LINE daily-report delivery uses a persistent X-Line-Retry-Key per report, reused across every retry; HTTP 200 and 409 both count as accepted. A retry key must not be reused past LINE's 24h safety window - `line_first_attempt_at` enforces this at both the DB claim layer and the transport layer.
- LINE worker claims are atomic (`FOR UPDATE SKIP LOCKED`); a stale `sending` lease (>5min) is reclaimed with the same retry key, never a new one.
- LINE Claim TTL = 48 hours, hash-at-rest, single-use, trusted-server consume.
- Roles: Owner all; Manager operations but no staff-account/role management; Staff operations.
- Browser has no generic INSERT/UPDATE/DELETE on core business tables, and cannot upload directly into the daily-report-photos bucket.
- Browser never holds service_role.
- Multi-tenant isolation is enforced at every layer.
- Google Sheet binding requires proof-of-control (RPC exists from Phase 2; binding flow/worker itself not yet built or tested).
- Business date V1 = Asia/Bangkok.
- Pure business/service logic (parameters carry credentials) must not import `"server-only"` - only the file that actually reads env vars or holds a client factory should.

## Phase 7–9 Scope

Not written into this repo. The user holds the Phase 7 scope directly and will provide it to the new chat. Do not infer or invent Phase 7–9 content from `docs/ROADMAP.md`'s original 4-phase framing (that document predates the current 1–10 phase numbering used in this handoff series and its "Phase 2/3/4" labels do not correspond to the phases tracked here) - get the real scope from the user at the start of the new chat.

## End-of-Chat Rule

Phase 6 is fully passed - this chat group (Phase 4–6) is closed per the partition rule. Start a new chat for Phase 7–9; it should begin by reading this handoff, `AGENTS.md`, and the current Source of Truth files from local disk, then get the actual Phase 7 scope from the user before explaining/implementing anything.
