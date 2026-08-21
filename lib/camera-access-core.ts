export const CAMERA_SESSION_SCOPE = "camera:view" as const;
export const CAMERA_SESSION_TTL_SECONDS = 30 * 60;
export const CAMERA_VISITOR_CODE_PATTERN = /^[0-9A-F]{8}$/;

export type CameraSessionPayload = {
  v: 1;
  shopId: string;
  scope: typeof CAMERA_SESSION_SCOPE;
  credentialVersion: number;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function normalizeCameraVisitorCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function createCameraCodeScopeHash(shopId: string, visitorCode: string): Promise<string> {
  return sha256Hex(`${shopId}:${normalizeCameraVisitorCode(visitorCode)}`);
}

export async function createCameraScopeHash(shopId: string): Promise<string> {
  return sha256Hex(`camera-scope:${shopId}`);
}

export async function createRequesterIpHash(requesterIp: string, pepper: string): Promise<string> {
  if (!pepper) throw new Error("Camera IP hash pepper is required.");
  return sha256Hex(`camera-ip:${pepper}:${requesterIp}`);
}

export async function createCameraSessionIdHash(sessionId: string): Promise<string> {
  return sha256Hex(`camera-session:${sessionId}`);
}

function randomSessionId(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("Camera session signing secret must be at least 32 bytes.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signCameraSession(
  input: { shopId: string; credentialVersion: number },
  secret: string,
  nowMs = Date.now(),
): Promise<{ token: string; payload: CameraSessionPayload }> {
  if (!input.shopId || !Number.isInteger(input.credentialVersion) || input.credentialVersion <= 0) {
    throw new Error("Invalid camera session subject.");
  }

  const issuedAt = Math.floor(nowMs / 1000);
  const payload: CameraSessionPayload = {
    v: 1,
    shopId: input.shopId,
    scope: CAMERA_SESSION_SCOPE,
    credentialVersion: input.credentialVersion,
    sessionId: randomSessionId(),
    issuedAt,
    expiresAt: issuedAt + CAMERA_SESSION_TTL_SECONDS,
  };

  const encodedPayload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return {
    token: `${encodedPayload}.${bytesToBase64Url(new Uint8Array(signature))}`,
    payload,
  };
}

export async function verifyCameraSession(
  token: string,
  secret: string,
  nowMs = Date.now(),
): Promise<CameraSessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  try {
    const key = await importHmacKey(secret);
    const signatureBytes = base64UrlToBytes(parts[1]);
    const signatureBuffer = signatureBytes.buffer.slice(
      signatureBytes.byteOffset,
      signatureBytes.byteOffset + signatureBytes.byteLength,
    ) as ArrayBuffer;
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      new TextEncoder().encode(parts[0]),
    );
    if (!validSignature) return null;

    const rawPayload = new TextDecoder().decode(base64UrlToBytes(parts[0]));
    const value = JSON.parse(rawPayload) as Partial<CameraSessionPayload>;
    const nowSeconds = Math.floor(nowMs / 1000);

    if (
      value.v !== 1 ||
      typeof value.shopId !== "string" || !value.shopId ||
      value.scope !== CAMERA_SESSION_SCOPE ||
      typeof value.credentialVersion !== "number" || !Number.isInteger(value.credentialVersion) || value.credentialVersion <= 0 ||
      typeof value.sessionId !== "string" || !value.sessionId ||
      typeof value.issuedAt !== "number" || !Number.isInteger(value.issuedAt) ||
      typeof value.expiresAt !== "number" || !Number.isInteger(value.expiresAt) ||
      value.expiresAt - value.issuedAt !== CAMERA_SESSION_TTL_SECONDS ||
      value.issuedAt > nowSeconds + 60 ||
      value.expiresAt <= nowSeconds
    ) {
      return null;
    }

    return value as CameraSessionPayload;
  } catch {
    return null;
  }
}

export function cameraSessionMatchesShop(payload: CameraSessionPayload, shopId: string): boolean {
  return payload.scope === CAMERA_SESSION_SCOPE && payload.shopId === shopId;
}


export function parseAllowedCameraFeedUrl(feedUrl: string, allowedHosts: readonly string[]): URL | null {
  try {
    const url = new URL(feedUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.port && url.port !== "443")
    ) return null;
    const normalizedHosts = new Set(allowedHosts.map((host) => host.trim().toLowerCase()).filter(Boolean));
    if (!normalizedHosts.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

export function resolveRequesterIp(headers: Headers, trustedHeaderName: string): string | null {
  const normalizedHeader = trustedHeaderName.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalizedHeader)) return null;
  const raw = headers.get(normalizedHeader)?.trim();
  if (!raw) return null;
  const value = normalizedHeader === "x-forwarded-for" ? raw.split(",")[0]?.trim() : raw;
  return value || null;
}
