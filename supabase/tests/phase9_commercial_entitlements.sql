\set ON_ERROR_STOP on
BEGIN;
SELECT plan(1);

CREATE TEMP TABLE phase9_values(k text PRIMARY KEY, v text NOT NULL);
GRANT SELECT, INSERT, UPDATE ON phase9_values TO authenticated;

DO $$
DECLARE
  shop_a uuid:=gen_random_uuid(); shop_b uuid:=gen_random_uuid(); shop_empty uuid:=gen_random_uuid();
  owner_a uuid:=gen_random_uuid(); manager_a uuid:=gen_random_uuid(); staff_a uuid:=gen_random_uuid();
  inactive_a uuid:=gen_random_uuid(); owner_b uuid:=gen_random_uuid(); owner_empty uuid:=gen_random_uuid();
  no_member uuid:=gen_random_uuid(); pet_owner_a uuid:=gen_random_uuid(); pet_a uuid:=gen_random_uuid();
  room1 uuid:=gen_random_uuid(); room2 uuid:=gen_random_uuid(); room3 uuid:=gen_random_uuid(); room4 uuid:=gen_random_uuid();
  booking1 uuid:=gen_random_uuid(); booking2 uuid:=gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email) VALUES
    (owner_a,'p9-owner-a@example.invalid'),(manager_a,'p9-manager-a@example.invalid'),
    (staff_a,'p9-staff-a@example.invalid'),(inactive_a,'p9-inactive-a@example.invalid'),
    (owner_b,'p9-owner-b@example.invalid'),(owner_empty,'p9-owner-empty@example.invalid'),
    (no_member,'p9-no-member@example.invalid');

  INSERT INTO shops(id,name,slug,line_oa_id,google_sheet_id) VALUES
    (shop_a,'P9 Shop A','p9-shop-a','oa-a','sheet-a'),
    (shop_b,'P9 Shop B','p9-shop-b',NULL,NULL),
    (shop_empty,'P9 Empty Shop','p9-empty-shop',NULL,NULL);
  INSERT INTO staff_users(id,shop_id,email,name,role,is_active) VALUES
    (owner_a,shop_a,'p9-owner-a@example.invalid','Owner A','owner',TRUE),
    (manager_a,shop_a,'p9-manager-a@example.invalid','Manager A','manager',TRUE),
    (staff_a,shop_a,'p9-staff-a@example.invalid','Staff A','staff',TRUE),
    (inactive_a,shop_a,'p9-inactive-a@example.invalid','Inactive A','manager',FALSE),
    (owner_b,shop_b,'p9-owner-b@example.invalid','Owner B','owner',TRUE),
    (owner_empty,shop_empty,'p9-owner-empty@example.invalid','Owner Empty','owner',TRUE);

  INSERT INTO shop_commercial_assignments(shop_id,package_id,commercial_offer) VALUES
    (shop_a,'starter','standard'),
    (shop_b,'starter','founding_member');

  INSERT INTO rooms(id,shop_id,room_number,room_type,capacity_pets,base_price_per_night,status,maintenance_from,maintenance_until) VALUES
    (room1,shop_a,'A1','standard',1,500,'occupied',NULL,NULL),
    (room2,shop_a,'A2','standard',1,500,'cleaning',NULL,NULL),
    (room3,shop_a,'A3','standard',1,500,'maintenance',pawspace_business_date(),pawspace_business_date()),
    (room4,shop_a,'A4','standard',1,500,'available',NULL,NULL);

  INSERT INTO pet_owners(id,shop_id,first_name,phone,line_user_id)
  VALUES (pet_owner_a,shop_a,'Customer','0800000001','line-customer-a');
  INSERT INTO pets(id,shop_id,owner_id,name,species)
  VALUES (pet_a,shop_a,pet_owner_a,'Milo','dog');

  INSERT INTO bookings(id,shop_id,owner_id,room_id,check_in_date,check_out_date,booking_status,total_amount) VALUES
    (booking1,shop_a,pet_owner_a,room1,pawspace_business_date(),pawspace_business_date()+1,'confirmed',500),
    (booking2,shop_a,pet_owner_a,room2,pawspace_business_date()-1,pawspace_business_date(),'checked_out',500);
  INSERT INTO booking_pets(shop_id,booking_id,pet_id) VALUES
    (shop_a,booking1,pet_a),(shop_a,booking2,pet_a);

  INSERT INTO daily_reports(
    shop_id,booking_id,pet_id,report_date,idempotency_key,request_fingerprint,
    line_delivery_retry_key,food_status,excretion_status,mood_status,photo_urls,line_delivery_status
  ) VALUES
    (shop_a,booking1,pet_a,pawspace_business_date(),gen_random_uuid(),'p9-sent',gen_random_uuid(),
     'finished','normal','happy',ARRAY['https://example.invalid/sent.jpg'],'sent'),
    (shop_a,booking1,pet_a,pawspace_business_date(),gen_random_uuid(),'p9-failed',gen_random_uuid(),
     'half','normal','calm',ARRAY['https://example.invalid/failed.jpg'],'failed');

  INSERT INTO camera_settings(shop_id,device_name,feed_url,is_enabled)
  VALUES (shop_a,'Microsoft LifeCam','https://camera.example.invalid/live',TRUE);

  INSERT INTO phase9_values(k,v) VALUES
    ('shop_a',shop_a::text),('shop_b',shop_b::text),('shop_empty',shop_empty::text),
    ('owner_a',owner_a::text),('manager_a',manager_a::text),('staff_a',staff_a::text),
    ('inactive_a',inactive_a::text),('owner_b',owner_b::text),('owner_empty',owner_empty::text),
    ('no_member',no_member::text);
END $$;

-- Browser privilege surface must remain read-only and tenant/role filtered.
DO $$
BEGIN
  IF has_table_privilege('anon','commercial_packages','SELECT')
     OR has_table_privilege('anon','shop_commercial_assignments','SELECT') THEN
    RAISE EXCEPTION 'anon can read commercial Phase 9 tables';
  END IF;
  IF has_table_privilege('authenticated','commercial_packages','INSERT')
     OR has_table_privilege('authenticated','commercial_packages','UPDATE')
     OR has_table_privilege('authenticated','commercial_packages','DELETE')
     OR has_table_privilege('authenticated','commercial_packages','TRUNCATE')
     OR has_table_privilege('authenticated','shop_commercial_assignments','INSERT')
     OR has_table_privilege('authenticated','shop_commercial_assignments','UPDATE')
     OR has_table_privilege('authenticated','shop_commercial_assignments','DELETE')
     OR has_table_privilege('authenticated','shop_commercial_assignments','TRUNCATE') THEN
    RAISE EXCEPTION 'authenticated commercial DML privilege leaked';
  END IF;
  IF has_function_privilege('anon','get_shop_effective_entitlement(uuid)','EXECUTE')
     OR has_function_privilege('anon','get_owner_manager_dashboard_summary()','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute Phase 9 privileged RPC';
  END IF;
  IF NOT has_function_privilege('authenticated','get_shop_effective_entitlement(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','get_owner_manager_dashboard_summary()','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated Phase 9 RPC grant missing';
  END IF;
END $$;

-- Canonical package facts must match BUSINESS_MODEL.md without invented support promises.
DO $$
DECLARE s commercial_packages%ROWTYPE; p commercial_packages%ROWTYPE; e commercial_packages%ROWTYPE;
BEGIN
  SELECT * INTO s FROM commercial_packages WHERE id='starter';
  SELECT * INTO p FROM commercial_packages WHERE id='pro';
  SELECT * INTO e FROM commercial_packages WHERE id='enterprise';
  IF s.monthly_price<>990 OR s.annual_price<>9900 OR s.room_limit<>10 OR s.pet_history_limit<>300 OR s.support_tier IS NOT NULL THEN
    RAISE EXCEPTION 'Starter commercial facts drifted';
  END IF;
  IF p.monthly_price<>1490 OR p.annual_price<>14900 OR p.room_limit IS NOT NULL OR p.pet_history_limit IS NOT NULL OR p.support_tier IS NOT NULL THEN
    RAISE EXCEPTION 'Pro commercial facts drifted';
  END IF;
  IF e.monthly_price<>2490 OR e.annual_price<>24900 OR e.room_limit IS NOT NULL OR e.pet_history_limit IS NOT NULL OR e.support_tier<>'priority' THEN
    RAISE EXCEPTION 'Enterprise commercial facts drifted';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;

-- Owner and manager can resolve their own shop; plain staff cannot read assignment or privileged entitlement.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='owner_a'),true);
DO $$
DECLARE e record; assignment_count int;
BEGIN
  SELECT * INTO e FROM get_shop_effective_entitlement((SELECT v::uuid FROM phase9_values WHERE k='shop_a'));
  IF e.package_id<>'starter' OR e.monthly_price<>990 OR e.annual_price<>9900 OR e.room_limit<>10 OR e.pet_history_limit<>300 THEN
    RAISE EXCEPTION 'Owner Starter entitlement incorrect';
  END IF;
  SELECT COUNT(*) INTO assignment_count FROM shop_commercial_assignments;
  IF assignment_count<>1 THEN RAISE EXCEPTION 'Owner assignment RLS incorrect'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='manager_a'),true);
DO $$ BEGIN
  PERFORM * FROM get_shop_effective_entitlement((SELECT v::uuid FROM phase9_values WHERE k='shop_a'));
END $$;

SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='staff_a'),true);
DO $$
DECLARE denied boolean:=false; assignment_count int;
BEGIN
  BEGIN
    PERFORM * FROM get_shop_effective_entitlement((SELECT v::uuid FROM phase9_values WHERE k='shop_a'));
  EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Plain staff can execute privileged entitlement'; END IF;
  SELECT COUNT(*) INTO assignment_count FROM shop_commercial_assignments;
  IF assignment_count<>0 THEN RAISE EXCEPTION 'Plain staff can read commercial assignment'; END IF;
END $$;

-- No membership, inactive membership, and cross-tenant access must fail closed.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='no_member'),true);
DO $$ DECLARE denied boolean:=false; BEGIN
  BEGIN PERFORM * FROM get_shop_effective_entitlement((SELECT v::uuid FROM phase9_values WHERE k='shop_a'));
  EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'No-membership entitlement bypass'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='inactive_a'),true);
DO $$ DECLARE denied boolean:=false; BEGIN
  BEGIN PERFORM * FROM get_shop_effective_entitlement((SELECT v::uuid FROM phase9_values WHERE k='shop_a'));
  EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Inactive membership entitlement bypass'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='owner_a'),true);
DO $$ DECLARE denied boolean:=false; BEGIN
  BEGIN PERFORM * FROM get_shop_effective_entitlement((SELECT v::uuid FROM phase9_values WHERE k='shop_b'));
  EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-tenant entitlement bypass'; END IF;
END $$;
-- Founding Member is shop-bound, uses Starter identity with Pro room/pet entitlements,
-- has no invented annual price, and does not include future paid add-ons.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='owner_b'),true);
DO $$
DECLARE e record;
BEGIN
  SELECT * INTO e FROM get_shop_effective_entitlement((SELECT v::uuid FROM phase9_values WHERE k='shop_b'));
  IF e.package_id<>'starter'
     OR e.package_name<>'Starter (Founding Member Pro)'
     OR e.commercial_offer<>'founding_member'
     OR e.monthly_price<>990
     OR e.annual_price IS NOT NULL
     OR e.room_limit IS NOT NULL
     OR e.pet_history_limit IS NOT NULL
     OR e.support_tier IS NOT NULL
     OR e.future_paid_addons_included<>FALSE THEN
    RAISE EXCEPTION 'Founding Member C2 contract drifted';
  END IF;
END $$;

-- Dashboard authorization: owner and manager allowed; staff/inactive/no-membership denied.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='owner_a'),true);
DO $$ DECLARE payload jsonb; BEGIN
  payload:=get_owner_manager_dashboard_summary();
  IF payload#>>'{staff,role}'<>'owner' THEN RAISE EXCEPTION 'Owner dashboard access failed'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='manager_a'),true);
DO $$ DECLARE payload jsonb; BEGIN
  payload:=get_owner_manager_dashboard_summary();
  IF payload#>>'{staff,role}'<>'manager' THEN RAISE EXCEPTION 'Manager dashboard access failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='staff_a'),true);
DO $$ DECLARE denied boolean:=false; BEGIN
  BEGIN PERFORM get_owner_manager_dashboard_summary(); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Plain staff can open dashboard'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='inactive_a'),true);
DO $$ DECLARE denied boolean:=false; BEGIN
  BEGIN PERFORM get_owner_manager_dashboard_summary(); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Inactive staff can open dashboard'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='no_member'),true);
DO $$ DECLARE denied boolean:=false; BEGIN
  BEGIN PERFORM get_owner_manager_dashboard_summary(); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'No-membership user can open dashboard'; END IF;
END $$;

-- Live tenant-scoped data and secret-free DTO.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='owner_a'),true);
DO $$
DECLARE payload jsonb; payload_text text;
BEGIN
  payload:=get_owner_manager_dashboard_summary();
  IF payload#>>'{shop,id}'<>(SELECT v FROM phase9_values WHERE k='shop_a') THEN RAISE EXCEPTION 'Dashboard tenant scope incorrect'; END IF;
  IF (payload#>>'{rooms,total}')::int<>4 OR (payload#>>'{rooms,available}')::int<>1
     OR (payload#>>'{rooms,occupied}')::int<>1 OR (payload#>>'{rooms,cleaning}')::int<>1
     OR (payload#>>'{rooms,maintenance}')::int<>1 THEN RAISE EXCEPTION 'Room dashboard summary incorrect'; END IF;
  IF (payload#>>'{bookings,active}')::int<>1 OR (payload#>>'{bookings,todayCheckIns}')::int<>1
     OR (payload#>>'{bookings,todayCheckOuts}')::int<>1 THEN RAISE EXCEPTION 'Booking dashboard summary incorrect'; END IF;
  IF (payload#>>'{dailyReports,totalReportsToday}')::int<>2
     OR (payload#>>'{dailyReports,deliveredCount}')::int<>1
     OR (payload#>>'{dailyReports,failedCount}')::int<>1 THEN
    RAISE EXCEPTION 'Daily Report dashboard summary incorrect';
  END IF;
  IF (payload#>>'{integrations,lineLinked}')::boolean<>TRUE
     OR (payload#>>'{integrations,googleSheetsEnabled}')::boolean<>TRUE
     OR (payload#>>'{integrations,cameraEnabled}')::boolean<>TRUE THEN
    RAISE EXCEPTION 'Integration dashboard summary incorrect';
  END IF;
  payload_text:=payload::text;
  IF payload_text ILIKE '%feed_url%'
     OR payload_text ILIKE '%claim_token%'
     OR payload_text ILIKE '%line_oa_id%'
     OR payload_text ILIKE '%google_sheet_id%'
     OR payload_text ILIKE '%email%'
     OR payload_text ILIKE '%service_role%' THEN
    RAISE EXCEPTION 'Dashboard DTO leaked secret/admin-only fields';
  END IF;
END $$;

-- Prove data is live: a DB fixture change must change the returned summary.
RESET ROLE;
INSERT INTO rooms(shop_id,room_number,room_type,capacity_pets,base_price_per_night,status)
VALUES ((SELECT v::uuid FROM phase9_values WHERE k='shop_a'),'A5','standard',1,500,'available');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='owner_a'),true);
DO $$ DECLARE payload jsonb; BEGIN
  payload:=get_owner_manager_dashboard_summary();
  IF (payload#>>'{rooms,total}')::int<>5 OR (payload#>>'{rooms,available}')::int<>2 THEN
    RAISE EXCEPTION 'Dashboard does not reflect live DB fixture changes';
  END IF;
END $$;
-- Empty/new tenant must return safe zero summaries and Starter default entitlement.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='owner_empty'),true);
DO $$ DECLARE payload jsonb; BEGIN
  payload:=get_owner_manager_dashboard_summary();
  IF (payload#>>'{rooms,total}')::int<>0
     OR (payload#>>'{bookings,active}')::int<>0
     OR (payload#>>'{dailyReports,totalReportsToday}')::int<>0 THEN
    RAISE EXCEPTION 'Empty tenant dashboard is not zero-safe';
  END IF;
  IF payload#>>'{entitlement,package_id}'<>'starter'
     OR (payload#>>'{entitlement,room_limit}')::int<>10 THEN
    RAISE EXCEPTION 'Empty tenant Starter fallback incorrect';
  END IF;
END $$;

-- Phase 13 intentionally supersedes Phase 9's non-enforcement assumption:
-- Starter reaches 10 rooms, while room 11 must fail closed.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase9_values WHERE k='owner_a'),true);
DO $$
DECLARE i int; room_count int; entitlement_limit int; denied boolean:=false;
BEGIN
  FOR i IN 6..10 LOOP
    PERFORM create_room(('P9-Q'||i)::varchar,'standard'::varchar,1,500::numeric);
  END LOOP;
  BEGIN
    PERFORM create_room('P9-Q11'::varchar,'standard'::varchar,1,500::numeric);
  EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%ROOM_QUOTA_EXCEEDED%'; END;
  SELECT COUNT(*) INTO room_count FROM rooms WHERE shop_id=(SELECT v::uuid FROM phase9_values WHERE k='shop_a');
  SELECT room_limit INTO entitlement_limit
  FROM get_shop_effective_entitlement((SELECT v::uuid FROM phase9_values WHERE k='shop_a'));
  IF entitlement_limit<>10 OR room_count<>entitlement_limit OR NOT denied THEN
    RAISE EXCEPTION 'Phase 13 Starter room quota regression';
  END IF;
END $$;

RESET ROLE;
SELECT pass('Phase 9 owner/manager dashboard and commercial entitlement acceptance assertions completed');
SELECT * FROM finish();
ROLLBACK;
