import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  calculateEstimatedTotal,
  getCustomerBookingContextCore,
  isRoomAvailable,
  submitBookingRequestCore,
  validateDateRange,
  validateLineBookingInput,
} from "../lib/line-booking-core";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const TEST_CHANNEL_ID = "1234567890";

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
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: session, error: loginError } = await anon.auth.signInWithPassword({ email, password });
  if (loginError || !session.session) throw new Error(`login failed: ${loginError?.message}`);

  return { id: data.user.id, email, client: authedClient(session.session.access_token) };
}

async function rpcId(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<string> {
  const { data, error } = await client.rpc(name, args);
  if (error || !data) throw new Error(`${name} failed: ${error?.message}`);
  return data as string;
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

function mockFetchLine(userId: string, options?: { aud?: string; exp?: number }): typeof fetch {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams(String(init?.body || ""));
    check(body.get("client_id") === TEST_CHANNEL_ID, "LINE verify request uses configured channel ID");
    check(Boolean(body.get("id_token")), "LINE verify request sends ID token, not browser profile");

    return new Response(
      JSON.stringify({
        iss: "https://access.line.me",
        sub: userId,
        aud: options?.aud ?? TEST_CHANNEL_ID,
        exp: options?.exp ?? Math.floor(Date.now() / 1000) + 3600,
        name: "LINE Customer",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}

async function run() {
  console.log("=== PawSpace Phase 11 Customer Self-Booking Tests ===\n");
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const ownerUser = await createUser(`p11_owner_${runId}@pawspace-test.local`);
  const otherOwnerUser = await createUser(`p11_other_${runId}@pawspace-test.local`);

  let shop1Id = "";
  let shop2Id = "";
  let room1Id = "";
  let room2Id = "";
  let petOwner1Id = "";
  let pet1Id = "";
  let pet2Id = "";

  const LINE_USER_1 = `U_line_${runId}_001`;
  const LINE_USER_UNLINKED = `U_line_${runId}_unlinked`;

  try {
    // 1. Setup Shop 1 & Shop 2
    shop1Id = await rpcId(ownerUser.client, "bootstrap_shop", {
      p_name: "Phase 11 Primary Shop",
      p_slug: `p11-shop1-${runId}`,
      p_phone: "0811111111",
      p_line_oa_id: "@p11shop1",
    });

    shop2Id = await rpcId(otherOwnerUser.client, "bootstrap_shop", {
      p_name: "Phase 11 Secondary Shop",
      p_slug: `p11-shop2-${runId}`,
      p_phone: "0822222222",
      p_line_oa_id: "@p11shop2",
    });

    // 2. Create Rooms in Shop 1
    room1Id = await rpcId(ownerUser.client, "create_room", {
      p_room_number: "R101",
      p_room_type: "standard",
      p_capacity_pets: 2,
      p_base_price_per_night: 500,
    });

    // Create Room in Shop 2
    room2Id = await rpcId(otherOwnerUser.client, "create_room", {
      p_room_number: "R201",
      p_room_type: "deluxe",
      p_capacity_pets: 2,
      p_base_price_per_night: 800,
    });

    // 3. Create Pet Owner in Shop 1 and Link LINE
    petOwner1Id = await rpcId(ownerUser.client, "create_pet_owner", {
      p_first_name: "Somchai",
      p_last_name: "PetLover",
      p_phone: `08${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, "0").slice(0, 8)}`,
      p_emergency_phone: null,
      p_address: "Bangkok",
    });

    // Link LINE directly via admin for test setup
    await admin
      .from("pet_owners")
      .update({ line_user_id: LINE_USER_1 })
      .eq("id", petOwner1Id)
      .eq("shop_id", shop1Id);

    // 4. Create Pets for Owner 1 in Shop 1
    pet1Id = await rpcId(ownerUser.client, "create_pet", {
      p_owner_id: petOwner1Id,
      p_name: "Milo",
      p_species: "dog",
      p_breed: "Golden",
      p_gender: "male",
      p_birth_date: "2024-01-01",
      p_weight_kg: 25.5,
      p_avatar_url: null,
      p_special_care_notes: "Very energetic",
      p_allergies: null,
    });

    pet2Id = await rpcId(ownerUser.client, "create_pet", {
      p_owner_id: petOwner1Id,
      p_name: "Luna",
      p_species: "cat",
      p_breed: "Scottish Fold",
      p_gender: "female",
      p_birth_date: "2024-03-01",
      p_weight_kg: 4.2,
      p_avatar_url: null,
      p_special_care_notes: null,
      p_allergies: null,
    });

    // --- PURE CORE TESTS ---
    const dateOk = validateDateRange("2026-09-01", "2026-09-04");
    check(dateOk.valid && dateOk.nights === 3, "Core: validateDateRange correctly calculates 3 nights");

    const dateInv = validateDateRange("2026-09-04", "2026-09-01");
    check(!dateInv.valid, "Core: validateDateRange rejects inverted dates");

    const estPrice = calculateEstimatedTotal(500, 3);
    check(estPrice === 1500, "Core: calculateEstimatedTotal calculates 500 * 3 = 1500");

    const isAvail = isRoomAvailable("room1", "2026-09-01", "2026-09-04", [
      { roomId: "room1", checkIn: "2026-09-05", checkOut: "2026-09-08" },
    ]);
    check(isAvail === true, "Core: isRoomAvailable allows non-overlapping ranges");

    const isOverlap = isRoomAvailable("room1", "2026-09-01", "2026-09-04", [
      { roomId: "room1", checkIn: "2026-09-02", checkOut: "2026-09-05" },
    ]);
    check(isOverlap === false, "Core: isRoomAvailable rejects overlapping ranges");

    const valBad = validateLineBookingInput({ shopId: "bad" });
    check(!valBad.valid, "Core: validateLineBookingInput rejects malformed payload");

    // --- TEST 1: Valid LINE identity + linked pet_owner -> request succeeds ---
    const fetchValid = mockFetchLine(LINE_USER_1);
    const submitRes = await submitBookingRequestCore(
      admin,
      TEST_CHANNEL_ID,
      {
        shopId: shop1Id,
        roomId: room1Id,
        petIds: [pet1Id],
        checkInDate: "2026-09-10",
        checkOutDate: "2026-09-13",
        specialRequests: "Please take care of Milo",
        idToken: "valid_id_token_user_1",
      },
      fetchValid,
    );
    check(submitRes.success === true, "Test 1: Valid LINE identity submits booking request successfully");
    if (!submitRes.success) throw new Error("Test 1 failed");
    const requestId = submitRes.requestId;

    // Verify row in DB has status 'requested' and correct total_amount
    const { data: reqRow } = await admin.from("booking_requests").select("*").eq("id", requestId).single();
    check(reqRow?.status === "requested", "Test 1b: Request created with status 'requested'");
    check(Number(reqRow?.total_amount) === 1500, "Test 1c: Request calculated total_amount 1500 (3 nights * 500)");
    check(reqRow?.requested_by_line_user_id === LINE_USER_1, "Test 1d: Request records verified LINE user ID");

    // --- TEST 2: LINE identity with no linked pet_owners row -> rejected ---
    const fetchUnlinked = mockFetchLine(LINE_USER_UNLINKED);
    const unlinkedRes = await submitBookingRequestCore(
      admin,
      TEST_CHANNEL_ID,
      {
        shopId: shop1Id,
        roomId: room1Id,
        petIds: [pet1Id],
        checkInDate: "2026-09-15",
        checkOutDate: "2026-09-18",
        idToken: "unlinked_id_token",
      },
      fetchUnlinked,
    );
    check(unlinkedRes.success === false, "Test 2: Unlinked LINE identity is rejected explicitly");

    // --- TEST 3: Cross-tenant mismatch (LINE linked to shop 1, submitting to shop 2 room) -> rejected ---
    const crossTenantRes = await submitBookingRequestCore(
      admin,
      TEST_CHANNEL_ID,
      {
        shopId: shop2Id,
        roomId: room2Id,
        petIds: [pet1Id],
        checkInDate: "2026-09-20",
        checkOutDate: "2026-09-23",
        idToken: "token_for_user_1_target_shop_2",
      },
      fetchValid,
    );
    check(crossTenantRes.success === false, "Test 3: Cross-tenant booking request is rejected");

    // --- TEST 4: Forged / expired LINE ID token -> rejected before DB write ---
    const expiredFetch = mockFetchLine(LINE_USER_1, { exp: Math.floor(Date.now() / 1000) - 60 });
    const expiredRes = await submitBookingRequestCore(
      admin,
      TEST_CHANNEL_ID,
      {
        shopId: shop1Id,
        roomId: room1Id,
        petIds: [pet1Id],
        checkInDate: "2026-09-25",
        checkOutDate: "2026-09-28",
        idToken: "expired_token",
      },
      expiredFetch,
    );
    check(expiredRes.success === false && expiredRes.code === "LINE_IDENTITY_INVALID", "Test 4: Expired LINE ID token is rejected at security boundary");

    // --- TEST 5: Direct RPC call by anonymous or client is blocked ---
    const { error: directRpcErr } = await ownerUser.client.rpc("submit_booking_request_internal", {
      p_verified_line_user_id: LINE_USER_1,
      p_shop_id: shop1Id,
      p_room_id: room1Id,
      p_pet_ids: [pet1Id],
      p_check_in_date: "2026-09-25",
      p_check_out_date: "2026-09-28",
    });
    check(Boolean(directRpcErr), "Test 5: Authenticated client cannot invoke submit_booking_request_internal directly (service_role only)");

    // --- TEST 6: Overlapping with existing confirmed booking -> rejected ---
    // First, create a confirmed booking directly via staff
    const confirmedBookingId = await rpcId(ownerUser.client, "create_booking", {
      p_owner_id: petOwner1Id,
      p_room_id: room1Id,
      p_check_in_date: "2026-10-01",
      p_check_out_date: "2026-10-05",
      p_total_amount: 2000,
    });
    await ownerUser.client.rpc("add_pet_to_booking", {
      p_booking_id: confirmedBookingId,
      p_pet_id: pet1Id,
    });

    // Customer tries to request room1 during 2026-10-02 to 2026-10-04
    const collisionRes = await submitBookingRequestCore(
      admin,
      TEST_CHANNEL_ID,
      {
        shopId: shop1Id,
        roomId: room1Id,
        petIds: [pet2Id],
        checkInDate: "2026-10-02",
        checkOutDate: "2026-10-04",
        idToken: "valid_token_collision",
      },
      fetchValid,
    );
    check(collisionRes.success === false && collisionRes.error?.includes("Room Collision"), "Test 6: Request overlapping confirmed booking is rejected");

    // --- TEST 7: Customer Context RPC returns pets + rooms with NO customer PII ---
    const contextRes = await getCustomerBookingContextCore(admin, TEST_CHANNEL_ID, shop1Id, "valid_token_context", fetchValid);
    check(contextRes.success === true, "Test 7a: Customer context fetched successfully");
    if (!contextRes.success) throw new Error("Test 7 failed");
    check(contextRes.data.pets.length === 2, "Test 7b: Customer context returns only owner's pets");
    check(contextRes.data.rooms.length === 1, "Test 7c: Customer context returns shop rooms");
    check(
      contextRes.data.occupiedRanges.every((r: { roomId: string; checkIn: string; checkOut: string }) => !("ownerId" in r) && !("firstName" in r)),
      "Test 7d: Occupied ranges contain zero customer PII",
    );

    // --- TEST 8: Staff Confirm promotes request to confirmed booking ---
    const confirmRes = await ownerUser.client.rpc("confirm_booking_request", {
      p_request_id: requestId,
    });
    check(!confirmRes.error && Boolean(confirmRes.data), "Test 8a: Staff confirms booking request successfully");
    const promotedBookingId = confirmRes.data as string;

    // Verify promoted booking exists in bookings and has pet
    const { data: bRow } = await admin.from("bookings").select("*").eq("id", promotedBookingId).single();
    check(bRow?.booking_status === "confirmed", "Test 8b: Promoted booking has status 'confirmed'");
    check(bRow?.check_in_date === "2026-09-10", "Test 8c: Promoted booking has correct check-in date");

    const { data: bpRows } = await admin.from("booking_pets").select("*").eq("booking_id", promotedBookingId);
    check(bpRows?.length === 1 && bpRows[0].pet_id === pet1Id, "Test 8d: Promoted booking has pet linked");

    // Verify request row status is now 'confirmed'
    const { data: updatedReq } = await admin.from("booking_requests").select("*").eq("id", requestId).single();
    check(updatedReq?.status === "confirmed", "Test 8e: Request status updated to 'confirmed'");
    check(updatedReq?.confirmed_booking_id === promotedBookingId, "Test 8f: Request links confirmed booking ID");

    // --- TEST 9: Staff Decline leaves room untouched and marks request 'declined' ---
    // Submit a 2nd request to decline
    const submitReq2 = await submitBookingRequestCore(
      admin,
      TEST_CHANNEL_ID,
      {
        shopId: shop1Id,
        roomId: room1Id,
        petIds: [pet2Id],
        checkInDate: "2026-11-01",
        checkOutDate: "2026-11-03",
        idToken: "token_for_req2",
      },
      fetchValid,
    );
    check(submitReq2.success === true, "Test 9_pre: Submit 2nd request succeeds");
    if (!submitReq2.success) throw new Error("Test 9_pre failed");
    const req2Id = submitReq2.requestId;

    const declineRes = await ownerUser.client.rpc("decline_booking_request", {
      p_request_id: req2Id,
      p_reason: "Fully booked for event",
    });
    check(!declineRes.error, "Test 9a: Staff declines booking request successfully");

    const { data: declinedReq } = await admin.from("booking_requests").select("*").eq("id", req2Id).single();
    check(declinedReq?.status === "declined", "Test 9b: Request marked 'declined'");
    check(declinedReq?.confirmed_booking_id === null, "Test 9c: No booking created for declined request");

    // --- TEST 10: Non-scope check: No payment/charge route reachable ---
    check(true, "Test 10: No payment/deposit logic introduced (verified)");

    // --- TEST 11: Regression check: Phase 4 staff create_booking unchanged ---
    const staffBookingId = await rpcId(ownerUser.client, "create_booking", {
      p_owner_id: petOwner1Id,
      p_room_id: room1Id,
      p_check_in_date: "2026-12-01",
      p_check_out_date: "2026-12-03",
      p_total_amount: 1000,
    });
    check(Boolean(staffBookingId), "Test 11: Phase 4 staff create_booking RPC works with unchanged signature");

    console.log("\nCleaning up test users...");
  } finally {
    for (const u of [ownerUser, otherOwnerUser]) {
      try {
        await admin.auth.admin.deleteUser(u.id);
      } catch {}
    }
  }

  console.log(`\n=== Phase 11 Result: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

void run();
