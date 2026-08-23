"use server";

import { revalidatePath } from "next/cache";
import { requireManagerOrOwnerContext } from "@/lib/tenant-context";
import {
  previewCustomerPetCsv,
  executeCustomerPetImport,
  type ImportPreviewSummary,
  type ImportExecutionResult,
} from "@/lib/csv-import-service";
import {
  evaluatePilotReadiness,
  type PilotReadinessEvaluation,
} from "@/lib/pilot-readiness-service";
import { logger } from "@/lib/logger";

function refreshPaths() {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
}

export interface PreviewCsvActionResult {
  success: boolean;
  preview?: ImportPreviewSummary;
  error?: string;
}

export interface ExecuteCsvActionResult {
  success: boolean;
  result?: ImportExecutionResult;
  error?: string;
}

export interface PilotReadinessActionResult {
  success: boolean;
  evaluation?: PilotReadinessEvaluation;
  error?: string;
}

/**
 * Parses and validates CSV rows for preview.
 * Strictly read-only: Zero database mutations.
 */
export async function previewCsvImportAction(csvString: string): Promise<PreviewCsvActionResult> {
  try {
    const { client, staff } = await requireManagerOrOwnerContext();
    if (!csvString || !csvString.trim()) {
      return { success: false, error: "CSV content is empty." };
    }

    const preview = await previewCustomerPetCsv(client, staff.shopId, csvString);
    return { success: true, preview };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to preview CSV";
    logger.warn("previewCsvImportAction error", { error: message });
    return { success: false, error: message };
  }
}

/**
 * Authoritatively executes the CSV import for customers and pets.
 */
export async function executeCsvImportAction(csvString: string): Promise<ExecuteCsvActionResult> {
  try {
    const { client, staff } = await requireManagerOrOwnerContext();
    if (!csvString || !csvString.trim()) {
      return { success: false, error: "CSV content is empty." };
    }

    // Re-verify preview state server-side
    const preview = await previewCustomerPetCsv(client, staff.shopId, csvString);
    if (preview.validRows === 0) {
      return { success: false, error: "No valid rows found to import." };
    }

    const result = await executeCustomerPetImport(client, staff.shopId, preview);
    refreshPaths();

    logger.info("CSV import executed successfully", {
      shopId: staff.shopId,
      createdCustomers: result.createdCustomers,
      createdPets: result.createdPets,
      skippedDuplicates: result.skippedDuplicates,
    });

    return { success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to execute CSV import";
    logger.error("executeCsvImportAction error", { error: message });
    return { success: false, error: message };
  }
}

/**
 * Evaluates the current shop's Closed Beta / Pilot readiness checklist.
 */
export async function getPilotReadinessAction(): Promise<PilotReadinessActionResult> {
  try {
    const { client } = await requireManagerOrOwnerContext();
    const evaluation = await evaluatePilotReadiness(client);
    return { success: true, evaluation };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to evaluate pilot readiness";
    logger.warn("getPilotReadinessAction error", { error: message });
    return { success: false, error: message };
  }
}

/**
 * Updates shop profile defaults (name, phone, line_oa_id).
 */
export async function updateShopProfileAction(input: {
  name: string;
  phone?: string;
  lineOaId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { client } = await requireManagerOrOwnerContext();
    const name = input.name?.trim();
    if (!name) {
      return { success: false, error: "Shop name cannot be empty." };
    }

    const { error } = await client.rpc("update_shop_profile", {
      p_name: name,
      p_phone: input.phone?.trim() || null,
      p_line_oa_id: input.lineOaId?.trim() || null,
    });

    if (error) {
      logger.warn("update_shop_profile RPC failed", { error: error.message });
      return { success: false, error: error.message };
    }

    refreshPaths();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update shop profile";
    return { success: false, error: message };
  }
}
