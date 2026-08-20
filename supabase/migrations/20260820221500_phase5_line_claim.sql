-- PawSpace V1 Phase 5 - LINE LIFF identity claim
-- Adds the LINE claim gateways documented in SYSTEM_ARCHITECTURE.md.
-- Existing Phase 1-4 migrations remain immutable.

CREATE OR REPLACE FUNCTION generate_line_claim_token(p_owner_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_shop_id UUID;
    v_token TEXT;
    v_line_user_id VARCHAR;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT line_user_id INTO v_line_user_id
    FROM pet_owners
    WHERE id = p_owner_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pet owner not found.';
    END IF;
    IF v_line_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'Already linked; reset first.';
    END IF;
    v_token := encode(extensions.gen_random_bytes(32), 'hex');

    UPDATE pet_owners
    SET line_claim_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
        line_claim_expires_at = now() + interval '48 hours',
        line_claim_used_at = NULL
    WHERE id = p_owner_id AND shop_id = v_shop_id;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION generate_line_claim_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_line_claim_token(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION reset_line_link(p_owner_id UUID)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only owner or manager can reset LINE links.';
    END IF;

    PERFORM 1 FROM pet_owners
    WHERE id = p_owner_id AND shop_id = v_shop_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pet owner not found.';
    END IF;

    UPDATE pet_owners
    SET line_user_id = NULL,
        line_claim_token_hash = NULL,
        line_claim_expires_at = NULL,
        line_claim_used_at = NULL
    WHERE id = p_owner_id AND shop_id = v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION reset_line_link(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_line_link(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION consume_line_claim_token_internal(
    p_token TEXT,
    p_verified_line_user_id VARCHAR,
    p_expected_shop_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_hash TEXT;
    v_owner_id UUID;
    v_expires TIMESTAMPTZ;
    v_used TIMESTAMPTZ;
BEGIN
    IF p_token IS NULL OR btrim(p_token) = ''
       OR p_verified_line_user_id IS NULL OR btrim(p_verified_line_user_id) = ''
       OR p_expected_shop_id IS NULL THEN
        RAISE EXCEPTION 'Invalid claim input.';
    END IF;

    v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

    SELECT id, line_claim_expires_at, line_claim_used_at
    INTO v_owner_id, v_expires, v_used
    FROM pet_owners
    WHERE shop_id = p_expected_shop_id
      AND line_claim_token_hash = v_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or cross-tenant claim token.';
    END IF;
    IF v_used IS NOT NULL THEN
        RAISE EXCEPTION 'Claim token already used.';
    END IF;
    IF v_expires IS NULL OR v_expires < now() THEN
        RAISE EXCEPTION 'Claim token expired.';
    END IF;

    UPDATE pet_owners
    SET line_user_id = btrim(p_verified_line_user_id),
        line_claim_used_at = now()
    WHERE id = v_owner_id
      AND shop_id = p_expected_shop_id
      AND line_claim_used_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim token already consumed.';
    END IF;

    RETURN v_owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION consume_line_claim_token_internal(TEXT, VARCHAR, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_line_claim_token_internal(TEXT, VARCHAR, UUID)
    TO service_role;
