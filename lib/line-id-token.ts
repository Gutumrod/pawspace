const LINE_ID_TOKEN_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const VERIFY_TIMEOUT_MS = 8_000;
const MAX_ID_TOKEN_LENGTH = 16_384;

export interface VerifiedLineIdentity {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
}

export type LineIdTokenResult =
  | { success: true; identity: VerifiedLineIdentity }
  | { success: false; code: "INVALID_INPUT" | "INVALID_ID_TOKEN" | "LINE_UNAVAILABLE" };

type LineVerifyResponse = {
  iss?: unknown;
  sub?: unknown;
  aud?: unknown;
  exp?: unknown;
  name?: unknown;
  picture?: unknown;
};

export async function verifyLineIdToken(
  idToken: string,
  channelId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LineIdTokenResult> {
  const token = idToken?.trim();
  const expectedChannelId = channelId?.trim();
  if (!token || !expectedChannelId || token.length > MAX_ID_TOKEN_LENGTH) {
    return { success: false, code: "INVALID_INPUT" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const body = new URLSearchParams({
      id_token: token,
      client_id: expectedChannelId,
    });
    const response = await fetchImpl(LINE_ID_TOKEN_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { success: false, code: "INVALID_ID_TOKEN" };
    }

    const payload = (await response.json()) as LineVerifyResponse;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      payload.iss !== "https://access.line.me" ||
      String(payload.aud ?? "") !== expectedChannelId ||
      typeof payload.sub !== "string" || !payload.sub.trim() ||
      typeof payload.exp !== "number" || payload.exp <= nowSeconds
    ) {
      return { success: false, code: "INVALID_ID_TOKEN" };
    }

    return {
      success: true,
      identity: {
        userId: payload.sub.trim(),
        displayName: typeof payload.name === "string" ? payload.name : undefined,
        pictureUrl: typeof payload.picture === "string" ? payload.picture : undefined,
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, code: "LINE_UNAVAILABLE" };
    }
    return { success: false, code: "LINE_UNAVAILABLE" };
  } finally {
    clearTimeout(timeout);
  }
}
