import { type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";

export type BookingStatusTarget = "checked_in" | "checked_out" | "cancelled";
export type StaffRole = "owner" | "manager" | "staff";

export interface BookingActor {
  userId: string;
  shopId: string;
  role: StaffRole;
}

export interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateBookingInput {
  ownerId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount?: number;
  specialRequests?: string | null;
}

export interface UpdateBookingScheduleInput {
  bookingId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount?: number | null;
  specialRequests?: string | null;
}

export interface SetRoomMaintenanceInput {
  roomId: string;
  from: string | null;
  until: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  return error instanceof Error && error.message ? error.message : "Unexpected booking backend error.";
}

function validateUuid(value: string, field: string): string | null {
  if (!UUID_RE.test(value)) return `${field} must be a valid UUID.`;
  return null;
}

function validateDate(value: string, field: string): string | null {
  if (!ISO_DATE_RE.test(value)) return `${field} must use YYYY-MM-DD format.`;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    return `${field} must be a valid calendar date.`;
  }
  return null;
}

function validateAmount(value: number | null | undefined, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return `${field} must be a finite number >= 0.`;
  return null;
}

async function rpc<T>(
  client: SupabaseClient,
  actor: BookingActor,
  name: string,
  args: Record<string, unknown>,
): Promise<ActionResult<T>> {
  try {
    const { data, error } = await client.rpc(name, args);
    if (error) {
      logger.warn("Booking backend RPC rejected", {
        rpc: name,
        userId: actor.userId,
        shopId: actor.shopId,
        role: actor.role,
        error: error.message,
      });
      return { success: false, error: error.message || `RPC ${name} failed.` };
    }
    return { success: true, data: data as T };
  } catch (error) {
    const message = normalizeError(error);
    logger.error("Unexpected booking backend RPC failure", {
      rpc: name,
      userId: actor.userId,
      shopId: actor.shopId,
      role: actor.role,
      error: message,
    });
    return { success: false, error: message };
  }
}

export async function createBooking(
  client: SupabaseClient,
  actor: BookingActor,
  input: CreateBookingInput,
): Promise<ActionResult<{ bookingId: string }>> {
  const validation =
    validateUuid(input.ownerId, "ownerId") ||
    validateUuid(input.roomId, "roomId") ||
    validateDate(input.checkInDate, "checkInDate") ||
    validateDate(input.checkOutDate, "checkOutDate") ||
    validateAmount(input.totalAmount, "totalAmount");
  if (validation) return { success: false, error: validation };

  const result = await rpc<string>(client, actor, "create_booking", {
    p_owner_id: input.ownerId,
    p_room_id: input.roomId,
    p_check_in_date: input.checkInDate,
    p_check_out_date: input.checkOutDate,
    p_total_amount: input.totalAmount ?? 0,
    p_special_requests: input.specialRequests?.trim() || null,
  });
  if (!result.success || !result.data) {
    return { success: false, error: result.error || "Booking creation failed." };
  }
  return { success: true, data: { bookingId: result.data } };
}

export async function addPetToBooking(
  client: SupabaseClient,
  actor: BookingActor,
  bookingId: string,
  petId: string,
): Promise<ActionResult> {
  const validation = validateUuid(bookingId, "bookingId") || validateUuid(petId, "petId");
  if (validation) return { success: false, error: validation };
  return rpc<undefined>(client, actor, "add_pet_to_booking", {
    p_booking_id: bookingId,
    p_pet_id: petId,
  });
}

export async function removePetFromBooking(
  client: SupabaseClient,
  actor: BookingActor,
  bookingId: string,
  petId: string,
): Promise<ActionResult> {
  const validation = validateUuid(bookingId, "bookingId") || validateUuid(petId, "petId");
  if (validation) return { success: false, error: validation };
  return rpc<undefined>(client, actor, "remove_pet_from_booking", {
    p_booking_id: bookingId,
    p_pet_id: petId,
  });
}

export async function updateBookingSchedule(
  client: SupabaseClient,
  actor: BookingActor,
  input: UpdateBookingScheduleInput,
): Promise<ActionResult> {
  const validation =
    validateUuid(input.bookingId, "bookingId") ||
    validateUuid(input.roomId, "roomId") ||
    validateDate(input.checkInDate, "checkInDate") ||
    validateDate(input.checkOutDate, "checkOutDate") ||
    validateAmount(input.totalAmount, "totalAmount");
  if (validation) return { success: false, error: validation };

  return rpc<undefined>(client, actor, "update_booking_schedule", {
    p_booking_id: input.bookingId,
    p_new_room_id: input.roomId,
    p_new_check_in: input.checkInDate,
    p_new_check_out: input.checkOutDate,
    p_special_requests: input.specialRequests?.trim() || null,
    p_total_amount: input.totalAmount ?? null,
  });
}

export async function updateBookingStatus(
  client: SupabaseClient,
  actor: BookingActor,
  bookingId: string,
  newStatus: BookingStatusTarget,
): Promise<ActionResult> {
  const validation = validateUuid(bookingId, "bookingId");
  if (validation) return { success: false, error: validation };
  if (!(["checked_in", "checked_out", "cancelled"] as const).includes(newStatus)) {
    return { success: false, error: "newStatus is not an allowed booking transition target." };
  }

  return rpc<undefined>(client, actor, "update_booking_status", {
    p_booking_id: bookingId,
    p_new_status: newStatus,
  });
}

export async function setRoomMaintenance(
  client: SupabaseClient,
  actor: BookingActor,
  input: SetRoomMaintenanceInput,
): Promise<ActionResult> {
  const validation =
    validateUuid(input.roomId, "roomId") ||
    (input.from ? validateDate(input.from, "from") : null) ||
    (input.until ? validateDate(input.until, "until") : null);
  if (validation) return { success: false, error: validation };

  if ((input.from === null) !== (input.until === null)) {
    return { success: false, error: "from and until must both be null or both be provided." };
  }

  return rpc<undefined>(client, actor, "set_room_maintenance", {
    p_room_id: input.roomId,
    p_from: input.from,
    p_until: input.until,
  });
}

export async function markRoomClean(
  client: SupabaseClient,
  actor: BookingActor,
  roomId: string,
): Promise<ActionResult> {
  const validation = validateUuid(roomId, "roomId");
  if (validation) return { success: false, error: validation };
  return rpc<undefined>(client, actor, "mark_room_clean", { p_room_id: roomId });
}

export interface BookingV2Quote {
  pricingMode: "FIXED_PACKAGE";
  unit: "HOUR" | "DAY" | "MONTH";
  quantity: number;
  price: number;
  startAt: string;
  endAt: string;
  ratePlanId: string;
  roomId: string;
}

export interface CreateBookingV2Input {
  ownerId: string;
  roomId: string;
  ratePlanId: string;
  petIds: string[];
  startAt: string;
  specialRequests?: string | null;
}

export interface UpdateBookingV2ScheduleInput {
  bookingId: string;
  roomId: string;
  ratePlanId: string;
  startAt: string;
  specialRequests?: string | null;
}

export interface SetRoomMaintenanceV2Input {
  roomId: string;
  startAt: string | null;
  endAt: string | null;
}

function validateIsoTimestamp(value: string, field: string): string | null {
  if (!value || !/([zZ]|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    return `${field} must be a valid ISO timestamp with timezone.`;
  }
  return null;
}

function validatePetIds(petIds: string[]): string | null {
  if (!Array.isArray(petIds) || petIds.length < 1) return "At least one pet must be selected.";
  if (petIds.some((id) => !UUID_RE.test(id))) return "petIds contains an invalid UUID.";
  if (new Set(petIds).size !== petIds.length) return "petIds cannot contain duplicates.";
  return null;
}

function validateBookingV2Input(input: CreateBookingV2Input): string | null {
  return validateUuid(input.ownerId, "ownerId") ||
    validateUuid(input.roomId, "roomId") ||
    validateUuid(input.ratePlanId, "ratePlanId") ||
    validatePetIds(input.petIds) ||
    validateIsoTimestamp(input.startAt, "startAt");
}

export async function quoteBookingV2(
  client: SupabaseClient,
  actor: BookingActor,
  input: CreateBookingV2Input,
): Promise<ActionResult<BookingV2Quote>> {
  const validation = validateBookingV2Input(input);
  if (validation) return { success: false, error: validation };
  return rpc<BookingV2Quote>(client, actor, "quote_booking_v2", {
    p_owner_id: input.ownerId,
    p_room_id: input.roomId,
    p_rate_plan_id: input.ratePlanId,
    p_pet_ids: input.petIds,
    p_start_at: new Date(input.startAt).toISOString(),
  });
}

export async function createBookingV2(
  client: SupabaseClient,
  actor: BookingActor,
  input: CreateBookingV2Input,
): Promise<ActionResult<{ bookingId: string }>> {
  const validation = validateBookingV2Input(input);
  if (validation) return { success: false, error: validation };

  const result = await rpc<string>(client, actor, "create_booking_v2", {
    p_owner_id: input.ownerId,
    p_room_id: input.roomId,
    p_rate_plan_id: input.ratePlanId,
    p_pet_ids: input.petIds,
    p_start_at: new Date(input.startAt).toISOString(),
    p_special_requests: input.specialRequests?.trim() || null,
  });
  if (!result.success || !result.data) {
    return { success: false, error: result.error || "Booking V2 creation failed." };
  }
  return { success: true, data: { bookingId: result.data } };
}

export async function updateBookingV2Schedule(
  client: SupabaseClient,
  actor: BookingActor,
  input: UpdateBookingV2ScheduleInput,
): Promise<ActionResult> {
  const validation = validateUuid(input.bookingId, "bookingId") ||
    validateUuid(input.roomId, "roomId") ||
    validateUuid(input.ratePlanId, "ratePlanId") ||
    validateIsoTimestamp(input.startAt, "startAt");
  if (validation) return { success: false, error: validation };

  return rpc<undefined>(client, actor, "update_booking_v2_schedule", {
    p_booking_id: input.bookingId,
    p_room_id: input.roomId,
    p_rate_plan_id: input.ratePlanId,
    p_start_at: new Date(input.startAt).toISOString(),
    p_special_requests: input.specialRequests?.trim() || null,
  });
}

export async function setRoomMaintenanceV2(
  client: SupabaseClient,
  actor: BookingActor,
  input: SetRoomMaintenanceV2Input,
): Promise<ActionResult> {
  const validation = validateUuid(input.roomId, "roomId") ||
    (input.startAt ? validateIsoTimestamp(input.startAt, "startAt") : null) ||
    (input.endAt ? validateIsoTimestamp(input.endAt, "endAt") : null);
  if (validation) return { success: false, error: validation };
  if ((input.startAt === null) !== (input.endAt === null)) {
    return { success: false, error: "startAt and endAt must both be null or both be provided." };
  }
  if (input.startAt && input.endAt && Date.parse(input.endAt) <= Date.parse(input.startAt)) {
    return { success: false, error: "endAt must be after startAt." };
  }

  return rpc<undefined>(client, actor, "set_room_maintenance_v2", {
    p_room_id: input.roomId,
    p_start_at: input.startAt ? new Date(input.startAt).toISOString() : null,
    p_end_at: input.endAt ? new Date(input.endAt).toISOString() : null,
  });
}
