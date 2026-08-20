"use server";

import { getSupabaseServerSessionClient } from "@/lib/supabase-server";
import { getStaffContext } from "@/lib/tenant-context";
import { logger } from "@/lib/logger";

export interface BootstrapShopInput {
  name: string;
  slug: string;
  phone?: string;
  lineOaId?: string;
}

export interface BootstrapShopResult {
  success: boolean;
  shopId?: string;
  error?: string;
}

/**
 * Trusted server action for initial shop bootstrap.
 * Creates a new Shop and assigns the authenticated caller as the active Owner atomically.
 *
 * Enforces V1 invariant: 1 Auth user = 1 Shop membership.
 */
export async function bootstrapShopAction(input: BootstrapShopInput): Promise<BootstrapShopResult> {
  const { client, user } = await getSupabaseServerSessionClient();

  if (!user) {
    logger.warn("Unauthorized attempt to bootstrap shop without valid session");
    return {
      success: false,
      error: "Unauthorized: You must be logged in to create a shop.",
    };
  }

  const name = input.name?.trim();
  const slug = input.slug?.trim().toLowerCase();

  if (!name) {
    return { success: false, error: "Shop name is required." };
  }

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return {
      success: false,
      error: "Shop slug is invalid. Use only lowercase letters, numbers, and hyphens.",
    };
  }

  // Pre-check if caller already belongs to a shop
  const existingStaff = await getStaffContext(client);
  if (existingStaff) {
    logger.warn("Caller attempted bootstrap but already belongs to a shop", {
      userId: user.id,
      shopId: existingStaff.shopId,
    });
    return {
      success: false,
      error: "Bootstrap Rejected: Caller already belongs to a shop.",
    };
  }

  try {
    const { data, error } = await client.rpc("bootstrap_shop", {
      p_name: name,
      p_slug: slug,
      p_phone: input.phone?.trim() || null,
      p_line_oa_id: input.lineOaId?.trim() || null,
    });

    if (error) {
      logger.error("bootstrap_shop RPC failed", {
        userId: user.id,
        slug,
        error: error.message,
      });
      return {
        success: false,
        error: error.message || "Failed to bootstrap shop.",
      };
    }

    const shopId = data as string;

    logger.info("Shop bootstrapped successfully", {
      userId: user.id,
      shopId,
      slug,
      name,
    });

    return {
      success: true,
      shopId,
    };
  } catch (err) {
    logger.error("Unexpected error during shop bootstrap", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: "An unexpected server error occurred during shop bootstrap.",
    };
  }
}
