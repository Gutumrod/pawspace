# PS01 Mac Local Shared-Runtime Proof Evidence — 2026-09-07

**Product:** Pawstia PMS / PS01
**Scope:** PS01 only
**Environment:** Mac local isolated Supabase sandbox
**WSTERA LAB:** NOT TOUCHED

## Result

**Verdict: PASS for local shared-runtime proof.**

The PS01 namespaced baseline was applied from a fresh isolated local Supabase sandbox using dedicated ports `54421–54427`. The proof did not replay the 13 historical `public` migrations directly.

Observed proof result:

```text
PS01_DB_PROOF_PASS
ps01_tables = 20
ps01_functions = 76
PS01_LOCAL_FIXTURE_PASS
PS01_PREPARE_PASS
```

The fixture created one local-only shop, room, pet owner, pet, and booking.## Verified Boundaries

- `ps01` and `ps01_internal` were created successfully.
- `ps01_runtime` is not SUPERUSER and does not have BYPASSRLS.
- A foreign probe role had no PS01 access.
- `ps01_runtime` had no authority to cross into the foreign probe schema or create in `public`.
- The canonical PS01 migration ledger existed after apply.
- Historical migrations remained preserved and unmodified.
- The application runtime schema remained pinned to `ps01`.
- Closed Beta core source had no project admin-client dependency.

## Application Smoke

Pawstia was started locally on `127.0.0.1:3100` without `SUPABASE_SERVICE_ROLE_KEY` in the Next.js process.

Automated login smoke succeeded and reached the real tenant operations workspace. The returned page showed the local test shop, room A-01, pet Milo, and the seeded booking from the isolated database.

The local test credential was ephemeral test data only and is not a production credential.## Harness Defects Found and Remediated

1. The static verifier depended on `rg`, which was not installed on this Mac. The verifier was changed to use Node filesystem traversal instead.
2. The baseline source hash differed across Windows/Mac due to line endings. The generator now canonicalizes migration source text to LF before hashing.
3. The proof sandbox originally inherited default Supabase local ports. It now uses a dedicated PS01 proof port range to avoid existing local stacks.
4. The first role assertion attempted `SET ROLE ps01_runtime`, but the Supabase local `postgres` role cannot assume that role. The proof now validates effective privileges and role attributes directly from PostgreSQL catalogs.

## Cleanup

- Pawstia dev server on port 3100 was stopped.
- The isolated `ps01_shared_runtime_proof` Supabase sandbox was stopped and removed.
- Existing PawSpace and OmniDesk local Supabase stacks were left running and were not modified by this cleanup.
- Colima was intentionally left running because stopping it would affect those unrelated local stacks.

## Next Gate

Local DB proof is complete. Any WSTERA LAB apply remains a separate explicit authorization gate. Booking Model V2 / Rate Plan remediation is still planning-only and was not implemented in this proof round.