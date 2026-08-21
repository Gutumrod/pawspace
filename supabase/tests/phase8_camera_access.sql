\set ON_ERROR_STOP on
BEGIN;
SELECT plan(1);

CREATE TEMP TABLE phase8_values(k text PRIMARY KEY, v text NOT NULL);
GRANT SELECT, INSERT, UPDATE ON phase8_values TO authenticated;

-- Internal camera verification/feed RPCs are trusted-server only.
DO $$
BEGIN
  IF has_function_privilege('anon','rotate_camera_visitor_code()','EXECUTE') THEN
    RAISE EXCEPTION 'anon can rotate camera visitor code';
  END IF;
  IF has_function_privilege('authenticated','verify_camera_visitor_code_internal(uuid,character varying,character varying)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute internal camera visitor verification';
  END IF;
  IF has_function_privilege('authenticated','get_camera_feed_internal(uuid,bigint,character varying,character varying)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute internal camera feed lookup';
  END IF;
END $$;

DO $$
DECLARE
  s1 uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid();
  owner1 uuid:=gen_random_uuid(); manager1 uuid:=gen_random_uuid(); staff1 uuid:=gen_random_uuid(); owner2 uuid:=gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email) VALUES
    (owner1,'p8-owner1@example.invalid'),
    (manager1,'p8-manager@example.invalid'),
    (staff1,'p8-staff@example.invalid'),
    (owner2,'p8-owner2@example.invalid');
  INSERT INTO shops(id,name,slug) VALUES
    (s1,'P8 Shop 1','p8-shop-1'),
    (s2,'P8 Shop 2','p8-shop-2');
  INSERT INTO staff_users(id,shop_id,email,name,role,is_active) VALUES
    (owner1,s1,'p8-owner1@example.invalid','Owner 1','owner',true),
    (manager1,s1,'p8-manager@example.invalid','Manager 1','manager',true),
    (staff1,s1,'p8-staff@example.invalid','Staff 1','staff',true),
    (owner2,s2,'p8-owner2@example.invalid','Owner 2','owner',true);
  INSERT INTO phase8_values VALUES
    ('s1',s1::text),('s2',s2::text),('owner1',owner1::text),('manager1',manager1::text),
    ('staff1',staff1::text),('owner2',owner2::text),
    ('scope1',encode(extensions.digest('camera-scope:'||s1::text,'sha256'),'hex')),
    ('scope2',encode(extensions.digest('camera-scope:'||s2::text,'sha256'),'hex'));
END $$;

-- Browser roles cannot read or mutate camera authority tables directly.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase8_values WHERE k='staff1'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  denied_settings_read boolean:=false;
  denied_credentials_read boolean:=false;
  denied_bucket_write boolean:=false;
  denied_audit_read boolean:=false;
BEGIN
  BEGIN PERFORM 1 FROM camera_settings LIMIT 1; EXCEPTION WHEN insufficient_privilege THEN denied_settings_read:=true; END;
  BEGIN PERFORM 1 FROM camera_visitor_credentials LIMIT 1; EXCEPTION WHEN insufficient_privilege THEN denied_credentials_read:=true; END;
  BEGIN INSERT INTO camera_rate_limit_buckets(bucket_kind,bucket_hash,window_start,failure_count)
        VALUES ('requester_ip',repeat('a',64),camera_rate_window_start(now()),1);
        EXCEPTION WHEN insufficient_privilege THEN denied_bucket_write:=true; END;
  BEGIN PERFORM 1 FROM camera_access_audit LIMIT 1; EXCEPTION WHEN insufficient_privilege THEN denied_audit_read:=true; END;
  IF NOT denied_settings_read OR NOT denied_credentials_read OR NOT denied_bucket_write OR NOT denied_audit_read THEN
    RAISE EXCEPTION 'authenticated camera table privilege leaked';
  END IF;
END $$;
RESET ROLE;

-- Staff must be authenticated before a visitor code exists; any active staff role may rotate it.
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  result jsonb; code text; version bigint;
BEGIN
  result:=rotate_camera_visitor_code();
  code:=result->>'visitor_code';
  version:=(result->>'credential_version')::bigint;
  IF code !~ '^[0-9A-F]{8}$' THEN RAISE EXCEPTION 'visitor code format invalid: %',code; END IF;
  IF version<>1 THEN RAISE EXCEPTION 'initial credential version is not 1'; END IF;
  INSERT INTO phase8_values VALUES ('code1',code),('version1',version::text);
END $$;
RESET ROLE;
DO $$
DECLARE stored_hash text; expected_hash text; code text;
BEGIN
  code:=(SELECT v FROM phase8_values WHERE k='code1');
  SELECT code_hash INTO stored_hash
  FROM camera_visitor_credentials
  WHERE shop_id=(SELECT v::uuid FROM phase8_values WHERE k='s1');
  expected_hash:=encode(extensions.digest((SELECT v FROM phase8_values WHERE k='s1') || ':' || code,'sha256'),'hex');
  IF stored_hash=code THEN RAISE EXCEPTION 'plaintext visitor code stored'; END IF;
  IF stored_hash<>expected_hash THEN RAISE EXCEPTION 'visitor code hash is not SHA-256(shop_id:code)'; END IF;
  INSERT INTO phase8_values VALUES ('hash1',stored_hash);
END $$;

-- Staff cannot configure the camera source; owner/manager can.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase8_values WHERE k='staff1'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE failed boolean:=false;
BEGIN
  BEGIN PERFORM set_camera_feed_config('https://camera.example.invalid/live/p8',true);
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'staff configured camera feed'; END IF;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase8_values WHERE k='manager1'),true);
SET LOCAL ROLE authenticated;
SELECT set_camera_feed_config('https://camera.example.invalid/live/p8',true);
DO $$
DECLARE settings jsonb;
BEGIN
  settings:=get_camera_staff_settings();
  IF settings->>'device_name'<>'Microsoft LifeCam' OR (settings->>'is_enabled')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'manager camera config did not persist LifeCam/enabled state';
  END IF;
  IF settings->>'shop_id'<>(SELECT v FROM phase8_values WHERE k='s1') THEN
    RAISE EXCEPTION 'staff camera settings escaped tenant';
  END IF;
END $$;
RESET ROLE;

-- Invalid/non-HTTPS enabled source is rejected.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase8_values WHERE k='owner1'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE failed boolean:=false;
BEGIN
  BEGIN PERFORM set_camera_feed_config('http://insecure.example.invalid/live',true);
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'insecure camera feed URL accepted'; END IF;
  failed:=false;
  BEGIN PERFORM set_camera_feed_config('https://camera.example.invalid/live?token=secret',true);
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'query-bearing camera feed URL accepted'; END IF;
  failed:=false;
  BEGIN PERFORM set_camera_feed_config('https://user:pass@camera.example.invalid/live',true);
  EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'credential-bearing camera feed URL accepted'; END IF;
END $$;
RESET ROLE;

-- One active credential per shop: rotation replaces hash and increments credential version.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase8_values WHERE k='staff1'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb; code2 text; version2 bigint;
BEGIN
  result:=rotate_camera_visitor_code();
  code2:=result->>'visitor_code';
  version2:=(result->>'credential_version')::bigint;
  IF version2<>(SELECT v::bigint+1 FROM phase8_values WHERE k='version1') THEN RAISE EXCEPTION 'rotation did not increment credential version'; END IF;
  INSERT INTO phase8_values VALUES ('code2',code2),('version2',version2::text);
END $$;
RESET ROLE;
DO $$
DECLARE hash2 text; row_count int;
BEGIN
  SELECT code_hash INTO hash2 FROM camera_visitor_credentials
  WHERE shop_id=(SELECT v::uuid FROM phase8_values WHERE k='s1');
  SELECT count(*) INTO row_count FROM camera_visitor_credentials
  WHERE shop_id=(SELECT v::uuid FROM phase8_values WHERE k='s1');
  IF row_count<>1 THEN RAISE EXCEPTION 'more than one active visitor credential exists'; END IF;
  IF hash2=(SELECT v FROM phase8_values WHERE k='hash1') THEN RAISE EXCEPTION 'rotation did not replace visitor code hash'; END IF;
  INSERT INTO phase8_values VALUES ('hash2',hash2);
END $$;

-- Cross-tenant: shop 2 owns its own independent credential and feed config.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase8_values WHERE k='owner2'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb;
BEGIN
  result:=rotate_camera_visitor_code();
  INSERT INTO phase8_values VALUES
    ('code_shop2',result->>'visitor_code'),
    ('version_shop2',result->>'credential_version');
  PERFORM set_camera_feed_config('https://camera.example.invalid/live/p8-shop2',true);
END $$;
RESET ROLE;

-- Old rotated code no longer authenticates. Correct code is tenant-bound.
DO $$
DECLARE
  old_hash text:=encode(extensions.digest((SELECT v FROM phase8_values WHERE k='s1') || ':' || (SELECT v FROM phase8_values WHERE k='code1'),'sha256'),'hex');
  ip_hash text:=encode(extensions.digest('test-ip-old-code','sha256'),'hex');
  result jsonb;
BEGIN
  result:=verify_camera_visitor_code_internal(
    (SELECT v::uuid FROM phase8_values WHERE k='s1'), old_hash, ip_hash
  );
  IF result->>'result'<>'INVALID_CODE' THEN RAISE EXCEPTION 'rotated old visitor code still authenticates'; END IF;

  result:=verify_camera_visitor_code_internal(
    (SELECT v::uuid FROM phase8_values WHERE k='s2'), (SELECT v FROM phase8_values WHERE k='hash2'), ip_hash
  );
  IF result->>'result'<>'INVALID_CODE' THEN RAISE EXCEPTION 'shop 1 credential authenticates shop 2 camera'; END IF;
END $$;

-- Isolate limiter assertions from the intentional failures above.
DELETE FROM camera_rate_limit_buckets;

-- Stable tenant-scope limiter: changing the guessed code cannot evade five failures in 10 minutes.
DO $$
DECLARE
  bad_hash text;
  result jsonb;
  i int;
BEGIN
  FOR i IN 1..5 LOOP
    bad_hash:=encode(extensions.digest('varying-scope-bad-code-'||i::text,'sha256'),'hex');
    result:=verify_camera_visitor_code_internal(
      (SELECT v::uuid FROM phase8_values WHERE k='s1'), bad_hash,
      encode(extensions.digest('unique-scope-ip-'||i::text,'sha256'),'hex')
    );
    IF result->>'result'<>'INVALID_CODE' THEN RAISE EXCEPTION 'scope failed attempt % was not invalid',i; END IF;
  END LOOP;
  bad_hash:=encode(extensions.digest('varying-scope-bad-code-6','sha256'),'hex');
  result:=verify_camera_visitor_code_internal(
    (SELECT v::uuid FROM phase8_values WHERE k='s1'), bad_hash,
    encode(extensions.digest('unique-scope-ip-6','sha256'),'hex')
  );
  IF result->>'result'<>'RATE_LIMITED' THEN RAISE EXCEPTION 'stable tenant-scope limiter did not block after 5 changing guesses'; END IF;
  IF (SELECT failure_count FROM camera_rate_limit_buckets
      WHERE bucket_kind='scope' AND bucket_hash=(SELECT v FROM phase8_values WHERE k='scope1')
        AND window_start=camera_rate_window_start(now()))<>5 THEN
    RAISE EXCEPTION 'tenant-scope failure count exceeded/missed bounded 5';
  END IF;
END $$;

-- Requester-IP limiter: varying codes cannot bypass five failures from the same requester.
DO $$
DECLARE
  ip_hash text:=encode(extensions.digest('same-requester-ip','sha256'),'hex');
  bad_hash text;
  result jsonb;
  i int;
BEGIN
  FOR i IN 1..5 LOOP
    bad_hash:=encode(extensions.digest('varying-ip-bad-code-'||i::text,'sha256'),'hex');
    result:=verify_camera_visitor_code_internal(
      (SELECT v::uuid FROM phase8_values WHERE k='s2'), bad_hash, ip_hash
    );
    IF result->>'result'<>'INVALID_CODE' THEN RAISE EXCEPTION 'requester-IP failed attempt % was not invalid',i; END IF;
  END LOOP;
  bad_hash:=encode(extensions.digest('varying-ip-bad-code-6','sha256'),'hex');
  result:=verify_camera_visitor_code_internal(
    (SELECT v::uuid FROM phase8_values WHERE k='s2'), bad_hash, ip_hash
  );
  IF result->>'result'<>'RATE_LIMITED' THEN RAISE EXCEPTION 'requester-IP limiter did not block after 5 failures'; END IF;
END $$;

-- Limiter evidence must not prevent the independent success/session assertions below.
DELETE FROM camera_rate_limit_buckets;

-- Correct current code grants only a credential version; feed requires that same tenant/version.
DO $$
DECLARE
  good_ip_hash text:=encode(extensions.digest('successful-requester','sha256'),'hex');
  verify_result jsonb;
  feed_result jsonb;
  session_hash text:=encode(extensions.digest('session-one','sha256'),'hex');
BEGIN
  verify_result:=verify_camera_visitor_code_internal(
    (SELECT v::uuid FROM phase8_values WHERE k='s1'),
    (SELECT v FROM phase8_values WHERE k='hash2'),
    good_ip_hash
  );
  IF verify_result->>'result'<>'GRANTED' THEN RAISE EXCEPTION 'current visitor code was not granted'; END IF;
  IF (verify_result->>'credential_version')::bigint<>(SELECT v::bigint FROM phase8_values WHERE k='version2') THEN
    RAISE EXCEPTION 'granted credential version mismatch';
  END IF;

  feed_result:=get_camera_feed_internal(
    (SELECT v::uuid FROM phase8_values WHERE k='s1'),
    (SELECT v::bigint FROM phase8_values WHERE k='version2'),
    session_hash,
    good_ip_hash
  );
  IF feed_result->>'result'<>'GRANTED' OR feed_result->>'device_name'<>'Microsoft LifeCam'
     OR feed_result->>'feed_url'<>'https://camera.example.invalid/live/p8' THEN
    RAISE EXCEPTION 'valid camera session could not resolve tenant LifeCam feed';
  END IF;

  feed_result:=get_camera_feed_internal(
    (SELECT v::uuid FROM phase8_values WHERE k='s2'),
    (SELECT v::bigint FROM phase8_values WHERE k='version2'),
    session_hash,
    good_ip_hash
  );
  IF feed_result->>'result'<>'DENIED' THEN RAISE EXCEPTION 'shop 1 session version accessed shop 2 camera'; END IF;
END $$;

-- Rotate again: any previously issued session version becomes stale immediately.
SELECT set_config('request.jwt.claim.sub',(SELECT v FROM phase8_values WHERE k='owner1'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb;
BEGIN
  result:=rotate_camera_visitor_code();
  INSERT INTO phase8_values VALUES ('version3',result->>'credential_version');
END $$;
RESET ROLE;
DO $$
DECLARE result jsonb;
BEGIN
  result:=get_camera_feed_internal(
    (SELECT v::uuid FROM phase8_values WHERE k='s1'),
    (SELECT v::bigint FROM phase8_values WHERE k='version2'),
    encode(extensions.digest('old-session-after-rotation','sha256'),'hex'),
    encode(extensions.digest('successful-requester','sha256'),'hex')
  );
  IF result->>'result'<>'DENIED' THEN RAISE EXCEPTION 'visitor code rotation did not invalidate prior session version'; END IF;
END $$;

-- Audit contains hashes/reason codes only: raw visitor codes/IP strings are absent.
DO $$
DECLARE audit_text text;
BEGIN
  SELECT COALESCE(string_agg(row_to_json(a)::text,' '),'') INTO audit_text
  FROM camera_access_audit a;
  IF audit_text LIKE '%'||(SELECT v FROM phase8_values WHERE k='code1')||'%'
     OR audit_text LIKE '%'||(SELECT v FROM phase8_values WHERE k='code2')||'%'
     OR audit_text LIKE '%successful-requester%'
     OR audit_text LIKE '%same-requester-ip%'
     OR audit_text ILIKE '%authorization%'
     OR audit_text ILIKE '%cookie%' THEN
    RAISE EXCEPTION 'camera audit leaked raw credential/request secret material';
  END IF;
END $$;

-- Append-only is enforced even for direct privileged SQL, not merely by application convention.
DO $$
DECLARE target_id uuid; update_blocked boolean:=false; delete_blocked boolean:=false; truncate_blocked boolean:=false;
BEGIN
  SELECT id INTO target_id FROM camera_access_audit ORDER BY created_at LIMIT 1;
  IF target_id IS NULL THEN RAISE EXCEPTION 'camera audit has no executable evidence rows'; END IF;
  BEGIN UPDATE camera_access_audit SET reason_code='tampered' WHERE id=target_id;
  EXCEPTION WHEN OTHERS THEN update_blocked:=true; END;
  BEGIN DELETE FROM camera_access_audit WHERE id=target_id;
  EXCEPTION WHEN OTHERS THEN delete_blocked:=true; END;
  BEGIN TRUNCATE camera_access_audit;
  EXCEPTION WHEN OTHERS THEN truncate_blocked:=true; END;
  IF NOT update_blocked OR NOT delete_blocked OR NOT truncate_blocked THEN
    RAISE EXCEPTION 'camera_access_audit is not strictly append-only';
  END IF;
END $$;

-- Fixed limiter window is exactly 10 minutes.
DO $$
DECLARE a timestamptz; b timestamptz;
BEGIN
  a:=camera_rate_window_start(TIMESTAMPTZ '2026-08-21 07:04:59+00');
  b:=camera_rate_window_start(TIMESTAMPTZ '2026-08-21 07:10:00+00');
  IF a<>TIMESTAMPTZ '2026-08-21 07:00:00+00' OR b<>TIMESTAMPTZ '2026-08-21 07:10:00+00' THEN
    RAISE EXCEPTION 'camera limiter does not use deterministic 10-minute windows';
  END IF;
END $$;

SELECT pass('Phase 8 camera access SQL acceptance assertions completed');
SELECT * FROM finish();
ROLLBACK;
