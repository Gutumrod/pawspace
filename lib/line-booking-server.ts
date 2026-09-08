import "server-only";

import { getPs01RuntimeDatabaseClient } from "./ps01-runtime-db";
import { requireLineLoginEnv } from "./env";
import {
  getCustomerBookingV2ContextCore,
  quoteCustomerBookingV2Core,
  submitBookingRequestV2Core,
  type BookingV2QuoteResult,
  type CustomerBookingCoreResult,
  type CustomerBookingV2Context,
  type SubmitBookingRequestV2Result,
} from "./line-booking-core";
import { logger } from "./logger";

export type CustomerBookingActionResult<T> = CustomerBookingCoreResult<T>;

export async function getCustomerBookingContextServer(
  shopId: string,
  idToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CustomerBookingActionResult<CustomerBookingV2Context>> {
  try {
    const { channelId } = requireLineLoginEnv();
    const runtimeClient = getPs01RuntimeDatabaseClient();
    const result = await getCustomerBookingV2ContextCore(runtimeClient, channelId, shopId, idToken, fetchImpl);

    if (!result.success) {
      logger.warn("Customer Booking V2 context rejected", { shopId, code: result.code, error: result.error });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("getCustomerBookingContextServer failure", { error: message, shopId });
    return { success: false, error: "Server unavailable. Please try again.", code: "SERVER_ERROR" };
  }
}

export async function quoteCustomerBookingServer(
  rawInput: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<BookingV2QuoteResult> {
  try {
    const { channelId } = requireLineLoginEnv();
    const runtimeClient = getPs01RuntimeDatabaseClient();
    const result = await quoteCustomerBookingV2Core(runtimeClient, channelId, rawInput, fetchImpl);
    if (!result.success) {
      logger.warn("Customer Booking V2 quote rejected", { code: result.code, error: result.error });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("quoteCustomerBookingServer failure", { error: message });
    return { success: false, error: "Server unavailable. Please try again.", code: "SERVER_ERROR" };
  }
}

export async function submitBookingRequestServer(
  rawInput: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitBookingRequestV2Result> {
  try {
    const { channelId } = requireLineLoginEnv();
    const runtimeClient = getPs01RuntimeDatabaseClient();
    const result = await submitBookingRequestV2Core(runtimeClient, channelId, rawInput, fetchImpl);
    if (!result.success) {
      logger.warn("Submit Booking V2 request rejected", { code: result.code, error: result.error });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("submitBookingRequestServer failure", { error: message });
    return { success: false, error: "Server unavailable. Please try again.", code: "SERVER_ERROR" };
  }
}
