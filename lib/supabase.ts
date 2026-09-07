import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ps01DatabaseOptions } from "./ps01-schema";

let browserClient: SupabaseClient | null = null;

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseBrowserClient() {
  if (!hasSupabaseConfig()) return null;
  if (browserClient) return browserClient;

  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { ...ps01DatabaseOptions(), auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
  ) as unknown as SupabaseClient;
  return browserClient;
}

export async function getCurrentUser() {
  const client = getSupabaseBrowserClient();
  if (!client) return { user: null, error: null, configured: false };
  const { data, error } = await client.auth.getUser();
  return { user: data.user, error, configured: true };
}
