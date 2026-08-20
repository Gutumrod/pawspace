import "server-only";
import { cookies } from "next/headers";
import { type User } from "@supabase/supabase-js";
import { getSupabaseServerClient, getSupabaseServerSessionClient, PAWSPACE_ACCESS_TOKEN_COOKIE, PAWSPACE_REFRESH_TOKEN_COOKIE } from "./supabase-server";
import { getStaffContext, type StaffContext } from "./tenant-context";
import { logger } from "./logger";

export interface AuthResult {
  success: boolean;
  user?: User;
  staff?: StaffContext | null;
  error?: string;
}

export async function setSessionCookies(
  accessToken: string,
  refreshToken: string,
  expiresInSeconds = 60 * 60 * 24 * 7 // 7 days default
): Promise<void> {
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";

  cookieStore.set(PAWSPACE_ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: expiresInSeconds,
  });

  cookieStore.set(PAWSPACE_REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PAWSPACE_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(PAWSPACE_REFRESH_TOKEN_COOKIE);
}

/**
 * Authenticates staff using email and password via Supabase Auth.
 * Automatically sets session cookies on success and resolves tenant context.
 */
export async function loginWithPassword(email: string, password: string): Promise<AuthResult> {
  const trimmedEmail = email?.trim();
  if (!trimmedEmail || !password) {
    return {
      success: false,
      error: "Email and password are required.",
    };
  }

  try {
    const client = getSupabaseServerClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error || !data.session || !data.user) {
      logger.warn("Staff login attempt rejected", {
        email: trimmedEmail,
        error: error?.message || "Invalid credentials",
      });
      return {
        success: false,
        error: error?.message || "Invalid email or password.",
      };
    }

    const authenticatedClient = getSupabaseServerClient(data.session.access_token);
    const staff = await getStaffContext(authenticatedClient);

    if (!staff || !staff.isActive) {
      // Auth succeeded but this account has no active PawSpace staff membership.
      // Do not establish a PawSpace session for it - sign out the Supabase Auth
      // session we just created so no dangling refresh token survives the rejection.
      await client.auth.signOut();
      logger.warn("Staff login rejected: no active staff membership", {
        userId: data.user.id,
        email: trimmedEmail,
      });
      return {
        success: false,
        error: "This account is not an active staff member of any shop.",
      };
    }

    await setSessionCookies(
      data.session.access_token,
      data.session.refresh_token,
      data.session.expires_in
    );

    logger.info("Staff login successful", {
      userId: data.user.id,
      email: trimmedEmail,
      shopId: staff.shopId,
      role: staff.role,
      isActive: staff.isActive,
    });

    return {
      success: true,
      user: data.user,
      staff,
    };
  } catch (err) {
    logger.error("Unhandled error during staff login", {
      email: trimmedEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: "An unexpected error occurred during login.",
    };
  }
}

/**
 * Signs out the current staff user, invalidates the server session, and clears cookies.
 */
export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, user } = await getSupabaseServerSessionClient();

    if (user) {
      await client.auth.signOut();
      logger.info("Staff logged out", { userId: user.id });
    }

    await clearSessionCookies();
    return { success: true };
  } catch (err) {
    logger.error("Unhandled error during staff logout", {
      error: err instanceof Error ? err.message : String(err),
    });
    await clearSessionCookies();
    return { success: true };
  }
}

/**
 * Resolves the authenticated user and active staff context for the current request.
 */
export async function getCurrentSession(): Promise<{
  user: User | null;
  staff: StaffContext | null;
}> {
  const { client, user } = await getSupabaseServerSessionClient();
  if (!user) {
    return { user: null, staff: null };
  }

  const staff = await getStaffContext(client);
  return { user, staff };
}
