# WU4-MANUAL — Shop-owner manual for PS01 (TH + EN)

Correlation id: house-swarm-5a-wu4-20260927
Worktree: D:/AI-Workspace/runtime/worktrees/house-swarm-5a-docs
Revision at start: c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a
Scope used: `docs/` only. This note was created (and committed to disk) before any manual content was written.

Status: COMPLETE — three deliverables written, all declared checks run, no behaviour invented.

---

## 1. Files delivered (bytes + sha256)

| Path | Bytes | sha256 |
| :--- | ---: | :--- |
| `docs/manual/PS01-OWNER-MANUAL-TH.md` | 59862 | `948241268d8d86df592b2a25b60c10b884c912bea77090f97329f2943f5fb635` |
| `docs/manual/PS01-OWNER-MANUAL-EN.md` | 34203 | `37173a7b572632d90a9361b2d1f537efba0e4f78854ec85c35da105499687a32` |
| `docs/manual/PS01-MANUAL-OWNER-INPUTS.md` | 9213 | `cf29045e90a23c09a22bead5f0d646ef81c68b35ef01e7375679e0ab1268804d` |
| `docs/house-swarm-5a/WU4-MANUAL.md` (this note) | see `stat` output in the command log | — |

All four files are non-empty. Byte counts and hashes were taken with `stat -c%s` and `sha256sum`.

## 2. Structure parity between the two manuals (measured, not asserted)

Both manuals have **13 numbered `##` sections, in the same numeric order**:

1. What the product is and who it is for · 2. Signing in and the staff roles · 3. Setting up rooms · 4. Adding a customer and their pets · 5. Linking a pet owner's LINE · 6. Creating a booking and checking in · 7. Sending the Daily Report with photos · 8. Checking out · 9. The Google Sheets export replica and what it does not include · 10. What to do when LINE delivery fails · 11. Support: text message only · 12. Payment and packages · 13. FAQ

Verified by script: `TH section count: 13`, `EN section count: 13`, `same numeric order: True`.
The Thai edition is written as Thai prose and the English edition as English prose; they are not literal translations of one another, but each step, screen name and repository citation exists in both.

## 3. Command log (exact commands, observed output, exit codes)

| # | Command | Exit | Observed result |
| :--: | :--- | :--: | :--- |
| 1 | `wc -l docs/PRD.md app/operations-client.tsx docs/BUSINESS_MODEL.md docs/PRODUCT_ONE_PAGER.md docs/SALES_PLAYBOOK.md` | 0 | `181 docs/PRD.md`, `268 app/operations-client.tsx`, `63 docs/BUSINESS_MODEL.md`, `66 docs/PRODUCT_ONE_PAGER.md`, `67 docs/SALES_PLAYBOOK.md`, `645 total` |
| 2 | `find app/line app/onboarding app/dashboard app/auth -type f` + `grep -ril "qrcode\|QRCode\|generateQR" app lib` | 0 | Listed `app/line/book/*`, `app/line/claim/*`, `app/onboarding/*`, `app/dashboard/page.tsx`, `app/auth/accept-invite/page.tsx`; the QR grep returned **no matches in app/ or lib/** |
| 3 | `grep -ril "qrcode\|qr_code\|QR Code\|qr-code" .` (node_modules and .next excluded) | 0 | Single hit: `./docs/ONBOARDING_SOP.md` — the only place QR appears |
| 4 | `grep -o '"qrcode[^"]*"' package.json` | 0 | no output — no QR dependency in the manifest |
| 5 | `find app/api -type f` | 0 | `app/api/camera/*`, `app/api/daily-reports/route.ts`, `app/api/internal/google-sync/route.ts`, `app/api/internal/line-dispatch/route.ts`, `app/api/line/claim/route.ts` |
| 6 | `grep -n "DAILY_REPORT_MAX_PHOTOS" lib/daily-report-media.ts` | 0 | `4:export const DAILY_REPORT_MAX_PHOTOS = 4;` |
| 7 | `grep -n "title:\|id:\|description:\|isCritical" lib/pilot-readiness-service.ts` | 0 | Seven readiness items incl. `shop_profile`, `active_owner`, `usable_rooms`, `customer_pet_data`, `line_oa`, `google_sheets`, `booking_ready` |
| 8 | `python docs/house-swarm-5a/_wu4_check.py` | 0 | `TH section count: 13`, `EN section count: 13`, `same numeric order: True`, `total: 16` marker occurrences, `union distinct: [APP_URL, PRIVACY_CONTACT, PROVIDER_LEGAL_NAME, SHOP_NAME, SUPPORT_CONTACT, SUPPORT_HOURS]`, `other curly markers: []` |
| 9 | `python docs/house-swarm-5a/_wu4_check2.py` | 0 | `manuals union == inputs file: True` (after the template-marker wording was changed), currency scan found only the four quoted price lines, `CJK chars in TH file: []`, `CJK chars in EN file: []` |
| 10 | `for f in ...; do stat -c%s "$f"; sha256sum "$f"; done` | 0 | See table in §1 |
| 11 | `rm -f docs/house-swarm-5a/_wu4_check.py docs/house-swarm-5a/_wu4_check2.py` | 0 | Temporary verification scripts removed; only the note and the three manuals remain |
| 12 | `git status --porcelain docs/` | 0 | `?? docs/house-swarm-5a/` and `?? docs/manual/` — two new untracked directories, no tracked file modified |
| 13 | `python docs/house-swarm-5a/_wu4_check2.py` social-proof scan (grep fallback) | 0 | The flagged hits were false positives: `รีวิว` inside `พรีวิว` (preview), `ดาว` inside `ดาวน์โหลด` (download), `ลูกค้าแล้ว` = "…customer card, then press", `rating` inside `operating`. No review, rating, star or customer-count claim exists in either manual |

## 4. Per-section verification map

For every manual section, the repository file that was actually read to verify the steps:

| Manual section | Verified against |
| :--- | :--- |
| 1. What the product is / who it is for | `README.md` (Product Positioning, Brand status), `docs/PRD.md` §1 §2 §3, `docs/PRODUCT_ONE_PAGER.md`, `docs/ONBOARDING_SOP.md`, `docs/COMMERCIAL_READINESS.md` |
| 2. Signing in and staff roles | `app/login/page.tsx`, `app/actions/auth.ts`, `app/page.tsx`, `app/operations-client.tsx`, `docs/PRD.md` §9, `app/dashboard/page.tsx`, `app/onboarding/page.tsx`, `app/onboarding/OnboardingClient.tsx` |
| 3. Setting up rooms | `app/operations-client.tsx` (Room setup card, maintenance form, `roomStatusLabel`), `app/actions/operations.ts`, `app/actions/booking.ts` (`setRoomMaintenanceAction`), `app/onboarding/OnboardingClient.tsx`, `docs/SYSTEM_ARCHITECTURE.md` (`rooms` table, test matrix #4/#14A), `docs/PRD.md` §3.1 §11, `docs/BUSINESS_MODEL.md` §2, `docs/PRODUCT_ONE_PAGER.md` |
| 4. Adding a customer and their pets | `app/operations-client.tsx` (add/edit customer, add/edit pet forms), `app/actions/operations.ts`, `app/onboarding/OnboardingClient.tsx` (CSV import), `docs/SYSTEM_ARCHITECTURE.md` (`pet_owners`, `pets`), `docs/PRD.md` §8 |
| 5. Linking a pet owner's LINE | `app/operations-client.tsx` (card LINE state, claim token box, Reset LINE), `app/actions/line-claim.ts`, `app/line/claim/page.tsx`, `app/line/claim/LineClaimClient.tsx`, `app/api/line/claim/route.ts`, `docs/PRD.md` §8, `docs/SYSTEM_ARCHITECTURE.md` §2 |
| 6. Creating a booking and checking in | `app/operations-client.tsx` (booking-request panel, create-booking form, pet add/remove, schedule form, Check-in/Cancel), `app/actions/booking.ts`, `docs/PRD.md` §3.1 §3.3 §3.4 §6, `docs/SYSTEM_ARCHITECTURE.md` test matrix #6/#7/#8, `docs/ONBOARDING_SOP.md` §2, `docs/CURRENT_STATUS.md` |
| 7. Sending the Daily Report with photos | `app/operations-client.tsx` (`submitDailyReport`, status selects, `maxLength={4000}`, photo field, report list, Retry), `app/api/daily-reports/route.ts`, `lib/daily-report-media.ts`, `lib/daily-report-storage.ts` (`DAILY_REPORT_BUCKET = "daily-report-photos"`), `lib/daily-report-service.ts`, `docs/PRD.md` §2 §5 §6 §7, `docs/SYSTEM_ARCHITECTURE.md`, `docs/ONBOARDING_SOP.md` §3 |
| 8. Checking out | `app/operations-client.tsx` (Check-out, Mark clean), `app/actions/booking.ts` (`updateBookingStatusAction`, `markRoomCleanAction`), `docs/PRD.md` §3.3 point 2, `docs/ONBOARDING_SOP.md` §4 |
| 9. Google Sheets replica and what it excludes | `app/operations-client.tsx` (Google Sheets card, KPI, Disconnect), `app/actions/google-sheet.ts`, `lib/google-sheet-records.ts` (`CUSTOMER_HEADERS`, `BOOKING_HEADERS`, sheet names), `lib/integrations.ts` (`entityType: "pet_customer" \| "booking"`), `lib/google-sync-worker-core.ts`, `docs/PRD.md` §2 §10, `docs/SYSTEM_ARCHITECTURE.md` §8 + test matrix #35/#44, `app/dashboard/page.tsx` |
| 10. When LINE delivery fails | `app/operations-client.tsx` (failed badge, Retry delivery, LINE KPI), `app/actions/daily-report.ts`, `docs/PRD.md` §7, `docs/SYSTEM_ARCHITECTURE.md` §8 LINE Delivery, `docs/ONBOARDING_SOP.md` §3 point 7 |
| 11. Support: text only | locked rule L-13 in `D:/AI-Workspace/vault/06-Agent-Logs/WSTERA-House/PLAN-HOUSE-LOCKED-v1-2026-09-25.md`, L-11 same file, `docs/PRODUCT_ONE_PAGER.md` (`TBD` contacts), `docs/COMMERCIAL_READINESS.md` (Operations unticked), `STATUS-HOUSE.md` item O-4, `docs/TERMS_AND_PRIVACY.md`, `app/operations-client.tsx` token warning |
| 12. Payment and packages | `docs/COMMERCIAL_READINESS.md` (Before Paid Launch), `docs/CURRENT_STATUS.md`, `docs/PS01-PRICING-A2-IMPLEMENTATION-2026-09-26.md`, `docs/BUSINESS_MODEL.md` §2, `docs/PRD.md` §11, Addendum A-2 in `STATUS-HOUSE.md`, `app/dashboard/page.tsx`, `docs/TERMS_AND_PRIVACY.md` |
| 13. FAQ | Same files as the sections each answer points back to (claims, report frequency, re-linking, cancellation, annual plan, photo retention) |

## 5. Placeholder inventory and count

One consistent marker is used: `{{OWNER_INPUT:…}}`.

Distinct placeholders: **6**. Occurrences across both manuals: **16** (8 in Thai, 8 in English).

| Placeholder | Occurrences |
| :--- | --: |
| `{{OWNER_INPUT:SHOP_NAME}}` | 2 |
| `{{OWNER_INPUT:APP_URL}}` | 6 |
| `{{OWNER_INPUT:SUPPORT_CONTACT}}` | 2 |
| `{{OWNER_INPUT:SUPPORT_HOURS}}` | 2 |
| `{{OWNER_INPUT:PROVIDER_LEGAL_NAME}}` | 2 |
| `{{OWNER_INPUT:PRIVACY_CONTACT}}` | 2 |

The union of placeholders in the two manuals is exactly the set inventoried in `docs/manual/PS01-MANUAL-OWNER-INPUTS.md` (script check: `manuals union == inputs file: True`). Section 5 additionally documents two **inline link parts** (`<token>`, `<shop-id>`) which deliberately do not use the marker because they are per-issue values, not owner constants. The lines that describe the marker itself use the shape `{{OWNER_INPUT:…}}` and are explicitly noted as descriptions, not fillable fields. No email, phone number, LINE id, business name or web address is invented anywhere.

## 6. Where the SOP and the code disagree (code followed, discrepancy recorded in the manual)

1. **LINE claim QR vs token text.** `docs/ONBOARDING_SOP.md` §1 tells staff to have the customer scan a **QR code**. Nothing in the repository generates a QR image — a repository-wide search for `qrcode|qr_code|QR Code|qr-code` (excluding `node_modules`/`.next`) matches only that SOP document, and `package.json` has no QR dependency — while `app/operations-client.tsx` shows the claim **token as text** in a box. Both manuals follow the code and tell staff to send the `/line/claim` link, and both carry a visible note that a QR generator would have to be added.
2. **Daily Report entry point and button name.** The SOP §3 has staff press **"ส่ง Daily Report 📸" on the room card** in the room matrix and says the LINE Flex card is sent immediately. The code implements instead a **form on the Daily Report tab** with the button **"สร้างและเข้าคิวส่ง LINE"**, and the report is **queued** for a background dispatcher (`app/api/internal/line-dispatch/route.ts`, `lib/line-worker.ts`), not transmitted on the click. Both manuals follow the code and have staff wait for the `sent` badge.
3. **Option labels.** The SOP §3 says `กินครึ่งเดียว` and `ไม่ยอมกิน`; the live form (`app/operations-client.tsx`) says `ครึ่งหนึ่ง` and `ไม่กิน`. The manuals use the on-screen labels and note the difference.

## 7. Behaviours that could not be verified from the repository (and how they were written conservatively)

1. **Google Sheets sync latency.** `docs/SYSTEM_ARCHITECTURE.md` §8 fixes worker concurrency = 1 and bounded exponential backoff but states no guaranteed interval. The manual therefore says plainly that no SLA is documented and instructs staff not to promise customers a time window, treating the product database as live truth and the sheet as a trailing copy.
2. **Photo retention in a production environment.** `docs/PRD.md` §7 documents a 30-day-after-contract-end media retention policy, but no document confirms the actual setting in a shop's runtime environment. The manual states the documented policy and adds that the current setting should be confirmed with the provider before promising retention to a customer; no independent setting was asserted.
3. **Live LINE delivery end to end.** The delivery worker, retry key reuse and lease recovery are documented in `docs/PRD.md` §7 and `docs/SYSTEM_ARCHITECTURE.md` §8 and implemented in `app/api/internal/line-dispatch/route.ts` and `lib/line-worker.ts`, but no live send was observed (and none may be, in this documentation-only unit). The manual describes only what staff can see and do — the `failed` badge, the "Retry delivery" button, the linked/not-linked state and the LINE configured/not-configured KPI — plus the documented rule that the same duplicate-protection key is reused.
4. **The shop identifier shown to staff for the claim link.** `app/line/claim/page.tsx` reads `shop` from the query string, but the operations screen displays only the per-customer token, not the shop id. The manual records `<shop-id>` in the link shape, labels it as supplied by the system, and does not invent a screen or a field where staff read it.
5. **Which exact page a shop opens.** No production web address is confirmed in the repository (`docs/PRODUCT_ONE_PAGER.md` marks it `TBD`), so every address in the manuals is the placeholder `{{OWNER_INPUT:APP_URL}}` and the routes are given as repository paths (`/login`, `/dashboard`, `/onboarding`, `/line/claim`).
6. **Support contact and hours.** No confirmed support channel exists (`SUPPORT_EMAIL`/`LINE_OA_ID` still pending per `STATUS-HOUSE.md` O-4), so both values are placeholders and support is described strictly as text-only per locked rule L-13.

## 8. Explicit statement on builds, tooling and side effects

- **No `tsc`, `eslint`, `next build`, nor any test run was executed.** This is not applicable: the unit changes Markdown documentation only, and the changed files are not inputs to type-checking, linting, the Next.js build, or the test suites. Running a build would have verified nothing about manual prose.
- **Nothing was installed, built, deployed, migrated, committed or connected to a database.** No package manager was invoked, no migration was applied, no network or database connection was made, and no commit or push was performed (`git status --porcelain docs/` shows two new untracked directories and no tracked file modified).
- **No secret was read or printed.** `.env`, `.env.local`, `.env.staging.local`, `.secrets` and other credential paths were never opened, and no secret value appears in this note or in the manuals. The only security-relevant content is the instruction that staff must not copy claim tokens or passwords into chat, notebooks or logs (locked rule L-11).
- **No prohibited path was touched:** `app/`, `lib/`, `messages/`, `supabase/` and `tests/` were read for verification but not modified; `.git`, `.env*`, `.secrets`, `node_modules`, `.next`, `package.json`, `pnpm-lock.yaml` and `relay` were not touched at all.

## 9. Acceptance checks

| Check | Result |
| :--- | :--- |
| Three files exist and are non-empty | PASS — 59862 / 34203 / 9213 bytes |
| Two manuals have the same numbered section count and order | PASS — 13 and 13, same numeric order (script-verified) |
| Every step cites the repository file it was verified against | PASS — every numbered step and every FAQ answer carries a `(ที่มา: …)` / `(Source: …)` citation |
| Support described as text-only with an unfilled placeholder contact | PASS — section 11, L-13 cited, `{{OWNER_INPUT:SUPPORT_CONTACT}}` and `{{OWNER_INPUT:SUPPORT_HOURS}}` unfilled |
| No payment capability claimed as available | PASS — section 12 opens by stating payment is absent and package purchase is unavailable |
| No invented price, no customer count, no social proof | PASS — only the four Addendum A-2 values (590 THB/17 USD, 990 THB/28 USD, Enterprise not for sale, no annual plan), marked changeable; social-proof scan clean |
| Note documents bytes + sha256, command log, placeholder count, unverified list | PASS — §1, §3, §5, §7 of this file |

This worker does not approve its own work; the commander verifies.
