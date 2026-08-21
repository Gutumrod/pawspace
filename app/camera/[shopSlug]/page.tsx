import { cookies, headers } from "next/headers";
import { getCameraFeedForSession } from "@/lib/camera-access-server";
import CameraAccessClient from "./camera-access-client";

const CAMERA_SESSION_COOKIE = "pawspace_camera_session";

export default async function CameraPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const { shopSlug } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(CAMERA_SESSION_COOKIE)?.value;

  let initialFeed: { streamPath: string; deviceName: "Microsoft LifeCam" } | null = null;
  if (sessionToken) {
    const requestHeaders = await headers();
    const result = await getCameraFeedForSession({ shopSlug, token: sessionToken, headers: requestHeaders });
    if (result.success) {
      initialFeed = {
        streamPath: `/api/camera/stream/${encodeURIComponent(shopSlug)}`,
        deviceName: result.deviceName,
      };
    }
  }

  return <CameraAccessClient shopSlug={shopSlug} initialFeed={initialFeed} />;
}
