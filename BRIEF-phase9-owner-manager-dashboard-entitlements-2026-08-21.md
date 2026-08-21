# PawSpace — Phase 9 Implementation Brief

Date: 2026-08-21
Repository: `Gutumrod/pawspace`
Local repository: `D:\AI-Workspace\projects\saas-product-hub\products\PawSpace`
Branch: `master`
Required baseline HEAD: `5611c52` — `feat(camera): implement Phase 8 public visitor camera access`

## CRITICAL: LOCAL-DISK EXECUTION CONTRACT FOR MANUS

**ทุกไฟล์ของงานนี้ต้องถูกสร้าง/แก้ในเครื่อง Local Windows ที่ path ด้านบนเท่านั้น**

Manus MUST NOT implement only inside a Manus cloud workspace, cloud sandbox, temporary VM, cloud artifact, or an internal project copy.
A cloud-created file/report is NOT a delivery unless the exact file also exists under the local repository path above.

Before editing anything, execute against the local machine and prove all of the following:
1. `Set-Location 'D:\AI-Workspace\projects\saas-product-hub\products\PawSpace'`
2. `git rev-parse --show-toplevel` returns this exact PawSpace directory.
3. `git branch --show-current` returns `master`.
4. `git rev-parse --short HEAD` returns `5611c52` unless the human explicitly changed the baseline after this brief.
5. `git status --short --branch` is recorded before implementation.

If Manus cannot write directly into this local path, **STOP** and report `LOCAL WRITE UNAVAILABLE`.
Do not continue in cloud and do not claim READY/DONE.
## Baseline / Safety Rules

Phase 7 and Phase 8 are already committed locally but not yet pushed to `origin/master`.
At brief creation time local `master` is ahead of origin by 2 commits:
- `c1a60e3` — Phase 7 Google Sheets sync
- `5611c52` — Phase 8 public visitor camera access

Therefore:
- **DO NOT** `git reset --hard origin/master`.
- **DO NOT** checkout/recreate from remote and lose Phase 7–8.
- **DO NOT** pull/rebase/force-reset unless explicitly ordered by the human.
- **DO NOT** rewrite Phase 1–8 migrations.
- **DO NOT** commit or push Phase 9. Reviewer decides commit/push after Gate 1.
- GitHub Issue #3 must remain OPEN unless real HTTP-runtime E2E coverage is deliberately added and independently reviewed.

Phase 8 passed Gate 1. Read `REVIEW-phase8-gate1-2026-08-21.md` before implementation.

## Mandatory Source of Truth Reading Order

Read from LOCAL DISK before coding:
1. `AGENTS.md`
2. `HANDOFF-phase4-6-to-phase7-9.md`
3. `REVIEW-phase8-gate1-2026-08-21.md`
4. `docs/PRD.md`
5. `docs/SYSTEM_ARCHITECTURE.md`
6. `docs/ROADMAP.md`
7. `docs/BUSINESS_MODEL.md`
8. `docs/IMPLEMENTATION_STATUS.md`
9. `README.md`

Architecture/product documents are contracts. Do not redesign pricing or scope during implementation.
## Phase 9 Locked Scope

Phase 9 has exactly two implementation goals:

### A. Owner / Manager Dashboard
Build a real tenant-scoped dashboard for **Owner and Manager only**.
It must read live PawSpace data, not mock preview data.
The dashboard is an operational overview, not a new operational mutation surface.

Minimum live dashboard information:
- current shop identity and signed-in role;
- room-state summary from current tenant data (`available`, `occupied`, `cleaning`, `maintenance`);
- current booking/occupancy summary using existing authoritative booking data;
- Daily Report delivery summary using existing report lifecycle fields;
- integration/status summary where safely derivable from existing Phase 5–8 state;
- current commercial plan / entitlement summary from the Phase 9 architecture below.

The UI should remain single-store focused and usable on iPad/mobile.
Visual direction: clean Apple-like layout, soft pastel accents, pet-friendly, readable first.
Do not add a heavy UI framework solely for this Phase.

### B. Package / Pricing / Entitlement Architecture
Add the internal architecture that can represent PawSpace commercial packages and resolve a shop's effective entitlements.
This is **architecture + read-only visibility**, not payment collection.

Canonical prices/offer facts MUST match the current Source of Truth:
- Starter: 990 THB/month, 9,900 THB/year; 10 rooms / 300 pet-history limit when enforcement is later activated.
- Pro: 1,490 THB/month, 14,900 THB/year; room/pet limits unlimited.
- Enterprise: 2,490 THB/month, 24,900 THB/year; single-store Pro Plus / unlimited staff / priority support as documented.
- Founding Member Decision C2: effective Pro entitlement at 990 THB/month while subscription continuity is maintained; non-transferable; excludes future paid add-ons.

Do not silently change any number or entitlement.
## Explicit NON-SCOPE — Do Not Implement

The following are OUT of Phase 9 even if Module Hub or ROADMAP contains them:
- customer billing page or subscription checkout UI;
- Stripe integration, Payment Core, payment intents, cards, invoices, webhooks, charge execution;
- PromptPay payment flow, SlipOK, auto receipt, e-Tax;
- customer-facing plan upgrade/downgrade/cancel buttons;
- automatic renewal collection;
- hard enforcement of Starter room/pet quotas in business mutation RPCs;
- automatic expiry/past-due/grace-period processing;
- future paid add-on purchase flow;
- multi-branch dashboard;
- grooming/clinic/passport features;
- changes to Phase 8 camera access contract except a proven regression fix.

Important distinction: represent limits/entitlements now, **do not enforce commercial hard limits now**.
Existing booking/room/pet security and business invariants remain authoritative.

## Mandatory Module Hub Compatibility Gate

Module Hub is READ-ONLY:
`D:\AI-Workspace\projects\modules-hub`

Manus must re-read `README.md`, `INDEX.md`, `SECURITY.md`, `modules/REGISTRY.md`, inspect Module Hub git status, and inspect any candidate before use.
Never import across repositories and never modify Module Hub for PawSpace.

Pre-review classification for Phase 9:
- `modules/subscription` v0.1.0 — **ADAPTER ONLY**.
  Reason: entitlement dictionary / `null = unlimited` / repository abstraction are useful, but the full module also contains subscription lifecycle and billing-event behavior outside Phase 9.
  Do NOT copy the full module merely to inherit billing lifecycle code.
- `modules/payment` — **NOT NEEDED**. Payment execution is explicitly outside Phase 9.
- `modules/feature-flags` — **NOT NEEDED**. Commercial entitlement resolution must not be split into an unrelated in-memory feature-flag authority.

If Manus disagrees with a classification, stop and document the exact contract conflict before copying anything.
## Required Architecture Boundaries

### Authorization
- Dashboard page/API/server action must require an active PawSpace tenant context.
- Access is Owner or Manager only; plain Staff must receive a deterministic forbidden/redirect outcome.
- Reuse `requireManagerOrOwnerContext()` or an equivalent existing hardened context helper; do not invent a weaker role check.
- Disabled staff must remain denied through the existing tenant/auth contract.

### Tenant Isolation
- Never accept `shop_id` from browser input as authority.
- Resolve shop from authenticated tenant context on trusted server paths.
- No cross-tenant dashboard aggregation in Phase 9.
- Any new DB helper/RPC must derive or verify current shop and must have negative tests for tenant A vs tenant B.

### Database Authority
- Browser must not receive generic INSERT/UPDATE/DELETE on plan, assignment, entitlement, or core business tables.
- Browser must never hold `service_role`.
- If new tables are needed, enable RLS and explicitly revoke unsafe browser DML.
- Read paths may use tenant-safe SELECT/RPC/server data loading; write authority for package assignment is not a customer-facing Phase 9 feature.
- Prefer immutable/canonical package definitions; avoid plan facts scattered across UI components.

### Core Logic Split
- Pure entitlement calculation must stay testable outside Next.js and must not import `"server-only"`.
- Only files that actually read env/secrets/admin clients/request-only APIs should be server-only.
- Do not scatter `if (plan === 'pro')` checks through UI or business services.
- Create one canonical entitlement resolver/API used by dashboard and future enforcement.

### Next.js 16.3.1
Before using unfamiliar App Router, caching, cookies, headers, Server Action, or Route Handler behavior, read the relevant local docs in `node_modules/next/dist/docs/` as required by `AGENTS.md`.
## Suggested Data Model (Equivalent Hardened Design Is Acceptable)

Do not treat these names as mandatory if existing schema conventions suggest better names, but preserve the contract.

### Canonical plan catalog
A DB-backed or otherwise single canonical source should represent:
- stable plan key (`starter`, `pro`, `enterprise`);
- display name;
- monthly price in integer minor units or integer THB using one documented convention;
- annual price using the same convention;
- entitlement dictionary/columns for at least room limit, pet-history limit, staff limit/support tier where documented;
- unlimited represented explicitly and unambiguously (recommended `NULL = unlimited` if using numeric limits);
- active/version metadata if needed without allowing browser mutation.

### Shop commercial assignment / effective entitlement
Represent each shop's current commercial entitlement separately from the plan catalog.
It must support at minimum:
- shop identity;
- base/effective plan key;
- commercial offer/source such as normal vs Founding Member;
- effective entitlement resolution;
- ability to represent Founding Member = Pro entitlements at the locked offer price;
- non-transferability by tying the offer to the shop, never to a browser-supplied arbitrary tenant;
- future lifecycle fields only if necessary for forward compatibility, but no automatic billing state machine in Phase 9.

Do not pretend the system can verify "continuous renewal" before the later billing lifecycle exists.
If continuity is represented now, label it as stored commercial state/architecture, not automatically verified payment truth.

### Dashboard query model
Prefer one tenant-scoped server query/service returning a narrow DTO for the dashboard rather than exposing raw tables to the client.
Counts/statuses should be computed from authoritative data and have deterministic empty states.
Do not fetch all tenant rows into the browser merely to calculate summary counts client-side.
## Phase 9 Acceptance Contract — Items 54–61

### 54. Owner/Manager Dashboard Authorization
- Active Owner can open dashboard.
- Active Manager can open dashboard.
- Staff cannot open dashboard or call its privileged data endpoint/action.
- Unauthenticated and inactive users are denied.
- Role enforcement occurs on the trusted server boundary, not CSS/client hiding only.

### 55. Live Tenant-Scoped Dashboard Data
- Dashboard uses real current DB data, not hard-coded/mock preview objects.
- Room, booking/occupancy, Daily Report, and current-plan summaries are scoped to authenticated shop.
- Tenant A cannot cause/read Tenant B dashboard data by URL/body/query tampering.
- Empty/new-shop state renders safely with zero/empty values rather than crashing.

### 56. Operational Read Model Without New Mutation Bypass
- Dashboard does not create a new generic CRUD surface.
- Existing booking, room, report, LINE, Sheets, camera authorities remain unchanged.
- Browser receives only the narrow dashboard DTO needed for rendering.
- No service-role secret or integration credential appears in client bundle/response/logs.

### 57. Canonical Package Catalog
- Starter, Pro, Enterprise package facts match `docs/BUSINESS_MODEL.md` exactly.
- Monthly/annual prices and documented limits are canonicalized in one authoritative model.
- Numeric limits distinguish bounded value from unlimited without magic numbers.
- Browser cannot modify plan definitions.

### 58. Effective Entitlement Resolution + Founding Member C2
- A single resolver returns effective plan/limits for a shop.
- Normal Starter resolves to 10-room / 300-pet-history future limits.
- Pro resolves those limits as unlimited.
- Founding Member resolves **Pro entitlement** with the locked 990 THB/month commercial offer semantics.
- Founding entitlement is shop-bound/non-transferable and excludes future paid add-ons by contract.
- Phase 9 must not falsely claim automated payment-continuity verification.
### 59. Read-Only Commercial Visibility, No Billing UI
- Dashboard may show current plan, commercial offer, price reference, and entitlement limits.
- There is no customer checkout/upgrade/downgrade/cancel/payment collection control.
- No Stripe/PromptPay/SlipOK/payment webhook is introduced.
- Package assignment changes, if a trusted internal primitive is absolutely necessary for tests/bootstrap, must not be exposed as ordinary browser/customer mutation.

### 60. No Hard Commercial Quota Enforcement Yet
- Starter limits are represented and testable as entitlement values only.
- Do not block existing `create_room`, `create_pet`, booking, Daily Report, Google Sync, or camera behavior based on package in Phase 9.
- No regression to existing Phase 1–8 invariants is allowed.
- Future enforcement must be able to call the canonical entitlement resolver instead of duplicating plan logic.

### 61. Executable Evidence + Production Gates
Phase 9 is not complete until real executable evidence proves 54–60 and all repository gates pass.
At minimum provide:
- DB/schema negative tests for new RLS/privileges/tenant isolation if a migration is added;
- pure entitlement unit tests including Starter, Pro, Enterprise, Founding Member, unknown plan/assignment behavior;
- server/dashboard authorization tests at the strongest executable boundary available;
- tenant A vs tenant B negative test;
- no-hard-limit regression assertion;
- `pnpm exec tsc --noEmit`;
- `pnpm lint`;
- `pnpm build`;
- `git diff --check`;
- final `git status --short --branch`;
- inspect `git diff` and all untracked Phase 9 files;
- confirm `supabase/config.toml` did not drift;
- confirm no Phase 1–8 migration was modified;
- confirm Issue #3 remains open unless legitimately resolved.

A passing build alone is NOT acceptance evidence.
## Required Test Matrix

Manus must create tests that fail for real contract violations, not only snapshot/render tests.

### Package/entitlement tests
Cover at least:
1. Starter monthly/annual price exact values.
2. Starter room limit = 10.
3. Starter pet-history limit = 300.
4. Pro room/pet limits = unlimited.
5. Enterprise documented price and entitlement mapping.
6. Founding Member has Pro effective entitlements while retaining 990 THB/month offer metadata.
7. Founding Member cannot be resolved for another shop by changing a client tenant identifier.
8. Unknown/missing package assignment fails closed or returns one explicitly documented safe default; never silently grants Pro.
9. Future paid add-on keys are not implicitly granted by Founding Member.
10. Entitlement checks do not mutate subscription/payment state.

### Dashboard/security tests
Cover at least:
1. owner access allowed;
2. manager access allowed;
3. staff access denied;
4. inactive/no-membership access denied at the strongest practical executable boundary;
5. tenant A dashboard cannot read tenant B counts/plan;
6. empty tenant returns valid zero/empty summary;
7. dashboard data comes from DB fixture changes, proving no mock data;
8. client-facing payload excludes secrets/admin-only fields.

### Regression expectations
At least rerun the relevant Phase 7/8 suites if Phase 9 migration/query changes can affect them.
If a new migration touches shared tenant/RLS helpers, rerun broader DB/RPC regression suites as appropriate.
## Manus Implementation Workflow

Use this order exactly:

`Verify Local Repo → Read Source of Truth → Check Module Hub → Record Compatibility → Read relevant Next.js docs → Implement DB/read model → Implement entitlement core → Implement server boundary → Implement dashboard UI → Test → Inspect → Report`

Do not jump directly to UI mockups.

Recommended separation:
- migration/RPC/read-model only if needed for secure tenant-safe aggregation/entitlement persistence;
- pure entitlement/domain module with no `server-only` guard;
- server-only dashboard data loader that derives tenant from auth context;
- Server Component/page or narrow API/action consistent with current Next.js patterns;
- small client components only where interaction/rendering needs them;
- tests next to the Phase 9 scope, not hidden in a cloud runner.

## Local-Write Proof Required During Work

After the first real source edit, Manus must run locally:
- `git status --short`
- `Get-Item <first-edited-local-file>`

After each major implementation group, run `git status --short` again.
At final delivery, list every created/modified file using local git output.

The final report must include at least one direct proof that the Phase 9 files exist on the Windows filesystem, for example:
`Get-Item 'D:\AI-Workspace\projects\saas-product-hub\products\PawSpace\<phase9-file>' | Select-Object FullName,Length,LastWriteTime`

A Manus cloud link, cloud artifact ID, or text pasted in chat does NOT substitute for local filesystem proof.
## Required Manus Final Report

Create a LOCAL file in the PawSpace repo named:
`PHASE9_IMPLEMENTATION_EVIDENCE.md`

It must contain:
- baseline HEAD and starting git status;
- Source of Truth files actually read;
- Module Hub modules inspected + exact compatibility verdicts;
- exact local files created/modified;
- schema/RLS/RPC changes and why each is needed;
- dashboard authorization design;
- entitlement/package data model and Founding Member semantics;
- explicit confirmation that payment/billing/hard quota enforcement were NOT implemented;
- exact test commands and raw pass/fail totals;
- typecheck/lint/build results;
- final git status and diff summary;
- known limitations / NOT VERIFIED items;
- local filesystem proof for key Phase 9 files.

Do not modify `docs/IMPLEMENTATION_STATUS.md` to self-declare Phase 9 VERIFIED.
Reviewer Gate 1 will decide whether status documentation is promoted.

## Prohibited Completion Claims

Manus must NOT say `DONE`, `READY`, `100%`, `PHASE PASSED`, or equivalent merely because implementation finished.
Allowed final status is:
`IMPLEMENTATION COMPLETE — AWAITING REVIEWER GATE 1`

If any required executable test cannot run, state exactly:
`NOT VERIFIED: <reason>`
and leave the Phase unpassed.

## Reviewer Handoff

When Manus finishes, stop. Do not commit/push.
ChatGPT Reviewer Gate 1 will independently inspect LOCAL files, actual diff, DB privileges/RLS, tests, tenant isolation, no-billing scope, and git state before deciding:
`PHASE PASSED — READY TO RELEASE NEXT PHASE`

Only after that verdict can the project move to Phase 10 Pilot.