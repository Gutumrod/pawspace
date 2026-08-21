import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreparedDailyReportImage } from "./daily-report-media";

export const DAILY_REPORT_BUCKET = "daily-report-photos";

type UploadIdentity = {
  shopId: string;
  bookingId: string;
  petId: string;
  idempotencyKey: string;
};

export type DailyReportStoredImage = {
  sourcePath: string;
  linePath: string;
  linePublicUrl: string;
};

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { message?: string; statusCode?: string | number; status?: number };
  const message = (value.message ?? "").toLowerCase();
  return value.status === 409 || String(value.statusCode ?? "") === "409" ||
    message.includes("already exists") || message.includes("duplicate");
}
function objectBase(identity: UploadIdentity, index: number, hash: string): string {
  return [
    identity.shopId,
    identity.bookingId,
    identity.petId,
    identity.idempotencyKey,
    `${index}-${hash.slice(0, 24)}`,
  ].join("/");
}

async function uploadOrReuse(
  admin: SupabaseClient,
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await admin.storage.from(DAILY_REPORT_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
    cacheControl: "31536000",
  });

  if (error && !isAlreadyExistsError(error)) {
    throw new Error(`STORAGE_UPLOAD_FAILED:${error.message}`);
  }
}
export async function storeDailyReportImage(
  admin: SupabaseClient,
  identity: UploadIdentity,
  index: number,
  image: PreparedDailyReportImage,
): Promise<DailyReportStoredImage> {
  const base = objectBase(identity, index, image.contentHash);
  const sourcePath = `${base}/source.${image.sourceExtension}`;
  const linePath = `${base}/line.${image.lineExtension}`;

  await uploadOrReuse(admin, sourcePath, image.sourceBuffer, image.sourceContentType);
  try {
    await uploadOrReuse(admin, linePath, image.lineBuffer, image.lineContentType);
  } catch (error) {
    await admin.storage.from(DAILY_REPORT_BUCKET).remove([sourcePath]);
    throw error;
  }

  const { data } = admin.storage.from(DAILY_REPORT_BUCKET).getPublicUrl(linePath);
  return { sourcePath, linePath, linePublicUrl: data.publicUrl };
}

export async function cleanupDailyReportImages(
  admin: SupabaseClient,
  images: readonly DailyReportStoredImage[],
): Promise<void> {
  const paths = images.flatMap((image) => [image.sourcePath, image.linePath]);
  if (paths.length === 0) return;
  await admin.storage.from(DAILY_REPORT_BUCKET).remove([...new Set(paths)]);
}
