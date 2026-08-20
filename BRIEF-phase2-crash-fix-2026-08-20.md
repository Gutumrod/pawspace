# 🐛 BRIEF: Fix Postgres crash in Phase 2 RPC/RLS test — PawSpace

> **Type:** Bug fix brief (small, isolated)
> **Repo:** `Gutumrod/pawspace` (baseline commit `6a99790`)
> **Files involved:** `supabase/tests/phase2_rpc_rls.sql`
> **Do NOT commit or push.** Leave changes as uncommitted working-tree edits. Claude reviews and commits after re-running the real test gate — same rule as before.

---

## What happened

I (Claude, this session) actually stood up a local Postgres via `supabase start` (Docker) and ran the Phase 1 and Phase 2 test files for real — not just static review. Findings:

1. **Phase 1 (`supabase/tests/phase1_schema.sql`) genuinely PASSES.** Applied migration 1 alone, ran the test file against live Postgres, all 13 assertions passed, clean `ROLLBACK`. This is now real-execution-verified, not just static.
2. **Phase 2 migration (`supabase/migrations/20260820020000_phase2_authoritative_gateways.sql`) applies cleanly** — valid SQL, no errors on Postgres 17.6.1.106.
3. **Phase 2 test (`supabase/tests/phase2_rpc_rls.sql`) crashes the Postgres server.** Not a normal SQL error — an actual server segfault, confirmed in container logs:
   ```
   LOG: server process (PID xxx) was terminated by signal 11: Segmentation fault
   ```
   Reproduced 3 times independently, including a minimal isolated repro with no booking/pet setup at all:
   ```sql
   SET LOCAL ROLE authenticated;
   DO $$
   BEGIN
     PERFORM enqueue_sync_event(...);  -- REVOKEd from authenticated
   EXCEPTION WHEN insufficient_privilege THEN ...
   END $$;
   ```
   Calling a `REVOKE`d `SECURITY DEFINER` function from inside a PL/pgSQL `DO` block and catching `insufficient_privilege` crashes this Postgres build. This is the exact pattern at `supabase/tests/phase2_rpc_rls.sql:150-157`.

## What's already confirmed GOOD (don't redo this)

Everything in `phase2_rpc_rls.sql` *before* line 150 ran and passed cleanly against real Postgres before the crash:
- All 19 Phase 2 functions exist
- No leaked INSERT/UPDATE/DELETE grants to `authenticated` on core tables
- Direct client `INSERT` on `bookings` correctly denied
- `create_booking` works and enqueues exactly one outbox event
- Cross-tenant `create_booking` rejected, DB state unchanged
- Cross-tenant and wrong-owner `add_pet_to_booking` rejected
- Room capacity reduction below active assignment rejected
- Active pet-owner transfer rejected
- Check-in on wrong business date rejected; correct-date check-in succeeds
- Checked-in cancellation rejected
- Checkout correctly moves room to `cleaning`
- Current-maintenance-over-cleaning conflict rejected
- `mark_room_clean` correctly returns room to `available`
- `bookings.owner_id` immutability enforced
- Forced outbox-insert failure correctly rolls back the whole mutation (no partial writes)

**None of this needs to be re-verified from scratch — only the one crashing block needs a fix and a fresh full re-run.**

## What's NOT yet verified either way

The crash aborts the psql session before reaching:
- Line 160-168 (disabled-staff loses RLS visibility)
- All concurrency test scripts: `phase2_concurrency*.sql/.ps1`, `phase2_report_concurrency*.sql/.ps1`

These are simply unknown status until the crash is fixed and the full suite runs to completion.

## Recommended fix

The same file already has a **working, non-crashing pattern** for testing this exact same permission at line 30:
```sql
IF has_function_privilege('authenticated','enqueue_sync_event(uuid,character varying,uuid,character varying,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute internal enqueue_sync_event';
END IF;
```
Replace the crashing invoke-and-catch block at lines 150-157 with the same `has_function_privilege(...)` static check instead of actually calling `enqueue_sync_event` and catching `insufficient_privilege`. Do not change anything else in the file unless the re-run surfaces a new failure.

## Verification required before reporting back

Run for real, not just parse/lint:
```bash
supabase db reset          # applies both migrations fresh
docker exec -i supabase_db_PawSpace psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/phase1_schema.sql
docker exec -i supabase_db_PawSpace psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/phase2_rpc_rls.sql
```
Confirm: exit code 0/clean output on both, **and check `docker logs supabase_db_PawSpace --since <run-time> | grep -i segmentation` comes back empty.** A test file finishing without an obvious SQL error is not sufficient proof — this specific bug silently kills the psql session, so absence-of-crash must be checked in the server log, not just in psql's exit behavior.

Then run the concurrency test scripts for the first time and report their actual output (pass/fail per script), since they have never been executed until now.

## Report back format

Same as before: file:line of the change, the actual command output (not a summary), and explicit confirmation of what was verified vs still `DOCUMENTED`. Do not mark anything `VERIFIED` in `IMPLEMENTATION_STATUS.md` yourself — that stays Claude's call after independent re-run, per the existing Promotion Rule.
