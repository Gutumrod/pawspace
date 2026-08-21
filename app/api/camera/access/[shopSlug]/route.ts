import { NextRequest, NextResponse } from "next/server";
import { CAMERA_SESSION_TTL_SECONDS } from "@/lib/camera-access-core";
import { requestCameraAccess } from "@/lib/camera-access-server";

const CAMERA_SESSION_COOKIE = "pawspace_camera_session";
const MAX_BODY_BYTES = 2048;

type AccessBody = { code?: unknown };

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ shopSlug: string }> },
) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, code: "INVALID_REQUEST" }, { status: 413 });
  }

  let body: AccessBody;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, code: "INVALID_REQUEST" }, { status: 413 });
    }
    body = JSON.parse(raw) as AccessBody;
  } catch {
    return NextResponse.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
  }

  if (typeof body.code !== "string" || body.code.length === 0) {
    return NextResponse.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
  }

  const { shopSlug } = await context.params;
  const result = await requestCameraAccess({
    shopSlug,
    visitorCode: body.code,
    headers: request.headers,
  });

  if (!result.success) {
    const status =
      result.code === "RATE_LIMITED" ? 429 :
      result.code === "CAMERA_UNAVAILABLE" ? 503 :
      result.code === "SERVER_ERROR" ? 500 :
      result.code === "INVALID_REQUEST" ? 400 : 401;
    return NextResponse.json(
      { success: false, code: result.code },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.json(
    { success: true, expiresAt: result.expiresAt },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set({
    name: CAMERA_SESSION_COOKIE,
    value: result.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: CAMERA_SESSION_TTL_SECONDS,
  });
  return response;
}
