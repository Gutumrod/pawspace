import type { BookingSheetRecord, PetCustomerRecord } from "./google-sheet-records";
import {
  BOOKING_HEADERS,
  BOOKING_SHEET_NAME,
  CUSTOMER_HEADERS,
  CUSTOMER_SHEET_NAME,
  buildBookingRow,
  buildCustomerRow,
} from "./google-sheet-records";
import type { SheetValueClient } from "./google-sheet-sync-core";
import { deleteCanonicalRow, upsertCanonicalRow } from "./google-sheet-sync-core";

export type GoogleSyncClaim = {
  event_id: string;
  shop_id: string;
  entity_type: "pet_customer" | "booking";
  entity_id: string;
  queued_operation: "UPSERT" | "DELETE";
  google_sheet_id: string;
  attempts: number;
};

export type EffectiveGoogleSyncOperation = "UPSERT" | "DELETE";

export interface GoogleSyncWorkerCoreDeps {
  api: SheetValueClient;
  readPetCustomer(shopId: string, petId: string): Promise<PetCustomerRecord | null>;
  readBooking(shopId: string, bookingId: string): Promise<BookingSheetRecord | null>;
  markCompleted(
    job: GoogleSyncClaim,
    operation: EffectiveGoogleSyncOperation,
    sheetName: string,
    hash: string | null,
  ): Promise<void>;
}
export function sanitizeGoogleSyncError(error: unknown): string {
  if (error instanceof Error && error.name === "GoogleSheetsApiError") {
    const shaped = error as Error & { code?: unknown; status?: unknown };
    const code = typeof shaped.code === "string" && /^[A-Z0-9_]+$/.test(shaped.code)
      ? shaped.code
      : "UPSTREAM_ERROR";
    const status = typeof shaped.status === "number" && Number.isInteger(shaped.status)
      ? shaped.status
      : undefined;
    return `Google Sheets API ${code}${status ? ` (HTTP ${status})` : ""}.`;
  }
  return "Google Sheets sync failed; see sanitized server logs.";
}

export async function processGoogleSyncJob(
  job: GoogleSyncClaim,
  deps: GoogleSyncWorkerCoreDeps,
): Promise<void> {
  if (job.entity_type === "pet_customer") {
    const record = await deps.readPetCustomer(job.shop_id, job.entity_id);
    if (!record) {
      await deleteCanonicalRow(deps.api, job.google_sheet_id, CUSTOMER_SHEET_NAME, CUSTOMER_HEADERS, job.entity_id);
      await deps.markCompleted(job, "DELETE", CUSTOMER_SHEET_NAME, null);
      return;
    }

    const row = buildCustomerRow(record);
    const hash = await upsertCanonicalRow(deps.api, job.google_sheet_id, CUSTOMER_SHEET_NAME, CUSTOMER_HEADERS, row);
    await deps.markCompleted(job, "UPSERT", CUSTOMER_SHEET_NAME, hash);
    return;
  }
  const record = await deps.readBooking(job.shop_id, job.entity_id);
  if (!record) {
    await deleteCanonicalRow(deps.api, job.google_sheet_id, BOOKING_SHEET_NAME, BOOKING_HEADERS, job.entity_id);
    await deps.markCompleted(job, "DELETE", BOOKING_SHEET_NAME, null);
    return;
  }

  const row = buildBookingRow(record);
  const hash = await upsertCanonicalRow(deps.api, job.google_sheet_id, BOOKING_SHEET_NAME, BOOKING_HEADERS, row);
  await deps.markCompleted(job, "UPSERT", BOOKING_SHEET_NAME, hash);
}

export type GoogleSyncSummary = { claimed: number; completed: number; failed: number };

export interface GoogleSyncBatchDeps {
  claimNext(): Promise<GoogleSyncClaim | null>;
  processJob(job: GoogleSyncClaim): Promise<void>;
  markFailed(job: GoogleSyncClaim, error: unknown): Promise<void>;
  onEventFailed?(job: GoogleSyncClaim, error: unknown): void;
  onFailureTransitionError?(job: GoogleSyncClaim, error: unknown): void;
}

export async function runGoogleSyncBatchCore(
  maxJobs: number,
  deps: GoogleSyncBatchDeps,
): Promise<GoogleSyncSummary> {
  const limit = Math.max(1, Math.min(Math.trunc(maxJobs), 20));
  const summary: GoogleSyncSummary = { claimed: 0, completed: 0, failed: 0 };

  for (let index = 0; index < limit; index += 1) {
    const job = await deps.claimNext();
    if (!job) break;
    summary.claimed += 1;

    try {
      await deps.processJob(job);
      summary.completed += 1;
    } catch (error) {
      summary.failed += 1;
      try {
        await deps.markFailed(job, error);
      } catch (transitionError) {
        deps.onFailureTransitionError?.(job, transitionError);
        throw transitionError;
      }
      deps.onEventFailed?.(job, error);
    }
  }

  return summary;
}
