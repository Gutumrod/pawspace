import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ps01DatabaseOptions } from "./ps01-schema";

/**
 * Browser-only Supabase client for the invite/reset password link flow.
 * detectSessionInUrl consumes the #access_token hash Supabase Auth appends
 * when redirecting back from /auth/v1/verify. Not used for the app's own
 * session (that stays server-only via httpOnly cookies, see lib/auth.ts).
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createClient(url, anonKey, {
    ...ps01DatabaseOptions(),
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: true },
  }) as unknown as SupabaseClient;
}
