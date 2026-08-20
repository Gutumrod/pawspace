import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  addPetToBooking,
  createBooking,
  markRoomClean,
  removePetFromBooking,
  setRoomMaintenance,
  updateBookingSchedule,
  updateBookingStatus,
  type BookingActor,
} from "../lib/booking-service";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

function authedClient(token: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function createUser(email: string): Promise<TestUser> {
  const password = "TestPassword123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: session, error: loginError } = await anon.auth.signInWithPassword({ email, password });
  if (loginError || !session.session) throw new Error(`login failed: ${loginError?.message}`);
  return { id: data.user.id, email, client: authedClient(session.session.access_token) };
}

function actor(user: TestUser, shopId: string, role: BookingActor["role"]): BookingActor {
  return { userId: user.id, shopId, role };
}

let passed = 0;
let failed = 0;

function check(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

async function rpcId(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<string> {
  const { data, error } = await client.rpc(name, args);
  if (error || !data) throw new Error(`${name} failed: ${error?.message}`);
  return data as string;
}

async function run() {
  console.log("=== PawSpace Phase 4 Booking Backend Tests ===\n");
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const owner = await createUser(`p4_owner_${runId}@pawspace-test.local`);
  const staff = await createUser(`p4_staff_${runId}@pawspace-test.local`);
  const otherOwner = await createUser(`p4_other_${runId}@pawspace-test.local`);
  const createdUserIds = [owner.id, staff.id, otherOwner.id];
  let shop1 = "";
  let shop2 = "";
  try {
    shop1 = await rpcId(owner.client, "bootstrap_shop", {
      p_name: "Phase 4 Test Shop",
      p_slug: `phase4-${runId}`,
    });
    shop2 = await rpcId(otherOwner.client, "bootstrap_shop", {
      p_name: "Phase 4 Other Shop",
      p_slug: `phase4-other-${runId}`,
    });
    const { error: membershipError } = await owner.client.rpc("create_staff_membership", {
      p_user_id: staff.id,
      p_email: staff.email,
      p_name: "Phase 4 Staff",
      p_role: "staff",
    });
    if (membershipError) throw new Error(membershipError.message);

    const owner1Id = await rpcId(owner.client, "create_pet_owner", {
      p_first_name: "Alice",
      p_last_name: "Tester",
      p_phone: `081${runId.slice(-7)}`,
      p_emergency_phone: null,
      p_address: null,
    });
    const owner2Id = await rpcId(otherOwner.client, "create_pet_owner", {
      p_first_name: "Bob",
      p_last_name: "Other",
      p_phone: `082${runId.slice(-7)}`,
      p_emergency_phone: null,
      p_address: null,
    });
    const petId = await rpcId(owner.client, "create_pet", {
      p_owner_id: owner1Id,
      p_name: "Milo",
      p_species: "dog",
      p_breed: "Mixed",
      p_gender: "male",
      p_birth_date: null,
      p_weight_kg: 8.5,
      p_avatar_url: null,
      p_special_care_notes: null,
      p_allergies: null,
    });
    const room1 = await rpcId(owner.client, "create_room", {
      p_room_number: `A-${runId.slice(-4)}`,
      p_room_type: "standard",
      p_capacity_pets: 2,
      p_base_price_per_night: 500,
    });
    const room2 = await rpcId(owner.client, "create_room", {
      p_room_number: `B-${runId.slice(-4)}`,
      p_room_type: "deluxe",
      p_capacity_pets: 2,
      p_base_price_per_night: 700,
    });
    const otherRoom = await rpcId(otherOwner.client, "create_room", {
      p_room_number: `X-${runId.slice(-4)}`,
      p_room_type: "standard",
      p_capacity_pets: 1,
      p_base_price_per_night: 400,
    });
    const { data: todayData, error: todayError } = await owner.client.rpc("pawspace_business_date");
    if (todayError || !todayData) throw new Error(`business date failed: ${todayError?.message}`);
    const today = todayData as string;
    const tomorrow = new Date(`${today}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const day2 = tomorrow.toISOString().slice(0, 10);
    const dayAfter = new Date(tomorrow);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    const day3 = dayAfter.toISOString().slice(0, 10);

    const ownerActor = actor(owner, shop1, "owner");
    const staffActor = actor(staff, shop1, "staff");
    const badInput = await createBooking(owner.client, ownerActor, {
      ownerId: "not-a-uuid",
      roomId: room1,
      checkInDate: today,
      checkOutDate: day2,
    });
    check(!badInput.success && badInput.error?.includes("valid UUID") === true, "Service rejects malformed IDs before RPC");

    const crossTenant = await createBooking(owner.client, ownerActor, {
      ownerId: owner2Id,
      roomId: otherRoom,
      checkInDate: today,
      checkOutDate: day2,
    });
    check(!crossTenant.success, "Cross-tenant booking creation is rejected", crossTenant.error);
    const created = await createBooking(owner.client, ownerActor, {
      ownerId: owner1Id,
      roomId: room1,
      checkInDate: today,
      checkOutDate: day2,
      totalAmount: 500,
      specialRequests: "Phase 4 lifecycle",
    });
    check(created.success && Boolean(created.data?.bookingId), "Create booking through service succeeds", created.error);
    if (!created.data?.bookingId) throw new Error("booking id missing");
    const bookingId = created.data.bookingId;

    const addPet = await addPetToBooking(owner.client, ownerActor, bookingId, petId);
    check(addPet.success, "Add pet through authoritative RPC succeeds", addPet.error);

    const overlapBooking = await createBooking(owner.client, ownerActor, {
      ownerId: owner1Id,
      roomId: room2,
      checkInDate: today,
      checkOutDate: day2,
    });
    check(overlapBooking.success && Boolean(overlapBooking.data?.bookingId), "Second room booking can be created before pet assignment", overlapBooking.error);
    if (!overlapBooking.data?.bookingId) throw new Error("overlap booking id missing");
    const overlapPet = await addPetToBooking(owner.client, ownerActor, overlapBooking.data.bookingId, petId);
    check(!overlapPet.success && overlapPet.error?.includes("Pet Conflict") === true, "Same pet overlapping active booking is rejected", overlapPet.error);

    const removeConfirmed = await removePetFromBooking(owner.client, ownerActor, bookingId, petId);
    check(removeConfirmed.success, "Pet can be removed while booking is confirmed", removeConfirmed.error);
    const reAddPet = await addPetToBooking(owner.client, ownerActor, bookingId, petId);
    check(reAddPet.success, "Pet can be re-added after confirmed removal", reAddPet.error);
    const cancelConfirmed = await updateBookingStatus(owner.client, ownerActor, overlapBooking.data.bookingId, "cancelled");
    check(cancelConfirmed.success, "Confirmed booking can be cancelled", cancelConfirmed.error);

    const scheduled = await updateBookingSchedule(owner.client, ownerActor, {
      bookingId,
      roomId: room1,
      checkInDate: today,
      checkOutDate: day3,
      totalAmount: 900,
      specialRequests: "Extended stay",
    });
    check(scheduled.success, "Confirmed booking can be rescheduled", scheduled.error);

    const checkedIn = await updateBookingStatus(owner.client, ownerActor, bookingId, "checked_in");
    check(checkedIn.success, "Check-in succeeds on Asia/Bangkok business date", checkedIn.error);

    const removeAfterCheckIn = await removePetFromBooking(owner.client, ownerActor, bookingId, petId);
    check(!removeAfterCheckIn.success, "Pet removal after check-in is rejected", removeAfterCheckIn.error);

    const cancelAfterCheckIn = await updateBookingStatus(owner.client, ownerActor, bookingId, "cancelled");
    check(!cancelAfterCheckIn.success, "Checked-in booking cannot be cancelled", cancelAfterCheckIn.error);

    const maintenanceByStaff = await setRoomMaintenance(staff.client, staffActor, {
      roomId: room2,
      from: day2,
      until: day3,
    });
    check(!maintenanceByStaff.success, "Staff role cannot set maintenance", maintenanceByStaff.error);

    const checkedOut = await updateBookingStatus(owner.client, ownerActor, bookingId, "checked_out");
    check(checkedOut.success, "Checkout succeeds and moves room to cleaning", checkedOut.error);
    const maintenanceDuringCleaning = await setRoomMaintenance(owner.client, ownerActor, {
      roomId: room1,
      from: today,
      until: today,
    });
    check(
      !maintenanceDuringCleaning.success && maintenanceDuringCleaning.error?.includes("cleaning") === true,
      "Current maintenance cannot bypass cleaning state",
      maintenanceDuringCleaning.error,
    );

    const clean = await markRoomClean(owner.client, ownerActor, room1);
    check(clean.success, "Cleaning gate returns checked-out room to available", clean.error);

    const cleanTwice = await markRoomClean(owner.client, ownerActor, room1);
    check(!cleanTwice.success, "Available room cannot be marked clean again", cleanTwice.error);

    const maintenance = await setRoomMaintenance(owner.client, ownerActor, {
      roomId: room1,
      from: today,
      until: today,
    });
    check(maintenance.success, "Owner can set current maintenance after cleaning", maintenance.error);

    const cleanMaintenance = await markRoomClean(owner.client, ownerActor, room1);
    check(!cleanMaintenance.success, "Maintenance room cannot bypass maintenance via mark clean", cleanMaintenance.error);

    const clearMaintenance = await setRoomMaintenance(owner.client, ownerActor, {
      roomId: room1,
      from: null,
      until: null,
    });
    check(clearMaintenance.success, "Maintenance can be cleared by owner", clearMaintenance.error);
  } finally {
    if (shop1) await admin.from("shops").delete().eq("id", shop1);
    if (shop2) await admin.from("shops").delete().eq("id", shop2);
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId);
    }
  }

  console.log(`\n=== Phase 4 Result: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error("Phase 4 suite crashed:", error);
  process.exitCode = 1;
});
