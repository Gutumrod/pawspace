import type { SupabaseClient } from "@supabase/supabase-js";

export interface SheetProofReader {
  getCell(spreadsheetId: string, range: string): Promise<string | null>;
}

export type SheetBindResult =
  | { success: true }
  | { success: false; code: "INVALID_SHEET_ID" | "PROOF_MISSING" | "CLAIM_REJECTED" | "SHEET_IN_USE" | "GOOGLE_UNAVAILABLE" };

function validSheetId(value: string): boolean {
  return Boolean(value && value.length <= 255 && /^[A-Za-z0-9_-]+$/.test(value));
}

export async function bindVerifiedGoogleSheet(
  admin: SupabaseClient,
  reader: SheetProofReader,
  expectedShopId: string,
  rawSheetId: string,
): Promise<SheetBindResult> {
  const sheetId = rawSheetId?.trim();
  if (!validSheetId(sheetId)) return { success: false, code: "INVALID_SHEET_ID" };

  let token: string | null;
  try {
    token = await reader.getCell(sheetId, "PawSpace_Config!B1");
  } catch {
    return { success: false, code: "GOOGLE_UNAVAILABLE" };
  }
  if (!token) return { success: false, code: "PROOF_MISSING" };

  const { error } = await admin.rpc("connect_google_sheet_internal", {
    p_token: token,
    p_google_sheet_id: sheetId,
    p_expected_shop_id: expectedShopId,
  });
  if (!error) return { success: true };
  if (error.code === "23505") return { success: false, code: "SHEET_IN_USE" };
  return { success: false, code: "CLAIM_REJECTED" };
}
