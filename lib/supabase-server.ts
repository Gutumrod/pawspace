import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requirePublicSupabaseEnv } from "./env";

export const PAWSPACE_ACCESS_TOKEN_COOKIE = "pawspace_access_token";
export const PAWSPACE_REFRESH_TOKEN_COOKIE = "pawspace_refresh_token";

/**
 * Creates a server-side Supabase client using public credentials (URL + anon key).
 * If an access token is provided, requests made through this client will carry
 * the user's JWT Authorization header, ensuring Postgres RLS and auth.uid()
 * operate in the context of that specific user.
 */
export function getSupabaseServerClient(accessToken?: string): SupabaseClient {
  const env = requirePublicSupabaseEnv();

  return createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

export interface ServerSessionResult {
  client: SupabaseClient;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
}

/**
 * Resolves the authenticated Supabase client and User for the current incoming request
 * by inspecting HTTP cookies.
 */
export async function getSupabaseServerSessionClient(): Promise<ServerSessionResult> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(PAWSPACE_ACCESS_TOKEN_COOKIE)?.value || null;
  const refreshToken = cookieStore.get(PAWSPACE_REFRESH_TOKEN_COOKIE)?.value || null;

  if (!accessToken) {
    return {
      client: getSupabaseServerClient(),
      accessToken: null,
      refreshToken: null,
      user: null,
    };
  }

  const client = getSupabaseServerClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user) {
    return {
      client: getSupabaseServerClient(),
      accessToken: null,
      refreshToken: null,
      user: null,
    };
  }

  return {
    client,
    accessToken,
    refreshToken,
    user: data.user,
  };
}
