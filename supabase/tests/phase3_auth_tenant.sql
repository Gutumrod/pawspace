\set ON_ERROR_STOP on
BEGIN;

-- ============================================================================
-- PawSpace Phase 3 Executable Auth + Tenant Context Acceptance Tests
-- Source of truth: docs/PRD.md + docs/SYSTEM_ARCHITECTURE.md + BRIEF-phase3-auth-tenant-context-2026-08-20.md
-- ============================================================================

-- Gate 0: Verify Phase 3 Functions and Triggers Exist
DO $$
DECLARE missing text[];
BEGIN
  SELECT array_agg(x.name) INTO missing
  FROM (VALUES
    ('bootstrap_shop'),
    ('create_staff_membership'),
    ('disable_staff'),
    ('enable_staff'),
    ('change_staff_role'),
    ('remove_staff'),
    ('get_current_staff_context'),
    ('enforce_last_active_owner')
  ) x(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = x.name
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing Phase 3 functions: %', missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'staff_users' AND t.tgname = 'trg_enforce_last_active_owner'
  ) THEN
    RAISE EXCEPTION 'Missing trigger trg_enforce_last_active_owner on staff_users';
  END IF;
END $$;

-- Gate 0.1: Privilege Lockdown Confirmation
DO $$
DECLARE leaked text[];
BEGIN
  SELECT array_agg(table_name || ':' || privilege_type) INTO leaked
  FROM information_schema.role_table_grants
  WHERE grantee = 'authenticated'
    AND table_schema = 'public'
    AND table_name IN ('shops', 'staff_users')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated core DML privilege leak on shops/staff_users: %', leaked;
  END IF;
END $$;

-- Setup Test Data Fixtures
CREATE TEMP TABLE phase3_ids(k text PRIMARY KEY, v uuid NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON phase3_ids TO authenticated;

DO $$
DECLARE
  s1 uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  u_owner1 uuid := gen_random_uuid();
  u_mgr1 uuid := gen_random_uuid();
  u_staff1 uuid := gen_random_uuid();
  u_dis1 uuid := gen_random_uuid();
  u_owner2 uuid := gen_random_uuid();
  u_none uuid := gen_random_uuid();
  u_boot uuid := gen_random_uuid();
  u_target uuid := gen_random_uuid();
  u_second_owner uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();
  r2 uuid := gen_random_uuid();
  o1 uuid := gen_random_uuid();
  o2 uuid := gen_random_uuid();
BEGIN
  -- Insert Auth users
  INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
    (u_owner1, 'owner1@shop1.invalid', '{"name": "Owner 1"}'::jsonb),
    (u_mgr1, 'mgr1@shop1.invalid', '{"name": "Manager 1"}'::jsonb),
    (u_staff1, 'staff1@shop1.invalid', '{"name": "Staff 1"}'::jsonb),
    (u_dis1, 'disabled@shop1.invalid', '{"name": "Disabled Staff"}'::jsonb),
    (u_owner2, 'owner2@shop2.invalid', '{"name": "Owner 2"}'::jsonb),
    (u_none, 'unaffiliated@example.invalid', '{"name": "No Shop User"}'::jsonb),
    (u_boot, 'bootstrap@example.invalid', '{"name": "Bootstrap User"}'::jsonb),
    (u_target, 'target@shop1.invalid', '{"name": "Target Staff"}'::jsonb),
    (u_second_owner, 'owner1b@shop1.invalid', '{"name": "Owner 1B"}'::jsonb);

  -- Insert Shops
  INSERT INTO shops(id, name, slug, phone) VALUES
    (s1, 'P3 Shop 1', 'p3-shop-1', '0811111111'),
    (s2, 'P3 Shop 2', 'p3-shop-2', '0822222222');

  -- Insert Staff Memberships
  INSERT INTO staff_users(id, shop_id, email, name, role, is_active) VALUES
    (u_owner1, s1, 'owner1@shop1.invalid', 'Owner 1', 'owner', true),
    (u_mgr1, s1, 'mgr1@shop1.invalid', 'Manager 1', 'manager', true),
    (u_staff1, s1, 'staff1@shop1.invalid', 'Staff 1', 'staff', true),
    (u_dis1, s1, 'disabled@shop1.invalid', 'Disabled Staff', 'staff', false),
    (u_owner2, s2, 'owner2@shop2.invalid', 'Owner 2', 'owner', true);

  -- Insert Operational data for Shop 1 & 2
  INSERT INTO pet_owners(id, shop_id, first_name, phone) VALUES
    (o1, s1, 'Customer 1', '0890000001'),
    (o2, s2, 'Customer 2', '0890000002');

  INSERT INTO rooms(id, shop_id, room_number, room_type, capacity_pets, base_price_per_night) VALUES
    (r1, s1, 'P3-R1', 'standard', 2, 500),
    (r2, s2, 'P3-R2', 'standard', 2, 500);

  INSERT INTO phase3_ids VALUES
    ('s1', s1), ('s2', s2),
    ('u_owner1', u_owner1), ('u_mgr1', u_mgr1), ('u_staff1', u_staff1),
    ('u_dis1', u_dis1), ('u_owner2', u_owner2), ('u_none', u_none),
    ('u_boot', u_boot), ('u_target', u_target), ('u_second_owner', u_second_owner),
    ('r1', r1), ('r2', r2), ('o1', o1), ('o2', o2);
END $$;

-- ----------------------------------------------------------------------------
-- Test 1: Valid active owner/manager/staff session resolves correct tenant & role
-- ----------------------------------------------------------------------------
-- 1.1 Owner session
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_owner1'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_shop_id uuid;
  v_is_owner boolean;
  v_is_mgr_or_owner boolean;
  v_ctx jsonb;
BEGIN
  v_shop_id := current_staff_shop_id();
  IF v_shop_id != (SELECT v FROM phase3_ids WHERE k = 's1') THEN
    RAISE EXCEPTION 'Owner session failed to resolve shop_id: %', v_shop_id;
  END IF;

  v_is_owner := is_shop_owner();
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Owner session is_shop_owner() returned false';
  END IF;

  v_is_mgr_or_owner := is_shop_manager_or_owner();
  IF NOT v_is_mgr_or_owner THEN
    RAISE EXCEPTION 'Owner session is_shop_manager_or_owner() returned false';
  END IF;

  v_ctx := get_current_staff_context();
  IF v_ctx->>'role' != 'owner' OR v_ctx->>'shop_name' != 'P3 Shop 1' THEN
    RAISE EXCEPTION 'Owner get_current_staff_context() returned invalid data: %', v_ctx;
  END IF;
END $$;
RESET ROLE;

-- 1.2 Manager session
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_mgr1'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_shop_id uuid;
  v_is_owner boolean;
  v_is_mgr_or_owner boolean;
  v_ctx jsonb;
BEGIN
  v_shop_id := current_staff_shop_id();
  IF v_shop_id != (SELECT v FROM phase3_ids WHERE k = 's1') THEN
    RAISE EXCEPTION 'Manager session failed to resolve shop_id';
  END IF;

  v_is_owner := is_shop_owner();
  IF v_is_owner THEN
    RAISE EXCEPTION 'Manager session is_shop_owner() unexpectedly returned true';
  END IF;

  v_is_mgr_or_owner := is_shop_manager_or_owner();
  IF NOT v_is_mgr_or_owner THEN
    RAISE EXCEPTION 'Manager session is_shop_manager_or_owner() returned false';
  END IF;

  v_ctx := get_current_staff_context();
  IF v_ctx->>'role' != 'manager' THEN
    RAISE EXCEPTION 'Manager get_current_staff_context() invalid role: %', v_ctx;
  END IF;
END $$;
RESET ROLE;

-- 1.3 Staff session
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_staff1'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_shop_id uuid;
  v_is_owner boolean;
  v_is_mgr_or_owner boolean;
  v_ctx jsonb;
BEGIN
  v_shop_id := current_staff_shop_id();
  IF v_shop_id != (SELECT v FROM phase3_ids WHERE k = 's1') THEN
    RAISE EXCEPTION 'Staff session failed to resolve shop_id';
  END IF;

  v_is_owner := is_shop_owner();
  IF v_is_owner THEN
    RAISE EXCEPTION 'Staff session is_shop_owner() unexpectedly returned true';
  END IF;

  v_is_mgr_or_owner := is_shop_manager_or_owner();
  IF v_is_mgr_or_owner THEN
    RAISE EXCEPTION 'Staff session is_shop_manager_or_owner() unexpectedly returned true';
  END IF;

  v_ctx := get_current_staff_context();
  IF v_ctx->>'role' != 'staff' THEN
    RAISE EXCEPTION 'Staff get_current_staff_context() invalid role: %', v_ctx;
  END IF;
END $$;
RESET ROLE;

-- ----------------------------------------------------------------------------
-- Test 2: User with no staff_users membership gets no tenant access
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_none'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_shop_id uuid;
  v_cnt int;
  v_failed boolean := false;
BEGIN
  v_shop_id := current_staff_shop_id();
  IF v_shop_id IS NOT NULL THEN
    RAISE EXCEPTION 'Unaffiliated user resolved non-null shop_id: %', v_shop_id;
  END IF;

  IF get_current_staff_context() IS NOT NULL THEN
    RAISE EXCEPTION 'Unaffiliated user resolved non-null staff context';
  END IF;

  SELECT count(*) INTO v_cnt FROM shops;
  IF v_cnt != 0 THEN
    RAISE EXCEPTION 'Unaffiliated user could read shops via RLS (count: %)', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM rooms;
  IF v_cnt != 0 THEN
    RAISE EXCEPTION 'Unaffiliated user could read rooms via RLS (count: %)', v_cnt;
  END IF;

  BEGIN
    PERFORM create_booking((SELECT v FROM phase3_ids WHERE k = 'o1'), (SELECT v FROM phase3_ids WHERE k = 'r1'), DATE '2026-11-01', DATE '2026-11-02');
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Unaffiliated user was able to call create_booking without authorization';
  END IF;
END $$;
RESET ROLE;

-- ----------------------------------------------------------------------------
-- Test 3: is_active=false user loses DB/RPC access immediately
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_dis1'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_shop_id uuid;
  v_cnt int;
  v_failed boolean := false;
BEGIN
  v_shop_id := current_staff_shop_id();
  IF v_shop_id IS NOT NULL THEN
    RAISE EXCEPTION 'Disabled user resolved non-null shop_id: %', v_shop_id;
  END IF;

  IF get_current_staff_context() IS NOT NULL THEN
    RAISE EXCEPTION 'Disabled user resolved non-null staff context';
  END IF;

  SELECT count(*) INTO v_cnt FROM shops;
  IF v_cnt != 0 THEN
    RAISE EXCEPTION 'Disabled user could read shops via RLS';
  END IF;

  BEGIN
    PERFORM create_booking((SELECT v FROM phase3_ids WHERE k = 'o1'), (SELECT v FROM phase3_ids WHERE k = 'r1'), DATE '2026-11-05', DATE '2026-11-06');
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Disabled user was able to call create_booking';
  END IF;
END $$;
RESET ROLE;

-- ----------------------------------------------------------------------------
-- Test 4: Cross-tenant reads and mutations remain rejected
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_owner1'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_cnt int;
  v_failed boolean;
BEGIN
  -- Cross-tenant RLS isolation
  SELECT count(*) INTO v_cnt FROM shops WHERE id = (SELECT v FROM phase3_ids WHERE k = 's2');
  IF v_cnt != 0 THEN
    RAISE EXCEPTION 'Shop 1 owner could read Shop 2 via RLS';
  END IF;

  SELECT count(*) INTO v_cnt FROM rooms WHERE shop_id = (SELECT v FROM phase3_ids WHERE k = 's2');
  IF v_cnt != 0 THEN
    RAISE EXCEPTION 'Shop 1 owner could read Shop 2 rooms via RLS';
  END IF;

  -- Cross-tenant staff management mutation rejection
  v_failed := false;
  BEGIN
    PERFORM disable_staff((SELECT v FROM phase3_ids WHERE k = 'u_owner2'));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Shop 1 owner was able to disable Shop 2 staff member';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM change_staff_role((SELECT v FROM phase3_ids WHERE k = 'u_owner2'), 'staff');
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Shop 1 owner was able to change Shop 2 staff role';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM remove_staff((SELECT v FROM phase3_ids WHERE k = 'u_owner2'));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Shop 1 owner was able to remove Shop 2 staff member';
  END IF;
END $$;
RESET ROLE;

-- ----------------------------------------------------------------------------
-- Test 5: Manager cannot invite/disable/remove/change staff role
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_mgr1'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_failed boolean;
BEGIN
  v_failed := false;
  BEGIN
    PERFORM create_staff_membership((SELECT v FROM phase3_ids WHERE k = 'u_target'), 'target@shop1.invalid', 'Target', 'staff');
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Manager was able to call create_staff_membership'; END IF;

  v_failed := false;
  BEGIN
    PERFORM disable_staff((SELECT v FROM phase3_ids WHERE k = 'u_staff1'));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Manager was able to call disable_staff'; END IF;

  v_failed := false;
  BEGIN
    PERFORM change_staff_role((SELECT v FROM phase3_ids WHERE k = 'u_staff1'), 'manager');
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Manager was able to call change_staff_role'; END IF;

  v_failed := false;
  BEGIN
    PERFORM remove_staff((SELECT v FROM phase3_ids WHERE k = 'u_staff1'));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Manager was able to call remove_staff'; END IF;
END $$;
RESET ROLE;

-- ----------------------------------------------------------------------------
-- Test 6: Staff cannot perform staff-management actions
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_staff1'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_failed boolean;
BEGIN
  v_failed := false;
  BEGIN
    PERFORM create_staff_membership((SELECT v FROM phase3_ids WHERE k = 'u_target'), 'target@shop1.invalid', 'Target', 'staff');
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Staff was able to call create_staff_membership'; END IF;

  v_failed := false;
  BEGIN
    PERFORM disable_staff((SELECT v FROM phase3_ids WHERE k = 'u_mgr1'));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Staff was able to call disable_staff'; END IF;

  v_failed := false;
  BEGIN
    PERFORM change_staff_role((SELECT v FROM phase3_ids WHERE k = 'u_mgr1'), 'staff');
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Staff was able to call change_staff_role'; END IF;

  v_failed := false;
  BEGIN
    PERFORM remove_staff((SELECT v FROM phase3_ids WHERE k = 'u_mgr1'));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Staff was able to call remove_staff'; END IF;
END $$;
RESET ROLE;

-- ----------------------------------------------------------------------------
-- Test 7: Owner can perform authorized staff-management actions
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_owner1'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_target uuid := (SELECT v FROM phase3_ids WHERE k = 'u_target');
  v_role varchar;
  v_active boolean;
BEGIN
  -- Add staff member
  PERFORM create_staff_membership(v_target, 'target@shop1.invalid', 'Target Staff', 'staff');

  SELECT role, is_active INTO v_role, v_active FROM staff_users WHERE id = v_target;
  IF v_role != 'staff' OR NOT v_active THEN
    RAISE EXCEPTION 'Failed to create staff membership: role=%, active=%', v_role, v_active;
  END IF;

  -- Change role to manager
  PERFORM change_staff_role(v_target, 'manager');
  SELECT role INTO v_role FROM staff_users WHERE id = v_target;
  IF v_role != 'manager' THEN
    RAISE EXCEPTION 'Failed to change staff role to manager: role=%', v_role;
  END IF;

  -- Disable staff
  PERFORM disable_staff(v_target);
  SELECT is_active INTO v_active FROM staff_users WHERE id = v_target;
  IF v_active THEN
    RAISE EXCEPTION 'Failed to disable staff member';
  END IF;

  -- Re-enable staff
  PERFORM enable_staff(v_target);
  SELECT is_active INTO v_active FROM staff_users WHERE id = v_target;
  IF NOT v_active THEN
    RAISE EXCEPTION 'Failed to re-enable staff member';
  END IF;

  -- Remove staff
  PERFORM remove_staff(v_target);
  IF EXISTS (SELECT 1 FROM staff_users WHERE id = v_target) THEN
    RAISE EXCEPTION 'Failed to remove staff member';
  END IF;
END $$;
RESET ROLE;

-- ----------------------------------------------------------------------------
-- Test 8: Disabling/removing/demoting the last active owner is rejected atomically
-- ----------------------------------------------------------------------------
-- In Shop 2, u_owner2 is the only owner.
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_owner2'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_owner2 uuid := (SELECT v FROM phase3_ids WHERE k = 'u_owner2');
  v_failed boolean;
BEGIN
  -- 8.1 Demote last active owner -> REJECTED
  v_failed := false;
  BEGIN
    PERFORM change_staff_role(v_owner2, 'manager');
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Demoting last active owner was not rejected';
  END IF;

  -- 8.2 Disable last active owner -> REJECTED
  v_failed := false;
  BEGIN
    PERFORM disable_staff(v_owner2);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Disabling last active owner was not rejected';
  END IF;

  -- 8.3 Remove last active owner -> REJECTED
  v_failed := false;
  BEGIN
    PERFORM remove_staff(v_owner2);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Removing last active owner was not rejected';
  END IF;

  -- Confirm u_owner2 is still active owner
  IF NOT EXISTS (SELECT 1 FROM staff_users WHERE id = v_owner2 AND role = 'owner' AND is_active = true) THEN
    RAISE EXCEPTION 'Last active owner state was corrupted';
  END IF;
END $$;
RESET ROLE;

-- 8.4 Direct SQL level backstop test (simulating raw DML / privileged bypass attempt)
DO $$
DECLARE
  v_owner2 uuid := (SELECT v FROM phase3_ids WHERE k = 'u_owner2');
  v_failed boolean;
BEGIN
  v_failed := false;
  BEGIN
    UPDATE staff_users SET is_active = false WHERE id = v_owner2;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Direct SQL deactivation of last owner bypassed trigger backstop';
  END IF;

  v_failed := false;
  BEGIN
    DELETE FROM staff_users WHERE id = v_owner2;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Direct SQL deletion of last owner bypassed trigger backstop';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Test 9: With two active owners, one may be disabled/demoted/removed safely
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_owner1'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_o1 uuid := (SELECT v FROM phase3_ids WHERE k = 'u_owner1');
  v_o2 uuid := (SELECT v FROM phase3_ids WHERE k = 'u_second_owner');
  v_cnt int;
BEGIN
  -- Add second owner
  PERFORM create_staff_membership(v_o2, 'owner1b@shop1.invalid', 'Owner 1B', 'owner');

  SELECT count(*) INTO v_cnt FROM staff_users WHERE shop_id = (SELECT v FROM phase3_ids WHERE k = 's1') AND role = 'owner' AND is_active = true;
  IF v_cnt != 2 THEN
    RAISE EXCEPTION 'Expected 2 active owners, found %', v_cnt;
  END IF;

  -- Demote second owner to manager -> SUCCEEDS because u_owner1 is still active owner
  PERFORM change_staff_role(v_o2, 'manager');
  IF (SELECT role FROM staff_users WHERE id = v_o2) != 'manager' THEN
    RAISE EXCEPTION 'Demoting second owner failed';
  END IF;

  -- Promote back to owner
  PERFORM change_staff_role(v_o2, 'owner');

  -- Disable second owner -> SUCCEEDS
  PERFORM disable_staff(v_o2);
  IF (SELECT is_active FROM staff_users WHERE id = v_o2) != false THEN
    RAISE EXCEPTION 'Disabling second owner failed';
  END IF;

  -- Re-enable second owner -> SUCCEEDS
  PERFORM enable_staff(v_o2);

  -- Remove second owner -> SUCCEEDS
  PERFORM remove_staff(v_o2);
  IF EXISTS (SELECT 1 FROM staff_users WHERE id = v_o2) THEN
    RAISE EXCEPTION 'Removing second owner failed';
  END IF;

  -- Verify u_owner1 remains as the sole active owner
  SELECT count(*) INTO v_cnt FROM staff_users WHERE shop_id = (SELECT v FROM phase3_ids WHERE k = 's1') AND role = 'owner' AND is_active = true;
  IF v_cnt != 1 THEN
    RAISE EXCEPTION 'Expected 1 active owner remaining, found %', v_cnt;
  END IF;
END $$;
RESET ROLE;

-- ----------------------------------------------------------------------------
-- Test 10: Tenant bootstrap creates exactly one Shop + active Owner membership,
--          and rejects a second membership/bootstrap for the same V1 user
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_boot'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_boot_user uuid := (SELECT v FROM phase3_ids WHERE k = 'u_boot');
  v_new_shop_id uuid;
  v_failed boolean;
  v_ctx jsonb;
BEGIN
  -- Bootstrap new shop
  v_new_shop_id := bootstrap_shop('Bootstrapped Pet Hotel', 'bootstrapped-pet-hotel', '0899999999', '@boothotel');

  IF v_new_shop_id IS NULL THEN
    RAISE EXCEPTION 'bootstrap_shop returned null shop_id';
  END IF;

  -- Verify tenant context is immediately active and resolved
  v_ctx := get_current_staff_context();
  IF v_ctx->>'shop_id' != v_new_shop_id::text
     OR v_ctx->>'role' != 'owner'
     OR v_ctx->>'is_active' != 'true' THEN
    RAISE EXCEPTION 'Bootstrapped tenant context invalid: %', v_ctx;
  END IF;

  -- Attempting a second bootstrap for the same user must be rejected
  v_failed := false;
  BEGIN
    PERFORM bootstrap_shop('Second Shop', 'second-shop', NULL, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Second bootstrap for the same user was not rejected';
  END IF;
END $$;
RESET ROLE;

-- ----------------------------------------------------------------------------
-- Test 11: Direct browser DML on shops/staff_users remains denied
-- ----------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', (SELECT v::text FROM phase3_ids WHERE k = 'u_owner1'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_denied boolean;
BEGIN
  -- Direct INSERT on shops
  v_denied := false;
  BEGIN
    INSERT INTO shops(name, slug) VALUES ('Hacked Shop', 'hacked-shop');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Direct INSERT on shops was not denied'; END IF;

  -- Direct UPDATE on shops
  v_denied := false;
  BEGIN
    UPDATE shops SET name = 'Hacked Name' WHERE id = (SELECT v FROM phase3_ids WHERE k = 's1');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Direct UPDATE on shops was not denied'; END IF;

  -- Direct DELETE on shops
  v_denied := false;
  BEGIN
    DELETE FROM shops WHERE id = (SELECT v FROM phase3_ids WHERE k = 's1');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Direct DELETE on shops was not denied'; END IF;

  -- Direct INSERT on staff_users
  v_denied := false;
  BEGIN
    INSERT INTO staff_users(id, shop_id, email, name, role)
    VALUES (gen_random_uuid(), (SELECT v FROM phase3_ids WHERE k = 's1'), 'hacker@shop1.invalid', 'Hacker', 'owner');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Direct INSERT on staff_users was not denied'; END IF;

  -- Direct UPDATE on staff_users
  v_denied := false;
  BEGIN
    UPDATE staff_users SET role = 'owner' WHERE id = (SELECT v FROM phase3_ids WHERE k = 'u_staff1');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Direct UPDATE on staff_users was not denied'; END IF;

  -- Direct DELETE on staff_users
  v_denied := false;
  BEGIN
    DELETE FROM staff_users WHERE id = (SELECT v FROM phase3_ids WHERE k = 'u_staff1');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Direct DELETE on staff_users was not denied'; END IF;
END $$;
RESET ROLE;

-- ----------------------------------------------------------------------------
-- Test 12: Shop cascade deletion does not false-positive trigger last owner violation
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_disp_shop uuid := gen_random_uuid();
  v_disp_user uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id, email) VALUES (v_disp_user, 'disp@example.invalid');
  INSERT INTO shops(id, name, slug) VALUES (v_disp_shop, 'Disposable Shop', 'disposable-shop');
  INSERT INTO staff_users(id, shop_id, email, name, role, is_active)
  VALUES (v_disp_user, v_disp_shop, 'disp@example.invalid', 'Disp Owner', 'owner', true);

  -- Deleting the shop should cascade delete staff_users without triggering last active owner error
  DELETE FROM shops WHERE id = v_disp_shop;

  IF EXISTS (SELECT 1 FROM staff_users WHERE id = v_disp_user) THEN
    RAISE EXCEPTION 'Cascade delete failed to remove staff_users row';
  END IF;
END $$;

ROLLBACK;
