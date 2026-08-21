import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";

export type DailyReportActor = {
  userId: string;
  shopId: string;
  role: "owner" | "manager" | "staff";
};

export type DailyReportResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export type CreateDailyReportInput = {
  bookingId: string;
  petId: string;
  foodStatus: "finished" | "half" | "little" | "refused";
  excretionStatus: "normal" | "diarrhea" | "none";
  moodStatus: "happy" | "calm" | "stressed";
  photoUrls: string[];
  staffNotes?: string | null;
  idempotencyKey: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validateInput(input: CreateDailyReportInput): string | null {
  if (!UUID_RE.test(input.bookingId) || !UUID_RE.test(input.petId) || !UUID_RE.test(input.idempotencyKey)) {
    return "Invalid booking, pet, or idempotency identifier.";
  }
  if (!["finished", "half", "little", "refused"].includes(input.foodStatus)) {
    return "Invalid food status.";
  }
  if (!["normal", "diarrhea", "none"].includes(input.excretionStatus)) {
    return "Invalid excretion status.";
  }
  if (!["happy", "calm", "stressed"].includes(input.moodStatus)) {
    return "Invalid mood status.";
  }
  if (input.photoUrls.length < 1 || input.photoUrls.length > 4) {
    return "Daily report requires between 1 and 4 photos.";
  }
  if (input.photoUrls.some((url) => {
    if (typeof url !== "string") return true;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:") return false;
      const localHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
      return !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && localHost);
    } catch {
      return true;
    }
  })) {
    return "Invalid photo URL.";
  }
  if ((input.staffNotes ?? "").length > 4000) {
    return "Staff notes are too long.";
  }
  return null;
}
export async function createDailyReport(
  client: SupabaseClient,
  actor: DailyReportActor,
  input: CreateDailyReportInput,
): Promise<DailyReportResult<{ reportId: string }>> {
  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  const { data, error } = await client.rpc("create_daily_report", {
    p_booking_id: input.bookingId,
    p_pet_id: input.petId,
    p_food_status: input.foodStatus,
    p_excretion_status: input.excretionStatus,
    p_mood_status: input.moodStatus,
    p_photo_urls: input.photoUrls,
    p_staff_notes: input.staffNotes ?? null,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error || typeof data !== "string") {
    logger.warn("Daily report creation rejected", {
      shopId: actor.shopId,
      userId: actor.userId,
      error: error?.message ?? "Invalid RPC response",
    });
    return { success: false, error: error?.message ?? "Unable to create daily report." };
  }

  return { success: true, data: { reportId: data } };
}
export async function retryDailyReportDelivery(
  client: SupabaseClient,
  actor: DailyReportActor,
  reportId: string,
): Promise<DailyReportResult> {
  if (!UUID_RE.test(reportId)) {
    return { success: false, error: "Invalid report identifier." };
  }

  const { error } = await client.rpc("retry_daily_report_delivery", {
    p_report_id: reportId,
  });

  if (error) {
    logger.warn("Daily report retry rejected", {
      shopId: actor.shopId,
      userId: actor.userId,
      reportId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }

  return { success: true, data: undefined };
}
