# PawSpace — Phase 13 Execution Brief

## Subscription Lifecycle & Commercial Entitlement Enforcement

**Repository:** `Gutumrod/pawspace`  
**Local path (Windows):** `D:\AI-Workspace\projects\saas-product-hub\products\PawSpace`  
**Branch:** `master`  
**Verified baseline before brief creation:** `dc5281e`  
**Phase 12 implementation baseline:** `d988010`  
**Phase 13 status:** `OPEN — IMPLEMENTATION NOT STARTED`

---

## 1. Phase Objective

Phase 13 converts PawSpace's existing package/entitlement model into an authoritative SaaS subscription lifecycle and enforces commercial limits at trusted server/database boundaries.

This phase is deliberately **provider-agnostic**. It prepares PawSpace for paid operation without adding a payment gateway.

The result must answer authoritatively for every shop:

- What subscription state is this shop in?
- Which commercial package/offer applies?
- Which features and numeric limits are effective now?
- Can this requested mutation proceed under the current entitlement?
- What subscription transition happened, who/what caused it, and when?

Phase 13 must preserve all Phase 1–12 product, tenant-isolation, booking, LINE, Google Sheets, onboarding, and security invariants.
---

## 2. Mandatory Source of Truth Order

Before changing code, read and reconcile the real repository in this order:

1. `AGENTS.md`
2. `docs/PRD.md`
3. `docs/SYSTEM_ARCHITECTURE.md`
4. `docs/BUSINESS_MODEL.md`
5. `docs/ROADMAP.md`
6. `docs/COMMERCIAL_READINESS.md`
7. `docs/PRODUCTION_OPERATIONS.md`
8. `docs/IMPLEMENTATION_STATUS.md`
9. `PHASE9_IMPLEMENTATION_EVIDENCE.md`
10. `PHASE12_IMPLEMENTATION_EVIDENCE.md`
11. Existing Phase 9 entitlement migration/tests and all current mutation RPCs affected by quota enforcement.

If documentation and executable schema/code disagree, do not guess. Record the discrepancy, determine the authoritative contract from the higher-ranked Source of Truth plus already-passed security invariants, and make the minimum coherent Phase 13 change.

Before implementation, prove:

- correct repository path;
- branch is `master`;
- current HEAD and `origin/master` relationship;
- working tree is clean or all pre-existing changes are explicitly accounted for;
- local dependencies and Supabase stack can run.
---

## 3. Locked Business Contract

Canonical V1 packages remain exactly as already defined:

| Package | Monthly | Annual | Room Limit | Pet Record Limit | Support |
|---|---:|---:|---:|---:|---|
| Starter | 990 THB | 9,900 THB | 10 | 300 | standard/default |
| Pro | 1,490 THB | 14,900 THB | unlimited | unlimited | standard/default |
| Enterprise | 2,490 THB | 24,900 THB | unlimited | unlimited | priority |

**Founding Member C2 is locked:**

- commercial price: 990 THB/month;
- effective product entitlement: Pro-level room/pet limits;
- non-transferable between shops;
- future paid add-ons are not automatically included;
- benefit persists only while the subscription is considered continuously maintained.

Phase 13 does **not** invent payment truth. Until a payment provider exists, continuity/lapse transitions must be driven only by an explicitly authorized trusted/admin/system path and be fully audited.

Do not scatter `if plan === ...` checks throughout UI/server code. Effective entitlement must resolve through one canonical authority shared by every enforcement point.
---

## 4. Canonical Subscription Lifecycle

Phase 13 must define one authoritative persisted subscription record per shop. Do not maintain two independent sources of truth.

Required lifecycle states:

- `trialing` — trial is active and entitlements are available;
- `active` — paid/approved commercial access is active;
- `past_due` — renewal/payment problem has been recorded but access policy has not yet reached suspension;
- `grace_period` — temporary access window after `past_due`;
- `suspended` — commercial access is blocked by an authorized administrative/system decision;
- `cancel_at_period_end` — remains entitled until the authoritative period end;
- `cancelled` — terminal cancellation; commercial entitlements disabled;
- `expired` — trial/period/grace ended without valid continuation; commercial entitlements disabled.

Minimum transition contract:

`trialing -> active | expired | cancelled`  
`active -> past_due | cancel_at_period_end | suspended | cancelled`  
`past_due -> active | grace_period | suspended | cancelled`  
`grace_period -> active | expired | suspended | cancelled`  
`cancel_at_period_end -> active | expired | cancelled`  
`suspended -> active | cancelled | expired`

Illegal transitions must fail closed. A caller must never update a raw status column directly from the browser.
---

## 5. Required Authoritative Data Model

Implementation may adapt names to the existing schema, but the following facts must exist authoritatively:

- shop/tenant id;
- package id;
- commercial offer (`standard` / `founding_member`);
- lifecycle status;
- trial start/end;
- current period start/end;
- grace period end when applicable;
- cancel-at-period-end flag/state;
- cancellation/suspension timestamps when applicable;
- last lifecycle reason/source;
- created/updated timestamps.

If the existing `shops.subscription_status` field still exists, inspect its actual use first. It must not remain an independent competing authority. Either migrate/deprecate it safely or make it a derived compatibility field with tests proving no divergence.

The existing Phase 9 `commercial_packages` and `shop_commercial_assignments` facts must be preserved unless a migration is explicitly justified. Avoid destructive rewrites of passed Phase 9 migrations; add a new Phase 13 migration.

All commercial tables must be tenant-safe and deny generic browser DML. Sensitive commercial mutations must use authoritative `SECURITY DEFINER` RPCs or trusted server-only services with explicit role checks.
---

## 6. Effective Entitlement Rules

The existing Phase 9 package facts remain canonical. Phase 13 adds lifecycle awareness.

Effective entitlement must be derived from **subscription state + package + commercial offer**, not UI assumptions.

Required access policy:

- `trialing`: package/offer entitlements active;
- `active`: package/offer entitlements active;
- `past_due`: entitlements remain active until policy moves the record onward;
- `grace_period`: entitlements remain active until `grace_period_end`;
- `cancel_at_period_end`: entitlements remain active until `current_period_end`;
- `suspended`: commercial mutation access blocked;
- `cancelled`: commercial mutation access blocked;
- `expired`: commercial mutation access blocked.

Founding Member on Starter must continue resolving to Pro room/pet limits while the Founding Member contract is valid.

Do not fake lifecycle timing with browser clocks. Time-based checks must use authoritative server/database timestamps. Business dates that are date-based must continue using PawSpace's `Asia/Bangkok` contract where relevant.

Read-only owner/manager visibility may still show subscription information when access is suspended/expired; enforcement must not lock operators out of the information required to understand the account state.
---

## 7. Hard Quota Enforcement — Starter

Phase 13 must finally enforce the Phase 9/Business Model quotas at authoritative mutation boundaries.

### Room limit

- Starter standard: maximum 10 room records per shop.
- Pro / Enterprise / valid Founding Member: unlimited.
- Enforcement belongs in the authoritative room-creation path, not only the onboarding UI.
- Concurrent room creation must not allow two requests to pass a `9 -> 11` race.

### Pet record limit

- Starter standard: maximum 300 current pet records per shop.
- Pro / Enterprise / valid Founding Member: unlimited.
- Enforce on every authoritative path capable of creating pets, including CSV import.
- CSV import must calculate prospective new pets inside the same authoritative transaction and reject the whole batch if it would exceed the limit.
- Duplicate/skipped rows must not consume quota.
- Do not count records from another tenant.

If the existing schema has no archival/soft-delete semantics, quota is based on current rows in `pets`; do not invent an archived state in this phase.

Quota failures must return deterministic, user-safe errors without leaking tenant counts or data from another shop.
---

## 8. Trusted Lifecycle Mutation Surface

No customer-facing payment control is required in Phase 13.

Provide a minimal trusted mutation surface sufficient for beta/commercial operations and future payment integration:

- create/initialize a shop subscription;
- activate after trial/manual approval;
- mark `past_due`;
- enter/exit grace period;
- suspend/reactivate;
- schedule cancellation at period end;
- cancel immediately where explicitly authorized;
- mark expired;
- change package/offer under an authorized owner-of-platform/admin path.

These operations must not be generic browser-writable CRUD.

Store an explicit transition reason/source such as `manual_admin`, `system`, `future_billing_event`, or another bounded enum/string contract. Do not accept arbitrary untrusted metadata that can forge actor identity.

Future payment webhooks must be able to call the same domain transition authority rather than bypassing it with direct table writes.

Every mutation must be idempotent where retries are plausible and must fail closed on illegal state transitions.
---

## 9. Auditability

Subscription/package/offer changes require an append-only audit trail containing at minimum:

- shop id;
- subscription id;
- actor type and actor id when applicable;
- action/transition;
- previous state;
- resulting state;
- reason/source;
- timestamp.

Audit storage must not expose generic browser UPDATE/DELETE/TRUNCATE.

Do not record secrets, access tokens, payment credentials, or unnecessary customer PII in the audit payload.

If audit recording is performed inside the database transaction, a successful commercial transition and its audit record must commit together. If a host-side adapter is used, document the failure semantics explicitly and do not claim atomicity that does not exist.

Owner/Manager-facing UI does not need a full audit-log browser in this phase; executable audit evidence and trusted queryability are sufficient.
---

## 10. Mandatory Module Hub Compatibility Gate

Module Hub was inspected from `D:\AI-Workspace\projects\modules-hub` before this brief was written.

| Candidate | Version | Verdict | Phase 13 rule |
|---|---:|---|---|
| `modules/subscription` | 0.1.0 | **ADAPTER ONLY** | Reuse domain vocabulary, entitlement-query pattern, idempotent-event concept, and repository separation ideas only. Do **not** replace PawSpace's authoritative Phase 9 entitlement/security boundary with this module wholesale. Its verified gaps include no automatic grace transition, unused `gracePeriodDays`, monthly period creation even for annual plans, and entitlement access remaining active for `past_due`/`grace_period` by generic module behavior. |
| `modules/audit-log` | 0.1.0 | **ADAPTER ONLY** | Reuse append-only, actor/action/entity, redaction, immutable-snapshot conventions. Do not copy its Postgres DDL blindly: its own docs confirm Supabase direct role grants require explicit per-role revocation, and a host-side adapter would not automatically be transaction-atomic with subscription state changes. |
| `modules/payment` | 0.1.0 | **NOT NEEDED** | Payment collection/provider integration is explicitly Phase 13 non-scope. |
| `modules/feature-flags` | 0.1.0 | **NOT NEEDED** | Commercial entitlement is not a rollout flag and must stay in PawSpace's authoritative entitlement model. |
| `modules/tenant-context` | 0.3.0 | **NOT NEEDED** | PawSpace already has passed tenant isolation via Supabase RLS/current staff shop authority. |
| `modules/auth-supabase` | 0.2.0 | **NOT NEEDED** | Existing PawSpace auth/staff membership boundary remains authoritative. |

Because the relevant modules are `ADAPTER ONLY`, Phase 13 must not import across filesystem paths and must not modify Module Hub.

If the implementer later believes a complete module copy is required, stop and re-run the compatibility gate against the real source before changing the verdict.
---

## 11. Owner/Manager Commercial Status UI

Extend the existing owner/manager dashboard or entitlement surface only as much as needed to make commercial state understandable.

Display at minimum:

- effective package name;
- Founding Member status where applicable;
- lifecycle status;
- trial end or current period end when applicable;
- effective room limit and current room usage;
- effective pet-record limit and current pet usage;
- clear blocked/expired/suspended notice when mutations are restricted.

UI must consume authoritative server data. It must not recompute plan truth independently from hard-coded client constants.

Do not add fake checkout, fake payment success, credit-card forms, PromptPay QR, SlipOK, invoice UI, or "Upgrade now" flows that imply a payment provider exists.

Presentation should remain aligned with `docs/Design.md`; Phase 13 is primarily commercial-domain/security work, not a general redesign.
---

## 12. Explicit Non-Scope

Do not implement any of the following in Phase 13:

- Stripe or any payment provider SDK;
- PromptPay payment collection;
- SlipOK verification;
- invoice/e-Tax automation;
- card storage or payment credentials;
- public self-service billing portal;
- automated payment retries/dunning emails;
- legal finalization;
- production monitoring/backup infrastructure;
- multi-branch functionality;
- grooming, vaccine, AI, or unrelated feature expansion;
- rewrite of Phase 1–12 authoritative migrations;
- broad design-system refactor.

Phase 13 ends when lifecycle + entitlement + quota enforcement are trustworthy and provider-ready, not when money can actually be collected.
---

## 13. Required Test Matrix

Phase 13 must add dedicated executable tests for at least:

### Subscription lifecycle
- initialization and trial dates;
- every allowed transition;
- every important illegal transition;
- cancel-at-period-end behavior before/after period end;
- suspension/reactivation;
- terminal cancelled/expired access behavior;
- idempotent retry behavior where applicable;
- cross-tenant and unauthorized transition rejection.

### Entitlements
- Starter standard = 10 rooms / 300 pets;
- Pro = unlimited room/pet limits;
- Enterprise = unlimited + priority support fact preserved;
- Founding Member Starter = Pro room/pet entitlement at 990 commercial offer;
- suspended/cancelled/expired shops fail closed for commercial mutations;
- no assignment/invalid state fails closed rather than silently granting Pro.
### Hard quota and concurrency
- Starter room usage `9 -> 10` succeeds and `10 -> 11` fails;
- concurrent room creation cannot exceed the effective room limit;
- Starter pet usage `299 -> 300` succeeds and `300 -> 301` fails;
- concurrent pet creation/import cannot exceed the effective pet limit;
- CSV duplicates/skipped rows do not consume quota;
- CSV batch exceeding prospective quota rolls back atomically with no partial writes/audit corruption;
- quota counts are strictly tenant-scoped;
- Pro, Enterprise, and valid Founding Member paths remain unlimited for room/pet limits.

### Audit and security
- every successful subscription transition creates the expected immutable audit evidence;
- failed/illegal transitions do not create a false success audit record;
- browser roles cannot update/delete/truncate commercial audit history;
- unauthorized staff, inactive users, no-membership users, and cross-tenant callers cannot mutate subscription state;
- anonymous/authenticated privilege probes confirm no generic DML path exists;
- errors and audit payloads contain no secrets or credentials.

### Regression
- Phase 9 entitlement tests remain green;
- Phase 12 onboarding/import tests remain green;
- all directly touched room/pet mutation tests remain green;
- run additional Phase 1–12 suites whenever their production files/RPCs are touched.
---

## 14. Required Quality Gates

Before requesting Gate 1 review, execute from a clean local Supabase baseline where applicable:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
git diff --check
pnpm exec supabase db reset
pnpm exec supabase db lint --local
```

Also run the dedicated Phase 13 database security/lifecycle tests and TypeScript/domain tests, then rerun Phase 9 entitlement, Phase 12 onboarding/import, and every earlier regression suite whose production surface was changed.

Do not report a pass from stale output or reused database state. Record exact commands and exact pass/fail counts in Phase 13 evidence.