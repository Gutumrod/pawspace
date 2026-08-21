import "server-only";
import {
  cameraSessionMatchesShop,
  createCameraCodeScopeHash,
  createCameraSessionIdHash,
  createRequesterIpHash,
  normalizeCameraVisitorCode,
  parseAllowedCameraFeedUrl,
  resolveRequesterIp,
  signCameraSession,
  verifyCameraSession,
} from "./camera-access-core";
import {
  requireCameraAllowedFeedHosts,
  requireCameraIpHashPepper,
  requireCameraRequesterIpHeader,
  requireCameraSessionSigningSecret,
} from "./env";
import { logger } from "./logger";
import { getSupabaseAdminClient } from "./supabase-admin";

export type CameraAccessResult =
  | { success: true; token: string; expiresAt: number }
  | { success: false; code: "INVALID_CODE" | "RATE_LIMITED" | "CAMERA_UNAVAILABLE" | "INVALID_REQUEST" | "SERVER_ERROR" };

export type CameraFeedResult =
  | { success: true; deviceName: "Microsoft LifeCam"; feedUrl: string; expiresAt: number }
  | { success: false; code: "SESSION_INVALID" | "CAMERA_UNAVAILABLE" | "SERVER_ERROR" };

type VerifyRpcResponse = {
  result?: unknown;
  credential_version?: unknown;
};

type FeedRpcResponse = {
  result?: unknown;
  device_name?: unknown;
  feed_url?: unknown;
};

async function resolveShopIdBySlug(shopSlug: string): Promise<string | null> {
  const slug = shopSlug.trim();
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/i.test(slug)) return null;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("shops").select("id").eq("slug", slug).maybeSingle();
  if (error) {
    logger.error("Camera shop resolution failed", { code: error.code || "DB_ERROR" });
    return null;
  }
  return typeof data?.id === "string" ? data.id : null;
}

async function hashRequester(headers: Headers): Promise<string> {
  const requesterIp = resolveRequesterIp(headers, requireCameraRequesterIpHeader());
  if (!requesterIp) throw new Error("Trusted requester IP header is missing.");
  return createRequesterIpHash(requesterIp, requireCameraIpHashPepper());
}

export async function requestCameraAccess(input: {
  shopSlug: string;
  visitorCode: string;
  headers: Headers;
}): Promise<CameraAccessResult> {
  if (input.visitorCode.length > 128) return { success: false, code: "INVALID_REQUEST" };

  try {
    const shopId = await resolveShopIdBySlug(input.shopSlug);
    if (!shopId) return { success: false, code: "INVALID_CODE" };

    const visitorCode = normalizeCameraVisitorCode(input.visitorCode);
    const [codeHash, requesterIpHash] = await Promise.all([
      createCameraCodeScopeHash(shopId, visitorCode),
      hashRequester(input.headers),
    ]);

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("verify_camera_visitor_code_internal", {
      p_shop_id: shopId,
      p_code_hash: codeHash,
      p_requester_ip_hash: requesterIpHash,
    });

    if (error) {
      logger.error("Camera visitor verification failed", { code: error.code || "DB_ERROR" });
      return { success: false, code: "SERVER_ERROR" };
    }

    const result = (data || {}) as VerifyRpcResponse;
    if (result.result === "RATE_LIMITED") return { success: false, code: "RATE_LIMITED" };
    if (result.result === "CAMERA_UNAVAILABLE") return { success: false, code: "CAMERA_UNAVAILABLE" };
    if (result.result !== "GRANTED" || typeof result.credential_version !== "number") {
      return { success: false, code: "INVALID_CODE" };
    }

    const signed = await signCameraSession(
      { shopId, credentialVersion: result.credential_version },
      requireCameraSessionSigningSecret(),
    );

    return { success: true, token: signed.token, expiresAt: signed.payload.expiresAt };
  } catch (error) {
    logger.error("Camera access request failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return { success: false, code: "SERVER_ERROR" };
  }
}

export async function getCameraFeedForSession(input: {
  shopSlug: string;
  token: string;
  headers: Headers;
}): Promise<CameraFeedResult> {
  try {
    const payload = await verifyCameraSession(input.token, requireCameraSessionSigningSecret());
    if (!payload) return { success: false, code: "SESSION_INVALID" };

    const shopId = await resolveShopIdBySlug(input.shopSlug);
    if (!shopId || !cameraSessionMatchesShop(payload, shopId)) {
      return { success: false, code: "SESSION_INVALID" };
    }

    const [sessionIdHash, requesterIpHash] = await Promise.all([
      createCameraSessionIdHash(payload.sessionId),
      hashRequester(input.headers),
    ]);

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("get_camera_feed_internal", {
      p_shop_id: shopId,
      p_credential_version: payload.credentialVersion,
      p_session_id_hash: sessionIdHash,
      p_requester_ip_hash: requesterIpHash,
    });

    if (error) {
      logger.error("Camera session feed lookup failed", { code: error.code || "DB_ERROR" });
      return { success: false, code: "SERVER_ERROR" };
    }

    const result = (data || {}) as FeedRpcResponse;
    if (
      result.result !== "GRANTED" ||
      result.device_name !== "Microsoft LifeCam" ||
      typeof result.feed_url !== "string"
    ) {
      return { success: false, code: "CAMERA_UNAVAILABLE" };
    }

    const allowedUrl = parseAllowedCameraFeedUrl(result.feed_url, requireCameraAllowedFeedHosts());
    if (!allowedUrl) return { success: false, code: "CAMERA_UNAVAILABLE" };

    return {
      success: true,
      deviceName: "Microsoft LifeCam",
      feedUrl: allowedUrl.toString(),
      expiresAt: payload.expiresAt,
    };
  } catch (error) {
    logger.error("Camera session validation failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return { success: false, code: "SERVER_ERROR" };
  }
}
