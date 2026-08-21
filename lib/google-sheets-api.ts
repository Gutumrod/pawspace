import "server-only";
import { GoogleAuth } from "google-auth-library";
import { requireGoogleServiceAccountCredentials } from "./env";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const REQUEST_TIMEOUT_MS = 10_000;

export class GoogleSheetsApiError extends Error {
  constructor(
    readonly status: number | undefined,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GoogleSheetsApiError";
  }
}

export type SheetValues = Array<Array<string | number | boolean | null>>;

export interface GoogleSheetsApi {
  getCell(spreadsheetId: string, range: string): Promise<string | null>;
  ensureSheet(spreadsheetId: string, sheetName: string): Promise<void>;
  getValues(spreadsheetId: string, range: string): Promise<SheetValues>;
  updateValues(spreadsheetId: string, range: string, values: SheetValues): Promise<void>;
  clearValues(spreadsheetId: string, range: string): Promise<void>;
}

function assertSpreadsheetId(spreadsheetId: string) {
  const value = spreadsheetId.trim();
  if (!value || value.length > 255 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new GoogleSheetsApiError(undefined, "INVALID_SHEET_ID", "Invalid Google Sheet ID.");
  }
  return value;
}

async function getAccessToken(): Promise<string> {
  const credentials = requireGoogleServiceAccountCredentials();
  const auth = new GoogleAuth({ credentials, scopes: [SHEETS_SCOPE] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const value = typeof token === "string" ? token : token?.token;
  if (!value) {
    throw new GoogleSheetsApiError(undefined, "AUTH_FAILED", "Google service account authentication failed.");
  }
  return value;
}

async function googleFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new GoogleSheetsApiError(
      undefined,
      timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      timedOut ? "Google Sheets API request timed out." : "Google Sheets API request failed.",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function requireOk(response: Response): Promise<Response> {
  if (response.ok) return response;
  throw new GoogleSheetsApiError(
    response.status,
    response.status === 403 ? "FORBIDDEN" : response.status === 404 ? "NOT_FOUND" : "UPSTREAM_ERROR",
    `Google Sheets API request failed with HTTP ${response.status}.`,
  );
}

function valueUrl(spreadsheetId: string, range: string) {
  const id = assertSpreadsheetId(spreadsheetId);
  return `${SHEETS_API_BASE}/${id}/values/${encodeURIComponent(range)}`;
}

export function createGoogleSheetsApi(): GoogleSheetsApi {
  return {
    async getCell(spreadsheetId, range) {
      const response = await requireOk(await googleFetch(`${valueUrl(spreadsheetId, range)}?majorDimension=ROWS`));
      const body = await response.json() as { values?: unknown[][] };
      const value = body.values?.[0]?.[0];
      return value === undefined || value === null ? null : String(value).trim();
    },

    async ensureSheet(spreadsheetId, sheetName) {
      const id = assertSpreadsheetId(spreadsheetId);
      const meta = await requireOk(await googleFetch(`${SHEETS_API_BASE}/${id}?fields=sheets.properties.title`));
      const body = await meta.json() as { sheets?: Array<{ properties?: { title?: string } }> };
      const exists = body.sheets?.some((sheet) => sheet.properties?.title === sheetName) ?? false;
      if (exists) return;

      const create = await googleFetch(`${SHEETS_API_BASE}/${id}:batchUpdate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
      });
      await requireOk(create);
    },

    async getValues(spreadsheetId, range) {
      const response = await requireOk(await googleFetch(`${valueUrl(spreadsheetId, range)}?majorDimension=ROWS`));
      const body = await response.json() as { values?: SheetValues };
      return body.values ?? [];
    },

    async updateValues(spreadsheetId, range, values) {
      const response = await googleFetch(`${valueUrl(spreadsheetId, range)}?valueInputOption=RAW`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ majorDimension: "ROWS", values }),
      });
      await requireOk(response);
    },

    async clearValues(spreadsheetId, range) {
      const response = await googleFetch(`${valueUrl(spreadsheetId, range)}:clear`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      await requireOk(response);
    },
  };
}
