import { columnName, hashSheetRow, rowsEqual } from "./google-sheet-records";

export interface SheetValueClient {
  ensureSheet(spreadsheetId: string, sheetName: string): Promise<void>;
  getValues(spreadsheetId: string, range: string): Promise<Array<Array<string | number | boolean | null>>>;
  updateValues(spreadsheetId: string, range: string, values: Array<Array<string | number | boolean | null>>): Promise<void>;
  clearValues(spreadsheetId: string, range: string): Promise<void>;
}

async function loadCanonicalRows(
  api: SheetValueClient,
  spreadsheetId: string,
  sheetName: string,
  headers: readonly string[],
) {
  const lastColumn = columnName(headers.length);
  await api.ensureSheet(spreadsheetId, sheetName);
  const header = await api.getValues(spreadsheetId, `${sheetName}!A1:${lastColumn}1`);
  if (!header[0] || !rowsEqual(header[0], headers)) {
    await api.updateValues(spreadsheetId, `${sheetName}!A1:${lastColumn}1`, [Array.from(headers)]);
  }
  const rows = await api.getValues(spreadsheetId, `${sheetName}!A:${lastColumn}`);
  return { rows, lastColumn };
}

export async function upsertCanonicalRow(
  api: SheetValueClient,
  spreadsheetId: string,
  sheetName: string,
  headers: readonly string[],
  row: Array<string | number | boolean>,
): Promise<string> {
  if (row.length !== headers.length || !String(row[0] ?? "").trim()) {
    throw new Error("INVALID_CANONICAL_SHEET_ROW");
  }

  const recordId = String(row[0]);
  const { rows, lastColumn } = await loadCanonicalRows(api, spreadsheetId, sheetName, headers);
  const existingIndex = rows.findIndex((candidate, index) => index > 0 && String(candidate[0] ?? "") === recordId);
  const blankIndex = rows.findIndex((candidate, index) => index > 0 && !String(candidate[0] ?? "").trim());
  const rowNumber = existingIndex >= 0
    ? existingIndex + 1
    : blankIndex >= 0
      ? blankIndex + 1
      : Math.max(2, rows.length + 1);

  await api.updateValues(spreadsheetId, `${sheetName}!A${rowNumber}:${lastColumn}${rowNumber}`, [row]);
  return hashSheetRow(row);
}

export async function deleteCanonicalRow(
  api: SheetValueClient,
  spreadsheetId: string,
  sheetName: string,
  headers: readonly string[],
  recordId: string,
): Promise<void> {
  const { rows, lastColumn } = await loadCanonicalRows(api, spreadsheetId, sheetName, headers);
  const existingIndex = rows.findIndex((candidate, index) => index > 0 && String(candidate[0] ?? "") === recordId);
  if (existingIndex < 0) return;

  const rowNumber = existingIndex + 1;
  await api.clearValues(spreadsheetId, `${sheetName}!A${rowNumber}:${lastColumn}${rowNumber}`);
}
