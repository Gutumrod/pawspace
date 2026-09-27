# HOUSE-SWARM-5A · WU1B-LINE-SURFACES — bilingual (TH/EN) LINE surfaces for PS01 (PawSpace)

Work unit: `H5A-WU1B-LINE-SURFACES`
Correlation id: `house-swarm-5a-wu1b-20260927`
Role class: implementation
Workspace: `D:/AI-Workspace/runtime/worktrees/house-swarm-5a`
Revision at session start: `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a`
Status of this document: COMPLETE

Governing brief names the LINE surfaces the pet owner sees as the most important surfaces of
this wave: the Daily Report the owner receives, the LINE booking page and the LINE claim page.
This unit extends the WU-1A `next-intl` foundation (`app/i18n/*`, `messages/{th,en}.json`,
`app/components/language-toggle.tsx`) that is already present in this worktree.

Standing policy applied: `D:/AI-Workspace/projects/saas-product-hub/docs/platform/I18N_POLICY.md`
— "This applies to product UI text (labels, buttons, messages, emails/notifications a customer
sees) — not to internal code comments, commit messages, or developer-facing docs."

No self-approval: this note is a record. The commander verifies.

---

## 1. What this unit changed

| # | File | Change |
|---|------|--------|
| 1 | `messages/th.json` | added `line`, `lineBooking`, `lineClaim`, `lineReport` namespaces (78 new keys); all 364 pre-existing keys untouched |
| 2 | `messages/en.json` | same 78 keys in English; exact key parity with `th.json` |
| 3 | `app/line/book/LineBookingClient.tsx` | every pet-owner-visible string now read from `lineBooking` (+ `species` for the breed fallback); ฿ expressions untouched |
| 4 | `app/line/claim/LineClaimClient.tsx` | every pet-owner-visible string now read from `lineClaim` |
| 5 | `app/line/book/page.tsx` | `generateMetadata()` from the locale cookie; subtitle/badge from the `line` namespace; `<LanguageToggle />` mounted in the header brand row |
| 6 | `app/line/claim/page.tsx` | `generateMetadata()` from the locale cookie; heading/intro from the `line` namespace; `<LanguageToggle />` mounted beside the heading |
| 7 | `lib/line-transport.ts` | `LABELS` map and Flex card text moved to the `lineReport` catalogue; explicit optional `locale: Locale = defaultLocale` on `buildDailyReportFlexMessage` and `sendLineDailyReport` |
| 8 | `lib/integrations.ts` | `buildLineFlexSummary(payload, locale = 'th')` reads `lineReport`; no Thai literal left in the file |
| 9 | `lib/line-worker.ts` | documented note at the `sendLineDailyReport` call site explaining why no locale is passed (no source exists) |
| 10 | `app/i18n/server-translator.ts` | `Namespace` union extended with `'line' \| 'lineBooking' \| 'lineClaim' \| 'lineReport'` (required for `generateMetadata` typecheck) |
| 11 | `docs/house-swarm-5a/WU1B-LINE-SURFACES.md` | this note |

Out of scope by instruction and confirmed untouched: no database schema, no migration, nothing
under `supabase/`.

### 1.1 LanguageToggle placement

- `app/line/book/page.tsx:67` — inside `<header className="liff-header">`, in a flex row with the
  existing `liff-badge`. The header is above the form; the toggle sits in the brand/status area
  and does not overlap or displace any form control.
- `app/line/claim/page.tsx:37` — in a `flex items-start justify-between` row sharing the line with
  the `<h1>`; the form client renders below it.

### 1.2 The locale design decision, implemented exactly as specified

`lib/line-transport.ts` and `lib/integrations.ts` build Thai LINE text on the server and cannot
read a browser cookie; the database has no locale column for the pet owner, and adding one is a
migration, explicitly out of scope for this wave. Therefore:

- every message-building function takes an **explicit optional `locale` parameter defaulting to
  `'th'`**, so Thai remains the behaviour when no locale is supplied and existing callers keep
  working (`lib/line-worker.ts:94` and `tests/phase6_daily_report_line.test.ts:255,260` call it
  with no locale);
- label maps and card text exist in **both** languages under `lineReport` and are selected by that
  parameter;
- **no caller was given an invented locale.** The only caller, `lib/line-worker.ts`
  (`runLineDispatcherBatch`, reached from `app/api/internal/line-dispatch/route.ts`), has **no real
  locale value in hand**: it is a batch worker driven by a `Bearer` secret, not by a pet-owner
  request, and it reads only the claimed DB row (no locale column). It therefore keeps the
  documented Thai default, with a comment recording why. `lib/integrations.ts:buildLineFlexSummary`
  has **no caller at all** in this worktree (`grep` found zero importers), so its default is the
  documented Thai behaviour too.

---

## 2. Per-file table — bytes and sha256

Command: `wc -c < <file>` and `sha256sum <file>` in the same batch (exit 0).

| # | File | Bytes | sha256 |
|---|------|-------|--------|
| 1 | `messages/th.json` | 32807 | `ce2647048398c5463be74240954d3b8a9646ca2a19835fb3067fbd2dfe4e37e8` |
| 2 | `messages/en.json` | 21390 | `8185506d8625b8e9ab762936d064ceb3877c42913d43d9fcece2fcec7f453e69` |
| 3 | `app/line/book/LineBookingClient.tsx` | 22152 | `c42235ed21c853c427c54a00fe0f564e444b033bc5351332718afaddd4263190` |
| 4 | `app/line/claim/LineClaimClient.tsx` | 2809 | `7dd31459b51bff8051d84b4341d8516f73c523228392fe246154df8a051a6dc9` |
| 5 | `app/line/book/page.tsx` | 2791 | `b815d23d0ac58234070bc07b7126016d384ddb61aef2ef16408079c4f2982218` |
| 6 | `app/line/claim/page.tsx` | 1715 | `92b688ef8f1ad8c3600fa2c3a3fb381486ee8069360804d011fcc394cbc4463a` |
| 7 | `lib/line-transport.ts` | 6391 | `6b677e533a47af51a343d99e788ee2a519e240caadde7bb26ff8e64c7ac3232e` |
| 8 | `lib/integrations.ts` | 3305 | `3c163a7d738e57e3231f6abb110e0663e8141803c0cae79eb24350d610e7e412` |
| 9 | `lib/line-worker.ts` | 4076 | `d243407f8324eab8a150f12a1767a1c4c234057e46ef815ffc5da8f3ce86d7e8` |
| 10 | `app/i18n/server-translator.ts` | 1114 | `735e9e21ed34e22e11d5ce4692694d6aae57eaeab64c2928b4115d7e67e8006c` |
| 11 | `docs/house-swarm-5a/WU1B-LINE-SURFACES.md` (this note) | see section 8 | see section 8 |

Inherited and **not** modified by this unit (unchanged hashes confirm it): `package.json`
895 bytes `4f8c9d190eb4a31d518f0ddfec385bd56cbb0d61a9bddc70e98528ab1ed05b6b`;
`pnpm-lock.yaml` 166267 bytes `4cd27c2730c28803f0d64b06f4756650fa3160c8d568c885cb1322e8320aa7db`
— both hashes are identical to the WU-1A table (rows 15–16), i.e. WU-1A's pin is what is on disk
and this unit did not touch either file. `git status` reports them ` M` because WU-1A modified them
relative to `HEAD`.

---

## 3. Command log with exit codes

Every command below was run in this worktree. Exit codes as observed.

| # | Command | Exit | Observed output (abridged) |
|---|---------|------|----------------------------|
| 1 | `git rev-parse HEAD` | 0 | `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a` |
| 2 | `node scripts/check-i18n-parity.mjs` (after catalogue edit) | **0** | `th … 439 keys` / `en … 439 keys` / `TH-only (0)` / `EN-only (0)` / `OK: 439 keys in both languages` |
| 3 | `node scripts/check-i18n-parity.mjs` (final, frozen tree) | **0** | `th … 442 keys` / `en … 442 keys` / `TH-only (0): none` / `EN-only (0): none` / `OK: 442 keys in both languages, 0 missing in either direction.` |
| 4 | `npx tsc --noEmit` | **0** | no diagnostics (only the `npm notice run tsc --noEmit` banner) |
| 5 | `npx eslint app lib scripts` | **0** | no output (only the `npm notice run eslint app lib scripts` banner) |
| 6 | `npx next build` | **0** | `▲ Next.js 16.3.1 (Turbopack)` · `✓ Running next.config.ts took 36ms` · `✓ Compiled successfully in 1962ms` · `Running TypeScript ...` · `Finished TypeScript in 5.7s` · `✓ Generating static pages using 19 workers (13/13) in 816ms` · 16 routes incl. `ƒ /line/book` and `ƒ /line/claim` · `BUILD_EXIT=0` |
| 7 | `grep -rlP '[\x{0E00}-\x{0E7F}]' app lib scripts` + per-file `grep -cP` | 0 | section 5 inventory (LINE surfaces down to ฿ only) |
| 8 | `sha256sum` + `wc -c` over the 10 source files | 0 | section 2 table |
| 9 | `node <scratch>/wu1b-preserve-check.mjs "$LOCALAPPDATA/Temp/wu1b"` | **0** | RESULT: PASS — 23/15/1/1/16/1 HEAD Thai fragments all still present, 0 lost; builders now hold 0 Thai fragments, 0 absent from `th.json`; ฿ expressions 2 and 1 as before |
| 10 | `node <scratch>/wu1b-template-equivalence.mjs "$LOCALAPPDATA/Temp/wu1b"` | **0** | RESULT: PASS — 18/18 mappings; e.g. `lineReport.foodStatus.finished` == HEAD `"กินหมด"`, `lineReport.ownerLine` == HEAD `` `ถึง ${job.ownerName || "เจ้าของน้อง"}` `` (placeholders normalised), `lineReport.updatePrefix`/`flexSummaryTitle` == HEAD integrations literals |
| 11 | `bash <scratch>/wu1b-live-check.sh` (`next start -p 4321` + `curl` with `pawspace_locale=en`/`th`/no cookie) | **0** | RESULT: PASS — 17/17 assertions; `bytes: en_book=9723 th_book=9709 en_claim=9447 th_claim=9389 nocookie_claim=9389`; `<title>Book a room \| PawSpace</title>` vs `จองห้องพัก \| PawSpace`; `Connect LINE to PawSpace` vs `เชื่อม LINE กับ PawSpace`; `data-testid="language-toggle"` present in all four responses; no-cookie → Thai |
| 12 | `npx --yes tsx@4.20.6 <scratch>/wu1b-builder-runtime.mts` | **0** | section 4 |
| 13 | `node <scratch>/wu1b-keycount.mjs messages/th.json messages/en.json` | 0 | per-namespace counts (section 4) |
| 14 | `git status --porcelain -- supabase tests package.json pnpm-lock.yaml .github relay .env .env.local .secrets` | 0 | only ` M package.json` / ` M pnpm-lock.yaml` (WU-1A's, unchanged by me); **no `supabase`, `tests`, `.github` or `relay` entry** |
| 15 | `git diff --name-only -- supabase tests .github relay` | 0 | *empty* |
| 16 | `test ! -e .env && test ! -e .env.local` | 0 | `no .env` / `no .env.local` |
| 17 | `git diff --stat` | 0 | 13 files changed, `448 insertions(+), 296 deletions(-)` — includes WU-1A's 6 surfaces; this unit's own deltas: LineBookingClient 112, book/page 35, claim/page 31, LineClaimClient 20, integrations 18, line-transport 64, line-worker 4 |

Two shell invocations were **refused by the runtime and not executed** (reported for honesty, no
effect on the tree): one `node -e` catalogue-inspection one-liner (blocked as script execution via
`-e`), and one oversized combined `grep` one-liner (blocked as malformed payload). Both were
replaced with file reads / smaller separate commands; the results they would have produced are
present in sections 2, 4 and 5 from those replacements.

---

## 4. Key count, parity, and runtime locale selection

### 4.1 Parity output (gate #7, item 3 — exit 0)

```
i18n key parity check
  th: messages\th.json — 442 keys
  en: messages\en.json — 442 keys
TH-only keys (0): none
EN-only keys (0): none
OK: 442 keys in both languages, 0 missing in either direction.
```

### 4.2 Per-namespace key counts (identical in both files)

```
meta 2 · common 4 · brand 1 · roles 2 · roomTypes 4 · roomStatus 4 · species 14 ·
dailyReport 13 · login 7 · invite 10 · dashboard 46 · onboarding 105 ·
line 6 · lineBooking 46 · lineClaim 8 · lineReport 18 · operations 152
new namespace keys added = 78
WU-1A baseline = 364, now = 442, delta = +78
```

The 364 pre-existing keys are all still present: 442 − 78 = 364, and the parity gate reports 0
missing in either direction. No existing key was removed, renamed or reworded.

| New namespace | Keys |
|---------------|------|
| `line` | 6 (`brandSubtitle`, `bookingBadge`, `claimTitle`, `claimIntro`, `bookingMetaTitle`, `claimMetaTitle`) |
| `lineBooking` | 46 |
| `lineClaim` | 8 |
| `lineReport` | 18 |

### 4.3 Runtime proof that `locale` selects the language (item 12, exit 0)

Real calls into the real modules:

```
[th] dailyReport altText="อัปเดตจาก PawSpace · Milo"
[th] dailyReport body=["อัปเดตจาก PawSpace · Milo","ถึง Ann","อาหาร","กินหมด","ขับถ่าย","ปกติ","อารมณ์","อารมณ์ดี"]
[th] flexSummary altText="อัปเดตจาก PawSpace · Milo"
[en] dailyReport altText="Update from PawSpace · Milo"
[en] dailyReport body=["Update from PawSpace · Milo","To Ann","Food","Ate everything","Excretion","Normal","Mood","In a good mood"]
[en] flexSummary altText="Update from PawSpace · Milo"
[default] dailyReport altText="อัปเดตจาก PawSpace · Milo"
[unknown 'xx'] dailyReport altText="อัปเดตจาก PawSpace · Milo"
[unknown status] ["Update from PawSpace · Milo","To Ann","Food","weird_value","Excretion","Normal","Mood","In a good mood"]
[pushed with locale=en] Update from PawSpace · Milo
[pushed with default] อัปเดตจาก PawSpace · Milo
```

This shows: the parameter selects the language; omitting it reproduces the exact previous Thai
output; an unrecognised locale falls back to the Thai default; an unrecognised status enum still
falls through to the raw value (previous behaviour preserved); and the value actually reaches the
LINE push payload through `sendLineDailyReport`.

### 4.4 Thai wording preservation (items 9 and 10, both exit 0)

- Every Thai text fragment in the six HEAD files is still present somewhere in the post-change
  tree (component or catalogue): booking client 23/23, claim client 15/15, book page 1/1, claim
  page 1/1, line-transport 16/16, integrations 1/1 — **0 lost**.
- `lib/line-transport.ts` and `lib/integrations.ts` now contain **0** Thai fragments, and every one
  of their former Thai fragments is **verbatim in `messages/th.json`**.
- All 18 label/template mappings are equivalent to the HEAD literals after normalising runtime
  expressions vs catalogue placeholders, so the Thai default renders byte-identical text.
- The ฿ marker and both number expressions are unchanged in the booking client:
  `฿{totalEstimatedPrice.toLocaleString()}` ×2 and `฿{room.basePricePerNight.toLocaleString()}` ×1.

No existing Thai wording was softened, embellished or added to.

---

## 5. Pet-owner-visible strings that could NOT be made locale-driven

### 5.1 `lib/line-transport.ts` — the LABELS map keys (the enum *values*, not the labels)

The **labels** are fully bilingual (`lineReport.foodStatus|excretionStatus|moodStatus`). What
remains language-independent is the enum value itself (`finished`, `half`, `little`, `refused`,
`normal`, `diarrhea`, `none`, `happy`, `calm`, `stressed`): it arrives from the database row
(`ClaimRow.food_status` etc., `lib/line-worker.ts:11-13`) and is the contract key used to select
the label. It is never displayed — it is only looked up, and still falls through to the raw value
if unknown. Correctly not translated.

### 5.2 `lib/integrations.ts` — `payload.message`

`buildLineFlexSummary` renders `payload.message` verbatim (`lib/integrations.ts:71` in this
worktree). That string is **caller-supplied data**; it is not a literal in the module, so there is
nothing to translate here. Wherever it is produced (the Daily Report staff-note path), it is either
owner-entered free text or supplied by a future caller. **No caller of `buildLineFlexSummary`
exists in this worktree**, so no such path was in reach of this unit. Recorded, not resolved.

### 5.3 `lib/csv-import-service.ts` (39 Thai lines) — deliberately exempt, not a gap

Pre-existing and untouched by this unit. These are Thai CSV **header aliases**
(`"ชื่อสัตว์": "petName"`) and Thai **enum input values** accepted by import
(`["dog","dogs","canine","สุนัข","หมา","น้องหมา"]`). They are machine-facing parsing keys, never
rendered to a reader; translating them would break import of a Thai spreadsheet produced outside
the app. Exempt by the policy rule (UI text, not developer-facing/data keys).

### 5.4 `app/camera/[shopSlug]/camera-access-client.tsx` (8 Thai lines) — outside this unit

A pet-owner-visible surface with hardcoded Thai, and **not** one of the surfaces this work unit was
authorised to change (the unit names the booking client/page, the claim client/page, and the two
server builders). It is reported here so the gap is not lost: **8 Thai lines remain**, and the
LanguageToggle is not mounted there, unlike the two LINE pages. Not fixed because the unit's
acceptance checks do not cover it and no authorisation was given to extend to the camera surface.
Recommendation for the Owner/commander: a follow-up unit on the same pattern.

### 5.5 `app/components/language-toggle.tsx` (2 Thai lines) — deliberately bilingual control text

Pre-existing and untouched. `th: { short: 'TH', native: 'ไทย' }` and
`` `สลับภาษาเป็น ${next.native} / Switch language to ${next.native}` `` describe the language being
switched **to**, in that language **and** in Thai at once. A catalogue lookup would be circular: it
would have to be keyed in the language being switched away from. Correctly exempt.

### 5.6 The ฿ currency marker and all numbers — kept exactly as-is

By instruction. `฿` plus `toLocaleString()` output (and the `{nights}`/`{capacity}`/`{count}`
counts) are unchanged; only the surrounding words moved to the catalogue. Note for the Owner: the
number formatting itself uses `Number.prototype.toLocaleString()` without a locale argument, so it
follows the **runtime** locale, not the UI locale. That is pre-existing behaviour this unit
deliberately did not alter (changing it would change rendered numbers).

---

## 6. Decision needed from the Owner

### (a) The stored recipient-locale source for server-side LINE messages

**Required decision.** Today the Daily Report that a pet owner receives from the LINE worker is
built with the documented Thai default, because there is no stored locale for that owner.

- `lib/line-worker.ts` (`runLineDispatcherBatch`) is invoked from
  `app/api/internal/line-dispatch/route.ts` with a `Bearer` secret — there is **no pet-owner
  request and no cookie** at that point.
- The claimed job row carries `recipient_line_user_id`, `pet_name`, `owner_name`, status fields and
  photos, but **no locale**.
- `app/api/line/claim/route.ts` — the server route that knows the pet owner's LINE identity — *does*
  have a real request context, but it is a `POST` from the LIFF client that today sends only
  `{claimToken, idToken, expectedShopId}`; adding a locale field there is a **product/API decision**,
  not an implementation detail.
- Storing the owner's language would need a column on the owner/claim record: a **migration**, which
  this wave explicitly excludes.

Options for the Owner (this unit implemented none of them, by instruction):
1. add a pet-owner locale column and persist it at claim time (schema change, later wave);
2. accept a `locale` field in the claim API request body and resolve it once at claim time;
3. derive it per shop/tenant;
4. accept Thai as the standing behaviour for pushed reports.

Until one of these is chosen, the Thai default is the honest behaviour and is recorded as such.

### (b) Other findings that need a schema or product decision

1. **`roomTypes` cannot be keyed from the database value.** The catalogue has
   `roomTypes.standard|deluxe|vip|catCondo`, but the DB contract is
   `room_type IN ('standard','deluxe','vip','cat_condo')` (`docs/SYSTEM_ARCHITECTURE.md:177`,
   `lib/operations-service.ts:10`). `cat_condo` ≠ `catCondo`, so a lookup built on the raw value
   misses. The booking surface renders `{room.roomType}` directly — i.e. the raw DB value
   ("cat_condo") — which is a **pre-existing** display gap (the owner/staff surfaces use hardcoded
   English maps / hardcoded `<option>` labels instead). Decision needed: add an alias key, normalise
   the value, or change the constraint. A schema-adjacent choice, so it is the Owner's.
2. **`roomType` is not localized anywhere yet** — `app/operations-client.tsx:29` holds a hardcoded
   English `roomTypeLabel` map and `app/onboarding/OnboardingClient.tsx:579-581` hardcodes
   `<option>Deluxe</option>` etc. Pre-existing, outside this unit's scope, but it means the
   `roomTypes` namespace added by WU-1A is currently unused.
3. **The camera surface** (5.4): whether to bring `app/camera/[shopSlug]/camera-access-client.tsx`
   into the bilingual system, and mount the LanguageToggle there.
4. **`lib/integrations.ts` has no caller.** `buildLineFlexSummary` and `sendDailyReport` are
   unreachable in this worktree (its own messages say "intentionally not called from the preview
   adapter"). Decision needed: is this module live, dead, or awaiting a caller? If live, its Thai
   default is what a pet owner will see until decision (a) is made.

---

## 7. Scope and safety statement

- No database, migration, schema, deploy, secret or git write was performed. No commit, no push, no
  branch change, no `git checkout`, no `git reset`, no `git clean`, no `git stash`.
  `git rev-parse HEAD` is unchanged at `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a`.
- No file was created or modified under `supabase/`, `tests/`, `.github/` or `relay/`
  (`git diff --name-only` for those paths is empty; `git status --porcelain` lists no such entry).
- `package.json` and `pnpm-lock.yaml` were not modified by this unit; their on-disk hashes equal the
  WU-1A table values.
- No `.env`, `.env.local`, `.env.staging.local` or `.secrets` file was created, read or modified; no
  credential appears in this note. No `node_modules` or `.next` file was hand-edited.
- Files written inside the repository by this unit: the 10 source files in section 2 plus this note.
- Scratch files created **outside** the repository (not product artifacts):
  `$LOCALAPPDATA/Temp/wu1b/orig-*.{ts,tsx}` (HEAD copies for the preservation checks) and, in the
  agent workspace, `wu1b-preserve-check.mjs`, `wu1b-template-equivalence.mjs`, `wu1b-live-check.sh`,
  `wu1b-builder-runtime.mts`, `wu1b-keycount.mjs`. `npx tsx@4.20.6` was fetched by npx into the npx
  cache only; `package.json`/`pnpm-lock.yaml` are provably unchanged.
- The local `next start -p 4321` used for the live check was started and killed within this session;
  no deploy and no external network call to LINE was made (the push runtime test used an injected
  `fetch` stub).

---

## 8. Evidence-note self-referential record

| Item | Value |
|------|-------|
| Note path | `docs/house-swarm-5a/WU1B-LINE-SURFACES.md` |
| Note state at creation (heading only, before implementation) | 2191 bytes, `a959f2e0cde162c3d5529a425193219b36e1fb605373294fddf58a5a8df9ee0d` |
| Note bytes and sha256 | Self-referential: the note cannot carry its own final hash (writing the value would change it). Bytes after the last content-determining write: **23223**. The definitive final byte count and sha256 are given in the WU1B work-unit report that accompanies this note, hashed after this row was last written. |

The note was created first, before any implementation step, so the deliverable exists independently
of the code; sections 1–6 were then filled from the raw command output in section 3.

Every claim in this note is paired with the command that produced it. Where a value was not
observed by this unit it is marked as such; nothing here is an approval of this work. The commander
verifies.
