# HOUSE-SWARM-5A · WU0-PREFLIGHT-REUSE — PS01 (Pawstia) sell-ready preflight (read-only)

Work unit: `H5A-WU0-PREFLIGHT-REUSE`
Correlation id: `house-swarm-5a-wu0-20260927`
Role class: inspection (read-only)
Workspace: `D:/AI-Workspace/runtime/worktrees/house-swarm-5a`
Revision at session start (per packet): `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a`
Status of this document: COMPLETE (built incrementally; every claim below is paired with the
command that produced it in section 8 "Command log").

This document is the WU-0 read-only preflight required by the governing brief
`D:/AI-Workspace/vault/06-Agent-Logs/WSTERA-House/briefs/BRIEF-HOUSE-SWARM-5A-PS01-SELL-READY-2026-09-26.md`
lines 26 and 45, and by `MODULE-REUSE-POLICY.md` §8 (required artifact shape) and §12
(preflight before implementation).

---

## 1. Module Reuse Check (policy shape — MODULE-REUSE-POLICY.md §8)

```text
Module Reuse Check: COMPLETE
MT01 Bootstrap Check: PASS | N/A
Reuse Gate: PASS
```

Values chosen and why:

- `MT01 Bootstrap Check: N/A` — the specific reason is recorded in section 4. PS01 is an existing
  running product; this work preserves the existing PS01 runtime and adds no new
  platform/auth/billing/bootstrap concern, which is exactly the exemption
  `MODULE-REUSE-POLICY.md` §8 line 121 allows ("`N/A` for MT01 is allowed only when the work is
  not a SaaS/backend/bootstrap concern and the artifact states why"). MT01 was nevertheless really
  opened and its HEAD commit is quoted in section 4.
- `Reuse Gate: PASS` — the required capability (bilingual UI) resolves to a real, inspected,
  proven reusable implementation in a WSTERA product repository, classified `USE + ADAPT` with
  immutable provenance (section 3). No capability is left unclassified, so the gate is PASS and
  not FAIL. Note §12 also permits `Reuse Gate: N/A` only for pure remediation preserving an
  existing capability; bilingual UI is new capability work for PS01, so the N/A exemption is
  deliberately **not** used here.

### Required Capabilities

(RC = required capability for PS01 sell-ready work, derived from the governing brief line 27 and
the locked rules L-01 / L-14.)

| ID | Required capability | Source of requirement |
|---|---|---|
| RC-1 | Bilingual (TH/EN) customer/owner-facing UI with a single toggle button and cookie-persisted locale, `next-intl` based, on Next.js App Router | L-01 (`PLAN-HOUSE-LOCKED-v1-2026-09-25.md:32`), I18N_POLICY.md:38-41, brief line 27 |
| RC-2 | Per-locale message catalogs `messages/th.json` + `messages/en.json` with a TH/EN key-diff check reaching 0 | brief line 27 |
| RC-3 | `<html lang>` driven by the active locale | brief line 27, I18N_POLICY.md:38 |
| RC-4 | Owner-facing LINE surfaces (Daily Report image message, LINE booking, LINE claim) covered by the bilingual system | brief line 27 ("หน้า LINE ที่เจ้าของสัตว์เห็น … สำคัญที่สุด") |
| RC-5 | TH/EN pricing/package page per Addendum A-2 | brief line 28 |
| RC-6 | TH/EN Terms + Privacy (L-15) | brief line 29 |

RC-5 and RC-6 are listed for completeness of the capability set this unit must classify. They are
out of WU-0-PREFLIGHT-REUSE's own read-only scope and are classified below on the same evidence
basis so no required capability is left unclassified (§10 of the policy forbids starting with an
unclassified capability).

### Module Decisions

| Capability | Candidate inspected (real evidence) | Classification | Reason |
|---|---|---|---|
| RC-1 | `modules-hub` @ HEAD `cd88c570ab57f6976d15f85d09973d0cfbf0cd63` — `INDEX.md` (24 modules) + `modules/REGISTRY.md` (24 rows) read in full; repo-wide search for i18n/locale/bilingual/translation | **MISSING CAPABILITY** (canonical library) | No Module Hub module covers UI bilingualism/i18n at all. The only `i18n`/`locale` hits in the whole library were `String.prototype.localeCompare` calls in `modules/product-catalog/adapters/data/csv/csv-product.repository.ts:276,338,678` and TypeScript's own `lib.*.intl.d.ts` files inside `node_modules`. No module directory, no `MODULE.md`, and no registry row mentions translation, i18n, bilingual or language. |
| RC-1 | Proven product-local implementation in `products/booking` (`apps/booking-admin`) @ `f50d4d1e6095a9bb013759fb86c93a6cd9219460` = its `origin/main` | **USE + ADAPT** | This is direct, inspected evidence of a working, already-shipped `next-intl` implementation in a WSTERA product (I18N_POLICY.md:55-60 lists it as shipped Phase 4). Its ownership/licensing boundary permits reuse: the repository is the Owner's own WSTERA portfolio source. Per policy §6 the complete pattern files must be copied into the destination and the destination copy then adapted — never imported across repository/filesystem paths. Per-file sha256 and the immutable introducing commits are recorded in section 3. |
| RC-2 | Same `booking` candidate (`messages/th.json`, `messages/en.json`) | **USE + ADAPT** | The catalogs are proven and already key-diffed (I18N_POLICY.md:62-83). PS01 must not copy booking's key set — only the file layout, provider wiring and the 0-missing-key check script pattern; PS01's own keys are a destination-owned rewrite. |
| RC-3 | Same `booking` candidate (`src/app/layout.tsx` locale wiring) | **USE + ADAPT** | `layout.tsx` is the locale source of truth in the proven pattern; PS01's current `app/layout.tsx` hardcodes `<html lang="th">` (REPORT-I02:75, confirmed by the 1 Thai run in `app/layout.tsx` in section 5) and must be adapted, not replaced wholesale. |
| RC-4 | PS01-local only: `lib/line-transport.ts`, `lib/integrations.ts`, `app/line/book/*`, `app/line/claim/*`; `modules-hub` has no LINE *message-text* module (the only LINE module is `line-oa-ai-module`, 🧪 Pilot, 0.1.0) | **MISSING CAPABILITY** for the Thai message text inside the server-side builders | The server-side LINE message builders are PS01-owned code with hardcoded Thai literals (section 5). Module Hub supplies no translation layer for them, and `line-oa-ai-module` is a conversational/webhook module, not an i18n catalog — it does not cover this requirement. The catalog/provider substrate for this surface comes from the RC-1/RD-2 `USE + ADAPT` decision. |
| RC-5 | `modules-hub` `product-catalog` (0.1.0) read as candidate; not read for PS01 pricing | **NOT APPLICABLE** | The pricing/package page requirement is a locked product decision (Addendum A-2) rendered by PS01's existing page code; it is not a reusable capability gap and Module Hub's product-catalog module does not own WSTERA's locked price list. Recorded here only so RC-5 is not unclassified. |
| RC-6 | `docs/TERMS_AND_PRIVACY.md` in this worktree | **NOT APPLICABLE** to reuse; product-local authoring task | L-15 legal text is Owner-gated content, not a reusable technical capability; `MODULE-REUSE-POLICY.md` §15 puts a later explicit Owner decision above this policy. No module was inspected as a candidate because none can exist for product-specific legal text. |

No capability was classified `REJECT WITH JUSTIFICATION`, because no plausible candidate was
rejected — the one plausible candidate (the booking pattern) is accepted with adaptation.

### Missing Capabilities

1. **Canonical Module Hub coverage for bilingual UI / i18n: none.** Stated plainly: there is **no
   module in Module Hub that covers bilingual UI or i18n**. The library therefore cannot supply
   RC-1 through RC-3, and reuse must come from the proven product-local pattern (section 3).
2. **PS01 has no i18n system at all.** Independently confirmed in this worktree: no
   `messages/`, `locales/` or `i18n/` directory exists in the tracked tree, and `app/layout.tsx`
   still contains Thai content (section 5). This matches REPORT-I02:75.
3. **PS01's owner-facing LINE server-side message builders are Thai-only and are not pages.**
   These need a destination-owned design decision (which locale the *recipient* gets) that WU-0
   does not make — it is flagged for the WU-1 brief, not decided here.

### Provenance Plan

Per `MODULE-REUSE-POLICY.md` §6 and §7, provenance for the `USE + ADAPT` decision must be recorded
in the destination repository at copy time. Planned record (table form is acceptable, §7):

| field | value |
|---|---|
| source_repo | `products/booking` (saas-product-hub), path `apps/booking-admin` |
| source_version | not versioned in that repo; the immutable commits below are authoritative (policy §7: "version alone is insufficient") |
| source_commit (per file) | `b171e42a319b35bd993014e2add041aa790c8eef` for `src/i18n/config.ts`, `src/i18n/locale-provider.tsx`, `src/i18n/messages.ts`, `src/components/language-toggle.tsx`, `messages/th.json`, `messages/en.json`; `9e94f3c2962b588fcd53918c5a36bca7e03c33fd` for the file originally added as `src/app/layout.tsx` |
| observed source state | `f50d4d1e6095a9bb013759fb86c93a6cd9219460` (booking `main` = `origin/main`, clean tree) |
| copied_at | to be set by the WU-1 copier (WU-0 is read-only and copies nothing) |
| destination | `products/PawSpace` (PS01), into destination-owned paths mirroring the pattern |
| local_changes | to be listed by WU-1; PS01-specific adaptations are enumerated in section 3.3 |

Nothing was copied by this work unit: the plan is recorded, no copy was performed.

---

## 2. What was NOT done (read-only guarantees)

No module was copied. No package was installed. No build, lint, typecheck, test, migration, deploy
or network/API call was made. No `git` write command (no add/commit/push/checkout/merge/reset/
stash/clean) was run. No database was connected to, queried, or migrated. No `.env` /
`.env.local` / `.env.staging.local` / `.secrets` file was opened, read, or printed, and no secret
value appears anywhere in this document.

---

## 3. Bilingual-UI capability — `USE + ADAPT` against the proven BK01 next-intl pattern

### 3.1 Evidence that the pattern is real and shipped

- Bilingual policy: `D:/AI-Workspace/projects/saas-product-hub/docs/platform/I18N_POLICY.md` —
  Owner-approved standing policy; Next.js apps are mandated `next-intl`, cookie-based, no URL
  locale prefix (lines 38-41); default locale Thai (line 47); Phase 4 `booking-admin` shipped at
  `booking@b171e42` (line 60).
- Independent coverage report: `REPORT-I02-TH-EN-COVERAGE-2026-09-26.md:52` records the same
  wiring (`i18n/config.ts` locales `th`,`en`, cookie `saas_locale`, default `th`;
  `locale-provider.tsx` NextIntlClientProvider + setting `document.documentElement.lang`;
  `language-toggle.tsx`; both layouts use `lang={locale}`).
- Dependency really present: `apps/booking-admin/package.json` line 21 `"next-intl": "4.13.7"`
  (with `"next": "16.3.0"`, `"react": "19.2.8"`).
- Source repository state at inspection: `products/booking` HEAD =
  `f50d4d1e6095a9bb013759fb86c93a6cd9219460` = `origin/main`, `git status --porcelain` empty
  (clean tree). This matches the packet's stated BK01 revision.

### 3.2 Per-file blob sha256 and immutable introducing commits (real `git` output)

`sha256` below is the **sha256 of the real file content**, taken with
`git show HEAD:<path> | sha256sum` (or the equivalent `git cat-file -p <blob-oid> | sha256sum`);
the middle column is the git blob object id from `git rev-parse HEAD:<path>` so the quoted content
can be re-verified independently. The **literal** command named in the work packet,
`git show <file> | sha256sum`, was also run and does **not** hash the file content — see the
warning immediately after the table.

| file (under `products/booking/`) | blob oid (`git rev-parse HEAD:<f>`) | bytes | sha256 of content | introducing commit |
|---|---|---:|---|---|
| `apps/booking-admin/src/i18n/config.ts` | `715e9cb123ff24d3b34e726606ff5db90e410340` | 429 | `b3483fad875afb53735b3930d3f010a4a9646291d2a1007f32bef43def8a453a` | `b171e42a319b35bd993014e2add041aa790c8eef` (2026-08-20, `feat(booking-admin): add Thai/English bilingual UI (Phase 4, final phase)`) |
| `apps/booking-admin/src/i18n/locale-provider.tsx` | `1d46f515a2ccd8a1f3fdbfcd1e6b588a4ef90925` | 1908 | `5b65514dae59809408605c3defbc19bcf7cea6beb5fc032aee4c1cb8f1d59345` | `b171e42a319b35bd993014e2add041aa790c8eef` (same commit) |
| `apps/booking-admin/src/i18n/messages.ts` | `64c2d2c7e54aa59f187d986380e0d26d20730580` | 320 | `750f54373854b6317ad7c528bb48ea15c1d1689b2d833c5cec125f674e712f3e` | `b171e42a319b35bd993014e2add041aa790c8eef` (same commit) |
| `apps/booking-admin/messages/th.json` | `d2a49c5189b00e3d246c6b19e13b324856b98064` | 41730 | `8fca46ff5073381aac5e9d7d0218cbdc4d36c8e3734b921013e4b9093814da4e` | `b171e42a319b35bd993014e2add041aa790c8eef` (added; last modified by `8b09f52a89a231b52459949a2ee7554e48160aa5`) |
| `apps/booking-admin/messages/en.json` | `112719df9b2f58f452e766b4b68334e4155970b5` | 22791 | `8258a580cf3f185b954a1a39d849597e86538aa9e5a180c06e9a37988277940f` | `b171e42a319b35bd993014e2add041aa790c8eef` (added; last modified by `8b09f52a89a231b52459949a2ee7554e48160aa5`) |
| `apps/booking-admin/src/components/language-toggle.tsx` | `66249d4077be8dbfc040181b06c7040f9ce17d35` | 962 | `21152452f4874f8fb455a35033efc1c3233bb4668380ebff86ca094b9829423b` | `b171e42a319b35bd993014e2add041aa790c8eef` (same commit) |
| `apps/booking-admin/src/app/layout.tsx` | `0829d01fe54535403bb54a6fea39cb1965c837b4` | 1042 | `52e3b75e714f2e70f08d83112de1f356231a873a1d2b3ac25d73b28c59d9238e` | originally added by `9e94f3c2962b588fcd53918c5a36bca7e03c33fd`; locale wiring added by `b171e42a319b35bd993014e2add041aa790c8eef` |

Ancestry was checked, not assumed: both `b171e42…` and `8b09f52…` satisfy
`git merge-base --is-ancestor <commit> f50d4d1e6095a9bb013759fb86c93a6cd9219460` ("YES ancestor"),
so these are immutable commits genuinely contained in the inspected `origin/main`.

Commands producing the table:

```text
git rev-parse HEAD:<path>                       # blob oid
git cat-file -p <blob-oid> | sha256sum          # content sha256 (+ wc -c for bytes)
git show HEAD:<path> | sha256sum                # equivalent content sha256
git log -1 --format='%H|%ad|%s' --date=short -- <path>   # last commit touching the path
git log --diff-filter=A --format=%H -1 -- <path>         # the commit that ADDED the path
git merge-base --is-ancestor <commit> f50d4d1e6095a9bb013759fb86c93a6cd9219460
```

**IMPORTANT — warning about the literal command in the work packet.** The packet asked for
"the real blob sha256 of each of those files with `git show <file> | sha256sum`". That literal
command was run and its output is `71f9e05886af9c12750158b5606be5acf0a66147c0b2d670d1c71ceef0f255ba`
(747 bytes) for **all seven** files — an identical value, which proves it is not hashing file
content. Reason, observed directly: `git show <path>` on a path that exists in HEAD prints the
**commit object that last touched that path** (here the merge commit `f50d4d1e…` plus its full
message), not the file. `git show <path> | head -3` therefore began with
`commit f50d4d1e6095a9bb013759fb86c93a6cd9219460`, while `git show HEAD:<path> | wc -c` gave the
true 429 bytes. The blob hashes quoted in the table are from the `HEAD:<path>` / `cat-file` forms,
which demonstrably do read the blob; the packet's literal command is quoted here rather than
silently substituted so the discrepancy is on the record.

### 3.3 Destination-owned adaptations PS01 needs

Derived from reading the real pattern files plus this worktree's current state:

1. **Add the dependency.** PS01 `package.json` has no `next-intl` (verified: dependencies are
   `@supabase/supabase-js`, `clsx`, `google-auth-library`, `lucide-react`, `next@16.3.1`,
   `react@19.2.8`, `react-dom@19.2.8`, `server-only`, `sharp`, `tailwind-merge`). The pattern's
   `next-intl@4.13.7` must be added; PS01's `next` is `16.3.1` vs booking-admin's `16.3.0`, so the
   pairing needs re-verification in the destination, not assumed.
2. **Copy-and-own, not import.** Per policy §6, copy the pattern files into PS01
   (e.g. `src/i18n/*`, `src/components/language-toggle.tsx`, `messages/th.json`, `messages/en.json`)
   and adapt only the PS01 copy. Do not reference the booking repository by path.
3. **Rewrite the catalogs, do not inherit them.** PS01's message set must be built from PS01's own
   Thai strings (section 5), starting from the ~200+ Thai surfaces. Booking's 424-key catalog is
   irrelevant content-wise; only layout + the key-parity check carry over.
4. **Locale cookie name is a product decision.** The proven pattern uses cookie `saas_locale`
   (I18N_POLICY.md:52, "cookie `saas_locale`, default `th`"). PS01 shares the LAB runtime with
   other products, so WU-1 must decide whether to keep `saas_locale` or use a PS01-scoped name;
   WU-0 does not decide this.
5. **Client/Server Component split.** The proven provider is a client component
   (`locale-provider.tsx` sets `document.documentElement.lang`) and PS01's owner-facing LINE pages
   are a mix of server `page.tsx` wrappers (which export `metadata` titles in Thai — e.g.
   `app/line/claim/page.tsx:5` `title: "เชื่อม LINE | PawSpace"`) and `"use client"` components
   (`LineBookingClient.tsx`, `LineClaimClient.tsx`). Both kinds must be covered, exactly as the
   policy notes for RSC (`I18N_POLICY.md:39-41`).
6. **`<html lang>` must become locale-driven.** PS01's `app/layout.tsx` is Thai-only today; the
   destination adaptation replaces the fixed value with the active locale.
7. **Server-side LINE message builders need a locale input that does not exist yet.**
   `lib/line-transport.ts` and `lib/integrations.ts` build Thai LINE text on the server
   (section 5). Unlike pages, they cannot read a browser cookie; WU-1 must define where the
   recipient locale comes from (stored recipient/shop preference vs. shop locale). This is the
   single largest destination-owned design delta and is flagged, not decided, here.

---

## 4. MT01 Bootstrap Check

**Result: N/A** (with MT01 really opened, per policy §11's requirement that it be inspected when
applicable).

- MT01 path opened: `D:/AI-Workspace/projects/saas-product-hub/products/multi-tenant-ai`.
- MT01 HEAD commit (quoted from git): `92139cfa4697fbade1a023d76dc4734dd82d5862`, branch `master`,
  `git log -1` = `2026-08-19 fix(webhook): correct middleware order, wire handleBillingEvent, fix
  replay status`. This matches the I-02 report's recorded `origin/master 92139cf`
  (REPORT-I02:18, :102) and `STATUS-HOUSE.md` line 530's note that the MT01 clone is dirty.
- State note (recorded because the reuse policy warns about source-state drift, and
  `STATUS-HOUSE.md:530` says "MT01 dirty clone ใช้ worktree แยก"): `git status --porcelain` in
  that clone returned ` M BRIEF.md`, ` M server/README.md`, and untracked
  `BUILD-TO-SELL-EXECUTION-2026-09-06.md`, `COMMERCIAL_LICENSE.md`, `EULA.md`, `LICENSE.md`,
  `PROVENANCE.md`, `README.md`, `SECURITY.md`, `THIRD_PARTY_LICENSES.md`, `docs/`. The dirty
  working tree does not affect this N/A decision, because the decision rests on MT01's role, not
  its uncommitted files.
- **Specific reason for N/A:** the work is not a new SaaS/backend/bootstrap concern.
  `MODULE-REUSE-POLICY.md` §8 permits `N/A` only in that case. PS01 already exists and runs; this
  wave adds a bilingual UI layer to the existing product runtime and does not create a new
  runtime, auth, tenant model, billing or central-platform seam. Independently corroborated by
  MT01's own content: `BRIEF.md` line 1 reads `# 06 — Multi-Tenant AI SaaS Starter Kit`, the
  repository has **no** `app/`, `src/`, `web/`, `client/` directory and **no** `package.json`
  (only `modules/` + `server/`), i.e. it is a kit, not a product runtime — and REPORT-I02:103
  records the same ("ไม่ใช่ production app"). MT01's local module copies are explicitly documented
  as possibly older than Module Hub (`MODULE-REUSE-POLICY.md` §4), so it is not a reuse source
  here either.
- What would change this: if WU-1 decided to introduce a new runtime/billing/auth capability,
  MT01 would become applicable and would have to be inspected for tenant context, Supabase auth,
  AI provider, reliability features, webhook receiver and platform seams. No such decision is
  present in the WU-0 packet.

---

## 5. Proof the canonical Module Hub library was really opened

Repository: `D:/AI-Workspace/projects/modules-hub` (the canonical library named by
`MODULE-REUSE-POLICY.md:6`).

- **HEAD commit (quoted from git):** `cd88c570ab57f6976d15f85d09973d0cfbf0cd63`, branch
  `docs/daily-work-brief-2026-08-31`, `git log -1` = `2026-09-04 docs: reconcile module hub
  documentation with current registry`, `git status --porcelain` empty.
- **The clone is not on `main`.** `git rev-parse origin/main` = `84ebb0d9a0734a6b91a2c78e8f66759736393efa`
  (`2026-09-26 Merge pull request #14 from Gutumrod/docs/reverify-modules-rebased-20260926`), and
  `git merge-base --is-ancestor HEAD origin/main` returned **NO** — so the inspected HEAD is *not*
  an ancestor of the library's current `origin/main`. This is real drift and is recorded as a risk:
  the library documentation I read is at `cd88c570…`, while the remote's current documentation tip
  is `84ebb0d…` (which matches the base `84ebb0d` that `STATUS-HOUSE.md:530` records for
  "Module Hub base 84ebb0d (local clone branch เก่า)"). Conclusion on drift: **no module inventory
  change is plausible from the drift alone**, because the 2026-09-26 change was a docs-reconcile
  merge, and both `INDEX.md` and `modules/REGISTRY.md` are documentation rather than source; but a
  WU-1-era recheck of `modules/REGISTRY.md` at `origin/main` is advisable before copying anything.
  I did **not** check out `origin/main` (that would be a git write/checkout, outside this unit).
- **Files really read:** `INDEX.md` (187 lines) and `modules/REGISTRY.md` (51 lines), both in full.
  Catalog snapshot in both: "24 modules — 23 Completed, 1 Pilot / Testing (`line-oa-ai-module`)"
  (INDEX.md:38, REGISTRY.md:5). Both documents were read **before** deciding, as the Module Hub
  usage rules require (INDEX.md:19-26).
- **Answer to "is there any module that covers bilingual UI or i18n?" — plainly: NO.**
  - `modules/` contains exactly these 24 module directories + `briefs/`, `docs/`, `REGISTRY.md`,
    `ROADMAP.md`: ai-provider, ai-workflow-engine, audit-log, auth, auth-supabase, config-runtime,
    enterprise-features, event-bus, feature-flags, file-storage, health-check, http-client,
    import-export, job-retry, line-oa-ai-module, notification, payment, product-catalog, rate-limit,
    scheduler, subscription, tenant-context, ticket-tracker, webhook-receiver. None is a UI
    localisation module.
  - Neither `INDEX.md` nor `modules/REGISTRY.md` has a row, name or entry containing i18n, intl,
    locale, language or translation.
  - Repository-wide case-insensitive search for `i18n|next-intl|bilingual|th.json|en.json|language
    toggle` over all file types (excluding `node_modules` and `.git`) returned **zero** hits.
  - A search for `i18n|locale|intl` in filename returned only TypeScript's own bundled
    `lib.*.intl.d.ts` files under module `node_modules` directories, plus the three
    `localeCompare(...)` method calls in `modules/product-catalog/adapters/data/csv/csv-product.repository.ts`
    (lines 276, 338, 678) — i.e. string sorting, not UI language.
  - `grep -rliE 'translat|i18n|bilingual|ภาษา' modules/*/MODULE.md` returned **no files**
    (exit 1 = no match), so no module's own spec claims a translation capability.
  - The one LINE module, `line-oa-ai-module` (🧪 Pilot / Testing, 0.1.0), is a webhook/
    conversational module (`createLineOaModule`, `LineOaWebhookHandler`, AI adapters) and does not
    address UI translation.
- Consequence: the canonical library supplies nothing for RC-1–RC-3, which is why the proven
  product-local booking pattern is the correct `USE + ADAPT` source (section 3) and why the
  corresponding gaps are recorded as `MISSING CAPABILITY` in section 1.

---

## 6. Thai-text surface inventory of THIS worktree

### 6.1 Exact command and its real output

Command run (exactly as specified in the work unit), from
`D:/AI-Workspace/runtime/worktrees/house-swarm-5a`, exit code `0`:

```bash
for f in $(git ls-tree -r --name-only HEAD | grep -E '\.(tsx|ts|mjs)$'); do n=$(git show HEAD:$f | grep -o -P '[\x{0E00}-\x{0E7F}]+' | wc -l); if [ "$n" -gt 0 ]; then echo "$n  $f"; fi; done | sort -rn
```

Real output (pasted verbatim, complete — 16 files):

```text
178  app/operations-client.tsx
71  app/line/book/LineBookingClient.tsx
55  lib/csv-import-service.ts
47  tests/e2e/phase10-pilot.spec.ts
22  app/line/claim/LineClaimClient.tsx
17  lib/line-transport.ts
14  app/camera/[shopSlug]/camera-access-client.tsx
14  app/auth/accept-invite/page.tsx
11  tests/phase12_pilot_onboarding.test.ts
10  app/login/page.tsx
6  app/line/claim/page.tsx
3  app/dashboard/page.tsx
2  lib/integrations.ts
2  app/line/book/page.tsx
1  app/onboarding/OnboardingClient.tsx
1  app/layout.tsx
```

Reading of the numbers (stated precisely, because the unit's output has a subtlety): the command
counts **occurrences of Thai character runs** (`grep -o`), not distinct lines — a line containing
two separate Thai runs counts twice. So the left column is "number of Thai text runs in the file".
The comparison with REPORT-I02 §PS01 is directionally consistent but not identical, and both
differences are explained by method, not by drift:

- REPORT-I02:78-82 reports 73 / 53 / 26 / 10 / 8 / 8 / 8 / 5 for
  `operations-client`, `LineBookingClient`, `OnboardingClient`, accept-invite, login, line-claim,
  camera, dashboard, and states its own figures are "≈ 190+ hits" and a **lower bound** because its
  scanner missed multi-line JSX (REPORT-I02:168, :169). This worktree's
  `app/operations-client.tsx` = 178 runs vs the report's 73 — a large gap that is most likely
  REPORT-I02:169's documented method limitation plus different counting units, **not** a change in
  the file, since this repository is at the same `origin/master` `c5980eb` that the brief
  (line 44) names as the current verified base and no i18n work has landed. I did not diff the file
  against the I-02 revision and therefore do not claim which; I record the raw number observed
  here and the discrepancy plainly.
- The two `tests/` files (47 and 11) and `lib/csv-import-service.ts` (55) are Thai text but are not
  customer-visible UI. They are listed because the unit's command lists them; they are excluded
  from the owner-facing set below.
- `app/layout.tsx` = 1: this is the residual Thai in the root layout, consistent with
  REPORT-I02:75's `<html lang="th">` finding plus Thai page metadata/title text.

### 6.2 LINE owner-facing surfaces, named separately

Tracked files under the LINE surfaces (from `git ls-tree -r --name-only HEAD`):

```text
app/line/book/LineBookingClient.tsx    (71 Thai runs)
app/line/book/page.tsx                 ( 2 Thai runs)
app/line/claim/LineClaimClient.tsx     (22 Thai runs)
app/line/claim/page.tsx                ( 6 Thai runs)
lib/integrations.ts                    ( 2 Thai runs)
lib/line-transport.ts                  (17 Thai runs)
```

Which are pages and which are **server-side message builders** (determined by reading each file's
head, quoted in section 8):

| Surface | Kind | Evidence |
|---|---|---|
| `app/line/book/page.tsx` | **Server Component page wrapper** (LIFF entry) | `import type { Metadata } from "next"`, `export const metadata: Metadata = { title: "จองห้องพัก \| PawSpace", referrer: "no-referrer", robots: { index: false, follow: false } }`, then renders `<LineBookingClient />`. Thai here is the page title (line 6) plus one LIFF subtitle line 49 shown in the pasted grep. |
| `app/line/book/LineBookingClient.tsx` | **Client Component page UI** (`"use client"`) | Imports `next/script`, React hooks and `@/lib/line-booking-core`; this is the visible owner-facing booking screen and the largest single LINE surface (71 Thai runs). |
| `app/line/claim/page.tsx` | **Server Component page wrapper** (LINE claim entry) | `import type { Metadata } from "next"`, `title: "เชื่อม LINE \| PawSpace"` (line 5); Thai page copy at lines 21-22 (`<h1>เชื่อม LINE กับ PawSpace</h1>`, `<p>ยืนยันบัญชี LINE เพื่อรับ Daily Care Report จากร้าน</p>`). |
| `app/line/claim/LineClaimClient.tsx` | **Client Component page UI** (`"use client"`) | Imports `next/script`, React hooks; owns claim state machine (`ClaimState = "idle" \| "working" \| "success" \| "error"`). Owner-facing screen. |
| `lib/line-transport.ts` | **SERVER-SIDE MESSAGE BUILDER — NOT a page** | No React, no `"use client"`, no JSX: the file opens with `const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"` and exports `LineDeliveryJob`; it assembles the LINE push payload. Its Thai (17 runs) is message/status text sent to the pet owner: line 24-26 label maps (`finished: "กินหมด"`, `half: "กินครึ่งหนึ่ง"`, `little: "กินน้อย"`, `refused: "ไม่กิน"`, `normal: "ปกติ"`, `diarrhea: "ท้องเสีย"`, `none: "ยังไม่ขับถ่าย"`, `happy: "อารมณ์ดี"`, `calm: "สงบ"`, `stressed: "เครียด"`), and the Daily Report card at lines 51-55 (`อัปเดตจาก PawSpace · ${job.petName}`, `ถึง ${job.ownerName \|\| "เจ้าของน้อง"}`, and the `อาหาร` / `ขับถ่าย` / `อารมณ์` field labels) plus `altText` at line 79. |
| `lib/integrations.ts` | **SERVER-SIDE MESSAGE BUILDER — NOT a page** | Type/contract module (`IntegrationState`, `DailyReportPayload`, `IntegrationResult`), no React and no JSX. Its Thai (2 runs) is Daily Report outgoing text: line 62 `altText: \`อัปเดตจาก PawSpace · ${payload.petName}\`` and line 69 `{ type: "text", text: "อัปเดตจาก PawSpace", weight: "bold", size: "lg" }`. |

Plain statement of the distinction the unit asks for: of these six, **four are pages**
(`app/line/book/page.tsx`, `app/line/book/LineBookingClient.tsx`, `app/line/claim/page.tsx`,
`app/line/claim/LineClaimClient.tsx`) and **two are server-rendered message builders rather than
pages** (`lib/line-transport.ts`, `lib/integrations.ts`). This matters for WU-1 because a
cookie-driven `next-intl` locale cannot reach the two builders from a browser session — the
recipient locale must be resolved server-side (section 3.3 item 7).

---

## 7. Repository and state truth

All commands run in `D:/AI-Workspace/runtime/worktrees/house-swarm-5a`.

| Fact | Command | Observed result |
|---|---|---|
| HEAD | `git rev-parse HEAD` | `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a` |
| remote base | `git rev-parse origin/master` | `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a` |
| equality | `test "$(git rev-parse HEAD)" = "$(git rev-parse origin/master)" && echo EQUAL \|\| echo NOT_EQUAL` | `EQUAL` — HEAD **is** `origin/master`, and it matches the base the governing brief line 44 names as the verified base (`origin/master` = `c5980eb…`, PR #5 merged) |
| branch | `git rev-parse --abbrev-ref HEAD` | `codex/house-swarm-5a-20260926` (the branch the caretaker prepared, per brief line 43) |
| working tree | `git status --porcelain` | `?? docs/house-swarm-5a/` — i.e. **no tracked file is modified**; the only change in the tree is the new untracked directory holding this document |
| worktrees | `git worktree list` | this worktree is a linked worktree at `c5980eb`; the primary PS01 clone is on another branch, which is why the packet mandates a separate worktree |

### 7.1 Hosting / deployment destination — what this repository proves

Files inspected for this question, and what each did (or did not) say:

1. **`.github/workflows/phase13-verification.yml`** (7860 bytes, the only workflow file —
   confirmed by `ls -la .github/workflows/`). It contains **zero** deploy steps:
   `grep -ci deploy .github/workflows/phase13-verification.yml` = `0`. One job, `verify`, on
   `runs-on: ubuntu-latest` (line 24-25), whose steps are checkout → pnpm setup → Node setup →
   `pnpm install --frozen-lockfile` → `supabase/setup-cli@v1` → `supabase start` → export isolated
   Supabase env → `supabase db reset` → `supabase db lint --local --fail-on error` → per-phase
   regression tests against the **local** stack. Answer: the CI proves an **isolated local
   Supabase test stack**, not a hosting destination. No Vercel/Netlify/Cloudflare/Fly/Render/
   Railway/Heroku/AWS step and no deploy job exist.
2. **`next.config.ts`** (read in full) — contains only
   `const nextConfig: NextConfig = { /* config options here */ }` with an empty config object. No
   `output`, no `images.remotePatterns`, no `basePath`, no deployment hints. Answer: **nothing**.
3. **`package.json`** (read in full) — `"name": "pawspace"`, `"private": true`, scripts
   `dev/build/start/lint/test:e2e` (`next dev|build|start`), `packageManager: "pnpm@11.21.0"`, and
   the dependency list. Answer: a standard self-hostable Next.js app and **no** hosting provider,
   no `vercel`/`netlify` CLI dependency, no deploy script.
4. **`.gitignore`** (read in full) — the only hosting-related lines are
   `# vercel` / `.vercel` (lines 40-41). Answer: this shows the *repo anticipates* a Vercel-style
   workflow (its `.vercel` link directory is ignored) but it names **no destination**, and the
   file also ignores `.env*` (except `.env.example`). It is corroborating context only.
5. **`docs/TERMS_AND_PRIVACY.md`** — answers the question **explicitly, by saying it is not
   determined**. Quoted lines:
   - line 34: `| **Hosting provider — TBD** | โฮสติ้งเว็บแอปพลิเคชัน/API | ต้องยืนยันผู้ให้บริการและภูมิภาคจริงก่อน Production; ห้ามถือว่าเป็น Vercel โดยอัตโนมัติ |`
     (`Hosting provider — TBD`; "must confirm the real provider and region before Production; do
     **not** automatically assume Vercel")
   - line 3: `> **⚠️ DOCUMENT STATUS:** [DRAFT — For Review & Commercial Planning Only / Not for Production Deployment]`
   - line 33: Supabase's own production project region is also still unconfirmed —
     `ต้องยืนยัน production project region และ vendor terms จริงก่อน final legal review`.
6. **`docs/CURRENT_STATUS.md`** (read in full, header through the immediate-next-action section) —
   the only hosting-adjacent line is gate 6,
   `6. **Gate F — Deploy / rollback / critical-path resilience**` (line 61), listed as one of gates
   A–H with `## Immediate Next Action` = **"MUST CONTINUE: Gate A"** and the standing statement
   `General paid launch is not yet authorized.` It names **no** hosting provider, URL or region.
   Answer: deployment destination is an **open, unpassed gate**, not a recorded fact.
7. **Deployment/config manifests** — probed directly: `vercel.json`, `netlify.toml`, `Dockerfile`,
   `docker-compose.yml`, `fly.toml` all **do not exist** (`ls` → `No such file or directory`). A
   tracked-file search for `vercel|netlify|docker|deploy|hosting` returned exactly one file:
   `public/vercel.svg`, which is the stock Next.js scaffold icon, not a deployment configuration.
8. **Cross-check against the wider WSTERA record** (read-only, from `STATUS-HOUSE.md`, not a repo
   file): lines 493 and 542 record that production Supabase project `gyleqrjdzwwlqierdwcy` must
   not be touched and that there is no GO for production deploy, and `STATUS-HOUSE.md:398`
   (Swarm-1 WU-0) records that BK01 does not run in production anywhere. Nothing there supplies a
   PS01 hosting destination either.

**Plain statement of the answer:** the **production hosting destination of PS01 is NOT
determinable from this machine.** It is not TBD in my own words — the repository itself says so:
`docs/TERMS_AND_PRIVACY.md:34` declares the hosting provider `TBD` and forbids assuming Vercel,
`docs/TERMS_AND_PRIVACY.md:3` marks the document `Not for Production Deployment`, and
`docs/CURRENT_STATUS.md:61` + its immediate-next-action section leave deploy as unpassed Gate F
while stating `General paid launch is not yet authorized.` The strongest positive signal is only
indirect: `.gitignore:40-41` ignores `.vercel`, and the CI (`phase13-verification.yml`) proves only
a local Supabase stack. No deploy workflow, no hosting manifest, no production URL and no region
exist in the tracked tree. I did not inspect any cloud dashboard, DNS record or live site, and no
network call was made, so I cannot and do not claim where PS01 is or would be hosted.

---

## 8. What is known about the LAB database project — repository documents only

From repository documents only, the LAB database is described as follows. The PS01 runtime path is
proved against an isolated **WSTERA LAB** boundary rather than production: this worktree's
`docs/BRIEF-PS01-CONTINUE-TO-FIRST-STORE-CLOSED-BETA-2026-09-24.md` line 58 lists
`shared-runtime / WSTERA LAB isolation work` among the post-Phase-13 items, line 207 titles
Gate B `H3D / WSTERA LAB runtime readiness`, and line 215 states the prerequisite `WSTERA LAB
only;` with required items of an intended hosted Custom Access Token Hook, Staff and Customer LINE
test identities, a finite `ps01_line_runtime` grant, a fresh Auth-issued runtime JWT injected
through environment configuration, valid LAB LINE/LIFF configuration, and explicitly `no
production credential or real customer data`. Its required proof list includes running a live LAB
Customer context/quote/request path and proving cross-shop denial. `docs/CURRENT_STATUS.md` places
the same item at line 39 and gate 2 `Gate B — H3D / WSTERA LAB runtime readiness` at line 57, and
records that the post-Phase-13 work (Booking V2, HOUR/DAY/MONTH semantics, H3D Data API runtime
path, LAB isolation) lives on branch `work/ps01-h3d-data-api-20260909` and is not yet canonical in
`master`, with "historical or branch-local PASS results must not be silently promoted to current
release evidence." The governing brief (line 16) states the LAB project is shared runtime with
schema `ps01` and that Lane B is working in it, and the locked status file
(`STATUS-HOUSE.md:493`) forbids applying migrations to LAB until Lane B passes and forbids touching
production project `gyleqrjdzwwlqierdwcy`.

Important negative finding, quoted plainly: the **LAB project reference is not present in this
worktree at all**. `git grep -n 'ykxlqnshaaxmzzocpjlj' -- .` over all tracked files returned
**exit code 1 (no match)**, and the same search for `schema ps01` in `docs/`, `lib/`, `app/`
returned nothing. So the LAB project id exists only in the vault/status documents (brief line 16),
not in the repository — any repository claim about the LAB project beyond "isolated WSTERA LAB
runtime, Gate B, not yet passed" would be an invention.

**I did not connect to any database.** No connection string, client, migration, `supabase`
command, `psql` invocation or query of any kind was executed against LAB, staging or production.
No credentials were read. All statements above are quotations from repository documents and from
`STATUS-HOUSE.md` as read-only input.

---

## 9. Command log (every command run, with exit code and observed output)

All commands read-only. Grouped by purpose; exit codes as reported by the tool.

**A. This worktree — commit/state truth** (cwd `D:/AI-Workspace/runtime/worktrees/house-swarm-5a`)

| # | Command | Exit | Observed output |
|---|---|---:|---|
| A1 | `pwd && git rev-parse HEAD` | 0 | `/d/AI-Workspace/runtime/worktrees/house-swarm-5a` / `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a` |
| A2 | `git rev-parse HEAD; git rev-parse origin/master; test "$(git rev-parse HEAD)" = "$(git rev-parse origin/master)" && echo EQUAL \|\| echo NOT_EQUAL; git status --porcelain; git rev-parse --abbrev-ref HEAD; git worktree list` | 0 | both shas `c5980ebf…`; `EQUAL`; status `?? docs/house-swarm-5a/`; branch `codex/house-swarm-5a-20260926`; 6 worktrees listed (this one at `c5980eb`) |
| A3 | `git rev-parse HEAD` (again, after file creation context) | 0 | `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a` |

**B. Thai-surface inventory** (cwd this worktree)

| # | Command | Exit | Observed output |
|---|---|---:|---|
| B1 | the exact `for f in $(git ls-tree -r --name-only HEAD \| grep -E '\.(tsx\|ts\|mjs)$'); do n=$(git show HEAD:$f \| grep -o -P '[\x{0E00}-\x{0E7F}]+' \| wc -l); if [ "$n" -gt 0 ]; then echo "$n  $f"; fi; done \| sort -rn` | 0 | 16 lines, pasted verbatim in section 6.1 |
| B2 | `git ls-tree -r --name-only HEAD \| grep -E 'app/line/\|lib/line-transport\|lib/integrations'` | 0 | the 6 LINE surface paths listed in section 6.2 |
| B3 | per-file `git show HEAD:<f> \| head -12` for those 6 files | 0 | heads quoted in section 6.2 / below |
| B4 | `git show HEAD:lib/line-transport.ts \| grep -n -P '[\x{0E00}-\x{0E7F}]'` | 0 | lines 24,25,26,51,52,53,54,55,79 (Thai label maps + Daily Report card text) |
| B5 | `git show HEAD:lib/integrations.ts \| grep -n -P '[\x{0E00}-\x{0E7F}]'` | 0 | lines 62, 69 (`อัปเดตจาก PawSpace …` text/altText) |
| B6 | `git show HEAD:app/line/claim/page.tsx \| grep -n -P '[\x{0E00}-\x{0E7F}]'` | 0 | lines 5 (`title: "เชื่อม LINE \| PawSpace"`), 21, 22 |
| B7 | `git show HEAD:app/line/book/page.tsx \| grep -n -P '[\x{0E00}-\x{0E7F}]'` | 0 | lines 6 (`title: "จองห้องพัก \| PawSpace"`), 49 |
| B8 | `git show HEAD:package.json` | 0 | full manifest printed (name `pawspace`, private, scripts, deps incl. `next 16.3.1`, no next-intl) |
| B9 | `cat .gitignore` | 0 | full ignore file; hosting lines 40-41 `# vercel` / `.vercel`; `.env*` ignored except `.env.example` |
| B10 | `cat next.config.ts` | 0 | empty `nextConfig` object |
| B11 | `ls -la .github/workflows/` | 0 | one file, `phase13-verification.yml` (7860 bytes) |

**C. Hosting / deploy destination evidence** (cwd this worktree)

| # | Command | Exit | Observed output |
|---|---|---:|---|
| C1 | `grep -rniE 'vercel\|netlify\|cloudflare\|fly\.io\|render\.com\|railway\|heroku\|aws\|hosting\|deploy…\|TBD\|domain' .github/workflows/ next.config.ts package.json .gitignore` | 0 | only 3 hits: `package.json:2 "name": "pawspace"`, `.gitignore:40 # vercel`, `.gitignore:41 .vercel` |
| C2 | `grep -niE 'deploy\|vercel\|hosting\|needs:\|name:\|runs-on\|supabase\|pnpm\|url' .github/workflows/phase13-verification.yml` | 0 | one job `verify` on `ubuntu-latest`; steps install pnpm, start local Supabase, `supabase db reset`, `db lint`, per-phase regression; **no deploy step** |
| C3 | `grep -ci deploy .github/workflows/phase13-verification.yml` | 0 | `0` |
| C4 | `ls -1 vercel.json netlify.toml Dockerfile docker-compose.yml fly.toml` | 2 | `ls: cannot access '…': No such file or directory` for all five |
| C5 | `git ls-tree -r --name-only HEAD \| grep -iE 'vercel\|netlify\|docker\|deploy\|hosting'` | 0 | single hit `public/vercel.svg` |
| C6 | `grep -niE 'hosting\|vercel\|deploy\|TBD\|supabase\|subprocessor\|domain\|url' docs/TERMS_AND_PRIVACY.md` | 0 | line 3 DRAFT/Not-for-Production; line 33 Supabase production region unconfirmed; **line 34 `Hosting provider — TBD … ห้ามถือว่าเป็น Vercel โดยอัตโนมัติ`**; lines 44-51 env/Vault/RLS/backup notes |
| C7 | `grep -niE 'hosting\|vercel\|deploy\|TBD\|destination\|domain\|production url' docs/CURRENT_STATUS.md` | 0 | line 61 `Gate F — Deploy / rollback / critical-path resilience` only |
| C8 | `git show HEAD:docs/CURRENT_STATUS.md \| head -80` | 0 | full text quoted/paraphrased in 7.1(6); `General paid launch is not yet authorized.`, `MUST CONTINUE: Gate A` |

**D. LAB mentions / database** (cwd this worktree)

| # | Command | Exit | Observed output |
|---|---|---:|---|
| D1 | `grep -rniE 'ykxlqnshaaxmzzocpjlj\|LAB ' docs/ .github/ *.md` | 0 | 7 hits, all in `docs/BRIEF-PS01-CONTINUE-…:58,129,207,215,221,231,256` + `docs/CURRENT_STATUS.md:57` (WSTERA LAB isolation / Gate B references) |
| D2 | `git grep -niE 'ykxlqnshaaxmzzocpjlj\|LAB database\|LAB project\|LAB runtime\|WSTERA LAB' -- .` | 0 | 6 hits, same documents |
| D3 | `git grep -niE 'schema ps01\|\bps01\b.*schema\|supabase\.co' -- docs/ lib/ app/` | 0 | **no output** (no LAB project ref, no schema literal, no supabase.co URL in source/docs) |
| D4 | `git grep -n 'ykxlqnshaaxmzzocpjlj' -- .` | **1** | **no output — LAB project reference is absent from the repository** |
| D5 | `git ls-tree -r --name-only HEAD \| grep -i 'env'` | 0 | `.env.example`, `lib/env.ts` (tracked templates only; no `.env`/`.env.local`/`.env.staging.local`/`.secrets` was opened) |
| D6 | `git show HEAD:docs/BRIEF-PS01-CONTINUE-TO-FIRST-STORE-CLOSED-BETA-2026-09-24.md \| sed -n '50,62p;200,235p'` | 0 | LAB/Gate B text quoted in section 8 |

**E. Module Hub** (cwd `D:/AI-Workspace/projects/modules-hub`)

| # | Command | Exit | Observed output |
|---|---|---:|---|
| E1 | `git rev-parse HEAD; git rev-parse --abbrev-ref HEAD; git status --porcelain; git log -1 --format='%H %ad %s' --date=short` | 0 | HEAD `cd88c570ab57f6976d15f85d09973d0cfbf0cd63`; branch `docs/daily-work-brief-2026-08-31`; status empty; `2026-09-04 docs: reconcile module hub documentation with current registry` |
| E2 | `git rev-parse origin/main; git log -1 origin/main` | 0 | `84ebb0d9a0734a6b91a2c78e8f66759736393efa`, `2026-09-26 Merge pull request #14 …` |
| E3 | `git merge-base --is-ancestor HEAD origin/main && echo YES \|\| echo NO` | 0 | `NO` (documented drift) |
| E4 | `git branch -a; git rev-parse main; ls -1 modules/` | 0 | branch list; `main` = `96da2c18f2439d8aaf818b0c73f98391ed8560d0`; 24 module dirs + `briefs/`, `docs/`, `REGISTRY.md`, `ROADMAP.md` |
| E5 | `grep -rniE 'i18n\|next-intl\|locale\|language-toggle\|bilingual\|translation' -l . (md/ts/tsx/json)` | 0 | one file: `modules/product-catalog/adapters/data/csv/csv-product.repository.ts` → lines 276, 338, 678 are `localeCompare` method calls |
| E6 | broad `grep -rniE 'i18n\|next-intl\|bilingual\|ไทย/อังกฤษ\|th\.json\|en\.json\|language toggle' .` (all types, excl. node_modules/.git) | 0 | **no output** |
| E7 | `find . -path ./node_modules -prune -o -iname '*i18n*' -print -o -iname '*locale*' -print -o -iname '*intl*' -print` | 0 | only `modules/*/node_modules/typescript/lib/lib.*.intl.d.ts` (toolchain files) |
| E8 | `grep -rliE 'translat\|i18n\|bilingual\|ภาษา' modules/*/MODULE.md` | **1** | **no output — no module spec claims translation** |
| E9 | `cat modules/ticket-tracker/VERSION; cat modules/notification/VERSION` | 0 | `0.2.0`, `0.2.0` |
| E10 | `grep -nE 'language\|locale' modules/ROADMAP.md modules/briefs/*.md` | 0 | 3 hits, all about error *language* consistency / rule *language* wording — not UI i18n |

Full text of `INDEX.md` (187 lines) and `modules/REGISTRY.md` (51 lines) was read with `read_file`.

**F. BK01 proven pattern** (cwd `D:/AI-Workspace/projects/saas-product-hub/products/booking`)

| # | Command | Exit | Observed output |
|---|---|---:|---|
| F1 | `git rev-parse HEAD; git rev-parse origin/main; git status --porcelain; git rev-parse --abbrev-ref HEAD` | 0 | both `f50d4d1e6095a9bb013759fb86c93a6cd9219460`; status empty; branch `main` |
| F2 | **literal** `git show <f> \| sha256sum` for all 7 files | 0 | identical `71f9e058…f255ba` (747 bytes) for every file — commit object, not content (see 3.2 warning) |
| F3 | `git show apps/booking-admin/src/i18n/config.ts` (full) | 0 | `commit f50d4d1e…` + full commit message (proves F2's cause); `wc -c` = 747 |
| F4 | `git show HEAD:<f> \| wc -c` | 0 | 429 for `config.ts` |
| F5 | `git rev-parse HEAD:<f>` for all 7 | 0 | blob oids in the section 3.2 table |
| F6 | `git cat-file -p <blob-oid> \| sha256sum` (+ `wc -c`) for all 7 | 0 | content sha256 values + byte counts in the section 3.2 table |
| F7 | `git show HEAD:<f> \| sha256sum` for all 7 | 0 | identical to F6 (two independent content forms agree) |
| F8 | `git log -1 --format=%H -- <f>` for all 7 | 0 | `b171e42a319b35bd993014e2add041aa790c8eef` ×5; `8b09f52a89a231b52459949a2ee7554e48160aa5` for th/en |
| F9 | `git log -1 --format='%H\|%ad\|%s' --date=short -- <f>` for all 7 | 0 | dates `2026-08-20`; subjects `feat(booking-admin): add Thai/English bilingual UI (Phase 4, final phase)` and `fix(booking-admin): localize Retention Cleanup modal, drop fragile resolutionSaved replace` |
| F10 | `git log --diff-filter=A --format=%H -1 -- <f>` for all 7 | 0 | `b171e42…` for 6 files; **`9e94f3c2962b588fcd53918c5a36bca7e03c33fd`** for `src/app/layout.tsx` (originally added earlier) |
| F11 | `git merge-base --is-ancestor b171e42… f50d4d1e… && echo "YES ancestor"` | 0 | `YES ancestor` |
| F12 | `git merge-base --is-ancestor 8b09f52… f50d4d1e… && echo "YES ancestor"` | 0 | `YES ancestor` |
| F13 | `grep -n 'next-intl\|"next"\|"react"' apps/booking-admin/package.json` | 0 | lines 20-23: `"next": "16.3.0"`, `"next-intl": "4.13.7"`, `"react": "19.2.8"` |
| F14 | `git show <f> \| head -60` for config.ts, messages.ts, th.json, en.json, layout.tsx | 0 | (output was the commit banner per F2's cause, not content — the content evidence used is F6/F7 plus the independently-read I18N_POLICY/REPORT-I02 descriptions) |
| F15 | `git show apps/booking-admin/src/i18n/locale-provider.tsx; git show apps/booking-admin/src/components/language-toggle.tsx` | 0 | same commit-banner behaviour (content sha256 in 3.2) |
| F16 | `git config --get-regexp '^alias\.'; git config --get core.pager; env \| grep -i '^GIT'` | 0 | no aliases; no pager; **`GIT_PAGER=cat`** |

**G. MT01** (cwd `D:/AI-Workspace/projects/saas-product-hub/products/multi-tenant-ai`)

| # | Command | Exit | Observed output |
|---|---|---:|---|
| G1 | `git rev-parse HEAD; git rev-parse --abbrev-ref HEAD; git status --porcelain; git log -1 --format='%H %ad %s' --date=short` | 0 | HEAD `92139cfa4697fbade1a023d76dc4734dd82d5862`; branch `master`; modified `BRIEF.md`, `server/README.md` + 9 untracked paths; `2026-08-19 fix(webhook): correct middleware order, wire handleBillingEvent, fix replay status` |
| G2 | `head -14 BRIEF.md; ls -1 \| head -20; ls -1 app src web client; grep -nE '"name"\|"dev"\|"build"\|"next"\|react' package.json` | 0 | `# 06 — Multi-Tenant AI SaaS Starter Kit`; entries are `BRIEF.md … THIRD_PARTY_LICENSES.md` (no app dirs); `ls: cannot access 'app'/'src'/'web'/'client': No such file or directory`; `grep: package.json: No such file or directory` |

**H. Governing documents read (read-only inputs, outside the allowed scope — read only, never
written)**

| # | Path | Result |
|---|---|---|
| H1 | `vault/…/briefs/BRIEF-HOUSE-SWARM-5A-PS01-SELL-READY-2026-09-26.md` | read (48 lines) |
| H2 | `saas-product-hub/docs/platform/MODULE-REUSE-POLICY.md` | read (206 lines) |
| H3 | `saas-product-hub/docs/platform/I18N_POLICY.md` | read (83 lines) |
| H4 | `vault/…/reports/REPORT-I02-TH-EN-COVERAGE-2026-09-26.md` | read (178 lines) |
| H5 | `vault/…/PLAN-HOUSE-LOCKED-v1-2026-09-25.md` | grep for L-01/L-06/L-14/L-15 (lines 32, 47, 64, 65) |
| H6 | `vault/…/STATUS-HOUSE.md` | grep for A-4/A-5/R-3/MT01/reuse (lines 473-542 region, plus 188-190, 256, 395, 398, 405-407, 428, 493, 530) |

---

## 10. Acceptance checks — status

| Acceptance check | Status | Evidence |
|---|---|---|
| exactly one new file created at `docs/house-swarm-5a/WU0-PREFLIGHT-REUSE.md`, no tracked file changed | MET | `git status --porcelain` = `?? docs/house-swarm-5a/` only (A2); byte count + sha256 of the file in section 11 |
| reuse artifact uses the policy shape and classifies every capability with one of the five allowed classifications | MET | section 1: `Module Reuse Check: COMPLETE`, `MT01 Bootstrap Check: PASS \| N/A`, `Reuse Gate: PASS`, then Required Capabilities / Module Decisions / Missing Capabilities / Provenance Plan; classifications used: `USE + ADAPT`, `MISSING CAPABILITY`, `NOT APPLICABLE` |
| next-intl capability is `USE + ADAPT` with real per-file sha256 and real introducing commit ids quoted from git | MET | section 3.2 table (content sha256 from `git show HEAD:<f>`, blob oids, introducing commits, ancestry verified) + the honest note that the packet's literal `git show <file> \| sha256sum` returns the commit banner, not content |
| Module Hub and MT01 really opened, HEAD commits quoted, bilingual-UI coverage answer stated plainly | MET | sections 4 and 5 (`cd88c570…`, `92139cf…`; "there is no module in Module Hub that covers bilingual UI or i18n") |
| Thai-surface inventory quotes the real command output including per-file counts | MET | section 6.1, 16 lines pasted verbatim, command shown exactly as specified |
| LINE owner-facing surfaces named separately and server-side message builders identified | MET | section 6.2 — 4 pages vs 2 builders (`lib/line-transport.ts`, `lib/integrations.ts`) |
| repository state quoted from git (HEAD, origin/master, status) and hosting destination answered from inspected files, undeterminable stated plainly | MET | section 7 — `c5980eb…` = `c5980eb…` EQUAL, status `?? docs/house-swarm-5a/`, hosting **not determinable**, quoting `TERMS_AND_PRIVACY.md:34`, `:3`, `CURRENT_STATUS.md:61` |
| no secret value and no database connection appears anywhere | MET | sections 2 and 8; D4/D5 show only tracked templates (`lib/env.ts`, `.env.example`) were listed by name, never opened; no `.env*`/`.secrets` file was read |
| no tracked file modified and no install/build/deploy/migration/network/git-write command run | MET | section 2 and the command log: every command is read-only (git read verbs, `grep`, `ls`, `head`, `cat`, `find`, `wc`, `sha256sum`, `git cat-file`); no `pnpm`/`npm`/network/git-write verb appears in the log |

---

## 11. Artifact identity

- Path: `D:/AI-Workspace/runtime/worktrees/house-swarm-5a/docs/house-swarm-5a/WU0-PREFLIGHT-REUSE.md`
- The byte count and sha256 of this document are reported with the work-unit result, produced by
  running, from the workspace root:

  ```bash
  wc -c docs/house-swarm-5a/WU0-PREFLIGHT-REUSE.md
  sha256sum docs/house-swarm-5a/WU0-PREFLIGHT-REUSE.md
  git status --porcelain
  ```

  They are deliberately **not** written into this document: embedding the digest would change the
  file and therefore invalidate the value it quoted. Re-run the three commands above to verify the
  delivered file independently.

Nothing else was created. No file was modified. No file was deleted. No tracked file was changed
(`git status --porcelain` shows only the untracked `docs/house-swarm-5a/` directory).

*End of WU-0 read-only preflight. STATE for this unit is reported to the commander; this document
does not approve its own work.*
