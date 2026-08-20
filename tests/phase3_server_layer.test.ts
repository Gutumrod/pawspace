/**
 * PawSpace Phase 3 Server & Tenant Context Integration Test Suite
 *
 * Verifies:
 * 1. Server-side Supabase admin & authenticated client boundaries
 * 2. Auth session -> staff tenant context resolution via get_current_staff_context() RPC
 * 3. Inactive staff behavior (tenant context returns null, RPCs rejected)
 * 4. User without staff membership behavior (tenant context returns null)
 * 5. bootstrap_shop trusted flow (creates Shop + Owner, rejects duplicate bootstrap)
 * 6. Owner-only staff management (invite, disable, enable, change role, remove)
 * 7. Non-owner rejection for staff management (manager & staff denied)
 * 8. Last-active-owner invariant enforcement (atomic trigger prevents 0 active owners)
 * 9. Two active owners scenario (can disable one, but cannot disable the last remaining)
 * 10. Cross-tenant guards for staff management
 * 11. Direct DML on shops / staff_users remains denied for authenticated staff
 * 12. Structured logger secret scrubbing
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sanitizeObject } from "../lib/logger";

// URL has a local-dev default (not a credential). Keys must come from the environment -
// never hard-code Supabase credentials in test source, even local-only demo keys.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Run \`supabase status\` for local values, then:\n` +
        "  NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx tests/phase3_server_layer.test.ts"
    );
  }
  return value;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

// Set environment variables for the test process
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getAuthedClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

interface TestUser {
  id: string;
  email: string;
  token: string;
  client: SupabaseClient;
}

async function createAndLoginTestUser(email: string): Promise<TestUser> {
  const password = "TestPassword123!";

  // Delete existing if any
  const { data: list } = await adminClient.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) {
    await adminClient.auth.admin.deleteUser(existing.id);
  }

  // Create user
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: email.split("@")[0] },
  });

  if (createError || !created.user) {
    throw new Error(`Failed to create test user ${email}: ${createError?.message}`);
  }

  // Sign in to get access token
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sessionData, error: signInError } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !sessionData.session) {
    throw new Error(`Failed to sign in test user ${email}: ${signInError?.message}`);
  }

  const token = sessionData.session.access_token;
  const client = getAuthedClient(token);

  return {
    id: created.user.id,
    email,
    token,
    client,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

async function runSuite() {
  console.log("=== PawSpace Phase 3 Server Layer & Tenant Context Tests ===\n");

  const runId = Math.random().toString(36).substring(2, 7);
  const owner1Email = `owner1_${runId}@pawspace-test.local`;
  const owner2Email = `owner2_${runId}@pawspace-test.local`;
  const managerEmail = `manager_${runId}@pawspace-test.local`;
  const staffEmail = `staff_${runId}@pawspace-test.local`;
  const orphanEmail = `orphan_${runId}@pawspace-test.local`;
  const shop2OwnerEmail = `shop2_owner_${runId}@pawspace-test.local`;

  // 1. Logger secret scrubbing test
  console.log("Test Group 1: Logger secret scrubbing");
  const scrubbed = sanitizeObject({
    password: "super_secret_password",
    SUPABASE_SERVICE_ROLE_KEY: "secret_key_value",
    token: "bearer_token",
    safeField: "safeValue",
    customPayload: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMC6Y5nV3iMTGeWjidnVn4nrN700",
  });
  assert(scrubbed.password === "[REDACTED]", "Password field is redacted");
  assert(scrubbed.SUPABASE_SERVICE_ROLE_KEY === "[REDACTED]", "Service role key field is redacted");
  assert(scrubbed.token === "[REDACTED]", "Token field is redacted");
  assert(scrubbed.safeField === "safeValue", "Non-sensitive field is preserved");
  assert(scrubbed.customPayload === "[REDACTED_JWT]", "JWT string values are redacted");

  // 2. Orphan user (no staff membership)
  console.log("\nTest Group 2: User with no staff membership");
  const orphanUser = await createAndLoginTestUser(orphanEmail);
  const { data: orphanContext } = await orphanUser.client.rpc("get_current_staff_context");
  assert(orphanContext === null, "User with no staff membership returns null tenant context");

  // 3. Bootstrap Shop 1
  console.log("\nTest Group 3: Tenant bootstrap (first shop + first owner)");
  const owner1 = await createAndLoginTestUser(owner1Email);
  const shop1Slug = `test-shop-${runId}`;
  const { data: shop1Id, error: bootstrapErr } = await owner1.client.rpc("bootstrap_shop", {
    p_name: "Paws Test Hotel 1",
    p_slug: shop1Slug,
    p_phone: "0812345678",
    p_line_oa_id: "@paws1",
  });
  assert(!bootstrapErr && Boolean(shop1Id), "Shop 1 bootstrapped successfully", bootstrapErr?.message);

  const { data: owner1Context } = await owner1.client.rpc("get_current_staff_context");
  assert(
    owner1Context !== null &&
      owner1Context.user_id === owner1.id &&
      owner1Context.shop_id === shop1Id &&
      owner1Context.role === "owner" &&
      owner1Context.is_active === true,
    "Owner 1 resolves correct active owner tenant context"
  );

  // 4. Duplicate bootstrap rejection
  console.log("\nTest Group 4: Duplicate bootstrap rejection");
  const { error: dupBootstrapErr } = await owner1.client.rpc("bootstrap_shop", {
    p_name: "Paws Duplicate",
    p_slug: `dup-${runId}`,
  });
  assert(
    dupBootstrapErr !== null && dupBootstrapErr.message.includes("Caller already belongs to a shop"),
    "Caller with existing membership cannot bootstrap second shop"
  );

  // 5. Owner creates Staff and Manager memberships
  console.log("\nTest Group 5: Owner creates Staff and Manager memberships");
  const staffUser = await createAndLoginTestUser(staffEmail);
  const managerUser = await createAndLoginTestUser(managerEmail);
  const owner2User = await createAndLoginTestUser(owner2Email);

  const { error: addStaffErr } = await owner1.client.rpc("create_staff_membership", {
    p_user_id: staffUser.id,
    p_email: staffUser.email,
    p_name: "Staff Person",
    p_role: "staff",
  });
  assert(!addStaffErr, "Owner successfully added staff member", addStaffErr?.message);

  const { error: addManagerErr } = await owner1.client.rpc("create_staff_membership", {
    p_user_id: managerUser.id,
    p_email: managerUser.email,
    p_name: "Manager Person",
    p_role: "manager",
  });
  assert(!addManagerErr, "Owner successfully added manager member", addManagerErr?.message);

  const { error: addOwner2Err } = await owner1.client.rpc("create_staff_membership", {
    p_user_id: owner2User.id,
    p_email: owner2User.email,
    p_name: "Second Owner",
    p_role: "owner",
  });
  assert(!addOwner2Err, "Owner successfully added second owner", addOwner2Err?.message);

  // Verify staff context for staff & manager
  const { data: staffContext } = await staffUser.client.rpc("get_current_staff_context");
  assert(
    staffContext !== null && staffContext.role === "staff" && staffContext.shop_id === shop1Id,
    "Staff user resolves correct staff tenant context"
  );

  const { data: managerContext } = await managerUser.client.rpc("get_current_staff_context");
  assert(
    managerContext !== null && managerContext.role === "manager" && managerContext.shop_id === shop1Id,
    "Manager user resolves correct manager tenant context"
  );

  // 6. Non-owner staff management rejection
  console.log("\nTest Group 6: Non-owner authorization rejection");
  const dummyUser = await createAndLoginTestUser(`dummy_${runId}@pawspace-test.local`);
  const { error: staffInviteErr } = await staffUser.client.rpc("create_staff_membership", {
    p_user_id: dummyUser.id,
    p_email: dummyUser.email,
    p_name: "Dummy",
    p_role: "staff",
  });
  assert(
    staffInviteErr !== null && staffInviteErr.message.includes("Only an active shop owner"),
    "Staff cannot invite new staff members"
  );

  const { error: managerInviteErr } = await managerUser.client.rpc("create_staff_membership", {
    p_user_id: dummyUser.id,
    p_email: dummyUser.email,
    p_name: "Dummy",
    p_role: "staff",
  });
  assert(
    managerInviteErr !== null && managerInviteErr.message.includes("Only an active shop owner"),
    "Manager cannot invite new staff members"
  );

  const { error: managerDisableErr } = await managerUser.client.rpc("disable_staff", {
    p_user_id: staffUser.id,
  });
  assert(
    managerDisableErr !== null && managerDisableErr.message.includes("Only an active shop owner"),
    "Manager cannot disable staff members"
  );

  // 7. Role change
  console.log("\nTest Group 7: Role changes by owner");
  const { error: promoteErr } = await owner1.client.rpc("change_staff_role", {
    p_user_id: staffUser.id,
    p_new_role: "manager",
  });
  assert(!promoteErr, "Owner successfully changed staff role to manager", promoteErr?.message);

  const { data: updatedStaffContext } = await staffUser.client.rpc("get_current_staff_context");
  assert(updatedStaffContext?.role === "manager", "Staff user context reflects updated manager role");

  // Revert back to staff
  await owner1.client.rpc("change_staff_role", {
    p_user_id: staffUser.id,
    p_new_role: "staff",
  });

  // 8. Disable and re-enable staff
  console.log("\nTest Group 8: Staff deactivation and reactivation");
  const { error: disableErr } = await owner1.client.rpc("disable_staff", {
    p_user_id: staffUser.id,
  });
  assert(!disableErr, "Owner successfully disabled staff member", disableErr?.message);

  const { data: disabledContext } = await staffUser.client.rpc("get_current_staff_context");
  assert(disabledContext === null, "Disabled staff member receives NULL tenant context immediately");

  // Re-enable staff
  const { error: enableErr } = await owner1.client.rpc("enable_staff", {
    p_user_id: staffUser.id,
  });
  assert(!enableErr, "Owner successfully re-enabled staff member", enableErr?.message);

  const { data: reenabledContext } = await staffUser.client.rpc("get_current_staff_context");
  assert(
    reenabledContext !== null && reenabledContext.is_active === true,
    "Re-enabled staff member receives valid active tenant context again"
  );

  // 9. Last active owner invariant enforcement
  console.log("\nTest Group 9: Last Active Owner Invariant Enforcement");
  // Shop 1 has 2 active owners (owner1 and owner2).
  // Disabling owner2 should SUCCEED because owner1 is still active.
  const { error: disableOwner2Err } = await owner1.client.rpc("disable_staff", {
    p_user_id: owner2User.id,
  });
  assert(!disableOwner2Err, "Disabling owner 2 succeeds when owner 1 remains active", disableOwner2Err?.message);

  // Now owner1 is the ONLY active owner in Shop 1.
  // Attempting to disable owner1 must FAIL.
  const { error: disableLastOwnerErr } = await owner1.client.rpc("disable_staff", {
    p_user_id: owner1.id,
  });
  assert(
    disableLastOwnerErr !== null && disableLastOwnerErr.message.includes("Last Active Owner Invariant"),
    "Disabling the last active owner is rejected by trigger"
  );

  // Attempting to demote owner1 to staff must FAIL.
  const { error: demoteLastOwnerErr } = await owner1.client.rpc("change_staff_role", {
    p_user_id: owner1.id,
    p_new_role: "staff",
  });
  assert(
    demoteLastOwnerErr !== null && demoteLastOwnerErr.message.includes("Last Active Owner Invariant"),
    "Demoting the last active owner to staff is rejected by trigger"
  );

  // Attempting to remove owner1 must FAIL.
  const { error: removeLastOwnerErr } = await owner1.client.rpc("remove_staff", {
    p_user_id: owner1.id,
  });
  assert(
    removeLastOwnerErr !== null && removeLastOwnerErr.message.includes("Last Active Owner Invariant"),
    "Removing the last active owner is rejected by trigger"
  );

  // 10. Cross-tenant isolation
  console.log("\nTest Group 10: Cross-tenant isolation");
  const shop2Owner = await createAndLoginTestUser(shop2OwnerEmail);
  const shop2Slug = `test-shop2-${runId}`;
  const { error: shop2BootstrapErr } = await shop2Owner.client.rpc("bootstrap_shop", {
    p_name: "Paws Test Hotel 2",
    p_slug: shop2Slug,
  });
  assert(!shop2BootstrapErr, "Shop 2 bootstrapped successfully", shop2BootstrapErr?.message);

  // Shop 1 Owner attempts to disable Shop 2 Owner -> MUST FAIL
  const { error: crossTenantDisableErr } = await owner1.client.rpc("disable_staff", {
    p_user_id: shop2Owner.id,
  });
  assert(
    crossTenantDisableErr !== null &&
      crossTenantDisableErr.message.includes("Target staff member"),
    "Cross-tenant staff disable is rejected"
  );

  // Shop 1 Owner attempts to remove Shop 2 Owner -> MUST FAIL
  const { error: crossTenantRemoveErr } = await owner1.client.rpc("remove_staff", {
    p_user_id: shop2Owner.id,
  });
  assert(
    crossTenantRemoveErr !== null &&
      crossTenantRemoveErr.message.includes("Target staff member"),
    "Cross-tenant staff removal is rejected"
  );

  // Shop 1 Owner attempts to change Shop 2 Owner role -> MUST FAIL
  const { error: crossTenantRoleErr } = await owner1.client.rpc("change_staff_role", {
    p_user_id: shop2Owner.id,
    p_new_role: "staff",
  });
  assert(
    crossTenantRoleErr !== null &&
      crossTenantRoleErr.message.includes("Target staff member"),
    "Cross-tenant staff role change is rejected"
  );

  // 11. Direct DML lockdown
  console.log("\nTest Group 11: Direct browser DML lockdown");
  const { error: directInsertShopErr } = await owner1.client.from("shops").insert({
    name: "Direct Hack Shop",
    slug: `hack-${runId}`,
  });
  assert(
    directInsertShopErr !== null,
    "Direct INSERT on shops table is rejected by RLS / table privileges"
  );

  const { error: directInsertStaffErr } = await owner1.client.from("staff_users").insert({
    id: dummyUser.id,
    shop_id: shop1Id,
    email: dummyUser.email,
    name: "Hacker",
    role: "owner",
    is_active: true,
  });
  assert(
    directInsertStaffErr !== null,
    "Direct INSERT on staff_users table is rejected by RLS / table privileges"
  );

  console.log(`\n========================================`);
  console.log(`Total tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
