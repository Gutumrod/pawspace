import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requirePs01RuntimeEnv } from "./env";
import { ps01DatabaseOptions } from "./ps01-schema";
import type { Ps01RuntimeRpcClient } from "./line-booking-core";

/**
 * Active PS01 Customer LINE data-plane adapter (H3D).
 *
 * Path: LINE -> Next.js server -> Supabase Data API (PostgREST)
 *       -> short-lived Auth-issued JWT (role=ps01_line_runtime)
 *       -> exact PS01 gateway RPC.
 *
 * This adapter never uses the reusable pooler login (ps01_runtime_login) and
 * never consults the project-wide service-role credential. The direct-DB
 * adapter in lib/ps01-runtime-db.ts is retained as rollback/reference only.
 */

// Local defense-in-depth allowlist. The runtime role's EXECUTE grant is the
// authoritative boundary; this is a second, in-process gate that also refuses
// to emit a network call for any non-allowlisted RPC name.
const ALLOWED_RPCS = new Set<string>([
  "get_customer_booking_context_v2_internal",
  "quote_customer_booking_v2_internal",
  "submit_booking_request_v2_internal",
]);

let transport: SupabaseClient | null = null;

function getTransport(): SupabaseClient {
  if (transport) return transport;

  const env = requirePs01RuntimeEnv();
  transport = createClient(env.url, env.anonKey, {
    ...ps01DatabaseOptions(),
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${env.runtimeJwt}` } },
  }) as unknown as SupabaseClient;

  return transport;
}

export function getPs01LineRuntimeClient(): Ps01RuntimeRpcClient {
  return {
    async rpc(name, args) {
      if (!ALLOWED_RPCS.has(name)) {
        return { data: null, error: { message: `PS01 runtime RPC is not allowlisted: ${name}` } };
      }

      const { data, error } = await getTransport().rpc(name, args);
      if (error) {
        return { data: null, error: { message: error.message || "PS01 Data API RPC call failed." } };
      }
      return { data: data ?? null, error: null };
    },
  };
}
