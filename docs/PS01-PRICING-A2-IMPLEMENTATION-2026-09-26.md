# PS01 Pricing Addendum A-2 — Implementation Brief

**Owner decision:** 2026-09-26, `D:\AI-Workspace\vault\06-Agent-Logs\WSTERA-House\STATUS-HOUSE.md`, Addendum A-2.
**Scope:** Update the existing monthly commercial catalog, stop offering Enterprise, preserve the existing entitlement limits and Founding C2 identity, update current pricing documentation/tests, and add a forward-only migration. No production DB apply or deployment.

## Locked product facts

- Starter: ฿590 / $17 monthly; 10 rooms and 300 pet records.
- Pro: ฿990 / $28 monthly; unlimited rooms and pets.
- Enterprise: ฿2,490 monthly, not for sale. Existing Enterprise customer assignments must not be rewritten; the migration aborts if it finds any.
- Founding C2: ฿990 / $28 monthly with Pro entitlements; unchanged.
- Annual prices are unapproved. This repository has nullable annual price fields, so the migration clears unapproved catalog numbers and rejects new annual assignments until an approved price exists. It aborts if it finds any existing annual shop assignment so no current shop's annual commercial state is silently changed.
- USD is not stored in the current commercial catalog; A-2 USD values are documented only. No currency conversion or new USD storage is added.
- No POS or grooming/bathing capabilities are added.

## Source-of-truth review

- `docs/PRD.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/BUSINESS_MODEL.md`, `docs/IMPLEMENTATION_STATUS.md`, `PHASE9_IMPLEMENTATION_EVIDENCE.md`, `PHASE13_IMPLEMENTATION_EVIDENCE.md`, and the PawSpace README were inspected.
- PawSpace Phase 13 uses tenant-scoped Postgres RPCs as subscription and entitlement authority. The current app has no customer pricing/checkout page; entitlement price data is returned through the secured dashboard path.
- The base commercial catalog had Starter 990/9900, Pro 1490/14900, Enterprise 2490/24900. Starter limits were 10 rooms/300 pets; Pro/Enterprise were unlimited. Founding C2 was Starter identity with Pro limits at monthly 990 and no annual price.
- Real production subscription rows were not queried. No production data was changed.

## Module Hub compatibility gate

**Module Reuse Check: COMPLETE** · **Reuse Gate: PASS** · **MT01 Bootstrap Check: N/A** — this is a catalog/pricing correction in an existing SaaS, not a new runtime/bootstrap.

| Candidate | Compatibility result | Evidence and reason |
|---|---|---|
| Module Hub `subscription` 0.1.0 | `ADAPTER ONLY` | Inspected `MODULE.md`, `DESIGN.md`, `examples/integration.example.ts`, core source, and `tests/unit/subscription.test.ts` at Module Hub commit `cd88c570ab57f6976d15f85d09973d0cfbf0cd63`. Its storage-agnostic subscription state engine cannot replace PawSpace's existing Postgres tenant authorization and quota RPC boundary. No lifecycle change or module copy is needed for this pricing-only phase. |
| Product-specific catalog availability and price facts | `NOT NEEDED` | The existing PawSpace catalog/RPC is the source of truth; this change updates that existing contract without adding a reusable capability. |

Module Hub remains read-only. No modules are copied into PawSpace.

## Planned implementation and acceptance

1. Add a new migration only; do not edit applied Phase 9/13 migrations. Abort before catalog edits if any shop subscription or assignment uses Enterprise or an annual billing interval.
2. Store approved THB monthly prices, set unapproved annual prices to `NULL`, keep room/pet entitlements unchanged, expose sale availability, and reject unavailable/annual-unpriced assignments.
3. Update TypeScript facts, SQL/unit assertions, and current business/customer documents while preserving historical phase briefs.
4. Run frozen install, lint, build, relevant unit/SQL tests, then inspect exact diff and secret-sensitive paths.
5. Commit, push, open a Thai-body PR to `master`; do not merge, deploy, or apply against a real database.

## Results

Pending verification and PR creation. Final evidence is recorded in `D:\AI-Workspace\runtime\relay\house-20260926\ps01price\REPORT-PS01-PRICE.md`.
