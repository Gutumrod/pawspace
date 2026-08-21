import "server-only";
import { type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerSessionClient } from "./supabase-server";
import { logger } from "./logger";

export type StaffRole = "owner" | "manager" | "staff";

export interface StaffContext {
  userId: string;
  shopId: string;
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  shopName: string;
  shopSlug: string;
  subscriptionStatus: string;
}

interface RawStaffContextResponse {
  user_id?: string;
  shop_id?: string;
  email?: string;
  name?: string;
  role?: string;
  is_active?: boolean;
  shop_name?: string;
  shop_slug?: string;
  subscription_status?: string;
}

/**
 * Resolves the staff tenant context for a given authenticated client by executing
 * the authoritative `get_current_staff_context()` RPC.
 *
 * Returns null if:
 * 1. The caller is not authenticated.
 * 2. The caller has no staff membership in any shop.
 * 3. The caller's staff membership is deactivated (`is_active = FALSE`).
 */
export async function getStaffContext(authenticatedClient: SupabaseClient): Promise<StaffContext | null> {
  try {
    const { data, error } = await authenticatedClient.rpc("get_current_staff_context");

    if (error) {
      logger.warn("Failed to retrieve staff context from RPC", { error: error.message });
      return null;
    }

    if (!data || typeof data !== "object") {
      return null;
    }

    const raw = data as RawStaffContextResponse;

    if (!raw.user_id || !raw.shop_id || !raw.role || raw.is_active !== true) {
      return null;
    }

    const role = raw.role as StaffRole;
    if (role !== "owner" && role !== "manager" && role !== "staff") {
      logger.error("Unknown staff role encountered in context", { role: raw.role });
      return null;
    }

    return {
      userId: raw.user_id,
      shopId: raw.shop_id,
      email: raw.email || "",
      name: raw.name || "",
      role,
      isActive: Boolean(raw.is_active),
      shopName: raw.shop_name || "",
      shopSlug: raw.shop_slug || "",
      subscriptionStatus: raw.subscription_status || "trial",
    };
  } catch (err) {
    logger.error("Unexpected error in getStaffContext", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Resolves the active staff tenant context for the current incoming server request.
 */
export async function getCurrentStaffContext(): Promise<StaffContext | null> {
  const { client, user } = await getSupabaseServerSessionClient();
  if (!user) {
    return null;
  }
  return getStaffContext(client);
}

/**
 * Asserts that the current incoming request belongs to an active staff member.
 * Throws an Error if unauthenticated or inactive.
 */
export async function requireTenantContext(): Promise<{ staff: StaffContext; client: SupabaseClient }> {
  const { client, user } = await getSupabaseServerSessionClient();
  if (!user) {
    throw new Error("Unauthorized: Session is not authenticated.");
  }

  const staff = await getStaffContext(client);
  if (!staff || !staff.isActive) {
    throw new Error("Unauthorized: No active staff membership found for current session.");
  }

  return { staff, client };
}

/**
 * Asserts that the current incoming request belongs to an active shop owner.
 * Throws an Error if unauthenticated, inactive, or not an owner.
 */
export async function requireOwnerContext(): Promise<{ staff: StaffContext; client: SupabaseClient }> {
  const { staff, client } = await requireTenantContext();

  if (staff.role !== "owner") {
    throw new Error("Forbidden: Owner role required for this operation.");
  }

  return { staff, client };
}
/**
 * Asserts that the current request belongs to an active shop owner or manager.
 * Used for tenant integration settings that staff must not control.
 */
export async function requireManagerOrOwnerContext(): Promise<{ staff: StaffContext; client: SupabaseClient }> {
  const { staff, client } = await requireTenantContext();

  if (staff.role !== "owner" && staff.role !== "manager") {
    throw new Error("Forbidden: Owner or manager role required for this operation.");
  }

  return { staff, client };
}
