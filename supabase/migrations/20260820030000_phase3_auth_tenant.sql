-- PawSpace V1 Phase 3 - Auth + Tenant Context Gateway and Invariant Enforcement
-- Source of truth: docs/PRD.md + docs/SYSTEM_ARCHITECTURE.md + BRIEF-phase3-auth-tenant-context-2026-08-20.md

-- 1. Last-Active-Owner Invariant Trigger & Function
CREATE OR REPLACE FUNCTION enforce_last_active_owner()
RETURNS TRIGGER AS $$
DECLARE
    v_shop_id UUID;
    v_active_owners INT;
BEGIN
    v_shop_id := OLD.shop_id;

    -- Only check when an active owner is being deactivated, demoted, moved to another shop, or deleted
    IF (TG_OP = 'DELETE' AND OLD.role = 'owner' AND OLD.is_active = TRUE)
       OR (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND OLD.is_active = TRUE
           AND (NEW.role != 'owner' OR NEW.is_active = FALSE OR NEW.shop_id != OLD.shop_id)) THEN

        -- If the shop itself was deleted in this transaction (e.g. CASCADE delete from shops), skip check
        IF NOT EXISTS (SELECT 1 FROM shops WHERE id = v_shop_id) THEN
            RETURN NULL;
        END IF;

        -- Acquire exclusive transaction-level lock for this shop to serialize concurrent owner changes
        PERFORM pg_advisory_xact_lock(hashtext('staff_users_owner_lock_' || v_shop_id::text));

        SELECT COUNT(*) INTO v_active_owners
        FROM staff_users
        WHERE shop_id = v_shop_id AND role = 'owner' AND is_active = TRUE;

        IF v_active_owners < 1 THEN
            RAISE EXCEPTION 'Last Active Owner Invariant Violation: Shop % must have at least one active owner.', v_shop_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION enforce_last_active_owner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_enforce_last_active_owner
AFTER UPDATE OR DELETE ON staff_users
FOR EACH ROW EXECUTE FUNCTION enforce_last_active_owner();

-- 2. Tenant Context Helper Function
CREATE OR REPLACE FUNCTION get_current_staff_context()
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID;
    v_context JSONB;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_build_object(
        'user_id', u.id,
        'shop_id', su.shop_id,
        'email', su.email,
        'name', su.name,
        'role', su.role,
        'is_active', su.is_active,
        'shop_name', s.name,
        'shop_slug', s.slug,
        'subscription_status', s.subscription_status
    )
    INTO v_context
    FROM staff_users su
    JOIN shops s ON s.id = su.shop_id
    JOIN auth.users u ON u.id = su.id
    WHERE su.id = v_caller_id AND su.is_active = TRUE;

    RETURN v_context;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION get_current_staff_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_staff_context() TO authenticated, service_role;

-- 3. Tenant Bootstrap Gateway
CREATE OR REPLACE FUNCTION bootstrap_shop(
    p_name VARCHAR,
    p_slug VARCHAR,
    p_phone VARCHAR DEFAULT NULL,
    p_line_oa_id VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_caller_id UUID;
    v_caller_email VARCHAR;
    v_caller_name VARCHAR;
    v_shop_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not authenticated.';
    END IF;

    -- V1 Invariant: 1 Auth user = 1 Shop membership
    IF EXISTS (SELECT 1 FROM staff_users WHERE id = v_caller_id) THEN
        RAISE EXCEPTION 'Bootstrap Rejected: Caller already belongs to a shop.';
    END IF;

    IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
        RAISE EXCEPTION 'Invalid Parameter: Shop name cannot be empty.';
    END IF;

    IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
        RAISE EXCEPTION 'Invalid Parameter: Shop slug cannot be empty.';
    END IF;

    -- Look up caller details from auth.users / JWT claim
    SELECT email, COALESCE(raw_user_meta_data ->> 'name', email, 'Owner')
    INTO v_caller_email, v_caller_name
    FROM auth.users
    WHERE id = v_caller_id;

    IF v_caller_email IS NULL THEN
        v_caller_email := COALESCE(
            nullif(current_setting('request.jwt.claim.email', true), ''),
            'owner@' || trim(p_slug)
        );
        v_caller_name := COALESCE(
            nullif(current_setting('request.jwt.claim.name', true), ''),
            v_caller_email,
            'Owner'
        );
    END IF;

    -- Create Shop
    INSERT INTO shops (name, slug, phone, line_oa_id, subscription_status)
    VALUES (trim(p_name), trim(p_slug), nullif(trim(p_phone), ''), nullif(trim(p_line_oa_id), ''), 'trial')
    RETURNING id INTO v_shop_id;

    -- Create Staff User as active Owner
    INSERT INTO staff_users (id, shop_id, email, name, role, is_active)
    VALUES (v_caller_id, v_shop_id, v_caller_email, v_caller_name, 'owner', TRUE);

    RETURN v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION bootstrap_shop(VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bootstrap_shop(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated, service_role;

-- 4. Authoritative Staff Management Gateways (Owner-only)
CREATE OR REPLACE FUNCTION create_staff_membership(
    p_user_id UUID,
    p_email VARCHAR,
    p_name VARCHAR,
    p_role VARCHAR
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only an active shop owner can add staff members.';
    END IF;

    IF p_role NOT IN ('owner', 'manager', 'staff') THEN
        RAISE EXCEPTION 'Invalid role: % (must be owner, manager, or staff).', p_role;
    END IF;

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid user ID: user_id cannot be null.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'Auth User % not found.', p_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM staff_users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User % already has a staff membership.', p_user_id;
    END IF;

    INSERT INTO staff_users (id, shop_id, email, name, role, is_active)
    VALUES (p_user_id, v_shop_id, trim(p_email), trim(p_name), p_role, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION create_staff_membership(UUID, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_staff_membership(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION disable_staff(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_target_active BOOLEAN;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only an active shop owner can disable staff.';
    END IF;

    SELECT is_active INTO v_target_active
    FROM staff_users
    WHERE id = p_user_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target staff member % not found in current shop.', p_user_id;
    END IF;

    IF NOT v_target_active THEN
        -- Already disabled, no-op
        RETURN;
    END IF;

    UPDATE staff_users
    SET is_active = FALSE, disabled_at = now()
    WHERE id = p_user_id AND shop_id = v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION disable_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION disable_staff(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION enable_staff(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_target_active BOOLEAN;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only an active shop owner can enable staff.';
    END IF;

    SELECT is_active INTO v_target_active
    FROM staff_users
    WHERE id = p_user_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target staff member % not found in current shop.', p_user_id;
    END IF;

    IF v_target_active THEN
        -- Already active, no-op
        RETURN;
    END IF;

    UPDATE staff_users
    SET is_active = TRUE, disabled_at = NULL
    WHERE id = p_user_id AND shop_id = v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION enable_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enable_staff(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION change_staff_role(
    p_user_id UUID,
    p_new_role VARCHAR
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only an active shop owner can change staff roles.';
    END IF;

    IF p_new_role NOT IN ('owner', 'manager', 'staff') THEN
        RAISE EXCEPTION 'Invalid role: % (must be owner, manager, or staff).', p_new_role;
    END IF;

    PERFORM 1
    FROM staff_users
    WHERE id = p_user_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target staff member % not found in current shop.', p_user_id;
    END IF;

    UPDATE staff_users
    SET role = p_new_role
    WHERE id = p_user_id AND shop_id = v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION change_staff_role(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION change_staff_role(UUID, VARCHAR) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION remove_staff(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only an active shop owner can remove staff.';
    END IF;

    PERFORM 1
    FROM staff_users
    WHERE id = p_user_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target staff member % not found in current shop.', p_user_id;
    END IF;

    DELETE FROM staff_users
    WHERE id = p_user_id AND shop_id = v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION remove_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_staff(UUID) TO authenticated, service_role;
