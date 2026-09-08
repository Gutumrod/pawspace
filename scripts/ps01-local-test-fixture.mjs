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
const businessDate = String(todayResult.data);

const { data: plans, error: planError } = await userClient
  .from("room_rate_plans")
  .select("id,unit,quantity,price,is_active")
  .eq("room_id", roomId)
  .eq("unit", "DAY")
  .eq("quantity", 1)
  .eq("is_active", true);
if (planError || !plans?.[0]) throw planError ?? new Error("Seeded DAY Rate Plan missing");
const ratePlanId = String(plans[0].id);

const start = new Date(`${businessDate}T03:00:00.000Z`);
start.setUTCDate(start.getUTCDate() + 1);
const bookingId = await rpcId("create_booking_v2", {
  p_owner_id: ownerId,
  p_room_id: roomId,
  p_rate_plan_id: ratePlanId,
  p_pet_ids: [petId],
  p_start_at: start.toISOString(),
  p_special_requests: "Local Booking V2 proof fixture",
});

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
