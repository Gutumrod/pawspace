import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function authedClient(token: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
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

async function run() {
  console.log("=== PawSpace Phase 13 Bootstrap Trialing Regression Tests ===\n");
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const email = `p13_boot_${runId}@pawspace-test.local`;
  const password = "TestPassword123!";
  let userId = "";

  try {
    const { data: userData, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !userData.user) throw new Error(`createUser failed: ${createErr?.message}`);
    userId = userData.user.id;

    const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: session, error: loginErr } = await anon.auth.signInWithPassword({ email, password });
    if (loginErr || !session.session) throw new Error(`login failed: ${loginErr?.message}`);

    const authed = authedClient(session.session.access_token);

    // Test 1: bootstrap_shop must succeed with the current (post-Phase-13) schema.
    const { data: shopId, error: bootstrapErr } = await authed.rpc("bootstrap_shop", {
      p_name: "Phase 13 Trialing Regression Shop",
      p_slug: `p13-trialing-${runId}`,
      p_phone: "0899999999",
      p_line_oa_id: null,
    });
    check(!bootstrapErr && Boolean(shopId), "Test 1a: bootstrap_shop succeeds with current schema", bootstrapErr?.message);
    if (bootstrapErr || !shopId) throw new Error(`bootstrap_shop failed: ${bootstrapErr?.message}`);

    // Test 1b: the shop must have subscription_status='trialing', not 'trial'.
    const { data: shopRow, error: shopErr } = await admin
      .from("shops")
      .select("subscription_status")
      .eq("id", shopId)
      .single();
    check(
      !shopErr && shopRow?.subscription_status === "trialing",
      "Test 1b: bootstrapped shop has subscription_status='trialing'",
      `got: ${shopRow?.subscription_status}`,
    );
    check(
      shopRow?.subscription_status !== "trial",
      "Test 1c: subscription_status is NOT the legacy 'trial' value",
    );

    // Test 2: the shop_subscriptions entry must exist with status='trialing'.
    const { data: subRow, error: subErr } = await admin
      .from("shop_subscriptions")
      .select("status")
      .eq("shop_id", shopId)
      .single();
    check(
      !subErr && subRow?.status === "trialing",
      "Test 2: shop_subscriptions row has status='trialing'",
      `got: ${subRow?.status}`,
    );
  } finally {
    if (userId) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {}
    }
  }

  console.log(`\n=== Phase 13 Bootstrap Trialing Result: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

void run();
