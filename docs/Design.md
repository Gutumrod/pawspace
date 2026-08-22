# PawSpace UI Design System

## 1. Design Direction

PawSpace ใช้แนวทาง **Cute Pet-Friendly + Apple-inspired + Soft 3D UI**  
เป้าหมายคือให้หน้าตาดูน่ารัก เป็นมิตรกับเจ้าของสุนัขและแมว แต่ยังสะอาด ใช้งานง่าย และดูเป็น SaaS ที่พร้อมใช้งานจริง

คีย์เวิร์ดหลัก:

- Pet Friendly
- Soft Pastel
- Apple-inspired
- Rounded
- Soft 3D / Neumorphic
- Friendly
- Clean
- Premium
- Warm
- Tactile

> หลักสำคัญ: ความน่ารักต้องไม่ทำให้ UI อ่านยากหรือดูเหมือนเกมเด็ก

---

## 2. Visual Personality

UI ควรให้ความรู้สึก:

- อบอุ่น
- ปลอดภัย
- เป็นมิตร
- ดูแลใส่ใจสัตว์เลี้ยง
- ใช้ง่ายสำหรับผู้ใช้ทั่วไป
- มีความพรีเมียมแบบแอป iOS
- มีมิติจากแสง เงา และพื้นผิว

หลีกเลี่ยง:

- สีสดจัดเกินไป
- gradient หนัก
- เงาดำแข็ง
- Glassmorphism มากเกินไป
- Neumorphism ที่ contrast ต่ำจนมองไม่เห็นปุ่ม
- การใส่ลายอุ้งเท้าหรือรูปสัตว์ทุกพื้นที่

---

## 3. Color Palette

### Primary

```css
--primary-blue: #4A90FF;
--primary-blue-dark: #2F73E8;
--primary-blue-soft: #EAF3FF;
```

ใช้กับ:

- Primary CTA
- Active state
- Navigation
- Links
- Selected controls

### Pet Pink

```css
--pet-pink: #FF7F9E;
--pet-pink-soft: #FFF0F4;
--pet-pink-dark: #EB6687;
```

ใช้กับ:

- Vaccine reminder
- Grooming
- Heart / favorite
- Notification badge

### Mint

```css
--pet-mint: #68D5BB;
--pet-mint-soft: #EAFBF6;
--pet-mint-dark: #45B89F;
```

ใช้กับ:

- Boarding
- Success
- Vaccination complete
- Positive health status

### Peach

```css
--pet-peach: #FFB76A;
--pet-peach-soft: #FFF4E8;
--pet-peach-dark: #E89543;
```

ใช้กับ:

- Walking
- Deworming
- Secondary service category

### Neutral

```css
--background: #FFFDF9;
--surface: #FFFFFF;
--surface-warm: #FFF9F1;

--text-primary: #182033;
--text-secondary: #6F7788;
--text-muted: #A2A8B5;

--border-soft: #E9ECF2;
--divider: #EEF0F4;
```

---

## 4. Typography

ใช้ฟอนต์ที่อ่านง่ายและเป็นมิตร

Recommended:

- `Inter`
- `Noto Sans Thai`
- `LINE Seed Sans TH`
- `SF Pro` เฉพาะกรณีที่ environment รองรับ

Web stack แนะนำ:

```css
font-family:
  "Inter",
  "Noto Sans Thai",
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

### Type Scale

| Type | Size | Weight |
|---|---:|---:|
| Page Title | 28px | 700 |
| Section Title | 20px | 700 |
| Card Title | 16px | 600 |
| Body | 14–16px | 400 |
| Caption | 12–13px | 400 |
| Button | 15–16px | 600 |
| Small Label | 11–12px | 500 |

ควรใช้ line-height ประมาณ `1.4–1.6`

---

## 5. Border Radius

องค์ประกอบหลักควรมีความโค้งค่อนข้างสูง

```css
--radius-sm: 10px;
--radius-md: 14px;
--radius-lg: 18px;
--radius-xl: 24px;
--radius-pill: 999px;
```

แนวทาง:

- Small icon button: `12–14px`
- Form input: `14–16px`
- Card: `18–22px`
- Hero pet card: `24px`
- Primary CTA: `16–20px`
- Badge / Chip: `999px`

---

# 6. Soft 3D System

## 6.1 Principle

ปุ่มและการ์ดไม่ควรดูแบนสนิท

ใช้:

1. Light highlight ด้านบน
2. Drop shadow อ่อนด้านล่าง
3. Border สีอ่อน
4. Gradient บางมาก
5. Inner highlight เล็กน้อย

ผลลัพธ์ต้องดูเหมือนวัตถุที่ "ยกขึ้นจากพื้น" แต่ไม่ควรเหมือนปุ่มเกม

---

## 6.2 Elevated Card

```css
.card {
  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,1) 0%,
      rgba(252,252,252,1) 100%
    );

  border: 1px solid rgba(222, 227, 235, 0.85);
  border-radius: 20px;

  box-shadow:
    0 2px 4px rgba(34, 48, 74, 0.04),
    0 8px 20px rgba(34, 48, 74, 0.08),
    inset 0 1px 0 rgba(255,255,255,0.9);
}
```

ใช้กับ:

- Appointment
- Health summary
- Pet information
- Pet selector
- Dashboard modules

---

## 6.3 Colored Card

ตัวอย่าง Pink Card:

```css
.card-pink {
  background:
    linear-gradient(
      180deg,
      #FFF8FA 0%,
      #FFF0F4 100%
    );

  border: 1px solid #FFD1DC;

  box-shadow:
    0 8px 18px rgba(255, 127, 158, 0.14),
    inset 0 1px 0 rgba(255,255,255,0.9);
}
```

หลักเดียวกันใช้กับ Blue / Mint / Peach Card

---

# 7. Buttons

## 7.1 Primary CTA

Primary button ต้องให้ความรู้สึกกดได้ชัดเจน

```css
.button-primary {
  min-height: 52px;

  background:
    linear-gradient(
      180deg,
      #62A1FF 0%,
      #3D87F5 55%,
      #3379E7 100%
    );

  border: 1px solid rgba(45, 109, 220, 0.7);
  border-radius: 18px;

  color: white;
  font-weight: 600;

  box-shadow:
    0 2px 0 rgba(255,255,255,0.35) inset,
    0 -2px 0 rgba(32, 89, 184, 0.18) inset,
    0 8px 14px rgba(57, 126, 235, 0.24);
}
```

### Hover

```css
.button-primary:hover {
  transform: translateY(-1px);
}
```

### Pressed

```css
.button-primary:active {
  transform: translateY(2px);

  box-shadow:
    inset 0 3px 6px rgba(37, 83, 160, 0.22),
    0 2px 5px rgba(57, 126, 235, 0.18);
}
```

ต้องมี pressed state เสมอ เพื่อเพิ่ม tactile feedback

---

## 7.2 Secondary Button

```css
.button-secondary {
  background: linear-gradient(180deg, #FFFFFF, #F7F8FA);
  border: 1px solid #E1E5EC;
  border-radius: 16px;

  box-shadow:
    0 5px 12px rgba(32, 46, 68, 0.08),
    inset 0 1px 0 white;
}
```

---

## 7.3 Icon Button

ใช้กับ:

- Arrow
- Camera
- Add
- Edit
- More

```css
.icon-button {
  width: 40px;
  height: 40px;

  border-radius: 14px;

  background:
    linear-gradient(
      180deg,
      #FFFFFF 0%,
      #F4F6F8 100%
    );

  border: 1px solid #E5E8EE;

  box-shadow:
    0 4px 10px rgba(35, 48, 70, 0.10),
    inset 0 1px 0 white;
}
```

---

# 8. Service Cards

Service card เป็นองค์ประกอบที่ควรแสดง Soft 3D ชัดที่สุด

ตัวอย่าง:

- Grooming → Pink
- Clinic → Blue
- Boarding → Mint
- Walking → Peach

โครงสร้าง:

```text
┌───────────────────┐
│                   │
│   Illustration    │
│                   │
├───────────────────┤
│ Service Name      │
│ Description       │
│                ○  │
└───────────────────┘
```

### Selected State

เมื่อเลือก:

- เพิ่ม border สี category
- เพิ่ม shadow เล็กน้อย
- แสดง check circle
- ยก card ขึ้น `translateY(-2px)`

```css
.service-card[data-selected="true"] {
  transform: translateY(-2px);

  box-shadow:
    0 10px 22px rgba(42, 55, 77, 0.12),
    inset 0 1px 0 rgba(255,255,255,0.9);
}
```

---

# 9. Pet Profile Card

Pet Profile เป็น Hero element ของ Dashboard

ควรมี:

- รูปสัตว์ขนาดใหญ่
- ชื่อ
- Breed
- อายุ
- เพศ
- Optional: น้ำหนัก
- ปุ่มเข้าดู profile

Visual:

- Pastel background
- Paw pattern จางมาก
- Illustration หรือ photo สามารถล้น card เล็กน้อย
- รูปสัตว์ควรเป็นจุดเด่นที่สุด

Background example:

```css
.pet-card {
  background:
    radial-gradient(
      circle at 20% 10%,
      rgba(255,255,255,0.7),
      transparent 35%
    ),
    linear-gradient(
      135deg,
      #EDF6FF,
      #DCEBFF
    );
}
```

---

# 10. Dashboard Structure

หน้า Dashboard แนะนำลำดับ:

```text
Header
↓
Pet Hero Card
↓
Upcoming Appointment
↓
Important Reminder
↓
Popular Services
↓
Recent / Health Information
↓
Bottom Navigation
```

ไม่ควรใส่ข้อมูลทุกอย่างในหน้าแรก

Dashboard ต้องตอบคำถามหลัก 3 ข้อให้ผู้ใช้ได้ทันที:

1. วันนี้สัตว์เลี้ยงมีอะไรต้องทำไหม
2. นัดหมายครั้งต่อไปเมื่อไร
3. ต้องการเข้าบริการอะไร

---

# 11. Navigation

Bottom Navigation:

```text
Home
Appointments
My Pets
Messages
Profile
```

จำนวนสูงสุดแนะนำ `5`

Active Item:

- icon primary blue
- text primary blue
- background pill อ่อน
- ยก icon เล็กน้อย

Inactive:

- Gray
- ไม่ใส่ shadow หนัก

---

# 12. Pet Illustrations

ใช้ illustration เป็น decorative element แต่ไม่ควรแย่งข้อมูลหลัก

เหมาะกับ:

- Empty State
- Service Category
- Success State
- Onboarding
- Dashboard decoration
- Pet profile placeholder

Style:

- Rounded
- Cute
- Soft shading
- Friendly facial expression
- Pastel
- ไม่ realistic จน contrast กับ UI

รูปจริงของสัตว์เลี้ยงผู้ใช้สามารถอยู่ร่วมกับ illustration ได้

---

# 13. Paw Pattern

ใช้เป็น background accent เท่านั้น

Opacity:

```css
opacity: 0.04 - 0.10;
```

ตำแหน่งเหมาะสม:

- Pet hero card
- Empty state
- Header illustration
- Background decoration

ห้ามใส่ลายอุ้งเท้าซ้ำเต็มทุก card

---

# 14. Forms

Input field:

```css
.input {
  min-height: 48px;

  background: #FFFFFF;
  border: 1px solid #E3E7EE;
  border-radius: 14px;

  box-shadow:
    inset 0 1px 2px rgba(35, 47, 67, 0.04);
}
```

Focus:

```css
.input:focus {
  border-color: #77ADFF;

  box-shadow:
    0 0 0 4px rgba(74, 144, 255, 0.12);
}
```

---

# 15. Badges / Chips

ตัวอย่าง:

```text
Upcoming
Male
3 yrs
12.5 kg
Vaccinated
Verified
```

ใช้ทรง pill

```css
.badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}
```

ห้ามใช้ badge สีเข้มจำนวนมากในหน้าเดียว

---

# 16. Interaction & Motion

Motion ควร subtle

Recommended:

```text
Hover       120–160ms
Pressed     80–120ms
Card open   180–240ms
Modal       200–280ms
Page        200–300ms
```

Easing:

```css
cubic-bezier(0.2, 0.8, 0.2, 1)
```

ตัวอย่าง interaction:

### Button Press

```text
Idle
↓
Pressed
scale(0.98)
translateY(2px)
↓
Release
spring กลับ
```

### Card Select

```text
Idle
↓
translateY(-2px)
↓
shadow เพิ่ม
↓
check icon appear
```

---

# 17. Accessibility

แม้จะเป็น pastel UI ต้องรักษา contrast

ข้อกำหนด:

- Body text ≥ 4.5:1
- Large text ≥ 3:1
- Interactive target อย่างน้อย `44 × 44px`
- ห้ามใช้สีเพียงอย่างเดียวเพื่อบอกสถานะ
- Selected state ต้องมี icon / border / label
- Error ต้องมีทั้งข้อความและ icon
- รองรับ keyboard focus
- รองรับ reduced motion

---

# 18. Responsive Layout

## Mobile

Mobile-first

```text
320–480px
```

Card:

```css
width: 100%;
```

Padding:

```text
16–20px
```

---

## Tablet

```text
768px+
```

ใช้ 2-column layout ได้

---

## Desktop Dashboard

```text
1280px+
```

Suggested:

```text
Sidebar           Main Content           Detail Panel
240px             Flexible               320px
```

Card style และ design language ต้องเหมือน mobile

---

# 19. Dark Mode

Dark Mode ยังต้องคง pastel identity

```css
--dark-background: #17191E;
--dark-surface: #20232A;
--dark-card: #252932;
--dark-text: #F5F7FA;
--dark-text-secondary: #AAB1BE;
```

สี pastel ควรลด saturation เล็กน้อย

Soft 3D shadow ใน dark mode:

```css
box-shadow:
  0 8px 18px rgba(0,0,0,0.25),
  inset 0 1px 0 rgba(255,255,255,0.05);
```

---

# 20. Component Priority

ควรสร้าง component กลางก่อน:

```text
Button
IconButton
Card
PetCard
ServiceCard
AppointmentCard
ReminderCard
HealthCard
Badge
Avatar
Input
Select
Tabs
BottomNavigation
Modal
EmptyState
Toast
```

ทุก component ต้องมี:

```text
Default
Hover
Focus
Pressed
Disabled
Loading
Error (ถ้าเกี่ยวข้อง)
```

---

# 21. Design Tokens

แนะนำให้เก็บเป็น token กลาง

```ts
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const shadow = {
  soft: "0 4px 12px rgba(35,48,70,.08)",
  card: "0 8px 20px rgba(35,48,70,.10)",
  raised: "0 10px 24px rgba(35,48,70,.14)",
};
```

---

# 22. UI Rules

## DO

- ใช้ white space เยอะ
- ใช้สี pastel แยก category
- ใช้ rounded corner
- ใช้ soft shadow
- ให้ CTA มี depth ชัด
- ใช้ illustration เฉพาะจุด
- ให้ข้อมูลสุขภาพอ่านง่าย
- ใช้รูปสัตว์เป็น visual priority
- ใช้ animation เล็กน้อยเพื่อเพิ่ม tactile feel

## DON'T

- อย่าใช้ shadow ดำ
- อย่าทำทุกอย่างเป็น 3D
- อย่าใส่ gradient แรง
- อย่าใช้สี pastel กับ body text
- อย่าใส่ illustration ในทุก card
- อย่าใช้ paw pattern เต็ม background
- อย่าลด contrast เพื่อแลกกับความ cute
- อย่าทำ card ซ้อน card มากเกินไป

---

# 23. Final Visual Formula

PawSpace UI ควรยึดสูตร:

```text
Apple-like Layout
+
Pet Friendly Illustration
+
Soft Pastel Colors
+
Rounded Cards
+
Subtle 3D Depth
+
Clear Information Hierarchy
=
PawSpace Design Language
```

เป้าหมายสุดท้ายคือ:

> **ดูน่ารักตั้งแต่แรกเห็น แต่พอใช้งานจริงต้องรู้สึกเหมือน SaaS ที่จริงจังและไว้ใจได้**