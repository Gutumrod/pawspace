# PawSpace Phase 12 — Implementation Evidence & Gate 1 Remediation (Final Rerun)

**Date:** 2026-08-23  
**Scope:** Phase 12 Pilot Onboarding & Closed Beta Readiness  
**Baseline HEAD:** `a0c8b54` (`chore: close Phase 11.1 gate and support macOS e2e`)  
**Status:** `REMEDIATION COMPLETE — INDEPENDENT REVIEWER VERIFIED, POST-VERDICT GATE 2 FIXES APPLIED` (see §0 below; original verdict in `REVIEW-phase12-final-2026-08-23.md` predates these two fixes)

---

## 0. Post-Verdict Independent Review Addendum (Claude, 2026-08-23)

Before commit/push, a second independent pass (not the author of the `88/88` run above) read every changed/new file directly instead of trusting the reported result, and found two real gaps that the `88/88` suite did not cover. Both are fixed and re-verified below; the 88/88 baseline test count is unaffected other than by the 4 new assertions added for these fixes.

| # | Finding | Severity | Root Cause | Fix |
| :--- | :--- | :---: | :--- | :--- |
| **5** | **`normalizePhone` leaked a leading `+` for non-`+66` international numbers** | Correctness | `lib/csv-import-service.ts::normalizePhone` only stripped `+` for the `+66` branch; any other `+`-prefixed number (e.g. `+1 234 567 890`) fell through to the generic `9–15 char` branch and was returned *with* the `+` still attached. The client preview marked the row `VALID` (non-null phone), but `import_customers_and_pets_atomic`'s DB-side regex `^[0-9]{9,15}$` then rejected it, aborting the **entire atomic batch** — including every other valid row in the same CSV — with a generic, non-row-attributed error, after the user had already been shown a clean "ready to import" preview. | `normalizePhone` now always strips any leading `+` before validating, and requires the remainder to be pure digits (`/^\d+$/`) before applying the existing length checks — the function can never again return a value containing `+`. |
| **6** | **CSV-imported free text was never escaped before reaching live Google Sheets** | Security (CSV/Formula Injection) | `lib/google-sheet-records.ts::buildCustomerRow`/`buildBookingRow` passed tenant-supplied strings (pet name, breed, notes, allergies, owner name/address) straight through to the Phase 7 Google Sheets sync worker with zero escaping. The Module Hub's formula-escaping capability (`StreamSerializer` with `escapeFormulas`) existed in the repo, but the evidence's "Module Hub Formula Injection Protection: 1/1 PASS" line only exercised that serializer in isolation — it was never wired into the actual import→DB→Sheets-sync data path. A CSV cell such as `=HYPERLINK("http://evil","x")` in a pet name would be stored verbatim and later written as a live, executable formula into the shop owner's real Google Sheet. | Added `escapeSheetFormula()` in `lib/google-sheet-records.ts`, applied to every string field in `buildCustomerRow`/`buildBookingRow` (same `/^[=+\-@]/` → leading-apostrophe rule already used by the Module Hub serializer). The DB still stores the true, unescaped value for in-app display; only the boundary export to the third-party spreadsheet is sanitized. |

**Re-verification after both fixes (fresh `supabase db reset`, real local stack, not reused state):**
- `pnpm exec tsc --noEmit` — PASS
- `pnpm lint` — PASS
- `pnpm run build` — PASS (`/onboarding` present as a dynamic route)
- `git diff --check` — PASS
- `supabase db lint --local` — PASS, no schema errors
- `tests/phase12_pilot_onboarding.test.ts` — **92/92 PASS** (88 original + 4 new: 3 for the phone fix, 1 for the Sheets-row escaping fix, asserting all of `petName`/`specialCareNotes`/`allergies`/`ownerFirstName`/`ownerAddress` are escaped when formula-prefixed)
- `tests/phase7_google_sheets_sync.test.ts` — **23/23 PASS** (directly exercises `google-sheet-records.ts`, the file changed for Finding 6 — no regression)
- `tests/phase11_customer_self_booking.test.ts` — **45/45 PASS** (exercises `lib/operations-service.ts`, touched in the same uncommitted diff — no regression)

No new Module Hub dependency was introduced; the fix reuses the escaping convention already present in `lib/import-export/core/serializer.ts` rather than inventing a new one.

---

## 1. Baseline Verification

Initial repository state verified before remediation:

```bash
git status --short           # Verified master @ a0c8b54 baseline
git branch --show-current    # Output: master
git rev-parse --short HEAD   # Output: a0c8b54
git diff --check             # Clean whitespace
```

---

## 2. Gate 1 Remediation & Anti-Forgery Authoritative Audit Fix

| # | Item / Finding | Severity | Status | Resolution Detail |
| :--- | :--- | :---: | :---: | :--- |
| **1** | **Authoritative Import Audit `total_rows` Anti-Forgery** | BLOCKER | **FIXED** | Eliminated caller-supplied integer metadata parameter (`p_source_row_count`). `import_customers_and_pets_atomic(p_records JSONB)` accepts the exact array of validated source CSV rows. PostgreSQL derives `v_total_rows := jsonb_array_length(p_records);` authoritatively from the verified payload array. Probes attempting forged parameters (e.g. `999999`) are rejected at the schema/signature boundary, while valid 1-row imports strictly write `total_rows = 1` in `import_batches`. |
| **2** | **Integration Readiness False-Positive (LINE & Google Sheets)** | BLOCKER | **FIXED** | Set `isCritical: true` on both `line_oa` and `google_sheets` items. Hardened operational validation: LINE requires `line_oa_id`, per-shop token in `LINE_CHANNEL_ACCESS_TOKENS_JSON[shopId]`, and `LINE_DISPATCH_SECRET`. Google Sheets requires `google_sheet_id`, valid structural `GOOGLE_SERVICE_ACCOUNT_JSON` (`client_email` + RSA private key), and `GOOGLE_SYNC_DISPATCH_SECRET`. Missing credentials block `isPilotReady` and add to `blockingIssues`. Zero secrets leaked. |
| **3** | **Module Hub Evidence Alignment** | PROCESS | **FIXED** | Updated verdict to **`ADAPTER ONLY / SOURCE SUBTREE COPY`**. Transparently documented that PawSpace copied the runtime engine (`core/`, `adapters/`, `index.ts`, `MODULE.md`, `DESIGN.md`, `VERSION`) and omitted standalone package/test harness files (`package.json`, `tsconfig.json`, `tests/`) to maintain Next.js project cleanliness. |
| **4** | **Authoritative RPC Validation Parity** | BLOCKER | **FIXED** | Hardened `import_customers_and_pets_atomic` so direct authenticated RPC calls cannot bypass the CSV/preview contract: max 2,000 source rows, normalized 9–15 digit phone, required pet name when pet data is supplied, dog/cat species, supported gender enum, non-negative numeric weight, and fail-closed date/numeric casts. Any invalid row rolls back the entire batch with zero audit record. Preview validation was also hardened for impossible calendar dates and malformed numeric weights. |

---

## 3. Authoritative Import Architecture & Security Boundary

### 3.1 Unforgeable Audit Record Contract
- RPC signature: `import_customers_and_pets_atomic(p_records JSONB)`.
- No separate metadata parameter `p_source_row_count` is accepted.
- `v_total_rows := jsonb_array_length(p_records);` is derived authoritatively inside PostgreSQL.
- Caller cannot supply arbitrary integer metadata (e.g., `-1`, `0`, `17`, `999999`).
- Every element in `p_records` represents an individual source CSV row with `{ customer, pet, row_number }`.
- The RPC itself enforces the import boundary even when called directly: 1–2,000 source rows, normalized 9–15 digit customer phone, required customer name, pet object-or-null semantics, required pet name/species when pet data exists, supported gender enum, non-negative weight, and fail-closed numeric/date casts.
- Within the atomic transaction:
  1. `pet_owners` are matched by `phone` (with strict identity conflict checks).
  2. `pets` are deduplicated and inserted.
  3. `enqueue_sync_event` is fired for Google Sheets export replica.
  4. `import_batches` audit record is inserted with authoritative `total_rows = jsonb_array_length(p_records)`.
  5. Any validation or persistence failure anywhere in the batch causes a clean 100% rollback with zero database writes and zero audit records created.

---

## 4. Module Hub Reuse Audit

Inspected local Module Hub at `/Users/wachirayachankhonkan/AI-Workspace/projects/modules-hub`:

| Candidate Module | Version | Status | Verdict | Rationale & Host Ownership |
| :--- | :---: | :---: | :---: | :--- |
| `modules/import-export` | 0.2.0 | ✅ Completed | **ADAPTER ONLY / SOURCE SUBTREE COPY** | Copied runtime parser, serializer, and adapters (`core/`, `adapters/`, `index.ts`, `MODULE.md`, `DESIGN.md`, `VERSION`) into `lib/import-export/`. Standalone `package.json`, `tsconfig.json`, and standalone `tests/` were excluded. PawSpace owns and adapts the internal code, and verifies formula injection protection + stream parsing in PawSpace test suites. |
| `modules/tenant-context` | 0.3.0 | ✅ Completed | **NOT NEEDED** | PawSpace already has authoritative tenant isolation via Supabase RLS and `lib/tenant-context.ts`. |
| `modules/auth-supabase` | 0.2.0 | ✅ Completed | **NOT NEEDED** | PawSpace uses its existing `lib/auth.ts` and `lib/tenant-context.ts` boundaries. |
| `modules/file-storage` | 0.1.0 | ✅ Completed | **NOT NEEDED** | CSV import is parsed in-memory / streamed directly on the server for Preview & Confirm; no raw CSV files are stored in permanent storage buckets. |
| `modules/scheduler` | 0.3.0 | ✅ Completed | **NOT NEEDED** | No recurring scheduling tasks required for Phase 12 onboarding. |

---

## 5. Database Changes (Phase 12 Migration)

Migration file:
`supabase/migrations/20260823170000_phase12_pilot_onboarding.sql`

Key capabilities:
1. **`update_shop_profile(p_name, p_phone, p_line_oa_id)`**:
   - Derives tenant strictly from `current_staff_shop_id()`.
   - Authorized for `is_shop_manager_or_owner()`.
   - Validates non-empty shop name.
   - `SECURITY DEFINER SET search_path = public, pg_temp`.
2. **`import_batches` table**:
   - Persistent audit table: `id`, `shop_id`, `performed_by`, `format`, `status`, `total_rows`, `created_customers`, `created_pets`, `skipped_duplicates`, `error_message`, `created_at`.
   - RLS enabled with `staff_select_import_batches` policy restricted to shop managers and owners.
3. **`import_customers_and_pets_atomic(p_records JSONB)`**:
   - Executes entire source-row batch within a single atomic database transaction.
   - Derives unforgeable source `total_rows := jsonb_array_length(p_records)`.
   - Enforces authoritative row limit and customer/pet semantic validation for direct RPC callers, not only the CSV preview path.
   - Detects customer identity conflicts and aborts transaction on conflict.
   - Enqueues Google Sheets sync events for newly created pets.
   - Returns structured JSONB receipt with `batch_id`.

**Database Gate Evidence:**
```bash
pnpm exec supabase db reset           # Clean schema apply from initial migration through Phase 12
pnpm exec supabase db lint --local    # No schema errors found
```

---

## 6. Test Suite Execution & Evidence

### 6.1 Phase 12 Test Suite
```bash
npx tsx tests/phase12_pilot_onboarding.test.ts
```
**Result:** **88/88 PASS**
- Normalization (Phone, Species, Gender, Date): 16/16 PASS
- Module Hub Formula Injection Protection: 1/1 PASS
- Shop Profile Authoritative Mutation & Security: 7/7 PASS
- CSV Structural + Semantic Fail-Closed Validation: 7/7 PASS
- Ambiguous Customer Identity Conflict Handling: 4/4 PASS
- Atomic Import & Idempotent Retry: 17/17 PASS
- Authoritative Audit / Direct-RPC Security Boundary: 21/21 PASS
  - Forged `p_source_row_count: 999999` rejected at signature boundary
  - 1-record payload derives authoritative `total_rows = 1`
  - Empty array and >2,000 rows rejected
  - Invalid phone, unsupported species, negative/malformed weight, missing pet name, and impossible date rejected
  - Every failed boundary probe verified zero customer/pet writes and zero new audit batch
- Room Setup & Role Boundaries: 3/3 PASS
- Operational Integration Readiness (negative, positive, secret-safe, tenant isolation): 12/12 PASS

### 6.2 Regression Test Matrix
- `tests/phase3_server_layer.test.ts` — **33/33 PASS**
- `tests/phase4_booking_backend.test.ts` — **21/21 PASS**
- `tests/phase5_line_claim.test.ts` — **32/32 PASS**
- `tests/phase6_daily_report_line.test.ts` — **43/43 PASS**
- `tests/phase7_google_sheets_sync.test.ts` — **23/23 PASS**
- `tests/phase8_camera_access.test.ts` — **22/22 PASS**
- `tests/phase9_entitlements.test.ts` — **5/5 PASS**
- `tests/phase11_customer_self_booking.test.ts` — **45/45 PASS**

### 6.3 Browser E2E Suite (Playwright)
```bash
pnpm test:e2e
```
**Result:** **9/9 PASS** (Real browser login, profile save through UI, and CSV import confirmation).

### 6.4 Static Quality Gates
```bash
pnpm exec tsc --noEmit           # PASS (0 errors)
pnpm lint                        # PASS (0 errors, 0 warnings)
pnpm build                       # PASS (Production build successful, /onboarding registered as dynamic route)
git diff --check                 # PASS (Clean whitespace)
pnpm exec supabase db lint --local # PASS (No schema errors)
```

---

## 7. Scope & Security Audit

Verified that no out-of-scope capabilities were introduced:
- Zero payment, billing, Stripe, PromptPay, or SlipOK code.
- Zero grooming, vaccine, multi-branch, or AI logic.
- Zero modifications to Phase 1–11 migrations.
- GitHub Issue #2 remains open; technical `PILOT READY` is strictly distinguished from business `OUTREACH READY`.

---

## 8. Status for Independent Reviewer

Phase 12 remediation is complete and verified against all executable test gates, static checks, and anti-forgery probes.
