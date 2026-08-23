import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Phase 10 E2E fixture setup.");
const mailpitUrl = process.env.MAILPIT_URL || process.env.INBUCKET_URL || "http://127.0.0.1:54324";

// Polls local Mailpit for the Supabase invite email and returns the real
// /auth/v1/verify?...type=invite... link GoTrue put in the email body -
// this is GitHub Issue #3's required real credential-flow evidence, not a
// stand-in for it.
async function waitForInviteLink(email: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const listRes = await fetch(`${mailpitUrl}/api/v1/messages?query=${encodeURIComponent(`to:${email}`)}`);
    const list = await listRes.json();
    const messageId = list?.messages?.[0]?.ID;
    if (messageId) {
      const msgRes = await fetch(`${mailpitUrl}/api/v1/message/${messageId}`);
      const msg = await msgRes.json();
      const match = /href="([^"]*\/auth\/v1\/verify[^"]*type=invite[^"]*)"/.exec(msg.HTML || "");
      if (match) return match[1].replace(/&amp;/g, "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No invite email with a verify link arrived for ${email} within timeout.`);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const password = "PawSpace-E2E-Strong-123!";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const emails = {
  owner: `owner-${suffix}@pawspace.test`,
  manager: `manager-${suffix}@pawspace.test`,
  staff: `staff-${suffix}@pawspace.test`,
  inactive: `inactive-${suffix}@pawspace.test`,
  none: `none-${suffix}@pawspace.test`,
  otherOwner: `other-${suffix}@pawspace.test`,
};
let shopA = "";
let shopB = "";
const userIds: string[] = [];

async function createUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  userIds.push(data.user.id);
  return data.user.id;
}
async function login(page: import("@playwright/test").Page, email: string, expectedSuccess = true) {
  await page.goto("/login");
  await page.getByLabel("อีเมล (Email)").fill(email);
  await page.getByLabel("รหัสผ่าน (Password)").fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  if (expectedSuccess) await expect(page).toHaveURL(/\/$/);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const ids = {
    owner: await createUser(emails.owner), manager: await createUser(emails.manager),
    staff: await createUser(emails.staff), inactive: await createUser(emails.inactive),
    none: await createUser(emails.none), otherOwner: await createUser(emails.otherOwner),
  };
  const { data: shops, error: shopError } = await admin.from("shops").insert([
    { name: "Phase10 Pilot A", slug: `phase10-a-${suffix}` },
    { name: "Phase10 Pilot B", slug: `phase10-b-${suffix}` },
  ]).select("id,slug");
  if (shopError || !shops || shops.length !== 2) throw new Error(`shop fixture: ${shopError?.message}`);
  shopA = String(shops.find((s) => s.slug === `phase10-a-${suffix}`)?.id);
  shopB = String(shops.find((s) => s.slug === `phase10-b-${suffix}`)?.id);
  const { error: staffError } = await admin.from("staff_users").insert([
    { id: ids.owner, shop_id: shopA, email: emails.owner, name: "Pilot Owner", role: "owner", is_active: true },
    { id: ids.manager, shop_id: shopA, email: emails.manager, name: "Pilot Manager", role: "manager", is_active: true },
    { id: ids.staff, shop_id: shopA, email: emails.staff, name: "Pilot Staff", role: "staff", is_active: true },
    { id: ids.inactive, shop_id: shopA, email: emails.inactive, name: "Inactive", role: "staff", is_active: false },
    { id: ids.otherOwner, shop_id: shopB, email: emails.otherOwner, name: "Other Owner", role: "owner", is_active: true },
  ]);
  if (staffError) throw new Error(`staff fixture: ${staffError.message}`);
});
test("owner login reaches operations and sees owner-only controls", async ({ page }) => {
  await login(page, emails.owner);
  await expect(page.getByRole("heading", { name: "Phase10 Pilot A" })).toBeVisible();
  await page.getByTestId("tab-setup").click();
  await expect(page.getByText("Staff management")).toBeVisible();
  await expect(page.getByTestId("room-create-form")).toBeVisible();
});

test("manager reaches operations but cannot manage staff", async ({ page }) => {
  await login(page, emails.manager);
  await page.getByTestId("tab-setup").click();
  await expect(page.getByTestId("room-create-form")).toBeVisible();
  await expect(page.getByText("Staff management")).toHaveCount(0);
});

test("staff reaches core operations but not manager controls", async ({ page }) => {
  await login(page, emails.staff);
  await page.getByTestId("tab-setup").click();
  await expect(page.getByText(/ไม่มีสิทธิ์ตั้งค่าห้องหรือ integration/)).toBeVisible();
  await expect(page.getByTestId("room-create-form")).toHaveCount(0);
});

test("inactive and no-membership logins are rejected without PawSpace session cookies", async ({ page, context }) => {
  for (const email of [emails.inactive, emails.none]) {
    await login(page, email, false);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/not an active staff member|ไม่สำเร็จ/)).toBeVisible();
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "pawspace_access_token")).toBeUndefined();
    expect(cookies.find((c) => c.name === "pawspace_refresh_token")).toBeUndefined();
  }
});
test("owner invite creates usable credentials and remove revokes membership plus Auth account", async ({ page, context }) => {
  const invitedEmail = `invited-${suffix}@pawspace.test`;
  await login(page, emails.owner);
  await page.getByTestId("tab-setup").click();
  const invite = page.getByTestId("staff-invite-form");
  await invite.locator('input[name="email"]').fill(invitedEmail);
  await invite.locator('input[name="name"]').fill("Invited E2E Staff");
  await invite.locator('input[name="password"]').fill(password);
  await invite.locator('select[name="role"]').selectOption("staff");
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText("เชิญ staff สำเร็จ")).toBeVisible();
  await expect(page.getByText(invitedEmail)).toBeVisible();

  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, invitedEmail);
  await expect(page.getByText("Invited E2E Staff · staff")).toBeVisible();

  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await login(page, emails.owner);
  await page.getByTestId("tab-setup").click();
  const row = page.locator(".pilot-staff-row").filter({ hasText: invitedEmail });
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Remove staff สำเร็จ")).toBeVisible();
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect.poll(async () => (await context.cookies()).some((c) => c.name === "pawspace_access_token")).toBe(false);
  await login(page, invitedEmail, false);
  await expect(page).toHaveURL(/\/login/);
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "pawspace_access_token")).toBeUndefined();
});

test("Issue #3: no-password invite sends a real email credential flow the recipient can consume", async ({ page, context }) => {
  const invitedEmail = `invited-mail-${suffix}@pawspace.test`;
  const newPassword = "PawSpace-Invited-Strong-456!";

  await login(page, emails.owner);
  await page.getByTestId("tab-setup").click();
  const invite = page.getByTestId("staff-invite-form");
  await invite.locator('input[name="email"]').fill(invitedEmail);
  await invite.locator('input[name="name"]').fill("Invited Via Email");
  // Password field left blank on purpose: this exercises inviteStaffAction's
  // no-password branch, which must call Supabase inviteUserByEmail() rather
  // than provisioning a password directly.
  await invite.locator('select[name="role"]').selectOption("staff");
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText("เชิญ staff สำเร็จ")).toBeVisible();
  await expect(page.getByText(invitedEmail)).toBeVisible();
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Consume the real invite email: fetch it from local Mailpit, follow the
  // actual /auth/v1/verify link Supabase Auth generated (not a shortcut).
  const verifyLink = await waitForInviteLink(invitedEmail);
  await page.goto(verifyLink);
  await expect(page).toHaveURL(/\/auth\/accept-invite/);
  await expect(page.getByTestId("accept-invite-form")).toBeVisible();
  await page.locator("#password").fill(newPassword);
  await page.locator("#confirmPassword").fill(newPassword);
  await page.getByRole("button", { name: "ตั้งรหัสผ่านและเข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/login/);

  // The credential the invite flow itself produced now logs in for real.
  await page.goto("/login");
  await page.getByLabel("อีเมล (Email)").fill(invitedEmail);
  await page.getByLabel("รหัสผ่าน (Password)").fill(newPassword);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Invited Via Email · staff")).toBeVisible();
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();

  await login(page, emails.owner);
  await page.getByTestId("tab-setup").click();
  const row = page.locator(".pilot-staff-row").filter({ hasText: invitedEmail });
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Remove staff สำเร็จ")).toBeVisible();
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect.poll(async () => (await context.cookies()).some((c) => c.name === "pawspace_access_token")).toBe(false);

  await login(page, invitedEmail, false);
  await expect(page).toHaveURL(/\/login/);
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "pawspace_access_token")).toBeUndefined();
});

test("pilot core loop runs through real UI and HTTP runtime", async ({ page }) => {
  const { data: businessDate, error: dateError } = await admin.rpc("pawspace_business_date");
  if (dateError || typeof businessDate !== "string") throw new Error("Cannot resolve Bangkok business date");
  const out = new Date(`${businessDate}T00:00:00Z`);
  out.setUTCDate(out.getUTCDate() + 1);
  const checkOutDate = out.toISOString().slice(0, 10);

  await login(page, emails.owner);
  await page.getByTestId("tab-setup").click();
  const roomForm = page.getByTestId("room-create-form");
  await roomForm.locator('input[name="roomNumber"]').fill("E2E-01");
  await roomForm.locator('select[name="roomType"]').selectOption("standard");
  await roomForm.locator('input[name="capacityPets"]').fill("2");
  await roomForm.locator('input[name="basePricePerNight"]').fill("500");
  await roomForm.getByRole("button", { name: "เพิ่มห้อง" }).click();
  await expect(page.getByText("เพิ่มห้อง สำเร็จ")).toBeVisible();

  await page.getByTestId("tab-customers").click();
  const ownerForm = page.getByTestId("owner-create-form");
  await ownerForm.locator('input[name="firstName"]').fill("E2E Owner");
  await ownerForm.locator('input[name="phone"]').fill(`09${Date.now().toString().slice(-8)}`);
  await ownerForm.getByRole("button", { name: "บันทึกลูกค้า" }).click();
  await expect(page.getByText("เพิ่มลูกค้า สำเร็จ")).toBeVisible();
  const ownerCard = page.locator("article.card").filter({ hasText: "E2E Owner" });
  const petCreate = ownerCard.locator("form.pilot-inline-form");
  await petCreate.locator('input[name="name"]').fill("E2E Pet");
  await petCreate.locator('select[name="species"]').selectOption("dog");
  await petCreate.getByRole("button", { name: "+ เพิ่มสัตว์" }).click();
  await expect(page.getByText("เพิ่มสัตว์ สำเร็จ")).toBeVisible();

  await page.getByTestId("tab-bookings").click();
  const bookingForm = page.getByTestId("booking-create-form");
  await bookingForm.locator('select[name="ownerId"]').selectOption({ index: 0 });
  await bookingForm.locator('select[name="roomId"]').selectOption({ index: 0 });
  await bookingForm.locator('input[name="checkInDate"]').fill(businessDate);
  await bookingForm.locator('input[name="checkOutDate"]').fill(checkOutDate);
  await bookingForm.getByRole("button", { name: "สร้าง Booking" }).click();
  await expect(page.getByText("สร้างการจอง สำเร็จ")).toBeVisible();
  const bookingCard = page.locator("article.card").filter({ hasText: "E2E Owner" }).first();
  await bookingCard.locator('select[id^="pet-"]').selectOption({ label: "E2E Pet" });
  await bookingCard.getByRole("button", { name: "เพิ่มสัตว์" }).click();
  await expect(page.getByText("เพิ่มสัตว์ใน booking สำเร็จ")).toBeVisible();
  await bookingCard.getByRole("button", { name: "Check-in" }).click();
  await expect(page.getByText("เช็คอิน สำเร็จ")).toBeVisible();

  await page.getByTestId("tab-reports").click();
  const reportForm = page.getByTestId("report-create-form");
  await reportForm.locator('select[name="petId"]').selectOption({ label: "E2E Pet" });
  await reportForm.locator('input[name="staffNotes"]').fill("Phase 10 browser E2E report");
  await reportForm.locator('input[name="photos"]').setInputFiles({
    name: "pet.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await reportForm.getByRole("button", { name: "สร้างและเข้าคิวส่ง LINE" }).click();
  await expect(page.getByText("สร้าง Daily Report แล้ว")).toBeVisible();
  await expect(page.getByText("Phase 10 browser E2E report")).toBeVisible();

  await page.getByTestId("tab-bookings").click();
  const checkedInCard = page.locator("article.card").filter({ hasText: "E2E Owner" }).first();
  await checkedInCard.getByRole("button", { name: "Check-out" }).click();
  await expect(page.getByText("เช็คเอาท์ สำเร็จ")).toBeVisible();
  await page.getByTestId("tab-overview").click();
  const roomCard = page.locator("article.room-card").filter({ hasText: "E2E-01" });
  await expect(roomCard.getByText("รอทำความสะอาด")).toBeVisible();
  await roomCard.getByRole("button", { name: "Mark clean" }).click();
  await expect(page.getByText("ทำเครื่องหมายห้องสะอาด สำเร็จ")).toBeVisible();
  await expect(roomCard.getByText("ว่าง")).toBeVisible();
});
test("tenant A cannot expose or mutate tenant B resources", async ({ page }) => {
  const { data: roomB, error: roomError } = await admin.from("rooms").insert({ shop_id: shopB, room_number: "SECRET-B-ROOM", room_type: "standard", capacity_pets: 1, base_price_per_night: 100, status: "occupied" }).select("id").single();
  const { data: ownerB, error: ownerError } = await admin.from("pet_owners").insert({ shop_id: shopB, first_name: "Secret", phone: `08${Date.now().toString().slice(-8)}` }).select("id").single();
  if (roomError || ownerError || !roomB || !ownerB) throw new Error("tenant B fixture failed");
  const { data: petB, error: petError } = await admin.from("pets").insert({ shop_id: shopB, owner_id: ownerB.id, name: "Secret Pet", species: "dog" }).select("id").single();
  if (petError || !petB) throw new Error(`tenant B pet fixture: ${petError?.message}`);
  const { data: businessDate } = await admin.rpc("pawspace_business_date");
  const out = new Date(`${String(businessDate)}T00:00:00Z`); out.setUTCDate(out.getUTCDate() + 1);
  const { data: bookingB, error: bookingError } = await admin.from("bookings").insert({ shop_id: shopB, owner_id: ownerB.id, room_id: roomB.id, check_in_date: businessDate, check_out_date: out.toISOString().slice(0,10), booking_status: "checked_in", total_amount: 0 }).select("id").single();
  if (bookingError || !bookingB) throw new Error(`tenant B booking fixture: ${bookingError?.message}`);
  const { error: memberError } = await admin.from("booking_pets").insert({ shop_id: shopB, booking_id: bookingB.id, pet_id: petB.id });
  if (memberError) throw new Error(`tenant B membership fixture: ${memberError.message}`);

  await login(page, emails.owner);
  await expect(page.getByText("SECRET-B-ROOM")).toHaveCount(0);
  const response = await page.evaluate(async ({ bookingId, petId }) => {
    const form = new FormData();
    form.set("bookingId", bookingId);
    form.set("petId", petId);
    form.set("idempotencyKey", crypto.randomUUID());
    form.set("foodStatus", "finished");
    form.set("excretionStatus", "normal");
    form.set("moodStatus", "happy");
    form.set("staffNotes", "cross tenant attempt");
    const binary = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), (char) => char.charCodeAt(0));
    form.set("photos", new File([binary], "pet.png", { type: "image/png" }));
    const result = await fetch("/api/daily-reports", { method: "POST", body: form });
    return { status: result.status, body: await result.json() };
  }, { bookingId: String(bookingB.id), petId: String(petB.id) });
  expect(response.status).toBe(409);
  const { count } = await admin.from("daily_reports").select("id", { count: "exact", head: true }).eq("shop_id", shopA).eq("booking_id", bookingB.id);
  expect(count).toBe(0);
});

test("Phase 12: owner can access /onboarding, update profile, and execute CSV import through UI", async ({ page }) => {
  await login(page, emails.owner);
  await page.goto("/onboarding");
  await expect(page.getByText("Closed Beta Readiness Hub")).toBeVisible();

  // Test Profile Save Tab
  await page.getByRole("button", { name: "⚙️ Shop Profile" }).click();
  await page.getByLabel("Contact Phone Number").fill("02-999-3333");
  await page.getByRole("button", { name: "💾 Save Profile Settings" }).click();
  await expect(page.getByText("Shop profile updated successfully.")).toBeVisible();

  // Verify DB updated
  const { data: updatedShop } = await admin.from("shops").select("phone").eq("id", shopA).single();
  expect(updatedShop?.phone).toBe("02-999-3333");

  // Test CSV Import Tab
  await page.getByRole("button", { name: "📥 CSV Data Import" }).click();
  await page.getByRole("button", { name: "Load Sample CSV" }).click();
  await page.getByRole("button", { name: "🔍 Validate & Preview (Zero DB Writes)" }).click();
  await expect(page.getByText("Validation & Diff Preview")).toBeVisible();
  await expect(page.getByText("VALID", { exact: false }).first()).toBeVisible();

  // Confirm Import
  await page.getByRole("button", { name: "Confirm & Import", exact: false }).click();
  await expect(page.getByText("Import Execution Result")).toBeVisible();
});

test.afterAll(async () => {
  if (shopA) await admin.from("shops").delete().eq("id", shopA);
  if (shopB) await admin.from("shops").delete().eq("id", shopB);
  for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => undefined);
});

