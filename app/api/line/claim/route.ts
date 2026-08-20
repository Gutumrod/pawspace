import { NextResponse } from "next/server";
import { verifyAndConsumeLineClaimServer } from "@/lib/line-claim-server";

const MAX_BODY_BYTES = 24_576;

type ClaimBody = {
  claimToken?: unknown;
  idToken?: unknown;
  expectedShopId?: unknown;
};

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, code: "INVALID_REQUEST" }, { status: 413 });
  }

  let body: ClaimBody;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, code: "INVALID_REQUEST" }, { status: 413 });
    }
    body = JSON.parse(raw) as ClaimBody;
  } catch {
    return NextResponse.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (
    typeof body.claimToken !== "string" ||
    typeof body.idToken !== "string" ||
    typeof body.expectedShopId !== "string"
  ) {
    return NextResponse.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
  }

  const result = await verifyAndConsumeLineClaimServer({
    claimToken: body.claimToken,
    idToken: body.idToken,
    expectedShopId: body.expectedShopId,
  });

  if (result.success) {
    return NextResponse.json({ success: true, ownerId: result.ownerId }, { status: 200 });
  }

  const status =
    result.code === "LINE_UNAVAILABLE"
      ? 503
      : result.code === "INVALID_REQUEST"
        ? 400
        : result.code === "LINE_IDENTITY_INVALID"
          ? 401
          : 409;

  return NextResponse.json({ success: false, code: result.code }, { status });
}
