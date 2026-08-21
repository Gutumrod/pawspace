import { NextRequest, NextResponse } from "next/server";
import { getCameraFeedForSession } from "@/lib/camera-access-server";

const CAMERA_SESSION_COOKIE = "pawspace_camera_session";

export const runtime = "nodejs";

function isAllowedMediaType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "image/jpeg" ||
    mediaType === "image/png" ||
    mediaType === "multipart/x-mixed-replace" ||
    mediaType === "video/mp4" ||
    mediaType === "video/webm" ||
    mediaType === "video/ogg";
}

function cameraError(status: number, code: string) {
  return NextResponse.json(
    { success: false, code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shopSlug: string }> },
) {
  const token = request.cookies.get(CAMERA_SESSION_COOKIE)?.value;
  if (!token) return cameraError(401, "SESSION_INVALID");

  const { shopSlug } = await context.params;
  const access = await getCameraFeedForSession({
    shopSlug,
    token,
    headers: request.headers,
  });
  if (!access.success) {
    const status = access.code === "SESSION_INVALID"
      ? 401
      : access.code === "CAMERA_UNAVAILABLE"
        ? 503
        : 500;
    return cameraError(status, access.code);
  }

  const ttlMs = Math.max(0, access.expiresAt * 1000 - Date.now());
  if (ttlMs <= 0) return cameraError(401, "SESSION_INVALID");

  const abortController = new AbortController();
  const expiryTimer = setTimeout(() => abortController.abort(), ttlMs);
  const upstreamHeaders = new Headers();
  const range = request.headers.get("range");
  const accept = request.headers.get("accept");
  if (range) upstreamHeaders.set("range", range);
  if (accept) upstreamHeaders.set("accept", accept);

  try {
    const upstream = await fetch(access.feedUrl, {
      method: "GET",
      headers: upstreamHeaders,
      redirect: "manual",
      cache: "no-store",
      signal: abortController.signal,
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      clearTimeout(expiryTimer);
      await upstream.body?.cancel();
      return cameraError(502, "CAMERA_UPSTREAM_REJECTED");
    }
    if ((!upstream.ok && upstream.status !== 206) || !isAllowedMediaType(upstream.headers.get("content-type"))) {
      clearTimeout(expiryTimer);
      await upstream.body?.cancel();
      return cameraError(502, "CAMERA_UPSTREAM_REJECTED");
    }
    if (!upstream.body) {
      clearTimeout(expiryTimer);
      return cameraError(502, "CAMERA_UPSTREAM_REJECTED");
    }

    const reader = upstream.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            clearTimeout(expiryTimer);
            controller.close();
            return;
          }
          controller.enqueue(value);
        } catch (error) {
          clearTimeout(expiryTimer);
          controller.error(error);
        }
      },
      async cancel(reason) {
        clearTimeout(expiryTimer);
        abortController.abort();
        await reader.cancel(reason);
      },
    });

    const responseHeaders = new Headers({
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    });
    const contentType = upstream.headers.get("content-type");
    const contentLength = upstream.headers.get("content-length");
    const acceptRanges = upstream.headers.get("accept-ranges");
    const contentRange = upstream.headers.get("content-range");
    if (contentType) responseHeaders.set("Content-Type", contentType);
    if (contentLength) responseHeaders.set("Content-Length", contentLength);
    if (acceptRanges) responseHeaders.set("Accept-Ranges", acceptRanges);
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    return new Response(stream, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    clearTimeout(expiryTimer);
    return cameraError(502, "CAMERA_UPSTREAM_UNAVAILABLE");
  }
}
