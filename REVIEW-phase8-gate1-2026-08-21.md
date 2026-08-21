# PawSpace Phase 8 — Gate 1 Review

Date: 2026-08-21
Branch: `master`
Baseline HEAD: `c1a60e3` (`feat(sync): implement Phase 7 Google Sheets sync`)

## Scope

Phase 8 implements bounded public access to one Microsoft LifeCam feed per tenant.
Public access is camera-only and must never expand into Supabase/Auth/business-table authority.

Locked controls implemented:
- authenticated staff must rotate/create the visitor code;
- one active visitor credential per shop;
- DB stores `SHA-256(shop_id + ":" + code)`, never plaintext code;
- successful visitor access issues a signed `camera:view` session for exactly 30 minutes;
- session is tenant-bound and credential-version-bound;
- rotating the visitor code invalidates previously issued camera sessions;
- failed-code limiting is DB-authoritative: max 5 failures per 10-minute tenant camera scope plus requester-IP bucket;
- requester IP is accepted only from a configured trusted edge header and stored only as a peppered SHA-256 hash;
- `camera_access_audit` is append-only and stores hashes/reason codes only;
- browser roles have no direct camera-table mutation/read authority;
- internal verification/feed RPCs are service-role only;
- public browser receives only a PawSpace stream path, never the upstream camera URL;
- upstream streaming is server-proxied, hostname-allowlisted, HTTPS-only, secret-free URL, redirect-rejected, and terminated at session expiry.

## Module Hub Compatibility Gate

- `modules/audit-log` — **ADAPTER ONLY**. Append-only/redaction patterns are useful, but the generic schema is not tenant-specific and examples permit raw IP metadata, conflicting with Phase 8 privacy requirements.
- `modules/rate-limit` — **ADAPTER ONLY**. Atomic fixed-window contract is useful, but the available adapter is in-memory and explicitly unsuitable for distributed/serverless production.

No Module Hub directory was copied. Module Hub remained read-only and clean.
## Executable Evidence

- `supabase db reset` — PASS with Phase 1–8 migrations applied.
- `supabase test db supabase/tests/phase8_camera_access.sql` — PASS.
- Phase 8 core security tests — `22 passed, 0 failed`.
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm lint` — PASS.
- `pnpm build` — PASS; camera page/access/feed/stream routes included in production build.
- `git diff --check` — no errors (Windows LF/CRLF warning only).
- `supabase/config.toml` — no diff.
- No Phase 1–7 migration was modified.
- No temporary Phase 8 test artifacts remain.
- GitHub Issue #3 remains OPEN.

## Reviewer Findings Fixed During Gate 1

1. Replaced an unstable guessed-code rate-limit bucket with a stable per-tenant camera scope bucket.
2. Replaced raw upstream camera URL exposure with a session-checked server streaming proxy.
3. Replaced fallback trust of arbitrary forwarding headers with one explicitly configured trusted edge header.
4. Added exact upstream hostname allowlist and rejected URL credentials/query/fragment/redirects.
5. Restricted proxied response MIME types to camera-safe JPEG/PNG/MJPEG/MP4/WebM/Ogg media.

## Verdict

`PHASE PASSED — READY TO RELEASE NEXT PHASE`

Phase 8 remains uncommitted at this review boundary. Phase 9 has not been started.
