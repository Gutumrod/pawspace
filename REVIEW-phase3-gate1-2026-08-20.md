# PawSpace Phase 3 — Reviewer Gate 1

**Date:** 2026-08-20
**Reviewer:** ChatGPT Gate 1
**Repo:** `Gutumrod/pawspace`
**Baseline:** `90c3b50 feat(db): implement Phase 2 authoritative RPC and RLS layer`
**Local workspace:** `D:\AI-Workspace\projects\saas-product-hub\products\PawSpace`

## Verdict

**NOT READY — TECHNICAL CONTRACT FIXES REQUIRED**

DB/RLS/tenant isolation and last-active-owner behavior passed real execution, including an independent concurrent race test. Phase 3 is blocked by server/auth-layer contract gaps and scope drift listed below.

## Verified by Gate 1

- Phase 3 SQL acceptance: exit `0`.
- Phase 2 regression SQL: exit `0`.
- `supabase db lint --local`: exit `0`, no schema errors.
- `git diff --check`: exit `0`.
- TypeScript server suite: `33/33` pass, exit `0`.
- `npx pnpm exec tsc --noEmit`: exit `0`.
- `npx pnpm lint`: exit `0`.
- `npx pnpm build`: exit `0`.
## Independent Concurrency Verification

Gate 1 created a disposable two-owner tenant and ran two concurrent transactions where each owner attempted to disable itself.

Observed result:
- Worker 1: success, commit.
- Worker 2: rejected with `Last Active Owner Invariant Violation`.
- Final active owner count: `1`.

Conclusion: `enforce_last_active_owner()` successfully serialized the tested concurrent disable race in real PostgreSQL runtime.

## Blocking Finding 1 — App login accepts inactive/unaffiliated users

`lib/auth.ts` sets access/refresh cookies immediately after Supabase Auth succeeds, then resolves staff context.

If `getStaffContext()` returns `null` because the Auth user has no membership or is inactive, `loginWithPassword()` still returns `success: true`.

`app/login/page.tsx` redirects to `/` whenever `success === true`.

This violates the Phase 3 session-authorization requirement that inactive staff be rejected immediately and means an Auth-valid but PawSpace-unauthorized account is treated as a successful application login.
## Blocking Finding 2 — Staff removal does not complete Auth cleanup

`app/actions/staff.ts::removeStaffAction()` calls only the `remove_staff` database RPC.

The architecture contract requires DB revocation/removal first, then Supabase Auth Admin delete/disable as a retryable trusted-server step. The current action leaves the Auth account active after membership removal.

## Blocking Finding 3 — Invite flow can create an unusable credential

`inviteStaffAction()` generates a temporary password with `Math.random()` when none is supplied, creates the Auth user with `email_confirm: true`, but does not deliver that password and does not invoke a Supabase invite/reset-password email flow.

Result: the staff membership can be created successfully while the staff member has no usable login path. `Math.random()` is also not suitable for credential generation.

## Blocking Finding 4 — Hard-coded Supabase credentials in test source

`tests/phase3_server_layer.test.ts` contains literal fallback anon and service-role credentials.

The Phase 3 brief explicitly prohibits hard-coded credentials. Tests should obtain local credentials from environment/runtime tooling instead of embedding them in source.

## Coverage Gap

The `33/33` TypeScript suite exercises Supabase RPCs directly. It does not exercise the actual `loginWithPassword` / `loginAction`, `inviteStaffAction`, `removeStaffAction`, or bootstrap server-action boundaries end-to-end. Therefore the passing suite does not prove the server flows listed above.
## Scope Drift / Commit Review Items

- `.env.example` removes existing LINE/Google preview environment variables even though `lib/integrations.ts` still references them. Restore or preserve those preview variables; Phase 3 should add Supabase admin config without deleting unrelated integration config.
- `supabase/config.toml` changes all local Supabase ports. This may be valid local-environment configuration, but it is not a Phase 3 product requirement and should be reviewed separately before commit.
- `supabase/tests/phase2_rpc_rls.sql` was modified to add a second owner fixture. This appears to adapt the Phase 2 regression test to the new last-owner invariant and passed Gate 1, but Claude should decide whether it belongs in the Phase 3 commit.

## Required Fix / Re-test Before Promotion

1. Reject inactive/unaffiliated users at PawSpace login layer and clear any newly-created session cookies on rejection.
2. Complete trusted Auth cleanup/disable behavior for staff removal according to architecture contract.
3. Replace unusable random-password invite behavior with a real invitation/password-establishment flow; no `Math.random()` credentials.
4. Remove hard-coded Supabase credentials from test source.
5. Add executable tests that exercise the real server auth/staff actions, not only DB RPCs.
6. Restore unrelated `.env.example` integration entries or justify the architecture change.
7. Re-run Phase 2 regression, Phase 3 SQL, server-action tests, concurrency, db lint, typecheck, lint, build, and diff check.

**NO COMMIT / NO PUSH recommended at Gate 1.**
