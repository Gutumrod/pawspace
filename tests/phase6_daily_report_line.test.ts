import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createBooking, addPetToBooking, updateBookingStatus } from "../lib/booking-service";
import { createDailyReport, retryDailyReportDelivery } from "../lib/daily-report-service";
import { prepareDailyReportImage, isAcceptedDailyReportMime } from "../lib/daily-report-media";
import { storeDailyReportImage, cleanupDailyReportImages } from "../lib/daily-report-storage";
import { sendLineDailyReport, type LineDeliveryJob } from "../lib/line-transport";

function need(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
const url = need("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = need("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

type TestUser = { id: string; email: string; client: SupabaseClient };
let passed = 0;
let failed = 0;
function check(ok: boolean, name: string, detail?: string) {
  if (ok) { console.log(`  [PASS] ${name}`); passed += 1; }
  else { console.error(`  [FAIL] ${name}${detail ? ` - ${detail}` : ""}`); failed += 1; }
}
function authedClient(token: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function createUser(email: string): Promise<TestUser> {
  const password = "TestPassword123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`create user failed: ${error?.message}`);
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: loginError } = await anon.auth.signInWithPassword({ email, password });
  if (loginError || !auth.session) throw new Error(`login failed: ${loginError?.message}`);
  return { id: data.user.id, email, client: authedClient(auth.session.access_token) };
}

async function rpcId(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<string> {
  const { data, error } = await client.rpc(name, args);
  if (error || !data) throw new Error(`${name} failed: ${error?.message}`);
  return data as string;
}

function actor(user: TestUser, shopId: string, role: "owner" | "manager" | "staff" = "owner") {
  return { userId: user.id, shopId, role } as const;
}
async function createOwnerAndPet(client: SupabaseClient, suffix: string) {
  const ownerId = await rpcId(client, "create_pet_owner", {
    p_first_name: `P6-${suffix}`,
    p_last_name: "Tester",
    p_phone: `08${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, "0").slice(0, 8)}`,
    p_emergency_phone: null,
    p_address: null,
  });
  const petId = await rpcId(client, "create_pet", {
    p_owner_id: ownerId,
    p_name: `Pet-${suffix}`,
    p_species: "dog",
    p_breed: "Mixed",
    p_gender: "male",
    p_birth_date: null,
    p_weight_kg: 8.5,
    p_avatar_url: null,
    p_special_care_notes: null,
    p_allergies: null,
  });
  return { ownerId, petId };
}

async function claimOne() {
  const { data, error } = await admin.rpc("claim_line_delivery_internal");
  if (error) throw new Error(`claim failed: ${error.message}`);
  return Array.isArray(data) && data.length > 0 ? data[0] as Record<string, unknown> : null;
}
async function run() {
  console.log("=== PawSpace Phase 6 Daily Report + LINE Tests ===\n");
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const owner = await createUser(`p6_owner_${runId}@pawspace-test.local`);
  const other = await createUser(`p6_other_${runId}@pawspace-test.local`);
  const users = [owner.id, other.id];
  let shop1 = "";
  let shop2 = "";
  const storedImages: Awaited<ReturnType<typeof storeDailyReportImage>>[] = [];

  try {
    shop1 = await rpcId(owner.client, "bootstrap_shop", { p_name: "Phase 6 Shop", p_slug: `p6-${runId}` });
    shop2 = await rpcId(other.client, "bootstrap_shop", { p_name: "Phase 6 Other", p_slug: `p6-other-${runId}` });
    const primary = await createOwnerAndPet(owner.client, "Primary");
    const spare = await createOwnerAndPet(owner.client, "Spare");
    await admin.from("pet_owners").update({ line_user_id: "U_PHASE6_OWNER" }).eq("id", primary.ownerId);

    const room = await rpcId(owner.client, "create_room", {
      p_room_number: `P6-${runId.slice(-4)}`,
      p_room_type: "standard",
      p_capacity_pets: 2,
      p_base_price_per_night: 500,
    });
    const { data: todayRaw, error: dateError } = await owner.client.rpc("pawspace_business_date");
    if (dateError || !todayRaw) throw new Error(`business date failed: ${dateError?.message}`);
    const today = todayRaw as string;
    const out = new Date(`${today}T00:00:00Z`); out.setUTCDate(out.getUTCDate() + 1);
    const tomorrow = out.toISOString().slice(0, 10);
    const booking = await createBooking(owner.client, actor(owner, shop1), {
      ownerId: primary.ownerId,
      roomId: room,
      checkInDate: today,
      checkOutDate: tomorrow,
      totalAmount: 500,
    });
    if (!booking.success || !booking.data?.bookingId) throw new Error(`booking failed: ${booking.error}`);
    const bookingId = booking.data.bookingId;
    const add = await addPetToBooking(owner.client, actor(owner, shop1), bookingId, primary.petId);
    if (!add.success) throw new Error(`add pet failed: ${add.error}`);

    const beforeCheckIn = await createDailyReport(owner.client, actor(owner, shop1), {
      bookingId, petId: primary.petId, foodStatus: "finished", excretionStatus: "normal",
      moodStatus: "happy", photoUrls: ["https://example.com/before.jpg"], idempotencyKey: crypto.randomUUID(),
    });
    check(!beforeCheckIn.success, "Report before check-in is rejected");

    const checkedIn = await updateBookingStatus(owner.client, actor(owner, shop1), bookingId, "checked_in");
    if (!checkedIn.success) throw new Error(`check-in failed: ${checkedIn.error}`);

    const webp = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#44aa88" } }).webp().toBuffer();
    const prepared = await prepareDailyReportImage(new File([webp], "pet.webp", { type: "application/octet-stream" }));
    check(prepared.sourceContentType === "image/webp", "Generic mobile MIME is inferred safely from .webp");
    check(prepared.lineContentType === "image/jpeg" && prepared.lineExtension === "jpg", "Non-LINE image format gets JPEG rendition");
    check(isAcceptedDailyReportMime("image/heic") && isAcceptedDailyReportMime("image/heif") && isAcceptedDailyReportMime("image/tiff") && isAcceptedDailyReportMime("image/bmp"), "Broad source image formats include HEIC/HEIF/TIFF/BMP");
    const reportKey = crypto.randomUUID();
    const stored = await storeDailyReportImage(admin, {
      shopId: shop1,
      bookingId,
      petId: primary.petId,
      idempotencyKey: reportKey,
    }, 0, prepared);
    storedImages.push(stored);
    check(stored.sourcePath.endsWith("source.webp"), "Original WEBP is retained in storage");
    check(stored.linePath.endsWith("line.jpg"), "LINE-compatible derivative is stored separately");
    const { data: sourceDownload, error: sourceError } = await admin.storage.from("daily-report-photos").download(stored.sourcePath);
    const { data: lineDownload, error: lineError } = await admin.storage.from("daily-report-photos").download(stored.linePath);
    check(!sourceError && Boolean(sourceDownload), "Original source object is retrievable");
    check(!lineError && Boolean(lineDownload), "LINE rendition object is retrievable");

    const input = {
      bookingId,
      petId: primary.petId,
      foodStatus: "finished" as const,
      excretionStatus: "normal" as const,
      moodStatus: "happy" as const,
      photoUrls: [stored.linePublicUrl],
      staffNotes: "Phase 6 report",
      idempotencyKey: reportKey,
    };
    const created = await createDailyReport(owner.client, actor(owner, shop1), input);
    check(created.success && Boolean(created.data?.reportId), "Checked-in Daily Report is created");
    if (!created.success) throw new Error(created.error);
    const reportId = created.data.reportId;

    const same = await createDailyReport(owner.client, actor(owner, shop1), input);
    check(same.success && same.data.reportId === reportId, "Same idempotency key + same payload returns same report");
    const conflict = await createDailyReport(owner.client, actor(owner, shop1), { ...input, staffNotes: "different" });
    check(!conflict.success, "Same idempotency key + different payload is rejected");
    const wrongPet = await createDailyReport(owner.client, actor(owner, shop1), {
      ...input,
      petId: spare.petId,
      idempotencyKey: crypto.randomUUID(),
    });
    check(!wrongPet.success, "Pet not assigned to booking is rejected");

    const crossTenant = await createDailyReport(other.client, actor(other, shop2), {
      ...input,
      idempotencyKey: crypto.randomUUID(),
    });
    check(!crossTenant.success, "Cross-tenant Daily Report attempt is rejected");

    const { error: directInsertError } = await owner.client.from("daily_reports").insert({
      shop_id: shop1,
      booking_id: bookingId,
      pet_id: primary.petId,
      idempotency_key: crypto.randomUUID(),
      request_fingerprint: "forged",
      line_delivery_retry_key: crypto.randomUUID(),
      food_status: "finished",
      excretion_status: "normal",
      mood_status: "happy",
      photo_urls: [stored.linePublicUrl],
    });
    check(Boolean(directInsertError), "Authenticated browser cannot INSERT Daily Report directly");
    const { error: directDeliveryUpdate } = await owner.client.from("daily_reports")
      .update({ line_delivery_status: "sent" }).eq("id", reportId);
    check(Boolean(directDeliveryUpdate), "Authenticated browser cannot mutate LINE delivery state");

    const { error: browserClaimError } = await owner.client.rpc("claim_line_delivery_internal");
    check(Boolean(browserClaimError), "Authenticated browser cannot call internal LINE worker claim RPC");
    const concurrentClaims = await Promise.all([
      admin.rpc("claim_line_delivery_internal"),
      admin.rpc("claim_line_delivery_internal"),
    ]);
    const claimedRows = concurrentClaims.flatMap((result) => Array.isArray(result.data) ? result.data : []);
    const targetClaims = claimedRows.filter((row) => (row as Record<string, unknown>).report_id === reportId);
    check(targetClaims.length === 1, "Concurrent workers claim the target report exactly once", `targetClaims=${targetClaims.length}`);
    const claimed = targetClaims[0] as Record<string, unknown> | undefined;
    if (!claimed) throw new Error("Target Daily Report was not claimed by either concurrent worker.");
    check(claimed.recipient_line_user_id === "U_PHASE6_OWNER", "Worker recipient comes from verified owner LINE identity");
    const retryKey = String(claimed.retry_key);

    const { error: failTransitionError } = await admin.rpc("mark_line_delivery_failed_internal", {
      p_report_id: reportId,
      p_retry_key: retryKey,
      p_error_message: "temporary LINE failure",
    });
    check(!failTransitionError, "Worker can transition sending to failed");
    const { data: failedRow } = await admin.from("daily_reports")
      .select("line_delivery_status,line_retry_count,line_delivery_retry_key")
      .eq("id", reportId).single();
    check(failedRow?.line_delivery_status === "failed" && failedRow?.line_retry_count === 1, "Failed delivery increments retry count");

    const manualRetry = await retryDailyReportDelivery(owner.client, actor(owner, shop1), reportId);
    check(manualRetry.success, "Manual failed -> pending retry succeeds");
    const { data: retryRow } = await admin.from("daily_reports")
      .select("line_delivery_status,line_delivery_retry_key")
      .eq("id", reportId).single();
    check(retryRow?.line_delivery_status === "pending" && retryRow?.line_delivery_retry_key === retryKey, "Manual retry preserves LINE retry key");

    const reclaimed = await claimOne();
    check(reclaimed?.report_id === reportId && reclaimed?.retry_key === retryKey, "Retry claim reuses the same persistent retry key");
    const job: LineDeliveryJob = {
      reportId,
      shopId: shop1,
      retryKey,
      firstAttemptAt: String(reclaimed?.first_attempt_at),
      recipientLineUserId: "U_PHASE6_OWNER",
      petName: "Pet-Primary",
      ownerName: "P6-Primary Tester",
      foodStatus: "finished",
      excretionStatus: "normal",
      moodStatus: "happy",
      photoUrls: [stored.linePublicUrl],
      staffNotes: "Phase 6 report",
    };
    let seenRetryKey = "";
    let seenRecipient = "";
    const okFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seenRetryKey = headers.get("x-line-retry-key") ?? "";
      const payload = JSON.parse(String(init?.body)) as { to?: string };
      seenRecipient = payload.to ?? "";
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const pushed = await sendLineDailyReport(job, "test-channel-token", okFetch);
    check(pushed.accepted && pushed.status === 200, "LINE HTTP 200 is accepted as sent");
    check(seenRetryKey === retryKey, "LINE request sends persistent X-Line-Retry-Key");
    check(seenRecipient === "U_PHASE6_OWNER", "LINE request targets verified owner identity only");

    const duplicate = await sendLineDailyReport(job, "test-channel-token", (async () =>
      new Response("{}", { status: 409, headers: { "content-type": "application/json" } })) as typeof fetch);
    check(duplicate.accepted && duplicate.status === 409, "LINE duplicate retry response 409 is treated as already accepted");

    const { error: sentError } = await admin.rpc("mark_line_delivery_sent_internal", {
      p_report_id: reportId,
      p_retry_key: retryKey,
    });
    check(!sentError, "Worker can transition sending to sent");
    const secondKey = crypto.randomUUID();
    const second = await createDailyReport(owner.client, actor(owner, shop1), {
      ...input,
      idempotencyKey: secondKey,
      staffNotes: "stale worker recovery",
    });
    if (!second.success) throw new Error(second.error);
    const firstClaim = await claimOne();
    check(firstClaim?.report_id === second.data.reportId, "Second pending report is claimable");
    const secondRetryKey = String(firstClaim?.retry_key);
    await admin.from("daily_reports").update({
      line_delivery_started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    }).eq("id", second.data.reportId);
    const staleReclaim = await claimOne();
    check(staleReclaim?.report_id === second.data.reportId && staleReclaim?.retry_key === secondRetryKey, "Stale sending lease is reclaimed with same retry key");
    await admin.rpc("mark_line_delivery_sent_internal", {
      p_report_id: second.data.reportId,
      p_retry_key: secondRetryKey,
    });

    const safety = await createDailyReport(owner.client, actor(owner, shop1), {
      ...input,
      idempotencyKey: crypto.randomUUID(),
      staffNotes: "retry safety window",
    });
    if (!safety.success) throw new Error(safety.error);
    await admin.from("daily_reports").update({
      line_first_attempt_at: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
    }).eq("id", safety.data.reportId);
    const afterWindowClaim = await claimOne();
    check(afterWindowClaim?.report_id !== safety.data.reportId, "Report older than LINE retry-key safety window is not dispatched");
    const { data: safetyRow } = await admin.from("daily_reports")
      .select("line_delivery_status,line_error_message")
      .eq("id", safety.data.reportId).single();
    check(safetyRow?.line_delivery_status === "failed" && String(safetyRow?.line_error_message).includes("operator review"), "Expired retry window fails safe for operator review");
    const noPhotos = await createDailyReport(owner.client, actor(owner, shop1), {
      ...input,
      photoUrls: [],
      idempotencyKey: crypto.randomUUID(),
    });
    check(!noPhotos.success, "Daily Report with zero photos is rejected");
    const fivePhotos = await createDailyReport(owner.client, actor(owner, shop1), {
      ...input,
      photoUrls: Array.from({ length: 5 }, (_, i) => `https://example.com/${i}.jpg`),
      idempotencyKey: crypto.randomUUID(),
    });
    check(!fivePhotos.success, "Daily Report with more than four photos is rejected");

    const { error: browserStorageError } = await owner.client.storage.from("daily-report-photos")
      .upload(`${shop1}/browser-forged.jpg`, new Blob([webp], { type: "image/webp" }), { contentType: "image/webp" });
    check(Boolean(browserStorageError), "Authenticated browser cannot upload directly to report bucket");

    const disguisedWebp = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#ffffff" } }).webp().toBuffer();
    let contentMismatchRejected = false;
    try {
      await prepareDailyReportImage(new File([disguisedWebp], "disguised.png", { type: "image/png" }));
    } catch (error) {
      contentMismatchRejected = error instanceof Error && error.message === "IMAGE_CONTENT_TYPE_MISMATCH";
    }
    check(contentMismatchRejected, "Decoded image format must match MIME and filename extension");

    const png = await sharp({ create: { width: 20, height: 20, channels: 4, background: "#ffffff" } }).png().toBuffer();
    const pngPrepared = await prepareDailyReportImage(new File([png], "photo.png", { type: "image/png" }));
    check(pngPrepared.lineContentType === "image/png", "PNG remains PNG for LINE rendition");
    const avif = await sharp(png).avif().toBuffer();
    const avifPrepared = await prepareDailyReportImage(new File([avif], "photo.avif", { type: "image/avif" }));
    check(avifPrepared.sourceContentType === "image/avif" && avifPrepared.lineContentType === "image/jpeg", "AVIF source is accepted and normalized for LINE");
    const tiff = await sharp(png).tiff().toBuffer();
    const tiffPrepared = await prepareDailyReportImage(new File([tiff], "photo.tiff", { type: "image/tiff" }));
    check(tiffPrepared.sourceContentType === "image/tiff" && tiffPrepared.lineContentType === "image/jpeg", "TIFF source is accepted and normalized for LINE");

    const concurrentKey = crypto.randomUUID();
    const concurrentInput = { ...input, idempotencyKey: concurrentKey, staffNotes: "concurrent-idempotency" };
    const [duplicateA, duplicateB] = await Promise.all([
      createDailyReport(owner.client, actor(owner, shop1), concurrentInput),
      createDailyReport(owner.client, actor(owner, shop1), concurrentInput),
    ]);
    check(
      duplicateA.success && duplicateB.success && duplicateA.data.reportId === duplicateB.data.reportId,
      "Concurrent identical idempotency requests converge to one report",
    );

    const raceKey = crypto.randomUUID();
    const [raceReport, raceCheckout] = await Promise.all([
      createDailyReport(owner.client, actor(owner, shop1), { ...input, idempotencyKey: raceKey, staffNotes: "checkout race" }),
      updateBookingStatus(owner.client, actor(owner, shop1), bookingId, "checked_out"),
    ]);
    check(raceCheckout.success, "Concurrent checkout completes successfully");
    const { count: raceCount } = await admin.from("daily_reports")
      .select("id", { count: "exact", head: true }).eq("shop_id", shop1).eq("idempotency_key", raceKey);
    check((raceReport.success && raceCount === 1) || (!raceReport.success && raceCount === 0), "Report/checkout race serializes without stale partial commit");

    const afterCheckout = await createDailyReport(owner.client, actor(owner, shop1), {
      ...input,
      idempotencyKey: crypto.randomUUID(),
    });
    check(!afterCheckout.success, "Report after checkout is rejected");
  } finally {
    if (storedImages.length > 0) {
      await cleanupDailyReportImages(admin, storedImages).catch(() => undefined);
    }
    if (shop1) await admin.from("shops").delete().eq("id", shop1);
    if (shop2) await admin.from("shops").delete().eq("id", shop2);
    for (const userId of users) await admin.auth.admin.deleteUser(userId);
  }

  console.log(`\n=== Phase 6 Result: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error("Phase 6 suite crashed:", error);
  process.exitCode = 1;
});
