\set ON_ERROR_STOP on
BEGIN;

-- PawSpace Phase 1 executable schema/constraint acceptance tests.
-- Run after applying migrations to a disposable Supabase/PostgreSQL database.

DO $$
DECLARE
  missing_columns text[];
BEGIN
  SELECT array_agg(required.col)
  INTO missing_columns
  FROM (VALUES
    ('shops.google_sheet_claim_token_hash'),
    ('shops.google_sheet_claim_expires_at'),
    ('staff_users.is_active'),
    ('staff_users.disabled_at'),
    ('rooms.maintenance_from'),
    ('rooms.maintenance_until'),
    ('daily_reports.idempotency_key'),
    ('daily_reports.request_fingerprint'),
    ('daily_reports.line_delivery_retry_key'),
    ('daily_reports.line_delivery_status'),
    ('daily_reports.line_delivery_started_at'),
    ('daily_reports.line_retry_count'),
    ('sync_queue.processing_started_at'),
    ('sync_queue.last_attempt_at'),
    ('sync_queue.next_attempt_at')
  ) AS required(col)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND (c.table_name || '.' || c.column_name) = required.col
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Missing Phase 1 columns: %', missing_columns;
  END IF;
END $$;

-- Phase 1 must not ship Phase 2 mutation helpers/RLS policies.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('current_staff_shop_id', 'create_booking', 'add_pet_to_booking')
  ) THEN
    RAISE EXCEPTION 'Phase 2 RPC/helper leaked into Phase 1 migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('shops','staff_users','pet_owners','pets','rooms','bookings','booking_pets','daily_reports','google_sync_mappings','sync_queue')
  ) THEN
    RAISE EXCEPTION 'Phase 2 RLS policy leaked into Phase 1 migration';
  END IF;
END $$;

DO $$
DECLARE
  s1 uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  o1 uuid := gen_random_uuid();
  o2 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid();
  p2 uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();
  b1 uuid := gen_random_uuid();
  bp1 uuid := gen_random_uuid();
  report1 uuid := gen_random_uuid();
  idem1 uuid := gen_random_uuid();
  retry1 uuid := gen_random_uuid();
  failed boolean;
BEGIN
  INSERT INTO shops(id,name,slug,google_sheet_id) VALUES
    (s1,'Shop One','shop-one','sheet-one'),
    (s2,'Shop Two','shop-two','sheet-two');

  -- Sheet ID must be globally unique across tenants.
  failed := false;
  BEGIN
    INSERT INTO shops(name,slug,google_sheet_id) VALUES ('Dup','dup-shop','sheet-one');
  EXCEPTION WHEN unique_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'google_sheet_id uniqueness not enforced'; END IF;

  INSERT INTO pet_owners(id,shop_id,first_name,phone) VALUES
    (o1,s1,'Owner One','0800000001'),
    (o2,s2,'Owner Two','0800000002');

  INSERT INTO pets(id,shop_id,owner_id,name,species) VALUES
    (p1,s1,o1,'Milo','dog'),
    (p2,s2,o2,'Luna','cat');

  -- Cross-tenant owner FK must fail.
  failed := false;
  BEGIN
    INSERT INTO pets(shop_id,owner_id,name,species) VALUES (s1,o2,'Bad Tenant Pet','dog');
  EXCEPTION WHEN foreign_key_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'cross-tenant pet owner FK not enforced'; END IF;

  -- Maintenance windows must be both NULL or both present and ordered.
  failed := false;
  BEGIN
    INSERT INTO rooms(shop_id,room_number,room_type,capacity_pets,base_price_per_night,maintenance_from)
    VALUES (s1,'BAD-M1','standard',1,500,current_date);
  EXCEPTION WHEN check_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'partial maintenance window accepted'; END IF;

  INSERT INTO rooms(id,shop_id,room_number,room_type,capacity_pets,base_price_per_night)
  VALUES (r1,s1,'A01','standard',2,500);

  INSERT INTO bookings(id,shop_id,owner_id,room_id,check_in_date,check_out_date)
  VALUES (b1,s1,o1,r1,DATE '2026-09-01',DATE '2026-09-03');

  -- Active room overlap must be rejected by exclusion constraint.
  failed := false;
  BEGIN
    INSERT INTO bookings(shop_id,owner_id,room_id,check_in_date,check_out_date)
    VALUES (s1,o1,r1,DATE '2026-09-02',DATE '2026-09-04');
  EXCEPTION WHEN exclusion_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'room active-booking overlap accepted'; END IF;

  -- Terminal/cancelled bookings do not block the room calendar.
  INSERT INTO bookings(shop_id,owner_id,room_id,check_in_date,check_out_date,booking_status)
  VALUES (s1,o1,r1,DATE '2026-09-02',DATE '2026-09-04','cancelled');

  INSERT INTO booking_pets(id,shop_id,booking_id,pet_id) VALUES (bp1,s1,b1,p1);

  -- Composite membership FK must reject a pet not assigned to this booking.
  failed := false;
  BEGIN
    INSERT INTO daily_reports(
      shop_id,booking_id,pet_id,idempotency_key,request_fingerprint,line_delivery_retry_key,
      food_status,excretion_status,mood_status,photo_urls
    ) VALUES (
      s1,b1,p2,gen_random_uuid(),'bad-membership',gen_random_uuid(),
      'finished','normal','happy',ARRAY['https://example.invalid/a.jpg']
    );
  EXCEPTION WHEN foreign_key_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'daily report membership FK not enforced'; END IF;

  INSERT INTO daily_reports(
    id,shop_id,booking_id,pet_id,idempotency_key,request_fingerprint,line_delivery_retry_key,
    food_status,excretion_status,mood_status,photo_urls
  ) VALUES (
    report1,s1,b1,p1,idem1,'fingerprint-1',retry1,
    'finished','normal','happy',ARRAY['https://example.invalid/a.jpg']
  );

  IF (SELECT report_date FROM daily_reports WHERE id=report1)
      <> ((now() AT TIME ZONE 'Asia/Bangkok')::date) THEN
    RAISE EXCEPTION 'daily report default is not Asia/Bangkok business date';
  END IF;

  -- 1-4 photos only.
  failed := false;
  BEGIN
    INSERT INTO daily_reports(
      shop_id,booking_id,pet_id,idempotency_key,request_fingerprint,line_delivery_retry_key,
      food_status,excretion_status,mood_status,photo_urls
    ) VALUES (
      s1,b1,p1,gen_random_uuid(),'no-photo',gen_random_uuid(),
      'finished','normal','happy',ARRAY[]::text[]
    );
  EXCEPTION WHEN check_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'zero-photo daily report accepted'; END IF;

  -- Tenant idempotency key and LINE retry key must be unique.
  failed := false;
  BEGIN
    INSERT INTO daily_reports(
      shop_id,booking_id,pet_id,idempotency_key,request_fingerprint,line_delivery_retry_key,
      food_status,excretion_status,mood_status,photo_urls
    ) VALUES (
      s1,b1,p1,idem1,'fingerprint-2',gen_random_uuid(),
      'finished','normal','happy',ARRAY['https://example.invalid/b.jpg']
    );
  EXCEPTION WHEN unique_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'tenant idempotency uniqueness not enforced'; END IF;

  failed := false;
  BEGIN
    INSERT INTO daily_reports(
      shop_id,booking_id,pet_id,idempotency_key,request_fingerprint,line_delivery_retry_key,
      food_status,excretion_status,mood_status,photo_urls
    ) VALUES (
      s1,b1,p1,gen_random_uuid(),'fingerprint-3',retry1,
      'finished','normal','happy',ARRAY['https://example.invalid/c.jpg']
    );
  EXCEPTION WHEN unique_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'LINE retry key uniqueness not enforced'; END IF;

  -- Worker canonical states must reject invalid values/negative retries.
  failed := false;
  BEGIN
    INSERT INTO sync_queue(shop_id,entity_type,entity_id,operation,payload,status)
    VALUES (s1,'booking',b1,'UPSERT','{}'::jsonb,'bogus');
  EXCEPTION WHEN check_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'invalid sync queue status accepted'; END IF;

  failed := false;
  BEGIN
    INSERT INTO sync_queue(shop_id,entity_type,entity_id,operation,payload,attempts)
    VALUES (s1,'booking',b1,'UPSERT','{}'::jsonb,-1);
  EXCEPTION WHEN check_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'negative sync attempts accepted'; END IF;
END $$;

ROLLBACK;
