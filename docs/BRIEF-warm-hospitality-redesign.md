# Pawstia — Warm Hospitality Redesign

Status: **PLANNED / DESIGN-ONLY**
Project: `PawSpace` (`Gutumrod/pawspace`, internal `PS01`)
Design source of truth: `docs/Design.md` (rewritten 2026-08-30)
Baseline commit: `a13f2ba` (master, clean)
Module Hub gate: **NOT NEEDED** — no new capability or reusable backend module.

---

## 0. Dispatch — how to run this end to end

This brief is the complete package. Hand it to the implementer as-is.

**Sequence (team routing per `vault/00-System/Decisions/team-structure.md`):**

| Stage | Owner | Produces |
|---|---|---|
| 1. Implement | **Codex** (codebase-integrated change, behavior-freeze discipline) — AGY may do a visual preflight against `docs/Design.md` + `docs/design-reference/warm-hospitality/` but is not required | Working tree change on a branch off `master`; `docs/WARM_HOSPITALITY_IMPLEMENTATION_EVIDENCE.md`; raw output of static gates + Phase 10 E2E |
| 2. Independent QA | **Qwen Code** (must NOT be whoever implemented) | Blind review verdict: diff is presentation-only, no forbidden files, no BOM, behavior preserved, states present, contrast/targets hold, responsive at 320/375/768/1280 across all 8 surfaces. Raw evidence (log / commit hash / screenshots) reviewable by a third party |
| 3. Commander Final Review Gate | **Claude (Commander)** | Opens the raw evidence directly (not just QA's summary). PASS → merge to `master`. Any defect → back to Stage 1 owner |

**Entry point for the implementer:** §7 step 1 (Inspect). Read in this order:
`docs/Design.md` → this brief → `docs/design-reference/warm-hospitality/`
(images 01–06 + page-01-*; skip 07–10) → `git show wip/warm-hospitality-design-c-2026-08-28`
(reference only) → the 8 target files at `master`.

**Do not** start Stage 2 or 3 early, skip the evidence doc, or let the
implementer self-certify (team rule 2026-08-25: verification evidence must
come from a different agent with reviewable raw artifacts).

---

## 1. Purpose

เปลี่ยน visual direction ของ Pawstia ทั้งแอปจาก **"Apple-inspired Soft-3D
pastel"** (ของเดิม) เป็น **"Warm Hospitality"** — flat, warm, editorial —
ตามที่ CEO อนุมัติ (design C) เมื่อ 2026-08-30

หลักการสูงสุด:

> **Visual refactor only. Preserve behavior exactly.**

ถ้าการเปลี่ยนแปลงใดต้องแตะ business logic, RPC, database, authorization,
integration contract หรือ runtime behavior → **OUT OF SCOPE**, หยุดส่วนนั้น
ทันทีและรายงาน

## 2. Background — อ่านก่อนเริ่ม

- มีการทำ prototype ของ direction นี้ไปแล้วรอบ 2026-08-28 (login + customer
  surfaces) แต่ **ถูก revert ออกจาก master แล้ว** เพราะไม่ผ่าน hygiene
  (UTF-8 BOM หลุด 3 ไฟล์, มี fetch behavior change ปนใน presentation pass,
  ไม่มี evidence/review)
- Prototype นั้นเก็บไว้ที่ branch **`wip/warm-hospitality-design-c-2026-08-28`**
  — ใช้ **ดูเป็น reference ได้** (โดยเฉพาะ CSS tokens, login layout, paw
  animation keyframes) แต่ **ห้าม merge / ห้าม cherry-pick ทั้งดุ้น** ต้อง
  reimplement ใหม่ให้สะอาดตาม brief นี้
- `docs/design-reference/warm-hospitality/` = **visual target ที่
  อนุมัติแล้ว**:
  - `01-06` = design C ที่ implement จริง (login desktop/mobile, camera,
    line-claim, accept-invite, line-book)
  - `page-01-*` = login เวอร์ชันล่าสุด + เฟรม animation 250ms / 650ms
  - `07-10` prefix `chatgpt-` = mockup สำรวจ **ไม่ใช่ target** (โทนเขียว /
    layout ต่าง) — ข้าม
- `docs/Design.md` เขียนใหม่หมดแล้วสำหรับ direction นี้ — เป็น spec หลัก

## 3. Scope — ทั้งแอป

### 3.1 Public / customer surfaces (5)

| Route | ไฟล์หลัก |
|---|---|
| `/login` | `app/login/page.tsx` |
| `/line/claim` | `app/line/claim/page.tsx`, `app/line/claim/LineClaimClient.tsx` |
| `/line/book` (LIFF) | `app/line/book/page.tsx` + `.liff-*` ใน `app/globals.css` |
| `/camera/[shopSlug]` | `app/camera/[shopSlug]/camera-access-client.tsx` |
| `/auth/accept-invite` | `app/auth/accept-invite/**` |

### 3.2 App shell — dashboard & operations

| Route | ไฟล์หลัก |
|---|---|
| `/` Operations | `app/operations-client.tsx` |
| `/dashboard` | `app/dashboard/page.tsx` |
| `/onboarding` | `app/onboarding/**` |
| shared shell / tokens | `app/globals.css` |

`app/globals.css` ปัจจุบันมี design language เดิม (blue primary, gradient
cards, Soft-3D shadow, blue nav tint) ต้องแปลงเป็น Warm Hospitality ตาม
`Design.md` §3, §5, §9 — รวมถึงลบ `linear-gradient(...)` บน `.card`,
`.room-card`, `.sidebar`, `.brand-mark` และเอา `translateY` lift ออกจาก
`.room-card` / `.nav-item` glow

### 3.3 อนุญาตให้แตะ

- CSS / design tokens / responsive styles ใน `app/globals.css`
- presentational markup/layout ใน route ด้านบน
- SVG line-art / paw motif (decorative, ไม่มี data semantics)
- `prefers-reduced-motion` rules, focus-visible presentation
- แตก **dumb/presentational component** ได้ (`Button`, `Card`, `Badge`,
  `Input`, ...) ถ้าไม่ย้าย/เปลี่ยน business logic

## 4. Hard No-Touch Boundary

ห้ามแก้ทุกกรณี:

- `supabase/migrations/**`, schema, tables, RLS, grants, RPC, `supabase/config.toml`
- authentication / session behavior
- authorization / Owner–Manager–Staff role matrix
- tenant resolution / tenant isolation
- `app/actions/**` server actions และ validation logic
- `lib/*` service / DAL behavior, query semantics, entitlement/commercial logic
- booking / customer / pet / room lifecycle rules
- Daily Report creation / storage / queue / retry / LINE delivery
- Google Sheets verification / sync
- LINE claim/reset behavior, **camera access/stream/feed behavior**
- `app/api/**` routes และ HTTP status semantics
- `.env*`, credentials, secrets, deployment config
- `package.json` / lockfile (ห้ามเพิ่ม dependency — ทำด้วย CSS + SVG ที่มีอยู่)
- E2E fixtures / test expectations เพื่อให้ design change ผ่านแบบหลอก
- Phase 10–13 evidence / runbook / history

**ห้ามสร้าง migration ใหม่**

### 4.1 บทเรียนจาก prototype รอบก่อน — อย่าทำซ้ำ

1. **ห้ามมี UTF-8 BOM** — prototype รอบก่อน `login/page.tsx`,
   `line/claim/page.tsx`, `LineClaimClient.tsx` มี BOM (`EF BB BF`) หลุดมา
   จาก editor. ทุกไฟล์ต้องเป็น UTF-8 ไม่มี BOM, LF line endings. เช็คด้วย
   `git diff` — บรรทัดแรกต้องไม่มี `﻿`
2. **camera = presentation only** — prototype รอบก่อนแอบเปลี่ยน `fetch()`
   options (`credentials`, `cache`, headers) ใน `camera-access-client.tsx`
   ห้ามทำ. ถ้าเห็นว่า fetch ควร hardening จริง → เขียนแยกเป็น note ใน
   evidence, อย่าใส่ใน pass นี้
3. **ต้องมี evidence + reviewer verdict** ก่อนถือว่าเสร็จ (§10)

## 5. Behavior Freeze

ก่อนแก้ ถือ behavior ปัจจุบัน (`a13f2ba`) เป็น frozen baseline:

- route เดิมครบ, action เดิมถูกเรียกด้วย payload/contract เดิม
- role เดิมเห็น/ทำสิ่งเดิมได้เท่าเดิม (Owner/Manager/Staff, dashboard =
  Owner+Manager only)
- destructive confirmation เดิมไม่ถูกลดทอน
- tenant boundary / server-client authority boundary ไม่เปลี่ยน
- success/error semantics ไม่ถูกซ่อนหรือแปลงจนเข้าใจผล
- Room Matrix / dashboard summary แสดงข้อมูลจริงจาก DB — **ห้ามเพิ่ม fake
  pet / room / KPI / placeholder** ที่อาจถูกเข้าใจเป็นข้อมูลจริง

## 6. Visual Targets

สูตรจาก `Design.md` §16:

`Warm paper + terracotta restraint + editorial serif + flat surfaces (one soft shadow) + one pet line-art per surface + explicit states`

ลำดับความสำคัญ:

1. information hierarchy + readability
2. consistent design tokens (`:root` ใน `globals.css` = single source)
3. responsive usability (ไม่มี horizontal scroll ทุก width ทุกหน้า)
4. accessible interactive states
5. Pawstia visual identity
6. decorative polish

ห้ามแลก usability / contrast กับความสวย

### Required visual states (ทุก interactive component)

`default / hover / focus-visible / pressed / disabled / loading / error|success (ตามที่ระบบเดิมมี) / reduced-motion`

- interactive target ≥ `44 × 44px`
- verify contrast: terracotta `#a55e45` บน `#fffaf5`, `--muted` `#756d66`
  บน `--surface`

### Login animation

ทำตาม `Design.md` §12 — paw-pop stagger + pet-reveal draw-in. **แก้ bug ที่
prototype มี:** ~650ms paw stamps หายชั่วขณะก่อน settle (ดู
`page-01-login-animation-650ms.png`) — per-element delay + fill-mode +
final opacity ต้องลงตัวให้ทุก stamp ค้างที่ `opacity:1`

## 7. Required Workflow

1. **Inspect** — อ่าน `Design.md`, `docs/design-reference/warm-hospitality/`, branch
   `wip/warm-hospitality-design-c-2026-08-28`, หน้า UI ปัจจุบัน, `globals.css`,
   git state จริง
2. **Baseline** — `git diff --name-only` = ว่าง; บันทึก behavior ที่ต้อง preserve
3. **Design Map** — map tokens/components → UI เดิม โดยไม่แตะ logic
4. **Implement** — presentation layer เท่านั้น; `:root` tokens ก่อน แล้วค่อย
   ไล่ทีละ surface
5. **Static Gates** — `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`,
   `git diff --check` (+ เช็ค BOM)
6. **Behavior Regression** — รัน Phase 10 E2E เดิม (`scripts/phase10-e2e.ps1`
   / `tests/e2e/phase10-pilot.spec.ts`) โดยห้ามแก้ expectation
7. **Visual Inspect** — 320 / 375 / 768 / 1280px ทุก surface; overflow, focus,
   loading/empty/error states, reduced-motion
8. **Diff Audit** — พิสูจน์ไม่มี forbidden file / logic change
9. **Reviewer Verdict** — PASS ต่อเมื่อ visual + behavior preservation ผ่านทั้งคู่

ถ้า E2E เดิม fail หลัง change = regression จนกว่าจะพิสูจน์ได้ว่า test มีปัญหา
— ห้ามแก้ test เพื่อให้ผ่าน

## 8. File Guardrail

คาดว่าแก้:

- `app/globals.css`
- `app/login/page.tsx`
- `app/line/claim/page.tsx`, `app/line/claim/LineClaimClient.tsx`
- `app/line/book/page.tsx`
- `app/camera/[shopSlug]/camera-access-client.tsx`
- `app/auth/accept-invite/**`
- `app/operations-client.tsx`
- `app/dashboard/page.tsx`
- `app/onboarding/**`
- presentational component ใหม่ภายใต้ `app/` หรือ `components/`
- `docs/Design.md` (ถ้าเจอ token ที่ต้อง finalize — ระบุใน evidence)

diff มีไฟล์เหล่านี้ = **STOP / REVIEW REQUIRED**:
`supabase/**`, `lib/*service*` / DAL / auth / tenant / entitlement,
`app/actions/**`, `app/api/**`, integration/worker, `.env*`,
`package.json` / lockfile, deployment config

## 9. Acceptance Criteria

- ทุก surface (5 public + shell) ใช้ Warm Hospitality design language เดียวกัน
- ไม่มี pastel/blue primary, ไม่มี Soft-3D shadow/gradient เหลือ
- ไม่มี BOM ในไฟล์ใด; LF line endings
- ไม่มี mock/fake operational data เพิ่ม
- 320–480 / 768 / 1280px ใช้งานได้ ไม่มี horizontal scroll
- keyboard focus มองเห็นชัดทุกที่
- pressed/disabled/loading/error states ไม่หาย
- role visibility + capability เท่า baseline `a13f2ba`
- Phase 10 E2E เดิมผ่านโดยไม่ลด assertion
- `tsc` / `lint` / `build` / `git diff --check` ผ่าน
- ไม่มี database/RPC/auth/service/integration/dependency change
- reviewer ตรวจ diff แล้วระบุได้ว่า **presentation-only**

## 10. Deliverables

1. UI implementation ตาม `Design.md`
2. `docs/WARM_HOSPITALITY_IMPLEMENTATION_EVIDENCE.md` — ไฟล์ที่แก้ + เหตุผล
   เชิง design, forbidden-file diff audit, BOM check
3. ผล static gates (raw output)
4. ผล Phase 10 E2E regression (raw output / log)
5. visual inspection checklist — 320 / 375 / 768 / 1280px × ทุก surface
6. Reviewer Verdict: `WARM HOSPITALITY PASS — PASSED` หรือ `— FAILED`

> Independent Verification (team rule 2026-08-25): evidence/ตัวเลขต้องมาจาก
> agent คนละตัวกับผู้ implement + มี raw log/commit hash ตรวจย้อนได้ ก่อน
> Commander Final Review Gate จะรับ

## 11. Non-goals

ไม่ใช่ feature phase / architecture phase / cleanup phase / dependency-upgrade
/ backend refactor

ห้ามใช้โอกาสนี้:

- แก้ business rule ที่ "น่าจะดีกว่า"
- rename/restructure backend, เปลี่ยน routing/URL
- เพิ่ม package / analytics / tracking
- เพิ่ม dark mode logic ที่กระทบ behavior (styling infra ที่ไม่กระทบ behavior
  ทำได้ แต่ไม่ใช่ requirement รอบนี้)
- ทำ `pawspace` → `pawstia` rename ของ slug/product_id/repo (มี track แยก
  — TASKS.md "Pawstia rename residual", gate PS-F). UI copy ที่แสดงคำว่า
  "Pawstia" อยู่แล้วใน prototype = OK, แต่ห้ามแตะ identifier/route/config

## 12. Stop Conditions

หยุดและรายงานทันทีถ้า design requirement ใดต้องเปลี่ยน database, RPC, auth,
tenant boundary, business workflow, integration contract หรือ dependency
architecture

**Design requirement ไม่มีสิทธิ์ override behavior/security contract ของ
Phase 10–13**
