import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireTenantContext, type StaffContext } from "@/lib/tenant-context";
import { logger } from "@/lib/logger";

export type RoomStatus = "available" | "occupied" | "cleaning" | "maintenance";
export type BookingStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled";
export type RoomType = "standard" | "deluxe" | "vip" | "cat_condo";

export interface OperationsDTO {
  staff: Pick<StaffContext, "userId" | "shopId" | "name" | "email" | "role" | "shopName" | "shopSlug">;
  businessDate: string;
  shop: { name: string; slug: string; googleSheetsConnected: boolean; lineConfigured: boolean };
  rooms: Array<{ id: string; number: string; type: RoomType; capacity: number; price: number; status: RoomStatus; maintenanceFrom: string | null; maintenanceUntil: string | null }>;
  owners: Array<{ id: string; firstName: string; lastName: string | null; phone: string; emergencyPhone: string | null; address: string | null; lineLinked: boolean }>;
  pets: Array<{ id: string; ownerId: string; name: string; species: "dog" | "cat"; breed: string | null; gender: string | null; birthDate: string | null; weightKg: number | null; specialCareNotes: string | null; allergies: string | null }>;
  bookings: Array<{ id: string; ownerId: string; roomId: string; checkInDate: string; checkOutDate: string; status: BookingStatus; totalAmount: number; specialRequests: string | null; petIds: string[] }>;
  reports: Array<{ id: string; bookingId: string; petId: string; reportDate: string; foodStatus: string; excretionStatus: string; moodStatus: string; staffNotes: string | null; deliveryStatus: "pending" | "sending" | "sent" | "failed"; retryCount: number; createdAt: string }>;
  staffMembers: Array<{ id: string; email: string; name: string; role: "owner" | "manager" | "staff"; isActive: boolean }>;
}
function assertNoError(label: string, error: { message?: string } | null) {
  if (error) throw new Error(`${label}: ${error.message || "database request failed"}`);
}

function toNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Invalid numeric value from database.");
  return n;
}

export async function getOperationsSnapshot(): Promise<OperationsDTO> {
  const { staff, client } = await requireTenantContext();
  const businessDateResult = await client.rpc("pawspace_business_date");
  assertNoError("Business date", businessDateResult.error);
  if (typeof businessDateResult.data !== "string") throw new Error("Invalid business date response.");

  const [shopResult, roomsResult, ownersResult, petsResult, bookingsResult, bookingPetsResult, reportsResult] = await Promise.all([
    client.from("shops").select("name,slug,google_sheet_id,line_oa_id").eq("id", staff.shopId).single(),
    client.from("rooms").select("id,room_number,room_type,capacity_pets,base_price_per_night,status,maintenance_from,maintenance_until").order("room_number"),
    client.from("pet_owners").select("id,first_name,last_name,phone,emergency_phone,address,line_user_id").order("first_name"),
    client.from("pets").select("id,owner_id,name,species,breed,gender,birth_date,weight_kg,special_care_notes,allergies").order("name"),
    client.from("bookings").select("id,owner_id,room_id,check_in_date,check_out_date,booking_status,total_amount,special_requests").order("check_in_date", { ascending: false }).limit(200),
    client.from("booking_pets").select("booking_id,pet_id"),
    client.from("daily_reports").select("id,booking_id,pet_id,report_date,food_status,excretion_status,mood_status,staff_notes,line_delivery_status,line_retry_count,created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  [shopResult, roomsResult, ownersResult, petsResult, bookingsResult, bookingPetsResult, reportsResult].forEach((result, index) => assertNoError(`Operations read ${index + 1}`, result.error));
  if (!shopResult.data) throw new Error("Current shop is unavailable.");
  let staffRows: OperationsDTO["staffMembers"] = [];
  if (staff.role === "owner") {
    const staffResult = await client.from("staff_users").select("id,email,name,role,is_active").order("created_at");
    assertNoError("Staff read", staffResult.error);
    staffRows = (staffResult.data ?? []).map((row) => ({
      id: String(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as "owner" | "manager" | "staff",
      isActive: Boolean(row.is_active),
    }));
  }

  const petIdsByBooking = new Map<string, string[]>();
  for (const row of bookingPetsResult.data ?? []) {
    const bookingId = String(row.booking_id);
    const current = petIdsByBooking.get(bookingId) ?? [];
    current.push(String(row.pet_id));
    petIdsByBooking.set(bookingId, current);
  }

  return {
    staff: { userId: staff.userId, shopId: staff.shopId, name: staff.name, email: staff.email, role: staff.role, shopName: staff.shopName, shopSlug: staff.shopSlug },
    businessDate: businessDateResult.data,
    shop: { name: String(shopResult.data.name), slug: String(shopResult.data.slug), googleSheetsConnected: Boolean(shopResult.data.google_sheet_id), lineConfigured: Boolean(shopResult.data.line_oa_id) },
    rooms: (roomsResult.data ?? []).map((row) => ({
      id: String(row.id), number: String(row.room_number), type: row.room_type as RoomType,
      capacity: toNumber(row.capacity_pets), price: toNumber(row.base_price_per_night), status: row.status as RoomStatus,
      maintenanceFrom: row.maintenance_from ? String(row.maintenance_from) : null,
      maintenanceUntil: row.maintenance_until ? String(row.maintenance_until) : null,
    })),
    owners: (ownersResult.data ?? []).map((row) => ({
      id: String(row.id), firstName: String(row.first_name), lastName: row.last_name ? String(row.last_name) : null,
      phone: String(row.phone), emergencyPhone: row.emergency_phone ? String(row.emergency_phone) : null,
      address: row.address ? String(row.address) : null, lineLinked: Boolean(row.line_user_id),
    })),
    pets: (petsResult.data ?? []).map((row) => ({
      id: String(row.id), ownerId: String(row.owner_id), name: String(row.name), species: row.species as "dog" | "cat",
      breed: row.breed ? String(row.breed) : null, gender: row.gender ? String(row.gender) : null,
      birthDate: row.birth_date ? String(row.birth_date) : null, weightKg: row.weight_kg === null ? null : toNumber(row.weight_kg),
      specialCareNotes: row.special_care_notes ? String(row.special_care_notes) : null,
      allergies: row.allergies ? String(row.allergies) : null,
    })),
    bookings: (bookingsResult.data ?? []).map((row) => ({
      id: String(row.id), ownerId: String(row.owner_id), roomId: String(row.room_id), checkInDate: String(row.check_in_date),
      checkOutDate: String(row.check_out_date), status: row.booking_status as BookingStatus, totalAmount: toNumber(row.total_amount),
      specialRequests: row.special_requests ? String(row.special_requests) : null, petIds: petIdsByBooking.get(String(row.id)) ?? [],
    })),
    reports: (reportsResult.data ?? []).map((row) => ({
      id: String(row.id), bookingId: String(row.booking_id), petId: String(row.pet_id), reportDate: String(row.report_date),
      foodStatus: String(row.food_status), excretionStatus: String(row.excretion_status), moodStatus: String(row.mood_status),
      staffNotes: row.staff_notes ? String(row.staff_notes) : null,
      deliveryStatus: row.line_delivery_status as "pending" | "sending" | "sent" | "failed",
      retryCount: toNumber(row.line_retry_count), createdAt: String(row.created_at),
    })),
    staffMembers: staffRows,
  };
}

export type MutationResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function rpcMutation<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<MutationResult<T>> {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    logger.warn("Operations RPC rejected", { rpc: name, error: error.message });
    return { success: false, error: error.message };
  }
  return { success: true, data: data as T };
}

function requiredText(value: string | null | undefined, field: string): string | null {
  if (!value?.trim()) return `${field} is required.`;
  if (value.trim().length > 255) return `${field} is too long.`;
  return null;
}
export async function createRoom(client: SupabaseClient, input: { roomNumber: string; roomType: RoomType; capacityPets: number; basePricePerNight: number }): Promise<MutationResult<{ roomId: string }>> {
  const validation = requiredText(input.roomNumber, "roomNumber");
  if (validation) return { success: false, error: validation };
  if (!["standard", "deluxe", "vip", "cat_condo"].includes(input.roomType)) return { success: false, error: "Invalid room type." };
  if (!Number.isInteger(input.capacityPets) || input.capacityPets < 1) return { success: false, error: "Capacity must be an integer >= 1." };
  if (!Number.isFinite(input.basePricePerNight) || input.basePricePerNight < 0) return { success: false, error: "Price must be >= 0." };
  const result = await rpcMutation<string>(client, "create_room", {
    p_room_number: input.roomNumber.trim(), p_room_type: input.roomType,
    p_capacity_pets: input.capacityPets, p_base_price_per_night: input.basePricePerNight,
  });
  return result.success && result.data ? { success: true, data: { roomId: result.data } } : { success: false, error: result.success ? "Missing room id." : result.error };
}

export async function updateRoom(client: SupabaseClient, input: { roomId: string; roomNumber: string; roomType: RoomType; capacityPets: number; basePricePerNight: number }): Promise<MutationResult> {
  if (!UUID_RE.test(input.roomId)) return { success: false, error: "Invalid room id." };
  const validation = requiredText(input.roomNumber, "roomNumber");
  if (validation) return { success: false, error: validation };
  if (!["standard", "deluxe", "vip", "cat_condo"].includes(input.roomType)) return { success: false, error: "Invalid room type." };
  if (!Number.isInteger(input.capacityPets) || input.capacityPets < 1 || !Number.isFinite(input.basePricePerNight) || input.basePricePerNight < 0) return { success: false, error: "Invalid room capacity or price." };
  return rpcMutation(client, "update_room_config", { p_room_id: input.roomId, p_room_number: input.roomNumber.trim(), p_room_type: input.roomType, p_capacity_pets: input.capacityPets, p_base_price_per_night: input.basePricePerNight });
}
export async function createOwner(client: SupabaseClient, input: { firstName: string; lastName?: string | null; phone: string; emergencyPhone?: string | null; address?: string | null }): Promise<MutationResult<{ ownerId: string }>> {
  const validation = requiredText(input.firstName, "firstName") || requiredText(input.phone, "phone");
  if (validation) return { success: false, error: validation };
  const result = await rpcMutation<string>(client, "create_pet_owner", {
    p_first_name: input.firstName.trim(), p_last_name: input.lastName?.trim() || null,
    p_phone: input.phone.trim(), p_emergency_phone: input.emergencyPhone?.trim() || null,
    p_address: input.address?.trim() || null,
  });
  return result.success && result.data ? { success: true, data: { ownerId: result.data } } : { success: false, error: result.success ? "Missing owner id." : result.error };
}

export async function updateOwner(client: SupabaseClient, input: { ownerId: string; firstName: string; lastName?: string | null; phone: string; emergencyPhone?: string | null; address?: string | null }): Promise<MutationResult> {
  if (!UUID_RE.test(input.ownerId)) return { success: false, error: "Invalid owner id." };
  const validation = requiredText(input.firstName, "firstName") || requiredText(input.phone, "phone");
  if (validation) return { success: false, error: validation };
  return rpcMutation(client, "update_pet_owner_profile", {
    p_owner_id: input.ownerId, p_first_name: input.firstName.trim(), p_last_name: input.lastName?.trim() || null,
    p_phone: input.phone.trim(), p_emergency_phone: input.emergencyPhone?.trim() || null, p_address: input.address?.trim() || null,
  });
}

export type PetInput = { ownerId: string; name: string; species: "dog" | "cat"; breed?: string | null; gender?: string | null; birthDate?: string | null; weightKg?: number | null; specialCareNotes?: string | null; allergies?: string | null };
function validatePet(input: PetInput): string | null {
  if (!UUID_RE.test(input.ownerId)) return "Invalid owner id.";
  if (requiredText(input.name, "pet name")) return "Pet name is required.";
  if (input.species !== "dog" && input.species !== "cat") return "Invalid species.";
  if (input.weightKg !== null && input.weightKg !== undefined && (!Number.isFinite(input.weightKg) || input.weightKg < 0)) return "Invalid weight.";
  return null;
}
export async function createPet(client: SupabaseClient, input: PetInput): Promise<MutationResult<{ petId: string }>> {
  const validation = validatePet(input);
  if (validation) return { success: false, error: validation };
  const result = await rpcMutation<string>(client, "create_pet", {
    p_owner_id: input.ownerId, p_name: input.name.trim(), p_species: input.species,
    p_breed: input.breed?.trim() || null, p_gender: input.gender || null,
    p_birth_date: input.birthDate || null, p_weight_kg: input.weightKg ?? null,
    p_avatar_url: null, p_special_care_notes: input.specialCareNotes?.trim() || null,
    p_allergies: input.allergies?.trim() || null,
  });
  return result.success && result.data ? { success: true, data: { petId: result.data } } : { success: false, error: result.success ? "Missing pet id." : result.error };
}

export async function updatePet(client: SupabaseClient, petId: string, input: PetInput): Promise<MutationResult> {
  if (!UUID_RE.test(petId)) return { success: false, error: "Invalid pet id." };
  const validation = validatePet(input);
  if (validation) return { success: false, error: validation };
  return rpcMutation(client, "update_pet_profile", {
    p_pet_id: petId, p_name: input.name.trim(), p_species: input.species,
    p_breed: input.breed?.trim() || null, p_gender: input.gender || null,
    p_birth_date: input.birthDate || null, p_weight_kg: input.weightKg ?? null,
    p_avatar_url: null, p_special_care_notes: input.specialCareNotes?.trim() || null,
    p_allergies: input.allergies?.trim() || null,
  });
}
