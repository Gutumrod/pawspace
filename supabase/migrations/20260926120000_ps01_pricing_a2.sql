-- Owner-approved PS01 pricing update (Addendum A-2, 2026-09-26).
-- Stop before catalog changes if Enterprise or an annual plan already has any shop assignment.
-- One statement = one transaction: the locks (same order as package mutations) are held
-- from the checks through the price update. A bare LOCK TABLE is rejected outside a
-- transaction block by the migration runner (SQLSTATE 25P01).
DO $$
BEGIN
  LOCK TABLE shop_subscriptions, shop_commercial_assignments IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM shop_subscriptions WHERE package_id = 'enterprise')
     OR EXISTS (SELECT 1 FROM shop_commercial_assignments WHERE package_id = 'enterprise') THEN
    RAISE EXCEPTION 'PS01_ENTERPRISE_ASSIGNED_SHOP_REQUIRES_OWNER_REVIEW';
  END IF;
  IF EXISTS (SELECT 1 FROM shop_subscriptions WHERE billing_interval = 'annual')
     OR EXISTS (SELECT 1 FROM shop_commercial_assignments WHERE billing_interval = 'annual') THEN
    RAISE EXCEPTION 'PS01_ANNUAL_ASSIGNED_SHOP_REQUIRES_OWNER_REVIEW';
  END IF;

  EXECUTE 'ALTER TABLE commercial_packages
    ADD COLUMN IF NOT EXISTS available_for_sale BOOLEAN NOT NULL DEFAULT TRUE';
  EXECUTE 'UPDATE commercial_packages
    SET monthly_price = CASE id
          WHEN ''starter'' THEN 590
          WHEN ''pro'' THEN 990
          ELSE monthly_price
        END,
        annual_price = NULL,
        available_for_sale = (id <> ''enterprise'')
    WHERE id IN (''starter'', ''pro'', ''enterprise'')';
END;
$$;

DROP POLICY IF EXISTS commercial_packages_select_policy ON commercial_packages;
CREATE POLICY commercial_packages_select_policy ON commercial_packages
  FOR SELECT TO authenticated USING (available_for_sale);

-- Preserve the existing authoritative subscription lifecycle and tenant security.
-- The service-role package mutation boundary also refuses packages not for sale.
CREATE OR REPLACE FUNCTION set_shop_commercial_package(
  p_shop_id UUID,
  p_package_id VARCHAR,
  p_commercial_offer VARCHAR,
  p_billing_interval VARCHAR,
  p_source VARCHAR,
  p_reason TEXT,
  p_idempotency_key UUID DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  ss shop_subscriptions%ROWTYPE;
  v_existing subscription_audit_log%ROWTYPE;
  v_fingerprint TEXT;
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
  IF (p_source = 'manual_admin') IS DISTINCT FROM (p_actor_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Actor id is required only for manual admin mutations.';
  END IF;
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Commercial package mutation requires an idempotency key.';
  END IF;
  IF p_commercial_offer NOT IN ('standard','founding_member') THEN
    RAISE EXCEPTION 'Invalid commercial offer.';
  END IF;
  IF p_billing_interval NOT IN ('monthly','annual') THEN
    RAISE EXCEPTION 'Invalid billing interval.';
  END IF;
  IF p_billing_interval = 'annual' AND NOT EXISTS (
    SELECT 1 FROM commercial_packages
    WHERE id = p_package_id AND annual_price IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ANNUAL_PRICE_NOT_APPROVED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM commercial_packages
    WHERE id = p_package_id AND available_for_sale
  ) THEN
    RAISE EXCEPTION 'COMMERCIAL_PACKAGE_NOT_AVAILABLE';
  END IF;
  IF p_commercial_offer = 'founding_member'
     AND (p_package_id <> 'starter' OR p_billing_interval <> 'monthly') THEN
    RAISE EXCEPTION 'Founding Member must retain Starter monthly commercial identity.';
  END IF;

  SELECT * INTO ss FROM shop_subscriptions WHERE shop_id = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found for shop.'; END IF;

  v_fingerprint := md5(concat_ws('|',p_package_id,p_commercial_offer,p_billing_interval,
    p_source,p_reason,COALESCE(p_actor_id::text,'')));
  SELECT * INTO v_existing FROM subscription_audit_log
  WHERE subscription_id = ss.id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'COMMERCIAL_PACKAGE_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN resolve_shop_commercial_authority(p_shop_id);
  END IF;

  IF ss.status IN ('suspended','cancelled','expired')
     OR NOT COALESCE((resolve_shop_commercial_authority(p_shop_id)->>'commercial_access')::boolean,FALSE) THEN
    RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: lifecycle does not permit package mutation.';
  END IF;
  IF p_commercial_offer = 'founding_member' AND NOT ss.founding_member_continuity_valid THEN
    RAISE EXCEPTION 'Founding Member continuity has lapsed and cannot be restored.';
  END IF;

  v_actor_type := CASE p_source
    WHEN 'manual_admin' THEN 'platform_admin'
    WHEN 'future_billing_event' THEN 'future_billing_event'
    ELSE 'service_role'
  END;

  UPDATE shop_subscriptions SET
    package_id = p_package_id,
    commercial_offer = p_commercial_offer,
    billing_interval = p_billing_interval,
    last_transition_source = p_source,
    last_transition_reason = p_reason,
    updated_at = now()
  WHERE id = ss.id;

  PERFORM set_config('pawspace.assignment_sync','1',true);
  INSERT INTO shop_commercial_assignments(shop_id,package_id,commercial_offer,billing_interval,is_active)
  VALUES(p_shop_id,p_package_id,p_commercial_offer,p_billing_interval,TRUE)
  ON CONFLICT (shop_id) DO UPDATE SET
    package_id = EXCLUDED.package_id,
    commercial_offer = EXCLUDED.commercial_offer,
    billing_interval = EXCLUDED.billing_interval,
    is_active = TRUE,
    updated_at = now();

  INSERT INTO subscription_audit_log(
    shop_id,subscription_id,actor_type,actor_id,action,
    previous_status,resulting_status,previous_package_id,resulting_package_id,
    previous_offer,resulting_offer,transition_source,reason,idempotency_key,request_fingerprint
  ) VALUES (
    p_shop_id,ss.id,v_actor_type,p_actor_id,'subscription.package_changed',
    ss.status,ss.status,ss.package_id,p_package_id,ss.commercial_offer,p_commercial_offer,
    p_source,p_reason,p_idempotency_key,v_fingerprint
  );
  RETURN resolve_shop_commercial_authority(p_shop_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION set_shop_commercial_package(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT,UUID,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_shop_commercial_package(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT,UUID,UUID)
  TO service_role;
