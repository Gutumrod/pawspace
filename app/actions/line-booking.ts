"use server";

import {
  getCustomerBookingContextServer,
  submitBookingRequestServer,
  type CustomerBookingActionResult,
} from "@/lib/line-booking-server";
import { type CustomerBookingContext, type SubmitBookingRequestResult } from "@/lib/line-booking-core";

export async function getCustomerBookingContextAction(
  shopId: string,
  idToken: string,
): Promise<CustomerBookingActionResult<CustomerBookingContext>> {
  return getCustomerBookingContextServer(shopId, idToken);
}

export async function submitBookingRequestAction(
  rawInput: unknown,
): Promise<SubmitBookingRequestResult> {
  return submitBookingRequestServer(rawInput);
}
