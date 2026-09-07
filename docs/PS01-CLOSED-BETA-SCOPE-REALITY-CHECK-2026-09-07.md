# PS01 Closed Beta Scope Reality Check — Remediated

**Date:** 2026-09-07
**Product:** Pawstia PMS (PS01)
**Mode:** WSTERA BUILD-TO-SELL / STRICT SCOPE CONTROL
**Status:** REMEDIATED DOCUMENT — planning authority only; no implementation authority

## 1. Authority and purpose

This document remediates the earlier PS01 Closed Beta Reality Check after House Major review.

Controlling authority:
- `WSTERA-FREE-FIRST-INFRASTRUCTURE-POLICY.md`
- `PORTFOLIO-CONTROL-MATRIX-2026-09-06.md`
- `BRIEF-PS01-BUILD-TO-1-STORE-CLOSED-BETA-2026-09-06.md`

Where older PS01 strategy wording conflicts with the newer Owner Free-First policy, the newer Owner policy controls prospectively. Historical evidence is preserved and must not be rewritten as if the earlier direction never existed.

Closed Beta objective:

> Prove that one real pet-hospitality store can operate Pawstia's daily PMS loop reliably.

Priority rules:
- `real store operation > feature completeness`
- `validated requirement > attractive feature`
- `free-first > infrastructure convenience`
- `preserve completed work > delete/rewrite`

## 2. Closed Beta Core Candidate

The current 1-store Closed Beta core candidate is the operational PMS loop:

- Shop onboarding
- Rooms
- Pet owners / customers
- Pets
- Booking
- Check-in
- Active stay
- Check-out
- Staff / permission boundaries
- Operational status visibility

Other capabilities are not Closed Beta blockers unless real-store evidence proves they are required.

This is a product acceptance decision only. It does not automatically change what code is included in the deployed application.

## 3. Product Acceptance Scope vs Actual Deployed Surface

These two concepts must remain separate.

**Product Acceptance Scope** answers:
> What must work for the first store to call the Closed Beta successful?

**Actual Deployed Surface** answers:
> What code, dependencies, routes and runtime requirements are still built and shipped in the deployed application?

De-scoping a capability from Closed Beta acceptance does **not** remove its runtime requirements while its code remains part of the deployed surface.

## 4. Automated Daily Report — Current Classification

**Status:** `IMPLEMENTED / PRESERVED / NOT CLOSED-BETA REQUIRED`

Current implementation is real and must be preserved. It includes:

- staff-submitted Daily Report fields plus 1–4 photos;
- file count/size/type/content validation;
- `sharp` image decoding/rotation/resize/conversion;
- source-image limit of 10 MiB per image;
- Supabase Storage media persistence;
- Daily Report record creation;
- server-side LINE delivery/dispatcher path.

Closed Beta interpretation:

- Do not delete this implementation.
- Do not rewrite Phase 6/other historical evidence.
- Automated media delivery is not required to pass the first-store Closed Beta.
- The store may continue its existing LINE photo/message workflow if that is operationally simpler.
- Customer outcome to preserve is that the store can update the pet owner with information/photos.
- This capability alone must not force paid hosting or paid infrastructure.

Important deployment correction:

> Although Automated Daily Report is not a Closed Beta acceptance blocker, `sharp` and the Node.js Daily Report route remain part of the current deployed source surface until separately changed under an approved implementation plan.

## 5. Daily Update Reminder / Completion Tracking

**Status:** `PROPOSED THIN CAPABILITY / NOT YET AUTHORIZED`

This capability is **not confirmed as implemented** in the current source reviewed for this remediation.

The earlier Reality Check wording that placed `Daily Update Reminder / completion tracking` directly in the Closed Beta core is corrected here. It is a proposal, not an existing capability.

Before any implementation, a separate bounded plan must answer:

1. Can existing booking/stay/report state be reused?
2. Is any schema or migration required?
3. Is any background job, cron or queue required?
4. Is any external service or additional infrastructure required?
5. Can the outcome be achieved by a thin UI/query/state layer only?
6. Does the first real store actually want this behavior?

If it can be delivered as thin operational visibility using existing state, propose the smallest plan first.

If it requires a new subsystem, migration, scheduler, queue or external service: **STOP and return the plan for Owner/Secretary review.**

No implementation is authorized by this document.

## 6. Camera — Current Classification

**Status:** `EXPERIMENTAL / PRESERVED / NOT CLOSED-BETA REQUIRED / NOT MARKET-PROVEN`

Current Phase 8 implementation is completed evidence and must be preserved.

Confirmed current behavior includes:
- bounded public camera access;
- visitor-code authentication;
- signed tenant-bound `camera:view` session;
- session lifetime locked at exactly 30 minutes;
- server-side feed proxy;
- credential rotation invalidation;
- rate limiting and audit logging;
- HTTPS-only allowlisted upstream feed;
- stream termination at session expiry.

Market/operation gaps remain:
- no target-store hardware evidence;
- implementation contains a concrete `Microsoft LifeCam` assumption;
- no evidence that a real store will expose a usable feed/network path;
- privacy, ISP, router, NVR/DVR and support burden are not validated;
- no evidence yet that customer value outweighs operational burden.

Therefore Camera is not a Closed Beta blocker, must not be marketed as a proven general capability, and must not force paid infrastructure. Promotion back into core requires real-store and real-hardware validation.

## 7. Current Capability Classification

| Capability | Implemented? | Closed Beta Required? | Deploy Surface? | Status |
|---|---|---|---|---|
| Core PMS operational loop | Yes, current product evidence exists | **Yes — Core Candidate** | Yes | `CORE / CLOSED-BETA CRITICAL PATH` |
| Automated Daily Report | Yes | No | Yes, current code remains built/shipped unless separately changed | `IMPLEMENTED / PRESERVED / NOT CLOSED-BETA REQUIRED` |
| Daily Update Reminder | Not confirmed | No — proposed only | Not confirmed as a distinct deployed capability | `PROPOSED THIN CAPABILITY / NOT YET AUTHORIZED` |
| Camera | Yes | No | Yes, current routes remain in application source/build | `EXPERIMENTAL / PRESERVED / NOT CLOSED-BETA REQUIRED / NOT MARKET-PROVEN` |

No code has been deleted or disabled by this remediation.

## 8. Deployed Surface Audit — Confirmed Findings

### `CONFIRMED`

- `sharp@^0.35.3` remains a production dependency in `package.json`.
- `lib/daily-report-media.ts` imports and executes `sharp` for image metadata, rotation, resize and conversion.
- `app/api/daily-reports/route.ts` explicitly exports `runtime = "nodejs"`.
- The Daily Report route currently imports the `sharp`-using media pipeline.
- `app/api/camera/stream/[shopSlug]/route.ts` explicitly exports `runtime = "nodejs"`.
- The camera stream route proxies an upstream body through `ReadableStream` and can keep the response open until session expiry.
- Camera session TTL is exactly 30 minutes in current Phase 8 contract.
- De-scoping Daily Report or Camera from product acceptance does not remove these deployed-source requirements by itself.

### `UNCONFIRMED`

- Whether a viable free candidate can support the entire current deployed surface without modification.
- Whether `sharp` must stay in the same deployed runtime for the Closed Beta, or can be bounded/disabled without deleting completed work.
- Whether Camera routes can be excluded/disabled through configuration alone without code changes.
- Whether the first store needs Automated Daily Report or Camera operationally.
- Whether a Daily Update Reminder is needed at all by the first store.

### `ASSUMPTION / NOT AUTHORITY`

- That reducing Closed Beta product scope automatically removes hosting/runtime constraints.
- That Render, Cloudflare, Netlify, Vercel or any other provider is already selected.
- That an isolated Supabase **provider-specific cloud project** is the only valid way to satisfy non-production isolation evidence.

Any change to exclude or disable Daily Report/Camera from the deployed surface is **new implementation work** and requires a separate plan before editing code/config.

## 9. Free-First / Provider-Neutral Control

PS01 remains `PRE-REVENUE / FREE FIRST`.

Current provider selection order is:

`Closed Beta Requirement`
→ `Actual Deployed Surface`
→ `Runtime Constraints`
→ `Free Candidate Discovery`
→ `Comparison`
→ `Provider Decision`

Paid infrastructure is not authorized while a viable free path remains.

The earlier `PS-SR-02-FREE-HOSTING-COMPATIBILITY-AUDIT-2026-09-06.md` remains useful evidence of candidate/runtime testing, but its provider recommendation must not be treated as final authority until this remediated requirement/deployed-surface sequence is completed.

## 10. PS01 Strategy / Deployment Drift to Flag

The current strategy brief contains:

> `An isolated Supabase staging project is mandatory regardless of app provider.`

Under the newer Free-First authority, this wording requires revalidation. The requirement should be expressed first as an outcome:

> An isolated non-production data/runtime environment sufficient to prove tenant isolation, migration safety, smoke behavior, rollback/redeploy and release safety.

Only after requirement-first comparison should a specific provider capability be considered mandatory.

The existing `BUILD-TO-SELL-EXECUTION-2026-09-06.md` also defines a sell-ready destination containing Daily Reports, LINE/Sheets/LIFF and broad integration resilience. For the 1-store Closed Beta, that older roadmap must be prospectively re-planned so de-scoped capabilities do not remain automatic blockers.

Historical documents and Phase evidence remain unchanged for provenance.

## 11. Proposed PS-SR-02 → PS-SR-03 → PS-SR-04 Re-plan

### PS-SR-02 — Deployable Closed Beta Core

Goal: prove the actual Closed Beta core is deployable on Free-First infrastructure.

Plan only:
1. Finish deployed-surface requirements audit.
2. Determine whether preserved non-core routes must remain supported by the chosen runtime or can be bounded without code mutation.
3. Discover and compare viable free runtime/data candidates against confirmed requirements.
4. Select a provider only after comparison evidence exists.
5. Plan isolated non-production deployment, migration proof, two-tenant/core-loop smoke and rollback/redeploy.

### PS-SR-03 — Critical-Path Resilience Only

Goal: prove resilience/recovery only for integrations that remain on the actual first-store critical path.

Plan only:
- identify which integrations the first store truly needs;
- test failure/retry/recovery only for those critical integrations;
- do not keep Camera or Automated Daily Report as resilience blockers merely because older roadmap text included them;
- preserve completed integration evidence without forcing re-execution of de-scoped systems;
- define observability/recovery proportionate to the real Closed Beta workflow.

### PS-SR-04 — One Real Store

Goal: onboard one store and collect real operational evidence.

Plan only:
- onboard the store to the core PMS loop;
- measure onboarding friction, booking/stay integrity, staff learning and support burden;
- observe the store's actual customer-update workflow;
- ask whether Daily Update Reminder would materially help;
- validate whether Automated Daily Report is desired before promoting it;
- investigate Camera only if the store has a real requirement and real hardware/network willingness;
- use real-store evidence to decide which capabilities return to the main roadmap.

PS-SR-03 and PS-SR-04 implementation are **not opened by this document**.

## 12. Decision Needed

`NONE`

No provider choice is requested at this stage. Requirement/deployed-surface/free-path comparison must be completed first.

## 13. Explicit Non-Scope / Stop Conditions

This remediation does **not** authorize:

- deleting Camera code;
- deleting Automated Daily Report code;
- rewriting historical Phase 8/Phase 6 evidence;
- implementing Daily Update Reminder;
- adding schema or migrations;
- adding cron, queue or background workers;
- disabling/excluding routes from deployment;
- choosing or provisioning a hosting provider;
- provisioning paid services;
- touching production or production secrets;
- reopening Phase 13;
- opening Council / Module Hub Scan;
- adding payment scope.

Any future deployed-surface change requires a separate implementation plan and normal Owner/Secretary approval.

## 14. Exact Remediation Summary

Changes from the earlier Reality Check:

1. `Daily Update Reminder` corrected from core-like wording to `PROPOSED THIN CAPABILITY / NOT YET AUTHORIZED`.
2. Automated Daily Report classified as `IMPLEMENTED / PRESERVED / NOT CLOSED-BETA REQUIRED`.
3. Camera classified as `EXPERIMENTAL / PRESERVED / NOT CLOSED-BETA REQUIRED / NOT MARKET-PROVEN`.
4. Added explicit separation between Product Acceptance Scope and Actual Deployed Surface.
5. Corrected the implication that de-scoping automatically removes runtime/hosting constraints.
6. Confirmed current `sharp`, Node runtime and streaming-route constraints from source.
7. Marked current provider recommendation as non-final until requirement/deployed-surface sequence is completed.
8. Flagged the older isolated-Supabase-project wording for authority revalidation under Free-First.
9. Re-planned PS-SR-02/03/04 prospectively without opening implementation.
10. Preserved completed code/evidence and explicitly recorded that no code, migration or provider mutation is authorized.

## 15. Evidence Basis

Current source/documents reviewed for this remediation:

- `docs/PS01-CLOSED-BETA-SCOPE-REALITY-CHECK-2026-09-07.md` (pre-remediation content)
- `docs/PS-SR-02-FREE-HOSTING-COMPATIBILITY-AUDIT-2026-09-06.md`
- `docs/BUILD-TO-SELL-EXECUTION-2026-09-06.md`
- `BRIEF-PS01-BUILD-TO-1-STORE-CLOSED-BETA-2026-09-06.md`
- `WSTERA-FREE-FIRST-INFRASTRUCTURE-POLICY.md`
- `PORTFOLIO-CONTROL-MATRIX-2026-09-06.md`
- `package.json`
- `lib/daily-report-media.ts`
- `app/api/daily-reports/route.ts`
- `app/api/camera/stream/[shopSlug]/route.ts`
- prior Phase 8 camera evidence already recorded in the repository

No application code, migration, provider configuration, production data or secret was changed by this remediation.

**STOP FOR SECRETARY REVIEW.**
