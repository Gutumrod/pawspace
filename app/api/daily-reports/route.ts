import { NextResponse } from "next/server";
import { createDailyReport } from "@/lib/daily-report-service";
import { DAILY_REPORT_MAX_PHOTOS, prepareDailyReportImage } from "@/lib/daily-report-media";
import {
  cleanupDailyReportImages,
  storeDailyReportImage,
  type DailyReportStoredImage,
} from "@/lib/daily-report-storage";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireTenantContext } from "@/lib/tenant-context";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validCoreFields(form: FormData, bookingId: string, petId: string, key: string): boolean {
  return UUID_RE.test(bookingId) && UUID_RE.test(petId) && UUID_RE.test(key) &&
    ["finished", "half", "little", "refused"].includes(field(form, "foodStatus")) &&
    ["normal", "diarrhea", "none"].includes(field(form, "excretionStatus")) &&
    ["happy", "calm", "stressed"].includes(field(form, "moodStatus")) &&
    field(form, "staffNotes").length <= 4000;
}

function mapMediaError(error: unknown): string {
  const code = error instanceof Error ? error.message : "INVALID_IMAGE";
  const known = new Set([
    "EMPTY_IMAGE", "IMAGE_TOO_LARGE", "UNSUPPORTED_IMAGE_TYPE",
    "IMAGE_EXTENSION_MISMATCH", "INVALID_IMAGE_CONTENT", "IMAGE_CONTENT_TYPE_MISMATCH",
    "LINE_IMAGE_TOO_LARGE",
  ]);
  return known.has(code) ? code : "IMAGE_PROCESSING_FAILED";
}

async function cleanupUnreferenced(
  client: Awaited<ReturnType<typeof requireTenantContext>>["client"],
  admin: ReturnType<typeof getSupabaseAdminClient>,
  shopId: string,
  idempotencyKey: string,
  images: DailyReportStoredImage[],
) {
  const { data } = await client
    .from("daily_reports")
    .select("photo_urls")
    .eq("shop_id", shopId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  const referenced = new Set<string>(Array.isArray(data?.photo_urls) ? data.photo_urls : []);
  const removable = images.filter((image) => !referenced.has(image.linePublicUrl));
  await cleanupDailyReportImages(admin, removable);
}

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireTenantContext>>;
  try {
    tenant = await requireTenantContext();
  } catch {
    return NextResponse.json({ success: false, code: "UNAUTHORIZED" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ success: false, code: "INVALID_MULTIPART" }, { status: 400 });
  }

  const files = form.getAll("photos").filter((value): value is File => value instanceof File);
  if (files.length < 1 || files.length > DAILY_REPORT_MAX_PHOTOS) {
    return NextResponse.json({ success: false, code: "INVALID_PHOTO_COUNT" }, { status: 400 });
  }

  const bookingId = field(form, "bookingId");
  const petId = field(form, "petId");
  const idempotencyKey = field(form, "idempotencyKey");
  if (!validCoreFields(form, bookingId, petId, idempotencyKey)) {
    return NextResponse.json({ success: false, code: "INVALID_REPORT_INPUT" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  let prepared;
  try {
    prepared = await Promise.all(files.map((file) => prepareDailyReportImage(file)));
  } catch (error) {
    return NextResponse.json({ success: false, code: mapMediaError(error) }, { status: 400 });
  }
  const stored: DailyReportStoredImage[] = [];
  try {
    for (let index = 0; index < prepared.length; index += 1) {
      stored.push(await storeDailyReportImage(admin, {
        shopId: tenant.staff.shopId,
        bookingId,
        petId,
        idempotencyKey,
      }, index, prepared[index]));
    }
  } catch (error) {
    await cleanupDailyReportImages(admin, stored);
    logger.warn("Daily report media upload failed", {
      shopId: tenant.staff.shopId,
      error: error instanceof Error ? error.message : "storage error",
    });
    return NextResponse.json({ success: false, code: "STORAGE_UPLOAD_FAILED" }, { status: 502 });
  }

  const actor = {
    userId: tenant.staff.userId,
    shopId: tenant.staff.shopId,
    role: tenant.staff.role,
  } as const;
  const result = await createDailyReport(tenant.client, actor, {
    bookingId,
    petId,
    foodStatus: field(form, "foodStatus") as "finished" | "half" | "little" | "refused",
    excretionStatus: field(form, "excretionStatus") as "normal" | "diarrhea" | "none",
    moodStatus: field(form, "moodStatus") as "happy" | "calm" | "stressed",
    photoUrls: stored.map((image) => image.linePublicUrl),
    staffNotes: field(form, "staffNotes") || null,
    idempotencyKey,
  });

  if (!result.success) {
    await cleanupUnreferenced(
      tenant.client,
      admin,
      tenant.staff.shopId,
      idempotencyKey,
      stored,
    );
    return NextResponse.json(
      { success: false, code: "REPORT_REJECTED", error: result.error },
      { status: 409 },
    );
  }

  return NextResponse.json({
    success: true,
    reportId: result.data.reportId,
    photoCount: stored.length,
  });
}
