"use server";

import { retryDailyReportDelivery } from "@/lib/daily-report-service";
import { requireTenantContext } from "@/lib/tenant-context";
import { logger } from "@/lib/logger";

export async function retryDailyReportDeliveryAction(reportId: string) {
  try {
    const { staff, client } = await requireTenantContext();
    return retryDailyReportDelivery(client, {
      userId: staff.userId,
      shopId: staff.shopId,
      role: staff.role,
    }, reportId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    logger.warn("Daily report retry rejected before RPC", {
      reportId,
      error: message,
    });
    return { success: false as const, error: message };
  }
}
