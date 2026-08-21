import "server-only";
import { getSupabaseAdminClient } from "./supabase-admin";
import { createGoogleSheetsApi } from "./google-sheets-api";
import { readBookingRecord, readPetCustomerRecord } from "./google-sync-source";
import {
  processGoogleSyncJob,
  runGoogleSyncBatchCore,
  sanitizeGoogleSyncError,
  type GoogleSyncClaim,
  type GoogleSyncSummary,
} from "./google-sync-worker-core";
import { logger } from "./logger";


async function claimNext(): Promise<GoogleSyncClaim | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_google_sync_event_internal");
  if (error) throw new Error(`GOOGLE_SYNC_CLAIM_FAILED:${error.message}`);
  const rows = Array.isArray(data) ? data as GoogleSyncClaim[] : [];
  return rows[0] ?? null;
}

async function markCompleted(
  job: GoogleSyncClaim,
  operation: "UPSERT" | "DELETE",
  sheetName: string,
  hash: string | null,
) {
  const { error } = await getSupabaseAdminClient().rpc("mark_google_sync_completed_internal", {
    p_event_id: job.event_id,
    p_effective_operation: operation,
    p_sheet_name: sheetName,
    p_synced_hash: hash,
  });
  if (error) throw new Error(`GOOGLE_SYNC_COMPLETE_FAILED:${error.message}`);
}

async function markFailed(job: GoogleSyncClaim, error: unknown) {
  const safeError = sanitizeGoogleSyncError(error);
  const { error: transitionError } = await getSupabaseAdminClient().rpc("mark_google_sync_failed_internal", {
    p_event_id: job.event_id,
    p_error_message: safeError,
  });
  if (transitionError) throw new Error(`GOOGLE_SYNC_FAILURE_TRANSITION_FAILED:${transitionError.message}`);
}

async function processJob(job: GoogleSyncClaim) {
  const admin = getSupabaseAdminClient();
  await processGoogleSyncJob(job, {
    api: createGoogleSheetsApi(),
    readPetCustomer: (shopId, petId) => readPetCustomerRecord(admin, shopId, petId),
    readBooking: (shopId, bookingId) => readBookingRecord(admin, shopId, bookingId),
    markCompleted,
  });
}

export async function runGoogleSyncBatch(maxJobs = 10): Promise<GoogleSyncSummary> {
  return runGoogleSyncBatchCore(maxJobs, {
    claimNext,
    processJob,
    markFailed,
    onFailureTransitionError(job, transitionError) {
      logger.error("Google sync failure transition failed", {
        eventId: job.event_id,
        shopId: job.shop_id,
        error: transitionError instanceof Error ? transitionError.message : String(transitionError),
      });
    },
    onEventFailed(job, error) {
      logger.warn("Google sync event failed", {
        eventId: job.event_id,
        shopId: job.shop_id,
        entityType: job.entity_type,
        attempts: job.attempts,
        error: sanitizeGoogleSyncError(error),
      });
    },
  });
}
