# Pawstia UI Design System

> **Direction changed 2026-08-30.** This document previously described an
> "Apple-inspired Soft-3D pastel" system (blue primary, neumorphic depth,
> cute filled illustrations). That direction is **superseded**. The product
> now uses **Warm Hospitality** — a flat, warm, editorial language.
> The superseded version is in git history at commit `a13f2ba`.
> Implementation of this direction is scoped in
> `docs/BRIEF-warm-hospitality-redesign.md`.

---

## 1. Direction

**Warm Hospitality** — Pawstia is the operating system for a pet hotel. It
should feel like the front desk of a calm, well-run boutique hotel: warm,
unhurried, confident. Not a toy, not a clinical dashboard, not a candy-coloured
consumer app.

Keywords:

- Warm (earthy, not pastel)
- Editorial (large tight headlines, generous whitespace)
- Flat (borders and one soft shadow — no neumorphism, no heavy gradients)
- Calm (muted palette, little colour, lots of paper)
- Considered (line-art, not cartoon; restraint over decoration)
- Trustworthy (readable first, contrast held, states always explicit)

Core rule: **the warmth comes from colour temperature and typography, never
from decoration.** One pet line-art motif per surface, at most.

---

## 2. Personality

The UI should feel: warm, safe, attentive, quietly premium, easy for a
non-technical shop owner or a worried pet owner.

Avoid:

- Pastel tints as primary colour
- Soft-3D / neumorphic buttons and cards
- Heavy gradients, hard/dark shadows
- Glassmorphism
- Cartoon pet illustrations, paw-print fills, emoji as UI furniture
- More than one accent colour competing on a screen

---

## 3. Colour

Values below are the approved design-C tokens. They replace the `:root`
block in `app/globals.css`.

### Paper & ink

```css
--background:    #faf7f2;  /* app background — warm paper */
--surface:       #fffdf9;  /* cards, panels, inputs on tinted areas */
--surface-warm:  #f4ebe3;  /* tinted panel, story column, selected fill base */
--ink:           #24201c;  /* headings, body */
--foreground:    #24201c;
--muted:         #756d66;  /* secondary text, captions */
--line:          #e6ddd4;  /* borders, dividers */
```

### Accent — Terracotta (the only primary)

```css
--deep:   #a55e45;  /* primary button, active nav, links, eyebrows */
--deep-border: #98523d;
--deep-hover:  #914d39;
--deep-press:  #7f4432;  /* active nav text */
--deep-soft:   #f3e8e0;  /* selected card fill, terracotta tint */
```

Terracotta is used sparingly: primary CTA, the active navigation item,
section eyebrows, links, selected state. A screen has **one** terracotta
action at a time where possible.

### Support colours

```css
--sage:      #82958b;  /* calm/secondary accent, "on track" */
--sage-text: #435d50;  /* text on sage tint */
--sage-soft: #edf1ed;  /* success / positive notice background */
--sage-line: #cdd8d2;

--amber:     #b88762;  /* in-progress / neutral status marker */

--danger:      #914b38;  /* error text */
--danger-line: #b45a43;  /* error marker / left border */
--danger-soft: #f9ece8;  /* error notice background */
```

No blue. No pink. Status is carried by these three support hues plus text +
icon, never colour alone (see §12).

### Legacy token aliases

`app/globals.css` still exposes `--coral`, `--sky`, `--mint`,
`--primary-blue-soft`, `--pet-pink-soft`, `--pet-mint-soft`,
`--pet-peach-soft` because existing class rules reference them. During
implementation, point each alias at the nearest Warm Hospitality value
(most map to `--deep` / `--surface` / `--surface-warm` / `--sage-soft`) and
delete the alias once no rule uses it. Do not introduce new usages.

---

## 4. Typography

### Families

| Role | Stack |
|---|---|
| Wordmark & display serif | `Georgia, "Times New Roman", serif` |
| UI / body | `Inter, "Noto Sans Thai", system-ui, -apple-system, "Segoe UI", sans-serif` |

The serif is reserved for the **"Pawstia" wordmark** and, optionally, very
large marketing headlines on the login story panel. Everything functional —
including dashboard page titles — is the sans stack.

### Scale

| Type | Size | Weight | Tracking | Notes |
|---|---:|---:|---:|---|
| Story headline (login) | `clamp(44px, 5vw, 72px)` | 700 | `-0.055em` | line-height 1.03 |
| Public headline | `clamp(28px, 5vw, 40px)` | 700 | `-0.045em` | camera locked screen up to `52px` |
| Page title (app) | `clamp(24px, 3vw, 34px)` | 800 | `-0.045em` | sans |
| Section / panel title | 16px | 700 | `-0.025em` | |
| Body | 13–14px | 400 | — | line-height 1.6–1.8 |
| Caption / meta | 11–12px | 400–500 | — | `--muted` |
| Eyebrow / kicker | 11px | 800 | `0.16em` | uppercase, `--deep` |
| Button | 12–14px | 700 | — | |

Body copy sits around 13–14px with roomy line-height — hospitality, not
density.

---

## 5. Shape & elevation

```css
--radius-input:  10px;
--radius-btn:    12px;
--radius-card:   14px;
--radius-pill:   999px;

--shadow-card: 0 1px 1px rgba(67,54,45,.03), 0 10px 28px rgba(67,54,45,.06);
```

- Radii are **modest** — 10–14px. No 20–24px pill-cards.
- Exactly one elevation: `--shadow-card`, and only on cards that float over
  the paper background (public cards, dashboard KPI/panels). Everything else
  — buttons, inputs, nav, list rows, story-panel cards — is **flat**:
  `box-shadow: none`, defined by a `1px solid var(--line)` border.
- No `inset` highlights. No top-light / bottom-shadow "3D" stacking.
- No gradients on surfaces. `linear-gradient(...)` backgrounds in the
  current CSS (`.card`, `.room-card`, `.sidebar`, `.brand-mark`) are removed
  in favour of a flat fill.

---

## 6. Buttons

### Primary

```css
background: var(--deep);
border: 1px solid var(--deep-border);
color: #fffaf5;
border-radius: var(--radius-btn);
min-height: 46px;
padding: 0 18px;
font-weight: 700;
box-shadow: none;
transition: background .16s ease, transform .16s ease;
```

- Hover: `background: var(--deep-hover)`
- Active: `transform: translateY(1px)`
- Disabled: `opacity: .5; cursor: not-allowed` (no colour change beyond that)
- Loading: label swaps to a working string, button stays disabled

### Secondary

```css
background: var(--surface);
border: 1px solid var(--line);
color: var(--ink);
border-radius: var(--radius-btn);
box-shadow: none;
```

- Hover: `background: #f7f0e9; border-color: #d8cabc`

No tertiary/ghost button style unless a screen genuinely needs a third
weight — prefer a plain text link in `--deep`.

---

## 7. Forms

```css
/* input */
min-height: 50px;              /* 54px for the camera PIN field */
background: #fff;
border: 1px solid #d9cec5;
border-radius: var(--radius-input);
padding: 0 14px;
box-shadow: none;

/* focus */
border-color: #b9765d;
outline: 0;
box-shadow: 0 0 0 4px rgba(185,118,93,.10);

/* label */
font-size: 12px;
font-weight: 700;
color: #3c3631;
display: grid;
gap: 8px;
```

- The camera PIN input is monospace, `letter-spacing: .18em`, uppercased on
  input.
- Error text: `--danger`, 12px, sits directly under the field or as a
  block with a `3px solid var(--danger-line)` left border on
  `--danger-soft`.

---

## 8. Cards, panels, notices

- **Card / panel:** `background: var(--surface)`, `1px solid var(--line)`,
  `--shadow-card` only if it floats over `--background`. Radius 14px.
- **Selected card** (pet, room, option): `background: var(--deep-soft)`,
  `border-color: #b9765d`, `color: var(--ink)`, **no** shadow, **no** lift.
  Must also show a check mark or label — not fill alone.
- **Notice — positive:** `--sage-soft` bg, `--sage-line` border,
  `--sage-text` text.
- **Notice — error:** `--danger-soft` bg, `#e7c8bf` border, `#944a36` text.
- Status markers on the LINE-claim / camera status lines are a short
  `24px × 2px` bar in `--amber` (pending) / `#73887d` (success) /
  `--danger-line` (error), paired with text.

---

## 9. App shell (dashboard & operations)

- **Sidebar:** flat `background: #f4eee8`, `border-right: 1px solid #e1d6cc`,
  width 246px. No gradient.
- **Wordmark in shell:** serif "Pawstia", `--ink`, no logo tile / no
  gradient mark. (`.brand-mark` loses its gradient + shadow + radius.)
- **Nav item:** `--muted` text, transparent. Hover `background: #eee4dc`.
  Active: `background: #e9ddd4; color: var(--deep-press);
  box-shadow: inset 2px 0 var(--deep)` (a left rule, not a glow).
- **KPI card / panel:** `--surface`, `1px solid var(--line)`,
  `--shadow-card`. `.kpi-value` stays large and tight-tracked.
- **Room card:** flat `--surface`, `1px solid #e5dbd2`. Hover is a
  border-colour change (`#cdb8a8`) + the soft card shadow — **no
  `translateY` lift**.
- **Progress ring:** the `conic-gradient` swaps coral→`--deep`, track
  →`#f0e9e5` stays.
- Status chips keep their shape; recolour onto the sage / amber / danger /
  muted families (no blue `#e4f2fd`, no mint-green `#e2f8ea` as-is — shift
  warm).

---

## 10. Public / customer surfaces

Five surfaces share one layout system: **login**, **line/claim**,
**line/book** (LIFF), **camera/[shopSlug]**, **auth/accept-invite**.

### Login (desktop ≥ 850px)

Two columns, `minmax(0,1.08fr) minmax(420px,.92fr)`:

- **Left — story panel:** `background: #f3ebe4`, `border-right: 1px solid
  #e2d8cf`, full height. Serif "Pawstia" wordmark top-left. One pet
  line-art motif top-right (see §11). Eyebrow → big serif headline →
  lead paragraph → a 3-cell footer strip (`Room Matrix / Daily Care /
  Guest Profile`) separated by a top border.
- **Right — form panel:** `background: var(--surface)`, form centred at
  `min(100%, 460px)`. Eyebrow "STAFF ACCESS" → `ยินดีต้อนรับกลับ` heading →
  short copy → fields → primary button → footnote. WSTERA credit pinned
  bottom, 10px, `--muted`.

### Login (< 850px)

Story panel is `display: none`. Form panel becomes full screen with a
serif "Pawstia" wordmark + small paw mark at top, `margin-bottom: 54px`.

### line/claim, camera, accept-invite

Centred single card on `--background` (`.pawstia-public-shell`,
`place-items: center`, 56px vertical padding). Card `min(100%, 720px)`
(claim `560px`, camera `860px`), `--surface`, `1px solid var(--line)`,
`--shadow-card`.

- **Header:** wordmark/title left, a pill channel label right
  (`LINE` / `PRIVATE VIEW` / etc.) — pill is `1px solid #c9d5ce`,
  `background: #f1f4f2`, `color: #486054`, 10px 800 uppercase.
- **Body:** big headline (`clamp(28px,5vw,40px)`), muted copy, then the
  action (form / button / status line).
- Camera live view: `aspect-ratio: 16/9` frame, `background: #171513`,
  `1px solid #2b2723`, iframe fills it.

### line/book (LIFF)

Mobile-only, no desktop layout, no sidebar. Reuses the `.liff-*` classes
recoloured to Warm Hospitality: `--background` shell, `--surface` cards,
`1px solid var(--line)`, `box-shadow: none`, serif `.liff-brand-title`
20px, eyebrows + required marks in `--deep`, sage `.liff-badge`.

---

## 11. Pet line-art

One motif per surface, decorative, never over content.

- Style: single-weight open stroke (`stroke-width: 2.2`, round caps/joins),
  `stroke: currentColor`, no fill on the animal. Colour `#a85f46` at
  `opacity ~.72`. A small cluster of filled paw dots may accompany it.
- Placement: login story panel (top-right), empty states, success states.
- **Not** in every card, not as a repeating background, not on functional
  dashboard panels.

---

## 12. Motion

Subtle. Respect `prefers-reduced-motion` (all entrance animations off,
final state shown).

| Interaction | Duration | Easing |
|---|---:|---|
| Button hover / press | 160ms | `ease` |
| Card / panel transition | 180–240ms | `cubic-bezier(.2,.8,.2,1)` |
| Page | 200–300ms | `cubic-bezier(.2,.8,.2,1)` |

### Login entrance (the approved design-C animation)

- **Paw stamps:** each dot `pawstia-paw-pop` — `.46s ease-out forwards`,
  from `opacity:0 translateY(3px) scale(.72)` to rest. Staggered delays
  `.18s → .68s` across 8 elements.
- **Pet line-art:** `pawstia-pet-reveal` — `.9s cubic-bezier(.2,.7,.2,1)
  .14s forwards`, from `opacity:0 translateY(7px)` to `opacity:.78`.

> Known issue in the WIP prototype: at ~650ms the paw stamps briefly
> disappear before settling — the per-element delays and the fill-mode /
> final opacity need reconciling so every stamp lands and *stays* at
> `opacity:1`. Fix during implementation.

---

## 13. Accessibility

- Body text ≥ 4.5:1 on its background; large text ≥ 3:1. Verify terracotta
  `#a55e45` on `#fffaf5` (button) and `--muted` `#756d66` on `--surface`.
- Interactive targets ≥ 44 × 44px.
- `:focus-visible` is a visible ring everywhere:
  `outline: 3px solid rgba(165,94,69,.2); outline-offset: 2px` (or the
  `0 0 0 4px rgba(185,118,93,.1)` box-shadow form on inputs).
- Never colour alone for status — always text + icon/marker.
- Selected state = fill **and** check/label.
- Error = message **and** icon/marker.
- Full keyboard operability; `prefers-reduced-motion` honoured.

---

## 14. Responsive

- **Mobile 320–480px:** single column, card `width:100%`, shell padding
  drops to ~18px, public cards `border-radius: 12px`, story footer collapses
  to one column.
- **Tablet 768px+:** 2-column content where it helps.
- **Desktop 1280px+:** sidebar 246px + fluid main. Login two-column kicks in
  at 850px.
- No horizontal scroll at any width on any surface (regression-checked in
  the last design pass — keep it).

---

## 15. Implementation notes

- All tokens live in `:root` in `app/globals.css`. No second design system,
  no per-component token drift, no re-deriving values from this doc's
  examples — the CSS is the single source once implemented.
- LIFF pages go through the shared `.liff-*` / `.pawstia-*` classes, not
  raw Tailwind, so the product stays one system.
- Presentation only: no change to server actions, services, API routes,
  migrations, auth, tenant, entitlement, integration workers, or tests.
- Component states required on every interactive component:
  `default / hover / focus / pressed / disabled / loading / error`.

---

## 16. Formula

```text
Warm paper + terracotta restraint
+ editorial serif wordmark & headlines
+ flat surfaces, one soft shadow
+ single pet line-art per surface
+ explicit states, held contrast
= Pawstia Design Language
```

Goal:

> **Looks like a calm boutique hotel front desk — warm on sight, and the
> longer you use it the more it feels like software you can trust with a
> living animal.**
