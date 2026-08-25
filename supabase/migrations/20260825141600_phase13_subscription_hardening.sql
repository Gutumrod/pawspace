-- PawSpace Phase 13 hardening: one-way compatibility, immutable audit,
-- centralized commercial access, and idempotent package mutation authority.

CREATE OR REPLACE FUNCTION prevent_subscription_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'SUBSCRIPTION_AUDIT_IMMUTABLE';
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION prevent_subscription_audit_mutation() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER trg_subscription_audit_immutable
BEFORE UPDATE OR DELETE ON subscription_audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_subscription_audit_mutation();

-- Phase 9 assignment is a compatibility projection, never an input authority.
CREATE OR REPLACE FUNCTION prevent_commercial_assignment_authority_write()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() IS NOT NULL
     AND current_setting('pawspace.assignment_sync', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'COMMERCIAL_ASSIGNMENT_IS_DERIVED: use set_shop_commercial_package().';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION prevent_commercial_assignment_authority_write() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER trg_prevent_commercial_assignment_authority_write
BEFORE INSERT OR UPDATE OR DELETE ON shop_commercial_assignments
FOR EACH ROW EXECUTE FUNCTION prevent_commercial_assignment_authority_write();

CREATE OR REPLACE FUNCTION sync_trusted_assignment_fixture_to_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Migration/bootstrap SQL runs without a request role. Runtime service-role
  -- traffic must use set_shop_commercial_package() instead.
  IF auth.role() IS NULL AND NEW.is_active=TRUE THEN
    UPDATE shop_subscriptions SET
      package_id=NEW.package_id,
      commercial_offer=NEW.commercial_offer,
      billing_interval=NEW.billing_interval,
      updated_at=now(),
      last_transition_source='migration',
      last_transition_reason='Trusted fixture/bootstrap compatibility sync'
    WHERE shop_id=NEW.shop_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION sync_trusted_assignment_fixture_to_subscription() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER trg_sync_trusted_assignment_fixture
AFTER INSERT OR UPDATE OF package_id,commercial_offer,billing_interval,is_active
ON shop_commercial_assignments FOR EACH ROW EXECUTE FUNCTION sync_trusted_assignment_fixture_to_subscription();

DROP FUNCTION IF EXISTS set_shop_commercial_package(UUID,VARCHAR,VARCHAR,VARCHAR,TEXT,UUID);

CREATE FUNCTION set_shop_commercial_package(
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
  IF NOT EXISTS (SELECT 1 FROM commercial_packages WHERE id=p_package_id) THEN
    RAISE EXCEPTION 'Unknown commercial package.';
  END IF;
  IF p_commercial_offer='founding_member'
     AND (p_package_id<>'starter' OR p_billing_interval<>'monthly') THEN
    RAISE EXCEPTION 'Founding Member must retain Starter monthly commercial identity.';
  END IF;

  SELECT * INTO ss FROM shop_subscriptions WHERE shop_id=p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found for shop.'; END IF;

  v_fingerprint := md5(concat_ws('|',p_package_id,p_commercial_offer,p_billing_interval,
    p_source,p_reason,COALESCE(p_actor_id::text,'')));
  SELECT * INTO v_existing FROM subscription_audit_log
  WHERE subscription_id=ss.id AND idempotency_key=p_idempotency_key;
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
  IF p_commercial_offer='founding_member' AND NOT ss.founding_member_continuity_valid THEN
    RAISE EXCEPTION 'Founding Member continuity has lapsed and cannot be restored.';
  END IF;

  v_actor_type := CASE p_source
    WHEN 'manual_admin' THEN 'platform_admin'
    WHEN 'future_billing_event' THEN 'future_billing_event'
    ELSE 'service_role'
  END;

  UPDATE shop_subscriptions SET
    package_id=p_package_id,
    commercial_offer=p_commercial_offer,
    billing_interval=p_billing_interval,
    last_transition_source=p_source,
    last_transition_reason=p_reason,
    updated_at=now()
  WHERE id=ss.id;

  PERFORM set_config('pawspace.assignment_sync','1',true);
  INSERT INTO shop_commercial_assignments(shop_id,package_id,commercial_offer,billing_interval,is_active)
  VALUES(p_shop_id,p_package_id,p_commercial_offer,p_billing_interval,TRUE)
  ON CONFLICT (shop_id) DO UPDATE SET
    package_id=EXCLUDED.package_id,
    commercial_offer=EXCLUDED.commercial_offer,
    billing_interval=EXCLUDED.billing_interval,
    is_active=TRUE,
    updated_at=now();

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

-- Shared database boundary for business mutations. Read-only owner/manager status remains available.
CREATE OR REPLACE FUNCTION assert_shop_commercial_mutation_allowed(p_shop_id UUID)
RETURNS VOID AS $$
DECLARE v JSONB;
BEGIN
  IF p_shop_id IS NULL THEN RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: shop is required.'; END IF;
  PERFORM 1 FROM shop_subscriptions WHERE shop_id=p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: subscription is not initialized.'; END IF;
  v := resolve_shop_commercial_authority(p_shop_id);
  IF COALESCE((v->>'commercial_access')::boolean,FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: subscription does not allow this mutation.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION assert_shop_commercial_mutation_allowed(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION enforce_shop_commercial_mutation()
RETURNS TRIGGER AS $$
DECLARE v_shop_id UUID;
BEGIN
  v_shop_id := CASE WHEN TG_OP='DELETE' THEN OLD.shop_id ELSE NEW.shop_id END;
  PERFORM assert_shop_commercial_mutation_allowed(v_shop_id);
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION enforce_shop_commercial_mutation() FROM PUBLIC, anon, authenticated, service_role;

-- Inserts on rooms/pets already run quota triggers; add update/delete and cover the
-- other authoritative Phase 1-12 business aggregates at one DB boundary.
CREATE TRIGGER trg_rooms_commercial_access
BEFORE UPDATE OR DELETE ON rooms FOR EACH ROW EXECUTE FUNCTION enforce_shop_commercial_mutation();
CREATE TRIGGER trg_pet_owners_commercial_access
BEFORE INSERT OR UPDATE OR DELETE ON pet_owners FOR EACH ROW EXECUTE FUNCTION enforce_shop_commercial_mutation();
CREATE TRIGGER trg_pets_commercial_access
BEFORE UPDATE OR DELETE ON pets FOR EACH ROW EXECUTE FUNCTION enforce_shop_commercial_mutation();
CREATE TRIGGER trg_bookings_commercial_access
BEFORE INSERT OR UPDATE OR DELETE ON bookings FOR EACH ROW EXECUTE FUNCTION enforce_shop_commercial_mutation();
CREATE TRIGGER trg_booking_pets_commercial_access
BEFORE INSERT OR UPDATE OR DELETE ON booking_pets FOR EACH ROW EXECUTE FUNCTION enforce_shop_commercial_mutation();
CREATE TRIGGER trg_daily_reports_commercial_access
BEFORE INSERT OR UPDATE OR DELETE ON daily_reports FOR EACH ROW EXECUTE FUNCTION enforce_shop_commercial_mutation();
CREATE TRIGGER trg_camera_settings_commercial_access
BEFORE INSERT OR UPDATE OR DELETE ON camera_settings FOR EACH ROW EXECUTE FUNCTION enforce_shop_commercial_mutation();

CREATE OR REPLACE FUNCTION enforce_shop_profile_commercial_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('pawspace.subscription_mirror_write',true)='1'
     AND OLD.subscription_status IS DISTINCT FROM NEW.subscription_status
     AND (to_jsonb(OLD)-'subscription_status')=(to_jsonb(NEW)-'subscription_status') THEN
    RETURN NEW;
  END IF;
  PERFORM assert_shop_commercial_mutation_allowed(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION enforce_shop_profile_commercial_mutation() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER trg_shops_commercial_access
BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION enforce_shop_profile_commercial_mutation();

-- Enforce canonical lifecycle parsing in the compatibility dashboard RPC.
CREATE OR REPLACE FUNCTION get_owner_manager_dashboard_summary()
RETURNS JSONB AS $$
DECLARE
  v_shop_id UUID;
  v_staff staff_users%ROWTYPE;
  v_entitlement JSONB;
BEGIN
  v_shop_id := current_staff_shop_id();
  IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
    RAISE EXCEPTION 'Unauthorized: active owner or manager membership is required.';
  END IF;
  SELECT * INTO v_staff FROM staff_users WHERE id=auth.uid() AND shop_id=v_shop_id AND is_active=TRUE;
  SELECT to_jsonb(e) INTO v_entitlement FROM get_shop_effective_entitlement(v_shop_id) e;
  RETURN jsonb_build_object(
    'shop',(SELECT jsonb_build_object('id',id,'name',name,'slug',slug) FROM shops WHERE id=v_shop_id),
    'staff',jsonb_build_object('id',v_staff.id,'name',v_staff.name,'role',v_staff.role),
    'rooms',jsonb_build_object(
      'total',(SELECT count(*) FROM rooms WHERE shop_id=v_shop_id),
      'available',(SELECT count(*) FROM rooms WHERE shop_id=v_shop_id AND status='available'),
      'occupied',(SELECT count(*) FROM rooms WHERE shop_id=v_shop_id AND status='occupied'),
      'cleaning',(SELECT count(*) FROM rooms WHERE shop_id=v_shop_id AND status='cleaning'),
      'maintenance',(SELECT count(*) FROM rooms WHERE shop_id=v_shop_id AND status='maintenance')),
    'bookings',jsonb_build_object(
      'active',(SELECT count(*) FROM bookings WHERE shop_id=v_shop_id AND booking_status IN ('confirmed','checked_in')),
      'todayCheckIns',(SELECT count(*) FROM bookings WHERE shop_id=v_shop_id AND check_in_date=pawspace_business_date()),
      'todayCheckOuts',(SELECT count(*) FROM bookings WHERE shop_id=v_shop_id AND check_out_date=pawspace_business_date())),
    'dailyReports',jsonb_build_object(
      'totalReportsToday',(SELECT count(*) FROM daily_reports WHERE shop_id=v_shop_id AND report_date=pawspace_business_date()),
      'deliveredCount',(SELECT count(*) FROM daily_reports WHERE shop_id=v_shop_id AND report_date=pawspace_business_date() AND line_delivery_status='sent'),
      'failedCount',(SELECT count(*) FROM daily_reports WHERE shop_id=v_shop_id AND report_date=pawspace_business_date() AND line_delivery_status='failed')),
    'integrations',jsonb_build_object(
      'lineLinked',(SELECT line_oa_id IS NOT NULL FROM shops WHERE id=v_shop_id),
      'googleSheetsEnabled',(SELECT google_sheet_id IS NOT NULL FROM shops WHERE id=v_shop_id),
      'cameraEnabled',EXISTS(SELECT 1 FROM camera_settings WHERE shop_id=v_shop_id AND is_enabled=TRUE)),
    'entitlement',v_entitlement
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION get_owner_manager_dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_owner_manager_dashboard_summary() TO authenticated, service_role;
