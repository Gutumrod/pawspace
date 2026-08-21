import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingSheetRecord, PetCustomerRecord } from "./google-sheet-records";

function fail(scope: string, message?: string): never {
  throw new Error(`${scope}:${message || "database query failed"}`);
}

export async function readPetCustomerRecord(
  admin: SupabaseClient,
  shopId: string,
  petId: string,
): Promise<PetCustomerRecord | null> {
  const { data: pet, error: petError } = await admin.from("pets")
    .select("id,owner_id,name,species,breed,gender,birth_date,weight_kg,avatar_url,special_care_notes,allergies,created_at")
    .eq("shop_id", shopId).eq("id", petId).maybeSingle();
  if (petError) fail("PET_READ_FAILED", petError.message);
  if (!pet) return null;

  const { data: owner, error: ownerError } = await admin.from("pet_owners")
    .select("id,first_name,last_name,phone,emergency_phone,address")
    .eq("shop_id", shopId).eq("id", pet.owner_id).maybeSingle();
  if (ownerError) fail("OWNER_READ_FAILED", ownerError.message);
  if (!owner) fail("OWNER_READ_FAILED", "owner missing for pet");

  return {
    petId: pet.id, petName: pet.name, species: pet.species, breed: pet.breed, gender: pet.gender,
    birthDate: pet.birth_date, weightKg: pet.weight_kg === null ? null : Number(pet.weight_kg),
    avatarUrl: pet.avatar_url, specialCareNotes: pet.special_care_notes, allergies: pet.allergies,
    ownerId: owner.id, ownerFirstName: owner.first_name, ownerLastName: owner.last_name,
    ownerPhone: owner.phone, ownerEmergencyPhone: owner.emergency_phone, ownerAddress: owner.address,
    createdAt: pet.created_at,
  };
}

export async function readBookingRecord(
  admin: SupabaseClient,
  shopId: string,
  bookingId: string,
): Promise<BookingSheetRecord | null> {
  const { data: booking, error: bookingError } = await admin.from("bookings")
    .select("id,owner_id,room_id,check_in_date,check_out_date,booking_status,total_amount,special_requests,created_at")
    .eq("shop_id", shopId).eq("id", bookingId).maybeSingle();
  if (bookingError) fail("BOOKING_READ_FAILED", bookingError.message);
  if (!booking) return null;

  const [ownerResult, roomResult, petsResult] = await Promise.all([
    admin.from("pet_owners").select("id,first_name,last_name").eq("shop_id", shopId).eq("id", booking.owner_id).maybeSingle(),
    admin.from("rooms").select("id,room_number,room_type").eq("shop_id", shopId).eq("id", booking.room_id).maybeSingle(),
    admin.from("booking_pets").select("pet_id").eq("shop_id", shopId).eq("booking_id", bookingId).order("pet_id"),
  ]);
  if (ownerResult.error) fail("BOOKING_OWNER_READ_FAILED", ownerResult.error.message);
  if (roomResult.error) fail("BOOKING_ROOM_READ_FAILED", roomResult.error.message);
  if (petsResult.error) fail("BOOKING_PETS_READ_FAILED", petsResult.error.message);
  if (!ownerResult.data || !roomResult.data) fail("BOOKING_READ_FAILED", "related owner/room missing");

  const petIds = (petsResult.data ?? []).map((row) => row.pet_id as string);
  let petNames: string[] = [];
  if (petIds.length > 0) {
    const { data: pets, error: petNamesError } = await admin.from("pets")
      .select("id,name").eq("shop_id", shopId).in("id", petIds);
    if (petNamesError) fail("BOOKING_PET_NAMES_READ_FAILED", petNamesError.message);
    const byId = new Map((pets ?? []).map((pet) => [pet.id as string, pet.name as string]));
    petNames = petIds.map((id) => byId.get(id) ?? "");
  }

  const owner = ownerResult.data;
  const room = roomResult.data;
  return {
    bookingId: booking.id,
    ownerId: owner.id,
    ownerName: [owner.first_name, owner.last_name].filter(Boolean).join(" "),
    roomId: room.id,
    roomNumber: room.room_number,
    roomType: room.room_type,
    checkInDate: booking.check_in_date,
    checkOutDate: booking.check_out_date,
    bookingStatus: booking.booking_status,
    totalAmount: Number(booking.total_amount),
    specialRequests: booking.special_requests,
    petIds,
    petNames,
    createdAt: booking.created_at,
  };
}

