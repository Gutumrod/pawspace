\set ON_ERROR_STOP on
BEGIN;

-- PawSpace Phase 2 negative/authorization/RPC acceptance tests.
DO $$
DECLARE missing text[];
BEGIN
  SELECT array_agg(x.name) INTO missing
  FROM (VALUES ('create_booking'),('add_pet_to_booking'),('remove_pet_from_booking'),
    ('update_booking_status'),('update_booking_schedule'),('create_daily_report'),
    ('retry_daily_report_delivery'),('create_room'),('update_room_config'),
    ('set_room_maintenance'),('mark_room_clean'),('create_pet_owner'),
    ('update_pet_owner_profile'),('create_pet'),('update_pet_profile'),
    ('transfer_pet_owner'),('delete_pet'),('delete_pet_owner'),('enqueue_sync_event')) x(name)
  WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=x.name);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing Phase 2 functions: %', missing; END IF;
END $$;

DO $$
DECLARE leaked text[];
BEGIN
  SELECT array_agg(table_name || ':' || privilege_type) INTO leaked
  FROM information_schema.role_table_grants
  WHERE grantee='authenticated'
    AND table_schema='public'
    AND table_name IN ('shops','staff_users','pet_owners','pets','rooms','bookings','booking_pets','daily_reports','google_sync_mappings','sync_queue')
    AND privilege_type IN ('INSERT','UPDATE','DELETE');
  IF leaked IS NOT NULL THEN RAISE EXCEPTION 'authenticated core DML privilege leak: %', leaked; END IF;
  IF has_function_privilege('authenticated','enqueue_sync_event(uuid,character varying,uuid,character varying,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute internal enqueue_sync_event';
  END IF;
END $$;

CREATE TEMP TABLE phase2_ids(k text PRIMARY KEY, v uuid NOT NULL);
GRANT SELECT, INSERT ON phase2_ids TO authenticated;
DO $$
DECLARE s1 uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid();
  u1 uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); o1 uuid:=gen_random_uuid(); o2 uuid:=gen_random_uuid();
  p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); p3 uuid:=gen_random_uuid(); p4 uuid:=gen_random_uuid(); o3 uuid:=gen_random_uuid(); r1 uuid:=gen_random_uuid(); r2 uuid:=gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email) VALUES (u1,'phase2-owner-1@example.invalid'),(u2,'phase2-owner-2@example.invalid');
  INSERT INTO shops(id,name,slug) VALUES (s1,'P2 Shop 1','p2-shop-1'),(s2,'P2 Shop 2','p2-shop-2');
  INSERT INTO staff_users(id,shop_id,email,name,role,is_active) VALUES
    (u1,s1,'phase2-owner-1@example.invalid','Owner 1','owner',true),(u2,s2,'phase2-owner-2@example.invalid','Owner 2','owner',true);
  INSERT INTO pet_owners(id,shop_id,first_name,phone) VALUES (o1,s1,'Owner A','0810000001'),(o2,s2,'Owner B','0810000002'),(o3,s1,'Owner C','0810000003');
  INSERT INTO pets(id,shop_id,owner_id,name,species) VALUES (p1,s1,o1,'Milo','dog'),(p2,s2,o2,'Luna','cat'),(p3,s1,o3,'Coco','dog'),(p4,s1,o1,'Mochi','cat');
  INSERT INTO rooms(id,shop_id,room_number,room_type,capacity_pets,base_price_per_night) VALUES
    (r1,s1,'P2-A1','standard',2,500),(r2,s2,'P2-B1','standard',2,500);
  INSERT INTO phase2_ids VALUES ('s1',s1),('s2',s2),('u1',u1),('u2',u2),('o1',o1),('o2',o2),('p1',p1),('p2',p2),('p3',p3),('p4',p4),('o3',o3),('r1',r1),('r2',r2);
END $$;

SELECT set_config('request.jwt.claim.sub',(SELECT v::text FROM phase2_ids WHERE k='u1'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN INSERT INTO bookings(shop_id,owner_id,room_id,check_in_date,check_out_date)
    VALUES ((SELECT v FROM phase2_ids WHERE k='s1'),(SELECT v FROM phase2_ids WHERE k='o1'),
      (SELECT v FROM phase2_ids WHERE k='r1'),DATE '2026-10-01',DATE '2026-10-02');
  EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'authenticated direct booking INSERT was not denied'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE b uuid; q int;
BEGIN
  b:=create_booking((SELECT v FROM phase2_ids WHERE k='o1'),(SELECT v FROM phase2_ids WHERE k='r1'),DATE '2026-10-10',DATE '2026-10-12',1000,NULL);
  INSERT INTO phase2_ids VALUES ('b1',b);
  SELECT count(*) INTO q FROM sync_queue WHERE shop_id=(SELECT v FROM phase2_ids WHERE k='s1') AND entity_type='booking' AND entity_id=b;
  IF q<>1 THEN RAISE EXCEPTION 'create_booking did not enqueue exactly one booking event'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE failed boolean; before_count int;
BEGIN
  SELECT count(*) INTO before_count FROM bookings;
  failed:=false;
  BEGIN PERFORM create_booking((SELECT v FROM phase2_ids WHERE k='o2'),(SELECT v FROM phase2_ids WHERE k='r1'),DATE '2026-10-20',DATE '2026-10-21',0,NULL);
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed OR (SELECT count(*) FROM bookings)<>before_count THEN RAISE EXCEPTION 'cross-tenant create_booking not safely rejected'; END IF;
  failed:=false;
  BEGIN PERFORM add_pet_to_booking((SELECT v FROM phase2_ids WHERE k='b1'),(SELECT v FROM phase2_ids WHERE k='p2'));
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'cross-tenant pet assignment accepted'; END IF;
  failed:=false;
  BEGIN PERFORM add_pet_to_booking((SELECT v FROM phase2_ids WHERE k='b1'),(SELECT v FROM phase2_ids WHERE k='p3'));
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'same-tenant wrong-owner pet assignment accepted'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE failed boolean; r uuid:=(SELECT v FROM phase2_ids WHERE k='r1'); b uuid:=(SELECT v FROM phase2_ids WHERE k='b1');
BEGIN
  PERFORM add_pet_to_booking(b,(SELECT v FROM phase2_ids WHERE k='p1'));
  PERFORM add_pet_to_booking(b,(SELECT v FROM phase2_ids WHERE k='p4'));
  failed:=false;
  BEGIN PERFORM update_room_config(r,'P2-A1','standard',1,500); EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'room capacity reduction below active assignment succeeded'; END IF;
  failed:=false;
  BEGIN PERFORM transfer_pet_owner((SELECT v FROM phase2_ids WHERE k='p1'),(SELECT v FROM phase2_ids WHERE k='o3')); EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'active pet owner transfer succeeded'; END IF;
  failed:=false;
  BEGIN PERFORM update_booking_status(b,'checked_in'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'check-in on wrong business date succeeded'; END IF;
  PERFORM update_booking_schedule(b,r,pawspace_business_date(),pawspace_business_date()+1,NULL,NULL);
  PERFORM update_booking_status(b,'checked_in');
  failed:=false;
  BEGIN PERFORM update_booking_status(b,'cancelled'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'checked_in cancellation succeeded'; END IF;
  PERFORM update_booking_status(b,'checked_out');
  IF (SELECT status FROM rooms WHERE id=r)<>'cleaning' THEN RAISE EXCEPTION 'checkout did not enter cleaning'; END IF;
  failed:=false;
  BEGIN PERFORM set_room_maintenance(r,pawspace_business_date(),pawspace_business_date()); EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'current maintenance overwrote cleaning state'; END IF;
  PERFORM mark_room_clean(r);
  IF (SELECT status FROM rooms WHERE id=r)<>'available' THEN RAISE EXCEPTION 'cleaning gate failed'; END IF;
END $$;
RESET ROLE;

DO $$
DECLARE failed boolean:=false;
BEGIN
  BEGIN UPDATE bookings SET owner_id=(SELECT v FROM phase2_ids WHERE k='o2') WHERE id=(SELECT v FROM phase2_ids WHERE k='b1');
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'bookings.owner_id immutability failed'; END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.fail_sync_queue() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced sync failure'; END $$;
CREATE TRIGGER phase2_force_sync_failure BEFORE INSERT ON sync_queue FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_sync_queue();
SET LOCAL ROLE authenticated;
DO $$
DECLARE failed boolean:=false; before_count int;
BEGIN
  SELECT count(*) INTO before_count FROM pets WHERE shop_id=(SELECT v FROM phase2_ids WHERE k='s1');
  BEGIN PERFORM create_pet((SELECT v FROM phase2_ids WHERE k='o1'),'RollbackPet','dog',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'forced outbox failure did not fail mutation'; END IF;
  IF (SELECT count(*) FROM pets WHERE shop_id=(SELECT v FROM phase2_ids WHERE k='s1'))<>before_count THEN RAISE EXCEPTION 'mutation survived outbox failure'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER phase2_force_sync_failure ON sync_queue;

DO $$
BEGIN
  IF has_function_privilege(
    'authenticated',
    'enqueue_sync_event(uuid,character varying,uuid,character varying,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated can execute internal enqueue_sync_event';
  END IF;
END $$;

-- Disabled staff must immediately lose tenant visibility through current_staff_shop_id + RLS.
UPDATE staff_users SET is_active=false WHERE id=(SELECT v FROM phase2_ids WHERE k='u1');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM shops WHERE id=(SELECT v FROM phase2_ids WHERE k='s1')) THEN
    RAISE EXCEPTION 'disabled staff retained RLS visibility';
  END IF;
END $$;
RESET ROLE;

ROLLBACK;
