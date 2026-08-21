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

export interface LineLoginEnv {
  channelId: string;
}

export function getLineLoginEnv(): LineLoginEnv | null {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) return null;
  return { channelId };
}

export function requireLineLoginEnv(): LineLoginEnv {
  const env = getLineLoginEnv();
  if (!env) {
    throw new Error("Missing required server-only environment variable: LINE_LOGIN_CHANNEL_ID must be set.");
  }
  return env;
}

export function getLineChannelAccessTokenForShop(shopId: string): string | null {
  const raw = process.env.LINE_CHANNEL_ACCESS_TOKENS_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const token = parsed[shopId];
    return typeof token === "string" && token.trim() ? token.trim() : null;
  } catch {
    throw new Error("LINE_CHANNEL_ACCESS_TOKENS_JSON must be valid JSON keyed by shop UUID.");
  }
}

export function requireLineDispatchSecret(): string {
  const value = process.env.LINE_DISPATCH_SECRET?.trim();
  if (!value) {
    throw new Error("Missing required server-only environment variable: LINE_DISPATCH_SECRET must be set.");
  }
  return value;
}

export interface GoogleServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
  private_key_id?: string;
  token_uri?: string;
}

export function requireGoogleServiceAccountCredentials(): GoogleServiceAccountCredentials {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Missing required server-only environment variable: GOOGLE_SERVICE_ACCOUNT_JSON must be set.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must contain a service account credential object.");
  }

  const value = parsed as Record<string, unknown>;
  const clientEmail = typeof value.client_email === "string" ? value.client_email.trim() : "";
  const privateKey = typeof value.private_key === "string" ? value.private_key : "";
  if (!clientEmail || !privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing valid client_email/private_key fields.");
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
    project_id: typeof value.project_id === "string" ? value.project_id : undefined,
    private_key_id: typeof value.private_key_id === "string" ? value.private_key_id : undefined,
    token_uri: typeof value.token_uri === "string" ? value.token_uri : undefined,
  };
}

export function requireGoogleSyncDispatchSecret(): string {
  const value = process.env.GOOGLE_SYNC_DISPATCH_SECRET?.trim();
  if (!value) {
    throw new Error("Missing required server-only environment variable: GOOGLE_SYNC_DISPATCH_SECRET must be set.");
  }
  return value;
}
