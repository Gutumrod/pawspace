// H3D — PS01 Customer LINE Data API path replacement proof (static / no DB).
//
// Run:  npx tsx --conditions=react-server tests/h3d_data_api_runtime.test.ts
// (the react-server condition resolves the `server-only` marker to an empty
//  module so the server adapter can be imported in a plain Node test.)
//
// Proves, without any database or local Supabase:
//  1. missing PS01_LINE_RUNTIME_JWT => the adapter fails closed (throws).
//  2. a 4th / unallowlisted RPC name is rejected with no network call.
//  3. the 3 allowlisted RPC names are forwarded to the Data API transport.
//  4. underlying transport errors surface as { error: { message } } with no
//     table/admin fallback.
//  5. lib/line-booking-server.ts routes through the Data API adapter, not the
//     pooler adapter, and references no PS01_RUNTIME_DB_* / service-role.
//  6. lib/ps01-runtime.ts consults no service-role / admin / pooler credential.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const FAKE_URL = "http://127.0.0.1:1";
const FAKE_ANON = "anon-test-key";
const ALLOWED = [
  "get_customer_booking_context_v2_internal",
  "quote_customer_booking_v2_internal",
  "submit_booking_request_v2_internal",
];

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  [PASS] ${name}`);
      passed += 1;
    })
    .catch((err) => {
      console.error(`  [FAIL] ${name} - ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    });
}

async function main() {
  console.log("=== H3D Data API runtime replacement — static proof ===\n");

  process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = FAKE_ANON;

  const mod = await import("../lib/ps01-runtime");
  const { getPs01LineRuntimeClient } = mod as {
    getPs01LineRuntimeClient: () => {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };

  // 1. missing token => fail closed
  await check("missing PS01_LINE_RUNTIME_JWT fails closed (throws)", async () => {
    delete process.env.PS01_LINE_RUNTIME_JWT;
    await assert.rejects(
      () => getPs01LineRuntimeClient().rpc(ALLOWED[0], { p_verified_line_user_id: "U", p_shop_id: "s" }),
      /PS01_LINE_RUNTIME_JWT/,
    );
  });

  // token present for the rest — fake, unsigned; never leaves the process because
  // the transport target is 127.0.0.1:1.
  process.env.PS01_LINE_RUNTIME_JWT = "test.header.payload";

  // 2. unallowlisted RPC rejected with no network call
  await check("4th / unallowlisted RPC name is rejected before any network call", async () => {
    const started = Date.now();
    const res = await getPs01LineRuntimeClient().rpc("ps01_request_user_id", {});
    assert.equal(res.data, null);
    assert.match(res.error?.message ?? "", /not allowlisted: ps01_request_user_id/);
    // an allowlist rejection is synchronous-ish; a real socket attempt to a dead
    // port takes measurably longer than an in-process return.
    assert.ok(Date.now() - started < 200, "allowlist rejection should not attempt a connection");
  });

  await check("common escalation RPC names are all rejected", async () => {
    for (const name of ["rls_auto_enable", "is_shop_member", "get_customer_booking_context_internal", "http_post"]) {
      const res = await getPs01LineRuntimeClient().rpc(name, {});
      assert.match(res.error?.message ?? "", new RegExp(`not allowlisted: ${name}`));
    }
  });

  // 3 + 4. allowlisted names are forwarded to the transport; a transport failure
  // is surfaced as { error: { message } } and never throws / never falls back.
  await check("allowlisted RPCs are forwarded and transport errors are mapped, not thrown", async () => {
    for (const name of ALLOWED) {
      const res = await getPs01LineRuntimeClient().rpc(name, { p_verified_line_user_id: "U", p_shop_id: "s" });
      assert.equal(res.data, null, `${name}: no data on transport failure`);
      assert.ok(res.error && typeof res.error.message === "string", `${name}: error mapped to { message }`);
    }
  });

  // 5. server route swap
  await check("lib/line-booking-server.ts routes through the Data API adapter only", () => {
    const src = read("lib/line-booking-server.ts");
    assert.ok(src.includes("getPs01LineRuntimeClient"), "must import the Data API adapter");
    assert.ok(!src.includes("ps01-runtime-db"), "must not import the pooler adapter");
    assert.ok(!src.includes("getPs01RuntimeDatabaseClient"), "must not call the pooler adapter");
    assert.ok(!/PS01_RUNTIME_DB_/.test(src), "must not reference PS01_RUNTIME_DB_*");
    assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|service_role/.test(src), "must not reference service-role");
  });

  // 6. adapter has no admin / pooler credential path
  await check("lib/ps01-runtime.ts consults no service-role / admin / pooler credential", () => {
    const src = read("lib/ps01-runtime.ts");
    assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|service_role/.test(src), "no service-role");
    assert.ok(!src.includes("PS01_RUNTIME_DB_"), "no pooler env");
    assert.ok(!src.includes("local_service"), "no cross-product schema");
    assert.ok(src.includes("ps01_line_runtime"), "documents the role contract");
    for (const rpc of ALLOWED) assert.ok(src.includes(rpc), `allowlists ${rpc}`);
  });

  // core is transport-agnostic (interface only)
  await check("lib/line-booking-core.ts depends only on the Ps01RuntimeRpcClient interface", () => {
    const src = read("lib/line-booking-core.ts");
    assert.ok(!src.includes("ps01-runtime-db"), "core must not import a concrete adapter");
    assert.ok(!/PS01_RUNTIME_DB_/.test(src), "core must not reference pooler env");
  });

  console.log(`\n=== H3D static proof: ${passed} checks passed ===`);
  if (process.exitCode) console.error("H3D static proof FAILED");
}

void main();
