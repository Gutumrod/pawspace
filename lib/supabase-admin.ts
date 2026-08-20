import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAdminSupabaseEnv } from "./env";

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
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
