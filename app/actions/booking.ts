"use server";

import { type SupabaseClient } from "@supabase/supabase-js";
import {
  addPetToBooking,
  createBooking,
  markRoomClean,
  removePetFromBooking,
  setRoomMaintenance,
  updateBookingSchedule,
  updateBookingStatus,
  type ActionResult,
  type BookingActor,
  type BookingStatusTarget,
  type CreateBookingInput,
  type SetRoomMaintenanceInput,
  type UpdateBookingScheduleInput,
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
