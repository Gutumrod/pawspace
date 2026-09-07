# PS-SR-02 — Deployed Surface + Closed Beta Readiness Remediation

**Date:** 2026-09-07
**Product:** Pawstia PMS (PS01)
**Mode:** WSTERA BUILD-TO-SELL / FREE-FIRST / STRICT SCOPE CONTROL
**Status:** IMPLEMENTED LOCALLY / NOT COMMITTED / NOT PUSHED

## 1. Authority

This work follows:
- `WSTERA-FREE-FIRST-INFRASTRUCTURE-POLICY.md`
- `PORTFOLIO-CONTROL-MATRIX-2026-09-06.md`
- `BRIEF-PS01-BUILD-TO-1-STORE-CLOSED-BETA-2026-09-06.md`
- `PS01-CLOSED-BETA-SCOPE-REALITY-CHECK-2026-09-07.md`

Owner authorized continuation after Secretary review.

No Camera/Daily Report implementation was deleted or disabled. No migration, provider, production, secret, payment, Council, or Module Hub mutation was authorized.

## 2. Deployed Surface Audit — Confirmed

Current Next.js production build still ships these dynamic routes:
- `/api/camera/access/[shopSlug]`
- `/api/camera/feed/[shopSlug]`
- `/api/camera/stream/[shopSlug]`
- `/api/daily-reports`
- `/api/internal/google-sync`
- `/api/internal/line-dispatch`
- `/api/line/claim`
Confirmed runtime constraints:
- `sharp@^0.35.3` remains a production dependency.
- Daily Report route explicitly uses `runtime = "nodejs"` and imports the `sharp` media pipeline.
- Camera stream route explicitly uses `runtime = "nodejs"` and proxies a `ReadableStream` until session expiry.
- Camera session TTL remains exactly 30 minutes.
- No feature flag or existing build-time exclusion mechanism was found for Daily Report or Camera.
- Camera is also referenced by dashboard/actions/pages; Daily Report is referenced by operations/dashboard/readiness code.

Conclusion:

> Product de-scope does not remove deployment constraints. Excluding either capability from the deployed surface would require new code/config work.

Because a viable free conventional Node runtime remains available, this remediation does **not** introduce route exclusion or feature-flag architecture merely to fit a provider.

## 3. Supabase Isolation Revalidation

The old statement that a separate Supabase staging project was mandatory was re-evaluated from current migrations rather than accepted by wording alone.

Current migrations create unqualified/global objects in the default Supabase environment, including:
- generic `public` tables such as `shops`, `staff_users`, `pets`, `rooms`, `bookings`, `daily_reports`, `sync_queue`;
- functions and triggers in the default search path;
- references to shared `auth.users`;
- RLS policies on those tables;
- a fixed Storage bucket named `daily-report-photos`.
Applying the full migration set into the shared `wstera-lab` public/auth/storage surface would therefore risk collisions or cross-product contamination unless Pawstia were first re-architected around namespaced schemas/buckets/auth boundaries.

That re-architecture is unnecessary for PS-SR-02 and would increase risk.

**Revalidated conclusion:** Pawstia needs a **dedicated isolated Supabase non-production project/environment** for cloud staging under the current architecture. This is requirement-driven, not provider preference.

Local Supabase CLI currently sees `wstera-lab` and `wstera-control` as separate active projects in the WSTERA LAB & CONTROL organization. No project was created, paused, linked, reset, or modified by this audit.

Supabase Free remains a possible zero-fixed-cost path, but actual free-slot/account authority must be verified before creation. Paid Supabase is not authorized.

## 4. Hidden Closed Beta Readiness Drift Found

`lib/pilot-readiness-service.ts` still treated both of these as critical:
- `LINE Official Account & Daily Reports`
- `Google Sheets Sync`

Because `isPilotReady` required every critical item to pass, a store with a complete PMS core could not become `PILOT READY` without both integrations.

This contradicted the newer 1-store Closed Beta direction where real operational PMS core is primary and de-scoped integrations must not block launch.

Historical Phase 12 evidence correctly records the old contract and was **not rewritten**.

## 5. Bounded Runtime Remediation Implemented

Current contract is now:
- Shop profile = critical
- Active owner = critical
- Room inventory = critical
- Customer/pet data = critical
- Booking engine = critical
- LINE OA / Automated Daily Report = optional recommendation
- Google Sheets = optional recommendation
`readinessPercentage` now reflects critical Closed Beta items only, so a core-ready shop does not display the contradictory state `PILOT READY` with a sub-100 critical readiness percentage.

The onboarding copy was also corrected from `5–10 Pilot Hotel onboarding` to `1-store Closed Beta core`.

No integration validation logic was removed. LINE and Google readiness are still evaluated and still surface remediation guidance, but missing optional integration credentials now go to `recommendations` instead of `blockingIssues`.

## 6. Google Sheets Hidden-Dependency Check

Core mutations and CSV import call `enqueue_sync_event(...)`, which writes a database outbox record inside the business transaction.

The enqueue helper does not call Google externally and does not require a configured Sheet or Google credential to complete the core mutation.

Therefore missing Google credentials do not make Google Sheets a hard dependency for booking/customer/pet operations.

If no Google worker is operated, pending sync events can accumulate. For the 1-store Closed Beta this is a bounded integration debt to observe/reconcile later, not justification to classify Google Sheets as a launch blocker.

## 7. Regression Contract Updated

`tests/phase12_pilot_onboarding.test.ts` was updated prospectively to verify:
- a core-ready shop remains `PILOT READY` without LINE/Google credentials;
- optional integrations do not appear in `blockingIssues`;
- missing LINE/Google remain visible in `recommendations`;
- fully configured integrations still validate successfully;
- the critical Closed Beta contract is 5/5;
- tenant B still cannot inherit tenant A integration readiness.

Historical `PHASE12_IMPLEMENTATION_EVIDENCE.md` remains unchanged and continues to document the prior 7/7 technical-pilot contract as provenance.
## 8. Verification Performed

Fresh local verification after the remediation:
- `pnpm exec tsc --noEmit` — PASS
- `pnpm lint` — PASS
- `pnpm build` — PASS
- `git diff --check` — PASS

Production build confirms Camera and Daily Report remain deployed routes; no false claim is made that their runtime constraints disappeared.

Database regression was not run locally because `supabase status` confirmed Docker/Podman is not available on PATH. Docker was **not started or installed**. Canonical CI remains the appropriate environment for DB regression once a durable branch checkpoint is authorized.

## 9. Free Runtime Candidate Re-evaluation

Requirement baseline remains the **current deployed Node surface**, because no route-exclusion implementation was introduced.

Current evidence:
- Cloudflare Workers Free: 10 ms CPU/request; Pawstia's measured `sharp` pipeline alone previously used about 30 ms CPU. Not viable for current full deployed surface without architecture change.
- Netlify Functions: 60-second synchronous/streaming execution boundary and effective ~4.5 MB binary request limit conflict with current Camera/Daily Report contracts.
- Koyeb Free: conventional 0.1 vCPU / 512 MB web service, but Free instances are restricted to Frankfurt or Washington, D.C.; no Singapore Free instance.
- Render Free: conventional Node web service, Singapore region available, 0.1 CPU / 512 MB, and HTTP responses may run up to 100 minutes.

**Current provider-neutral ranking for PS-SR-02 staging:**
1. Render Free — strongest fit with current deployed surface and Thailand/Singapore locality.
2. Koyeb Free — technically closer than serverless candidates but poor free-region locality.
3. Cloudflare Workers Free — blocked by current CPU-heavy media path.
4. Netlify Free — blocked by current request/stream limits.

Render is a **PROVISIONAL BEST-FIT CANDIDATE**, not a permanent production-provider decision.
Free-First safety notes:
- Render Free spins down after 15 minutes idle and can take about one minute to wake.
- Render Free has no SLA and is explicitly not positioned as general production infrastructure.
- If no payment method is added, Render documents that charge-triggering overage disables service instead of billing the account.
- Therefore use is bounded to staging first; PS-SR-04 real-store suitability must be judged from observed usability, not assumed.

Paid hosting remains **NOT AUTHORIZED**.

## 10. PS-SR-02 Next Execution Plan

No provider account was provisioned in this remediation. No Render CLI is installed on the current Windows machine.

Next safe sequence:
1. Preserve this readiness remediation as the current local checkpoint.
2. Obtain a dedicated zero-cost Supabase staging project/environment without repurposing production or shared product data.
3. Keep the application on the current conventional Node contract; do not create feature-exclusion architecture solely for hosting convenience.
4. Provision a Free Node staging runtime only after account/provider authority is available.
5. Configure staging-only secrets; de-scoped integrations may remain unconfigured if they are not part of the first-store critical path.
6. Apply the 13 migrations only to the verified isolated staging project.
7. Run two-tenant/core PMS smoke first.
8. Verify optional integration surfaces fail closed or remain unused without affecting core operation.
9. Prove rollback/redeploy and record deployment identity.
10. Run independent QA/integration before closing PS-SR-02.

## 11. Current Stop Boundary

Do not yet:
- delete or disable Camera/Daily Report;
- modify migrations to remove Google/LINE structures;
- use shared `wstera-lab` as a drop-in Pawstia database;
- provision paid Supabase or paid hosting;
- touch production;
- push/merge without separate repository authority.
