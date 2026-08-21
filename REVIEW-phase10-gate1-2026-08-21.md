# PawSpace Phase 10 — Gate 1 Review

Date: 2026-08-21
Reviewer: Claude (independent, at the user's request after the Manus/implementer status update)
Branch: `master`
Baseline: `ee52ead` (`docs: hand off Phase 10 pilot scope`); Phase 9 implementation is `485d941`.

## Verdict

`PHASE PASSED — READY TO RELEASE NEXT PHASE`

GitHub Issue #3 is **CLOSED**.

## Why This Review Includes a Fix, Not Just an Inspection

The implementer's status update reported Phase 10's 7 core E2E tests passing, but flagged
honestly that Issue #3's specific wording (`inviteStaffAction`'s no-password branch →
`inviteUserByEmail()` → recipient actually receives and consumes a credential-setting
flow) was not yet covered — the existing E2E always supplied a password in the invite
form. The implementer had proven the email itself arrives in local Mailpit with a real
`/auth/v1/verify?...type=invite...` link, but had not built or tested the page that
consumes it. The user asked me to continue this to closure rather than wait.

## What Was Actually Missing (Confirmed by Reading the Code)

- `app/actions/staff.ts`'s `inviteUserByEmail()` call had no `redirectTo`, so the invite
  link would default to `site_url` (`http://127.0.0.1:3000`) regardless of which app
  instance/port sent it — broken for the E2E harness, which runs on port 3100.
- There was no page anywhere in the app (`app/auth/**` did not exist) to receive the
  `#access_token=...&type=invite` hash fragment GoTrue appends when it redirects back,
  or to let the invited user set a password. The "credential flow" Issue #3 requires
  had no landing page to complete on.
- `supabase/config.toml`'s `additional_redirect_urls` only listed
  `https://127.0.0.1:3000` (note: `https`, not `http`) — an explicit `redirectTo` on
  `http://127.0.0.1:*` would have been rejected by GoTrue's redirect allow-list check.

## What Was Built (Minimum Needed, Verified Against a Live Local Stack Before Writing the Test)

1. `app/actions/staff.ts` — both `inviteUserByEmail()` (no-password branch) and the
   existing-user `resetPasswordForEmail()` fallback now pass
   `redirectTo: \`${APP_BASE_URL}/auth/accept-invite\`` (`APP_BASE_URL` is a new
   server-only env var, default `http://127.0.0.1:3000`).
2. `app/auth/accept-invite/page.tsx` — new client page. Lets `@supabase/supabase-js`'s
   `detectSessionInUrl` consume the hash fragment, shows a set-password form once a
   session is detected (or an "invalid/expired link" state after a 4s timeout with no
   session), calls `supabase.auth.updateUser({ password })`, signs that ephemeral
   session out, redirects to `/login`.
3. `lib/supabase-browser.ts` — new minimal anon-key browser client, used only by that
   page. Not wired into any other part of the app; the app's real session stays the
   separate httpOnly-cookie one `lib/auth.ts` manages server-side.
4. `supabase/config.toml` — `additional_redirect_urls` now includes
   `http://127.0.0.1:3000/**` and `http://127.0.0.1:3100/**` (dev and E2E ports).
5. `.env.example`, `scripts/phase10-e2e.ps1` — document/set `APP_BASE_URL`.
6. `tests/e2e/phase10-pilot.spec.ts` — one new test that:
   - invites with the password field left blank (exercising the real branch);
   - polls local Mailpit's REST API (`/api/v1/messages`, `/api/v1/message/{id}`) for the
     actual email PawSpace's own `inviteStaffAction` triggered;
   - extracts the real `/auth/v1/verify?token=...&type=invite&redirect_to=...` link from
     the email HTML (not a stand-in URL);
   - navigates the browser to it, letting it follow GoTrue's real 303 redirect back to
     `/auth/accept-invite#access_token=...`;
   - sets a password through the new page;
   - logs in with that self-chosen password and confirms the invited staff member
     reaches operations;
   - removes the staff member as owner and confirms the credential stops working
     (mirrors the existing password-based invite test's removal assertion).

Before writing the test blind, I manually drove the real flow once (invite call →
Mailpit REST API → GoTrue `/auth/v1/verify` with `redirect: manual`) to confirm the
exact link format, the 303 redirect target, and that the config.toml allow-list change
actually unblocks it, rather than guessing at Mailpit's/GoTrue's response shape.

## One Bug Found and Fixed During This Review

The first version of the new E2E test omitted the `expect.poll(...).toBe(false)` wait
for the logout cookie to actually clear (present in the sibling password-based invite
test) before attempting the post-removal login check. This is a real race: the logout
click's cookie-clearing Server Action and the subsequent `page.goto("/login")` are not
guaranteed ordered without the poll, so the test could read a stale owner session
cookie. Added the same poll used elsewhere; rerun is stable.

## Executable Evidence (This Review, Rerun on a Fully Settled Local Stack)

- `pnpm exec tsc --noEmit` — PASS, zero errors.
- `pnpm lint` — PASS, zero errors/warnings.
- `pnpm build` — PASS; `/auth/accept-invite` compiles as a static route, `/` and
  `/dashboard` remain dynamic.
- `git diff --check` — PASS (CRLF/LF warnings only).
- `supabase db reset` — PASS; migrations 1–9 applied cleanly, no Phase 10 migration
  (Phase 10 adds no schema).
- `supabase db lint --local` — No schema errors found.
- `tests/e2e/phase10-pilot.spec.ts` via `scripts/phase10-e2e.ps1` — **8/8 passed**
  (all 7 original tests, unchanged, plus the new Issue #3 test).
- Isolated TypeScript regressions, rerun in full because the fix touched Phase 3
  territory (`app/actions/staff.ts`):
  - Phase 3 server layer: 33/33.
  - Phase 4 booking backend: 21/21.
  - Phase 5 LINE claim: 32/32.
  - Phase 6 Daily Report + LINE: 43/43.
  - Phase 7 Google Sheets: 23/23.
  - Phase 8 camera core: 22/22.
  - Phase 9 entitlement core: 5/5.
  - Aggregate: **179 passed, 0 failed**.
- `supabase test db` for `phase7_google_sync.sql`, `phase8_camera_access.sql`,
  `phase9_commercial_entitlements.sql` — all PASS.
- Module Hub (`D:\AI-Workspace\projects\modules-hub`) — untouched.

One isolated Phase 6 run transiently failed with `STORAGE_UPLOAD_FAILED` immediately
after several rapid `supabase start`/`db reset`/`stop` cycles during this session's own
testing left the local Storage container mid-restart (confirmed via `docker logs
supabase_storage_PawSpace`, which showed repeated SIGTERM/restart activity at that
timestamp and no corresponding request ever reaching the container). A clean stop →
start → reset → retry reproduced 43/43 consistently. Logged as local test-environment
flakiness, not a code regression — do not treat a single post-restart Storage failure
as a defect without retrying on a settled stack first.

## `supabase/config.toml` Diff — Why It Is Legitimate, Not Drift

Every prior Phase gate in this project treated "`supabase/config.toml` has no diff" as
a pass signal, because up to now every diff seen was accidental local port-conflict
workaround drift. This one is different: it is a deliberate, minimal, documented
addition of two redirect URLs required for the Supabase Auth invite/reset link to be
accepted by GoTrue at all. Without it, `inviteUserByEmail({ redirectTo })` /
`resetPasswordForEmail({ redirectTo })` would be rejected outright, and Issue #3 could
never be closed with real email-consumption evidence. The diff is exactly:

```diff
-additional_redirect_urls = ["https://127.0.0.1:3000"]
+additional_redirect_urls = ["https://127.0.0.1:3000", "http://127.0.0.1:3000/**", "http://127.0.0.1:3100/**"]
```

## Non-Scope Confirmation

Re-checked: no billing UI, no payment SDK/webhook/checkout, no automatic
renewal/expiry, no hard quota enforcement, no Phase 11 feature. The only schema-layer
touch is the `config.toml` redirect allow-list above — no migration was added or
modified.

## GitHub Issue #3 — Closure Mapping

Issue #3 tracked: `lib/auth.ts::loginWithPassword` and
`app/actions/staff.ts::removeStaffAction`/`inviteStaffAction` had no true
HTTP-runtime E2E coverage, and specifically (per the user's own re-reading of the
issue wording during this session) the `inviteStaffAction` no-password →
`inviteUserByEmail()` → recipient-consumes-a-real-credential-flow branch.

`tests/e2e/phase10-pilot.spec.ts` now proves, over a real `next start` HTTP server and
a real Chromium browser:
- `loginWithPassword` accepts valid owner/manager/staff credentials and rejects
  inactive/no-membership credentials at the server boundary (tests 1-4).
- `inviteStaffAction`'s password-supplied branch works end-to-end (test 5, pre-existing).
- `inviteStaffAction`'s no-password branch — the specific gap — now proven end-to-end
  through a real emailed link consumed by a real page (test 6, new).
- `removeStaffAction` revokes both DB membership and the Supabase Auth account for
  both invite branches (tests 5 and 6 both end with a removal + failed-relogin check).

This is real HTTP/browser-runtime coverage of every case Issue #3 named. I am closing
it. `docs/IMPLEMENTATION_STATUS.md` has been updated with a dated addendum (the
original Phase 1-6 paragraph is left as a frozen historical record, not rewritten).

## Repository State at This Verdict

Phase 10 (including this Issue #3 closure work) is still uncommitted at this review
boundary. Local `master` is `ee52ead`, matching `origin/master`. Nothing has been
pushed beyond that during this review.
