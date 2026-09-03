-- PawSpace Phase 13 remediation: update bootstrap_shop to use canonical 'trialing'.
-- Phase 3 bootstrap_shop inserted subscription_status='trial', which violates the
-- Phase 13 canonical constraint. This forward migration replaces the function with
-- an identical body except the INSERT uses 'trialing'.
-- Phase 3 migration is NOT rewritten; this migration takes precedence.

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

    -- Create Shop with canonical trialing status (Phase 3 used legacy 'trial').
    INSERT INTO shops (name, slug, phone, line_oa_id, subscription_status)
    VALUES (trim(p_name), trim(p_slug), nullif(trim(p_phone), ''), nullif(trim(p_line_oa_id), ''), 'trialing')
    RETURNING id INTO v_shop_id;

    -- Create Staff User as active Owner
    INSERT INTO staff_users (id, shop_id, email, name, role, is_active)
    VALUES (v_caller_id, v_shop_id, v_caller_email, v_caller_name, 'owner', TRUE);

    RETURN v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION bootstrap_shop(VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bootstrap_shop(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated, service_role;
