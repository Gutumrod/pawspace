import "server-only";
import { getSupabaseAdminClient } from "./supabase-admin";
import { getLineChannelAccessTokenForShop } from "./env";
import { logger } from "./logger";
import { sendLineDailyReport, type LineDeliveryJob } from "./line-transport";

type ClaimRow = {
  report_id: string;
  shop_id: string;
  retry_key: string;
  first_attempt_at: string;
  recipient_line_user_id: string | null;
  pet_name: string;
  owner_name: string;
  food_status: string;
  excretion_status: string;
  mood_status: string;
  photo_urls: string[];
  staff_notes: string | null;
};

export type LineDispatcherSummary = {
  claimed: number;
  sent: number;
  failed: number;
};
function mapJob(row: ClaimRow): LineDeliveryJob {
  return {
    reportId: row.report_id,
    shopId: row.shop_id,
    retryKey: row.retry_key,
    firstAttemptAt: row.first_attempt_at,
    recipientLineUserId: row.recipient_line_user_id,
    petName: row.pet_name,
    ownerName: row.owner_name,
    foodStatus: row.food_status,
    excretionStatus: row.excretion_status,
    moodStatus: row.mood_status,
    photoUrls: row.photo_urls,
    staffNotes: row.staff_notes,
  };
}

async function markSent(reportId: string, retryKey: string) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("mark_line_delivery_sent_internal", {
    p_report_id: reportId,
    p_retry_key: retryKey,
  });
  if (error) throw new Error(`LINE_SENT_TRANSITION_FAILED:${error.message}`);
}
async function markFailed(reportId: string, retryKey: string, errorMessage: string) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("mark_line_delivery_failed_internal", {
    p_report_id: reportId,
    p_retry_key: retryKey,
    p_error_message: errorMessage.slice(0, 500),
  });
  if (error) throw new Error(`LINE_FAILED_TRANSITION_FAILED:${error.message}`);
}

async function claimNext(): Promise<LineDeliveryJob | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_line_delivery_internal");
  if (error) throw new Error(`LINE_CLAIM_FAILED:${error.message}`);

  const rows = Array.isArray(data) ? data as ClaimRow[] : [];
  if (rows.length === 0) return null;
  return mapJob(rows[0]);
}

export async function runLineDispatcherBatch(maxJobs = 10): Promise<LineDispatcherSummary> {
  const limit = Math.max(1, Math.min(Math.trunc(maxJobs), 20));
  const summary: LineDispatcherSummary = { claimed: 0, sent: 0, failed: 0 };

  for (let index = 0; index < limit; index += 1) {
    const job = await claimNext();
    if (!job) break;
    summary.claimed += 1;

    const channelAccessToken = getLineChannelAccessTokenForShop(job.shopId);
    if (!channelAccessToken) {
      await markFailed(job.reportId, job.retryKey, "LINE channel access token is not configured for this shop.");
      summary.failed += 1;
      continue;
    }

    if (!job.recipientLineUserId) {
      await markFailed(job.reportId, job.retryKey, "Pet owner does not have a verified LINE identity.");
      summary.failed += 1;
      continue;
    }

    const result = await sendLineDailyReport(job, channelAccessToken);
    if (result.accepted) {
      await markSent(job.reportId, job.retryKey);
      summary.sent += 1;
      continue;
    }

    await markFailed(job.reportId, job.retryKey, result.error);
    summary.failed += 1;
    logger.warn("LINE daily report delivery failed", {
      reportId: job.reportId,
      shopId: job.shopId,
      status: result.status,
      retryable: result.retryable,
      error: result.error,
    });
  }

  return summary;
}
