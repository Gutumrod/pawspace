# PS01 Shared-Runtime Isolation Contract

**Date:** 2026-09-07
**Product:** Pawstia PMS / PS01
**Mode:** WSTERA BUILD-TO-SELL / PS01-ONLY SCOPE
**Status:** PROPOSED CANONICAL PS01 CONTRACT — planning only; no DB mutation

## 1. Owner Direction

PS01 will eventually run inside shared WSTERA LAB and shared WSTERA Production.

The requirement is not to give PS01 a private Supabase project. The requirement is:

> PS01 must coexist inside the shared runtime without touching another Product's data/schema, and other Products must have no authority to touch PS01-owned data/schema.

This document covers **PS01 only**. It does not define, inspect, modify, or authorize any other Product.

## 2. Hard Boundary

PS01 owns only Product-scoped namespaces and assets.

Target database namespaces:

- `ps01` — PS01 application/API surface
- `ps01_internal` — PS01 non-public/internal runtime objects

Supabase-managed shared namespaces remain external dependencies:

- `auth`
- `storage`
- `extensions`
- other Supabase-managed schemas
## 3. Current PS01 Drift

Current migrations assume a single-product database.

Confirmed current state:

- 13 migration files.
- 20 PS01-owned tables are currently created without schema qualification, therefore resolving to `public`.
- Many indexes, triggers, policies and grants also target unqualified object names.
- Almost every SECURITY DEFINER / helper function uses `SET search_path = public, pg_temp`.
- App/server code has no `.schema("ps01")` calls.
- Supabase local config exposes `public` and `graphql_public`; `ps01` is not yet configured.
- Daily Report Storage bucket is the generic `daily-report-photos`.
- Current admin client uses the project-wide Supabase service-role credential.

Therefore the current migration set must **not** be pushed into shared WSTERA LAB as-is.

## 4. PS01-Owned Table Placement

The following business tables belong under `ps01`:

- `shops`
- `staff_users`
- `pet_owners`
- `pets`
- `rooms`
- `bookings`
- `booking_pets`
- `booking_requests`
- `daily_reports`
- `commercial_packages`
- `shop_commercial_assignments`
- `shop_subscriptions`
The following runtime/audit/worker-oriented tables should be evaluated for `ps01_internal` rather than exposed by default:

- `google_sync_mappings`
- `sync_queue`
- `camera_visitor_credentials`
- `camera_rate_limit_buckets`
- `camera_access_audit`
- `import_batches`
- `subscription_audit_log`

`camera_settings` is PS01-owned but may remain in `ps01` if staff-facing settings require direct read access; otherwise keep it behind RPC and move it to `ps01_internal`.

Final placement must be driven by actual call paths, not table age or Phase number.

## 5. Function / RPC Contract

All PS01 functions must be explicitly schema-qualified.

Target pattern:

```sql
ps01.get_current_staff_context()
ps01.create_booking(...)
ps01.update_booking_status(...)
ps01.bootstrap_shop(...)
```

Internal-only helpers/workers should use `ps01_internal`.

No PS01 function may depend on `search_path = public, pg_temp` for object resolution.

Preferred rule:

```text
SECURITY DEFINER function
→ fixed safe search_path
→ schema-qualified PS01 object references
→ no unqualified cross-schema lookup
```
## 6. Auth Boundary

`auth.users` is shared identity infrastructure. PS01 does not own it.

PS01 authorization is determined by PS01 membership only:

```text
auth.users.id
   ↓
ps01.staff_users.id
   ↓
PS01 shop / role / active membership
```

A valid Supabase user with no active row in `ps01.staff_users` has **zero PS01 business authority**.

PS01 RLS and authoritative RPCs must continue deriving shop membership from PS01-owned data, never from another Product's membership or generic shared metadata.

## 7. End-User Data API Permissions

For signed-in users:

- grant `USAGE` only on the exposed `ps01` schema needed by PS01;
- enable RLS on every user-reachable PS01 table;
- direct write grants remain denied where PS01 already uses authoritative RPCs;
- grant only the minimum `SELECT` and `EXECUTE` required by current UI/server flows;
- `anon` receives no broad schema/table authority;
- public customer flows, if retained, must enter through individually reviewed RPCs/routes only.

Cross-Product users cannot gain PS01 access merely because they are `authenticated`; PS01 membership/RLS remains mandatory.

## 8. Critical Privileged-Runtime Boundary

Current `getSupabaseAdminClient()` uses the project-wide service-role credential.

This is **not sufficient for strict Product isolation** in a shared project because service role bypasses RLS and is project-scoped.

Therefore PS01 must not use a shared `service_role` credential as its normal database data-plane identity in the target shared runtime.
Target privileged identities:

- `ps01_runtime` — product-scoped backend role/credential for PS01 only
- optional `ps01_worker` — narrower worker role if LINE/Google/internal workers need a distinct boundary

Required properties:

- no grants on non-PS01 schemas;
- no `BYPASSRLS` unless a specific PS01 operation proves it is required;
- no ownership of shared schemas;
- no ability to create/drop arbitrary objects outside PS01 namespaces;
- credential stored only in PS01 server-side secrets;
- credential must be independently rotatable.

Implementation options to validate in LAB before code lock:

1. Supabase/PostgREST custom Postgres role selected by a signed JWT `role` claim, where PS01 receives only the bounded runtime token and never the project signing material; or
2. direct PostgreSQL connection using a restricted PS01 database role if the Data API route cannot provide the required isolation cleanly.

This document does not authorize either implementation yet. The smaller solution that proves the boundary wins.

Project-wide service/secret key may remain necessary for Supabase Auth Admin operations, but that must not silently become PS01's general database credential. If Auth Admin remains required, isolate it behind a separately reviewed narrow adapter/broker boundary.

**Hard gate:** PS01 does not enter shared LAB until this privileged-runtime boundary has executable proof.

## 9. Storage Boundary

The generic bucket name `daily-report-photos` is not acceptable for shared-runtime namespace hygiene.

If Automated Daily Report remains deployed, target bucket identity:

```text
ps01-daily-report-photos
```
Object paths remain tenant-scoped inside the PS01 bucket:

```text
{shop_id}/{booking_id}/{pet_id}/{idempotency_key}/...
```

Storage policies/operations must not grant PS01 code access to another Product's bucket.

Managed `storage` schema is not PS01-owned and must not be modified outside supported bucket/policy mechanisms.

## 10. Migration Ownership Rules for PS01

PS01 migrations may create/alter/drop only:

- `ps01.*`
- `ps01_internal.*`
- explicitly PS01-prefixed Storage assets/policies
- references to managed shared identity such as `auth.users`, without mutating that managed schema

Forbidden from a PS01 migration:

- unqualified `CREATE TABLE` / `CREATE FUNCTION` that lands in `public`;
- `DROP` or `ALTER` on an object not provably PS01-owned;
- broad `GRANT ALL` on shared schemas;
- changing shared project roles outside the bounded PS01 role setup;
- changing another Product's schema or privileges;
- destructive project-wide reset in WSTERA LAB/Production.

Every migration must be auditable with a write-scope check before apply.

## 11. Source-Code Changes Required Before LAB

Current source relies on the default `public` schema.

The namespace remediation plan must update Supabase clients/calls so PS01 data-plane queries and RPC calls resolve to `ps01` explicitly.

Expected patterns include:

```ts
createClient(url, key, { db: { schema: "ps01" } })
```

or explicit per-call `client.schema("ps01")` where a different schema is intentionally required.
Internal runtime code should explicitly target `ps01_internal` only where intended; this schema must not be listed as a normal exposed Data API schema.

The PS01 Supabase config/profile used for shared LAB must stop treating `public` as the PS01 application schema.

## 12. PS01 Migration Role

To prevent PS01 migrations from becoming a project-wide DDL credential, target a dedicated database role:

```text
ps01_migrator
```

Required authority:

- owns `ps01` and `ps01_internal` schemas;
- may create/alter/drop objects inside those schemas;
- has no ownership or DDL rights over another schema;
- no broad `CREATE` privilege on the database after PS01 schema bootstrap;
- independently rotatable credential;
- never used by the application runtime.

Shared platform super-admin roles remain technically capable of administration by definition; they are outside Product runtime authority. The rule here is that **no other Product runtime/migrator credential receives PS01 privileges**.

## 13. Migration History Isolation

Standard `supabase db push` from this repo must not be treated as safe against a shared project merely because SQL is schema-qualified.

Reason: Supabase migration history is project-scoped, while this repository currently owns only PS01 history.

PS01 target therefore requires a Product-scoped migration ledger, for example:

```text
ps01_internal.schema_migrations
```

and a PS01-specific migration lock so two PS01 deployers cannot race.

The migration runner must:

1. connect as `ps01_migrator`;
2. verify target project/environment identity;
3. acquire PS01 migration lock;
4. verify every migration write target is PS01-owned;
5. apply only pending PS01 migrations;
6. record checksum + timestamp + release identity in PS01's ledger;
7. release lock;
8. fail closed on any out-of-scope SQL.
## 14. Historical Migration Preservation

The existing 13 migrations are valuable historical Phase evidence but cannot be replayed unchanged into shared LAB because they create unqualified `public` objects.

Recommended implementation strategy:

- preserve the current 13 migration files verbatim as legacy/historical evidence;
- create a fresh PS01 shared-runtime migration stream that materializes the same accepted final state directly into `ps01` / `ps01_internal`;
- do **not** create objects in `public` and move them later inside shared LAB;
- prove the new baseline is semantically equivalent to the accepted PS01 final schema before using it.

This avoids temporary collisions and avoids rewriting historical evidence as if it had always been namespaced.

## 15. Isolation Acceptance Tests

Before WSTERA LAB apply, PS01 must pass at least:

### Namespace
- zero PS01 table/function/trigger/policy created in `public`;
- zero unqualified PS01 DDL;
- zero `search_path = public, pg_temp` in active shared-runtime PS01 functions;
- all PS01 Storage assets are PS01-prefixed.

### User isolation
- valid authenticated user with no `ps01.staff_users` row: no PS01 business access;
- PS01 staff from Shop A cannot read/write Shop B;
- inactive PS01 staff cannot operate;
- direct DML remains denied where RPC is authoritative.

### Product isolation
- `ps01_runtime` cannot `USAGE`, `SELECT`, `EXECUTE`, `CREATE`, `ALTER` or `DROP` outside PS01-owned schemas except explicitly required managed interfaces;
- a non-PS01 custom role with no grants cannot read/write/execute PS01 objects;
- PS01 migration role cannot alter/drop a non-PS01 object;
- PS01 migration fails closed if SQL references an unauthorized schema.

### Managed boundary
- `auth.users` may be referenced but not structurally mutated by PS01 migrations;
- Storage access is limited to PS01-owned buckets/paths;
- no project-wide reset is used for LAB/Production proof.
## 16. PS01-Only Implementation Sequence

No other Product is required to change for this PS01 workstream.

### Step 1 — freeze boundary
- accept `ps01` / `ps01_internal` ownership model;
- lock PS01 runtime/migrator role requirements;
- lock PS01 Storage prefix.

### Step 2 — build namespaced migration baseline
- derive accepted final schema from the 13 historical migrations;
- generate PS01 shared-runtime migration stream;
- preserve historical migrations unchanged outside the active shared-runtime stream;
- add PS01 migration ledger/checksum mechanism.

### Step 3 — make source schema-aware
- configure user/server Supabase clients for `ps01`;
- schema-qualify intentional `ps01_internal` access;
- update RPC/table calls and generated types;
- rename Storage bucket constant to PS01-prefixed target.

### Step 4 — remove global privileged data-plane assumption
- inventory every current `getSupabaseAdminClient()` call;
- move normal PS01 DB/worker work to `ps01_runtime` / `ps01_worker` authority;
- isolate any remaining Auth Admin requirement behind the narrowest reviewed boundary.

### Step 5 — local/isolated verification
- migration equivalence tests;
- typecheck/lint/build;
- existing tenant isolation regression;
- new Product-boundary negative tests;
- migration write-scope tests.

### Step 6 — only then request WSTERA LAB apply
- no `db push` directly from the legacy stream;
- apply PS01 migration stream with PS01 migrator authority;
- smoke PS01 only;
- prove no non-PS01 object changed.

## 17. Current Decision

**PS01 shared-runtime design: ACCEPTED FOR PS01 IMPLEMENTATION.**
**Namespaced baseline generation: COMPLETE (static proof).**
**PS01 source client schema pinning: COMPLETE (`ps01`).**
**Historical 13 migrations: PRESERVED / UNMODIFIED.**
**Project-wide service-role removal from Closed Beta core: PROVEN by source inventory; optional/admin paths remain gated.**
**Database apply/equivalence proof: BLOCKED until an isolated local PostgreSQL/Supabase sandbox is available.**
**WSTERA LAB mutation: NOT AUTHORIZED until DB proof passes.**

Current implementation artifacts:
- `scripts/generate-ps01-shared-runtime-baseline.mjs`
- `scripts/verify-ps01-shared-runtime-boundary.mjs`
- `supabase/shared-runtime/ps01-baseline.sql`
- `lib/ps01-schema.ts`

Next gate: apply the generated baseline only in an isolated PS01 sandbox, then run migration equivalence + product-boundary negative tests before any WSTERA LAB apply.
