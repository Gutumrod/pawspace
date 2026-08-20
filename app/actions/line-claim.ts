"use server";

import { requireTenantContext } from "@/lib/tenant-context";
import { logger } from "@/lib/logger";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface GenerateLineClaimResult {
  success: boolean;
  data?: {
    claimToken: string;
    shopId: string;
    expiresInHours: 48;
  };
  error?: string;
}

export interface ResetLineLinkResult {
  success: boolean;
  error?: string;
}

export async function generateLineClaimTokenAction(ownerId: string): Promise<GenerateLineClaimResult> {
  if (!UUID_RE.test(ownerId)) {
    return { success: false, error: "Invalid owner ID." };
  }

  try {
    const { staff, client } = await requireTenantContext();
    const { data, error } = await client.rpc("generate_line_claim_token", {
      p_owner_id: ownerId,
    });

    if (error || typeof data !== "string") {
      logger.warn("LINE claim token generation rejected", {
        ownerId,
        shopId: staff.shopId,
        error: error?.message || "Missing claim token result",
      });
      return { success: false, error: error?.message || "Unable to generate LINE claim token." };
    }

    logger.info("LINE claim token generated", {
      ownerId,
      shopId: staff.shopId,
      role: staff.role,
    });

    return {
      success: true,
      data: { claimToken: data, shopId: staff.shopId, expiresInHours: 48 },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    logger.warn("LINE claim token generation failed before RPC", { ownerId, error: message });
    return { success: false, error: message };
  }
}

export async function resetLineLinkAction(ownerId: string): Promise<ResetLineLinkResult> {
  if (!UUID_RE.test(ownerId)) {
    return { success: false, error: "Invalid owner ID." };
  }

  try {
    const { staff, client } = await requireTenantContext();
    if (staff.role === "staff") {
      return { success: false, error: "Forbidden: Owner or manager role required." };
    }

    const { error } = await client.rpc("reset_line_link", { p_owner_id: ownerId });
    if (error) {
      logger.warn("LINE link reset rejected", {
        ownerId,
        shopId: staff.shopId,
        role: staff.role,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.info("LINE link reset", {
      ownerId,
      shopId: staff.shopId,
      role: staff.role,
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    logger.warn("LINE link reset failed before RPC", { ownerId, error: message });
    return { success: false, error: message };
  }
}
