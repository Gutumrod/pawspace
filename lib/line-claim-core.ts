import { type SupabaseClient } from "@supabase/supabase-js";
import { verifyLineIdToken } from "./line-id-token";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLAIM_TOKEN_RE = /^[0-9a-f]{64}$/i;

export interface LineClaimInput {
  claimToken: string;
  idToken: string;
  expectedShopId: string;
}

export type LineClaimResult =
  | { success: true; ownerId: string }
  | { success: false; code: "INVALID_REQUEST" | "LINE_IDENTITY_INVALID" | "LINE_UNAVAILABLE" | "CLAIM_REJECTED" };
export function validateLineClaimInput(input: LineClaimInput): boolean {
  return (
    CLAIM_TOKEN_RE.test(input.claimToken?.trim() || "") &&
    UUID_RE.test(input.expectedShopId?.trim() || "") &&
    Boolean(input.idToken?.trim())
  );
}

export async function verifyAndConsumeLineClaim(
  adminClient: SupabaseClient,
  channelId: string,
  input: LineClaimInput,
  fetchImpl: typeof fetch = fetch,
): Promise<LineClaimResult> {
  if (!validateLineClaimInput(input)) {
    return { success: false, code: "INVALID_REQUEST" };
  }

  const verified = await verifyLineIdToken(input.idToken, channelId, fetchImpl);
  if (!verified.success) {
    return {
      success: false,
      code: verified.code === "LINE_UNAVAILABLE" ? "LINE_UNAVAILABLE" : "LINE_IDENTITY_INVALID",
    };
  }
  const { data, error } = await adminClient.rpc("consume_line_claim_token_internal", {
    p_token: input.claimToken.trim(),
    p_verified_line_user_id: verified.identity.userId,
    p_expected_shop_id: input.expectedShopId.trim(),
  });

  if (error || typeof data !== "string") {
    return { success: false, code: "CLAIM_REJECTED" };
  }

  return { success: true, ownerId: data };
}
