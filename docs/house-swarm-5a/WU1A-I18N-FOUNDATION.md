# HOUSE-SWARM-5A · WU1A-I18N-FOUNDATION — bilingual (TH/EN) UI foundation for PS01 (PawSpace)

Work unit: `H5A-WU1A-I18N-FOUNDATION`
Correlation id: `house-swarm-5a-wu1a-20260927`
Role class: implementation (lane `h5a-wu1a`)
Workspace: `D:/AI-Workspace/runtime/worktrees/house-swarm-5a`
Revision at session start: `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a`
Revision when this evidence note was completed: `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a` (unchanged)
Status of this document: COMPLETE (evidence note finished by work unit `H5A-WU1A-NOTE`, role class evidence_preparation)
Note author of this completion pass: `H5A-WU1A-NOTE` — evidence preparation only; **no source file was edited in this pass**.
No self-approval: this note is a normalised record. The commander verifies.

This document was created first, before any implementation step, so the deliverable exists
independent of the code. Every claim below is paired with the raw command that produced it.
Sections 1–5 and 7–8 are reported by the implementation lane and re-observed mechanically by
this note lane; section 6 separates what the commander verified from what remained self-reported.

Reuse basis: `docs/house-swarm-5a/WU0-PREFLIGHT-REUSE.md` classifies the bilingual-UI capability
as `USE + ADAPT` against the proven BK01 `next-intl` pattern
(`products/booking/apps/booking-admin/src/i18n/*`, `messages/{th,en}.json`,
`src/components/language-toggle.tsx`, `src/app/layout.tsx`). This unit copies the *pattern* and
adapts it in PS01-owned paths; no file is imported across repositories and no BK01 message key
set is inherited.

Standing policy applied: `D:/AI-Workspace/projects/saas-product-hub/docs/platform/I18N_POLICY.md`
— "This applies to product UI text (labels, buttons, messages, emails/notifications a customer
sees) — not to internal code comments, commit messages, or developer-facing docs."

---

## Step log

### 1. What WU-1A delivered

Delivered, as re-observed in this pass:

1. `next-intl` pinned at `4.13.7`.
   - `grep -n 'next-intl' package.json` → `18:    "next-intl": "4.13.7",`
   - `grep -n 'next-intl' pnpm-lock.yaml` → importer `26:      next-intl:`, package entry
     `1947:  next-intl@4.13.7:`, snapshot
     `4317:  next-intl@4.13.7(@swc/helpers@0.5.23)(@types/react@19.2.18)(next@16.3.1(...))(react@19.2.8)(typescript@5.9.3):`
2. i18n runtime modules (all new, under `app/i18n/`):
   `app/i18n/config.ts` (locales `th|en`, `defaultLocale = 'th'`, cookie name
   `pawspace_locale`, `isLocale`/`resolveLocale`), `app/i18n/locale-provider.tsx`
   (client `I18nProvider` + `useLocaleSwitcher`, cookie + localStorage persistence,
   sets `document.documentElement.lang`), `app/i18n/messages.ts` (catalogue loader),
   `app/i18n/server-translator.ts` (`getServerTranslator(locale, namespace)` with an
   explicit `Namespace` union).
3. `app/components/language-toggle.tsx` — the single switch button
   (`data-testid="language-toggle"`), rendered on `app/login/page.tsx:51` and
   `app/onboarding/OnboardingClient.tsx:214` (and as `LanguageToggle` inside
   `app/operations-client.tsx` header actions, line 109).
4. `messages/th.json` and `messages/en.json` at **364 keys each, zero missing in either
   direction** (mechanical proof in section 3, negative control in section 4).
5. Root layout made async and locale-driven: `app/layout.tsx` — `generateMetadata()` and the
   default export are both `async`, both read the locale cookie via `await cookies()`
   (`app/layout.tsx:10,21`), `<html lang={locale}>`, and children are wrapped in
   `<I18nProvider initialLocale={locale}>`.
6. Owner/staff surfaces served from the catalogues (each claim paired to a `grep` line):
   - `app/operations-client.tsx` — `useTranslations` for `operations`, `roomStatus`,
     `species`, `dailyReport`, `roles` (lines 33–37), `LanguageToggle` at line 109.
   - `app/login/page.tsx` — `useTranslations` for `login`, `common`, `brand` (lines 11–13),
     `LanguageToggle` at line 51.
   - `app/dashboard/page.tsx` — `getServerTranslator(locale, 'dashboard')` (lines 22–23),
     locale resolved from the cookie.
   - `app/onboarding/OnboardingClient.tsx` — `useTranslations('onboarding')` (line 37),
     `LanguageToggle` at line 214.
   - `app/auth/accept-invite/page.tsx` — `useTranslations` for `invite`, `common` (lines 12–13).

Not delivered in WU-1A (honest scope statement): the LINE/owner-facing surfaces named as the
highest priority in the brief — `app/line/book/LineBookingClient.tsx`, `app/line/book/page.tsx`,
`app/line/claim/LineClaimClient.tsx`, `app/line/claim/page.tsx`,
`app/camera/[shopSlug]/camera-access-client.tsx` — and the LINE push templates in `lib/`.
See section 5 for the full inventory.

### 2. Per-file table — bytes and sha256

Command:

```
sha256sum app/i18n/config.ts app/i18n/locale-provider.tsx app/i18n/messages.ts \
  app/i18n/server-translator.ts app/components/language-toggle.tsx messages/th.json \
  messages/en.json scripts/check-i18n-parity.mjs app/layout.tsx app/operations-client.tsx \
  app/login/page.tsx app/dashboard/page.tsx app/onboarding/OnboardingClient.tsx \
  app/auth/accept-invite/page.tsx package.json pnpm-lock.yaml
```

Byte counts produced by `wc -c < <file>` in the same batch. Exit code 0.

| # | File | Bytes | sha256 |
|---|------|-------|--------|
| 1 | `app/i18n/config.ts` | 433 | `a91044ab7a00c98680b56dae7d9d2aca39eae59b5e55ecdce47264219fdf15a6` |
| 2 | `app/i18n/locale-provider.tsx` | 1908 | `5b65514dae59809408605c3defbc19bcf7cea6beb5fc032aee4c1cb8f1d59345` |
| 3 | `app/i18n/messages.ts` | 320 | `750f54373854b6317ad7c528bb48ea15c1d1689b2d833c5cec125f674e712f3e` |
| 4 | `app/i18n/server-translator.ts` | 1052 | `8e38b190b8413d016f97b410372fe15843b9b0aefd63d5a258e09a07b793752a` |
| 5 | `app/components/language-toggle.tsx` | 975 | `0ba653fc65c3745f531da43ab7af1f9e79bc8e8d89622d4e4af9333f4648623c` |
| 6 | `messages/th.json` | 25106 | `ae758a6138a4abd254f66a2e90f7465acede45d7d9985b4413d07cdebe44b5e5` |
| 7 | `messages/en.json` | 16752 | `842d16de292d61df30a34ce232b0f03a39ff4a66012a14081c1f1ac9a30f3094` |
| 8 | `scripts/check-i18n-parity.mjs` | 2873 | `f639c9d9d90df57a70cf1d0e4b464b202eb59552418aa6128d975501be756531` |
| 9 | `app/layout.tsx` | 988 | `5f67f2e70afb60720537b7095a3e59403d0b1088776fa1c9950d863ad5fb77df` |
| 10 | `app/operations-client.tsx` | 35276 | `eb51839a7e705112ddacbf00df4e5e2b568131c2d6cf88ac340f89e212bb6dae` |
| 11 | `app/login/page.tsx` | 3103 | `3d742ff38ceb14b4ddf5e9414584452df3902a2019104cee0a63d409c13fce62` |
| 12 | `app/dashboard/page.tsx` | 7301 | `d5261b327a56fc8a06d961324c3c731168846bddffb48a3d053dc1969becfcc1` |
| 13 | `app/onboarding/OnboardingClient.tsx` | 34286 | `9c4d90d0fe697fc9974e256168cda8759a927f5e410c993f00fe6e84bc384f8a` |
| 14 | `app/auth/accept-invite/page.tsx` | 5522 | `0594141db578d9ed691ec04d7d4936d7af96562d1696d8027dfbe98056e18587` |
| 15 | `package.json` | 895 | `4f8c9d190eb4a31d518f0ddfec385bd56cbb0d61a9bddc70e98528ab1ed05b6b` |
| 16 | `pnpm-lock.yaml` | 166267 | `4cd27c2730c28803f0d64b06f4756650fa3160c8d568c885cb1322e8320aa7db` |

Three rows were independently confirmed by the commander's own mutation observation in the
lane record (`dispatch-wu1a.log`): `app/layout.tsx` before `3f621976…` → after `5f67f2e7…`,
`app/operations-client.tsx` before `8890ce43…` → after `eb51839a…`,
`app/login/page.tsx` before `b8afe955…` → after `3d742ff3…`. Those after-hashes match rows 9–11
above.

### 3. Command log with exit codes

Commands run in this note-completion pass (a fresh batch; exit codes as observed, exit 0 unless
stated). The `export PATH=…` prefix mirrors the commander's own invocation shape so `npx`
resolves the repo's binaries.

| # | Command | Exit | Observed output (abridged) |
|---|---------|------|----------------------------|
| 1 | `git rev-parse HEAD` | 0 | `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a` |
| 2 | `git rev-parse --abbrev-ref HEAD` | 0 | `codex/house-swarm-5a-20260926` |
| 3 | `git status --porcelain` | 0 | 8 modified + 5 untracked (see section 9) |
| 4 | `git diff --stat` | 0 | 8 files, `679 insertions(+), 209 deletions(-)` |
| 5 | `wc -c < <each of the 16 files>` | 0 | byte counts in the section 2 table |
| 6 | `sha256sum <the 16 files>` | 0 | hashes in the section 2 table |
| 7 | `node scripts/check-i18n-parity.mjs` | **0** | `th: messages\th.json — 364 keys` / `en: messages\en.json — 364 keys` / `TH-only keys (0): none` / `EN-only keys (0): none` / `OK: 364 keys in both languages, 0 missing in either direction.` |
| 8 | `node scripts/check-i18n-parity.mjs <scratch>/th.json <scratch>/en.json` (negative control) | **1** | see section 4 |
| 9 | `npx tsc --noEmit` | **0** | no output |
| 10 | `npx eslint app lib scripts` | **0** | no output |
| 11 | `npx next build` | **0** | `▲ Next.js 16.3.1 (Turbopack)` · `✓ Compiled successfully in 583ms` · `Finished TypeScript in 1451ms` · `✓ Generating static pages using 19 workers (13/13) in 771ms` · 16 routes emitted |
| 12 | `pnpm install --frozen-lockfile` | **0** | `Already up to date` / `Done in 291ms using pnpm v11.21.0` |
| 13 | `pnpm --version` | 0 | `11.21.0` |
| 14 | `grep -n 'next-intl' package.json pnpm-lock.yaml` | 0 | `package.json:18:    "next-intl": "4.13.7",` etc. (section 1) |
| 15 | `grep -n "useTranslations\|getServerTranslator\|LanguageToggle…" <surfaces>` | 0 | wiring lines (section 1 item 6) |
| 16 | `grep -rlP '[\x{0E00}-\x{0E7F}]' app lib scripts …` + per-file `grep -cP` | 0 | section 5 inventory |
| 17 | `git status --porcelain pnpm-workspace.yaml` | 0 | *empty* → file unmodified in the worktree |
| 18 | `git cat-file -s HEAD:pnpm-workspace.yaml` | 0 | `51` bytes |
| 19 | `git diff --name-only -- supabase .github tests .git relay .env .env.local .secrets` | 0 | *empty* → no prohibited-scope change |
| 20 | `test ! -e .env && test ! -e .env.local` | 0 | `no .env` / `no .env.local` |

`npx next build` and `npx tsc --noEmit`/`npx eslint` in items 9–11 were run by this note lane
AFTER the parity and negative-control work; the build result is the same route table and exit 0
that the commander's own `build` check recorded in `dispatch-wu1a.log`.

Not re-run in this pass and therefore reported as lane/commander evidence, not fresh evidence:
`pnpm add next-intl@4.13.7` (recorded exit 1, see section 7).

### 4. Negative control — parity gate fails when it should

Rule: **the real catalogue files were never modified for the test.** Only copies in a scratch
directory outside the repository were mutated.

Scratch directory: `C:/Users/Win11/AppData/Local/Temp/wu1a-negctl/` (outside the worktree).
Mutator: `C:/Users/Win11/AppData/Local/Temp/wu1a-negctl/mutate-negctl.mjs` (a scratch helper,
not a repo file; it refuses any path not containing `wu1a-negctl`).

```
cp messages/th.json "$LOCALAPPDATA/Temp/wu1a-negctl/th.json"
cp messages/en.json "$LOCALAPPDATA/Temp/wu1a-negctl/en.json"
sha256sum "$LOCALAPPDATA/Temp/wu1a-negctl/th.json" "$LOCALAPPDATA/Temp/wu1a-negctl/en.json"
# pre-mutation copies: ae758a61… (th, identical to the real th.json)
#                     842d16de… (en, identical to the real en.json)
node "$LOCALAPPDATA/Temp/wu1a-negctl/mutate-negctl.mjs" "$LOCALAPPDATA/Temp/wu1a-negctl/th.json" "$LOCALAPPDATA/Temp/wu1a-negctl/en.json"
# exit 0
#   mutated th copy: DELETED leaf key "brand.caption"
#   mutated en copy: ADDED top-level key "negControlProbe"
node scripts/check-i18n-parity.mjs "$LOCALAPPDATA/Temp/wu1a-negctl/th.json" "$LOCALAPPDATA/Temp/wu1a-negctl/en.json"
# exit 1
sha256sum messages/th.json messages/en.json
# real files AFTER the control: ae758a61… / 842d16de… (identically unchanged)
git status --porcelain
# same 13 entries as before the control — nothing added, nothing modified by it
```

Full observed output of both negative-control runs (exit code 1 each time it is invoked with
mismatched copies):

Run A — copies mutated (one key deleted from the th copy, one key added to the en copy):

```
i18n key parity check
  th: C:\Users\Win11\AppData\Local\Temp\wu1a-negctl\th.json — 363 keys
  en: C:\Users\Win11\AppData\Local\Temp\wu1a-negctl\en.json — 365 keys
TH-only keys (0): none
EN-only keys (2):
  - brand.caption
  - negControlProbe
FAIL: 0 th-only + 2 en-only keys — both languages must have identical keys.
NEGCTL_EXIT=1
```

Run B — recorded by the previous lane in `dispatch-wu1a.log` (line 121) on a real-file copy with
a first backup, and restored immediately:

```
en — 363 keys
TH-only keys (1): common.languageEn
FAIL: 1 th-only + 0 en-only keys
-> exit 1
restored: cp "$LOCALAPPDATA/Temp/i18n-negctl/en.real-backup.json" messages/en.json
sha256sum messages/en.json -> 842d16de292d61df30a34ce232b0f03a39ff4a66012a14081c1f1ac9a30f3094
```

Proof the real catalogues were untouched, using the hashes in section 2:

- `messages/th.json` before the control, after the control, and in the section 2 table:
  `ae758a6138a4abd254f66a2e90f7465acede45d7d9985b4413d07cdebe44b5e5` — identical.
- `messages/en.json` before the control, after the control, and in the section 2 table:
  `842d16de292d61df30a34ce232b0f03a39ff4a66012a14081c1f1ac9a30f3094` — identical.
- `git status --porcelain` before and after the control lists the same 13 entries; the control
  added no untracked file and modified no tracked file inside the repo.

Mutated copies are left in the scratch directory for inspection:
`th.json` = `74d4adb395e61df34646f1b5bf37dc227252d7778301fe92818935068aacb187` (25065 bytes),
`en.json` = `a8dd01cadce812fc174aaaf762982d2172d381545ce5c02651cd2324c9de75f3` (16805 bytes).

The gate is therefore demonstrated to be able to fail: exit 0 on the real files is not vacuous.

### 5. Untranslated-text inventory (Thai outside `messages/`)

Command: `grep -rlP '[\x{0E00}-\x{0E7F}]' app lib scripts --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.js'`,
then `grep -cP` per file. Exit 0.

| File | Thai lines outside the catalogue | Classification |
|------|----------------------------------|----------------|
| `app/operations-client.tsx` | 0 | owner/staff surface — fully moved to `messages/{th,en}.json` by WU-1A |
| `app/login/page.tsx` | 0 | owner/staff surface — fully moved |
| `app/dashboard/page.tsx` | 0 | owner/staff surface — fully moved |
| `app/onboarding/OnboardingClient.tsx` | 0 | owner/staff surface — fully moved |
| `app/auth/accept-invite/page.tsx` | 0 | owner/staff surface — fully moved |
| `app/layout.tsx` | 0 | locale wiring only |
| `app/i18n/config.ts`, `messages.ts`, `server-translator.ts`, `locale-provider.tsx` | 0 | locale machinery, no user strings |
| `app/components/language-toggle.tsx` | 2 | **deliberate**, self-identifying bilingual control text: line 8 `th: { short: 'TH', native: 'ไทย' }` (native language names) and line 20 `` const label = `สลับภาษาเป็น ${next.native} / Switch language to ${next.native}` `` — the toggle must describe the language it switches TO in that language and in both languages at once; a catalogue lookup would be circular (it cannot be keyed in the language being switched away from). |
| `app/line/book/LineBookingClient.tsx` | 44 | **NOT translated — owner/customer facing. Leftover gap.** |
| `app/line/book/page.tsx` | 2 | **NOT translated — owner/customer facing. Leftover gap.** (`title: "จองห้องพัก \| PawSpace"`, `<p>ระบบจองห้องพักสัตว์เลี้ยง</p>`) |
| `app/line/claim/LineClaimClient.tsx` | 8 | **NOT translated — owner/customer facing. Leftover gap.** |
| `app/line/claim/page.tsx` | 3 | **NOT translated — owner/customer facing. Leftover gap.** (`title: "เชื่อม LINE \| PawSpace"`, `<h1>เชื่อม LINE กับ PawSpace</h1>`, `<p>ยืนยันบัญชี LINE เพื่อรับ Daily Care Report จากร้าน</p>`) |
| `app/camera/[shopSlug]/camera-access-client.tsx` | 8 | **NOT translated — owner/customer facing. Leftover gap.** |
| `lib/line-transport.ts` | 9 | **NOT translated — outgoing to the pet owner via LINE.** Lines 24–26 map status enums to Thai labels (`finished: "กินหมด"` …), lines 51–55 build the push message (`อัปเดตจาก PawSpace · …`, `ถึง …`, `อาหาร`, `ขับถ่าย`, `อารมณ์`), line 79 `altText`. |
| `lib/integrations.ts` | 2 | **NOT translated — outgoing to the pet owner.** Line 62 `altText`, line 69 `"อัปเดตจาก PawSpace"`. |
| `lib/csv-import-service.ts` | 39 | **Deliberately not translated — machine-facing compatibility data, not UI copy.** These are Thai *CSV header aliases* (lines 70–148, e.g. `"ชื่อสัตว์": "petName"`) and Thai *enum input values* accepted by import (lines 176–197, e.g. `["dog","dogs","canine","สุนัข","หมา","น้องหมา"]`). Translating them would break import of a Thai spreadsheet produced outside the app; they are parsing keys, never rendered to a reader. Exempt by the policy rule (see `I18N_POLICY.md` line 11: UI text, "not to internal code comments … or developer-facing docs") and by the plan rule that developer-facing, non-rendered strings are exempt. |

Totals: 117 Thai lines remain in `app` + `lib` + `scripts` outside `messages/`; the catalogue
`messages/th.json` holds 312 Thai lines / 364 keys. `git status --porcelain lib` is **empty**:
WU-1A did not touch `lib/` at all.

Honest summary of the inventory:

- **Deliberately untranslated and correct to leave**: `app/components/language-toggle.tsx` (2
  lines, bilingual self-describing control) and `lib/csv-import-service.ts` (39 lines,
  machine-facing CSV header aliases and enum input values, never rendered).
- **Owner/staff/customer-facing strings left hardcoded — reported as a real gap, not exempt**:
  `app/line/book/LineBookingClient.tsx` (44), `app/line/claim/LineClaimClient.tsx` (8),
  `app/line/claim/page.tsx` (3), `app/line/book/page.tsx` (2),
  `app/camera/[shopSlug]/camera-access-client.tsx` (8), `lib/line-transport.ts` (9),
  `lib/integrations.ts` (2) — 76 lines in total. `lib/line-transport.ts` and
  `lib/integrations.ts` push Thai text to pet owners through LINE; the brief names the LINE
  surfaces as the most important ones. These are hardcoded and not locale-driven.
- The five owner/staff surfaces this work unit *did* claim (`operations-client`, `login`,
  `dashboard`, `OnboardingClient`, `accept-invite`) contain **zero** Thai outside the catalogue.

### 6. Honesty section — mechanical verification vs. earlier self-report

Verified mechanically in this pass (commands in section 3, on revision `c5980ebf…`):

- Parity gate on the real catalogues → exit 0, 364/364 keys, 0 missing either direction.
- Parity gate on mutated scratch copies → exit 1 with both key lists printed.
- Real catalogue hashes unchanged before/after the negative control.
- `npx tsc --noEmit` → 0; `npx eslint app lib scripts` → 0; `npx next build` → 0.
- `pnpm install --frozen-lockfile` → 0; lockfile/`package.json` hashes unchanged by it.
- `next-intl` pinned `4.13.7` in both `package.json` and `pnpm-lock.yaml`.
- Per-file bytes + sha256 for all 16 files in the declared list (section 2).
- `git status --porcelain` unchanged, HEAD unchanged, no `.env`/`.env.local`,
  no diff under `supabase`, `.github`, `tests`, `.git` or `relay`.

Also mechanically verified, by the commander, in `dispatch-wu1a.log` (records, not this lane's
assertion): artifact presence, parity-zero, next-intl pin, typecheck, lint, build, no-env-file,
no-supabase-mutation, head-unchanged, and observed before/after mutations of `package.json`,
`pnpm-lock.yaml`, `app/layout.tsx`, `app/operations-client.tsx`, `app/login/page.tsx`.

Still only self-reported (not independently reproduced in this pass):

- The HTTP live check of the toggle (Thai and English rendering over HTTP) claimed by the
  implementation lane. This pass verified the wiring statically and with a successful
  production build, not by serving the app and toggling it.
- The baseline "before" runs and the earlier Thai inventory counts quoted in
  `dispatch-wu1a.log` line 121.
- The "restored after negative control B" step of the previous lane, which is corroborated
  here only by the fact that `messages/en.json` now hashes to the same value it has in this
  pass's section 2 table.

Correction to the previous lane's record, made from direct observation: the lane report at
`dispatch-wu1a.log` line 121 states the pre-existing string counts as "operations-client Thai
lines 269…". A line-by-line Thai scan of the current `app/operations-client.tsx` finds **0**
Thai lines remaining, and `git diff --stat` shows the file at 161 changed lines. The 269 figure
is not reproducible against the current tree and is reported here as an unverified historical
claim; the current, reproducible count is 0.

No approval is implied by any line of this note. `docs/house-swarm-5a/WU1A-I18N-FOUNDATION.md`
itself is an artifact of the declared work unit, not an approval of it.

### 7. Known issues carried from the previous lane

1. **`pnpm add next-intl@4.13.7` itself exits 1** with `[ERR_PNPM_IGNORED_BUILDS] Ignored build
   scripts: @parcel/watcher@2.6.0, @swc/core@1.15.47`, while the dependency is correctly pinned:
   `package.json:18 "next-intl": "4.13.7"`, and the lockfile carries `next-intl@4.13.7` at
   package entry 1947 and snapshot 4317, with the importer specifier `26:      next-intl:`.
   `pnpm install --frozen-lockfile` exits **0** (`Already up to date`, 291ms, pnpm v11.21.0) —
   re-run in this pass. So the install step cannot be reported as a clean exit-0 command, but
   the dependency state itself is consistent and frozen-lockfile-clean.
2. **`pnpm-workspace.yaml` gained two "set this to true or false" placeholder lines** during
   that install and they were reverted by hand (previous lane recorded a path-scoped
   `git checkout -- pnpm-workspace.yaml`). Verified state as git sees it now:

```
$ git status --porcelain pnpm-workspace.yaml
(no output — the file is unmodified relative to HEAD)

$ git show HEAD:pnpm-workspace.yaml | od -c
allowBuilds:\n  sharp: false\n  unrs-resolver: false\n      (blob size: 51 bytes)

$ cat pnpm-workspace.yaml | od -c
allowBuilds:\r\n  sharp: false\r\n  unrs-resolver: false\r\n   (working-tree size: 54 bytes)
```

   Exact content as git sees it: three lines, `allowBuilds:`, `sharp: false`,
   `unrs-resolver: false`. No placeholder line is present. The only difference between the
   committed blob and the working tree file is line ending (LF in the blob, CRLF on disk,
   51 → 54 bytes) — `git status` reports it clean, i.e. it is a whitespace/eol artefact only,
   and no `"set this to true or false"` text survives anywhere in the file.

### 8. Scope and safety statement

- No source file under `app/`, `lib/`, `messages/` or `scripts/` was changed by this
  note-completion lane. The only file written inside the repository is this note
  (`docs/house-swarm-5a/WU1A-I18N-FOUNDATION.md`).
- No lockfile, database, migration, deploy, secret, or git write was performed. No commit, no
  push, no branch change, no `git checkout`, no `git stash`, no `git reset`, no `git clean`.
  `git rev-parse HEAD` is unchanged at `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a`.
- No `.env`, `.env.local` or secret file was created or read. No credential appears in this
  note.
- Prohibited-scope paths (`.git`, `.env*`, `.secrets`, `node_modules`, `.next`, `supabase`,
  `tests`, `.github`, `relay`, `package.json`, `pnpm-lock.yaml`) were read-only or untouched;
  `package.json` and `pnpm-lock.yaml` were not modified by any command in this pass — their
  hashes are identical before and after (section 2 rows 15–16, re-confirmed after
  `pnpm install --frozen-lockfile`).
- Scratch files created (outside the repository, therefore not artifacts of the product):
  `C:/Users/Win11/AppData/Local/Temp/wu1a-negctl/mutate-negctl.mjs`,
  `.../wu1a-negctl/th.json`, `.../wu1a-negctl/en.json`.

### 9. Repository state observed at note completion

```
$ git status --porcelain
 M app/auth/accept-invite/page.tsx
 M app/dashboard/page.tsx
 M app/layout.tsx
 M app/login/page.tsx
 M app/onboarding/OnboardingClient.tsx
 M app/operations-client.tsx
 M package.json
 M pnpm-lock.yaml
?? app/components/
?? app/i18n/
?? docs/house-swarm-5a/
?? messages/
?? scripts/check-i18n-parity.mjs

$ git diff --stat
 app/auth/accept-invite/page.tsx     |  23 +-
 app/dashboard/page.tsx              |  29 ++-
 app/layout.tsx                      |  29 ++-
 app/login/page.tsx                  |  24 +-
 app/onboarding/OnboardingClient.tsx | 194 ++++++++--------
 app/operations-client.tsx           | 161 +++++++-------
 package.json                        |   1 +
 pnpm-lock.yaml                      | 427 ++++++++++++++++++++++++++++++++++++
 8 files changed, 679 insertions(+), 209 deletions(-)
```

`HEAD` = `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a`, branch
`codex/house-swarm-5a-20260926`. Nothing is committed; the work is uncommitted in this worktree
by design (no git write was authorised here).

### 10. Evidence-note self-referential record

| Item | Value |
|------|-------|
| Note path | `docs/house-swarm-5a/WU1A-I18N-FOUNDATION.md` |
| Note sha256 before this pass (heading only, 1107 bytes) | `3489cc0a5d80c09c991f061f3474dba7d201fca100da2d86b8b5f5761eec1af5` |
| Note bytes after this pass | recorded in the note-completion report; re-hashed after writing |

Every claim in sections 1–5, 7 and 9 is paired with the command that produced it. Where a value
was not observed by this pass it is marked as lane self-report or commander record, never as
this lane's verification.
