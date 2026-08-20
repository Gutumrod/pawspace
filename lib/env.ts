// Environment variable validation and access helpers

export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

export interface SupabaseAdminEnv extends SupabasePublicEnv {
  serviceRoleKey: string;
}

export function getPublicSupabaseEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function requirePublicSupabaseEnv(): SupabasePublicEnv {
  const env = getPublicSupabaseEnv();
  if (!env) {
    throw new Error(
      "Missing required Supabase public environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }
  return env;
}

export function getAdminSupabaseEnv(): SupabaseAdminEnv | null {
  const publicEnv = getPublicSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!publicEnv || !serviceRoleKey) {
    return null;
  }

  return {
    ...publicEnv,
    serviceRoleKey,
  };
}

export function requireAdminSupabaseEnv(): SupabaseAdminEnv {
  const publicEnv = requirePublicSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Missing required server-only environment variable: SUPABASE_SERVICE_ROLE_KEY must be set on the server."
    );
  }

  return {
    ...publicEnv,
    serviceRoleKey,
  };
}
