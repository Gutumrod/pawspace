import { createClient } from "@supabase/supabase-js";

const url = process.env.PS01_LOCAL_SUPABASE_URL;
const anonKey = process.env.PS01_LOCAL_ANON_KEY;
const serviceKey = process.env.PS01_LOCAL_SERVICE_ROLE_KEY;
const email = process.env.PS01_LOCAL_TEST_EMAIL ?? "owner@ps01.local.test";
const password = process.env.PS01_LOCAL_TEST_PASSWORD ?? "PawstiaLocal!2026";

if (!url || !anonKey || !serviceKey) {
  throw new Error("Missing PS01 local Supabase fixture environment.");
}

const admin = createClient(url, serviceKey, {
  db: { schema: "ps01" },
  auth: { persistSession: false, autoRefreshToken: false },
});

const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listed.error) throw listed.error;
const existing = listed.data.users.find((user) => user.email === email);
if (existing) {
  const removed = await admin.auth.admin.deleteUser(existing.id);
  if (removed.error) throw removed.error;
}

const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error || !created.data.user) throw created.error ?? new Error("User creation failed");
const userClient = createClient(url, anonKey, {
  db: { schema: "ps01" },
  auth: { persistSession: false, autoRefreshToken: false },
});

const signedIn = await userClient.auth.signInWithPassword({ email, password });
if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Sign-in failed");

async function rpcId(name, args) {
  const { data, error } = await userClient.rpc(name, args);
  if (error || !data) throw new Error(`${name} failed: ${error?.message ?? "missing id"}`);
  return String(data);
}

const shopId = await rpcId("bootstrap_shop", {
  p_name: "Pawstia Local Proof Hotel",
  p_slug: "pawstia-local-proof",
  p_phone: "0200000001",
  p_line_oa_id: null,
});

const roomId = await rpcId("create_room", {
  p_room_number: "A-01",
  p_room_type: "standard",
  p_capacity_pets: 2,
  p_base_price_per_night: 500,
});
const ownerId = await rpcId("create_pet_owner", {
  p_first_name: "Local",
  p_last_name: "Tester",
  p_phone: "0812345678",
  p_emergency_phone: null,
  p_address: null,
});

const petId = await rpcId("create_pet", {
  p_owner_id: ownerId,
  p_name: "Milo",
  p_species: "dog",
  p_breed: "Mixed",
  p_gender: "male",
  p_birth_date: null,
  p_weight_kg: 8.5,
  p_avatar_url: null,
  p_special_care_notes: "Local proof fixture",
  p_allergies: null,
});

const todayResult = await userClient.rpc("pawspace_business_date");
if (todayResult.error || !todayResult.data) throw todayResult.error ?? new Error("Business date failed");
const checkIn = String(todayResult.data);
const out = new Date(`${checkIn}T00:00:00Z`);
out.setUTCDate(out.getUTCDate() + 1);
const checkOut = out.toISOString().slice(0, 10);
const bookingId = await rpcId("create_booking", {
  p_owner_id: ownerId,
  p_room_id: roomId,
  p_check_in_date: checkIn,
  p_check_out_date: checkOut,
  p_total_amount: 500,
  p_special_requests: "Local proof booking",
});

const attached = await userClient.rpc("add_pet_to_booking", {
  p_booking_id: bookingId,
  p_pet_id: petId,
});
if (attached.error) throw attached.error;

await userClient.auth.signOut();

console.log("PS01_LOCAL_FIXTURE_PASS");
console.log(`Shop: ${shopId}`);
console.log(`Room: ${roomId}`);
console.log(`Owner: ${ownerId}`);
console.log(`Pet: ${petId}`);
console.log(`Booking: ${bookingId}`);
console.log(`Login: ${email}`);
console.log(`Password: ${password}`);
console.log("Credential above is LOCAL TEST ONLY.");
