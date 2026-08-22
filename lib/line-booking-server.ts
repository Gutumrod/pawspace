import "server-only";

import { getSupabaseAdminClient } from "./supabase-admin";
import { requireLineLoginEnv } from "./env";
import {
  getCustomerBookingContextCore,
  submitBookingRequestCore,
  type CustomerBookingContext,
  type CustomerBookingCoreResult,
  type SubmitBookingRequestResult,
} from "./line-booking-core";
import { logger } from "./logger";

export type CustomerBookingActionResult<T> = CustomerBookingCoreResult<T>;

export async function getCustomerBookingContextServer(
  shopId: string,
  idToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CustomerBookingActionResult<CustomerBookingContext>> {
  try {
    const { channelId } = requireLineLoginEnv();
    const adminClient = getSupabaseAdminClient();
    const result = await getCustomerBookingContextCore(adminClient, channelId, shopId, idToken, fetchImpl);

    if (!result.success) {
      logger.warn("Customer booking context rejected", { shopId, code: result.code, error: result.error });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("getCustomerBookingContextServer failure", { error: message, shopId });
    return { success: false, error: "Server unavailable. Please try again.", code: "SERVER_ERROR" };
  }
}

export async function submitBookingRequestServer(
  rawInput: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitBookingRequestResult> {
  try {
    const { channelId } = requireLineLoginEnv();
    const adminClient = getSupabaseAdminClient();
    const result = await submitBookingRequestCore(adminClient, channelId, rawInput, fetchImpl);

    if (!result.success) {
      logger.warn("Submit booking request rejected", { code: result.code, error: result.error });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("submitBookingRequestServer failure", { error: message });
    return { success: false, error: "Server unavailable. Please try again.", code: "SERVER_ERROR" };
  }
}
