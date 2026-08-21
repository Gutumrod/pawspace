import { NextResponse } from "next/server";
import { requireGoogleSyncDispatchSecret } from "@/lib/env";
import { runGoogleSyncBatch } from "@/lib/google-sync-worker";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  try {
    return header.slice(7) === requireGoogleSyncDispatchSecret();
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let maxJobs = 10;
  try {
    const body = await request.json() as { maxJobs?: unknown };
    if (typeof body.maxJobs === "number" && Number.isFinite(body.maxJobs)) maxJobs = body.maxJobs;
  } catch {
    // Empty body is allowed.
  }

  try {
    const summary = await runGoogleSyncBatch(maxJobs);
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    logger.error("Google sync dispatcher batch failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
