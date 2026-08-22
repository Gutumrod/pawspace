const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface LineBookingRequestInput {
  shopId: string;
  roomId: string;
  petIds: string[];
  checkInDate: string;
  checkOutDate: string;
  specialRequests?: string | null;
  idToken: string;
}

export interface CustomerBookingShop {
  id: string;
  name: string;
  slug: string;
}

export interface CustomerBookingOwner {
  id: string;
  firstName: string;
  phone: string;
}

export interface CustomerBookingPet {
  id: string;
  name: string;
  species: "dog" | "cat";
  breed: string | null;
  weightKg: number | null;
}

export interface CustomerBookingRoom {
  id: string;
  roomNumber: string;
  roomType: string;
  capacityPets: number;
  basePricePerNight: number;
  status: string;
  maintenanceFrom: string | null;
  maintenanceUntil: string | null;
}

export interface OccupiedRange {
  roomId: string;
  checkIn: string;
  checkOut: string;
}

export interface CustomerBookingContext {
  shop: CustomerBookingShop;
  owner: CustomerBookingOwner;
  pets: CustomerBookingPet[];
  rooms: CustomerBookingRoom[];
  occupiedRanges: OccupiedRange[];
}

export function validateDateRange(
  checkInDate: string,
  checkOutDate: string,
): { valid: boolean; error?: string; nights: number } {
  if (!ISO_DATE_RE.test(checkInDate) || !ISO_DATE_RE.test(checkOutDate)) {
    return { valid: false, error: "Dates must use YYYY-MM-DD format.", nights: 0 };
  }

  const checkIn = new Date(`${checkInDate}T00:00:00Z`);
  const checkOut = new Date(`${checkOutDate}T00:00:00Z`);

  if (
    Number.isNaN(checkIn.valueOf()) ||
    Number.isNaN(checkOut.valueOf()) ||
    checkIn.toISOString().slice(0, 10) !== checkInDate ||
    checkOut.toISOString().slice(0, 10) !== checkOutDate
  ) {
    return { valid: false, error: "Dates must be valid calendar dates.", nights: 0 };
  }

  const diffMs = checkOut.getTime() - checkIn.getTime();
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (nights <= 0) {
    return { valid: false, error: "Check-out date must be strictly after check-in date.", nights: 0 };
  }

  return { valid: true, nights };
}

export function calculateEstimatedTotal(basePricePerNight: number, nights: number): number {
  if (!Number.isFinite(basePricePerNight) || basePricePerNight < 0 || !Number.isInteger(nights) || nights <= 0) {
    return 0;
  }
  return basePricePerNight * nights;
}

export function isRangeOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

export function isRoomAvailable(
  roomId: string,
  checkIn: string,
  checkOut: string,
  occupiedRanges: OccupiedRange[],
  maintenanceFrom: string | null = null,
  maintenanceUntil: string | null = null,
): boolean {
  if (maintenanceFrom && maintenanceUntil) {
    // Maintenance is inclusive []
    if (checkIn <= maintenanceUntil && checkOut > maintenanceFrom) {
      return false;
    }
  }

  for (const occ of occupiedRanges) {
    if (occ.roomId === roomId && isRangeOverlapping(checkIn, checkOut, occ.checkIn, occ.checkOut)) {
      return false;
    }
  }

  return true;
}

export function validateLineBookingInput(
  raw: unknown,
): { valid: boolean; error?: string; sanitized?: LineBookingRequestInput } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Invalid payload: object expected." };
  }

  const input = raw as Partial<LineBookingRequestInput>;

  if (!input.shopId || !UUID_RE.test(input.shopId.trim())) {
    return { valid: false, error: "Invalid shop ID." };
  }

  if (!input.roomId || !UUID_RE.test(input.roomId.trim())) {
    return { valid: false, error: "Invalid room ID." };
  }

  if (!Array.isArray(input.petIds) || input.petIds.length === 0) {
    return { valid: false, error: "At least one pet must be selected." };
  }

  for (const petId of input.petIds) {
    if (typeof petId !== "string" || !UUID_RE.test(petId.trim())) {
      return { valid: false, error: "Invalid pet ID in list." };
    }
  }

  if (!input.idToken || typeof input.idToken !== "string" || !input.idToken.trim()) {
    return { valid: false, error: "LINE ID token is required." };
  }

  const dateCheck = validateDateRange(input.checkInDate || "", input.checkOutDate || "");
  if (!dateCheck.valid) {
    return { valid: false, error: dateCheck.error };
  }

  return {
    valid: true,
    sanitized: {
      shopId: input.shopId.trim(),
      roomId: input.roomId.trim(),
      petIds: input.petIds.map((id) => id.trim()),
      checkInDate: input.checkInDate!.trim(),
      checkOutDate: input.checkOutDate!.trim(),
      specialRequests: typeof input.specialRequests === "string" ? input.specialRequests.trim() || null : null,
      idToken: input.idToken.trim(),
    },
  };
}

export type CustomerBookingCoreResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      code?: "INVALID_INPUT" | "LINE_IDENTITY_INVALID" | "LINE_UNAVAILABLE" | "NOT_LINKED" | "SERVER_ERROR";
    };

export type SubmitBookingRequestResult =
  | { success: true; requestId: string }
  | {
      success: false;
      error: string;
      code?: "INVALID_INPUT" | "LINE_IDENTITY_INVALID" | "LINE_UNAVAILABLE" | "NOT_LINKED" | "SERVER_ERROR";
    };

export async function getCustomerBookingContextCore(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  channelId: string,
  shopId: string,
  idToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CustomerBookingCoreResult<CustomerBookingContext>> {
  if (!shopId?.trim() || !idToken?.trim()) {
    return { success: false, error: "Missing required shop ID or LINE ID token.", code: "INVALID_INPUT" };
  }

  const { verifyLineIdToken } = await import("./line-id-token");
  const verified = await verifyLineIdToken(idToken, channelId, fetchImpl);
  if (!verified.success) {
    return {
      success: false,
      error: "LINE identity verification failed.",
      code: verified.code === "LINE_UNAVAILABLE" ? "LINE_UNAVAILABLE" : "LINE_IDENTITY_INVALID",
    };
  }

  const { data, error } = await adminClient.rpc("get_customer_booking_context_internal", {
    p_verified_line_user_id: verified.identity.userId,
    p_shop_id: shopId.trim(),
  });

  if (error) {
    return {
      success: false,
      error: error.message || "Failed to retrieve booking context.",
      code: error.message.includes("not linked") ? "NOT_LINKED" : "SERVER_ERROR",
    };
  }

  return { success: true, data: data as CustomerBookingContext };
}

export async function submitBookingRequestCore(
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  channelId: string,
  rawInput: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitBookingRequestResult> {
  const validation = validateLineBookingInput(rawInput);
  if (!validation.valid || !validation.sanitized) {
    return { success: false, error: validation.error || "Invalid booking payload.", code: "INVALID_INPUT" };
  }

  const input: LineBookingRequestInput = validation.sanitized;
  const { verifyLineIdToken } = await import("./line-id-token");
  const verified = await verifyLineIdToken(input.idToken, channelId, fetchImpl);
  if (!verified.success) {
    return {
      success: false,
      error: "LINE identity verification failed.",
      code: verified.code === "LINE_UNAVAILABLE" ? "LINE_UNAVAILABLE" : "LINE_IDENTITY_INVALID",
    };
  }

  const { data, error } = await adminClient.rpc("submit_booking_request_internal", {
    p_verified_line_user_id: verified.identity.userId,
    p_shop_id: input.shopId,
    p_room_id: input.roomId,
    p_pet_ids: input.petIds,
    p_check_in_date: input.checkInDate,
    p_check_out_date: input.checkOutDate,
    p_special_requests: input.specialRequests || null,
  });

  if (error) {
    return {
      success: false,
      error: error.message || "Failed to submit booking request.",
      code: error.message.includes("not linked") ? "NOT_LINKED" : "SERVER_ERROR",
    };
  }

  return { success: true, requestId: data as string };
}


