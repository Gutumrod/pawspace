"use server";

import { logger } from "@/lib/logger";
import { requireManagerOrOwnerContext, requireTenantContext } from "@/lib/tenant-context";

export type CameraActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

type RotateCameraRpcResponse = {
  visitor_code?: unknown;
  credential_version?: unknown;
};

type CameraStaffSettings = {
  shop_id?: unknown;
  device_name?: unknown;
  feed_url?: unknown;
  is_enabled?: unknown;
  has_visitor_code?: unknown;
  credential_version?: unknown;
  rotated_at?: unknown;
};

export async function rotateCameraVisitorCodeAction(): Promise<CameraActionResult<{ visitorCode: string; credentialVersion: number }>> {
  try {
    const { client } = await requireTenantContext();
    const { data, error } = await client.rpc("rotate_camera_visitor_code");
    if (error) {
      logger.warn("Camera visitor code rotation failed", { code: error.code || "DB_ERROR" });
      return { success: false, error: "Unable to rotate camera visitor code." };
    }

    const value = (data || {}) as RotateCameraRpcResponse;
    if (typeof value.visitor_code !== "string" || typeof value.credential_version !== "number") {
      return { success: false, error: "Camera visitor code response was invalid." };
    }

    return {
      success: true,
      data: { visitorCode: value.visitor_code, credentialVersion: value.credential_version },
    };
  } catch {
    return { success: false, error: "Active staff session required." };
  }
}

export async function setCameraFeedConfigAction(input: {
  feedUrl: string;
  enabled: boolean;
}): Promise<CameraActionResult> {
  try {
    const { client } = await requireManagerOrOwnerContext();
    const { error } = await client.rpc("set_camera_feed_config", {
      p_feed_url: input.feedUrl,
      p_enabled: input.enabled,
    });
    if (error) {
      logger.warn("Camera feed configuration failed", { code: error.code || "DB_ERROR" });
      return { success: false, error: "Unable to save camera feed configuration." };
    }
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Owner or manager role required." };
  }
}

export async function getCameraStaffSettingsAction(): Promise<CameraActionResult<{
  deviceName: "Microsoft LifeCam";
  feedUrl: string | null;
  enabled: boolean;
  hasVisitorCode: boolean;
  credentialVersion: number | null;
  rotatedAt: string | null;
}>> {
  try {
    const { client } = await requireTenantContext();
    const { data, error } = await client.rpc("get_camera_staff_settings");
    if (error) {
      logger.warn("Camera staff settings lookup failed", { code: error.code || "DB_ERROR" });
      return { success: false, error: "Unable to load camera settings." };
    }

    const value = (data || {}) as CameraStaffSettings;
    if (value.device_name !== "Microsoft LifeCam") {
      return { success: false, error: "Camera settings response was invalid." };
    }

    return {
      success: true,
      data: {
        deviceName: "Microsoft LifeCam",
        feedUrl: typeof value.feed_url === "string" ? value.feed_url : null,
        enabled: value.is_enabled === true,
        hasVisitorCode: value.has_visitor_code === true,
        credentialVersion: typeof value.credential_version === "number" ? value.credential_version : null,
        rotatedAt: typeof value.rotated_at === "string" ? value.rotated_at : null,
      },
    };
  } catch {
    return { success: false, error: "Active staff session required." };
  }
}
