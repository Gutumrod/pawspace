# PawSpace — Design Implementation Pass

Status: **PLANNED / DESIGN-ONLY**  
Project: `PawSpace`  
Source design: `docs/Design.md`  
Baseline: **Phase 10 CLOSED**

## 1. Purpose

งานนี้เป็น **Design Implementation Pass แยกจาก Phase 10** โดยมีเป้าหมายเดียวคือปรับ presentation layer ของ PawSpace ให้สอดคล้องกับ `docs/Design.md` โดยไม่เปลี่ยนพฤติกรรม ระบบธุรกิจ ความปลอดภัย หรือ data contract ที่ผ่าน Phase 10 แล้ว

หลักการสูงสุด:

> **Visual refactor only. Preserve behavior exactly.**

ถ้าการเปลี่ยนแปลงใดจำเป็นต้องแก้ business logic, RPC, database, authorization, integration contract หรือ runtime behavior ให้ถือว่า **OUT OF SCOPE** และหยุดงานส่วนนั้นทันที

## 2. Design Source of Truth

Design implementation ต้องอ้างอิง `docs/Design.md` เป็นหลักสำหรับ visual language ได้แก่ Apple-inspired layout, pet-friendly identity, soft pastel palette, rounded surfaces, subtle Soft 3D depth, typography, spacing, responsive behavior, interaction states และ accessibility
## 3. Allowed Scope

อนุญาตให้แก้เฉพาะสิ่งที่เกี่ยวกับ UI/UX presentation โดยตรง:

- `/login`
- `/` canonical Operations UI
- `/dashboard` Owner/Manager dashboard
- CSS / design tokens / responsive styles
- presentational React components
- layout, spacing, typography, color, border, radius, shadow
- button/input/select/card/badge/tab/navigation visual states
- loading, empty, error และ success presentation ที่มี behavior เดิมอยู่แล้ว
- responsive layout สำหรับ mobile, iPad/tablet และ desktop
- accessibility attributes/focus presentation ที่ไม่เปลี่ยน business behavior
- decorative pet-friendly elements ที่ไม่มี authority หรือ data semantics

สามารถแตก reusable **presentational components** ได้ เช่น `Button`, `Card`, `Badge`, `Input`, `Select`, `Tabs`, `EmptyState`, `Toast` ถ้าการแตก component ไม่ย้ายหรือเปลี่ยน business logic

## 4. Hard No-Touch Boundary

ห้ามแก้ทุกกรณี:

- Supabase migrations, schema, tables, policies, RLS, grants หรือ RPC
- authentication/session behavior
- authorization / Owner-Manager-Staff role matrix
- tenant resolution หรือ tenant isolation
- server actions และ validation logic
- service/DAL behavior หรือ query semantics
- booking/customer/pet/room lifecycle rules
- Daily Report creation, storage, queue, retry หรือ LINE delivery
- Google Sheets verification/sync behavior
- LINE claim/reset behavior
- camera behavior
- entitlement/commercial logic
- API routes และ HTTP status semantics
- environment variables, credentials, secrets หรือ deployment config
- package dependencies เว้นแต่ได้รับอนุมัติแยกต่างหาก
- E2E fixtures หรือ test expectations เพื่อทำให้ design change ผ่านแบบหลอก ๆ
- Phase 10 evidence/runbook/history
- monetization หรือ feature ใหม่ทุกชนิด

**ห้ามสร้าง migration ใหม่ใน Design Pass นี้**

## 5. Behavior Freeze

ก่อนเริ่มแก้ต้องถือ behavior ปัจจุบันเป็น frozen baseline:

- route เดิมต้องอยู่ครบ
- action เดิมต้องถูกเรียกด้วย payload/contract เดิม
- role เดิมต้องเห็นและทำสิ่งเดิมได้เท่าเดิม
- destructive confirmation เดิมต้องไม่ถูกลดทอน
- tenant boundaries ต้องไม่เปลี่ยน
- server/client authority boundary ต้องไม่เปลี่ยน
- success/error semantics ต้องไม่ถูกซ่อนหรือแปลงจนทำให้เข้าใจผลผิด
## 6. Visual Targets

ใช้สูตรจาก `Design.md`:

`Apple-like Layout + Pet Friendly Illustration + Soft Pastel + Rounded Cards + Subtle 3D + Clear Hierarchy`

Implementation ต้องให้ความสำคัญตามลำดับ:

1. information hierarchy และ readability
2. consistent design tokens
3. responsive usability
4. accessible interactive states
5. PawSpace visual identity
6. decorative polish

ห้ามแลก usability/contrast กับความน่ารัก

### Required visual states

Interactive component ที่เกี่ยวข้องต้องรองรับเท่าที่ applicable:

- Default
- Hover
- Focus-visible
- Pressed
- Disabled
- Loading
- Error / success state ที่ระบบเดิมมีอยู่
- Reduced motion

Interactive target ควรไม่น้อยกว่า `44 × 44px` และ body text ต้องรักษา contrast ตาม `Design.md`
## 7. Page-specific Scope

### `/login`

ปรับเฉพาะ visual hierarchy, branding, form surface, input/button states, spacing และ responsive behavior ห้ามเปลี่ยน `loginAction`, redirect, session หรือ error semantics

### `/` Operations

รักษา tabs และ operational capabilities เดิมทั้งหมด ได้แก่ Overview, Bookings, Customers & Pets, Daily Report และ Shop Setup ปรับได้เฉพาะ layout/component presentation และ navigation presentation

Room Matrix ต้องยังแสดงสถานะจากข้อมูลจริง ไม่เพิ่ม fake pet, fake room, fake KPI หรือ placeholder ที่อาจถูกเข้าใจเป็นข้อมูลจริง

### `/dashboard`

ปรับ visual ให้เป็น design language เดียวกับ Operations โดยคง Owner/Manager access, dashboard data และ entitlement/integration semantics เดิม

## 8. Component Strategy

ถ้าจะแตก component ให้เป็น **dumb/presentational component** เป็นค่าเริ่มต้น

Component ห้าม:

- query Supabase โดยตรง
- resolve tenant
- ตรวจ authorization ใหม่เอง
- เรียก service-role client
- เปลี่ยน server action contract
- ซ่อน capability เพื่อใช้แทน server authorization

Existing server/service/action boundaries ต้องเป็น authority ต่อไป
## 9. Required Workflow

ทำงานตามลำดับนี้เท่านั้น:

1. **Inspect** — อ่าน `Design.md`, หน้า UI ปัจจุบัน, CSS และ git state จริง
2. **Baseline** — บันทึกรายชื่อไฟล์และ behavior ที่ต้อง preserve
3. **Design Map** — map design tokens/components ไปยัง UI เดิม โดยไม่แตะ logic
4. **Implement** — แก้เฉพาะ presentation layer
5. **Static Gates** — typecheck, lint, build, `git diff --check`
6. **Behavior Regression** — รัน Phase 10 E2E เดิมโดยห้ามแก้ expectation เพื่อรองรับ design
7. **Visual Inspect** — ตรวจ mobile/tablet/desktop, overflow, focus, loading/error/empty states
8. **Diff Audit** — พิสูจน์ว่าไม่มี forbidden file/logic change
9. **Reviewer Verdict** — PASS ได้ต่อเมื่อ visual change และ behavior preservation ผ่านทั้งคู่

ถ้า E2E เดิม fail หลัง design change ให้ถือเป็น regression จนกว่าจะพิสูจน์ได้ว่า test มีปัญหา ห้ามแก้ test เพียงเพื่อให้ผ่าน

## 10. File Guardrail

ก่อน Implement ต้องสร้าง baseline จาก `git diff --name-only` และหลังจบต้องตรวจซ้ำ

ไฟล์ที่คาดว่าแก้ได้ เช่น:

- `app/globals.css`
- `app/login/page.tsx`
- `app/operations-client.tsx`
- `app/dashboard/page.tsx`
- presentational component files ใหม่ภายใต้ `app/` หรือ `components/`
หาก diff มีไฟล์ต่อไปนี้หรือเทียบเท่า ต้องถือเป็น **STOP / REVIEW REQUIRED**:

- `supabase/migrations/**`
- `supabase/config.toml`
- `lib/*service*` / DAL / auth / tenant / entitlement logic
- `app/actions/**`
- `app/api/**`
- integration/worker code
- `.env*`
- production/deployment config

ยกเว้นไฟล์ดังกล่าวมี diff ค้างจาก baseline ก่อนเริ่ม Design Pass; ในกรณีนั้น **ห้ามแก้เพิ่ม** และต้องแยกให้ชัดใน evidence

## 11. Acceptance Criteria

Design Pass จะผ่านเมื่อครบทุกข้อ:

- UI ทั้ง 3 surfaces ใช้ PawSpace design language เดียวกัน
- ไม่มี mock/fake operational data เพิ่ม
- mobile 320–480px ใช้งานได้
- tablet/iPad 768px+ ใช้งานได้
- desktop 1280px+ ไม่มี layout break
- keyboard focus มองเห็นชัด
- pressed/disabled/loading/error states ไม่หาย
- role visibility และ capability เท่า baseline
- Phase 10 E2E เดิมผ่านโดยไม่ลด assertion
- typecheck/lint/build/diff-check ผ่าน
- ไม่มี database/RPC/auth/service/integration change จาก Design Pass
- reviewer ตรวจ diff แล้วระบุได้ว่าเป็น **presentation-only**

## 12. Explicit Non-goals

Design Pass นี้ไม่ใช่ feature phase, architecture phase, cleanup phase, dependency-upgrade phase หรือ refactor backend phase
ห้ามใช้โอกาสนี้เพื่อ:

- แก้ business rule ที่เห็นว่า “น่าจะดีกว่า”
- rename/restructure backend
- เพิ่ม package เพื่อความสะดวกโดยไม่ได้รับอนุมัติ
- เปลี่ยน routing/URL
- เพิ่ม analytics/tracking
- เพิ่ม dark mode logic ถ้าต้องเปลี่ยน product behavior; ทำได้เฉพาะ styling infrastructure ที่ไม่กระทบ behavior
- เพิ่ม grooming/clinic/vaccine/passport หรือ service category ใหม่จากตัวอย่างใน `Design.md`

> ตัวอย่าง Grooming, Clinic, Walking, Vaccine และ Health ใน `Design.md` เป็น **visual examples เท่านั้น** ไม่ใช่ product requirements ของ PawSpace Pilot

## 13. Deliverables

เมื่อจบงานต้องมี:

1. UI implementation ตาม `Design.md`
2. `DESIGN_IMPLEMENTATION_EVIDENCE.md` ระบุไฟล์ที่แก้และเหตุผลเชิง design
3. ผล static gates
4. ผล Phase 10 E2E regression
5. visual inspection checklist อย่างน้อย mobile/tablet/desktop
6. forbidden-file diff audit
7. Reviewer Verdict: `DESIGN PASS — PASSED` หรือ `DESIGN PASS — FAILED`

## 14. Stop Conditions

หยุดและรายงานก่อนทันทีหากพบว่าการทำ design requirement ใดต้องเปลี่ยน database, RPC, auth, tenant boundary, business workflow, integration contract หรือ dependency architecture

**Design requirement ไม่มีสิทธิ์ override Phase 10 behavior/security contract.**
