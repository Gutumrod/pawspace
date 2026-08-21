-- PawSpace V1 Phase 7 — verified Google Sheet binding + authoritative sync worker lifecycle
-- Source of truth: docs/PRD.md + docs/SYSTEM_ARCHITECTURE.md

CREATE OR REPLACE FUNCTION generate_google_sheet_claim_token()
RETURNS TEXT AS $$
DECLARE
    v_shop_id UUID;
    v_token TEXT;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Owner or manager role required.';
    END IF;

    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    UPDATE shops
    SET google_sheet_claim_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
        google_sheet_claim_expires_at = now() + interval '15 minutes'
    WHERE id = v_shop_id;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION generate_google_sheet_claim_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_google_sheet_claim_token() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION connect_google_sheet_internal(
    p_token TEXT,
    p_google_sheet_id VARCHAR,
    p_expected_shop_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_hash TEXT;
    v_shop_id UUID;
    v_expires TIMESTAMPTZ;
    v_pet_id UUID;
    v_booking_id UUID;
BEGIN
    IF p_token IS NULL OR p_google_sheet_id IS NULL OR btrim(p_google_sheet_id) = '' OR p_expected_shop_id IS NULL THEN
        RAISE EXCEPTION 'Invalid Google Sheet binding input.';
    END IF;

    v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
    SELECT id, google_sheet_claim_expires_at
    INTO v_shop_id, v_expires
    FROM shops
    WHERE id = p_expected_shop_id
      AND google_sheet_claim_token_hash = v_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or cross-tenant Google Sheet claim.';
    END IF;
    IF v_expires IS NULL OR v_expires < now() THEN
        RAISE EXCEPTION 'Google Sheet claim expired.';
    END IF;

    UPDATE shops
    SET google_sheet_id = btrim(p_google_sheet_id),
        google_sheet_claim_token_hash = NULL,
        google_sheet_claim_expires_at = NULL
    WHERE id = v_shop_id;

    DELETE FROM google_sync_mappings WHERE shop_id = v_shop_id;

    FOR v_pet_id IN SELECT id FROM pets WHERE shop_id = v_shop_id ORDER BY id LOOP
        PERFORM enqueue_sync_event(v_shop_id, 'pet_customer', v_pet_id, 'UPSERT', jsonb_build_object('pet_id', v_pet_id));
    END LOOP;
    FOR v_booking_id IN SELECT id FROM bookings WHERE shop_id = v_shop_id ORDER BY id LOOP
        PERFORM enqueue_sync_event(v_shop_id, 'booking', v_booking_id, 'UPSERT', jsonb_build_object('booking_id', v_booking_id));
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION connect_google_sheet_internal(TEXT, VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION connect_google_sheet_internal(TEXT, VARCHAR, UUID) TO service_role;

CREATE OR REPLACE FUNCTION disconnect_google_sheet()
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Owner or manager role required.';
    END IF;

    UPDATE shops
    SET google_sheet_id = NULL,
        google_sheet_claim_token_hash = NULL,
        google_sheet_claim_expires_at = NULL
    WHERE id = v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION disconnect_google_sheet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION disconnect_google_sheet() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION claim_google_sync_event_internal()
RETURNS TABLE (
    event_id UUID,
    shop_id UUID,
    entity_type VARCHAR,
    entity_id UUID,
    queued_operation VARCHAR,
    google_sheet_id VARCHAR,
    attempts INT
) AS $$
BEGIN
    -- Recover worker crashes without losing the event. The next claim increments attempts again.
    UPDATE sync_queue
    SET status = 'failed',
        processing_started_at = NULL,
        next_attempt_at = now(),
        last_error = left(COALESCE(NULLIF(last_error, ''), 'Recovered stale Google sync processing lease.'), 500)
    WHERE status = 'processing'
      AND processing_started_at < now() - interval '10 minutes';

    RETURN QUERY
    WITH candidate AS (
        SELECT q.id
        FROM sync_queue q
        JOIN shops s ON s.id = q.shop_id
        WHERE q.status IN ('pending', 'failed')
          AND q.next_attempt_at <= now()
          AND s.google_sheet_id IS NOT NULL
        ORDER BY q.next_attempt_at, q.created_at, q.id
        FOR UPDATE OF q SKIP LOCKED
        LIMIT 1
    ), claimed AS (
        UPDATE sync_queue q
        SET status = 'processing',
            processing_started_at = now(),
            last_attempt_at = now(),
            attempts = q.attempts + 1
        FROM candidate c
        WHERE q.id = c.id
        RETURNING q.*
    )
    SELECT c.id, c.shop_id, c.entity_type, c.entity_id, c.operation,
           s.google_sheet_id, c.attempts
    FROM claimed c
    JOIN shops s ON s.id = c.shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION claim_google_sync_event_internal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_google_sync_event_internal() TO service_role;

CREATE OR REPLACE FUNCTION mark_google_sync_completed_internal(
    p_event_id UUID,
    p_effective_operation VARCHAR,
    p_sheet_name VARCHAR,
    p_synced_hash TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_event sync_queue%ROWTYPE;
    v_expected_sheet VARCHAR;
BEGIN
    SELECT * INTO v_event
    FROM sync_queue
    WHERE id = p_event_id AND status = 'processing'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Google sync completion rejected.';
    END IF;
    IF p_effective_operation NOT IN ('UPSERT', 'DELETE') THEN
        RAISE EXCEPTION 'Invalid effective Google sync operation.';
    END IF;

    v_expected_sheet := CASE v_event.entity_type
        WHEN 'pet_customer' THEN 'Customers'
        WHEN 'booking' THEN 'Bookings'
        ELSE NULL
    END;
    IF v_expected_sheet IS NULL OR p_sheet_name IS DISTINCT FROM v_expected_sheet THEN
        RAISE EXCEPTION 'Google sync sheet mismatch.';
    END IF;

    IF p_effective_operation = 'UPSERT' THEN
        IF p_synced_hash IS NULL OR btrim(p_synced_hash) = '' THEN
            RAISE EXCEPTION 'Synced hash is required for UPSERT completion.';
        END IF;
        INSERT INTO google_sync_mappings (shop_id, entity_type, entity_id, sheet_name, synced_hash, last_synced_at)
        VALUES (v_event.shop_id, v_event.entity_type, v_event.entity_id, p_sheet_name, p_synced_hash, now())
        ON CONFLICT (shop_id, entity_type, entity_id)
        DO UPDATE SET sheet_name = EXCLUDED.sheet_name,
                      synced_hash = EXCLUDED.synced_hash,
                      last_synced_at = now();
    ELSE
        DELETE FROM google_sync_mappings
        WHERE shop_id = v_event.shop_id
          AND entity_type = v_event.entity_type
          AND entity_id = v_event.entity_id;
    END IF;

    UPDATE sync_queue
    SET status = 'completed',
        processing_started_at = NULL,
        last_error = NULL
    WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION mark_google_sync_completed_internal(UUID, VARCHAR, VARCHAR, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_google_sync_completed_internal(UUID, VARCHAR, VARCHAR, TEXT)
    TO service_role;

CREATE OR REPLACE FUNCTION mark_google_sync_failed_internal(
    p_event_id UUID,
    p_error_message TEXT
)
RETURNS VOID AS $$
DECLARE
    v_attempts INT;
    v_delay_seconds INT;
BEGIN
    SELECT attempts INTO v_attempts
    FROM sync_queue
    WHERE id = p_event_id AND status = 'processing'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Google sync failure transition rejected.';
    END IF;

    v_delay_seconds := LEAST(
        3600,
        (30 * power(2, LEAST(GREATEST(v_attempts - 1, 0), 7)))::INT
    );

    UPDATE sync_queue
    SET status = 'failed',
        processing_started_at = NULL,
        last_error = left(COALESCE(NULLIF(btrim(p_error_message), ''), 'Google Sheets sync failed.'), 500),
        next_attempt_at = now() + make_interval(secs => v_delay_seconds)
    WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION mark_google_sync_failed_internal(UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_google_sync_failed_internal(UUID, TEXT)
    TO service_role;

-- Browser table mutation remains forbidden. Phase 2 grants only tenant-scoped SELECT.
-- Internal worker RPCs above are service-role only and keep sync_queue/google_sync_mappings authoritative.
