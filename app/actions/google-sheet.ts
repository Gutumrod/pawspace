"use server";

import { requireManagerOrOwnerContext } from "@/lib/tenant-context";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createGoogleSheetsApi } from "@/lib/google-sheets-api";
import { bindVerifiedGoogleSheet, type SheetBindResult } from "@/lib/google-sheet-binding-core";
import { logger } from "@/lib/logger";

export type SheetClaimResult =
  | { success: true; token: string; expiresInSeconds: 900 }
  | { success: false; error: string };

export async function generateGoogleSheetClaimAction(): Promise<SheetClaimResult> {
  try {
    const { staff, client } = await requireManagerOrOwnerContext();
    const { data, error } = await client.rpc("generate_google_sheet_claim_token");
    if (error || typeof data !== "string" || !data) {
      logger.warn("Google Sheet claim generation rejected", { shopId: staff.shopId, error: error?.message });
      return { success: false, error: "Could not generate Google Sheet verification token." };
    }
    return { success: true, token: data, expiresInSeconds: 900 };
  } catch (error) {
    logger.warn("Google Sheet claim generation denied", { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: "Owner or manager access is required." };
  }
}

export async function bindGoogleSheetAction(sheetId: string): Promise<SheetBindResult> {
  try {
    const { staff } = await requireManagerOrOwnerContext();
    const result = await bindVerifiedGoogleSheet(
      getSupabaseAdminClient(),
      createGoogleSheetsApi(),
      staff.shopId,
      sheetId,
    );
    if (!result.success) {
      logger.warn("Google Sheet binding rejected", { shopId: staff.shopId, code: result.code });
    }
    return result;
  } catch (error) {
    logger.error("Google Sheet binding server failure", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, code: "GOOGLE_UNAVAILABLE" };
  }
}

export async function disconnectGoogleSheetAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const { staff, client } = await requireManagerOrOwnerContext();
    const { error } = await client.rpc("disconnect_google_sheet");
    if (error) {
      logger.warn("Google Sheet disconnect rejected", { shopId: staff.shopId, error: error.message });
      return { success: false, error: "Could not disconnect Google Sheet." };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Owner or manager access is required." };
  }
}
