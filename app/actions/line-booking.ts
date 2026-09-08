"use server";

import {
  getCustomerBookingContextServer,
  quoteCustomerBookingServer,
  submitBookingRequestServer,
  type CustomerBookingActionResult,
} from "@/lib/line-booking-server";
import type {
  BookingV2QuoteResult,
  CustomerBookingV2Context,
  SubmitBookingRequestV2Result,
} from "@/lib/line-booking-core";

export async function getCustomerBookingContextAction(
  shopId: string,
  idToken: string,
): Promise<CustomerBookingActionResult<CustomerBookingV2Context>> {
  return getCustomerBookingContextServer(shopId, idToken);
}

export async function quoteCustomerBookingAction(rawInput: unknown): Promise<BookingV2QuoteResult> {
  return quoteCustomerBookingServer(rawInput);
}

export async function submitBookingRequestAction(rawInput: unknown): Promise<SubmitBookingRequestV2Result> {
  return submitBookingRequestServer(rawInput);
}
