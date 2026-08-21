# PawSpace Phase 10 — Implementation Evidence

Date: 2026-08-21 (updated: Issue #3 invite-email credential flow added and independently re-verified by Claude)
Scope: Pilot Readiness only. No Phase 11 / monetization implementation.

## Update: Issue #3 Closure (Claude, post-Manus)

The original Phase 10 delivery below (E2E tests 1-7) reused `input.password` on
every invite in its E2E fixtures, so it never actually exercised
`inviteStaffAction`'s no-password branch (real `inviteUserByEmail()` → emailed
link → recipient sets their own password). GitHub Issue #3 requires exactly
that path as executable evidence, not the password-handed-in-person path.

To close it for real:
- `app/actions/staff.ts` now passes `redirectTo: \`${APP_BASE_URL}/auth/accept-invite\`` to both `inviteUserByEmail()` and the existing-user `resetPasswordForEmail()` fallback, so the emailed link lands on this app instead of Supabase's bare default `site_url`.
- `app/auth/accept-invite/page.tsx` (new) — a client page that lets Supabase JS auto-detect the `#access_token=...&type=invite` hash GoTrue redirects to, then calls `supabase.auth.updateUser({ password })` to let the invited user set their own password, then signs that ephemeral browser session out (the app's real session stays the separate httpOnly-cookie one from `/login`).
- `lib/supabase-browser.ts` (new) — minimal anon-key browser client for that one page only; not used anywhere else in the app.
- `supabase/config.toml` `[auth] additional_redirect_urls` now also allow-lists `http://127.0.0.1:3000/**` and `http://127.0.0.1:3100/**` (dev and E2E ports) — required or GoTrue rejects the redirect. **This is a deliberate, necessary config change, not drift** — see `REVIEW-phase10-gate1-2026-08-21.md`.
- `.env.example` documents the new optional `APP_BASE_URL` (server-only, defaults to `http://127.0.0.1:3000`).
- `scripts/phase10-e2e.ps1` sets `APP_BASE_URL=http://127.0.0.1:3100` so invite links point at the E2E server.
- `tests/e2e/phase10-pilot.spec.ts` gained one new test, "Issue #3: no-password invite sends a real email credential flow the recipient can consume": invites with the password field left blank, polls local Mailpit's REST API for the real email, extracts the actual `/auth/v1/verify?...type=invite...` link GoTrue generated, navigates the browser to it (following the real 303 redirect back to `/auth/accept-invite#access_token=...`), sets a password through the new page, logs in with that self-chosen password, then removes the staff member and confirms the credential no longer works.

Full re-run after this fix, on a fully settled local Supabase stack:
- `tests/e2e/phase10-pilot.spec.ts` — **8/8 passed** (all 7 original tests plus the new one).
- Phase 3 server layer regression (touched by the `staff.ts` redirect change): **33/33 passed**.
- Phase 4-9 regressions: unchanged, all still passing (see updated aggregate below).
- `supabase db lint --local`: no schema errors.
- `tsc --noEmit`, `pnpm lint`, `pnpm build`, `git diff --check`: all PASS.

GitHub Issue #3 is now considered **CLOSED** — see `REVIEW-phase10-gate1-2026-08-21.md` for the reviewer verdict and exact acceptance mapping.

---

## Original Manus Delivery (below, largely unchanged)

## Baseline / Repository State

Verified from local disk before Phase 10 work:

```text
## master...origin/master
ee52ead docs: hand off Phase 10 pilot scope
485d941 feat(dashboard): implement Phase 9 owner/manager dashboard + commercial entitlements
5611c52 feat(camera): implement Phase 8 public visitor camera access
```

`ee52ead` is the Phase 10 handoff/docs commit; Phase 9 implementation baseline remains `485d941`.
No Phase 1–9 migration was modified by Phase 10. `supabase/config.toml` was later modified
by the Issue #3 closure work above (redirect allow-list only) — see the update note.

Module Hub check:
- Current Module Hub was inspected from local disk.
- Existing auth/tenant/subscription modules would duplicate PawSpace authority.
- LINE OA AI module remains Pilot/Testing and is outside Phase 10 scope.
- Compatibility Gate verdict: `NOT NEEDED`; no cross-repo import/copy and no Module Hub edit.

## Phase 10 Runtime E2E
Command:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\phase10-e2e.ps1
```

Harness characteristics:
- Starts a real optimized Next.js production build with `next start` on local port 3100.
- Uses the real local Supabase stack.
- Creates isolated tenant/user fixtures through the test-only admin client.
- Browser operations then use the real login page, Server Actions, Route Handler, RLS and RPC boundaries.
- External LINE/Google uptime is not required.

Final result (after the Issue #3 fix, rerun on a fully settled local stack):

```text
Running 8 tests using 1 worker
ok 1 owner login reaches operations and sees owner-only controls
ok 2 manager reaches operations but cannot manage staff
ok 3 staff reaches core operations but not manager controls
ok 4 inactive and no-membership logins are rejected without PawSpace session cookies
ok 5 owner invite creates usable credentials and remove revokes membership plus Auth account
ok 6 Issue #3: no-password invite sends a real email credential flow the recipient can consume
ok 7 pilot core loop runs through real UI and HTTP runtime
ok 8 tenant A cannot expose or mutate tenant B resources
8 passed (15.6s)
```
The cross-tenant test proves both surfaces:
- Tenant A UI renders zero `SECRET-B-ROOM` content.
- An authenticated tenant A browser POST to `/api/daily-reports` with tenant B booking/pet IDs is rejected with HTTP `409`; the server log reports the foreign booking as not found and no tenant A report row is created.

E2E-proven compatibility fix:
- Local Supabase Storage returns loopback `http://127.0.0.1/...` URLs even while the Next.js app is running an optimized production build.
- `lib/daily-report-service.ts` now permits HTTP only for `localhost` or `127.0.0.1`; all non-loopback external image URLs remain HTTPS-only.

## Phase 4–9 TypeScript Regression Suites

The suites were executed sequentially against the local Supabase stack to preserve their worker/concurrency isolation. Running all DB-backed suites in one `node --test` process caused expected shared-queue interference, so that orchestration result is not used as acceptance evidence.

Command pattern:

```powershell
# local URL/anon/service-role are resolved dynamically from `supabase status -o env`
npx tsx --test <one phase test file>
```

Final isolated totals (Phase 3 added to this rerun since the Issue #3 fix touched `app/actions/staff.ts`):
- Phase 3 server layer: **33 passed, 0 failed**.
- Phase 4 booking backend: **21 passed, 0 failed**.
- Phase 5 LINE claim: **32 passed, 0 failed**.
- Phase 6 Daily Report + LINE: **43 passed, 0 failed**.
- Phase 7 Google Sheets: **23 passed, 0 failed**.
- Phase 8 camera core: **22 passed, 0 failed**.
- Phase 9 entitlement core: **5 passed, 0 failed**.

Aggregate explicit checks reported by those suites: **179 passed, 0 failed**.

Note: one isolated rerun of Phase 6 during this session transiently failed with
`STORAGE_UPLOAD_FAILED` right after several rapid `supabase start`/`db reset`/`stop`
cycles left the Storage container mid-restart. A clean stop → start → reset → retry
reproduced 43/43 passing consistently; this was local container-restart flakiness
during interactive testing, not a code regression. Treat any single-run Storage
failure immediately after a rapid stack restart as suspect and retry on a settled
stack before treating it as a real defect.
## Database Reset / Lint / SQL Regression

Commands:

```powershell
pnpm exec supabase db reset
pnpm exec supabase db lint --local
pnpm exec supabase test db supabase/tests/phase7_google_sync.sql
pnpm exec supabase test db supabase/tests/phase8_camera_access.sql
pnpm exec supabase test db supabase/tests/phase9_commercial_entitlements.sql
```

Final raw results:

```text
Finished supabase db reset on branch master.
No schema errors found
phase7_google_sync.sql .. ok      Result: PASS
phase8_camera_access.sql .. ok    Result: PASS
phase9_commercial_entitlements.sql .. ok  Result: PASS
```

Reset applied the committed migrations in order through `20260821160000_phase9_commercial_entitlements.sql` with no Phase 10 migration added.

## Production Build Gates

Commands:

```powershell
pnpm exec tsc --noEmit
pnpm lint
pnpm build
git diff --check
```
Final results:
- TypeScript: **PASS**, zero errors.
- ESLint: **PASS**, no warnings/errors.
- Next.js 16.3.1 optimized production build: **PASS**.
- `/` remains a dynamic server-rendered route and `/dashboard` remains dynamic.
- `git diff --check`: **PASS**, zero whitespace errors. Git emitted only LF/CRLF conversion warnings on Windows.

## Security / Privilege Inspection

Manual inspection performed after tests:
- `git diff --name-only -- supabase/migrations supabase/config.toml` returned no files.
- No new browser table mutation path was introduced; Phase 10 room/customer/pet mutations call existing authoritative RPCs through server-side actions/services.
- `app/operations-client.tsx` contains no Supabase client, raw `.from(...)`, raw `.rpc(...)`, service-role key, integration secret, or `process.env` access.
- `lib/operations-service.ts` is marked `server-only`; its direct table access is read-only and remains tenant-scoped by the authenticated RLS client.
- Owner/Manager room configuration uses `requireManagerOrOwnerContext()` plus existing room RPC authorization.
- Staff management remains Owner-only through the existing Phase 3 actions/RPCs.
- Booking, customer, pet, Daily Report, LINE and Google operations re-authorize inside Server Actions/Route Handlers; UI hiding is not treated as authorization.
- No Phase 1–9 migration or privilege grant was rewritten.
- No billing, payment SDK/webhook, automatic subscription processing, hard paid quota enforcement, or Phase 11 feature was added.
- `lib/supabase-browser.ts` and `app/auth/accept-invite/page.tsx` use only `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (already public); no service-role key or other server-only secret is referenced from client code.
- The accept-invite page's Supabase session is a short-lived, ephemeral browser-only session used solely to call `updateUser({password})`; it is explicitly signed out immediately after, and is never used to establish or substitute for the app's own httpOnly-cookie session from `/login`.

## Main Phase 10 Files

Application:
- `app/page.tsx` — authenticated canonical pilot operations entry point.
- `app/operations-client.tsx` — iPad/mobile operational UI and role-specific controls.
- `app/actions/operations.ts` — thin room/customer/pet Server Actions.
- `lib/operations-service.ts` — server-only tenant read model + existing-RPC wrappers.
- `app/globals.css` — responsive pilot UI additions.
- `lib/daily-report-service.ts` — loopback-only HTTP compatibility for local Supabase Storage E2E.

Test/tooling:
- `playwright.config.ts`
- `scripts/phase10-e2e.ps1`
- `tests/e2e/phase10-pilot.spec.ts`
- `package.json` / `pnpm-lock.yaml` — Playwright dev dependency + `test:e2e` command.

Issue #3 closure (added by Claude after the original Manus delivery):
- `app/auth/accept-invite/page.tsx` — consumes the real Supabase invite/reset link and lets the recipient set their own password.
- `lib/supabase-browser.ts` — anon-key browser client used only by that page.
- `app/actions/staff.ts` — `inviteStaffAction`'s no-password branch and the existing-user password-reset fallback now pass an explicit `redirectTo` pointing at `/auth/accept-invite`.
- `supabase/config.toml` — `additional_redirect_urls` extended for the invite/reset redirect to be accepted.
- `.env.example`, `scripts/phase10-e2e.ps1` — new `APP_BASE_URL` server-only env var.
