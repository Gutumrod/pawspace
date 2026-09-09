import assert from "node:assert/strict";
import test from "node:test";
import {
  bangkokLocalInputToIso,
  isoToBangkokLocalInput,
} from "../lib/booking-v2-time";
import {
  quoteCustomerBookingV2Core,
  submitBookingRequestV2Core,
  validateLineBookingV2Input,
  type Ps01RuntimeRpcClient,
} from "../lib/line-booking-core";

const SHOP_ID = "11111111-1111-4111-8111-111111111111";
const ROOM_ID = "22222222-2222-4222-8222-222222222222";
const PLAN_ID = "33333333-3333-4333-8333-333333333333";
const PET_ID = "44444444-4444-4444-8444-444444444444";
const CHANNEL_ID = "1234567890";
const LINE_USER_ID = "U0123456789abcdef";

function validInput() {
  return {
    shopId: SHOP_ID,
    roomId: ROOM_ID,
    ratePlanId: PLAN_ID,
    petIds: [PET_ID],
    startAt: "2026-09-09T10:00:00+07:00",
    specialRequests: "  quiet room  ",
    idToken: "line-id-token",
  };
}

function lineVerifyFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), "https://api.line.me/oauth2/v2.1/verify");
    assert.equal(init?.method, "POST");
    const body = init?.body as URLSearchParams;
    assert.equal(body.get("id_token"), "line-id-token");
    assert.equal(body.get("client_id"), CHANNEL_ID);
    return new Response(JSON.stringify({
      iss: "https://access.line.me",
      sub: LINE_USER_ID,
      aud: CHANNEL_ID,
      exp: Math.floor(Date.now() / 1000) + 300,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

test("Booking V2 Bangkok local input converts to UTC and round-trips", () => {
  const iso = bangkokLocalInputToIso("2026-09-09T10:30");
  assert.equal(iso, "2026-09-09T03:30:00.000Z");
  assert.equal(isoToBangkokLocalInput(iso!), "2026-09-09T10:30");
});

test("Booking V2 rejects impossible Bangkok calendar input", () => {
  assert.equal(bangkokLocalInputToIso("2026-02-30T10:00"), null);
  assert.equal(bangkokLocalInputToIso("2026-09-09 10:00"), null);
});

test("Booking V2 validation rejects timezone-free timestamps and duplicate pets", () => {
  const noZone = validateLineBookingV2Input({ ...validInput(), startAt: "2026-09-09T10:00:00" });
  assert.equal(noZone.valid, false);
  assert.match(noZone.error ?? "", /timezone/i);

  const duplicatePets = validateLineBookingV2Input({ ...validInput(), petIds: [PET_ID, PET_ID] });
  assert.equal(duplicatePets.valid, false);
  assert.match(duplicatePets.error ?? "", /Duplicate pets/i);
});

test("Booking V2 validation canonicalizes timestamp and trims optional text", () => {
  const result = validateLineBookingV2Input(validInput());
  assert.equal(result.valid, true);
  assert.equal(result.sanitized?.startAt, "2026-09-09T03:00:00.000Z");
  assert.equal(result.sanitized?.specialRequests, "quiet room");
});

test("Invalid Booking V2 input fails before LINE verification or runtime RPC", async () => {
  let fetchCalls = 0;
  let rpcCalls = 0;
  const runtime: Ps01RuntimeRpcClient = {
    async rpc() { rpcCalls += 1; return { data: null, error: null }; },
  };
  const fakeFetch = (async () => { fetchCalls += 1; throw new Error("must not run"); }) as typeof fetch;
  const result = await quoteCustomerBookingV2Core(runtime, CHANNEL_ID, { ...validInput(), petIds: [] }, fakeFetch);
  assert.equal(result.success, false);
  assert.equal(fetchCalls, 0);
  assert.equal(rpcCalls, 0);
});

test("Booking V2 quote verifies LINE and calls only the quote RPC with canonical args", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const runtime: Ps01RuntimeRpcClient = {
    async rpc(name, args) {
      calls.push({ name, args });
      return {
        data: {
          pricingMode: "FIXED_PACKAGE", unit: "HOUR", quantity: 3, price: 250,
          startAt: "2026-09-09T03:00:00.000Z", endAt: "2026-09-09T06:00:00.000Z",
          ratePlanId: PLAN_ID, roomId: ROOM_ID,
        },
        error: null,
      };
    },
  };

  const result = await quoteCustomerBookingV2Core(runtime, CHANNEL_ID, validInput(), lineVerifyFetch());
  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "quote_customer_booking_v2_internal");
  assert.deepEqual(calls[0].args, {
    p_verified_line_user_id: LINE_USER_ID,
    p_shop_id: SHOP_ID,
    p_room_id: ROOM_ID,
    p_rate_plan_id: PLAN_ID,
    p_pet_ids: [PET_ID],
    p_start_at: "2026-09-09T03:00:00.000Z",
  });
});

test("Booking V2 runtime not-linked error maps to NOT_LINKED", async () => {
  const runtime: Ps01RuntimeRpcClient = {
    async rpc() { return { data: null, error: { message: "customer not linked to shop" } }; },
  };
  const result = await quoteCustomerBookingV2Core(runtime, CHANNEL_ID, validInput(), lineVerifyFetch());
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "NOT_LINKED");
});

test("Booking V2 submit calls only submit RPC and passes sanitized special request", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const runtime: Ps01RuntimeRpcClient = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: "55555555-5555-4555-8555-555555555555", error: null };
    },
  };
  const result = await submitBookingRequestV2Core(runtime, CHANNEL_ID, validInput(), lineVerifyFetch());
  assert.deepEqual(result, { success: true, requestId: "55555555-5555-4555-8555-555555555555" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "submit_booking_request_v2_internal");
  assert.equal(calls[0].args.p_verified_line_user_id, LINE_USER_ID);
  assert.equal(calls[0].args.p_special_requests, "quiet room");
  assert.equal(calls[0].args.p_start_at, "2026-09-09T03:00:00.000Z");
});
