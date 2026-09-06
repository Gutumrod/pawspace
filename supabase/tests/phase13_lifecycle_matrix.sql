\set ON_ERROR_STOP on
BEGIN;
SELECT plan(1);

CREATE TEMP TABLE phase13_paths(
  shop_id uuid PRIMARY KEY,
  path text[] NOT NULL
);

-- These paths collectively cover every allowed edge in the locked Phase 13 lifecycle.
INSERT INTO phase13_paths(shop_id,path) VALUES
  (gen_random_uuid(),ARRAY['expired']),
  (gen_random_uuid(),ARRAY['cancelled']),
  (gen_random_uuid(),ARRAY['active']),
  (gen_random_uuid(),ARRAY['active','past_due','active']),
  (gen_random_uuid(),ARRAY['active','past_due','grace_period','active']),
  (gen_random_uuid(),ARRAY['active','past_due','grace_period','expired']),
  (gen_random_uuid(),ARRAY['active','past_due','grace_period','suspended','active']),
  (gen_random_uuid(),ARRAY['active','past_due','grace_period','cancelled']),
  (gen_random_uuid(),ARRAY['active','past_due','suspended','cancelled']),
  (gen_random_uuid(),ARRAY['active','past_due','cancelled']),
  (gen_random_uuid(),ARRAY['active','suspended','expired']),
  (gen_random_uuid(),ARRAY['active','cancel_at_period_end','active']),
  (gen_random_uuid(),ARRAY['active','cancel_at_period_end','expired']),
  (gen_random_uuid(),ARRAY['active','cancel_at_period_end','cancelled']),
  (gen_random_uuid(),ARRAY['active','cancelled']);

CREATE TEMP TABLE phase13_illegal_paths(
  shop_id uuid PRIMARY KEY,
  setup_path text[] NOT NULL,
  illegal_target text NOT NULL
);

INSERT INTO phase13_illegal_paths(shop_id,setup_path,illegal_target) VALUES
  (gen_random_uuid(),ARRAY[]::text[],'past_due'),
  (gen_random_uuid(),ARRAY[]::text[],'suspended'),
  (gen_random_uuid(),ARRAY[]::text[],'cancel_at_period_end'),
  (gen_random_uuid(),ARRAY['active'],'trialing'),
  (gen_random_uuid(),ARRAY['active'],'expired'),
  (gen_random_uuid(),ARRAY['active','past_due'],'expired'),
  (gen_random_uuid(),ARRAY['active','past_due','grace_period'],'past_due'),
  (gen_random_uuid(),ARRAY['active','cancel_at_period_end'],'past_due'),
  (gen_random_uuid(),ARRAY['active','suspended'],'past_due'),
  (gen_random_uuid(),ARRAY['cancelled'],'active'),
  (gen_random_uuid(),ARRAY['expired'],'active');

INSERT INTO shops(id,name,slug)
SELECT shop_id,'Phase 13 Lifecycle Matrix','phase13-life-'||replace(shop_id::text,'-','')
FROM phase13_paths
UNION ALL
SELECT shop_id,'Phase 13 Illegal Matrix','phase13-illegal-'||replace(shop_id::text,'-','')
FROM phase13_illegal_paths;

CREATE TEMP TABLE phase13_timing_shops(kind text PRIMARY KEY, shop_id uuid NOT NULL);
INSERT INTO phase13_timing_shops(kind,shop_id) VALUES
  ('cancel',gen_random_uuid()),
  ('grace',gen_random_uuid());
INSERT INTO shops(id,name,slug)
SELECT shop_id,'Phase 13 Timing '||kind,'phase13-timing-'||kind
FROM phase13_timing_shops;

GRANT SELECT ON phase13_paths, phase13_illegal_paths, phase13_timing_shops TO service_role;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);

DO $$
DECLARE
  r record;
  v_status text;
  v_audit_before integer;
  v_expected_audits integer;
  v_denied boolean;
  v_key uuid;
  v_before_status text;
BEGIN
  FOR r IN SELECT * FROM phase13_paths LOOP
    v_expected_audits := 1;
    FOREACH v_status IN ARRAY r.path LOOP
      PERFORM transition_shop_subscription(
        r.shop_id,
        v_status,
        'system',
        'matrix '||v_status,
        gen_random_uuid(),
        CASE WHEN v_status='active' THEN now()+interval '30 days' ELSE NULL END,
        CASE WHEN v_status='grace_period' THEN now()+interval '3 days' ELSE NULL END,
        NULL
      );
      v_expected_audits := v_expected_audits + 1;
    END LOOP;

    IF (SELECT status FROM shop_subscriptions WHERE shop_id=r.shop_id)
       <> r.path[array_length(r.path,1)] THEN
      RAISE EXCEPTION 'Lifecycle path did not reach expected state: %',r.path;
    END IF;
    IF (SELECT count(*) FROM subscription_audit_log WHERE shop_id=r.shop_id)
       <> v_expected_audits THEN
      RAISE EXCEPTION 'Lifecycle path audit count mismatch: %',r.path;
    END IF;
  END LOOP;

  SELECT shop_id INTO r
  FROM phase13_paths
  WHERE path=ARRAY['active']::text[]
  LIMIT 1;
  SELECT count(*) INTO v_audit_before FROM subscription_audit_log WHERE shop_id=r.shop_id;
  v_key := gen_random_uuid();
  PERFORM transition_shop_subscription(
    r.shop_id,'past_due','system','idempotent transition',v_key,NULL,NULL,NULL
  );
  PERFORM transition_shop_subscription(
    r.shop_id,'past_due','system','idempotent transition',v_key,NULL,NULL,NULL
  );
  IF (SELECT count(*) FROM subscription_audit_log WHERE shop_id=r.shop_id)
     <> v_audit_before+1 THEN
    RAISE EXCEPTION 'Lifecycle idempotent retry created duplicate or missing audit';
  END IF;

  v_denied := false;
  BEGIN
    PERFORM transition_shop_subscription(
      r.shop_id,'active','system','conflicting retry',v_key,now()+interval '30 days',NULL,NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_denied := SQLERRM LIKE '%SUBSCRIPTION_IDEMPOTENCY_CONFLICT%';
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Lifecycle idempotency conflict was not rejected';
  END IF;

  FOR r IN SELECT * FROM phase13_illegal_paths LOOP
    FOREACH v_status IN ARRAY r.setup_path LOOP
      PERFORM transition_shop_subscription(
        r.shop_id,
        v_status,
        'system',
        'illegal setup '||v_status,
        gen_random_uuid(),
        CASE WHEN v_status='active' THEN now()+interval '30 days' ELSE NULL END,
        CASE WHEN v_status='grace_period' THEN now()+interval '3 days' ELSE NULL END,
        NULL
      );
    END LOOP;

    SELECT status INTO v_before_status FROM shop_subscriptions WHERE shop_id=r.shop_id;
    SELECT count(*) INTO v_audit_before FROM subscription_audit_log WHERE shop_id=r.shop_id;
    v_denied := false;
    BEGIN
      PERFORM transition_shop_subscription(
        r.shop_id,
        r.illegal_target,
        'system',
        'illegal matrix target',
        gen_random_uuid(),
        CASE WHEN r.illegal_target='active' THEN now()+interval '30 days' ELSE NULL END,
        CASE WHEN r.illegal_target='grace_period' THEN now()+interval '3 days' ELSE NULL END,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      v_denied := SQLERRM LIKE '%ILLEGAL_SUBSCRIPTION_TRANSITION%';
    END;

    IF NOT v_denied THEN
      RAISE EXCEPTION 'Illegal lifecycle edge unexpectedly succeeded: % -> %',
        v_before_status,r.illegal_target;
    END IF;
    IF (SELECT status FROM shop_subscriptions WHERE shop_id=r.shop_id) <> v_before_status THEN
      RAISE EXCEPTION 'Illegal lifecycle edge changed persisted status: % -> %',
        v_before_status,r.illegal_target;
    END IF;
    IF (SELECT count(*) FROM subscription_audit_log WHERE shop_id=r.shop_id) <> v_audit_before THEN
      RAISE EXCEPTION 'Illegal lifecycle edge wrote a false audit: % -> %',
        v_before_status,r.illegal_target;
    END IF;
  END LOOP;
END $$;

-- Resolver timing must fail closed after authoritative period/grace deadlines.
DO $$
DECLARE
  v_cancel_shop uuid := (SELECT shop_id FROM phase13_timing_shops WHERE kind='cancel');
  v_grace_shop uuid := (SELECT shop_id FROM phase13_timing_shops WHERE kind='grace');
  v_result jsonb;
BEGIN
  PERFORM transition_shop_subscription(
    v_cancel_shop,'active','system','timing activate',gen_random_uuid(),now()+interval '30 days',NULL,NULL
  );
  PERFORM transition_shop_subscription(
    v_cancel_shop,'cancel_at_period_end','system','timing cancel',gen_random_uuid(),NULL,NULL,NULL
  );
  v_result := get_shop_commercial_status(v_cancel_shop);
  IF COALESCE((v_result->>'commercial_access')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'cancel_at_period_end lost access before current_period_end';
  END IF;

  PERFORM transition_shop_subscription(
    v_grace_shop,'active','system','grace timing activate',gen_random_uuid(),now()+interval '30 days',NULL,NULL
  );
  PERFORM transition_shop_subscription(
    v_grace_shop,'past_due','system','grace timing past due',gen_random_uuid(),NULL,NULL,NULL
  );
  PERFORM transition_shop_subscription(
    v_grace_shop,'grace_period','system','grace timing enter',gen_random_uuid(),NULL,now()+interval '3 days',NULL
  );
  v_result := get_shop_commercial_status(v_grace_shop);
  IF COALESCE((v_result->>'commercial_access')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'grace_period lost access before grace_period_end';
  END IF;
END $$;

-- Deliberately age only isolated test fixtures with the migration-owner session,
-- not service_role, because runtime service_role has no raw subscription DML authority.
RESET ROLE;
UPDATE shop_subscriptions
SET current_period_start=now()-interval '30 days',
    current_period_end=now()-interval '1 second'
WHERE shop_id=(SELECT shop_id FROM phase13_timing_shops WHERE kind='cancel');
UPDATE shop_subscriptions
SET grace_period_end=now()-interval '1 second'
WHERE shop_id=(SELECT shop_id FROM phase13_timing_shops WHERE kind='grace');

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $$
DECLARE
  v_cancel_shop uuid := (SELECT shop_id FROM phase13_timing_shops WHERE kind='cancel');
  v_grace_shop uuid := (SELECT shop_id FROM phase13_timing_shops WHERE kind='grace');
  v_result jsonb;
BEGIN
  v_result := get_shop_commercial_status(v_cancel_shop);
  IF COALESCE((v_result->>'commercial_access')::boolean,true) IS NOT FALSE
     OR v_result->>'blocked_reason' <> 'period_ended' THEN
    RAISE EXCEPTION 'cancel_at_period_end did not fail closed after current_period_end';
  END IF;

  v_result := get_shop_commercial_status(v_grace_shop);
  IF COALESCE((v_result->>'commercial_access')::boolean,true) IS NOT FALSE
     OR v_result->>'blocked_reason' <> 'grace_expired' THEN
    RAISE EXCEPTION 'grace_period did not fail closed after grace_period_end';
  END IF;
END $$;

RESET ROLE;
SELECT pass('All allowed lifecycle edges, important illegal edges, timing, audit, and retry semantics passed');
SELECT * FROM finish();
ROLLBACK;
