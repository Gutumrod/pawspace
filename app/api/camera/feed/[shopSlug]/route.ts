import { NextRequest, NextResponse } from "next/server";
import { getCameraFeedForSession } from "@/lib/camera-access-server";

const CAMERA_SESSION_COOKIE = "pawspace_camera_session";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shopSlug: string }> },
) {
  const token = request.cookies.get(CAMERA_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, code: "SESSION_INVALID" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { shopSlug } = await context.params;
  const result = await getCameraFeedForSession({ shopSlug, token, headers: request.headers });
  if (!result.success) {
    const status = result.code === "SESSION_INVALID" ? 401 : result.code === "CAMERA_UNAVAILABLE" ? 503 : 500;
    return NextResponse.json(
      { success: false, code: result.code },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      success: true,
      deviceName: result.deviceName,
      streamPath: `/api/camera/stream/${encodeURIComponent(shopSlug)}`,
    },
    { status: 200, headers: { "Cache-Control": "no-store, private" } },
  );
}
