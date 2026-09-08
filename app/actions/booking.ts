"use server";

import { type SupabaseClient } from "@supabase/supabase-js";
import {
  addPetToBooking,
  createBooking,
  createBookingV2,
  quoteBookingV2,
  markRoomClean,
  removePetFromBooking,
  setRoomMaintenance,
  setRoomMaintenanceV2,
  updateBookingSchedule,
  updateBookingV2Schedule,
  updateBookingStatus,
  type ActionResult,
  type BookingActor,
  type BookingStatusTarget,
  type CreateBookingInput,
  type CreateBookingV2Input,
  type SetRoomMaintenanceInput,
  type SetRoomMaintenanceV2Input,
  type UpdateBookingScheduleInput,
  type UpdateBookingV2ScheduleInput,
} from "@/lib/booking-service";
import { logger } from "@/lib/logger";
import { requireTenantContext, type StaffContext } from "@/lib/tenant-context";

type TenantHandler<T> = (
  client: SupabaseClient,
  actor: BookingActor,
  staff: StaffContext,
) => Promise<ActionResult<T>>;

async function withTenant<T>(operation: string, handler: TenantHandler<T>): Promise<ActionResult<T>> {
  try {
    const { staff, client } = await requireTenantContext();
    const actor: BookingActor = {
      userId: staff.userId,
      shopId: staff.shopId,
      role: staff.role,
    };
    return await handler(client, actor, staff);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    logger.warn("Booking server action rejected before RPC", {
      operation,
      error: message,
    });
    return { success: false, error: message };
  }
}

export async function createBookingAction(
  input: CreateBookingInput,
): Promise<ActionResult<{ bookingId: string }>> {
  return withTenant("createBooking", (client, actor) => createBooking(client, actor, input));
}

export async function addPetToBookingAction(
  bookingId: string,
  petId: string,
): Promise<ActionResult> {
  return withTenant("addPetToBooking", (client, actor) =>
    addPetToBooking(client, actor, bookingId, petId),
  );
}

export async function removePetFromBookingAction(
  bookingId: string,
  petId: string,
): Promise<ActionResult> {
  return withTenant("removePetFromBooking", (client, actor) =>
    removePetFromBooking(client, actor, bookingId, petId),
  );
}

export async function updateBookingScheduleAction(
  input: UpdateBookingScheduleInput,
): Promise<ActionResult> {
  return withTenant("updateBookingSchedule", (client, actor) =>
    updateBookingSchedule(client, actor, input),
  );
}

export async function updateBookingStatusAction(
  bookingId: string,
  newStatus: BookingStatusTarget,
): Promise<ActionResult> {
  return withTenant("updateBookingStatus", (client, actor) =>
    updateBookingStatus(client, actor, bookingId, newStatus),
  );
}

export async function setRoomMaintenanceAction(
  input: SetRoomMaintenanceInput,
): Promise<ActionResult> {
  return withTenant("setRoomMaintenance", async (client, actor, staff) => {
    if (staff.role === "staff") {
      return {
        success: false,
        error: "Forbidden: Only owner or manager can set room maintenance.",
      };
    }
    return setRoomMaintenance(client, actor, input);
  });
}

export async function markRoomCleanAction(roomId: string): Promise<ActionResult> {
  return withTenant("markRoomClean", (client, actor) => markRoomClean(client, actor, roomId));
}

export async function confirmBookingRequestAction(
  requestId: string,
  assignedRoomId?: string,
): Promise<ActionResult<{ bookingId: string }>> {
  return withTenant("confirmBookingRequest", async (client) => {
    const { data, error } = await client.rpc("confirm_booking_request", {
      p_request_id: requestId,
      p_assigned_room_id: assignedRoomId || null,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: { bookingId: data as string } };
  });
}

export async function declineBookingRequestAction(
  requestId: string,
  reason?: string,
): Promise<ActionResult> {
  return withTenant("declineBookingRequest", async (client) => {
    const { error } = await client.rpc("decline_booking_request", {
      p_request_id: requestId,
      p_reason: reason?.trim() || null,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  });
}

export async function quoteBookingV2Action(input: CreateBookingV2Input) {
  return withTenant("quoteBookingV2", (client, actor) => quoteBookingV2(client, actor, input));
}

export async function createBookingV2Action(
  input: CreateBookingV2Input,
): Promise<ActionResult<{ bookingId: string }>> {
  return withTenant("createBookingV2", (client, actor) => createBookingV2(client, actor, input));
}

export async function updateBookingV2ScheduleAction(
  input: UpdateBookingV2ScheduleInput,
): Promise<ActionResult> {
  return withTenant("updateBookingV2Schedule", (client, actor) =>
    updateBookingV2Schedule(client, actor, input),
  );
}

export async function setRoomMaintenanceV2Action(
  input: SetRoomMaintenanceV2Input,
): Promise<ActionResult> {
  return withTenant("setRoomMaintenanceV2", async (client, actor, staff) => {
    if (staff.role === "staff") {
      return { success: false, error: "Forbidden: Only owner or manager can set room maintenance." };
    }
    return setRoomMaintenanceV2(client, actor, input);
  });
}
