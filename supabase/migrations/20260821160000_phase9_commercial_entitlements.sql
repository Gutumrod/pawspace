-- Phase 9: Owner/Manager Dashboard + Commercial Entitlements
-- Source of truth: docs/BUSINESS_MODEL.md + Phase 9 implementation brief.

CREATE TABLE IF NOT EXISTS commercial_packages (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    monthly_price INTEGER NOT NULL CHECK (monthly_price >= 0),
    annual_price INTEGER CHECK (annual_price IS NULL OR annual_price >= 0),
    room_limit INTEGER CHECK (room_limit IS NULL OR room_limit >= 0),
    pet_history_limit INTEGER CHECK (pet_history_limit IS NULL OR pet_history_limit >= 0),
    support_tier VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO commercial_packages
    (id, name, monthly_price, annual_price, room_limit, pet_history_limit, support_tier)
VALUES
    ('starter', 'Starter', 990, 9900, 10, 300, NULL),
    ('pro', 'Pro', 1490, 14900, NULL, NULL, NULL),
    ('enterprise', 'Enterprise', 2490, 24900, NULL, NULL, 'priority')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    monthly_price = EXCLUDED.monthly_price,
    annual_price = EXCLUDED.annual_price,
    room_limit = EXCLUDED.room_limit,
    pet_history_limit = EXCLUDED.pet_history_limit,
    support_tier = EXCLUDED.support_tier;
CREATE TABLE IF NOT EXISTS shop_commercial_assignments (
    shop_id UUID PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
    package_id VARCHAR(50) NOT NULL REFERENCES commercial_packages(id),
    commercial_offer VARCHAR(50) NOT NULL DEFAULT 'standard'
        CHECK (commercial_offer IN ('standard', 'founding_member')),
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly'
        CHECK (billing_interval IN ('monthly', 'annual')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT founding_member_uses_starter_base
        CHECK (commercial_offer <> 'founding_member' OR package_id = 'starter')
);

ALTER TABLE commercial_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_commercial_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON commercial_packages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON shop_commercial_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON commercial_packages TO authenticated;
GRANT SELECT ON shop_commercial_assignments TO authenticated;

CREATE POLICY commercial_packages_select_policy ON commercial_packages
    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY shop_commercial_assignments_select_policy ON shop_commercial_assignments
    FOR SELECT TO authenticated
    USING (shop_id = current_staff_shop_id() AND is_shop_manager_or_owner());
CREATE OR REPLACE FUNCTION get_shop_effective_entitlement(p_shop_id UUID)
RETURNS TABLE (
    shop_id UUID,
    package_id VARCHAR(50),
    package_name VARCHAR(100),
    commercial_offer VARCHAR(50),
    monthly_price INTEGER,
    annual_price INTEGER,
    room_limit INTEGER,
    pet_history_limit INTEGER,
    support_tier VARCHAR(50),
    future_paid_addons_included BOOLEAN
) AS $$
DECLARE
    v_staff_shop UUID;
    v_pkg_id VARCHAR(50);
    v_offer VARCHAR(50);
BEGIN
    IF auth.role() = 'authenticated' THEN
        v_staff_shop := current_staff_shop_id();
        IF v_staff_shop IS NULL OR v_staff_shop <> p_shop_id OR NOT is_shop_manager_or_owner() THEN
            RAISE EXCEPTION 'Unauthorized: owner/manager membership for this shop is required.';
        END IF;
    ELSIF auth.role() = 'service_role' THEN
        NULL;
    ELSE
        RAISE EXCEPTION 'Unauthorized entitlement query.';
    END IF;

    SELECT sca.package_id, sca.commercial_offer
    INTO v_pkg_id, v_offer
    FROM shop_commercial_assignments sca
    WHERE sca.shop_id = p_shop_id AND sca.is_active = TRUE;
    IF v_pkg_id IS NULL THEN
        v_pkg_id := 'starter';
        v_offer := 'standard';
    END IF;

    IF v_offer = 'founding_member' AND v_pkg_id = 'starter' THEN
        RETURN QUERY
        SELECT
            p_shop_id,
            'starter'::VARCHAR(50),
            'Starter (Founding Member Pro)'::VARCHAR(100),
            'founding_member'::VARCHAR(50),
            990,
            NULL::INTEGER,
            pro.room_limit,
            pro.pet_history_limit,
            NULL::VARCHAR(50),
            FALSE
        FROM commercial_packages pro
        WHERE pro.id = 'pro';
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        p_shop_id,
        cp.id,
        cp.name,
        v_offer,
        cp.monthly_price,
        cp.annual_price,
        cp.room_limit,
        cp.pet_history_limit,
        cp.support_tier,
        FALSE
    FROM commercial_packages cp
    WHERE cp.id = v_pkg_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION get_shop_effective_entitlement(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_shop_effective_entitlement(UUID) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION get_owner_manager_dashboard_summary()
RETURNS JSONB AS $$
DECLARE
    v_shop_id UUID;
    v_user_id UUID;
    v_business_date DATE;
    v_shop shops%ROWTYPE;
    v_staff staff_users%ROWTYPE;
    v_camera JSONB;
    v_entitlement JSONB;
    v_rooms JSONB;
    v_bookings JSONB;
    v_reports JSONB;
    v_integrations JSONB;
BEGIN
    IF auth.role() IS DISTINCT FROM 'authenticated' THEN
        RAISE EXCEPTION 'Unauthorized dashboard request.';
    END IF;

    v_shop_id := current_staff_shop_id();
    v_user_id := auth.uid();
    IF v_shop_id IS NULL OR v_user_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Forbidden: owner or manager role required for dashboard.';
    END IF;

    SELECT * INTO v_shop FROM shops WHERE id = v_shop_id;
    SELECT * INTO v_staff FROM staff_users
    WHERE id = v_user_id AND shop_id = v_shop_id AND is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: active staff membership required.';
    END IF;

    v_business_date := pawspace_business_date();
    v_camera := get_camera_staff_settings();
    SELECT to_jsonb(e) INTO v_entitlement
    FROM get_shop_effective_entitlement(v_shop_id) e;
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'available', COUNT(*) FILTER (WHERE status = 'available'),
        'occupied', COUNT(*) FILTER (WHERE status = 'occupied'),
        'cleaning', COUNT(*) FILTER (WHERE status = 'cleaning'),
        'maintenance', COUNT(*) FILTER (WHERE status = 'maintenance')
    ) INTO v_rooms
    FROM rooms WHERE shop_id = v_shop_id;

    SELECT jsonb_build_object(
        'active', COUNT(*) FILTER (WHERE booking_status IN ('confirmed', 'checked_in')),
        'todayCheckIns', COUNT(*) FILTER (
            WHERE check_in_date = v_business_date
              AND booking_status IN ('confirmed', 'checked_in')
        ),
        'todayCheckOuts', COUNT(*) FILTER (
            WHERE check_out_date = v_business_date
              AND booking_status <> 'cancelled'
        )
    ) INTO v_bookings
    FROM bookings WHERE shop_id = v_shop_id;

    SELECT jsonb_build_object(
        'totalReportsToday', COUNT(*),
        'deliveredCount', COUNT(*) FILTER (WHERE line_delivery_status = 'sent'),
        'failedCount', COUNT(*) FILTER (WHERE line_delivery_status = 'failed')
    ) INTO v_reports
    FROM daily_reports
    WHERE shop_id = v_shop_id AND report_date = v_business_date;
    SELECT jsonb_build_object(
        'lineLinked', (
            v_shop.line_oa_id IS NOT NULL
            OR EXISTS (
                SELECT 1 FROM pet_owners
                WHERE shop_id = v_shop_id AND line_user_id IS NOT NULL
            )
        ),
        'googleSheetsEnabled', v_shop.google_sheet_id IS NOT NULL,
        'cameraEnabled', COALESCE((v_camera->>'is_enabled')::BOOLEAN, FALSE)
    ) INTO v_integrations;

    RETURN jsonb_build_object(
        'shop', jsonb_build_object(
            'id', v_shop.id,
            'name', v_shop.name,
            'slug', v_shop.slug
        ),
        'staff', jsonb_build_object(
            'id', v_staff.id,
            'name', v_staff.name,
            'role', v_staff.role
        ),
        'rooms', v_rooms,
        'bookings', v_bookings,
        'dailyReports', v_reports,
        'integrations', v_integrations,
        'entitlement', v_entitlement
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION get_owner_manager_dashboard_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_owner_manager_dashboard_summary() TO authenticated;

