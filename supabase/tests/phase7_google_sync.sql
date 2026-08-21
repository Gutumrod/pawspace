\set ON_ERROR_STOP on
BEGIN;
SELECT plan(1);

DO $$
BEGIN
  IF has_function_privilege('authenticated','connect_google_sheet_internal(text,character varying,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute internal Google Sheet connect';
  END IF;
  IF has_function_privilege('authenticated','claim_google_sync_event_internal()','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute internal Google sync claim';
  END IF;
  IF has_function_privilege('authenticated','mark_google_sync_completed_internal(uuid,character varying,character varying,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute internal Google sync completion';
  END IF;
  IF has_function_privilege('authenticated','mark_google_sync_failed_internal(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute internal Google sync failure transition';
  END IF;
END $$;

CREATE TEMP TABLE phase7_values(k text PRIMARY KEY, v text NOT NULL);
GRANT SELECT, INSERT, UPDATE ON phase7_values TO authenticated;

DO $$
DECLARE
  s1 uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid();
  owner1 uuid:=gen_random_uuid(); manager1 uuid:=gen_random_uuid(); staff1 uuid:=gen_random_uuid(); owner2 uuid:=gen_random_uuid();
  po1 uuid:=gen_random_uuid(); pet1 uuid:=gen_random_uuid(); room1 uuid:=gen_random_uuid(); booking1 uuid:=gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email) VALUES
    (owner1,'p7-owner1@example.invalid'),(manager1,'p7-manager@example.invalid'),
    (staff1,'p7-staff@example.invalid'),(owner2,'p7-owner2@example.invalid');
  INSERT INTO shops(id,name,slug) VALUES (s1,'P7 Shop 1','p7-shop-1'),(s2,'P7 Shop 2','p7-shop-2');
  INSERT INTO staff_users(id,shop_id,email,name,role,is_active) VALUES
    (owner1,s1,'p7-owner1@example.invalid','Owner 1','owner',true),
    (manager1,s1,'p7-manager@example.invalid','Manager 1','manager',true),
    (staff1,s1,'p7-staff@example.invalid','Staff 1','staff',true),
    (owner2,s2,'p7-owner2@example.invalid','Owner 2','owner',true);
  INSERT INTO pet_owners(id,shop_id,first_name,last_name,phone) VALUES
    (po1,s1,'P7','Customer','0817770001');
  INSERT INTO pets(id,shop_id,owner_id,name,species,breed) VALUES
    (pet1,s1,po1,'Mochi','cat','Domestic');
  INSERT INTO rooms(id,shop_id,room_number,room_type,capacity_pets,base_price_per_night) VALUES
    (room1,s1,'P7-A1','standard',1,500);
  INSERT INTO bookings(id,shop_id,owner_id,room_id,check_in_date,check_out_date,total_amount)
    VALUES (booking1,s1,po1,room1,DATE '2026-09-01',DATE '2026-09-02',500);
  INSERT INTO booking_pets(shop_id,booking_id,pet_id) VALUES (s1,booking1,pet1);

  INSERT INTO phase7_values VALUES
    ('s1',s1::text),('s2',s2::text),('owner1',owner1::text),('manager1',manager1::text),
    ('staff1',staff1::text),('owner2',owner2::text),('po1',po1::text),('pet1',pet1::text),
    ('room1',room1::text),('booking1',booking1::text);
END $$;

-- Staff must not generate a binding token.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase7_values WHERE k='staff1'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE failed boolean:=false;
BEGIN
  BEGIN PERFORM generate_google_sheet_claim_token(); EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'staff generated Google Sheet claim token'; END IF;
END $$;
RESET ROLE;
-- Manager can generate; token is hashed at rest with a 15-minute TTL.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase7_values WHERE k='manager1'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE token text; stored_hash text; expires timestamptz; ttl numeric;
BEGIN
  token:=generate_google_sheet_claim_token();
  SELECT google_sheet_claim_token_hash,google_sheet_claim_expires_at INTO stored_hash,expires
  FROM shops WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='s1');
  ttl:=extract(epoch FROM (expires-now()));
  IF length(token)<>64 THEN RAISE EXCEPTION 'claim token is not 32-byte hex'; END IF;
  IF stored_hash=token THEN RAISE EXCEPTION 'plaintext claim token stored in DB'; END IF;
  IF stored_hash<>encode(digest(token,'sha256'),'hex') THEN RAISE EXCEPTION 'claim hash mismatch'; END IF;
  IF ttl NOT BETWEEN 895 AND 905 THEN RAISE EXCEPTION 'claim TTL is not 15 minutes: %',ttl; END IF;
  INSERT INTO phase7_values VALUES ('manager_token',token);
END $$;
RESET ROLE;

-- Owner can generate too.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase7_values WHERE k='owner1'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE token text;
BEGIN
  token:=generate_google_sheet_claim_token();
  IF token IS NULL THEN RAISE EXCEPTION 'owner could not generate token'; END IF;
  INSERT INTO phase7_values VALUES ('owner_token',token);
END $$;
RESET ROLE;

-- Expired and wrong-shop claims are rejected by the internal DB gate.
UPDATE shops SET google_sheet_claim_expires_at=now()-interval '1 second'
WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='s1');
DO $$
DECLARE failed boolean:=false;
BEGIN
  BEGIN PERFORM connect_google_sheet_internal((SELECT v FROM phase7_values WHERE k='owner_token'),'expired-sheet',(SELECT v::uuid FROM phase7_values WHERE k='s1'));
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'expired Google claim was accepted'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase7_values WHERE k='owner1'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE token text;
BEGIN
  token:=generate_google_sheet_claim_token();
  UPDATE phase7_values SET v=token WHERE k='owner_token';
END $$;
RESET ROLE;

DO $$
DECLARE failed boolean:=false;
BEGIN
  BEGIN PERFORM connect_google_sheet_internal(
    (SELECT v FROM phase7_values WHERE k='owner_token'),
    'wrong-shop-sheet',
    (SELECT v::uuid FROM phase7_values WHERE k='s2')
  ); EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'wrong-shop Google claim was accepted'; END IF;
END $$;

-- Seed an old mapping so successful bind must clear it, then verify full Pet + Booking snapshot.
INSERT INTO google_sync_mappings(shop_id,entity_type,entity_id,sheet_name,synced_hash)
VALUES ((SELECT v::uuid FROM phase7_values WHERE k='s1'),'pet_customer',(SELECT v::uuid FROM phase7_values WHERE k='pet1'),'Customers','old');
SELECT connect_google_sheet_internal(
  (SELECT v FROM phase7_values WHERE k='owner_token'),
  'sheet-one-verified',
  (SELECT v::uuid FROM phase7_values WHERE k='s1')
);

DO $$
DECLARE pet_events int; booking_events int;
BEGIN
  IF EXISTS (SELECT 1 FROM shops WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='s1')
      AND (google_sheet_claim_token_hash IS NOT NULL OR google_sheet_claim_expires_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'successful bind did not clear claim state';
  END IF;
  IF EXISTS (SELECT 1 FROM google_sync_mappings WHERE shop_id=(SELECT v::uuid FROM phase7_values WHERE k='s1')) THEN
    RAISE EXCEPTION 'rebind did not clear old mappings';
  END IF;
  SELECT count(*) INTO pet_events FROM sync_queue WHERE shop_id=(SELECT v::uuid FROM phase7_values WHERE k='s1') AND entity_type='pet_customer' AND entity_id=(SELECT v::uuid FROM phase7_values WHERE k='pet1');
  SELECT count(*) INTO booking_events FROM sync_queue WHERE shop_id=(SELECT v::uuid FROM phase7_values WHERE k='s1') AND entity_type='booking' AND entity_id=(SELECT v::uuid FROM phase7_values WHERE k='booking1');
  IF pet_events<>1 OR booking_events<>1 THEN RAISE EXCEPTION 'bind snapshot seed mismatch pet=% booking=%',pet_events,booking_events; END IF;
END $$;
-- Same Sheet cannot bind to a second tenant.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase7_values WHERE k='owner2'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE token text;
BEGIN
  token:=generate_google_sheet_claim_token();
  INSERT INTO phase7_values VALUES ('owner2_token',token);
END $$;
RESET ROLE;
DO $$
DECLARE failed boolean:=false;
BEGIN
  BEGIN PERFORM connect_google_sheet_internal((SELECT v FROM phase7_values WHERE k='owner2_token'),'sheet-one-verified',(SELECT v::uuid FROM phase7_values WHERE k='s2'));
  EXCEPTION WHEN unique_violation THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'same Google Sheet bound to two tenants'; END IF;
END $$;

-- Browser cannot mutate shops binding, queue, or mappings directly.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase7_values WHERE k='manager1'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE denied_shop boolean:=false; denied_queue boolean:=false; denied_mapping boolean:=false;
BEGIN
  BEGIN UPDATE shops SET google_sheet_id='forged' WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='s1');
  EXCEPTION WHEN insufficient_privilege THEN denied_shop:=true; END;
  BEGIN UPDATE sync_queue SET status='completed' WHERE shop_id=(SELECT v::uuid FROM phase7_values WHERE k='s1');
  EXCEPTION WHEN insufficient_privilege THEN denied_queue:=true; END;
  BEGIN DELETE FROM google_sync_mappings WHERE shop_id=(SELECT v::uuid FROM phase7_values WHERE k='s1');
  EXCEPTION WHEN insufficient_privilege THEN denied_mapping:=true; END;
  IF NOT denied_shop OR NOT denied_queue OR NOT denied_mapping THEN
    RAISE EXCEPTION 'authenticated core mutation privilege leaked';
  END IF;
END $$;
RESET ROLE;

-- Disconnect is authoritative and manager-accessible.
SET LOCAL ROLE authenticated;
SELECT disconnect_google_sheet();
RESET ROLE;
DO $$ BEGIN
  IF (SELECT google_sheet_id FROM shops WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='s1')) IS NOT NULL THEN
    RAISE EXCEPTION 'disconnect did not clear google_sheet_id';
  END IF;
END $$;
-- Worker lifecycle: only bound tenants, deterministic order, attempt count, bounded backoff, mapping update.
DELETE FROM sync_queue;
DELETE FROM google_sync_mappings;
UPDATE shops SET google_sheet_id='sheet-one-verified' WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='s1');
UPDATE shops SET google_sheet_id=NULL WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='s2');
DO $$
DECLARE q_early uuid; q_late uuid; q_unbound uuid;
BEGIN
  INSERT INTO sync_queue(shop_id,entity_type,entity_id,operation,payload,next_attempt_at,created_at)
  VALUES ((SELECT v::uuid FROM phase7_values WHERE k='s1'),'pet_customer',(SELECT v::uuid FROM phase7_values WHERE k='pet1'),'UPSERT','{}',now()-interval '2 minutes',now()-interval '2 minutes')
  RETURNING id INTO q_early;
  INSERT INTO sync_queue(shop_id,entity_type,entity_id,operation,payload,next_attempt_at,created_at)
  VALUES ((SELECT v::uuid FROM phase7_values WHERE k='s1'),'booking',(SELECT v::uuid FROM phase7_values WHERE k='booking1'),'UPSERT','{}',now()-interval '1 minute',now()-interval '1 minute')
  RETURNING id INTO q_late;
  INSERT INTO sync_queue(shop_id,entity_type,entity_id,operation,payload,next_attempt_at,created_at)
  VALUES ((SELECT v::uuid FROM phase7_values WHERE k='s2'),'booking',gen_random_uuid(),'UPSERT','{}',now()-interval '3 minutes',now()-interval '3 minutes')
  RETURNING id INTO q_unbound;
  INSERT INTO phase7_values VALUES ('q_early',q_early::text),('q_late',q_late::text),('q_unbound',q_unbound::text);
END $$;

CREATE TEMP TABLE phase7_claim AS SELECT * FROM claim_google_sync_event_internal();
DO $$
DECLARE claimed uuid; attempt_count int;
BEGIN
  SELECT event_id,attempts INTO claimed,attempt_count FROM phase7_claim;
  IF claimed<>(SELECT v::uuid FROM phase7_values WHERE k='q_early') THEN RAISE EXCEPTION 'worker ordering/tenant filter failed: %',claimed; END IF;
  IF attempt_count<>1 THEN RAISE EXCEPTION 'claim did not increment attempts'; END IF;
  IF (SELECT status FROM sync_queue WHERE id=claimed)<>'processing' THEN RAISE EXCEPTION 'claim did not enter processing'; END IF;
  IF (SELECT processing_started_at FROM sync_queue WHERE id=claimed) IS NULL THEN RAISE EXCEPTION 'processing lease timestamp missing'; END IF;
  IF (SELECT status FROM sync_queue WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='q_unbound'))<>'pending' THEN RAISE EXCEPTION 'unbound tenant was processed'; END IF;
END $$;
SELECT mark_google_sync_failed_internal((SELECT v::uuid FROM phase7_values WHERE k='q_early'),'temporary failure');
DO $$
DECLARE q sync_queue%ROWTYPE; delay_seconds numeric;
BEGIN
  SELECT * INTO q FROM sync_queue WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='q_early');
  delay_seconds:=extract(epoch FROM (q.next_attempt_at-now()));
  IF q.status<>'failed' OR q.processing_started_at IS NOT NULL THEN RAISE EXCEPTION 'failure transition invalid'; END IF;
  IF q.last_error<>'temporary failure' THEN RAISE EXCEPTION 'failure error not stored safely'; END IF;
  IF delay_seconds NOT BETWEEN 25 AND 35 THEN RAISE EXCEPTION 'first backoff not bounded near 30s: %',delay_seconds; END IF;
END $$;

UPDATE sync_queue SET next_attempt_at=now()-interval '1 second' WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='q_early');
UPDATE sync_queue SET next_attempt_at=now()+interval '5 minutes' WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='q_late');
DROP TABLE phase7_claim;
CREATE TEMP TABLE phase7_claim AS SELECT * FROM claim_google_sync_event_internal();
DO $$
DECLARE claimed uuid; attempt_count int;
BEGIN
  SELECT event_id,attempts INTO claimed,attempt_count FROM phase7_claim;
  IF claimed<>(SELECT v::uuid FROM phase7_values WHERE k='q_early') OR attempt_count<>2 THEN
    RAISE EXCEPTION 'retry claim did not preserve event/increment attempt';
  END IF;
END $$;
SELECT mark_google_sync_completed_internal(
  (SELECT v::uuid FROM phase7_values WHERE k='q_early'),'UPSERT','Customers','hash-v2'
);
DO $$
BEGIN
  IF (SELECT status FROM sync_queue WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='q_early'))<>'completed' THEN
    RAISE EXCEPTION 'success did not complete event';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM google_sync_mappings WHERE shop_id=(SELECT v::uuid FROM phase7_values WHERE k='s1')
      AND entity_type='pet_customer' AND entity_id=(SELECT v::uuid FROM phase7_values WHERE k='pet1') AND synced_hash='hash-v2') THEN
    RAISE EXCEPTION 'success did not update mapping';
  END IF;
END $$;

-- DELETE completion removes the authoritative mapping.
DO $$
DECLARE delete_event uuid;
BEGIN
  INSERT INTO sync_queue(shop_id,entity_type,entity_id,operation,payload,status,attempts,processing_started_at,last_attempt_at,next_attempt_at)
  VALUES ((SELECT v::uuid FROM phase7_values WHERE k='s1'),'pet_customer',(SELECT v::uuid FROM phase7_values WHERE k='pet1'),'DELETE','{}','processing',1,now(),now(),now())
  RETURNING id INTO delete_event;
  PERFORM mark_google_sync_completed_internal(delete_event,'DELETE','Customers',NULL);
  IF EXISTS (SELECT 1 FROM google_sync_mappings WHERE shop_id=(SELECT v::uuid FROM phase7_values WHERE k='s1')
      AND entity_type='pet_customer' AND entity_id=(SELECT v::uuid FROM phase7_values WHERE k='pet1')) THEN
    RAISE EXCEPTION 'DELETE completion did not remove mapping';
  END IF;
  IF (SELECT status FROM sync_queue WHERE id=delete_event)<>'completed' THEN
    RAISE EXCEPTION 'DELETE completion did not complete event';
  END IF;
END $$;

-- Exact ordering ties are broken deterministically by queue id.
DELETE FROM sync_queue;
DO $$
DECLARE t timestamptz:=now()-interval '1 minute'; claimed uuid;
BEGIN
  INSERT INTO sync_queue(id,shop_id,entity_type,entity_id,operation,payload,next_attempt_at,created_at) VALUES
    ('00000000-0000-0000-0000-000000000002',(SELECT v::uuid FROM phase7_values WHERE k='s1'),'booking',(SELECT v::uuid FROM phase7_values WHERE k='booking1'),'UPSERT','{}',t,t),
    ('00000000-0000-0000-0000-000000000001',(SELECT v::uuid FROM phase7_values WHERE k='s1'),'pet_customer',(SELECT v::uuid FROM phase7_values WHERE k='pet1'),'UPSERT','{}',t,t);
  SELECT event_id INTO claimed FROM claim_google_sync_event_internal();
  IF claimed<>'00000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'queue id tie-break ordering is not deterministic: %',claimed;
  END IF;
END $$;

-- Stale processing lease is recovered after 10 minutes.
DELETE FROM sync_queue;
DO $$
DECLARE stale_id uuid;
BEGIN
  INSERT INTO sync_queue(shop_id,entity_type,entity_id,operation,payload,status,attempts,
    processing_started_at,last_attempt_at,next_attempt_at)
  VALUES ((SELECT v::uuid FROM phase7_values WHERE k='s1'),'pet_customer',
    (SELECT v::uuid FROM phase7_values WHERE k='pet1'),'UPSERT','{}','processing',1,
    now()-interval '11 minutes',now()-interval '11 minutes',now()-interval '11 minutes')
  RETURNING id INTO stale_id;
  INSERT INTO phase7_values VALUES ('stale_id',stale_id::text);
END $$;
DROP TABLE phase7_claim;
CREATE TEMP TABLE phase7_claim AS SELECT * FROM claim_google_sync_event_internal();
DO $$
BEGIN
  IF (SELECT event_id FROM phase7_claim)<>(SELECT v::uuid FROM phase7_values WHERE k='stale_id') THEN
    RAISE EXCEPTION 'stale processing event was not reclaimed';
  END IF;
  IF (SELECT attempts FROM phase7_claim)<>2 THEN RAISE EXCEPTION 'stale reclaim did not increment attempts'; END IF;
END $$;
SELECT mark_google_sync_failed_internal((SELECT v::uuid FROM phase7_values WHERE k='stale_id'), repeat('x',800));
DO $$
DECLARE q sync_queue%ROWTYPE;
BEGIN
  SELECT * INTO q FROM sync_queue WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='stale_id');
  IF length(q.last_error)<>500 THEN RAISE EXCEPTION 'worker error was not truncated to 500 chars'; END IF;
END $$;

-- Backoff is capped at one hour even after many attempts.
UPDATE sync_queue
SET status='processing', attempts=20, processing_started_at=now(), next_attempt_at=now()
WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='stale_id');
SELECT mark_google_sync_failed_internal((SELECT v::uuid FROM phase7_values WHERE k='stale_id'),'bounded');
DO $$
DECLARE delay_seconds numeric;
BEGIN
  SELECT extract(epoch FROM (next_attempt_at-now())) INTO delay_seconds
  FROM sync_queue WHERE id=(SELECT v::uuid FROM phase7_values WHERE k='stale_id');
  IF delay_seconds NOT BETWEEN 3595 AND 3605 THEN RAISE EXCEPTION 'backoff cap is not one hour: %',delay_seconds; END IF;
END $$;

SELECT pass('Phase 7 Google Sheets SQL acceptance assertions completed');
SELECT * FROM finish();
ROLLBACK;
