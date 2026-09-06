\set ON_ERROR_STOP on
BEGIN;
SELECT plan(1);

CREATE TEMP TABLE phase13_values(k text PRIMARY KEY, v text NOT NULL);
GRANT SELECT ON phase13_values TO authenticated, service_role;

DO $$
DECLARE
  v_shop uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email) VALUES (v_owner,'phase13-owner@example.invalid');
  INSERT INTO shops(id,name,slug) VALUES (v_shop,'Phase 13 Shop','phase-13-shop');
  INSERT INTO staff_users(id,shop_id,email,name,role,is_active)
  VALUES (v_owner,v_shop,'phase13-owner@example.invalid','Phase 13 Owner','owner',TRUE);
  INSERT INTO phase13_values VALUES ('shop',v_shop::text),('owner',v_owner::text);

  IF NOT EXISTS (
    SELECT 1 FROM shop_subscriptions
    WHERE shop_id=v_shop AND status='trialing'
      AND trial_ends_at > trial_started_at + interval '29 days 23 hours'
      AND trial_ends_at < trial_started_at + interval '30 days 1 hour'
  ) THEN
    RAISE EXCEPTION 'Phase 13 must initialize an authoritative 30-day trial';
  END IF;
END $$;

-- Browser roles have no generic commercial DML or commercial mutation RPC access.
DO $$ BEGIN
  IF has_table_privilege('anon','shop_subscriptions','INSERT')
     OR has_table_privilege('anon','shop_subscriptions','UPDATE')
     OR has_table_privilege('anon','shop_subscriptions','DELETE')
     OR has_table_privilege('authenticated','shop_subscriptions','INSERT')
     OR has_table_privilege('authenticated','shop_subscriptions','UPDATE')
     OR has_table_privilege('authenticated','shop_subscriptions','DELETE')
     OR has_table_privilege('anon','subscription_audit_log','INSERT')
     OR has_table_privilege('anon','subscription_audit_log','UPDATE')
     OR has_table_privilege('anon','subscription_audit_log','DELETE')
     OR has_table_privilege('authenticated','subscription_audit_log','INSERT')
     OR has_table_privilege('authenticated','subscription_audit_log','UPDATE')
     OR has_table_privilege('authenticated','subscription_audit_log','DELETE')
     OR has_table_privilege('anon','subscription_audit_log','TRUNCATE')
     OR has_table_privilege('authenticated','subscription_audit_log','TRUNCATE') THEN
    RAISE EXCEPTION 'Generic browser commercial DML leaked';
  END IF;
  IF has_function_privilege('authenticated','set_shop_commercial_package(uuid,character varying,character varying,character varying,character varying,text,uuid,uuid)','EXECUTE')
     OR has_function_privilege('anon','transition_shop_subscription(uuid,character varying,character varying,text,uuid,timestamptz,timestamptz,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Browser commercial mutation RPC leaked';
  END IF;
END $$;

-- Owner/manager status reads remain tenant-scoped; staff/inactive/no-membership fail closed.
DO $$
DECLARE
  v_shop uuid := (SELECT pv.v::uuid FROM phase13_values AS pv WHERE k='shop');
  v_manager uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_inactive uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_other_shop uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email) VALUES
    (v_manager,'phase13-manager@example.invalid'),
    (v_staff,'phase13-staff@example.invalid'),
    (v_inactive,'phase13-inactive@example.invalid'),
    (v_outsider,'phase13-outsider@example.invalid');
  INSERT INTO shops(id,name,slug)
  VALUES(v_other_shop,'Phase 13 Other Status Shop','phase13-other-status-shop');
  INSERT INTO staff_users(id,shop_id,email,name,role,is_active) VALUES
    (v_manager,v_shop,'phase13-manager@example.invalid','Phase 13 Manager','manager',TRUE),
    (v_staff,v_shop,'phase13-staff@example.invalid','Phase 13 Staff','staff',TRUE),
    (v_inactive,v_shop,'phase13-inactive@example.invalid','Phase 13 Inactive','manager',FALSE);
  INSERT INTO phase13_values VALUES
    ('manager',v_manager::text),
    ('staff',v_staff::text),
    ('inactive',v_inactive::text),
    ('outsider',v_outsider::text),
    ('other_shop',v_other_shop::text);
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',(SELECT pv.v FROM phase13_values AS pv WHERE k='owner'),true);
DO $$
DECLARE v jsonb;
BEGIN
  v := get_shop_commercial_status((SELECT pv.v::uuid FROM phase13_values AS pv WHERE k='shop'));
  IF v->>'lifecycle_status' <> 'trialing' THEN
    RAISE EXCEPTION 'Owner could not read authoritative commercial status';
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',(SELECT pv.v FROM phase13_values AS pv WHERE k='manager'),true);
DO $$
DECLARE v jsonb;
BEGIN
  v := get_shop_commercial_status((SELECT pv.v::uuid FROM phase13_values AS pv WHERE k='shop'));
  IF v->>'lifecycle_status' <> 'trialing' THEN
    RAISE EXCEPTION 'Manager could not read authoritative commercial status';
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',(SELECT pv.v FROM phase13_values AS pv WHERE k='staff'),true);
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM get_shop_commercial_status((SELECT pv.v::uuid FROM phase13_values AS pv WHERE k='shop'));
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%Unauthorized%'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Plain staff commercial status read was not rejected'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',(SELECT pv.v FROM phase13_values AS pv WHERE k='inactive'),true);
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM get_shop_commercial_status((SELECT pv.v::uuid FROM phase13_values AS pv WHERE k='shop'));
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%Unauthorized%'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Inactive manager commercial status read was not rejected'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',(SELECT pv.v FROM phase13_values AS pv WHERE k='outsider'),true);
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM get_shop_commercial_status((SELECT pv.v::uuid FROM phase13_values AS pv WHERE k='shop'));
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%Unauthorized%'; END;
  IF NOT denied THEN RAISE EXCEPTION 'No-membership commercial status read was not rejected'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',(SELECT pv.v FROM phase13_values AS pv WHERE k='manager'),true);
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM get_shop_commercial_status((SELECT pv.v::uuid FROM phase13_values AS pv WHERE k='other_shop'));
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%Unauthorized%'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-tenant commercial status read was not rejected'; END IF;
END $$;
RESET ROLE;

-- Exact Starter boundaries and tenant-scoped counts.
DO $$
DECLARE
  v_room_shop uuid := gen_random_uuid();
  v_pet_shop uuid := gen_random_uuid();
  v_other_shop uuid := gen_random_uuid();
  v_pet_owner uuid := gen_random_uuid();
  denied boolean := false;
BEGIN
  INSERT INTO shops(id,name,slug) VALUES
    (v_room_shop,'Phase 13 Room Boundary','phase13-room-boundary'),
    (v_pet_shop,'Phase 13 Pet Boundary','phase13-pet-boundary'),
    (v_other_shop,'Phase 13 Other Tenant','phase13-other-tenant');

  INSERT INTO rooms(shop_id,room_number,room_type,capacity_pets,base_price_per_night,status)
  SELECT v_other_shop,'OTHER-'||n,'standard',1,500,'available' FROM generate_series(1,10) n;
  INSERT INTO rooms(shop_id,room_number,room_type,capacity_pets,base_price_per_night,status)
  SELECT v_room_shop,'ROOM-'||n,'standard',1,500,'available' FROM generate_series(1,9) n;
  INSERT INTO rooms(shop_id,room_number,room_type,capacity_pets,base_price_per_night,status)
  VALUES(v_room_shop,'ROOM-10','standard',1,500,'available');
  BEGIN
    INSERT INTO rooms(shop_id,room_number,room_type,capacity_pets,base_price_per_night,status)
    VALUES(v_room_shop,'ROOM-11','standard',1,500,'available');
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%ROOM_QUOTA_EXCEEDED%'; END;
  IF NOT denied OR (SELECT count(*) FROM rooms WHERE shop_id=v_room_shop)<>10 THEN
    RAISE EXCEPTION 'Starter room 9 -> 10 -> 11 boundary failed';
  END IF;

  INSERT INTO pet_owners(id,shop_id,first_name,phone)
  VALUES(v_pet_owner,v_pet_shop,'Boundary Owner','0813000001');
  INSERT INTO pets(shop_id,owner_id,name,species)
  SELECT v_pet_shop,v_pet_owner,'Pet '||n,'dog' FROM generate_series(1,299) n;
  INSERT INTO pets(shop_id,owner_id,name,species) VALUES(v_pet_shop,v_pet_owner,'Pet 300','dog');
  denied := false;
  BEGIN
    INSERT INTO pets(shop_id,owner_id,name,species) VALUES(v_pet_shop,v_pet_owner,'Pet 301','dog');
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%PET_QUOTA_EXCEEDED%'; END;
  IF NOT denied OR (SELECT count(*) FROM pets WHERE shop_id=v_pet_shop)<>300 THEN
    RAISE EXCEPTION 'Starter pet 299 -> 300 -> 301 boundary failed';
  END IF;
END $$;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);

-- Pro, Enterprise, and valid Founding Member remain unlimited.
DO $$
DECLARE
  v_shop uuid;
  v_owner uuid;
  v_package text;
  v_offer text;
BEGIN
  FOR v_package,v_offer IN
    SELECT * FROM (VALUES
      ('pro'::text,'standard'::text),
      ('enterprise'::text,'standard'::text),
      ('starter'::text,'founding_member'::text)
    ) AS packages(package_id,offer)
  LOOP
    v_shop := gen_random_uuid();
    v_owner := gen_random_uuid();
    INSERT INTO shops(id,name,slug) VALUES(v_shop,'Phase 13 Unlimited '||v_package,'phase13-unlimited-'||replace(v_shop::text,'-',''));
    PERFORM set_shop_commercial_package(v_shop,v_package,v_offer,'monthly','system','unlimited regression',gen_random_uuid(),NULL);
    INSERT INTO rooms(shop_id,room_number,room_type,capacity_pets,base_price_per_night,status)
    SELECT v_shop,'ROOM-'||n,'standard',1,500,'available' FROM generate_series(1,11) n;
    INSERT INTO pet_owners(id,shop_id,first_name,phone) VALUES(v_owner,v_shop,'Unlimited Owner',CASE WHEN v_package='pro' THEN '0813200001' WHEN v_package='enterprise' THEN '0813200002' ELSE '0813200003' END);
    INSERT INTO pets(shop_id,owner_id,name,species)
    SELECT v_shop,v_owner,'Pet '||n,'dog' FROM generate_series(1,301) n;
    IF (SELECT count(*) FROM rooms WHERE shop_id=v_shop)<>11
       OR (SELECT count(*) FROM pets WHERE shop_id=v_shop)<>301 THEN
      RAISE EXCEPTION '%/% unlimited entitlement regressed',v_package,v_offer;
    END IF;
  END LOOP;
END $$;

RESET ROLE;

-- The audit trail is immutable even to a direct privileged statement.
DO $$
DECLARE
  v_audit_id uuid;
  denied boolean := false;
BEGIN
  SELECT id INTO v_audit_id FROM subscription_audit_log ORDER BY created_at LIMIT 1;
  BEGIN
    UPDATE subscription_audit_log SET reason='tampered' WHERE id=v_audit_id;
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%SUBSCRIPTION_AUDIT_IMMUTABLE%'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Subscription audit UPDATE was not blocked'; END IF;
  denied := false;
  BEGIN
    DELETE FROM subscription_audit_log WHERE id=v_audit_id;
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%SUBSCRIPTION_AUDIT_IMMUTABLE%'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Subscription audit DELETE was not blocked'; END IF;
END $$;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);

-- Package authority: billing interval, idempotency, actor semantics, and atomic audit.
DO $$
DECLARE
  v_shop uuid := (SELECT pv.v::uuid FROM phase13_values AS pv WHERE k='shop');
  v_key uuid := gen_random_uuid();
  v_before int;
  v_after int;
  denied boolean := false;
BEGIN
  SELECT count(*) INTO v_before FROM subscription_audit_log WHERE shop_id=v_shop;
  PERFORM set_shop_commercial_package(v_shop,'pro','standard','annual','system','annual package',v_key,NULL);
  PERFORM set_shop_commercial_package(v_shop,'pro','standard','annual','system','annual package',v_key,NULL);
  SELECT count(*) INTO v_after FROM subscription_audit_log WHERE shop_id=v_shop;
  IF v_after<>v_before+1 THEN RAISE EXCEPTION 'Package retry created duplicate/missing audit'; END IF;
  IF NOT EXISTS (SELECT 1 FROM shop_subscriptions WHERE shop_id=v_shop AND package_id='pro' AND billing_interval='annual') THEN
    RAISE EXCEPTION 'Authoritative billing interval was not persisted';
  END IF;
  BEGIN
    PERFORM set_shop_commercial_package(v_shop,'starter','standard','monthly','system','conflicting retry',v_key,NULL);
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%COMMERCIAL_PACKAGE_IDEMPOTENCY_CONFLICT%'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Package idempotency conflict was not rejected'; END IF;
END $$;

-- Lifecycle timestamps, allowed/illegal transitions, terminal continuity, and no false audit.
DO $$
DECLARE
  v_shop uuid := (SELECT pv.v::uuid FROM phase13_values AS pv WHERE k='shop');
  v_count int;
  denied boolean := false;
BEGIN
  PERFORM transition_shop_subscription(v_shop,'active','system','activate',gen_random_uuid(),now()+interval '30 days',NULL,NULL);
  PERFORM transition_shop_subscription(v_shop,'past_due','system','past due',gen_random_uuid(),NULL,NULL,NULL);
  PERFORM transition_shop_subscription(v_shop,'grace_period','system','grace',gen_random_uuid(),NULL,now()+interval '3 days',NULL);
  PERFORM transition_shop_subscription(v_shop,'suspended','system','suspend',gen_random_uuid(),NULL,NULL,NULL);
  PERFORM transition_shop_subscription(v_shop,'active','system','reactivate',gen_random_uuid(),now()+interval '30 days',NULL,NULL);
  PERFORM transition_shop_subscription(v_shop,'cancel_at_period_end','system','cancel scheduled',gen_random_uuid(),NULL,NULL,NULL);
  PERFORM transition_shop_subscription(v_shop,'cancelled','system','cancel terminal',gen_random_uuid(),NULL,NULL,NULL);
  SELECT count(*) INTO v_count FROM subscription_audit_log WHERE shop_id=v_shop;
  BEGIN
    PERFORM transition_shop_subscription(v_shop,'active','system','illegal resurrection',gen_random_uuid(),now()+interval '30 days',NULL,NULL);
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%ILLEGAL_SUBSCRIPTION_TRANSITION%'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Terminal cancelled subscription was resurrected'; END IF;
  IF (SELECT count(*) FROM subscription_audit_log WHERE shop_id=v_shop)<>v_count THEN
    RAISE EXCEPTION 'Failed lifecycle mutation wrote false audit';
  END IF;
  IF EXISTS (SELECT 1 FROM shop_subscriptions WHERE shop_id=v_shop AND founding_member_continuity_valid) THEN
    RAISE EXCEPTION 'Terminal lapse did not permanently remove Founding Member continuity';
  END IF;
END $$;

-- Terminal state blocks both package changes and representative business mutations.
DO $$
DECLARE
  v_shop uuid := (SELECT pv.v::uuid FROM phase13_values AS pv WHERE k='shop');
  denied boolean := false;
BEGIN
  BEGIN
    PERFORM set_shop_commercial_package(v_shop,'starter','standard','monthly','system','must fail',gen_random_uuid(),NULL);
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%COMMERCIAL_ACCESS_BLOCKED%'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Terminal subscription accepted package mutation'; END IF;
  denied := false;
  BEGIN
    INSERT INTO rooms(shop_id,room_number,room_type,capacity_pets,base_price_per_night,status)
    VALUES(v_shop,'blocked-room','standard',1,500,'available');
  EXCEPTION WHEN OTHERS THEN denied := SQLERRM LIKE '%COMMERCIAL_ACCESS_BLOCKED%'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Terminal subscription accepted room mutation'; END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',(SELECT pv.v FROM phase13_values AS pv WHERE k='owner'),true);
DO $$
DECLARE v jsonb;
BEGIN
  v := get_shop_commercial_status((SELECT pv.v::uuid FROM phase13_values AS pv WHERE k='shop'));
  IF v->>'lifecycle_status' <> 'cancelled'
     OR COALESCE((v->>'commercial_access')::boolean,true) IS NOT FALSE THEN
    RAISE EXCEPTION 'Owner lost safe read-only subscription visibility after terminal state';
  END IF;
END $$;
RESET ROLE;
SELECT pass('Phase 13 subscription lifecycle, authority, security, and access assertions completed');
SELECT * FROM finish();
ROLLBACK;
