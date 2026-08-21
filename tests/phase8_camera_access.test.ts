import { webcrypto } from "node:crypto";
import {
  CAMERA_SESSION_SCOPE,
  CAMERA_SESSION_TTL_SECONDS,
  cameraSessionMatchesShop,
  createCameraCodeScopeHash,
  createCameraScopeHash,
  createRequesterIpHash,
  normalizeCameraVisitorCode,
  parseAllowedCameraFeedUrl,
  resolveRequesterIp,
  sha256Hex,
  signCameraSession,
  verifyCameraSession,
} from "../lib/camera-access-core";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

let passed = 0;
let failed = 0;

function check(ok: boolean, name: string, detail?: string) {
  if (ok) {
    console.log(`  [PASS] ${name}`);
    passed += 1;
  } else {
    console.error(`  [FAIL] ${name}${detail ? ` - ${detail}` : ""}`);
    failed += 1;
  }
}

async function run() {
  console.log("=== PawSpace Phase 8 Camera Access Core Tests ===\n");

  const shop1 = "11111111-1111-4111-8111-111111111111";
  const shop2 = "22222222-2222-4222-8222-222222222222";
  const code = "a1b2c3d4";
  const normalized = normalizeCameraVisitorCode(`  ${code}  `);
  check(normalized === "A1B2C3D4", "Visitor code normalization is deterministic uppercase + trim");

  const expectedCodeHash = await sha256Hex(`${shop1}:A1B2C3D4`);
  const codeHash = await createCameraCodeScopeHash(shop1, code);
  check(codeHash === expectedCodeHash, "Code scope hash is exactly SHA-256(shop_id + ':' + code)");
  check(!codeHash.includes(code) && codeHash.length === 64, "Code scope hash does not expose plaintext visitor code");

  const stableScopeHash = await createCameraScopeHash(shop1);
  check(
    stableScopeHash === await sha256Hex(`camera-scope:${shop1}`) && stableScopeHash !== codeHash,
    "Rate-limit scope hash is stable per tenant and independent of the guessed visitor code",
  );

  const rawIp = "203.0.113.42";
  const ipHashA = await createRequesterIpHash(rawIp, "pepper-one-1234567890");
  const ipHashB = await createRequesterIpHash(rawIp, "pepper-two-1234567890");
  check(ipHashA.length === 64 && !ipHashA.includes(rawIp), "Requester IP is represented only as a SHA-256 hash");
  check(ipHashA !== ipHashB, "Requester IP hash is pepper-bound");

  const headers = new Headers({
    "x-forwarded-for": "198.51.100.9, 198.51.100.10",
    "x-real-ip": "198.51.100.8",
    "cf-connecting-ip": "198.51.100.7",
  });
  check(
    resolveRequesterIp(headers, "cf-connecting-ip") === "198.51.100.7",
    "Requester IP uses only the configured trusted edge header",
  );
  check(
    resolveRequesterIp(headers, "x-forwarded-for") === "198.51.100.9",
    "Configured forwarded header uses the first edge-provided address",
  );
  check(
    resolveRequesterIp(new Headers({ "x-forwarded-for": "198.51.100.99" }), "cf-connecting-ip") === null,
    "Unconfigured spoofable IP headers are ignored",
  );

  check(
    parseAllowedCameraFeedUrl("https://camera.example.test/live", ["camera.example.test"])?.hostname === "camera.example.test",
    "Camera upstream accepts an exact HTTPS allowlisted hostname",
  );
  check(
    parseAllowedCameraFeedUrl("https://evil.example.test/live", ["camera.example.test"]) === null &&
      parseAllowedCameraFeedUrl("http://camera.example.test/live", ["camera.example.test"]) === null &&
      parseAllowedCameraFeedUrl("https://user:pass@camera.example.test/live", ["camera.example.test"]) === null &&
      parseAllowedCameraFeedUrl("https://camera.example.test/live?token=secret", ["camera.example.test"]) === null &&
      parseAllowedCameraFeedUrl("https://camera.example.test:8443/live", ["camera.example.test"]) === null,
    "Camera upstream rejects unlisted, non-HTTPS, secret-bearing, and unexpected-port URLs",
  );

  const signingSecret = "phase8-camera-signing-secret-32-bytes-minimum-value";
  const issuedAtMs = Date.UTC(2026, 7, 21, 7, 0, 0);
  const signed = await signCameraSession({ shopId: shop1, credentialVersion: 7 }, signingSecret, issuedAtMs);

  check(signed.payload.scope === CAMERA_SESSION_SCOPE, "Signed public session scope is camera:view only");
  check(
    signed.payload.expiresAt - signed.payload.issuedAt === CAMERA_SESSION_TTL_SECONDS && CAMERA_SESSION_TTL_SECONDS === 1800,
    "Signed public camera session TTL is exactly 30 minutes",
  );
  check(signed.payload.shopId === shop1 && signed.payload.credentialVersion === 7, "Session is bound to tenant + credential version");
  check(
    !signed.token.includes(signingSecret) && !signed.token.includes(code) && !signed.token.includes(rawIp),
    "Signed session token contains no raw signing secret, visitor code, or requester IP",
  );

  const verified = await verifyCameraSession(signed.token, signingSecret, issuedAtMs + 10 * 60_000);
  check(verified?.scope === "camera:view" && verified.shopId === shop1, "Valid signed session verifies inside TTL");
  check(verified !== null && cameraSessionMatchesShop(verified, shop1), "Session authorizes only its own tenant camera");
  check(verified !== null && !cameraSessionMatchesShop(verified, shop2), "Cross-tenant camera access is rejected by session binding");

  const tamperedParts = signed.token.split(".");
  const tampered = `${tamperedParts[0]}.${tamperedParts[1].slice(0, -1)}${tamperedParts[1].endsWith("A") ? "B" : "A"}`;
  check(await verifyCameraSession(tampered, signingSecret, issuedAtMs + 1000) === null, "Tampered camera session signature is rejected");
  check(
    await verifyCameraSession(signed.token, "different-camera-signing-secret-32-bytes-minimum", issuedAtMs + 1000) === null,
    "Camera session signed with another secret is rejected",
  );
  check(
    await verifyCameraSession(signed.token, signingSecret, issuedAtMs + (CAMERA_SESSION_TTL_SECONDS + 1) * 1000) === null,
    "Camera session expires after 30 minutes",
  );

  const shortSecretRejected = await (async () => {
    try {
      await signCameraSession({ shopId: shop1, credentialVersion: 1 }, "short", issuedAtMs);
      return false;
    } catch {
      return true;
    }
  })();
  check(shortSecretRejected, "Weak camera signing secret is rejected before token issuance");

  console.log(`\n=== Phase 8 Core Result: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error("Phase 8 core suite crashed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
