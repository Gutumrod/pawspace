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
     OR has_table_privilege('authenticated','subscription_audit_log','DELETE') THEN
    RAISE EXCEPTION 'Generic browser commercial DML leaked';
  END IF;
  IF has_function_privilege('authenticated','set_shop_commercial_package(uuid,character varying,character varying,character varying,character varying,text,uuid,uuid)','EXECUTE')
     OR has_function_privilege('anon','transition_shop_subscription(uuid,character varying,character varying,text,uuid,timestamptz,timestamptz,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Browser commercial mutation RPC leaked';
  END IF;
END $$;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);

-- Package authority: billing interval, idempotency, actor semantics, and atomic audit.
DO $$
DECLARE
  v_shop uuid := (SELECT v::uuid FROM phase13_values WHERE k='shop');
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
  v_shop uuid := (SELECT v::uuid FROM phase13_values WHERE k='shop');
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
  v_shop uuid := (SELECT v::uuid FROM phase13_values WHERE k='shop');
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
SELECT pass('Phase 13 subscription lifecycle, authority, security, and access assertions completed');
SELECT * FROM finish();
ROLLBACK;
