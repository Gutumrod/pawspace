import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyAndConsumeLineClaim } from "../lib/line-claim-core";
import { verifyLineIdToken } from "../lib/line-id-token";

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
function verifiedFetch(userId: string, options?: { aud?: string; exp?: number }): typeof fetch {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams(String(init?.body || ""));
    check(body.get("client_id") === TEST_CHANNEL_ID, "LINE verify request uses configured channel ID");
    check(Boolean(body.get("id_token")), "LINE verify request sends ID token, not browser profile data");

    return new Response(
      JSON.stringify({
        iss: "https://access.line.me",
        sub: userId,
        aud: options?.aud ?? TEST_CHANNEL_ID,
        exp: options?.exp ?? Math.floor(Date.now() / 1000) + 3600,
        name: "LINE Test User",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}

async function createPetOwner(client: SupabaseClient, suffix: string): Promise<string> {
  return rpcId(client, "create_pet_owner", {
    p_first_name: `P5-${suffix}`,
    p_last_name: "Tester",
    p_phone: `08${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, "0").slice(0, 8)}`,
    p_emergency_phone: null,
    p_address: null,
  });
}
async function run() {
  console.log("=== PawSpace Phase 5 LINE Claim Tests ===\n");
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const owner = await createUser(`p5_owner_${runId}@pawspace-test.local`);
  const manager = await createUser(`p5_manager_${runId}@pawspace-test.local`);
  const staff = await createUser(`p5_staff_${runId}@pawspace-test.local`);
  const otherOwner = await createUser(`p5_other_${runId}@pawspace-test.local`);
  const createdUserIds = [owner.id, manager.id, staff.id, otherOwner.id];
  let shop1 = "";
  let shop2 = "";

  try {
    shop1 = await rpcId(owner.client, "bootstrap_shop", {
      p_name: "Phase 5 Test Shop",
      p_slug: `phase5-${runId}`,
    });
    shop2 = await rpcId(otherOwner.client, "bootstrap_shop", {
      p_name: "Phase 5 Other Shop",
      p_slug: `phase5-other-${runId}`,
    });

    for (const member of [
      { user: manager, name: "P5 Manager", role: "manager" },
      { user: staff, name: "P5 Staff", role: "staff" },
    ]) {
      const { error } = await owner.client.rpc("create_staff_membership", {
        p_user_id: member.user.id,
        p_email: member.user.email,
        p_name: member.name,
        p_role: member.role,
      });
      if (error) throw new Error(`membership failed: ${error.message}`);
    }

    const ownerA = await createPetOwner(owner.client, "A");
    const ownerB = await createPetOwner(owner.client, "B");
    const ownerExpired = await createPetOwner(owner.client, "Expired");

    const validIdentity = await verifyLineIdToken("mock-id-token", TEST_CHANNEL_ID, verifiedFetch("U_LINE_A"));
    check(validIdentity.success && validIdentity.identity.userId === "U_LINE_A", "Valid LINE ID token response is accepted");

    const wrongAudience = await verifyLineIdToken(
      "mock-id-token",
      TEST_CHANNEL_ID,
      verifiedFetch("U_LINE_A", { aud: "wrong-channel" }),
    );
    check(!wrongAudience.success && wrongAudience.code === "INVALID_ID_TOKEN", "Wrong LINE token audience is rejected");

    const expiredIdentity = await verifyLineIdToken(
      "mock-id-token",
      TEST_CHANNEL_ID,
      verifiedFetch("U_LINE_A", { exp: Math.floor(Date.now() / 1000) - 1 }),
    );
    check(!expiredIdentity.success && expiredIdentity.code === "INVALID_ID_TOKEN", "Expired LINE token response is rejected");

    const unavailableIdentity = await verifyLineIdToken(
      "mock-id-token",
      TEST_CHANNEL_ID,
      (async () => { throw new Error("network down"); }) as typeof fetch,
    );
    check(!unavailableIdentity.success && unavailableIdentity.code === "LINE_UNAVAILABLE", "LINE verification outage fails closed");

    const claimToken = await rpcId(owner.client, "generate_line_claim_token", { p_owner_id: ownerA });
    check(/^[0-9a-f]{64}$/i.test(claimToken), "Claim token is 32 random bytes encoded as 64 hex chars");

    const { data: claimRow, error: claimRowError } = await admin
      .from("pet_owners")
      .select("line_claim_token_hash,line_claim_expires_at,line_claim_used_at,line_user_id")
      .eq("id", ownerA)
      .single();
    if (claimRowError || !claimRow) throw new Error(`claim row read failed: ${claimRowError?.message}`);

    check(claimRow.line_claim_token_hash !== claimToken, "Plaintext claim token is not stored in database");
    check(typeof claimRow.line_claim_token_hash === "string" && claimRow.line_claim_token_hash.length === 64, "Claim token hash is SHA-256 hex");
    check(claimRow.line_claim_used_at === null && claimRow.line_user_id === null, "Fresh claim is unused and unlinked");

    const expiresAt = Date.parse(String(claimRow.line_claim_expires_at));
    const hoursRemaining = (expiresAt - Date.now()) / 3_600_000;
    check(hoursRemaining > 47.9 && hoursRemaining <= 48.01, "Claim token TTL is 48 hours", `hours=${hoursRemaining}`);

    const { error: browserConsumeError } = await owner.client.rpc("consume_line_claim_token_internal", {
      p_token: claimToken,
      p_verified_line_user_id: "U_ATTACKER",
      p_expected_shop_id: shop1,
    });
    check(Boolean(browserConsumeError), "Authenticated browser cannot call internal claim consume RPC");

    const { error: wrongShopError } = await admin.rpc("consume_line_claim_token_internal", {
      p_token: claimToken,
      p_verified_line_user_id: "U_LINE_A",
      p_expected_shop_id: shop2,
    });
    check(Boolean(wrongShopError), "Valid claim token with wrong expected shop is rejected");

    const claimed = await verifyAndConsumeLineClaim(
      admin,
      TEST_CHANNEL_ID,
      { claimToken, idToken: "mock-id-token", expectedShopId: shop1 },
      verifiedFetch("U_LINE_A"),
    );
    check(claimed.success && claimed.ownerId === ownerA, "Trusted server verifies LINE identity then consumes claim");

    const { data: linkedRow } = await admin
      .from("pet_owners")
      .select("line_user_id,line_claim_used_at")
      .eq("id", ownerA)
      .single();
    check(linkedRow?.line_user_id === "U_LINE_A" && Boolean(linkedRow?.line_claim_used_at), "Consume stores verified LINE user and marks token used");

    const { error: reuseError } = await admin.rpc("consume_line_claim_token_internal", {
      p_token: claimToken,
      p_verified_line_user_id: "U_LINE_A",
      p_expected_shop_id: shop1,
    });
    check(Boolean(reuseError), "Consumed claim token cannot be reused");

    const { error: linkedGenerateError } = await owner.client.rpc("generate_line_claim_token", { p_owner_id: ownerA });
    check(Boolean(linkedGenerateError), "Already linked owner cannot generate another claim before reset");

    const duplicateToken = await rpcId(owner.client, "generate_line_claim_token", { p_owner_id: ownerB });
    const duplicateClaim = await verifyAndConsumeLineClaim(
      admin,
      TEST_CHANNEL_ID,
      { claimToken: duplicateToken, idToken: "mock-id-token", expectedShopId: shop1 },
      verifiedFetch("U_LINE_A"),
    );
    check(!duplicateClaim.success && duplicateClaim.code === "CLAIM_REJECTED", "Duplicate LINE user link inside same shop is rejected");

    const { error: staffResetError } = await staff.client.rpc("reset_line_link", { p_owner_id: ownerA });
    check(Boolean(staffResetError), "Staff cannot reset LINE link");

    const { error: managerResetError } = await manager.client.rpc("reset_line_link", { p_owner_id: ownerA });
    check(!managerResetError, "Manager can reset LINE link", managerResetError?.message);

    const { data: resetRow } = await admin
      .from("pet_owners")
      .select("line_user_id,line_claim_token_hash,line_claim_expires_at,line_claim_used_at")
      .eq("id", ownerA)
      .single();
    check(
      resetRow?.line_user_id === null &&
        resetRow?.line_claim_token_hash === null &&
        resetRow?.line_claim_expires_at === null &&
        resetRow?.line_claim_used_at === null,
      "Reset clears LINE identity and all claim state",
    );

    const staffGeneratedToken = await rpcId(staff.client, "generate_line_claim_token", { p_owner_id: ownerA });
    check(/^[0-9a-f]{64}$/i.test(staffGeneratedToken), "Active staff can generate claim token for owner in own shop");

    const expiredToken = await rpcId(owner.client, "generate_line_claim_token", { p_owner_id: ownerExpired });
    const { error: expireUpdateError } = await admin
      .from("pet_owners")
      .update({ line_claim_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", ownerExpired);
    if (expireUpdateError) throw new Error(`expire update failed: ${expireUpdateError.message}`);

    const { error: expiredConsumeError } = await admin.rpc("consume_line_claim_token_internal", {
      p_token: expiredToken,
      p_verified_line_user_id: "U_EXPIRED",
      p_expected_shop_id: shop1,
    });
    check(Boolean(expiredConsumeError), "Expired LINE claim token is rejected");

    const { error: crossTenantGenerateError } = await owner.client.rpc("generate_line_claim_token", {
      p_owner_id: await createPetOwner(otherOwner.client, "Other"),
    });
    check(Boolean(crossTenantGenerateError), "Staff cannot generate claim token for owner in another tenant");
  } finally {
    if (shop1) await admin.from("shops").delete().eq("id", shop1);
    if (shop2) await admin.from("shops").delete().eq("id", shop2);
    for (const userId of createdUserIds) await admin.auth.admin.deleteUser(userId);
  }

  console.log(`\n=== Phase 5 Result: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error("Phase 5 suite crashed:", error);
  process.exitCode = 1;
});
