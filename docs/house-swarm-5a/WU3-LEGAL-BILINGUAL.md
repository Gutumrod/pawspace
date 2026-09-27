# WU3-LEGAL-BILINGUAL — Note (H5A-WU3-LEGAL-BILINGUAL)

Correlation id: `house-swarm-5a-wu3-20260927`
Worktree: `D:/AI-Workspace/runtime/worktrees/house-swarm-5a-legal`
Base revision: `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a`
Role: implementation (documentation-only)

## Objective

Produce bilingual (Thai / English) DRAFT terms of service and privacy notice for PS01
(Pawstia PMS / PawSpace) under `docs/legal/`, structurally parallel, matching the real
system, plus a single Owner-input list.

## Status

Deliverables written and self-checked. This unit did **not** deploy, migrate, install,
commit, or connect to any database, and did not read or print any secret.

---

## 1. File list — bytes and sha256

| File | Bytes | sha256 |
| :--- | ---: | :--- |
| `docs/legal/PS01-TERMS-PRIVACY-TH.md` | 40181 | `b1f37a34884247c66a6c8e91917df9b1dfd359eadd7f116b587097f1ce1db7b5` |
| `docs/legal/PS01-TERMS-PRIVACY-EN.md` | 18845 | `48120d9656996b887e1959f34fe72c37ef23552285cd02f739c350679bb46d37` |
| `docs/legal/PS01-OWNER-INPUTS.md` | 5811 | `bee6874e0aa601fbe8c4f9383ce4b3acc129a6c0b9865e7be31546e625d8b0ae` |
| `docs/house-swarm-5a/WU3-LEGAL-BILINGUAL.md` (this note) | 20272 | self-referential — recording its own hash changes it, so its hash at hand-off is reported in the worker completion report instead of embedded here |
| `scripts/check-wu3-legal-bilingual.py` | 5154 | `8ce47ac2a7d9b4d54c052c080f53ae2669b210150b6c7aaf9a623eab01f096d9` |

All values above were produced by one `for` loop over `wc -c` and `sha256sum` (command C11 in §2),
run after the final content edit. The three legal-file hashes are the binding deliverable values;
`PS01-TERMS-PRIVACY-TH.md` and `PS01-TERMS-PRIVACY-EN.md` were frozen before this note was
finalised, so their hashes are stable. This note's own hash is excluded by construction.

---

## 2. Command log — exact commands with exit codes

| # | Command | Exit | Observed output (summary) |
| :-- | :--- | :-- | :--- |
| C1 | `git status --short \| head -20` ; `git rev-parse HEAD` ; `ls docs/` | 0 | HEAD = `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a`; `docs/legal` did not exist yet |
| C2 | `grep -rn "daily-report-photos" supabase/migrations/` ; bucket `public` flag ; RLS grep | 0 | bucket insert at `phase6…:10-22` with `TRUE` (public); `ENABLE ROW LEVEL SECURITY` on 10 core tables at `phase2…:909-918` |
| C3 | `grep -rniE "two-tier\|2-tier\|RLS" docs/SYSTEM_ARCHITECTURE.md` | 0 | only `docs/TERMS_AND_PRIVACY.md:45` uses "RLS 2-Tier"; architecture doc has no "two-tier" mechanism |
| C4 | `grep -rniE "hosting\|TBD\|undetermined" docs/*.md` | 0 | only `docs/TERMS_AND_PRIVACY.md:34` names hosting ("Hosting provider — TBD … ห้ามถือว่าเป็น Vercel โดยอัตโนมัติ") |
| C5 | `grep -rniE "google-analytics\|gtag\|mixpanel\|posthog\|hotjar\|amplitude\|matomo\|plausible\|clarity\|fbq\|segment\.io" --include=*.ts --include=*.tsx .` | 1 | **no matches** (exit 1 = nothing found) → no analytics/advertising/tracking capability |
| C6 | `grep -rniE "stripe\|promptpay\|omise\|2c2p\|checkout\|payment" app/ lib/` ; `grep -niE "stripe\|omise\|payment" package.json` | 0 / 1 | matches are only the substring "payment" inside unrelated words; package.json has **no** payment dependency |
| C7 | `python3 scripts/check-wu3-legal-bilingual.py` (final run, after the §8.1 citation fix) | 0 | `SELF-CHECK=PASS` |
| C8 | `sha256sum docs/legal/*.md` ; `wc -c docs/legal/*.md` | 0 | values as in §1 |
| C11 | `for f in <5 files>; do wc -c; sha256sum; done` | 0 | final bytes + sha256 for all five files (values in §1) |
| C9 | `git status --short -- docs/TERMS_AND_PRIVACY.md` | 0 | **empty** → `docs/TERMS_AND_PRIVACY.md` untouched |
| C10 | `git status --short \| grep -E "\.tsx?$"` ; `\| grep -iE "\.env"` | 1 / 1 | **no output** for each → no `.ts`/`.tsx` file and no `.env*` file was created or modified |

**`npx tsc --noEmit` was not run, and was not needed**: this unit is documentation-only. Commands
C10 confirm that no `.ts`/`.tsx` file was created or modified (`grep` found nothing), so the
TypeScript compiler check does not apply to this change.

### Self-check output (command C7, final)

```
FILE docs/legal/PS01-TERMS-PRIVACY-TH.md exists=True bytes=40181 sha256=b1f37a34...
FILE docs/legal/PS01-TERMS-PRIVACY-EN.md exists=True bytes=18845 sha256=48120d96...
FILE docs/legal/PS01-OWNER-INPUTS.md exists=True bytes=5811 sha256=bee6874e...

TH sections=13 nums=['1'..'13']
EN sections=13 nums=['1'..'13']
SAME NUMBER ORDER=True

TH occurrences=13 distinct=12
EN occurrences=13 distinct=12
OI occurrences=12 distinct=12
TH distinct == EN distinct: True
OI set == TH set: True
OI covers EN: True
NON-CONFORMING [[ ]] markers: []
OTHER bracket placeholders: []
TH banner: {'draft_for_review': True, 'not_legal_advice': True, 'owner_approval': True, 'no_production_use': True}
EN banner: {'draft_for_review': True, 'not_legal_advice': True, 'owner_approval': True, 'no_production_use': True}
TH price tokens (citations excluded)=['17', '28', '590', '990'] unexpected=[]
EN price tokens (citations excluded)=['17', '28', '590', '990'] unexpected=[]
TH provider lines without a live-denial: []
EN provider lines without a live-denial: []

SELF-CHECK=PASS
```

Additional structural check (not in the harness): the sub-clause identifiers are identical in both
files — 57 ids in the same order (`1.1`–`1.4`, `2.1`–`2.9`, `3.1`–`3.3`, `4.1`–`4.7`, `5.1`–`5.2`,
`6.1`–`6.4`, `7.1`–`7.5`, `8.1`–`8.4`, `9.1`–`9.4`, `10.1`–`10.4`, `11.1`–`11.4`, `12.1`–`12.4`,
`13.1`–`13.3`), verified with `grep -oE "^\s*[0-9]+\.[0-9]+ "` on both files.

---

## 3. Repository files actually read, and the specific line relied on

Each factual system claim in the two language files carries an inline `[src: path:line]` citation.
This is the evidence list behind those citations.

| # | Claim written in the drafts | Repository file read | Line relied on |
| :-- | :--- | :--- | :--- |
| R1 | Supabase provides database, authentication and storage | `docs/SYSTEM_ARCHITECTURE.md` | 29 (`Data & Storage Layer (Supabase PostgreSQL & Storage)`), 32 (`Supabase Storage: daily-report-photos Public CDN Bucket`) |
| R2 | V1 authentication is Supabase Auth email + password | `docs/PRD.md` | 142 (`V1 ใช้ Supabase Auth Email + Password`) |
| R3 | Staff context is read via RPC and deactivation removes access | `lib/tenant-context.ts`; `supabase/migrations/20260820030000_phase3_auth_tenant.sql` | `tenant-context.ts:41-43` (`rpc("get_current_staff_context")`); `phase3…:72` (`WHERE su.id = v_caller_id AND su.is_active = TRUE`) |
| R4 | Pet owner contact fields (name, phone, emergency phone, address, LINE id) | `supabase/migrations/20260220000000_initial_schema.sql` | 38-55 (`CREATE TABLE pet_owners … phone / emergency_phone / address / line_user_id`) |
| R5 | Pet records (species, breed, gender, birth date, weight, care notes, allergies) | `supabase/migrations/20260220000000_initial_schema.sql`; `lib/google-sync-source.ts` | initial schema 57-63 (`CREATE TABLE pets`); `google-sync-source.ts:16-18` (columns read: `special_care_notes, allergies`) |
| R6 | Booking history incl. customer-submitted LINE booking requests | `supabase/migrations/20260220000000_initial_schema.sql`; `supabase/migrations/20260822000000_phase11_customer_booking_requests.sql` | initial 101 (`CREATE TABLE bookings`); phase11 6-26 (`booking_requests`, `requested_by_line_user_id`) |
| R7 | Daily report content + 1–4 photos per report | `supabase/migrations/20260220000000_initial_schema.sql`; `lib/daily-report-media.ts` | initial 139-159 (`daily_reports` with food/excretion/mood/photo_urls/staff_notes); `daily-report-media.ts:4` (`DAILY_REPORT_MAX_PHOTOS = 4`) |
| R8 | Technical logs kept for security/troubleshooting; logger redacts secrets | `docs/PRODUCTION_OPERATIONS.md`; `lib/logger.ts` | ops doc 32-39 (monitoring list: application errors, database failures, LINE delivery failures, Sheets sync failures, storage upload failures, auth failures); `logger.ts:1-35` (`SENSITIVE_KEYS`, `[REDACTED]`) |
| R9 | Visitor camera: append-only audit; IP stored as keyed hash, not raw | `supabase/migrations/20260821150000_phase8_camera_access.sql`; `lib/camera-access-core.ts` | phase8 39-46 (`camera_access_audit`, `requester_ip_hash` with 64-hex CHECK), 70-81 (append-only triggers); `camera-access-core.ts:49-51` (`sha256Hex(\`camera-ip:${pepper}:${requesterIp}\`)`) |
| R10 | Daily report delivered to pet owner via LINE Messaging API | `lib/line-transport.ts`; `lib/line-worker.ts` | `line-transport.ts:1` (`https://api.line.me/v2/bot/message/push`), 40 (Flex message builder), 104-138 (push call); `line-worker.ts:94` (`sendLineDailyReport(job, channelAccessToken)`) |
| R11 | LINE Login / LIFF used for the owner's LINE link/claim | `app/line/claim/LineClaimClient.tsx`; `app/line/claim/page.tsx`; `lib/line-claim-server.ts`; `supabase/migrations/20260820221500_phase5_line_claim.sql` | `LineClaimClient.tsx:44-50` (`liff.init` / `isLoggedIn` / `login` / `getIDToken`); `page.tsx:18` (`NEXT_PUBLIC_LINE_LIFF_ID`); `line-claim-server.ts:9-13` (`requireLineLoginEnv()` then server-side verify); phase5 31-32 (single-use claim token stored as `sha256` hash, `now() + interval '48 hours'`) |
| R12 | Google Sheets is a shop-initiated one-way replica, no photos, no deep report data | `docs/PRD.md`; `docs/SYSTEM_ARCHITECTURE.md`; `lib/google-sheet-binding-core.ts`; `lib/google-sync-source.ts`; `docs/TERMS_AND_PRIVACY.md` | PRD 28 (`One-way Export Replica` … Pet-Centric); SA 37 (`Pet-Centric One-Way Replica`); `google-sheet-binding-core.ts:15-30` (shop binds its own sheet via proof token); `google-sync-source.ts:11-49` (only pet/owner/booking columns read — no photo or report data); T&P 23 (`ไม่ครอบคลุมไฟล์รูปภาพใน Storage, ข้อมูล Daily Reports เชิงลึก`) |
| R13 | Photos in a public-read bucket addressed by unguessable paths | `supabase/migrations/20260820233000_phase6_daily_report_line_delivery.sql`; `lib/daily-report-storage.ts`; `docs/TERMS_AND_PRIVACY.md` | phase6 10-22 (`INSERT INTO storage.buckets … 'daily-report-photos', TRUE`) — `TRUE` is the `public` column; `daily-report-storage.ts:4` (bucket name), 26-33 (`objectBase` = shopId/bookingId/petId/idempotencyKey/index-hash), 70 (`getPublicUrl`); T&P 47 (`Public CDN Read with Secure Cryptographic UUID Paths`) |
| R14 | Tenant separation enforced by two-tier DB row-level security | `supabase/migrations/20260820020000_phase2_authoritative_gateways.sql`; `docs/SYSTEM_ARCHITECTURE.md`; `docs/TERMS_AND_PRIVACY.md` | phase2 909-918 (`ALTER TABLE … ENABLE ROW LEVEL SECURITY` on 10 core tables), 925-934 (`CREATE POLICY staff_read_* … USING (shop_id=current_staff_shop_id())`), 920-923 (`REVOKE INSERT,UPDATE,DELETE … FROM anon,authenticated`); SA 65 (`Browser Client มีสิทธิ์อ่านผ่าน RLS แต่ไม่มี Generic INSERT/UPDATE/DELETE`), 80 (`service_role` trusted server only); T&P 45 (the string `RLS 2-Tier`) |
| R15 | Per-shop LINE channel access token read from server-only env config | `lib/env.ts`; `lib/line-worker.ts`; `docs/TERMS_AND_PRIVACY.md` | `env.ts:81-92` (`getLineChannelAccessTokenForShop` reading `process.env.LINE_CHANNEL_ACCESS_TOKENS_JSON`, JSON keyed by shop id); `line-worker.ts:81-83` (token fetched per claimed job, failure marks the job failed); T&P 44 (`LINE Channel Access Token ต่อร้านถูกอ่านจาก server-only environment configuration`) |
| R16 | Session cookies only (httpOnly sign-in session + camera session); no tracking cookies | `lib/auth.ts`; `app/api/camera/access/[shopSlug]/route.ts` | `auth.ts:15-40` (`setSessionCookies`, `httpOnly: true`); camera route 59-60 (`response.cookies.set({ name: CAMERA_SESSION_COOKIE … })`) |
| R17 | Hosting provider genuinely undetermined | `docs/TERMS_AND_PRIVACY.md` | 34 (`| **Hosting provider — TBD** | โฮสต์เว็บแอปพลิเคชัน/API | ต้องยืนยันผู้ให้บริการและภูมิภาคจริงก่อน Production; ห้ามถือว่าเป็น Vercel โดยอัตโนมัติ |`) — quoted verbatim in both language files |
| R18 | Payment: none in the product today | `lib/entitlements.ts`; `package.json`; command C6 | `entitlements.ts:2` (`Billing execution and hard quota enforcement are intentionally outside this phase.`); no payment dependency in `package.json`; no payment/checkout code or route found (C6) |
| R19 | Addendum A-2 prices only | `docs/BUSINESS_MODEL.md`; `supabase/migrations/20260926120000_ps01_pricing_a2.sql`; `lib/entitlements.ts`; `docs/PS01-PRICING-A2-IMPLEMENTATION-2026-09-26.md` | BUSINESS_MODEL 18 (Owner decision: Starter ฿590/$17, Pro ฿990/$28, annual unapproved, Enterprise ฿2,490 not for sale), 22-24 (limit table: Starter 10 rooms/300 pets; Pro unlimited; Enterprise not for sale); migration 24-34 (`monthly_price` CASE 590/990, `annual_price = NULL`, `available_for_sale = (id <> 'enterprise')`); `entitlements.ts:15-46` (`CANONICAL_PACKAGES` 590/990/2490, `annualPrice: null`, enterprise `availableForSale: false`); A-2 impl doc 8-13 |
| R20 | No analytics/advertising/tracking capability | whole-repo search, command C5 | no match for any analytics/advertising/pixel/tracking library name; `docs/TERMS_AND_PRIVACY.md:20` is the project's zero-data-selling policy statement |
| R21 | Deletion/retention only declarable once verifiable deletion exists | `docs/TERMS_AND_PRIVACY.md`; `docs/PRD.md`; `docs/PRODUCTION_OPERATIONS.md` | T&P 66 (`เก็บรักษาไว้เป็นเวลา 30 วัน` — the *suggested* period, quoted as a suggestion); PRD 128 (`30 วันหลังสิ้นสุดสัญญา` for photos); ops doc 41-48 (backup frequency, media backup strategy, recovery testing schedule, RTO, RPO are all still "Required decisions before GA") |
| R22 | Support is written-channel only | locked project rule L-13 in `PLAN-HOUSE-LOCKED-v1-2026-09-25.md` | 63 (`L-13 support ช่วงเปิดตัว: ตอบแบบข้อความเท่านั้น … ไม่มี live call`) — cited as the project direction; the actual channel is an Owner input |

### Claims I could **not** verify from the repository, and therefore softened

1. **HTTPS/TLS in transit.** The statement originates in the project's own draft
   (`docs/TERMS_AND_PRIVACY.md:43`). There is no TLS configuration, header or certificate
   handling in this repository that proves it. Both language files now state this inline —
   §8.1 says the HTTPS/TLS point "comes from the project's existing draft and could not be
   directly confirmed from this repository's code". This is recorded as a documentation-level
   claim, not a code-verified fact.
2. **The retention period.** `docs/TERMS_AND_PRIVACY.md:66` and `docs/PRD.md:128` suggest
   30 days, but no deletion mechanism was located in the repository that would enforce it, and
   `docs/PRODUCTION_OPERATIONS.md:41-48` still lists backup/recovery decisions as pending.
   So the period is written as an Owner input with the 30 days marked **as a suggestion only**,
   plus an explicit statement that the value only becomes real once verifiable deletion exists.
3. **The "two-tier" RLS label.** No repository file describes a two-tier *mechanism*; the string
   `RLS 2-Tier` appears only in `docs/TERMS_AND_PRIVACY.md:45`. Only the RLS facts that are
   actually in the migrations were asserted, and the drafts say explicitly that "two-tier" is a
   documentation label rather than a separate mechanism.
4. **Sub-processor regions and transfer facts.** Unverifiable from code; written as pending
   vendor confirmation and an Owner input, not asserted.
5. **USD prices.** `docs/PS01-PRICING-A2-IMPLEMENTATION-2026-09-26.md:13` states USD is not
   stored in the catalogue and is documented only. The drafts say exactly that rather than
   implying the system enforces a USD figure.
6. **Hosting provider.** Genuinely undetermined; the governing document line is quoted verbatim
   in both files, so the gap is visible rather than papered over.

---

## 4. Placeholder inventory and count

One consistent marker is used across all three files: **`[[OWNER INPUT: OI-nn]]`**.

**Count of distinct placeholders: 12** (`OI-01` … `OI-12`).

| File | Distinct ids | Marker occurrences |
| :--- | :--- | ---: |
| `docs/legal/PS01-TERMS-PRIVACY-TH.md` | OI-01 … OI-12 (12) | 13 |
| `docs/legal/PS01-TERMS-PRIVACY-EN.md` | OI-01 … OI-12 (12) | 13 |
| `docs/legal/PS01-OWNER-INPUTS.md` | OI-01 … OI-12 (12) | 12 |

`OI-02` appears twice in each language file (sections 7.4 and 13.1) because the same contact
decision serves both purposes; this is why occurrences (13) exceed distinct ids (12).

| Id | Decision | Suggestion already in existing drafts |
| :--- | :--- | :--- |
| OI-01 | WSTERA legal entity acting as processor/operator | none offered; `docs/TERMS_AND_PRIVACY.md:13` says undetermined |
| OI-02 | Privacy/support contact channel | none in PS01 draft; written-only support per L-13 |
| OI-03 | Person responsible for personal data protection | none |
| OI-04 | Hosting provider and region | none — `docs/TERMS_AND_PRIVACY.md:34` says undetermined |
| OI-05 | Post-termination retention period | **suggestion only:** 30 days (`docs/TERMS_AND_PRIVACY.md:66`, `docs/PRD.md:128`) |
| OI-06 | Binding breach-notification timeframe | **suggestion only:** 24-hour target (`docs/TERMS_AND_PRIVACY.md:60`) |
| OI-07 | Effective date | none |
| OI-08 | Prevailing language on conflict | **suggestion only:** Thai (`L15-WSTERA-TERMS-PRIVACY-DRAFT-2026-09-26.md:20`) |
| OI-09 | Payment terms when enabled | none; no provider claimed live |
| OI-10 | Published package prices / changeability | **suggestion only:** Addendum A-2 values (`docs/BUSINESS_MODEL.md:18-24`) |
| OI-11 | Sub-processor entities, regions, transfer terms | none; marked pending vendor confirmation |
| OI-12 | Exact support channel and hours | none; L-13 fixes written-only, not the channel |

The harness verifies `distinct(TH) == distinct(EN) == distinct(OWNER-INPUTS)`, that no
non-conforming `[[...]]` marker and no other bracket placeholder (`[TBD]`, `[CONTACT]`, …) exists
in either language file, and that the Owner-input file covers every id used in both.

---

## 5. Acceptance-check mapping

| Acceptance check | Where satisfied | Verified by |
| :--- | :--- | :--- |
| three files exist and are non-empty | §1 | C7/C8 (`exists=True`, bytes > 0) |
| same numbered section headings, same order | 13 sections, ids 1–13 in both | C7 (`SAME NUMBER ORDER=True`) plus the 57-sub-clause check |
| controller/processor correct; shop's own duty to pet owner stated | TH §1.1–1.4 / EN §1.1–1.4 | drafted; sources R3, R14 |
| every factual system claim names a repository file; no analytics/advertising/tracking claimed | inline `[src: path:line]` throughout; R20 | C5 (no matches) |
| payment clause is when-enabled and an Owner input; no provider live | TH/EN §9.1–9.4 | C7 (`provider lines without a live-denial: []`) |
| only Addendum A-2 prices, if any price at all | TH/EN §10 | C7 (`price tokens … unexpected=[]`) |
| one consistent marker; every placeholder listed | §4 | C7 (parity + coverage) |
| both banner + not-legal-advice statement | TH/EN banner block | C7 (`banner: {… True ×4}`) |
| note has file list, command log, read evidence, placeholder count | §1, §2, §3, §4 | this file |
| `docs/TERMS_AND_PRIVACY.md` untouched | — | C9 (empty status) |
| `npx tsc --noEmit` not needed | documentation-only; no `.ts`/`.tsx` touched | C10 (grep found nothing) |

## 6. Safety statement

Nothing was deployed, migrated, installed, committed or connected to any database. No git write
command was run (only `git status` / `git rev-parse` reads). No `.env` file was created or
modified, and no secret was read or printed. All repository paths outside `docs/`, `scripts/`
and `app/` were untouched; `app/` was not modified at all.

The scope-adjacent file `scripts/check-wu3-legal-bilingual.py` was created inside the allowed
`scripts/` scope as the self-check harness, so the acceptance checks are reproducible by
`python3 scripts/check-wu3-legal-bilingual.py`.
