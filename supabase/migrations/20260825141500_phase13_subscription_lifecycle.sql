-- PawSpace Phase 13: authoritative subscription lifecycle + entitlement enforcement.
-- Provider-agnostic by design. Payment truth is not created in this migration.

ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_subscription_status_check;
ALTER TABLE shops ADD CONSTRAINT shops_subscription_status_check CHECK (
  subscription_status IN (
    'trial','trialing','active','past_due','grace_period','suspended',
    'cancel_at_period_end','cancelled','expired'
  )
);

CREATE TABLE shop_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  package_id VARCHAR(50) NOT NULL REFERENCES commercial_packages(id),
  commercial_offer VARCHAR(50) NOT NULL DEFAULT 'standard'
    CHECK (commercial_offer IN ('standard','founding_member')),
  billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly','annual')),
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'trialing','active','past_due','grace_period','suspended',
    'cancel_at_period_end','cancelled','expired'
  )),
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  grace_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  founding_member_continuity_valid BOOLEAN NOT NULL DEFAULT TRUE,
  last_transition_source VARCHAR(50) NOT NULL DEFAULT 'migration'
    CHECK (last_transition_source IN ('bootstrap','migration','manual_admin','system','future_billing_event')),
  last_transition_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT founding_member_requires_starter
    CHECK (commercial_offer <> 'founding_member' OR package_id = 'starter'),
  CONSTRAINT valid_trial_window CHECK (
    trial_started_at IS NULL OR trial_ends_at IS NULL OR trial_ends_at > trial_started_at
  ),
  CONSTRAINT valid_period_window CHECK (
    current_period_start IS NULL OR current_period_end IS NULL OR current_period_end > current_period_start
  )
);

CREATE TABLE subscription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES shop_subscriptions(id) ON DELETE CASCADE,
  actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('system','service_role','platform_admin','future_billing_event')),
  actor_id UUID,
  action VARCHAR(100) NOT NULL,
  previous_status VARCHAR(50),
  resulting_status VARCHAR(50),
  previous_package_id VARCHAR(50),
  resulting_package_id VARCHAR(50),
  previous_offer VARCHAR(50),
  resulting_offer VARCHAR(50),
  transition_source VARCHAR(50) NOT NULL CHECK (
    transition_source IN ('bootstrap','migration','manual_admin','system','future_billing_event')
  ),
  reason TEXT,
  idempotency_key UUID,
  request_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, idempotency_key)
);

CREATE INDEX idx_subscription_audit_shop_created
  ON subscription_audit_log(shop_id, created_at DESC);

ALTER TABLE shop_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON shop_subscriptions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON subscription_audit_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON shop_subscriptions TO authenticated, service_role;
GRANT SELECT ON subscription_audit_log TO service_role;

CREATE POLICY shop_subscriptions_owner_manager_read ON shop_subscriptions
  FOR SELECT TO authenticated
  USING (shop_id = current_staff_shop_id() AND is_shop_manager_or_owner());

CREATE OR REPLACE FUNCTION sync_legacy_subscription_status(p_shop_id UUID, p_status VARCHAR)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('pawspace.subscription_mirror_write','1',true);
  UPDATE shops SET subscription_status = p_status WHERE id = p_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;REVOKE ALL ON FUNCTION sync_legacy_subscription_status(UUID,VARCHAR) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION prevent_legacy_subscription_status_write()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.subscription_status IS DISTINCT FROM NEW.subscription_status
     AND current_setting('pawspace.subscription_mirror_write', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'SUBSCRIPTION_STATUS_IS_DERIVED: use authoritative subscription lifecycle RPCs.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION prevent_legacy_subscription_status_write() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_prevent_legacy_subscription_status_write
BEFORE UPDATE OF subscription_status ON shops
FOR EACH ROW EXECUTE FUNCTION prevent_legacy_subscription_status_write();

INSERT INTO shop_subscriptions (
  shop_id, package_id, commercial_offer, billing_interval, status,
  trial_started_at, trial_ends_at, founding_member_continuity_valid,
  last_transition_source, last_transition_reason
)
SELECT
  s.id,
  COALESCE(sca.package_id, 'starter'),
  COALESCE(sca.commercial_offer, 'standard'),
  COALESCE(sca.billing_interval, 'monthly'),
  CASE
    WHEN s.subscription_status = 'active' THEN 'active'
    WHEN s.subscription_status = 'past_due' THEN 'past_due'
    WHEN s.created_at + interval '30 days' <= now() THEN 'expired'
    ELSE 'trialing'
  END,
  s.created_at,
  s.created_at + interval '30 days',
  TRUE,
  'migration',
  'Phase 13 backfill from legacy shop status and Phase 9 assignment'
FROM shops s
LEFT JOIN shop_commercial_assignments sca
  ON sca.shop_id = s.id AND sca.is_active = TRUE
ON CONFLICT (shop_id) DO NOTHING;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT shop_id, status FROM shop_subscriptions LOOP
    PERFORM sync_legacy_subscription_status(r.shop_id, r.status);
  END LOOP;
END $$;

ALTER TABLE shops ALTER COLUMN subscription_status SET DEFAULT 'trialing';
ALTER TABLE shops DROP CONSTRAINT shops_subscription_status_check;
ALTER TABLE shops ADD CONSTRAINT shops_subscription_status_check CHECK (
  subscription_status IN (
    'trialing','active','past_due','grace_period','suspended',
    'cancel_at_period_end','cancelled','expired'
  )
);

INSERT INTO subscription_audit_log (
  shop_id, subscription_id, actor_type, action,
  previous_status, resulting_status,
  previous_package_id, resulting_package_id,
  previous_offer, resulting_offer,
  transition_source, reason
)
SELECT
  ss.shop_id, ss.id, 'system', 'subscription.migrated',
  NULL, ss.status, NULL, ss.package_id, NULL, ss.commercial_offer,
  'migration', 'Phase 13 authoritative subscription initialized from existing shop state'
FROM shop_subscriptions ss
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_audit_log sal
  WHERE sal.subscription_id = ss.id AND sal.action = 'subscription.migrated'
);
CREATE OR REPLACE FUNCTION resolve_shop_commercial_authority(p_shop_id UUID)
RETURNS JSONB AS $$
DECLARE
  ss shop_subscriptions%ROWTYPE;
  cp commercial_packages%ROWTYPE;
  pro commercial_packages%ROWTYPE;
  v_access BOOLEAN := FALSE;
  v_room_limit INT;
  v_pet_limit INT;
  v_package_name VARCHAR(100);
  v_monthly_price INT;
  v_annual_price INT;
  v_support_tier VARCHAR(50);
  v_block_reason TEXT;
BEGIN
  SELECT * INTO ss FROM shop_subscriptions WHERE shop_id = p_shop_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'shop_id', p_shop_id, 'subscription_id', NULL, 'package_id', 'starter',
      'package_name', 'Starter', 'commercial_offer', 'standard',
      'lifecycle_status', 'expired', 'commercial_access', FALSE,
      'room_limit', 10, 'pet_history_limit', 300,
      'monthly_price', 990, 'annual_price', 9900,
      'support_tier', NULL, 'future_paid_addons_included', FALSE,
      'blocked_reason', 'missing_subscription'
    );
  END IF;
  SELECT * INTO cp FROM commercial_packages WHERE id = ss.package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMMERCIAL_CONFIGURATION_INVALID: package definition missing.';
  END IF;

  v_access := CASE ss.status
    WHEN 'trialing' THEN ss.trial_ends_at IS NOT NULL AND now() < ss.trial_ends_at
    WHEN 'active' THEN TRUE
    WHEN 'past_due' THEN TRUE
    WHEN 'grace_period' THEN ss.grace_period_end IS NOT NULL AND now() < ss.grace_period_end
    WHEN 'cancel_at_period_end' THEN ss.current_period_end IS NOT NULL AND now() < ss.current_period_end
    ELSE FALSE
  END;

  v_block_reason := CASE
    WHEN v_access THEN NULL
    WHEN ss.status = 'trialing' AND ss.trial_ends_at IS NOT NULL AND now() >= ss.trial_ends_at THEN 'trial_expired'
    WHEN ss.status = 'grace_period' AND ss.grace_period_end IS NOT NULL AND now() >= ss.grace_period_end THEN 'grace_expired'
    WHEN ss.status = 'cancel_at_period_end' AND ss.current_period_end IS NOT NULL AND now() >= ss.current_period_end THEN 'period_ended'
    ELSE ss.status
  END;

  IF ss.commercial_offer = 'founding_member' AND ss.founding_member_continuity_valid THEN
    SELECT * INTO pro FROM commercial_packages WHERE id = 'pro';
    IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCIAL_CONFIGURATION_INVALID: Pro package missing.'; END IF;
    v_room_limit := pro.room_limit;
    v_pet_limit := pro.pet_history_limit;
    v_package_name := 'Starter (Founding Member Pro)';
    v_monthly_price := 990;
    v_annual_price := NULL;
    v_support_tier := NULL;
  ELSE
    v_room_limit := cp.room_limit;
    v_pet_limit := cp.pet_history_limit;
    v_package_name := cp.name;
    v_monthly_price := cp.monthly_price;
    v_annual_price := cp.annual_price;
    v_support_tier := cp.support_tier;
  END IF;

  RETURN jsonb_build_object(
    'shop_id', ss.shop_id,
    'subscription_id', ss.id,
    'package_id', ss.package_id,
    'package_name', v_package_name,
    'commercial_offer', ss.commercial_offer,
    'lifecycle_status', ss.status,
    'commercial_access', v_access,
    'room_limit', v_room_limit,
    'pet_history_limit', v_pet_limit,
    'monthly_price', v_monthly_price,
    'annual_price', v_annual_price,
    'support_tier', v_support_tier,
    'future_paid_addons_included', FALSE,
    'trial_ends_at', ss.trial_ends_at,
    'current_period_end', ss.current_period_end,
    'grace_period_end', ss.grace_period_end,
    'founding_member_continuity_valid', ss.founding_member_continuity_valid,
    'blocked_reason', v_block_reason,
    'current_room_usage', (SELECT COUNT(*) FROM rooms r WHERE r.shop_id = ss.shop_id),
    'current_pet_usage', (SELECT COUNT(*) FROM pets p WHERE p.shop_id = ss.shop_id)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION resolve_shop_commercial_authority(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION get_shop_commercial_status(p_shop_id UUID)
RETURNS JSONB AS $$
DECLARE v_staff_shop UUID;
BEGIN
  IF auth.role() = 'authenticated' THEN
    v_staff_shop := current_staff_shop_id();
    IF v_staff_shop IS NULL OR v_staff_shop <> p_shop_id OR NOT is_shop_manager_or_owner() THEN
      RAISE EXCEPTION 'Unauthorized: owner/manager membership for this shop is required.';
    END IF;
  ELSIF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized commercial status query.';
  END IF;
  RETURN resolve_shop_commercial_authority(p_shop_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION get_shop_commercial_status(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_shop_commercial_status(UUID) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION get_shop_effective_entitlement(p_shop_id UUID)
RETURNS TABLE (
  shop_id UUID, package_id VARCHAR(50), package_name VARCHAR(100),
  commercial_offer VARCHAR(50), monthly_price INTEGER, annual_price INTEGER,
  room_limit INTEGER, pet_history_limit INTEGER, support_tier VARCHAR(50),
  future_paid_addons_included BOOLEAN
) AS $$
DECLARE
  v_staff_shop UUID;
  v JSONB;
BEGIN
  IF auth.role() = 'authenticated' THEN
    v_staff_shop := current_staff_shop_id();
    IF v_staff_shop IS NULL OR v_staff_shop <> p_shop_id OR NOT is_shop_manager_or_owner() THEN
      RAISE EXCEPTION 'Unauthorized: owner/manager membership for this shop is required.';
    END IF;
  ELSIF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized entitlement query.';
  END IF;

  v := resolve_shop_commercial_authority(p_shop_id);
  RETURN QUERY SELECT
    p_shop_id,
    (v->>'package_id')::VARCHAR(50),
    (v->>'package_name')::VARCHAR(100),
    (v->>'commercial_offer')::VARCHAR(50),
    (v->>'monthly_price')::INTEGER,
    NULLIF(v->>'annual_price','')::INTEGER,
    NULLIF(v->>'room_limit','')::INTEGER,
    NULLIF(v->>'pet_history_limit','')::INTEGER,
    NULLIF(v->>'support_tier','')::VARCHAR(50),
    FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION get_shop_effective_entitlement(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_shop_effective_entitlement(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION initialize_shop_subscription_internal(p_shop_id UUID)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM shop_subscriptions WHERE shop_id = p_shop_id;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  INSERT INTO shop_subscriptions (
    shop_id, package_id, commercial_offer, billing_interval, status,
    trial_started_at, trial_ends_at,
    last_transition_source, last_transition_reason
  )
  VALUES (
    p_shop_id, 'starter', 'standard', 'monthly', 'trialing',
    now(), now() + interval '30 days',
    'bootstrap', '30-day trial initialized with shop creation'
  )
  RETURNING id INTO v_id;

  PERFORM sync_legacy_subscription_status(p_shop_id, 'trialing');
  INSERT INTO subscription_audit_log (
    shop_id, subscription_id, actor_type, action,
    resulting_status, resulting_package_id, resulting_offer,
    transition_source, reason
  )
  SELECT p_shop_id, v_id, 'system', 'subscription.initialized',
         'trialing', 'starter', 'standard', 'bootstrap',
         '30-day trial initialized with shop creation'
  WHERE NOT EXISTS (
    SELECT 1 FROM subscription_audit_log
    WHERE subscription_id = v_id AND action = 'subscription.initialized'
  );
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION initialize_shop_subscription_internal(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION initialize_shop_subscription_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_shop_subscription_internal(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION initialize_shop_subscription_after_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_initialize_shop_subscription_after_insert
AFTER INSERT ON shops
FOR EACH ROW EXECUTE FUNCTION initialize_shop_subscription_after_insert();

CREATE OR REPLACE FUNCTION set_shop_commercial_package(
  p_shop_id UUID,
  p_package_id VARCHAR,
  p_commercial_offer VARCHAR,
  p_source VARCHAR,
  p_reason TEXT,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  ss shop_subscriptions%ROWTYPE;
  v_actor_type VARCHAR(50);
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized commercial package mutation.';
  END IF;
  IF p_source NOT IN ('manual_admin','system','future_billing_event') THEN
    RAISE EXCEPTION 'Invalid transition source.';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Invalid transition reason.';
  END IF;
  IF p_source = 'manual_admin' AND p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Manual admin transition requires actor id.';
  END IF;
  IF p_commercial_offer NOT IN ('standard','founding_member') THEN
    RAISE EXCEPTION 'Invalid commercial offer.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM commercial_packages WHERE id = p_package_id) THEN
    RAISE EXCEPTION 'Unknown commercial package.';
  END IF;
  IF p_commercial_offer = 'founding_member' AND p_package_id <> 'starter' THEN
    RAISE EXCEPTION 'Founding Member must use Starter commercial package identity.';
  END IF;

  SELECT * INTO ss FROM shop_subscriptions WHERE shop_id = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found for shop.'; END IF;
  IF p_commercial_offer = 'founding_member' AND NOT ss.founding_member_continuity_valid THEN
    RAISE EXCEPTION 'Founding Member continuity has lapsed and cannot be restored.';
  END IF;

  v_actor_type := CASE p_source
    WHEN 'future_billing_event' THEN 'future_billing_event'
    WHEN 'manual_admin' THEN 'platform_admin'
    ELSE 'service_role'
  END;
  UPDATE shop_subscriptions
  SET package_id = p_package_id,
      commercial_offer = p_commercial_offer,
      updated_at = now(),
      last_transition_source = p_source,
      last_transition_reason = p_reason
  WHERE id = ss.id;

  INSERT INTO shop_commercial_assignments(
    shop_id, package_id, commercial_offer, billing_interval, is_active
  ) VALUES (
    p_shop_id, p_package_id, p_commercial_offer, 'monthly', TRUE
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    package_id = EXCLUDED.package_id,
    commercial_offer = EXCLUDED.commercial_offer,
    is_active = TRUE,
    updated_at = now();

  INSERT INTO subscription_audit_log (
    shop_id, subscription_id, actor_type, actor_id, action,
    previous_status, resulting_status,
    previous_package_id, resulting_package_id,
    previous_offer, resulting_offer,
    transition_source, reason
  ) VALUES (
    p_shop_id, ss.id, v_actor_type, p_actor_id, 'subscription.package_changed',
    ss.status, ss.status,
    ss.package_id, p_package_id,
    ss.commercial_offer, p_commercial_offer,
    p_source, p_reason
  );
  RETURN resolve_shop_commercial_authority(p_shop_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION set_shop_commercial_package(UUID,VARCHAR,VARCHAR,VARCHAR,TEXT,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_shop_commercial_package(UUID,VARCHAR,VARCHAR,VARCHAR,TEXT,UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION transition_shop_subscription(
  p_shop_id UUID,
  p_to_status VARCHAR,
  p_source VARCHAR,
  p_reason TEXT,
  p_idempotency_key UUID DEFAULT NULL,
  p_current_period_end TIMESTAMPTZ DEFAULT NULL,
  p_grace_period_end TIMESTAMPTZ DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  ss shop_subscriptions%ROWTYPE;
  v_allowed BOOLEAN := FALSE;
  v_actor_type VARCHAR(50);
  v_fingerprint TEXT;
  v_existing subscription_audit_log%ROWTYPE;
  v_new_period_start TIMESTAMPTZ;
  v_new_period_end TIMESTAMPTZ;
  v_new_grace_end TIMESTAMPTZ;
  v_cancel_at_period_end BOOLEAN;
  v_cancelled_at TIMESTAMPTZ;
  v_suspended_at TIMESTAMPTZ;
  v_continuity BOOLEAN;
  v_new_offer VARCHAR(50);
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized subscription transition.';
  END IF;
  IF p_source NOT IN ('manual_admin','system','future_billing_event') THEN
    RAISE EXCEPTION 'Invalid transition source.';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Invalid transition reason.';
  END IF;
  IF p_source = 'manual_admin' AND p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Manual admin transition requires actor id.';
  END IF;
  IF p_to_status NOT IN (
    'trialing','active','past_due','grace_period','suspended',
    'cancel_at_period_end','cancelled','expired'
  ) THEN
    RAISE EXCEPTION 'Invalid subscription lifecycle status.';
  END IF;

  SELECT * INTO ss FROM shop_subscriptions WHERE shop_id = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found for shop.'; END IF;

  v_fingerprint := md5(concat_ws('|', p_to_status, p_source, COALESCE(p_reason,''),
    COALESCE(p_current_period_end::text,''), COALESCE(p_grace_period_end::text,''), COALESCE(p_actor_id::text,'')));
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM subscription_audit_log
    WHERE subscription_id = ss.id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      IF v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
        RAISE EXCEPTION 'SUBSCRIPTION_IDEMPOTENCY_CONFLICT';
      END IF;
      RETURN resolve_shop_commercial_authority(p_shop_id);
    END IF;
  END IF;

  v_allowed := CASE ss.status
    WHEN 'trialing' THEN p_to_status IN ('active','expired','cancelled')
    WHEN 'active' THEN p_to_status IN ('past_due','cancel_at_period_end','suspended','cancelled')
    WHEN 'past_due' THEN p_to_status IN ('active','grace_period','suspended','cancelled')
    WHEN 'grace_period' THEN p_to_status IN ('active','expired','suspended','cancelled')
    WHEN 'cancel_at_period_end' THEN p_to_status IN ('active','expired','cancelled')
    WHEN 'suspended' THEN p_to_status IN ('active','cancelled','expired')
    ELSE FALSE
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'ILLEGAL_SUBSCRIPTION_TRANSITION: % -> %', ss.status, p_to_status;
  END IF;

  IF p_to_status = 'active' THEN
    v_new_period_start := COALESCE(ss.current_period_start, now());
    v_new_period_end := COALESCE(p_current_period_end, ss.current_period_end);
    IF v_new_period_end IS NULL OR v_new_period_end <= now() THEN
      RAISE EXCEPTION 'ACTIVE_PERIOD_END_REQUIRED: active access requires a future authoritative period end.';
    END IF;
  ELSE
    v_new_period_start := ss.current_period_start;
    v_new_period_end := ss.current_period_end;
  END IF;

  IF p_to_status = 'grace_period' THEN
    IF p_grace_period_end IS NULL OR p_grace_period_end <= now() THEN
      RAISE EXCEPTION 'GRACE_PERIOD_END_REQUIRED: grace period must end in the future.';
    END IF;
    v_new_grace_end := p_grace_period_end;
  ELSIF p_to_status = 'active' THEN
    v_new_grace_end := NULL;
  ELSE
    v_new_grace_end := ss.grace_period_end;
  END IF;

  IF p_to_status = 'cancel_at_period_end' THEN
    IF ss.current_period_end IS NULL OR ss.current_period_end <= now() THEN
      RAISE EXCEPTION 'CANCEL_PERIOD_END_REQUIRED: current period end must be in the future.';
    END IF;
    v_cancel_at_period_end := TRUE;
  ELSE
    v_cancel_at_period_end := FALSE;
  END IF;

  v_cancelled_at := CASE WHEN p_to_status = 'cancelled' THEN now() WHEN p_to_status = 'active' THEN NULL ELSE ss.cancelled_at END;
  v_suspended_at := CASE WHEN p_to_status = 'suspended' THEN now() WHEN p_to_status = 'active' THEN NULL ELSE ss.suspended_at END;
  v_continuity := ss.founding_member_continuity_valid;
  v_new_offer := ss.commercial_offer;
  IF p_to_status IN ('cancelled','expired') THEN
    v_continuity := FALSE;
    IF ss.commercial_offer = 'founding_member' THEN v_new_offer := 'standard'; END IF;
  END IF;
  UPDATE shop_subscriptions
  SET status = p_to_status,
      commercial_offer = v_new_offer,
      current_period_start = v_new_period_start,
      current_period_end = v_new_period_end,
      grace_period_end = v_new_grace_end,
      cancel_at_period_end = v_cancel_at_period_end,
      cancelled_at = v_cancelled_at,
      suspended_at = v_suspended_at,
      founding_member_continuity_valid = v_continuity,
      last_transition_source = p_source,
      last_transition_reason = p_reason,
      updated_at = now()
  WHERE id = ss.id;

  PERFORM sync_legacy_subscription_status(p_shop_id, p_to_status);
  v_actor_type := CASE p_source
    WHEN 'future_billing_event' THEN 'future_billing_event'
    WHEN 'manual_admin' THEN 'platform_admin'
    ELSE 'service_role'
  END;

  INSERT INTO subscription_audit_log (
    shop_id, subscription_id, actor_type, actor_id, action,
    previous_status, resulting_status,
    previous_package_id, resulting_package_id,
    previous_offer, resulting_offer,
    transition_source, reason, idempotency_key, request_fingerprint
  ) VALUES (
    p_shop_id, ss.id, v_actor_type, p_actor_id,
    'subscription.status_changed', ss.status, p_to_status,
    ss.package_id, ss.package_id, ss.commercial_offer, v_new_offer,
    p_source, p_reason, p_idempotency_key, v_fingerprint
  );

  RETURN resolve_shop_commercial_authority(p_shop_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION transition_shop_subscription(UUID,VARCHAR,VARCHAR,TEXT,UUID,TIMESTAMPTZ,TIMESTAMPTZ,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION transition_shop_subscription(UUID,VARCHAR,VARCHAR,TEXT,UUID,TIMESTAMPTZ,TIMESTAMPTZ,UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION enforce_room_commercial_quota()
RETURNS TRIGGER AS $$
DECLARE
  v JSONB;
  v_limit INT;
  v_count INT;
BEGIN
  PERFORM 1 FROM shop_subscriptions WHERE shop_id = NEW.shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: subscription is not initialized.'; END IF;
  v := resolve_shop_commercial_authority(NEW.shop_id);
  IF COALESCE((v->>'commercial_access')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: subscription does not allow this mutation.';
  END IF;
  v_limit := NULLIF(v->>'room_limit','')::INT;
  IF v_limit IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_count FROM rooms WHERE shop_id = NEW.shop_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'ROOM_QUOTA_EXCEEDED: current package room limit reached.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION enforce_room_commercial_quota() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_room_commercial_quota
BEFORE INSERT ON rooms
FOR EACH ROW EXECUTE FUNCTION enforce_room_commercial_quota();
CREATE OR REPLACE FUNCTION enforce_pet_commercial_quota()
RETURNS TRIGGER AS $$
DECLARE
  v JSONB;
  v_limit INT;
  v_count INT;
BEGIN
  PERFORM 1 FROM shop_subscriptions WHERE shop_id = NEW.shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: subscription is not initialized.'; END IF;
  v := resolve_shop_commercial_authority(NEW.shop_id);
  IF COALESCE((v->>'commercial_access')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: subscription does not allow this mutation.';
  END IF;
  v_limit := NULLIF(v->>'pet_history_limit','')::INT;
  IF v_limit IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_count FROM pets WHERE shop_id = NEW.shop_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'PET_QUOTA_EXCEEDED: current package pet record limit reached.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION enforce_pet_commercial_quota() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_pet_commercial_quota
BEFORE INSERT ON pets
FOR EACH ROW EXECUTE FUNCTION enforce_pet_commercial_quota();

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON shop_subscriptions FROM service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON subscription_audit_log FROM service_role;