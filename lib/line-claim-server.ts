import "server-only";
import { getSupabaseAdminClient } from "./supabase-admin";
import { requireLineLoginEnv } from "./env";
import { verifyAndConsumeLineClaim, type LineClaimInput, type LineClaimResult } from "./line-claim-core";
import { logger } from "./logger";

export async function verifyAndConsumeLineClaimServer(input: LineClaimInput): Promise<LineClaimResult> {
  try {
    const { channelId } = requireLineLoginEnv();
    const adminClient = getSupabaseAdminClient();
    const result = await verifyAndConsumeLineClaim(adminClient, channelId, input);

    if (!result.success) {
      logger.warn("LINE claim rejected", {
        code: result.code,
        expectedShopId: input.expectedShopId,
      });
    }

    return result;
  } catch (error) {
    logger.error("LINE claim server failure", {
      error: error instanceof Error ? error.message : String(error),
      expectedShopId: input.expectedShopId,
    });
    return { success: false, code: "LINE_UNAVAILABLE" };
  }
}
