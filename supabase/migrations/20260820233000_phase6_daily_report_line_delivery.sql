-- PawSpace V1 Phase 6 — Daily Report media bucket + authoritative LINE worker lifecycle
-- Source of truth: docs/PRD.md + docs/SYSTEM_ARCHITECTURE.md

ALTER TABLE daily_reports
    ADD COLUMN IF NOT EXISTS line_first_attempt_at TIMESTAMPTZ;

COMMENT ON COLUMN daily_reports.line_first_attempt_at IS
    'First request attempt sent to LINE; used to enforce LINE retry-key 24h safety window.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'daily-report-photos',
    'daily-report-photos',
    TRUE,
    10485760,
    ARRAY[
        'image/jpeg','image/png','image/webp','image/gif',
        'image/avif','image/heic','image/heif','image/tiff','image/bmp'
    ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
CREATE OR REPLACE FUNCTION claim_line_delivery_internal()
RETURNS TABLE (
    report_id UUID,
    shop_id UUID,
    retry_key UUID,
    first_attempt_at TIMESTAMPTZ,
    recipient_line_user_id VARCHAR,
    pet_name VARCHAR,
    owner_name TEXT,
    food_status VARCHAR,
    excretion_status VARCHAR,
    mood_status VARCHAR,
    photo_urls TEXT[],
    staff_notes TEXT
) AS $$
BEGIN
    -- Once LINE has seen a retry key, reusing it after 24h can duplicate a message.
    UPDATE daily_reports
    SET line_delivery_status = 'failed',
        line_delivery_started_at = NULL,
        line_error_message = 'LINE retry safety window expired; operator review required.'
    WHERE line_delivery_status IN ('pending', 'sending')
      AND line_first_attempt_at IS NOT NULL
      AND line_first_attempt_at <= now() - interval '24 hours';
    RETURN QUERY
    WITH candidate AS (
        SELECT dr.id
        FROM daily_reports dr
        WHERE (
            dr.line_delivery_status = 'pending'
            OR (
                dr.line_delivery_status = 'sending'
                AND dr.line_delivery_started_at < now() - interval '5 minutes'
            )
        )
          AND (
              dr.line_first_attempt_at IS NULL
              OR dr.line_first_attempt_at > now() - interval '24 hours'
          )
        ORDER BY dr.created_at, dr.id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    ), claimed AS (
        UPDATE daily_reports dr
        SET line_delivery_status = 'sending',
            line_delivery_started_at = now(),
            line_first_attempt_at = COALESCE(dr.line_first_attempt_at, now())
        FROM candidate c
        WHERE dr.id = c.id
        RETURNING dr.*
    )
    SELECT
        c.id,
        c.shop_id,
        c.line_delivery_retry_key,
        c.line_first_attempt_at,
        po.line_user_id,
        p.name,
        concat_ws(' ', po.first_name, po.last_name),
        c.food_status,
        c.excretion_status,
        c.mood_status,
        c.photo_urls,
        c.staff_notes
    FROM claimed c
    JOIN bookings b
      ON b.id = c.booking_id AND b.shop_id = c.shop_id
    JOIN pets p
      ON p.id = c.pet_id AND p.shop_id = c.shop_id
    JOIN pet_owners po
      ON po.id = p.owner_id AND po.shop_id = c.shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION claim_line_delivery_internal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_line_delivery_internal() TO service_role;
CREATE OR REPLACE FUNCTION mark_line_delivery_sent_internal(
    p_report_id UUID,
    p_retry_key UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE daily_reports
    SET line_delivery_status = 'sent',
        line_sent_at = now(),
        line_error_message = NULL
    WHERE id = p_report_id
      AND line_delivery_retry_key = p_retry_key
      AND line_delivery_status = 'sending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LINE delivery completion rejected.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION mark_line_delivery_sent_internal(UUID, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_line_delivery_sent_internal(UUID, UUID) TO service_role;
CREATE OR REPLACE FUNCTION mark_line_delivery_failed_internal(
    p_report_id UUID,
    p_retry_key UUID,
    p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE daily_reports
    SET line_delivery_status = 'failed',
        line_delivery_started_at = NULL,
        line_error_message = left(COALESCE(NULLIF(btrim(p_error_message), ''), 'LINE delivery failed.'), 500),
        line_retry_count = line_retry_count + 1
    WHERE id = p_report_id
      AND line_delivery_retry_key = p_retry_key
      AND line_delivery_status = 'sending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LINE delivery failure transition rejected.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION mark_line_delivery_failed_internal(UUID, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_line_delivery_failed_internal(UUID, UUID, TEXT) TO service_role;
