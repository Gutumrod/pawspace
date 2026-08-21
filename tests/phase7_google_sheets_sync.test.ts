import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bindVerifiedGoogleSheet, type SheetProofReader } from "../lib/google-sheet-binding-core";
import {
  BOOKING_HEADERS,
  CUSTOMER_HEADERS,
} from "../lib/google-sheet-records";
import type { SheetValueClient } from "../lib/google-sheet-sync-core";
import { readBookingRecord, readPetCustomerRecord } from "../lib/google-sync-source";
import {
  processGoogleSyncJob,
  runGoogleSyncBatchCore,
  sanitizeGoogleSyncError,
  type GoogleSyncClaim,
} from "../lib/google-sync-worker-core";

function need(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const localUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.API_URL ?? need("NEXT_PUBLIC_SUPABASE_URL");
const localServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? need("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(localUrl, localServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;
function check(ok: boolean, name: string, detail?: string) {
  if (ok) { console.log(`  [PASS] ${name}`); passed += 1; }
  else { console.error(`  [FAIL] ${name}${detail ? ` - ${detail}` : ""}`); failed += 1; }
}
type Cell = string | number | boolean | null;
class FakeSheets implements SheetValueClient {
  readonly books = new Map<string, Map<string, Cell[][]>>();
  readonly touchedSpreadsheetIds: string[] = [];

  private rows(spreadsheetId: string, sheetName: string): Cell[][] {
    let book = this.books.get(spreadsheetId);
    if (!book) { book = new Map(); this.books.set(spreadsheetId, book); }
    let rows = book.get(sheetName);
    if (!rows) { rows = []; book.set(sheetName, rows); }
    return rows;
  }

  async ensureSheet(spreadsheetId: string, sheetName: string) {
    this.touchedSpreadsheetIds.push(spreadsheetId);
    this.rows(spreadsheetId, sheetName);
  }

  async getValues(spreadsheetId: string, range: string): Promise<Cell[][]> {
    const [sheetName, cells] = range.split("!");
    const rows = this.rows(spreadsheetId, sheetName);
    if (/^[A-Z]+1:[A-Z]+1$/.test(cells)) return rows[0] ? [rows[0]] : [];
    return rows.map((row) => [...row]);
  }

  async updateValues(spreadsheetId: string, range: string, values: Cell[][]) {
    const [sheetName, cells] = range.split("!");
    const match = cells.match(/^[A-Z]+(\d+):[A-Z]+\d+$/);
    if (!match) throw new Error(`Unexpected update range ${range}`);
    this.rows(spreadsheetId, sheetName)[Number(match[1]) - 1] = [...values[0]];
  }
  async clearValues(spreadsheetId: string, range: string) {
    const [sheetName, cells] = range.split("!");
    const match = cells.match(/^[A-Z]+(\d+):[A-Z]+\d+$/);
    if (!match) throw new Error(`Unexpected clear range ${range}`);
    this.rows(spreadsheetId, sheetName)[Number(match[1]) - 1] = [];
  }

  data(spreadsheetId: string, sheetName: string) {
    return this.rows(spreadsheetId, sheetName);
  }
}

type Completion = { operation: "UPSERT" | "DELETE"; sheetName: string; hash: string | null };
function job(overrides: Partial<GoogleSyncClaim> & Pick<GoogleSyncClaim, "shop_id" | "entity_id" | "entity_type" | "google_sheet_id">): GoogleSyncClaim {
  return {
    event_id: crypto.randomUUID(),
    queued_operation: "UPSERT",
    attempts: 1,
    ...overrides,
  };
}

async function run() {
  console.log("=== PawSpace Phase 7 Google Sheets Tests ===\n");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const sheet1 = `sheet-tenant-one-${suffix}`;
  const sheet2 = `sheet-tenant-two-${suffix}`;
  const shop1 = crypto.randomUUID();
  const shop2 = crypto.randomUUID();
  const owner1 = crypto.randomUUID();
  const pet1 = crypto.randomUUID();
  const petDelete = crypto.randomUUID();
  const room1 = crypto.randomUUID();
  const booking1 = crypto.randomUUID();
  const sheets = new FakeSheets();
  const completions: Completion[] = [];
  const deps = {
    api: sheets,
    readPetCustomer: (shopId: string, petId: string) => readPetCustomerRecord(admin, shopId, petId),
    readBooking: (shopId: string, bookingId: string) => readBookingRecord(admin, shopId, bookingId),
    markCompleted: async (_job: GoogleSyncClaim, operation: "UPSERT" | "DELETE", sheetName: string, hash: string | null) => {
      completions.push({ operation, sheetName, hash });
    },
  };

  try {
    const { error: shopError } = await admin.from("shops").insert([
      { id: shop1, name: "Phase 7 Shop 1", slug: `p7-${suffix}`, google_sheet_id: sheet1 },
      { id: shop2, name: "Phase 7 Shop 2", slug: `p7-other-${suffix}`, google_sheet_id: sheet2 },
    ]);
    if (shopError) throw new Error(`shop seed failed: ${shopError.message}`);

    const { error: ownerError } = await admin.from("pet_owners").insert({
      id: owner1, shop_id: shop1, first_name: "Before", last_name: "Owner", phone: "0817000001",
    });
    if (ownerError) throw new Error(`owner seed failed: ${ownerError.message}`);
    const { error: petError } = await admin.from("pets").insert([
      { id: pet1, shop_id: shop1, owner_id: owner1, name: "BeforePet", species: "cat", breed: "Domestic" },
      { id: petDelete, shop_id: shop1, owner_id: owner1, name: "DeleteMe", species: "dog", breed: "Mixed" },
    ]);
    if (petError) throw new Error(`pet seed failed: ${petError.message}`);
    const { error: roomError } = await admin.from("rooms").insert({
      id: room1, shop_id: shop1, room_number: "P7-A1", room_type: "standard", capacity_pets: 2, base_price_per_night: 500,
    });
    if (roomError) throw new Error(`room seed failed: ${roomError.message}`);
    const { error: bookingError } = await admin.from("bookings").insert({
      id: booking1,
      shop_id: shop1,
      owner_id: owner1,
      room_id: room1,
      check_in_date: "2026-09-01",
      check_out_date: "2026-09-02",
      booking_status: "confirmed",
      total_amount: 500,
    });
    if (bookingError) throw new Error(`booking seed failed: ${bookingError.message}`);
    const { error: bookingPetError } = await admin.from("booking_pets").insert({ shop_id: shop1, booking_id: booking1, pet_id: pet1 });
    if (bookingPetError) throw new Error(`booking pet seed failed: ${bookingPetError.message}`);

    const queueId = crypto.randomUUID();
    const { error: queueError } = await admin.from("sync_queue").insert({
      id: queueId, shop_id: shop1, entity_type: "pet_customer", entity_id: pet1, operation: "UPSERT", payload: { stale: true },
    });
    if (queueError) throw new Error(`queue seed failed: ${queueError.message}`);
    const concurrentClaims = await Promise.all([
      admin.rpc("claim_google_sync_event_internal"),
      admin.rpc("claim_google_sync_event_internal"),
    ]);
    const claimedRows = concurrentClaims.flatMap((result) => Array.isArray(result.data) ? result.data : []);
    const targetClaims = claimedRows.filter((row) => (row as Record<string, unknown>).event_id === queueId);
    check(targetClaims.length === 1, "Concurrent worker claims cannot duplicate the same queue event");
    check((targetClaims[0] as Record<string, unknown> | undefined)?.google_sheet_id === sheet1, "Claim resolves tenant routing from shops.google_sheet_id");
    await admin.rpc("mark_google_sync_failed_internal", { p_event_id: queueId, p_error_message: "test cleanup" });

    await admin.from("pets").update({ name: "LatestPet", breed: "LatestBreed" }).eq("id", pet1);
    await admin.from("pet_owners").update({ first_name: "Latest", phone: "0817999999" }).eq("id", owner1);
    await processGoogleSyncJob(job({
      shop_id: shop1,
      entity_id: pet1,
      entity_type: "pet_customer",
      google_sheet_id: sheet1,
      queued_operation: "DELETE",
    }), deps);

    const customerRows = sheets.data(sheet1, "Customers");
    check(customerRows[0]?.join("|") === CUSTOMER_HEADERS.join("|"), "Customers headers are deterministic");
    check(customerRows[1]?.[0] === pet1, "Customer Record_ID equals pet_id");
    check(customerRows[1]?.[1] === "LatestPet" && customerRows[1]?.[11] === "Latest", "Pet UPSERT re-reads latest DB state");
    check(completions.at(-1)?.operation === "UPSERT", "Queued DELETE converges to UPSERT when authoritative Pet exists");
    check(sheets.touchedSpreadsheetIds.every((id) => id === sheet1), "Pet event routes only to claimed tenant Sheet");
    await processGoogleSyncJob(job({
      shop_id: shop1,
      entity_id: petDelete,
      entity_type: "pet_customer",
      google_sheet_id: sheet1,
    }), deps);
    const deleteRowBefore = sheets.data(sheet1, "Customers").find((row) => row[0] === petDelete);
    check(deleteRowBefore?.[0] === petDelete, "Pet slated for deletion is initially exported");
    await admin.from("pets").delete().eq("id", petDelete);
    await processGoogleSyncJob(job({
      shop_id: shop1,
      entity_id: petDelete,
      entity_type: "pet_customer",
      google_sheet_id: sheet1,
      queued_operation: "UPSERT",
    }), deps);
    const deletedRowAfter = sheets.data(sheet1, "Customers").find((row) => row[0] === petDelete);
    check(!deletedRowAfter, "Stale Pet UPSERT after DB delete converges to DELETE");
    check(completions.at(-1)?.operation === "DELETE" && completions.at(-1)?.hash === null, "DELETE completion carries no stale mapping hash");

    await admin.from("bookings").update({ booking_status: "checked_in", total_amount: 725, special_requests: "Latest request" }).eq("id", booking1);
    await processGoogleSyncJob(job({
      shop_id: shop1,
      entity_id: booking1,
      entity_type: "booking",
      google_sheet_id: sheet1,
      queued_operation: "DELETE",
    }), deps);
    const bookingRows = sheets.data(sheet1, "Bookings");
    check(bookingRows[0]?.join("|") === BOOKING_HEADERS.join("|"), "Bookings headers are deterministic");
    check(bookingRows[1]?.[0] === booking1, "Booking Record_ID equals booking_id");
    check(bookingRows[1]?.[8] === "checked_in" && bookingRows[1]?.[9] === 725, "Booking export converges to latest DB state");
    const isolated = await readPetCustomerRecord(admin, shop2, pet1);
    check(isolated === null, "Cross-tenant Pet lookup cannot read another shop record");
    await processGoogleSyncJob(job({
      shop_id: shop2,
      entity_id: pet1,
      entity_type: "pet_customer",
      google_sheet_id: sheet2,
    }), deps);
    check(
      !sheets.data(sheet2, "Customers").some((row) => row[0] === pet1),
      "Cross-tenant event cannot copy another tenant Pet into its Sheet",
    );

    const proofCalls: Array<{ sheetId: string; range: string }> = [];
    const reader: SheetProofReader = {
      async getCell(sheetId, range) {
        proofCalls.push({ sheetId, range });
        return "proof-token-from-b1";
      },
    };
    let rpcArgs: Record<string, unknown> | undefined;
    const fakeAdmin = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        rpcArgs = args;
        return { error: args.p_token === "proof-token-from-b1" ? null : { code: "P0001" } };
      },
    } as unknown as SupabaseClient;
    const bind = await bindVerifiedGoogleSheet(fakeAdmin, reader, shop1, " sheet-proof-id ");
    check(bind.success, "Verified Sheet binding accepts proof read from Google");
    check(proofCalls[0]?.sheetId === "sheet-proof-id" && proofCalls[0]?.range === "PawSpace_Config!B1", "Binding reads exact spreadsheet ID and PawSpace_Config!B1");
    check(rpcArgs?.p_expected_shop_id === shop1 && rpcArgs?.p_google_sheet_id === "sheet-proof-id", "Browser cannot assert tenant; trusted server supplies expected shop");
    const wrongReader: SheetProofReader = { getCell: async () => "wrong-b1-token" };
    const rejectingAdmin = {
      rpc: async (_name: string, args: Record<string, unknown>) => ({
        error: args.p_token === "proof-token-from-b1" ? null : { code: "P0001" },
      }),
    } as unknown as SupabaseClient;
    const wrongProof = await bindVerifiedGoogleSheet(rejectingAdmin, wrongReader, shop1, "sheet-proof-id");
    check(!wrongProof.success && "code" in wrongProof && wrongProof.code === "CLAIM_REJECTED", "Wrong PawSpace_Config!B1 proof is rejected");

    const secret = "PRIVATE_KEY_SHOULD_NEVER_APPEAR";
    const upstream = new Error(secret) as Error & { name: string; code: string; status: number };
    upstream.name = "GoogleSheetsApiError";
    upstream.code = "FORBIDDEN";
    upstream.status = 403;
    const sanitizedUpstream = sanitizeGoogleSyncError(upstream);
    const sanitizedGeneric = sanitizeGoogleSyncError(new Error(`Authorization Bearer ${secret}`));
    check(sanitizedUpstream === "Google Sheets API FORBIDDEN (HTTP 403).", "Google API errors retain only safe code/status");
    check(!sanitizedUpstream.includes(secret) && !sanitizedGeneric.includes(secret) && !sanitizedGeneric.includes("Authorization"), "Worker errors do not expose credentials or upstream secret text");

    let failureTransitionCalls = 0;
    let persistedFailure = "";
    let batchClaims = 0;
    const failureJob = job({ shop_id: shop1, entity_id: pet1, entity_type: "pet_customer", google_sheet_id: sheet1 });
    const failedBatch = await runGoogleSyncBatchCore(1, {
      claimNext: async () => batchClaims++ === 0 ? failureJob : null,
      processJob: async () => { throw upstream; },
      markFailed: async (_job, error) => {
        failureTransitionCalls += 1;
        persistedFailure = sanitizeGoogleSyncError(error);
      },
    });
    check(failedBatch.claimed === 1 && failedBatch.failed === 1 && failedBatch.completed === 0, "Google/API exception is counted as a failed worker event");
    check(failureTransitionCalls === 1 && persistedFailure === "Google Sheets API FORBIDDEN (HTTP 403).", "Google/API exception invokes one sanitized failure transition");
  } finally {
    await admin.from("sync_queue").delete().in("shop_id", [shop1, shop2]);
    await admin.from("google_sync_mappings").delete().in("shop_id", [shop1, shop2]);
    await admin.from("booking_pets").delete().in("shop_id", [shop1, shop2]);
    await admin.from("daily_reports").delete().in("shop_id", [shop1, shop2]);
    await admin.from("bookings").delete().in("shop_id", [shop1, shop2]);
    await admin.from("pets").delete().in("shop_id", [shop1, shop2]);
    await admin.from("rooms").delete().in("shop_id", [shop1, shop2]);
    await admin.from("pet_owners").delete().in("shop_id", [shop1, shop2]);
    const { error: cleanupError } = await admin.from("shops").delete().in("id", [shop1, shop2]);
    if (cleanupError) console.error(`Phase 7 cleanup warning: ${cleanupError.message}`);
  }

  console.log(`\n=== Phase 7 Result: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error("Phase 7 suite crashed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
