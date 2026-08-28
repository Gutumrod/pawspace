# Pawstia PMS — Commercial Readiness Checklist

> Purpose: Track transition from Closed Beta SaaS to commercial SaaS.

## Product

- [x] Core booking workflow implemented.
- [x] Daily Care Report workflow implemented.
- [x] LINE customer delivery workflow implemented.
- [x] Google Sheets export replica implemented.

## Business

- [x] Product positioning defined.
- [x] Pricing packages defined.
- [x] Founding Member strategy defined.
- [x] Sales playbook prepared.

## Before Paid Launch

- [x] Subscription lifecycle schema implemented (Phase 13: `shop_subscriptions`,
      `subscription_audit_log`, transition RPCs — `supabase/migrations/20260825141500_phase13_subscription_lifecycle.sql`,
      `20260825141600_phase13_subscription_hardening.sql`). This is the state-machine schema only;
      it is not connected to any payment collection.
- [ ] Payment collection absent. No payment/billing integration exists anywhere in the product by
      design (Phase 9/11 both explicitly scoped it out) — do not read the schema item above as
      revenue-collection capability.
- [ ] Upgrade/downgrade rules defined.
- [ ] Trial expiration handling defined.
- [ ] Suspension/reactivation workflow defined.

## Operations

- [ ] Production monitoring active.
- [ ] Backup and recovery tested.
- [ ] Incident response process active.
- [ ] Customer support process active.

## Legal

- [ ] Terms of Service finalized.
- [ ] Privacy Notice finalized.
- [ ] Data Processing Agreement reviewed.
- [ ] Vendor/subprocessor list verified.

## Brand

- [x] Commercial-name candidate locked: **Pawstia PMS** (initial public collision screening passed; not a substitute for formal legal clearance).
- [ ] Formal trademark/legal clearance completed for launch jurisdictions/classes.
- [ ] Production web address/routing confirmed.
- [ ] Official communication channels confirmed and claimed.

## Launch Decision

Commercial launch is approved only when all required launch gates are completed.
