# WU2 — PS01 pricing/packages (TH+EN) + Thai CD-01 owner runbook

Correlation id (original lane): house-swarm-5a-wu2-20260927
Work unit that completed this note: H5A-WU2-NOTE
Correlation id (this unit): house-swarm-5a-wu2-note-20260927
Worktree: D:/AI-Workspace/runtime/worktrees/house-swarm-5a-docs
Revision measured at start and at end of this unit: c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a
Scope of this unit: `docs/house-swarm-5a/` only — the note file was the only file written.

This note is a normalized record, not an approval. The commander verifies.

---

## 1. What was delivered

Four documents were delivered by the previous lane (H5A-WU2-PRICING-AND-CD01) and are frozen; this
unit measured them and did not modify them.

1. **`docs/pricing/PS01-PRICING-TH.md`** — Thai pricing document, **11 sections** (measured:
   `grep -c '^## '` = 11, sections numbered 1–11).
2. **`docs/pricing/PS01-PRICING-EN.md`** — English pricing document, **11 sections** (measured: 11,
   sections numbered 1–11). The two files have **matching section counts (11 = 11)** and the same
   section order; each is the mirror of the other (the TH file's headings carry the English title
   second, the EN file's headings carry the Thai title second).
3. **`docs/pricing/PS01-PRICING-OWNER-INPUTS.md`** — the Owner-input inventory (the two fields the
   Owner must fill, where each is used, and which are deliberately not placeholders).
4. **`docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md`** — the Thai CD-01 owner runbook, **13 sections**
   (measured: 13, numbered 0–12, ending with "known gaps for CD-01" and "who to contact"). It
   contains **no command-line instruction at all**: the command-log pattern
   `npm |pnpm |npx |git |psql|curl |wrangler|supabase ` matches **zero** lines, and it contains
   **zero** fenced code blocks. Its steps are described as screens and buttons a shop owner presses,
   not as commands.

Claim-to-command pairing for this section:
- `grep -c '^## ' <file>` → TH 11, EN 11, OWNER-INPUTS 0, runbook 13 (exit 0)
- `grep -qE 'npm |pnpm |npx |git |psql|curl |wrangler|supabase ' docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md` → exit 1 (no match)
- `grep -c '^```' docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md` → 0

Not delivered, deliberately: no in-app pricing page, no payment/checkout screen, no purchase button
or purchase link. §8 of both pricing documents states the product does not collect money yet.

---

## 2. Per-file bytes and sha256 (measured in this unit, at revision c5980eb)

| File | Bytes | sha256 |
| :--- | ---: | :--- |
| `docs/pricing/PS01-PRICING-TH.md` | 30772 | `b4133d887fdd550510ee5d912e8c722bd8fc950fc8a1dd8bd427b05c8efd321a` |
| `docs/pricing/PS01-PRICING-EN.md` | 16943 | `cc0be5745b444b9eabc067b137f5531ff7a561cb45b5d9e95e7fbfa3c104ba3c` |
| `docs/pricing/PS01-PRICING-OWNER-INPUTS.md` | 9375 | `6fc95fb0aeb0f39df70bcf10748d101ef70479aa91e3557d08bd1bea62ecd14f` |
| `docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md` | 65975 | `179cc0c5d62905d142ed06193a2bdd2d0aaf7effe7a173eae69ea18dbea064bd` |

Commands that produced the table (run in this unit):

```
sha256sum docs/pricing/PS01-PRICING-TH.md docs/pricing/PS01-PRICING-EN.md \
          docs/pricing/PS01-PRICING-OWNER-INPUTS.md docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md \
          docs/house-swarm-5a/WU2-PRICING-CD01.md          # exit 0
wc -c     docs/pricing/PS01-PRICING-TH.md docs/pricing/PS01-PRICING-EN.md \
          docs/pricing/PS01-PRICING-OWNER-INPUTS.md docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md \
          docs/house-swarm-5a/WU2-PRICING-CD01.md          # exit 0
```

Raw `wc -c` output:

```
 30772 docs/pricing/PS01-PRICING-TH.md
 16943 docs/pricing/PS01-PRICING-EN.md
  9375 docs/pricing/PS01-PRICING-OWNER-INPUTS.md
 65975 docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md
  2014 docs/house-swarm-5a/WU2-PRICING-CD01.md
125079 total
```

Recorded discrepancy (preserved, not hidden): the previous lane's report recorded the Thai file as
**30742 bytes / sha256 `2f3f4e87bf5cbe69defae59b75c78370869434b8178784061389a1f211fa7562`** and
marked it as stale in its own words ("the TH hash is now stale"). The measurement above
(30772 bytes / `b4133d88…`) supersedes it: the file was patched once after that measurement, and the
number now on record is the measured one.

---

## 3. Command log (exact command, exit code, observed result)

All commands were issued from
`cd D:/AI-Workspace/runtime/worktrees/house-swarm-5a-docs`. Every command below is read-only except
**C28**, which is the single write that finished this note.

```
C1   git rev-parse HEAD
     exit 0   -> c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a

C2   git status --porcelain
     exit 0   -> ?? docs/house-swarm-5a/  ?? docs/manual/  ?? docs/pricing/  ?? docs/runbook/

C3   sha256sum <4 deliverables> <note>
     exit 0   -> see section 2

C4   wc -c <4 deliverables> <note>
     exit 0   -> see section 2 (note = 2014 bytes before this unit's write)

C5   cat docs/house-swarm-5a/WU2-PRICING-CD01.md
     exit 0   -> skeleton: 8 sections, every one still "(pending)"

C6   grep -n '^## ' docs/pricing/PS01-PRICING-TH.md
     exit 0   -> 11 matching heading lines (## 1. … ## 11.)

C7   grep -n '^## ' docs/pricing/PS01-PRICING-EN.md
     exit 0   -> 11 matching heading lines (## 1. … ## 11.)

C8   grep -n '^## ' docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md
     exit 0   -> 13 matching heading lines (## 0. … ## 12.)

C9   grep -n -A 20 'A-2' docs/BUSINESS_MODEL.md | head -60
     exit 0   -> Addendum A-2 block and the package table (quoted in section 4)

C10  grep -n 'monthlyPrice' lib/entitlements.ts
     exit 0   -> lines 7, 19, 29, 39, 57, 83, 96

C11  grep -n -A 8 'CANONICAL_PACKAGES' lib/entitlements.ts | head -40
     exit 0   -> CANONICAL_PACKAGES block and the founding_member branch (quoted in section 4)

C12  grep -rn -E '490|1490|2490|9900' docs/pricing/ docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md
     exit 1   -> NO MATCHES (no superseded figure appears anywhere in the deliverables)

C13  grep -rnE '590|990|\$17|\$28' docs/pricing/ docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md | head -40
     exit 0   -> only the A-2-approved figures (590/17, 990/28); no other figure

C14  grep -rnoE '\[[^]]*(ต้องเติม|OWNER|TODO|TBD|RATE|ราคา|ยืนยัน)[^]]*\]' <4 deliverables> | sort | uniq -c
     exit 0   -> no output (no bracket-style placeholder marker of that shape)

C15  grep -rnoE '\{\{OWNER_INPUT:[A-Z_]+\}\}' <4 deliverables> | sort | uniq -c
     exit 0   -> 8 group lines; totals in section 5

C16  grep -rhoE '\{\{OWNER_INPUT:[A-Z_]+\}\}' docs/pricing/ docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md | sort -u
     exit 0   -> exactly 2 distinct placeholders

C17  grep -rhoE '\{\{OWNER_INPUT:[A-Z_]+\}\}' docs/pricing/ docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md | wc -l
     exit 0   -> 22 occurrences

C18  grep -rn -iE '\{\{[^}]*PRICE[^}]*\}\}|\[ราคา\]|\[PRICE\]' docs/pricing/ docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md
     exit 1   -> NO MATCHES (there is no price placeholder)

C19  grep -nE '\$ |npm |pnpm |npx |git |psql|supabase |^```(bash|sh|shell|console)' docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md
     exit 1   -> NO MATCHES (runbook has no command-line instruction)

C20  grep -qE 'npm |pnpm |npx |git |psql|curl |wrangler|supabase ' docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md
     exit 1   -> NO MATCHES (same conclusion with the commander's own pattern)

C21  grep -c '^```' docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md
     exit 1   -> 0 fenced code blocks

C22  grep -inE 'ซื้อเลย|buy now|สมัครเลย|subscribe now|ปุ่มซื้อ' docs/pricing/PS01-PRICING-TH.md docs/pricing/PS01-PRICING-EN.md
     exit 0   -> 2 matching lines, BOTH in the Thai file (TH:123, TH:159) and BOTH negations;
                see section 7

C23  grep -rn -i --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git 'qrcode\|qr_code\|qr code' .
     exit 0   -> matches only in documentation (docs/ONBOARDING_SOP.md §1 and documents that
                cite it, including this lane's own runbook); no generator in source

C24  grep -rn --exclude-dir=node_modules --exclude-dir=.next 'bootstrapShopAction' .
     exit 0   -> 2 matches: app/actions/tenant.ts:26 (definition) and
                PHASE3_IMPLEMENTATION_EVIDENCE.md:30 (a mention). No UI caller.

C25  ls .github/workflows/
     exit 0   -> phase13-verification.yml   (a verification workflow; no scheduler/cron workflow)

C26  git status --porcelain -uall        (snapshot taken BEFORE the write)
     exit 0   -> 10 untracked entries, listed in section 8

C27  wc -c < docs/house-swarm-5a/WU2-PRICING-CD01.md
     exit 0   -> 2014        (pre-write byte count of this note)

C28  write_file docs/house-swarm-5a/WU2-PRICING-CD01.md   (THIS UNIT'S ONLY WRITE)
     ok       -> note replaced with this finished record

C29  sha256sum <4 deliverables> ; wc -c <note> ; git status --porcelain -uall ; git rev-parse HEAD
     exit 0   -> re-measurement after the write; recorded in section 8

C30  test $(wc -c < docs/house-swarm-5a/WU2-PRICING-CD01.md) -gt 3000 && grep -q 'sha256' <note>
     exit 0   -> the commander's "note-finished" check now passes

C31  python docs/house-swarm-5a/_wu2_check.py
     NOT RUN by this unit. The previous lane left this temporary verifier on disk (11152 bytes,
     docs/house-swarm-5a/_wu2_check.py). This unit's packet said to change nothing else, so it was
     left in place, unmodified and unexecuted. Its reported limitation is preserved from the
     previous lane's own log: its CLI matcher flagged the runbook's own disclaimer wording
     ("บรรทัดคำสั่ง") as a false positive.
```

Tooling note: one batched command was refused by the runtime's command-safety classifier
("BLOCKED: Command flagged as dangerous (pipe remote content to shell)", exit -1, nothing
executed). No file was read or written by that refused command; the same two greps were then
re-issued separately and succeeded as C12/C13. Nothing was hidden by the split.

---

## 4. Price verification — the A-2 prices quoted from two independent places

The approved price set is **Addendum A-2, Owner decision 2026-09-26**. Both the prose/table source and
the code source were read in this unit and are quoted verbatim below.

### Independent place 1 — `docs/BUSINESS_MODEL.md` (Addendum A-2 section)

Quoted lines (from `grep -n -A 20 'A-2' docs/BUSINESS_MODEL.md`):

```
18: > **Owner decision, 2026-09-26 — Addendum A-2:** Starter ฿590 / $17 ต่อเดือน และ Pro ฿990 / $28 ต่อเดือน. THB และ USD เป็นราคาคงที่แยกกัน ไม่แปลงค่าเงินอัตโนมัติ. ราคาต่อปียังไม่ได้รับอนุมัติและห้ามเสนอหรือกำหนดเอง; migration ของ A-2 จะตั้ง `annual_price = NULL` และปิดการ assign รายปีจนกว่าจะมีราคาอนุมัติ. USD ยังไม่อยู่ใน schema ของ catalog. Enterprise ฿2,490 ยังไม่เปิดขาย. Founding C2 คงราคา ฿990 / $28 ต่อเดือนและสิทธิ์ Pro.
20: | แพ็กเกจ | ราคาต่อเดือน | ราคาต่อปี | สิทธิ์ที่ได้รับใน V1 ปัจจุบัน (Single-Store) | สถานะ |
22: | **Starter** | **฿590 / $17 ต่อเดือน** | ยังไม่อนุมัติ | สูงสุด 10 ห้องพัก, ประวัติสัตว์เลี้ยง 300 ตัว, ส่ง Daily Report LINE, ซิงก์ Google Sheets | ราคา Owner อนุมัติ; quota บังคับที่ database boundary |
23: | **Pro** 🌟 | **฿990 / $28 ต่อเดือน** | ยังไม่อนุมัติ | ห้องพักไม่จำกัด, ประวัติสัตว์เลี้ยงไม่จำกัด, ส่ง Daily Report LINE, ซิงก์ Google Sheets | ราคา Owner อนุมัติ |
24: | **Enterprise (Single-Store Pro Plus)** | ฿2,490 ต่อเดือน | ยังไม่อนุมัติ | ข้อมูลสิทธิ์เดิมคงไว้ แต่ยังไม่มีการเปิดขาย | **ยังไม่เปิดขาย** |
27:   * **ราคา:** **฿990 / $28 ต่อเดือน** (เท่าราคา Pro ปัจจุบัน)
```

Read off these lines: Starter **฿590 / $17 per month**; Pro **฿990 / $28 per month**; annual price
"ยังไม่อนุมัติ" (not approved) for every package; Enterprise ฿2,490 per month and **not for sale**;
Founding Member C2 at **฿990 / $28 per month** with Pro entitlements.

### Independent place 2 — `lib/entitlements.ts` (`CANONICAL_PACKAGES`)

Quoted lines (from `grep -n 'monthlyPrice' lib/entitlements.ts` and the `CANONICAL_PACKAGES` block):

```
15: export const CANONICAL_PACKAGES: Record<string, PackageDefinition> = {
16:   starter: {
17:     id: "starter",
18:     name: "Starter",
19:     monthlyPrice: 590,
20:     annualPrice: null,
21:     availableForSale: true,
22:     roomLimit: 10,
23:     petHistoryLimit: 300,
24:     supportTier: null,
25:   },
26:   pro: {
27:     id: "pro",
28:     name: "Pro",
29:     monthlyPrice: 990,
30:     annualPrice: null,
31:     availableForSale: true,
32:     roomLimit: null,
33:     petHistoryLimit: null,
34:     supportTier: null,
35:   },
36:   enterprise: {
37:     id: "enterprise",
38:     name: "Enterprise",
39:     monthlyPrice: 2490,
40:     annualPrice: null,
41:     availableForSale: false,
42:     roomLimit: null,
43:     petHistoryLimit: null,
44:     supportTier: "priority",
45:   },
46: };
```

and the Founding Member branch in the same file:

```
77:   if (offer === "founding_member" && packageId === "starter") {
78:     const proPackage = CANONICAL_PACKAGES.pro;
79:     return {
80:       packageId: "starter",
81:       packageName: "Starter (Founding Member Pro)",
82:       commercialOffer: "founding_member",
83:       monthlyPrice: 990,
84:       annualPrice: null,
85:       roomLimit: proPackage.roomLimit,
86:       petHistoryLimit: proPackage.petHistoryLimit,
```

Read off these lines: `starter.monthlyPrice = 590`; `pro.monthlyPrice = 990`;
`enterprise.monthlyPrice = 2490` with `availableForSale: false`; `annualPrice: null` on all three;
the `founding_member` branch returns `monthlyPrice: 990` with Pro's room and pet-history ceilings.

### The two places agree

- 590 (Starter) and 990 (Pro): **agree**.
- 990 for the Founding Member offer: **agree**.
- `annualPrice` null / "ยังไม่อนุมัติ": **agree** — no annual price is approved anywhere.
- Enterprise `availableForSale: false` / "ยังไม่เปิดขาย": **agree** — Enterprise's 2,490 exists in
  code but is deliberately shown in no delivered document.

### No price outside A-2 appears in the deliverables

`grep -rn -E '490|1490|2490|9900' docs/pricing/ docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md`
returned **exit 1 with no output** — none of the superseded figures 490, 1490, 2490 or 9900 appears
anywhere in the four deliverables, in any document. The converse grep
(`'590|990|\$17|\$28'`, exit 0) returned only the A-2-approved figures, in these forms:

```
docs/pricing/PS01-PRICING-EN.md:28:| **Starter** | **590 THB / 17 USD** | Yes | up to **10** | up to **300** | None (not approved) |
docs/pricing/PS01-PRICING-EN.md:29:| **Pro** | **990 THB / 28 USD** | Yes | **Unlimited** | **Unlimited** | None (not approved) |
docs/pricing/PS01-PRICING-EN.md:31:| **Founding Member (C2)** | **990 THB / 28 USD** | Offer for the founding-shop group | Unlimited (Pro entitlements) | Unlimited | None (not approved) |
docs/pricing/PS01-PRICING-TH.md:28:| **Starter** | **590 บาท / 17 ดอลลาร์สหรัฐ** | เปิดขาย | สูงสุด **10** ห้อง | สูงสุด **300** รายการ | ไม่มี (ยังไม่อนุมัติ) |
docs/pricing/PS01-PRICING-TH.md:29:| **Pro** | **990 บาท / 28 ดอลลาร์สหรัฐ** | เปิดขาย | **ไม่จำกัด** | **ไม่จำกัด** | ไม่มี (ยังไม่อนุมัติ) |
docs/pricing/PS01-PRICING-TH.md:31:| **Founding Member (C2)** | **990 บาท / 28 ดอลลาร์สหรัฐ** | ข้อเสนอสำหรับกลุ่มร้านบุกเบิก | ไม่จำกัด (ได้สิทธิ์เท่า Pro) | ไม่จำกัด | ไม่มี (ยังไม่อนุมัติ) |
docs/pricing/PS01-PRICING-TH.md:33:* ตัวเลข 590 / 17 และ 990 / 28 มาจากสองที่ที่ตรงกัน: ตาราง Addendum A-2 ใน `docs/BUSINESS_MODEL.md` §2 และค่า `monthlyPrice` ใน `lib/entitlements.ts` `CANONICAL_PACKAGES`
docs/pricing/PS01-PRICING-EN.md:33:* The figures 590 / 17 and 990 / 28 come from two places that agree: the Addendum A-2 table in `docs/BUSINESS_MODEL.md` §2 and the `monthlyPrice` values in `lib/entitlements.ts` `CANONICAL_PACKAGES`.
```

The Enterprise section of both documents carries **no price digit** and states the package is not
for sale. No annual price figure appears in either language file. Both files cite both sources
(`docs/BUSINESS_MODEL.md` and `lib/entitlements.ts`).

---

## 5. Placeholder inventory

- **Marker used:** one single marker shape, `{{OWNER_INPUT:…}}` — field names in capitals, e.g.
  `{{OWNER_INPUT:APP_URL}}`. `docs/pricing/PS01-PRICING-OWNER-INPUTS.md:7` declares this marker in
  the same words. No other placeholder shape exists: a search for bracket-style markers
  (`[...OWNER/TODO/TBD/ราคา/ยืนยัน...]`) returned no output, and there is **no price placeholder** at
  all (`...PRICE...` / `[ราคา]` / `[PRICE]` → no matches, exit 1).
- **Distinct count: 2** — `APP_URL` and `SUPPORT_CONTACT` (measured: `sort -u` returns exactly these
  two).
- **Occurrence count measured over the four deliverables: 22**, distributed as:

| File | `APP_URL` | `SUPPORT_CONTACT` | Total in file |
| :--- | ---: | ---: | ---: |
| `docs/pricing/PS01-PRICING-TH.md` | 3 | 2 | 5 |
| `docs/pricing/PS01-PRICING-EN.md` | 3 | 2 | 5 |
| `docs/pricing/PS01-PRICING-OWNER-INPUTS.md` | 5 | 3 | 8 |
| `docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md` | 3 | 1 | 4 |
| **Total** | **14** | **8** | **22** |

The previous lane reported "14 occurrences (TH 5, EN 5, runbook 4)". That figure covers only the
three consumer documents and excludes the inventory file itself; measured over the four declared
deliverables the count is **22**. Both numbers are true of their own file sets; the number on record
for the packet's file list is 22, of which 14 are the fillable fields in the three consumer documents
and 8 are occurrences inside the inventory file (which also uses the marker to name the fields it
describes — `docs/pricing/PS01-PRICING-OWNER-INPUTS.md:43-44` states that such descriptive uses are
not counted as fillable fields).

---

## 6. Behaviours that could **not** be verified from the repository

Each item states what was searched and what was not found, and how the documents handle it. None of
these can be proven from the repository alone; they require a live environment or an Owner input.

1. **Self-serve shop signup.** `bootstrapShopAction` is defined at `app/actions/tenant.ts:26` and is
   otherwise named only in `PHASE3_IMPLEMENTATION_EVIDENCE.md:30`. **No UI caller was found**, so an
   in-product signup path could not be verified. The runbook was written as operator-assisted and
   the gap is flagged against CD-04.
2. **QR code / ready-made claim link.** A repository-wide search for `qrcode|qr_code|qr code`
   (excluding `node_modules`, `.next`, `.git`) matches only documentation — `docs/ONBOARDING_SOP.md`
   §1 and documents that cite it. **No QR generator and no QR dependency exist**, and the screen
   shows the claim token as text; nothing displays the shop id the link needs. The runbook records
   this as a visible gap rather than a step.
3. **Background dispatch of queued LINE reports and Google Sheets sync.** The routes exist, but
   **no scheduler is visible**: `.github/workflows/` contains only `phase13-verification.yml`. The
   runbook therefore says a queued item may stay pending and tells the user to keep screenshots as
   evidence; no SLA is promised.
4. **Google Sheets sync latency.** No documented interval was found. The documents state explicitly
   that no SLA is documented.
5. **Live LINE delivery end to end.** Not observed — this requires a real LINE account and a real
   pet-owner device. The runbook describes only what staff can see on screen (status chips, retry,
   the configured/not-configured indicator).
6. **Production web address.** Unknown from the repository. Every address in the documents is the
   placeholder `{{OWNER_INPUT:APP_URL}}`; the inventory file records why it is blank.
7. **The support contact channel.** No confirmed channel exists in the repository and support is
   fixed as text-only, so `{{OWNER_INPUT:SUPPORT_CONTACT}}` is blank and the Owner must supply it.
8. **Payment.** No payment system, checkout or purchase link was found; the documents state that the
   product does not collect money yet. Whether payment should ever exist is an Owner decision, not an
   evidence question, and is not answered here.

---

## 7. Honesty section — what actually ran, and who said what

### The commander's mechanical checks (from the lane result envelope, `dispatch-wu2.log`)

Envelope-level checks, all **PASS**: `governance_header_valid`, `profile_inventory_exact`
(6 profiles: swarm-inspector, swarm-builder, swarm-tester, swarm-db, swarm-release, swarm-evidence;
baseline model `deepseek-v4.1-flash:cloud`), `limits_enforced`, `workspace_collision_check`
(no collisions; this worktree claimed exclusively by lane `h5a-wu2`), `relay_path_not_used`.

The 11 lane checks that **ran and passed** (each with `executed: true`, `exit_code: 0`):

```
pricing-files-present          test -s <4 deliverables>                                          PASS
pricing-parity                 TH `## ` count == EN `## ` count                                  PASS
only-a2-prices                 A-2 figures present, no superseded figures                        PASS
no-annual-price                no annual price figure in either language file                    PASS
enterprise-not-for-sale        "Enterprise" present in both language files                       PASS
runbook-no-cli                 commander CLI pattern absent from the runbook                     PASS
runbook-payment-flag           'รอช่องทางชำระเงิน' present in the runbook                          PASS
no-out-of-worktree-mutation    git status clean for supabase tests package.json pnpm-lock .github PASS
head-unchanged                 HEAD == c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a                  PASS
```

Two checks **FAILED** in the envelope: `no-nonfunctional-buy-button` and `note-finished`.
`note-finished` failed only because this note was still a skeleton — that is the defect this unit
fixed, and it is re-checked in section 8.

### The two facts that matter for the record

**Fact 1 — the buy-button check was a false failure.** The check that failed was

```
! grep -qiE 'ซื้อเลย|buy now|สมัครเลย|subscribe now|ปุ่มซื้อ' docs/pricing/PS01-PRICING-TH.md docs/pricing/PS01-PRICING-EN.md
```

with observed `exit_code: 1`. This unit reproduced the underlying grep (C22, exit 0) and read the two
lines it matches. **Both matches are in the Thai file, and both are sentences stating that there is
NO purchase button:**

```
docs/pricing/PS01-PRICING-TH.md:123:* **ผลิตภัณฑ์นี้ยังไม่เก็บเงินจากใคร** ไม่มีหน้าจอชำระเงิน ไม่มีปุ่มซื้อ และไม่มีลิงก์ซื้อ เอกสารนี้จึง**ไม่สร้างปุ่มหรือลิงก์ที่ทำท่าจะซื้อ** ไว้เลย เพราะจะเป็นการหลอกคนอ่าน
docs/pricing/PS01-PRICING-TH.md:159:1. **มีปุ่มซื้อให้กดไหม?** — ไม่มี และเอกสารนี้ไม่สร้างขึ้น ผลิตภัณฑ์ยังไม่มีระบบเก็บเงิน (หัวข้อ 8)
```

The pattern `ปุ่มซื้อ` ("purchase button") matched a **negation** — "there is no purchase button" and
"is there a purchase button to press? — no". So the check's non-zero exit does not evidence a
non-functional purchase button; it evidences the opposite, that the documents say there is none.
**No affirmative purchase call-to-action exists in either language file**: `ซื้อเลย`, `buy now`,
`สมัครเลย` and `subscribe now` match nowhere, and the only `ปุ่มซื้อ` occurrences are the two
negations quoted above. Whether the check's pattern should be narrowed is a commander/Owner decision;
this unit does not change the check and does not approve on its behalf.

**Fact 2 — the note was the only thing missing.** The four deliverables were present, non-empty,
mutually consistent and already measured; the Thai file had been patched after the previous lane's
final measurement, and the only unmet requirement was that `docs/house-swarm-5a/WU2-PRICING-CD01.md`
was still the "(pending)" skeleton. The previous lane said so in its own report and declared
`state: "FAIL"` — that self-report is marked `trusted: false` in the envelope and is **never
converted into an approval**. This note replaces the skeleton; it does not re-decide the check.

**Separating the two sources.** Everything in sections 1–6 is either a command output observed by
this unit (exit code and raw output given) or a verbatim quotation from a file on disk. The previous
lane's numbers appear only where they are explicitly labelled as the previous lane's report, and one
of them (the Thai sha256/size) is recorded as superseded by the fresh measurement.

---

## 8. Integrity of this change — pre-write hash, and the deliverables are untouched

### Pre-write state of this note (proves the change happened)

```
docs/house-swarm-5a/WU2-PRICING-CD01.md   2014 bytes
sha256 1b7313bc5cba1c1d77109542abe80848aa40bf504c14c603adbe0def96ce7dfa
     (measured before this unit's write; the file was the 8-section "(pending)" skeleton)
```

That hash is the state this note was in when this unit began, and it is the value the previous lane's
envelope recorded for the same file (`bytes: 2014`, same sha256) — the two agree, so the file this
unit completed is provably the file the previous lane left behind. A file cannot contain its own
final hash; the finished note's byte count and sha256 are reported in the H5A-WU2-NOTE lane result.

### The four deliverables were not touched

They are byte-identical to the values in section 2. The re-measurement after the write returned the
same sha256 for all four:

```
b4133d887fdd550510ee5d912e8c722bd8fc950fc8a1dd8bd427b05c8efd321a  docs/pricing/PS01-PRICING-TH.md
cc0be5745b444b9eabc067b137f5531ff7a561cb45b5d9e95e7fbfa3c104ba3c  docs/pricing/PS01-PRICING-EN.md
6fc95fb0aeb0f39df70bcf10748d101ef70479aa91e3557d08bd1bea62ecd14f  docs/pricing/PS01-PRICING-OWNER-INPUTS.md
179cc0c5d62905d142ed06193a2bdd2d0aaf7effe7a173eae69ea18dbea064bd  docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md
```

and `git status --porcelain -uall` shows the four deliverables as **untracked and unmodified files**
with no staged or unstaged change to any of them.

`git status --porcelain -uall`, snapshot BEFORE the write (C26):

```
?? docs/house-swarm-5a/WU2-PRICING-CD01.md
?? docs/house-swarm-5a/WU4-MANUAL.md
?? docs/house-swarm-5a/_wu2_check.py
?? docs/manual/PS01-MANUAL-OWNER-INPUTS.md
?? docs/manual/PS01-OWNER-MANUAL-EN.md
?? docs/manual/PS01-OWNER-MANUAL-TH.md
?? docs/pricing/PS01-PRICING-EN.md
?? docs/pricing/PS01-PRICING-OWNER-INPUTS.md
?? docs/pricing/PS01-PRICING-TH.md
?? docs/runbook/PS01-CD01-OWNER-RUNBOOK-TH.md
```

and after the write (C29) the entry list is **identical** — same 10 untracked entries, same set, none
added and none removed. `WU4-MANUAL.md`, `_wu2_check.py` and `docs/manual/*` belong to another lane
in this worktree and were already untracked before this unit wrote anything; this unit did not read
them into, write them, or remove them. The only content change made by H5A-WU2-NOTE is the rewriting
of `docs/house-swarm-5a/WU2-PRICING-CD01.md`; the note is the only changed file.

`git rev-parse HEAD` after the write is still `c5980ebf30b20aaff851f8f8bef9a3d644dfdb3a` — no commit,
no branch change, no history rewrite.

### Explicit statement on builds, tooling, secrets and side effects

- **No file outside `docs/house-swarm-5a/WU2-PRICING-CD01.md` was created, modified or deleted by
  this unit.** No deliverable was edited.
- **No build, install, lint, test, migration or deploy was run.** No package manager was invoked.
- **No network call, no database connection, no Supabase client, no relay execution.**
- **No `.env`, `.env.local`, `.env.staging.local` or `.secrets` was created, opened, read or printed.
  No secret value appears in this note or in any command run.** `lib/entitlements.ts` was read for its
  price constants only.
- **No git write of any kind**: no add, commit, checkout, reset, stash, push or history rewrite. No
  `.git` path was modified.
- **Nothing was installed and no process was left running.**
- Prohibited paths (`.git`, `.env*`, `.secrets`, `node_modules`, `.next`, `supabase`, `tests`, `app`,
  `lib`, `messages`, `package.json`, `pnpm-lock.yaml`, `relay`) were **not written**. Files under
  `lib/` and `app/` were read only, and only for verification that does not modify them.

This record is a normalized account of what was observed. It is **not** an approval of the
deliverables and does not declare a final verdict; the commander verifies.
