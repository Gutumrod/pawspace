-- PawSpace V1 Phase 8 — bounded public camera access for one LifeCam feed per tenant
-- Security contract: authenticated staff creates the active visitor code; public verification is trusted-server only.
-- Raw visitor codes, requester IPs, cookies, Authorization values, and signing secrets are never persisted here.

CREATE TABLE camera_settings (
    shop_id UUID PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL DEFAULT 'Microsoft LifeCam',
    feed_url TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT camera_settings_device_name_check CHECK (device_name = 'Microsoft LifeCam'),
    CONSTRAINT camera_settings_feed_url_check CHECK (
        feed_url IS NULL OR (
            feed_url ~ '^https://'
            AND feed_url !~ '[?#]'
            AND feed_url !~ '^https://[^/]*@'
        )
    )
);

CREATE TABLE camera_visitor_credentials (
    shop_id UUID PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    credential_version BIGINT NOT NULL DEFAULT 1 CHECK (credential_version > 0),
    rotated_by UUID NOT NULL,
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE camera_rate_limit_buckets (
    bucket_kind VARCHAR(32) NOT NULL CHECK (bucket_kind IN ('scope', 'requester_ip')),
    bucket_hash VARCHAR(64) NOT NULL CHECK (bucket_hash ~ '^[0-9a-f]{64}$'),
    window_start TIMESTAMPTZ NOT NULL,
    failure_count INT NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    last_failure_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bucket_kind, bucket_hash, window_start)
);

CREATE TABLE camera_access_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    event_type VARCHAR(40) NOT NULL CHECK (
        event_type IN ('access_granted', 'invalid_code', 'rate_limited', 'session_feed_granted', 'session_feed_denied')
    ),
    scope_hash VARCHAR(64) CHECK (scope_hash IS NULL OR scope_hash ~ '^[0-9a-f]{64}$'),
    requester_ip_hash VARCHAR(64) CHECK (requester_ip_hash IS NULL OR requester_ip_hash ~ '^[0-9a-f]{64}$'),
    credential_version BIGINT,
    session_id_hash VARCHAR(64) CHECK (session_id_hash IS NULL OR session_id_hash ~ '^[0-9a-f]{64}$'),
    reason_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_camera_access_audit_shop_created
    ON camera_access_audit (shop_id, created_at DESC);
CREATE INDEX idx_camera_rate_limit_lookup
    ON camera_rate_limit_buckets (bucket_kind, bucket_hash, window_start DESC);

ALTER TABLE camera_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_visitor_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_access_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON camera_settings, camera_visitor_credentials, camera_rate_limit_buckets, camera_access_audit
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON camera_settings, camera_visitor_credentials, camera_rate_limit_buckets TO service_role;
GRANT SELECT, INSERT ON camera_access_audit TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON camera_access_audit FROM service_role;

CREATE OR REPLACE FUNCTION prevent_camera_access_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'camera_access_audit is append-only.';
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION prevent_camera_access_audit_mutation() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_camera_access_audit_no_update_delete
BEFORE UPDATE OR DELETE ON camera_access_audit
FOR EACH ROW EXECUTE FUNCTION prevent_camera_access_audit_mutation();

CREATE TRIGGER trg_camera_access_audit_no_truncate
BEFORE TRUNCATE ON camera_access_audit
FOR EACH STATEMENT EXECUTE FUNCTION prevent_camera_access_audit_mutation();

CREATE OR REPLACE FUNCTION camera_rate_window_start(p_now TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
    SELECT to_timestamp(floor(extract(epoch FROM p_now) / 600.0) * 600.0);
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION camera_rate_window_start(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION camera_rate_window_start(TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION rotate_camera_visitor_code()
RETURNS JSONB AS $$
DECLARE
    v_shop_id UUID;
    v_actor_id UUID;
    v_code TEXT;
    v_code_hash TEXT;
    v_version BIGINT;
BEGIN
    v_shop_id := current_staff_shop_id();
    v_actor_id := auth.uid();
    IF v_shop_id IS NULL OR v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: active staff session required.';
    END IF;

    v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
    v_code_hash := encode(
        extensions.digest(v_shop_id::text || ':' || v_code, 'sha256'),
        'hex'
    );

    INSERT INTO camera_visitor_credentials (shop_id, code_hash, credential_version, rotated_by, rotated_at)
    VALUES (v_shop_id, v_code_hash, 1, v_actor_id, now())
    ON CONFLICT (shop_id)
    DO UPDATE SET
        code_hash = EXCLUDED.code_hash,
        credential_version = camera_visitor_credentials.credential_version + 1,
        rotated_by = EXCLUDED.rotated_by,
        rotated_at = now()
    RETURNING credential_version INTO v_version;

    RETURN jsonb_build_object(
        'visitor_code', v_code,
        'credential_version', v_version
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION rotate_camera_visitor_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rotate_camera_visitor_code() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION set_camera_feed_config(
    p_feed_url TEXT,
    p_enabled BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_actor_id UUID;
    v_url TEXT;
BEGIN
    v_shop_id := current_staff_shop_id();
    v_actor_id := auth.uid();
    IF v_shop_id IS NULL OR v_actor_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Owner or manager role required.';
    END IF;

    v_url := nullif(btrim(p_feed_url), '');
    IF p_enabled AND (
        v_url IS NULL
        OR v_url !~ '^https://'
        OR v_url ~ '[?#]'
        OR v_url ~ '^https://[^/]*@'
    ) THEN
        RAISE EXCEPTION 'Camera feed URL must be secret-free HTTPS without query, fragment, or userinfo.';
    END IF;

    INSERT INTO camera_settings (shop_id, device_name, feed_url, is_enabled, updated_by, updated_at)
    VALUES (v_shop_id, 'Microsoft LifeCam', v_url, p_enabled, v_actor_id, now())
    ON CONFLICT (shop_id)
    DO UPDATE SET
        device_name = 'Microsoft LifeCam',
        feed_url = EXCLUDED.feed_url,
        is_enabled = EXCLUDED.is_enabled,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION set_camera_feed_config(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_camera_feed_config(TEXT, BOOLEAN) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION get_camera_staff_settings()
RETURNS JSONB AS $$
DECLARE
    v_shop_id UUID;
    v_result JSONB;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: active staff session required.';
    END IF;

    SELECT jsonb_build_object(
        'shop_id', v_shop_id,
        'device_name', COALESCE(cs.device_name, 'Microsoft LifeCam'),
        'feed_url', cs.feed_url,
        'is_enabled', COALESCE(cs.is_enabled, FALSE),
        'has_visitor_code', cvc.shop_id IS NOT NULL,
        'credential_version', cvc.credential_version,
        'rotated_at', cvc.rotated_at
    )
    INTO v_result
    FROM (SELECT 1) AS seed
    LEFT JOIN camera_settings cs ON cs.shop_id = v_shop_id
    LEFT JOIN camera_visitor_credentials cvc ON cvc.shop_id = v_shop_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION get_camera_staff_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_camera_staff_settings() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION verify_camera_visitor_code_internal(
    p_shop_id UUID,
    p_code_hash VARCHAR,
    p_requester_ip_hash VARCHAR
)
RETURNS JSONB AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_scope_hash VARCHAR(64);
    v_scope_failures INT := 0;
    v_ip_failures INT := 0;
    v_credential camera_visitor_credentials%ROWTYPE;
BEGIN
    IF p_shop_id IS NULL
       OR p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$'
       OR p_requester_ip_hash IS NULL OR p_requester_ip_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid camera access verification input.';
    END IF;

    v_scope_hash := encode(
        extensions.digest('camera-scope:' || p_shop_id::text, 'sha256'),
        'hex'
    );

    -- Stable per-tenant scope + requester-IP locks make failure counting atomic across workers.
    PERFORM pg_advisory_xact_lock(hashtextextended('camera:scope:' || v_scope_hash, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended('camera:ip:' || p_requester_ip_hash, 0));

    PERFORM 1 FROM shops WHERE id = p_shop_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'INVALID_CODE');
    END IF;

    v_window_start := camera_rate_window_start(now());

    SELECT failure_count INTO v_scope_failures
    FROM camera_rate_limit_buckets
    WHERE bucket_kind = 'scope'
      AND bucket_hash = v_scope_hash
      AND window_start = v_window_start;
    v_scope_failures := COALESCE(v_scope_failures, 0);

    SELECT failure_count INTO v_ip_failures
    FROM camera_rate_limit_buckets
    WHERE bucket_kind = 'requester_ip'
      AND bucket_hash = p_requester_ip_hash
      AND window_start = v_window_start;
    v_ip_failures := COALESCE(v_ip_failures, 0);

    IF v_scope_failures >= 5 OR v_ip_failures >= 5 THEN
        INSERT INTO camera_access_audit (
            shop_id, event_type, scope_hash, requester_ip_hash, reason_code
        ) VALUES (
            p_shop_id, 'rate_limited', v_scope_hash, p_requester_ip_hash,
            CASE WHEN v_scope_failures >= 5 THEN 'SCOPE_LIMIT' ELSE 'REQUESTER_IP_LIMIT' END
        );
        RETURN jsonb_build_object('result', 'RATE_LIMITED');
    END IF;

    SELECT * INTO v_credential
    FROM camera_visitor_credentials
    WHERE shop_id = p_shop_id;

    IF NOT FOUND OR v_credential.code_hash IS DISTINCT FROM p_code_hash THEN
        INSERT INTO camera_rate_limit_buckets (bucket_kind, bucket_hash, window_start, failure_count, last_failure_at)
        VALUES ('scope', v_scope_hash, v_window_start, 1, now())
        ON CONFLICT (bucket_kind, bucket_hash, window_start)
        DO UPDATE SET failure_count = camera_rate_limit_buckets.failure_count + 1,
                      last_failure_at = now();

        INSERT INTO camera_rate_limit_buckets (bucket_kind, bucket_hash, window_start, failure_count, last_failure_at)
        VALUES ('requester_ip', p_requester_ip_hash, v_window_start, 1, now())
        ON CONFLICT (bucket_kind, bucket_hash, window_start)
        DO UPDATE SET failure_count = camera_rate_limit_buckets.failure_count + 1,
                      last_failure_at = now();

        INSERT INTO camera_access_audit (
            shop_id, event_type, scope_hash, requester_ip_hash, reason_code
        ) VALUES (
            p_shop_id, 'invalid_code', v_scope_hash, p_requester_ip_hash, 'CODE_MISMATCH'
        );
        RETURN jsonb_build_object('result', 'INVALID_CODE');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM camera_settings
        WHERE shop_id = p_shop_id AND is_enabled = TRUE AND feed_url IS NOT NULL
    ) THEN
        INSERT INTO camera_access_audit (
            shop_id, event_type, scope_hash, requester_ip_hash,
            credential_version, reason_code
        ) VALUES (
            p_shop_id, 'session_feed_denied', v_scope_hash, p_requester_ip_hash,
            v_credential.credential_version, 'CAMERA_DISABLED'
        );
        RETURN jsonb_build_object('result', 'CAMERA_UNAVAILABLE');
    END IF;

    INSERT INTO camera_access_audit (
        shop_id, event_type, scope_hash, requester_ip_hash,
        credential_version, reason_code
    ) VALUES (
        p_shop_id, 'access_granted', v_scope_hash, p_requester_ip_hash,
        v_credential.credential_version, 'CODE_VERIFIED'
    );

    RETURN jsonb_build_object(
        'result', 'GRANTED',
        'credential_version', v_credential.credential_version
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION verify_camera_visitor_code_internal(UUID, VARCHAR, VARCHAR)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_camera_visitor_code_internal(UUID, VARCHAR, VARCHAR)
    TO service_role;

CREATE OR REPLACE FUNCTION get_camera_feed_internal(
    p_shop_id UUID,
    p_credential_version BIGINT,
    p_session_id_hash VARCHAR,
    p_requester_ip_hash VARCHAR
)
RETURNS JSONB AS $$
DECLARE
    v_feed_url TEXT;
    v_current_version BIGINT;
BEGIN
    IF p_shop_id IS NULL OR p_credential_version IS NULL
       OR p_session_id_hash IS NULL OR p_session_id_hash !~ '^[0-9a-f]{64}$'
       OR p_requester_ip_hash IS NULL OR p_requester_ip_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid camera session input.';
    END IF;

    SELECT cvc.credential_version, cs.feed_url
    INTO v_current_version, v_feed_url
    FROM camera_visitor_credentials cvc
    JOIN camera_settings cs ON cs.shop_id = cvc.shop_id
    WHERE cvc.shop_id = p_shop_id
      AND cs.is_enabled = TRUE
      AND cs.feed_url IS NOT NULL;

    IF NOT FOUND OR v_current_version IS DISTINCT FROM p_credential_version THEN
        INSERT INTO camera_access_audit (
            shop_id, event_type, requester_ip_hash, credential_version,
            session_id_hash, reason_code
        ) VALUES (
            p_shop_id, 'session_feed_denied', p_requester_ip_hash, p_credential_version,
            p_session_id_hash, 'SESSION_STALE_OR_CAMERA_DISABLED'
        );
        RETURN jsonb_build_object('result', 'DENIED');
    END IF;

    INSERT INTO camera_access_audit (
        shop_id, event_type, requester_ip_hash, credential_version,
        session_id_hash, reason_code
    ) VALUES (
        p_shop_id, 'session_feed_granted', p_requester_ip_hash, p_credential_version,
        p_session_id_hash, 'SESSION_VERIFIED'
    );

    RETURN jsonb_build_object(
        'result', 'GRANTED',
        'device_name', 'Microsoft LifeCam',
        'feed_url', v_feed_url
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION get_camera_feed_internal(UUID, BIGINT, VARCHAR, VARCHAR)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_camera_feed_internal(UUID, BIGINT, VARCHAR, VARCHAR)
    TO service_role;

-- Browser clients have no direct SELECT/INSERT/UPDATE/DELETE privileges on any camera table.
-- Public camera access is possible only through trusted server routes calling the service-role-only internal RPCs.
