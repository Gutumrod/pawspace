# BRIEF — PawSpace Phase 3: Auth + Tenant Context

## Project / Local Path
- Repository: `Gutumrod/pawspace`
- Branch: `master`
- Required baseline: commit `90c3b50` — `feat(db): implement Phase 2 authoritative RPC and RLS layer`
- **MANDATORY LOCAL WORKSPACE:** `D:\AI-Workspace\projects\saas-product-hub\products\PawSpace`

## Absolute Local-Write Rule
**ALL implementation files, migrations, tests, logs, and reports MUST be written directly into the local workspace above.**
Do not work only in a cloud sandbox, remote ephemeral workspace, hidden agent filesystem, artifact storage, or temporary environment.
Before reporting completion, prove each created/edited file exists under the exact local path with `git status`, file listing, and diff from the local repository.
If the agent cannot write to this exact local path, STOP and report `LOCAL WRITE BLOCKED`; do not claim completion.

## Role
You are the implementation agent for Phase 3 only.
ChatGPT is Reviewer Gate 1. Claude is Reviewer Gate 2 and decides commit/push after independent review.
**Do NOT commit. Do NOT push. Do NOT modify Phase 4+ scope.**

## Source of Truth Priority
1. `docs/PRD.md`
2. `docs/SYSTEM_ARCHITECTURE.md`
3. `docs/ROADMAP.md`
4. `docs/BUSINESS_MODEL.md`
5. `docs/IMPLEMENTATION_STATUS.md`
6. `README.md`

Read `docs/PRD.md` and `docs/SYSTEM_ARCHITECTURE.md` before editing anything.
## Phase 3 Goal
Connect Supabase Auth to PawSpace tenant authorization for real staff sessions without weakening Phase 2 mutation/RLS contracts.

Phase 3 must implement and verify:
- Email + Password staff login integration.
- Auth user ↔ `staff_users` membership mapping.
- Active/inactive staff authorization on every DB/RPC path.
- Role semantics: `owner`, `manager`, `staff`.
- Trusted tenant bootstrap for first Shop + first Owner.
- Owner-only staff management: invite/create membership, disable, remove, role change.
- Last-active-owner protection.
- Cross-tenant rejection for staff management and tenant context.
- Session authorization behavior when staff becomes inactive while an Auth session still exists.

## Authoritative Contracts to Preserve
- Browser never receives or stores `service_role`.
- Browser has no generic INSERT/UPDATE/DELETE on `shops` or `staff_users`.
- `current_staff_shop_id()` returns a tenant only for `is_active = true` staff.
- Owner: all capabilities including staff account/role management.
- Manager: shop operations but **cannot** manage staff accounts/roles.
- Staff: operations only.
- One Auth user belongs to one PawSpace shop in V1.
- Disabling/removing/demoting an owner must never leave a shop with zero active owners.
- Cross-tenant target IDs must be rejected, not silently ignored.
- Existing Phase 2 RLS/RPC/table privilege lockdown must remain intact.

## Trusted Server Boundary
Staff management uses Supabase Auth Admin API and therefore must execute in trusted server code only.
Tenant bootstrap is also trusted-server-only.
Never expose service-role secrets in client bundles, browser env vars, returned payloads, logs, or generated test fixtures.
## Required Implementation
Implement the minimum production-shaped server/auth layer needed for Phase 3. Follow the existing Next.js/Supabase structure; do not redesign the product.

At minimum provide:
- Server-side Supabase client/admin boundary with environment validation and no hard-coded credentials.
- Login/session handling appropriate to the existing Next.js App Router project.
- Tenant-context helper(s) that resolve the authenticated active staff membership from the real session.
- `bootstrap_shop` trusted server flow: authenticated requester, requester has no membership, create Shop + active Owner membership, failure-safe transaction/compensation behavior.
- Owner-only staff management flows for invite/add membership, disable, remove, and role change.
- DB-level serialization/backstop for the **last active owner invariant**. Do not rely only on application-side counting.
- Cross-tenant guards for all staff-management targets.
- Safe error handling and structured logging with no secrets/tokens/passwords/service-role values.

If a new migration is required for authoritative DB helpers/triggers/functions, create a new Phase 3 migration. Do not rewrite committed Phase 1/2 migrations unless an actual blocking defect is proven and documented.

## Explicit Non-Scope
Do NOT implement Phase 4 Booking Backend/UI workflows beyond what is required to validate auth context.
Do NOT implement LINE LIFF claim, LINE transport, Google Sheets worker/binding, Daily Report worker, UI redesign, billing, grooming, clinic, or pilot deployment.
Do NOT loosen RLS or restore generic browser DML for convenience.

## Required Executable Tests
Tests must run against the local Supabase/Postgres stack, not mocks only.
Cover at minimum:
1. Valid active owner/manager/staff session resolves the correct tenant.
2. User with no `staff_users` membership gets no tenant access.
3. `is_active=false` user loses DB/RPC access immediately even with an existing Auth session.
4. Cross-tenant reads/mutations remain rejected.
5. Manager cannot invite/disable/remove/change staff role.
6. Staff cannot perform staff-management actions.
7. Owner can perform authorized staff-management actions.
8. Disabling/removing/demoting the last active owner is rejected atomically.
9. With two active owners, one owner may be disabled/demoted/removed without violating the invariant.
10. Tenant bootstrap creates exactly one Shop + active Owner membership and rejects a second membership/bootstrap for the same V1 user.
11. Direct browser DML on `shops`/`staff_users` remains denied.
12. No service-role secret is reachable from client-side code/config.
## Verification Gate Before Reporting
Run and report real outputs for everything applicable:
- `supabase db reset`
- Phase 1/2 regression tests that remain valid in the full schema context
- New Phase 3 auth/tenant tests
- `supabase db lint --local`
- app lint/typecheck/build using the repository package manager/tooling
- `git diff --check`
- `git status --short`
- inspect final diff and confirm no Phase 4+ files/scope were added

If Docker/Supabase/Auth runtime prevents an executable test, report that test as **NOT VERIFIED**. Never replace runtime proof with static inspection and never claim `100%`, `production-ready`, or `VERIFIED` from compile-only evidence.

## Deliverables
All deliverables must physically exist under:
`D:\AI-Workspace\projects\saas-product-hub\products\PawSpace`

Expected categories:
- Phase 3 migration(s), if needed
- trusted server/auth implementation files
- Phase 3 executable tests
- any minimal test helpers/config required by those tests

Do not edit `docs/IMPLEMENTATION_STATUS.md` to claim VERIFIED. Reviewer/Claude owns promotion decisions.

## Final Report to Reviewer Gate 1
Report:
- exact local files created/modified
- exact local file paths
- concise explanation of each change
- commands executed + actual exit/result
- negative/security tests and their actual outcomes
- any known unverified behavior or remaining risk
- `git diff --stat`
- `git status --short`
- explicit confirmation: **NO COMMIT / NO PUSH**

Do not proceed to Phase 4. Stop after Phase 3 implementation and verification, leaving all changes in the local working tree for ChatGPT Reviewer Gate 1.