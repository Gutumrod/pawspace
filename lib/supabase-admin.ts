import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAdminSupabaseEnv } from "./env";
import { ps01DatabaseOptions } from "./ps01-schema";

let adminClient: SupabaseClient | null = null;

/**
 * Returns a server-only Supabase client authenticated with the service role key.
 * This client bypasses RLS and should ONLY be used for trusted administrative operations
 * (such as Auth Admin API user management).
 *
 * NEVER expose this client or the service role key to the browser.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const env = requireAdminSupabaseEnv();

  adminClient = createClient(env.url, env.serviceRoleKey, {
    ...ps01DatabaseOptions(),
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as SupabaseClient;

  return adminClient;
}
