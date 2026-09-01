\set ON_ERROR_STOP on
BEGIN;
SELECT plan(1);

CREATE TEMP TABLE phase13_csv_values(k text PRIMARY KEY, v text NOT NULL);
GRANT SELECT ON phase13_csv_values TO authenticated;

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_duplicate_shop uuid := gen_random_uuid();
  v_atomic_shop uuid := gen_random_uuid();
  v_duplicate_owner uuid := gen_random_uuid();
  v_atomic_owner uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email) VALUES (v_user,'phase13-csv-owner@example.invalid');
  INSERT INTO shops(id,name,slug) VALUES
    (v_duplicate_shop,'Phase 13 CSV Duplicate','phase13-csv-duplicate'),
    (v_atomic_shop,'Phase 13 CSV Atomic','phase13-csv-atomic');
  INSERT INTO staff_users(id,shop_id,email,name,role,is_active)
  VALUES (v_user,v_duplicate_shop,'phase13-csv-owner@example.invalid','Phase 13 CSV Owner','owner',TRUE);

  INSERT INTO pet_owners(id,shop_id,first_name,phone) VALUES
    (v_duplicate_owner,v_duplicate_shop,'Duplicate Owner','0813100001'),
    (v_atomic_owner,v_atomic_shop,'Atomic Seed Owner','0813100002');

  INSERT INTO pets(shop_id,owner_id,name,species)
  SELECT v_duplicate_shop,v_duplicate_owner,'Seed Pet '||n,'dog'
  FROM generate_series(1,299) n;
  INSERT INTO pets(shop_id,owner_id,name,species)
  SELECT v_atomic_shop,v_atomic_owner,'Atomic Seed Pet '||n,'dog'
  FROM generate_series(1,299) n;

  INSERT INTO phase13_csv_values VALUES
    ('user',v_user::text),
    ('duplicate_shop',v_duplicate_shop::text),
    ('atomic_shop',v_atomic_shop::text);
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT v FROM phase13_csv_values WHERE k='user'),
  true
);

-- Duplicate rows must not consume quota. At 299 pets, one duplicate plus one new pet
-- must succeed and leave the tenant exactly at the Starter limit of 300.
DO $$
DECLARE
  v_shop uuid := (SELECT v::uuid FROM phase13_csv_values WHERE k='duplicate_shop');
  v_result jsonb;
BEGIN
  v_result := import_customers_and_pets_atomic(
    jsonb_build_array(
      jsonb_build_object(
        'row_number',1,
        'customer',jsonb_build_object('phone','0813100001','firstName','Duplicate Owner'),
        'pet',jsonb_build_object('name','Seed Pet 1','species','dog')
      ),
      jsonb_build_object(
        'row_number',2,
        'customer',jsonb_build_object('phone','0813100001','firstName','Duplicate Owner'),
        'pet',jsonb_build_object('name','Quota Pet 300','species','dog')
      )
    )
  );

  IF COALESCE((v_result->>'created_pets')::int,-1) <> 1
     OR COALESCE((v_result->>'skipped_duplicates')::int,-1) <> 1 THEN
    RAISE EXCEPTION 'CSV duplicate accounting did not preserve quota semantics: %',v_result;
  END IF;
  IF (SELECT count(*) FROM pets WHERE shop_id=v_shop) <> 300 THEN
    RAISE EXCEPTION 'CSV duplicate plus new pet did not finish at exactly 300 pets';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM import_batches
    WHERE shop_id=v_shop
      AND total_rows=2
      AND created_pets=1
      AND skipped_duplicates=1
      AND status='completed'
  ) THEN
    RAISE EXCEPTION 'CSV duplicate success did not write the authoritative import receipt';
  END IF;
END $$;

-- Move the same authenticated owner membership to the second tenant so the RPC
-- continues to exercise its real tenant/role boundary instead of bypassing it.
RESET ROLE;
UPDATE staff_users
SET shop_id=(SELECT v::uuid FROM phase13_csv_values WHERE k='atomic_shop')
WHERE id=(SELECT v::uuid FROM phase13_csv_values WHERE k='user');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT v FROM phase13_csv_values WHERE k='user'),
  true
);

-- At 299 pets, a two-row batch would create pet 300 and then attempt pet 301.
-- The second row must fail, and PostgreSQL must roll the whole RPC transaction back:
-- no new owners, pets, sync events, or import-batch audit may survive.
DO $$
DECLARE
  v_shop uuid := (SELECT v::uuid FROM phase13_csv_values WHERE k='atomic_shop');
  v_owner_count int;
  v_pet_count int;
  v_sync_count int;
  v_batch_count int;
  denied boolean := false;
BEGIN
  SELECT count(*) INTO v_owner_count FROM pet_owners WHERE shop_id=v_shop;
  SELECT count(*) INTO v_pet_count FROM pets WHERE shop_id=v_shop;
  SELECT count(*) INTO v_sync_count FROM sync_queue WHERE shop_id=v_shop;
  SELECT count(*) INTO v_batch_count FROM import_batches WHERE shop_id=v_shop;

  BEGIN
    PERFORM import_customers_and_pets_atomic(
      jsonb_build_array(
        jsonb_build_object(
          'row_number',1,
          'customer',jsonb_build_object('phone','0813100101','firstName','Atomic Customer A'),
          'pet',jsonb_build_object('name','Atomic Pet 300','species','dog')
        ),
        jsonb_build_object(
          'row_number',2,
          'customer',jsonb_build_object('phone','0813100102','firstName','Atomic Customer B'),
          'pet',jsonb_build_object('name','Atomic Pet 301','species','dog')
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    denied := SQLERRM LIKE '%PET_QUOTA_EXCEEDED%';
  END;

  IF NOT denied THEN
    RAISE EXCEPTION 'Over-quota CSV batch was not rejected by the Phase 13 pet quota';
  END IF;
  IF (SELECT count(*) FROM pet_owners WHERE shop_id=v_shop) <> v_owner_count THEN
    RAISE EXCEPTION 'Over-quota CSV batch left partial customer writes';
  END IF;
  IF (SELECT count(*) FROM pets WHERE shop_id=v_shop) <> v_pet_count THEN
    RAISE EXCEPTION 'Over-quota CSV batch left partial pet writes';
  END IF;
  IF (SELECT count(*) FROM sync_queue WHERE shop_id=v_shop) <> v_sync_count THEN
    RAISE EXCEPTION 'Over-quota CSV batch left partial Google Sheets outbox writes';
  END IF;
  IF (SELECT count(*) FROM import_batches WHERE shop_id=v_shop) <> v_batch_count THEN
    RAISE EXCEPTION 'Over-quota CSV batch wrote a false import audit record';
  END IF;
END $$;

RESET ROLE;
SELECT pass('Phase 13 CSV duplicate quota handling and over-quota atomic rollback passed');
SELECT * FROM finish();
ROLLBACK;
