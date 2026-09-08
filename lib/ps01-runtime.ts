import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requirePs01RuntimeEnv } from "./env";
import { ps01DatabaseOptions } from "./ps01-schema";

let runtimeClient: SupabaseClient | null = null;

/**
 * Product-scoped server data-plane client for PS01 internal RPCs.
 * The JWT must carry role=ps01_runtime and must be provisioned outside the app.
 * It is intentionally separate from the project-wide service_role credential.
 */
export function getPs01RuntimeClient(): SupabaseClient {
  if (runtimeClient) return runtimeClient;

  const env = requirePs01RuntimeEnv();
  runtimeClient = createClient(env.url, env.anonKey, {
    ...ps01DatabaseOptions(),
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${env.runtimeJwt}` } },
  }) as unknown as SupabaseClient;

  return runtimeClient;
}
