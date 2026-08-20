export type IntegrationState = "configured" | "missing_config";

export type IntegrationResult = {
  ok: boolean;
  state: IntegrationState;
  message: string;
  externalId?: string;
};

export type DailyReportPayload = {
  shopId: string;
  bookingId: string;
  petName: string;
  ownerName: string;
  message: string;
  photoUrls: string[];
};

export type SheetSyncPayload = {
  shopId: string;
  recordId: string;
  entityType: "customer" | "booking";
  values: Record<string, string | number | null>;
};

function hasLineConfig() {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_TARGET_ID);
}

function hasSheetsConfig() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_SHEET_ID);
}

export function getIntegrationStatus() {
  return {
    line: hasLineConfig() ? "configured" : "missing_config" as IntegrationState,
    sheets: hasSheetsConfig() ? "configured" : "missing_config" as IntegrationState,
  };
}

export async function sendDailyReport(payload: DailyReportPayload): Promise<IntegrationResult> {
  if (!hasLineConfig()) {
    return { ok: false, state: "missing_config", message: "LINE adapter is disabled until server-side credentials are configured." };
  }

  void payload;
  return { ok: false, state: "configured", message: "LINE transport is intentionally not called from the preview adapter." };
}

export async function enqueueSheetSync(payload: SheetSyncPayload): Promise<IntegrationResult> {
  if (!hasSheetsConfig()) {
    return { ok: false, state: "missing_config", message: "Google Sheets adapter is disabled until server-side credentials are configured." };
  }

  void payload;
  return { ok: false, state: "configured", message: "Sheets transport is intentionally not called from the preview adapter." };
}

export function buildLineFlexSummary(payload: DailyReportPayload) {
  return {
    type: "flex",
    altText: `อัปเดตจาก PawSpace · ${payload.petName}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "อัปเดตจาก PawSpace", weight: "bold", size: "lg" },
          { type: "text", text: payload.petName, weight: "bold", size: "xl", margin: "md" },
          { type: "text", text: payload.message, wrap: true, margin: "md" },
        ],
      },
    },
  };
}

export function buildSheetRecord(payload: SheetSyncPayload) {
  return {
    recordId: payload.recordId,
    entityType: payload.entityType,
    values: payload.values,
    idempotencyKey: `${payload.shopId}:${payload.entityType}:${payload.recordId}`,
  };
}
