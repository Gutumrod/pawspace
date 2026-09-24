# PS01 Pawstia PMS — Continue-to-First-Store Closed Beta Execution Brief

**Date:** 2026-09-24  
**Product:** Pawstia PMS / PS01  
**Repository:** `Gutumrod/pawspace`  
**Owner direction:** CONTINUE BUILD-TO-SELL UNTIL FIRST REAL STORE IS OPERATING  
**Execution status:** **ACTIVE — MUST CONTINUE**  
**Stop boundary:** Stop after the first real store is successfully onboarded and operating the approved Closed Beta core. Do **not** continue into general paid launch, PS-SR-05, or PS-SR-06 without a new Owner decision.

---

## 1. Mission

Move PS01 from the current engineering-complete / pre-release state to a **real first-store Closed Beta** with evidence that the store can operate its daily PMS workflow safely and reliably.

This is not a feature-expansion pass.

Primary objective:

> Prove that one real pet-hospitality store can use Pawstia PMS for its actual daily operational loop without cross-tenant leakage, unsafe runtime shortcuts, unverified production assumptions, or unacceptable operational friction.

Priority order:

`release safety → real-store core workflow → privacy/security → recoverability → usability → optional features`

Do not optimize for feature count.

---

## 2. Verified starting point

### Canonical master

As verified on 2026-09-24:

- Phase 1–13 engineering work is closed and Phase 13 was merged to `master` via PR #4 on 2026-09-06.
- Current canonical `master` includes the later locked Care Engine product principle.
- Product Gate = PASS.
- Business/Market Gate = PASS.
- Payment collection = not implemented.
- General paid launch = not ready.

### Post-master work requiring reconciliation

Branch:

`work/ps01-h3d-data-api-20260909`

contains later PS01 work not yet canonicalized into `master`, including:

- Booking V2;
- room Rate Plans;
- HOUR / DAY / MONTH booking semantics;
- historical quote snapshot behavior;
- overlap / capacity / maintenance protections;
- Customer LINE booking request → Staff confirmation flow;
- H3D Data API runtime path;
- shared-runtime / WSTERA LAB isolation work;
- focused verification evidence and Owner manual-test runbook.

Known latest evidence on that branch:

- H3D Data API static proof: PASS 7/7;
- Booking V2 focused contract: PASS 8/8;
- Camera core: PASS 22/22;
- entitlement regression: PASS 5/5;
- TypeScript: PASS;
- ESLint: PASS;
- production build: PASS;
- PS01 shared-runtime boundary verifier: PASS;
- fresh DB-backed acceptance: still required;
- live H3D Customer proof: still required;
- Owner manual O-01..O-16: still pending.

Historical or branch-local PASS evidence must not be silently promoted into current release evidence. Re-run the required gates against the exact candidate that will be released.

---

## 3. Scope lock

### Closed Beta critical path

The first-store Closed Beta critical path is:

1. Shop onboarding
2. Staff authentication / authorization
3. Rooms
4. Customers / pet owners
5. Pets
6. Booking
7. Check-in
8. Active stay visibility
9. Check-out
10. Cleaning / room return to available
11. Staff / permission boundaries
12. Operational status visibility

### Included when already required by the candidate

Booking V2 and Customer LINE booking may remain in the release candidate if they are already part of the selected candidate branch and pass their release gates.

### Not first-store blockers

The following completed or planned capabilities must not delay the first real-store core beta unless real-store workflow evidence proves they are required:

- Camera;
- Automated Daily Report delivery;
- future Care Engine;
- Daily Update Reminder;
- advanced multi-branch;
- grooming;
- vaccine/recall automation;
- general public payment collection.

Preserve completed work. Do not delete or weaken historical functionality merely to make the beta pass.

### Payment boundary

Payment / deposit integration remains deferred pending review of the actual stable SB01 Shared Billing Core contract.

Do not create a separate PS01 payment architecture during this brief.

---

## 4. Mandatory working rules

1. Verify repository / branch / HEAD / clean state before every execution block.
2. Source code and current runtime evidence override conversation memory.
3. Never use production data to prove staging/LAB behavior.
4. Never expose or commit secrets.
5. Never use `service_role`, admin credentials, direct table edits, or bypass grants as a substitute for a blocked normal runtime path.
6. Preserve tenant isolation, authoritative RLS/RPC boundaries, entitlement authority, and subscription invariants.
7. Any defect found during Owner testing must remain recorded as the original FAIL even after remediation; append retest evidence.
8. A blocker is a blocker. Do not invent a workaround that changes the security or product contract.
9. Before implementation of any new capability, follow the Module Hub reuse gate in `AGENTS.md`.
10. After implementation changes, run the relevant test / lint / typecheck / build / DB / E2E gates before claiming completion.

---

## 5. Module Hub compatibility gate

### Current brief-wide classification

**Immediate release-validation / deployment / real-store onboarding work:** `NOT NEEDED`

Reason: the current objective is to validate, reconcile, deploy, harden and operate already-built PS01 capabilities rather than add a new reusable capability.

### Re-check trigger

If any stage below requires a new capability or subsystem rather than a bounded defect fix/configuration change:

1. STOP implementation.
2. Read current Module Hub `README.md`, `INDEX.md`, `SECURITY.md`, and `modules/REGISTRY.md`.
3. Inspect the relevant candidate module source, version, status, tests, limitations and host responsibilities.
4. Record one of:
   - `APPROVED TO REUSE`
   - `ADAPTER ONLY`
   - `NOT COMPATIBLE`
   - `NOT NEEDED`
5. Continue only after compatibility is explicit.

---

# EXECUTION PLAN

## Gate A — Reconcile the actual release candidate

### Goal

Determine exactly what code is intended to enter the first-store candidate and remove branch/document ambiguity before runtime testing.

### Required work

1. Compare:
   - `master`
   - `build/ps-sr02-staging-2026-09-06`
   - `work/ps01-h3d-data-api-20260909`
2. Identify every non-canonical commit/file required for:
   - shared-runtime isolation;
   - Booking V2;
   - H3D Data API Customer LINE path;
   - test/runbook evidence.
3. Check for stale or conflicting documents.
4. Establish one release-candidate branch from current canonical `master`.
5. Bring forward only verified required work.
6. Do not blindly merge stale branch history when a clean, auditable cherry-pick/reconciliation is safer.
7. Record candidate branch, HEAD and diff summary.

### Exit criteria

- one explicit release-candidate branch;
- exact commit provenance known;
- no unexplained branch divergence;
- no stale runtime description presented as current;
- `git diff --check` clean;
- candidate scope documented.

### STOP conditions

- unexplained security/runtime drift;
- conflicting schema authority;
- unknown source of a critical runtime file;
- non-reproducible branch state.

---

## Gate B — H3D / WSTERA LAB runtime readiness

### Goal

Prove the normal Customer LINE path and Staff path operate against the intended isolated PS01 runtime boundary without privileged fallback.

### Required prerequisites

- WSTERA LAB only;
- intended hosted Custom Access Token Hook active;
- normal Staff test identity available;
- Customer LINE test identity available;
- finite `ps01_line_runtime` grant;
- fresh Auth-issued runtime JWT injected through environment configuration;
- valid LAB LINE / LIFF configuration;
- no production credential or real customer data.

### Required proof

1. Re-run H3D static proof.
2. Re-run shared-runtime boundary verifier.
3. Prove Customer LINE path uses the Data API adapter.
4. Prove only allowlisted RPCs are callable.
5. Prove no service-role/admin/table fallback exists.
6. Run a live LAB Customer context/quote/request path.
7. Prove cross-shop denial.
8. Prove failure remains fail-closed if runtime token/grant/config is missing.

### Exit criteria

`H3D LIVE PASS`

with exact branch/HEAD, runtime identity, evidence timestamp and no privileged fallback.

### STOP conditions

- hosted hook not verifiably active;
- runtime JWT provenance unclear;
- broad grant instead of finite runtime authority;
- service-role/admin fallback required;
- cross-shop access succeeds;
- any production secret/data becomes necessary.

---

## Gate C — Fresh DB-backed Booking V2 acceptance

### Goal

Re-prove Booking V2 against the current candidate and current LAB runtime after the shared-runtime/H3D work.

Historical 21/21 evidence is not sufficient by itself.

### Required cases

At minimum prove:

- HOUR plans;
- DAY plans;
- calendar MONTH semantics;
- quote snapshot preservation;
- overlap rejection;
- exact back-to-back acceptance;
- room maintenance collision;
- room capacity;
- inactive Rate Plan rejection;
- Staff booking flow;
- Customer quote parity where applicable;
- Customer request → Staff confirm;
- decline path;
- confirmation-time revalidation race;
- lifecycle through check-in / check-out / cleaning;
- tenant isolation.

### Exit criteria

Fresh DB-backed acceptance = PASS against the exact release candidate.

All fixture creation/cleanup must remain LAB-only and auditable.

---

## Gate D — Owner manual acceptance O-01..O-16

### Goal

Release the product to the Owner for human browser/mobile testing only after Gates B and C pass.

### Authority

Use and reconcile the existing Owner manual runbook under `docs/testing/`.

The Owner is the tester. Agents prepare the environment, evidence structure and defect triage; they must not fabricate Owner observations.

### Required cases

- O-01 Login/dashboard
- O-02 Room + Rate Plans
- O-03 1 HOUR quote snapshot
- O-04 3 HOUR duration
- O-05 overlap/back-to-back
- O-06 DAY + calendar MONTH
- O-07 maintenance + capacity
- O-08 inactive Rate Plan
- O-09 historical quote preservation
- O-10 check-in/out/cleaning
- O-11 Customer LIFF context
- O-12 Staff/Customer quote parity
- O-13 Customer request → Staff confirm
- O-14 decline
- O-15 confirmation revalidation race
- O-16 cross-shop isolation

### Defect protocol

For each FAIL record:

- defect ID;
- case ID;
- exact input/action;
- expected;
- actual;
- timestamp;
- screenshot/note;
- reproducibility;
- severity;
- fix commit;
- retest result.

### Exit criteria

Owner verdict:

`PASS`

or

`PASS WITH REMEDIATION` only when remaining items are explicitly non-release-blocking.

Any required-case failure remains `REMEDIATE`.

---

## Gate E — Defect remediation + release-candidate closure

### Goal

Fix only defects required to safely enter a first-store Closed Beta.

### Rules

- no opportunistic feature expansion;
- no Care Engine implementation;
- no payment scope;
- no cosmetic redesign unless it blocks real operation;
- every fix must map to a defect/evidence item;
- rerun the exact failed case;
- run impacted regression suite;
- run typecheck / lint / build;
- rerun security/isolation gates when authorization/runtime/schema code changes.

### Exit criteria

- all release-blocking defects closed;
- Owner acceptance remains valid after final candidate changes;
- candidate branch clean;
- release evidence points to exact final SHA.

---

## Gate F — Deploy / rollback / operational resilience

### Goal

Prove that the exact candidate can be deployed, observed and recovered without risking production or tenant boundaries.

### Minimum release proof

1. Approved free-first hosting/runtime selected from confirmed requirements.
2. Non-production deployment first.
3. Environment and secret separation proven.
4. Migration path proven.
5. Two-tenant smoke proven.
6. Core PMS loop smoke proven.
7. Redeploy/rollback procedure exercised.
8. Backup and restore procedure tested for the data path used by the first-store beta.
9. Operational logging/monitoring sufficient to detect:
   - login/auth failures;
   - booking failures;
   - server/runtime errors;
   - DB failures;
   - critical integration failures.
10. Incident response contact/owner defined.

### Critical-path resilience only

PS-SR-03 for this first-store run must focus on the actual core path.

Do not block first-store entry on Camera or Automated Daily Report resilience if those capabilities are not required by the selected store workflow.

### Exit criteria

`FIRST_STORE_DEPLOYMENT_READY`

with a reproducible deployment record and rollback/recovery evidence.

---

## Gate G — Privacy / Security / PDPA admission

### Goal

Prevent real customer/pet/staff data from entering PS01 before the operator can responsibly hold it.

**This gate is mandatory before any real-store production-like data is entered.**

### Required decisions/evidence

#### Data inventory / minimization

Document exactly what real data will be stored for the Closed Beta:

- shop;
- staff;
- pet owner/customer;
- pet;
- booking/stay;
- operational notes;
- media/evidence if used;
- LINE identity/linkage if used.

Do not collect fields that are not needed for the beta workflow.

#### Consent / legal basis

Confirm the store's process for informing customers and obtaining/recording appropriate consent or other lawful basis where required.

Do not assume the SaaS vendor alone can solve the store's consent obligation.

#### Access control

Prove:

- tenant isolation;
- role/staff boundaries;
- least privilege;
- administrative access policy;
- no shared production passwords;
- secure offboarding for staff/testers.

#### Sensitive/high-risk information

Explicitly identify whether free-text notes, medication/care data, images/video, or other fields may contain sensitive personal information.

If the store workflow may place such data into PS01, define handling restrictions before use.

#### Retention / deletion / export

Define for Closed Beta:

- retention duration;
- deletion/offboarding procedure;
- customer/store export path;
- backup retention;
- test data cleanup;
- account termination handling.

#### Audit trail

Ensure critical mutations and privileged operations have sufficient auditability for incident investigation.

#### Vendor/subprocessor boundary

Record external services receiving or processing store/customer data in the actual beta architecture.

### Exit criteria

`REAL_DATA_ADMISSION_PASS`

No real customer data before this verdict.

### STOP conditions

- consent/legal-basis process undefined for data actually collected;
- access model permits cross-shop exposure;
- high-risk data can be entered without a handling decision;
- no workable offboarding/deletion/export route;
- production secret handling is unresolved.

---

## Gate H — First real store onboarding

### Goal

Put one real store into Closed Beta and complete an actual operational loop.

### Pre-onboarding discovery

Before configuring the store, interview the operator/staff and record:

- current booking workflow;
- room/resource model;
- customer/pet intake;
- check-in process;
- active-stay workflow;
- check-out/cleaning process;
- staff roles;
- exceptions;
- holidays/closure rules where relevant;
- current LINE/customer communication workflow;
- what data they currently retain and why;
- failure cases they regularly encounter.

Do not force Pawstia assumptions onto the store when the workflow differs.

### Setup

Configure only what the store needs for the approved Closed Beta:

- shop profile;
- staff;
- rooms;
- Rate Plans where used;
- operational settings;
- test customer/pet;
- integrations on the critical path.

### Dry run

Using synthetic/test data:

1. create booking;
2. check in;
3. operate active stay;
4. check out;
5. mark room clean;
6. verify permissions;
7. verify no cross-tenant visibility;
8. verify staff can recover from common user errors.

### Real-data admission

Only after Gate G PASS:

- enter/import the minimum required real data;
- verify ownership and correctness with the store;
- avoid bulk historical migration unless it is required for operation.

### First live operational proof

Capture at least one real operational Closed Beta loop or equivalent real store workflow evidence:

`booking → check-in → active stay → check-out → cleaning/available`

Record:

- start/end timestamp;
- staff involved;
- defects/friction;
- support needed;
- any workaround;
- any booking/data mismatch;
- any incident;
- store feedback.

A workaround that bypasses security or authoritative business rules is not acceptable evidence.

### Exit criteria

`FIRST_REAL_STORE_LIVE`

requires all of:

- real store onboarded;
- authorized staff can log in;
- store configuration matches agreed workflow;
- privacy/PDPA gate passed;
- core workflow works with real operational data;
- no P0/P1 release blocker;
- no cross-tenant leak;
- rollback/support path known;
- Owner has reviewed the first-store evidence.

---

# 6. First-store completion definition

This brief is complete only when:

- Gates A–H are closed;
- one real store is actively using Pawstia in Closed Beta;
- the first real operational loop has evidence;
- defects/support burden are recorded;
- no release-blocking security/privacy issue remains;
- exact deployed version/SHA is recorded;
- rollback/recovery is available;
- continuation evidence is written for the next decision.

Final status:

`FIRST_REAL_STORE_LIVE / CLOSED_BETA_ACTIVE`

---

# 7. Explicit out-of-scope after first-store entry

Do not automatically continue from this brief into:

- public launch;
- paid acquisition;
- payment collection;
- SB01 integration;
- PS-SR-05 commercial/payment contract lock;
- PS-SR-06 paid launch;
- Care Engine implementation;
- Camera expansion;
- multi-store rollout beyond the first-store admission;
- 3/5/10 store expansion.

After `FIRST_REAL_STORE_LIVE`, STOP and return real-store evidence to Owner for the next decision.

---

# 8. Required evidence package

Maintain or create evidence for:

1. release-candidate reconciliation;
2. H3D live proof;
3. fresh DB-backed Booking V2 acceptance;
4. Owner PRE/POST manual test;
5. defect + retest ledger;
6. deploy identity;
7. migration / smoke / rollback;
8. backup / restore proof;
9. monitoring / incident owner;
10. PDPA/privacy/security admission;
11. first-store discovery notes;
12. first-store onboarding record;
13. first live operational loop;
14. final Closed Beta entry report.

Do not overwrite historical evidence. New evidence must identify exact branch/SHA/environment/date.

---

# 9. Current immediate action

**NEXT ACTION — MUST CONTINUE**

Start at **Gate A — Reconcile the actual release candidate**.

Do not jump directly to store onboarding.

The immediate objective is to turn the current non-canonical H3D/Booking V2/shared-runtime work into one auditable candidate, then close H3D + fresh DB acceptance before handing the system to the Owner for O-01..O-16.

---

# 10. Handoff rule

A new chat/agent taking PS01 must:

1. read this brief first;
2. read `AGENTS.md`;
3. verify current repo/branch/HEAD/worktree;
4. inspect `docs/CURRENT_STATUS.md`;
5. inspect the current candidate branch and latest test evidence;
6. continue from the **first non-PASS gate** in this brief;
7. never restart from Phase 1 or redesign the product unless evidence requires it;
8. never claim a later gate passed because an older branch or historical run passed.

**Canonical continuation brief:**  
`docs/BRIEF-PS01-CONTINUE-TO-FIRST-STORE-CLOSED-BETA-2026-09-24.md`
