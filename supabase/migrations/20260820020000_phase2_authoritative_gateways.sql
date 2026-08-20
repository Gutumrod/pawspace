-- PawSpace V1 Phase 2 - Authoritative mutation gateways, constraints, and RLS
-- Source of truth: docs/PRD.md + docs/SYSTEM_ARCHITECTURE.md
-- Phase scope excludes Auth bootstrap/staff admin, LINE claim, worker transports, and Google binding.

CREATE OR REPLACE FUNCTION pawspace_business_date()
RETURNS DATE AS $$
    SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date;
$$ LANGUAGE sql STABLE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION pawspace_business_date() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pawspace_business_date() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION current_staff_shop_id()
RETURNS UUID AS $$
    SELECT shop_id
    FROM staff_users
    WHERE id = auth.uid() AND is_active = TRUE;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION current_staff_shop_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_staff_shop_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION is_shop_owner()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_users
        WHERE id = auth.uid() AND is_active = TRUE AND role = 'owner'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION is_shop_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_shop_owner() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION is_shop_manager_or_owner()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_users
        WHERE id = auth.uid() AND is_active = TRUE AND role IN ('owner', 'manager')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION is_shop_manager_or_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_shop_manager_or_owner() TO authenticated, service_role;

-- Internal transactional outbox helper. Never callable from Browser.
CREATE OR REPLACE FUNCTION enqueue_sync_event(
    p_shop_id UUID,
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_operation VARCHAR,
    p_payload JSONB
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO sync_queue (shop_id, entity_type, entity_id, operation, payload)
    VALUES (p_shop_id, p_entity_type, p_entity_id, p_operation, p_payload);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION enqueue_sync_event(UUID, VARCHAR, UUID, VARCHAR, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION enqueue_sync_event(UUID, VARCHAR, UUID, VARCHAR, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION create_booking(
    p_owner_id UUID,
    p_room_id UUID,
    p_check_in_date DATE,
    p_check_out_date DATE,
    p_total_amount NUMERIC(10,2) DEFAULT 0,
    p_special_requests TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_shop_id UUID;
    v_m_from DATE;
    v_m_until DATE;
    v_booking_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authenticated staff member.';
    END IF;

    IF p_check_out_date <= p_check_in_date THEN
        RAISE EXCEPTION 'Invalid Dates: check_out_date must be strictly after check_in_date.';
    END IF;

    IF p_total_amount < 0 THEN
        RAISE EXCEPTION 'Invalid Amount: total_amount must be >= 0.';
    END IF;

    -- Validate Owner belongs to shop
    IF NOT EXISTS (SELECT 1 FROM pet_owners WHERE id = p_owner_id AND shop_id = v_shop_id) THEN
        RAISE EXCEPTION 'Pet owner % not found for shop %.', p_owner_id, v_shop_id;
    END IF;

    -- Lock & Validate Room (Lock ordering: Room locked on creation)
    SELECT maintenance_from, maintenance_until
    INTO v_m_from, v_m_until
    FROM rooms
    WHERE id = p_room_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room % not found for shop %.', p_room_id, v_shop_id;
    END IF;

    -- Validate Maintenance Window
    IF v_m_from IS NOT NULL AND v_m_until IS NOT NULL THEN
        IF daterange(p_check_in_date, p_check_out_date, '[)') && daterange(v_m_from, v_m_until, '[]') THEN
            RAISE EXCEPTION 'Room Maintenance Violation: Room % is under maintenance from % to %.',
                p_room_id, v_m_from, v_m_until;
        END IF;
    END IF;

    -- Insert Booking (GiST constraint handles collision)
    INSERT INTO bookings (
        shop_id, owner_id, room_id, check_in_date, check_out_date,
        booking_status, total_amount, special_requests
    )
    VALUES (
        v_shop_id, p_owner_id, p_room_id, p_check_in_date, p_check_out_date,
        'confirmed', p_total_amount, p_special_requests
    )
    RETURNING id INTO v_booking_id;
    PERFORM enqueue_sync_event(v_shop_id,'booking',v_booking_id,'UPSERT',jsonb_build_object('booking_id',v_booking_id));

    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION create_booking(UUID, UUID, DATE, DATE, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_booking(UUID, UUID, DATE, DATE, NUMERIC, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION add_pet_to_booking(
    p_booking_id UUID,
    p_pet_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_booking_owner_id UUID;
    v_booking_status VARCHAR;
    v_room_id UUID;
    v_check_in DATE;
    v_check_out DATE;
    v_pet_owner_id UUID;
    v_capacity INT;
    v_current_count INT;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- DETERMINISTIC LOCK ORDERING: 1. Booking ➔ 2. Pet ➔ 3. Room
    -- 1. Lock Booking
    SELECT owner_id, booking_status, room_id, check_in_date, check_out_date
    INTO v_booking_owner_id, v_booking_status, v_room_id, v_check_in, v_check_out
    FROM bookings
    WHERE id = p_booking_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found.', p_booking_id;
    END IF;

    IF v_booking_status NOT IN ('confirmed', 'checked_in') THEN
        RAISE EXCEPTION 'Cannot add pet to booking in state %.', v_booking_status;
    END IF;

    -- 2. Lock Pet
    SELECT owner_id INTO v_pet_owner_id
    FROM pets
    WHERE id = p_pet_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pet % not found.', p_pet_id;
    END IF;

    -- 3. Lock Room
    SELECT capacity_pets
    INTO v_capacity
    FROM rooms
    WHERE id = v_room_id AND shop_id = v_shop_id
    FOR UPDATE;

    -- Strict Same-Owner Invariant (Decision 1A)
    IF v_pet_owner_id != v_booking_owner_id THEN
        RAISE EXCEPTION 'Ownership Violation: Pet % belongs to owner %, not booking owner %.',
            p_pet_id, v_pet_owner_id, v_booking_owner_id;
    END IF;

    -- Concurrency-Safe Pet No-Overlap Check (Decision 2A)
    IF EXISTS (
        SELECT 1
        FROM booking_pets bp
        JOIN bookings b ON b.id = bp.booking_id
        WHERE bp.pet_id = p_pet_id
          AND b.shop_id = v_shop_id
          AND b.id != p_booking_id
          AND b.booking_status IN ('confirmed', 'checked_in')
          AND daterange(b.check_in_date, b.check_out_date, '[)') && daterange(v_check_in, v_check_out, '[)')
    ) THEN
        RAISE EXCEPTION 'Pet Conflict: Pet % already has an active booking overlapping % to %.',
            p_pet_id, v_check_in, v_check_out;
    END IF;

    -- Capacity Check
    SELECT COUNT(*) INTO v_current_count
    FROM booking_pets
    WHERE booking_id = p_booking_id AND shop_id = v_shop_id;

    IF v_current_count >= v_capacity THEN
        RAISE EXCEPTION 'Capacity Exceeded: Room capacity of % reached for Booking %.',
            v_capacity, p_booking_id;
    END IF;

    INSERT INTO booking_pets (shop_id, booking_id, pet_id)
    VALUES (v_shop_id, p_booking_id, p_pet_id);
    PERFORM enqueue_sync_event(v_shop_id,'booking',p_booking_id,'UPSERT',jsonb_build_object('booking_id',p_booking_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION add_pet_to_booking(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_pet_to_booking(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION remove_pet_from_booking(
    p_booking_id UUID,
    p_pet_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_status VARCHAR;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- DETERMINISTIC LOCK ORDERING: 1. Booking ➔ 2. Pet
    SELECT booking_status INTO v_status
    FROM bookings
    WHERE id = p_booking_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found.', p_booking_id;
    END IF;

    IF v_status != 'confirmed' THEN
        RAISE EXCEPTION 'Cannot remove pet: Booking is currently % (only confirmed bookings allow pet removal).', v_status;
    END IF;

    PERFORM 1 FROM pets WHERE id = p_pet_id AND shop_id = v_shop_id FOR UPDATE;

    DELETE FROM booking_pets
    WHERE booking_id = p_booking_id AND pet_id = p_pet_id AND shop_id = v_shop_id;
    PERFORM enqueue_sync_event(v_shop_id,'booking',p_booking_id,'UPSERT',jsonb_build_object('booking_id',p_booking_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION remove_pet_from_booking(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_pet_from_booking(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION update_booking_status(
    p_booking_id UUID,
    p_new_status VARCHAR
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_current_status VARCHAR;
    v_room_id UUID;
    v_check_in DATE;
    v_room_status VARCHAR;
    v_m_from DATE;
    v_m_until DATE;
    v_pet_count INT;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 1. Lock Booking
    SELECT booking_status, room_id, check_in_date
    INTO v_current_status, v_room_id, v_check_in
    FROM bookings
    WHERE id = p_booking_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found.', p_booking_id;
    END IF;

    -- 2. Lock Assigned Pets (Sorted)
    PERFORM 1 FROM pets p
    JOIN booking_pets bp ON bp.pet_id = p.id
    WHERE bp.booking_id = p_booking_id
    ORDER BY p.id
    FOR UPDATE;

    -- 3. Lock Room
    SELECT status, maintenance_from, maintenance_until
    INTO v_room_status, v_m_from, v_m_until
    FROM rooms
    WHERE id = v_room_id AND shop_id = v_shop_id
    FOR UPDATE;

    -- Transition: Confirmed ➔ Checked-In
    IF v_current_status = 'confirmed' AND p_new_status = 'checked_in' THEN
        -- Self-heal stale stored maintenance status after a maintenance window has ended.
        -- Booking safety still relies on the date window below, not only on rooms.status.
        IF v_room_status = 'maintenance' AND NOT (
            v_m_from IS NOT NULL AND v_m_until IS NOT NULL
            AND pawspace_business_date() BETWEEN v_m_from AND v_m_until
        ) THEN
            UPDATE rooms SET status = 'available' WHERE id = v_room_id AND shop_id = v_shop_id;
            v_room_status := 'available';
        END IF;

        -- Decision A1: Strictly check_in_date
        IF pawspace_business_date() != v_check_in THEN
            RAISE EXCEPTION 'Early/Late Check-in Violation: Booking % can only be checked in on % (Current: %). Use update_booking_schedule() first.',
                p_booking_id, v_check_in, pawspace_business_date();
        END IF;

        -- Operational Room State Validation
        IF v_room_status != 'available' THEN
            RAISE EXCEPTION 'Room State Conflict: Room % is currently % (must be available for check-in).',
                v_room_id, v_room_status;
        END IF;

        -- Maintenance Check
        IF v_m_from IS NOT NULL AND v_m_until IS NOT NULL AND pawspace_business_date() BETWEEN v_m_from AND v_m_until THEN
            RAISE EXCEPTION 'Room Maintenance Conflict: Room % is currently under maintenance.', v_room_id;
        END IF;

        -- Require >= 1 Pet
        SELECT COUNT(*) INTO v_pet_count
        FROM booking_pets
        WHERE booking_id = p_booking_id AND shop_id = v_shop_id;

        IF v_pet_count < 1 THEN
            RAISE EXCEPTION 'Cannot check-in booking %: No pets assigned (minimum 1 pet required).', p_booking_id;
        END IF;

        UPDATE bookings SET booking_status = 'checked_in' WHERE id = p_booking_id;
        UPDATE rooms SET status = 'occupied' WHERE id = v_room_id;

    -- Transition: Checked-In ➔ Checked-Out
    ELSIF v_current_status = 'checked_in' AND p_new_status = 'checked_out' THEN
        UPDATE bookings SET booking_status = 'checked_out' WHERE id = p_booking_id;
        UPDATE rooms SET status = 'cleaning' WHERE id = v_room_id;

    -- Transition: Confirmed ➔ Cancelled
    ELSIF v_current_status = 'confirmed' AND p_new_status = 'cancelled' THEN
        UPDATE bookings SET booking_status = 'cancelled' WHERE id = p_booking_id;

    ELSE
        RAISE EXCEPTION 'Illegal Status Transition: Cannot transition booking % from % to %.',
            p_booking_id, v_current_status, p_new_status;
    END IF;
    PERFORM enqueue_sync_event(v_shop_id,'booking',p_booking_id,'UPSERT',jsonb_build_object('booking_id',p_booking_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION update_booking_status(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_booking_status(UUID, VARCHAR) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION update_booking_schedule(
    p_booking_id UUID,
    p_new_room_id UUID,
    p_new_check_in DATE,
    p_new_check_out DATE,
    p_special_requests TEXT DEFAULT NULL,
    p_total_amount NUMERIC(10,2) DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_status VARCHAR;
    v_m_from DATE;
    v_m_until DATE;
    v_capacity INT;
    v_pet_count INT;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_new_check_out <= p_new_check_in THEN
        RAISE EXCEPTION 'Invalid Dates: check_out_date must be strictly after check_in_date.';
    END IF;

    -- 1. Lock Booking
    SELECT booking_status INTO v_status
    FROM bookings
    WHERE id = p_booking_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found.', p_booking_id;
    END IF;

    -- Enforce Confirmed Only
    IF v_status != 'confirmed' THEN
        RAISE EXCEPTION 'Cannot update schedule for booking in state % (only confirmed bookings can be rescheduled).', v_status;
    END IF;

    -- 2. Lock Assigned Pets (Sorted)
    PERFORM 1 FROM pets p
    JOIN booking_pets bp ON bp.pet_id = p.id
    WHERE bp.booking_id = p_booking_id
    ORDER BY p.id
    FOR UPDATE;

    -- 3. Lock Room
    SELECT capacity_pets, maintenance_from, maintenance_until
    INTO v_capacity, v_m_from, v_m_until
    FROM rooms
    WHERE id = p_new_room_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room % not found.', p_new_room_id;
    END IF;

    -- Maintenance Window Check
    IF v_m_from IS NOT NULL AND v_m_until IS NOT NULL THEN
        IF daterange(p_new_check_in, p_new_check_out, '[)') && daterange(v_m_from, v_m_until, '[]') THEN
            RAISE EXCEPTION 'Room Maintenance Violation: Room % is under maintenance from % to %.',
                p_new_room_id, v_m_from, v_m_until;
        END IF;
    END IF;

    -- Capacity Check
    SELECT COUNT(*) INTO v_pet_count
    FROM booking_pets
    WHERE booking_id = p_booking_id AND shop_id = v_shop_id;

    IF v_pet_count > v_capacity THEN
        RAISE EXCEPTION 'Room Capacity Violation: Room % capacity (%) cannot accommodate % assigned pets.',
            p_new_room_id, v_capacity, v_pet_count;
    END IF;

    -- Pet No-Overlap Revalidation
    IF EXISTS (
        SELECT 1
        FROM booking_pets bp_this
        JOIN booking_pets bp_other ON bp_other.pet_id = bp_this.pet_id
        JOIN bookings b_other ON b_other.id = bp_other.booking_id
        WHERE bp_this.booking_id = p_booking_id
          AND b_other.id != p_booking_id
          AND b_other.shop_id = v_shop_id
          AND b_other.booking_status IN ('confirmed', 'checked_in')
          AND daterange(b_other.check_in_date, b_other.check_out_date, '[)') && daterange(p_new_check_in, p_new_check_out, '[)')
    ) THEN
        RAISE EXCEPTION 'Pet Conflict: One or more pets have overlapping active bookings for the new date range.';
    END IF;

    UPDATE bookings
    SET room_id = p_new_room_id,
        check_in_date = p_new_check_in,
        check_out_date = p_new_check_out,
        special_requests = COALESCE(p_special_requests, special_requests),
        total_amount = COALESCE(p_total_amount, total_amount)
    WHERE id = p_booking_id AND shop_id = v_shop_id;
    PERFORM enqueue_sync_event(v_shop_id,'booking',p_booking_id,'UPSERT',jsonb_build_object('booking_id',p_booking_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION update_booking_schedule(UUID, UUID, DATE, DATE, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_booking_schedule(UUID, UUID, DATE, DATE, TEXT, NUMERIC) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION create_daily_report(
    p_booking_id UUID,
    p_pet_id UUID,
    p_food_status VARCHAR,
    p_excretion_status VARCHAR,
    p_mood_status VARCHAR,
    p_photo_urls TEXT[],
    p_staff_notes TEXT,
    p_idempotency_key UUID
)
RETURNS UUID AS $$
DECLARE
    v_shop_id UUID;
    v_booking_status VARCHAR;
    v_report_id UUID;
    v_line_retry_key UUID;
    v_request_fingerprint TEXT;
    v_existing_fingerprint TEXT;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    v_request_fingerprint := encode(extensions.digest(jsonb_build_object(
        'booking_id', p_booking_id, 'pet_id', p_pet_id,
        'food_status', p_food_status, 'excretion_status', p_excretion_status,
        'mood_status', p_mood_status, 'photo_urls', to_jsonb(p_photo_urls),
        'staff_notes', p_staff_notes
    )::text, 'sha256'), 'hex');

    -- Fast idempotent replay, including retries that arrive after checkout.
    SELECT id, request_fingerprint INTO v_report_id, v_existing_fingerprint
    FROM daily_reports
    WHERE shop_id = v_shop_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF v_existing_fingerprint != v_request_fingerprint THEN
            RAISE EXCEPTION 'Idempotency Key Reuse Conflict: same key used with different request payload.';
        END IF;
        RETURN v_report_id;
    END IF;

    -- Serialize against check-out before validating checked_in state.
    SELECT booking_status INTO v_booking_status
    FROM bookings
    WHERE id = p_booking_id AND shop_id = v_shop_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking % not found.', p_booking_id; END IF;

    -- Re-check after waiting for the Booking lock so concurrent duplicate requests converge.
    SELECT id, request_fingerprint INTO v_report_id, v_existing_fingerprint
    FROM daily_reports
    WHERE shop_id = v_shop_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF v_existing_fingerprint != v_request_fingerprint THEN
            RAISE EXCEPTION 'Idempotency Key Reuse Conflict: same key used with different request payload.';
        END IF;
        RETURN v_report_id;
    END IF;

    IF v_booking_status != 'checked_in' THEN
        RAISE EXCEPTION 'Daily Report Rejected: Booking is currently % (must be checked_in).', v_booking_status;
    END IF;

    -- Global lock order: Booking -> Pet. Membership is validated on the same row.
    PERFORM 1
    FROM pets p
    JOIN booking_pets bp ON bp.pet_id = p.id AND bp.shop_id = p.shop_id
    WHERE bp.booking_id = p_booking_id AND bp.pet_id = p_pet_id AND bp.shop_id = v_shop_id
    ORDER BY p.id
    FOR UPDATE OF p;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership Violation: Pet % is not assigned to Booking %.', p_pet_id, p_booking_id;
    END IF;

    IF p_photo_urls IS NULL OR cardinality(p_photo_urls) NOT BETWEEN 1 AND 4 THEN
        RAISE EXCEPTION 'Photo Count Violation: Daily report requires 1 to 4 photos.';
    END IF;

    v_line_retry_key := gen_random_uuid();

    INSERT INTO daily_reports (
        shop_id, booking_id, pet_id, idempotency_key, request_fingerprint, line_delivery_retry_key,
        food_status, excretion_status, mood_status, photo_urls, staff_notes,
        line_delivery_status, line_retry_count
    ) VALUES (
        v_shop_id, p_booking_id, p_pet_id, p_idempotency_key, v_request_fingerprint, v_line_retry_key,
        p_food_status, p_excretion_status, p_mood_status, p_photo_urls, p_staff_notes,
        'pending', 0
    )
    ON CONFLICT (shop_id, idempotency_key) DO NOTHING
    RETURNING id INTO v_report_id;

    IF v_report_id IS NULL THEN
        SELECT id, request_fingerprint INTO v_report_id, v_existing_fingerprint
        FROM daily_reports
        WHERE shop_id = v_shop_id AND idempotency_key = p_idempotency_key;
        IF v_existing_fingerprint != v_request_fingerprint THEN
            RAISE EXCEPTION 'Idempotency Key Reuse Conflict: same key used with different request payload.';
        END IF;
    END IF;

    RETURN v_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION create_daily_report(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT[], TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_daily_report(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT[], TEXT, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION retry_daily_report_delivery(p_report_id UUID)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_status VARCHAR;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    SELECT line_delivery_status INTO v_status
    FROM daily_reports
    WHERE id = p_report_id AND shop_id = v_shop_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Daily report % not found.', p_report_id; END IF;
    IF v_status != 'failed' THEN
        RAISE EXCEPTION 'Retry allowed only for failed delivery; current status is %.', v_status;
    END IF;

    -- Preserve line_delivery_retry_key. Worker will reuse the same X-Line-Retry-Key.
    UPDATE daily_reports
    SET line_delivery_status = 'pending', line_error_message = NULL, line_delivery_started_at = NULL
    WHERE id = p_report_id AND shop_id = v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION retry_daily_report_delivery(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION retry_daily_report_delivery(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION create_room(
    p_room_number VARCHAR,
    p_room_type VARCHAR,
    p_capacity_pets INT,
    p_base_price_per_night NUMERIC(10,2)
)
RETURNS UUID AS $$
DECLARE v_shop_id UUID; v_room_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only owner or manager can create rooms.';
    END IF;
    IF p_capacity_pets < 1 OR p_base_price_per_night < 0 THEN
        RAISE EXCEPTION 'Invalid room capacity or price.';
    END IF;
    INSERT INTO rooms (shop_id, room_number, room_type, capacity_pets, base_price_per_night, status, maintenance_from, maintenance_until)
    VALUES (v_shop_id, p_room_number, p_room_type, p_capacity_pets, p_base_price_per_night, 'available', NULL, NULL)
    RETURNING id INTO v_room_id;
    RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION create_room(VARCHAR, VARCHAR, INT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_room(VARCHAR, VARCHAR, INT, NUMERIC) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION update_room_config(
    p_room_id UUID, p_room_number VARCHAR, p_room_type VARCHAR,
    p_capacity_pets INT, p_base_price_per_night NUMERIC(10,2)
)
RETURNS VOID AS $$
DECLARE v_shop_id UUID; v_max_active_pets INT;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only owner or manager can configure rooms.';
    END IF;
    IF p_capacity_pets < 1 OR p_base_price_per_night < 0 THEN
        RAISE EXCEPTION 'Invalid room capacity or price.';
    END IF;

    PERFORM 1 FROM rooms WHERE id = p_room_id AND shop_id = v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room % not found.', p_room_id; END IF;

    SELECT COALESCE(MAX(pet_count), 0) INTO v_max_active_pets
    FROM (
        SELECT COUNT(bp.pet_id) AS pet_count
        FROM bookings b JOIN booking_pets bp ON bp.booking_id = b.id AND bp.shop_id = b.shop_id
        WHERE b.room_id = p_room_id AND b.shop_id = v_shop_id
          AND b.booking_status IN ('confirmed', 'checked_in')
        GROUP BY b.id
    ) q;
    IF p_capacity_pets < v_max_active_pets THEN
        RAISE EXCEPTION 'Capacity Reduction Conflict: active booking requires capacity %.', v_max_active_pets;
    END IF;

    UPDATE rooms SET room_number=p_room_number, room_type=p_room_type,
        capacity_pets=p_capacity_pets, base_price_per_night=p_base_price_per_night
    WHERE id=p_room_id AND shop_id=v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION update_room_config(UUID, VARCHAR, VARCHAR, INT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_room_config(UUID, VARCHAR, VARCHAR, INT, NUMERIC) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION set_room_maintenance(p_room_id UUID, p_from DATE, p_until DATE)
RETURNS VOID AS $$
DECLARE v_shop_id UUID; v_status VARCHAR;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only owner or manager can set maintenance.';
    END IF;

    -- Either both NULL (clear maintenance) or both non-NULL. Partial NULL is always invalid.
    IF (p_from IS NULL) <> (p_until IS NULL) THEN
        RAISE EXCEPTION 'Invalid Maintenance Window: from/until must both be NULL or both be provided.';
    END IF;
    IF p_from IS NOT NULL AND p_until < p_from THEN
        RAISE EXCEPTION 'Invalid Dates: maintenance_until must be >= maintenance_from.';
    END IF;

    SELECT status INTO v_status FROM rooms
    WHERE id=p_room_id AND shop_id=v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room % not found.', p_room_id; END IF;

    IF p_from IS NOT NULL AND EXISTS (
        SELECT 1 FROM bookings
        WHERE room_id=p_room_id AND shop_id=v_shop_id
          AND booking_status IN ('confirmed','checked_in')
          AND daterange(check_in_date,check_out_date,'[)') && daterange(p_from,p_until,'[]')
    ) THEN
        RAISE EXCEPTION 'Maintenance Conflict: room has an overlapping active booking.';
    END IF;

    -- Maintenance must never bypass the post-checkout cleaning gate.
    IF p_from IS NOT NULL
       AND pawspace_business_date() BETWEEN p_from AND p_until
       AND v_status IN ('occupied','cleaning') THEN
        RAISE EXCEPTION 'Maintenance State Conflict: current maintenance cannot override occupied/cleaning room state.';
    END IF;

    UPDATE rooms
    SET maintenance_from=p_from, maintenance_until=p_until,
        status=CASE
            WHEN p_from IS NOT NULL AND pawspace_business_date() BETWEEN p_from AND p_until THEN 'maintenance'
            WHEN status='maintenance' AND p_from IS NULL THEN 'available'
            WHEN status='maintenance' AND pawspace_business_date() NOT BETWEEN p_from AND p_until THEN 'available'
            ELSE status END
    WHERE id=p_room_id AND shop_id=v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION set_room_maintenance(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_room_maintenance(UUID, DATE, DATE) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION mark_room_clean(p_room_id UUID)
RETURNS VOID AS $$
DECLARE v_shop_id UUID; v_status VARCHAR;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    SELECT status INTO v_status FROM rooms
    WHERE id=p_room_id AND shop_id=v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room % not found.', p_room_id; END IF;
    IF v_status != 'cleaning' THEN
        RAISE EXCEPTION 'Invalid Action: only cleaning rooms can be marked clean.';
    END IF;
    UPDATE rooms SET status='available' WHERE id=p_room_id AND shop_id=v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION mark_room_clean(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_room_clean(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION create_pet_owner(
    p_first_name VARCHAR, p_last_name VARCHAR, p_phone VARCHAR,
    p_emergency_phone VARCHAR, p_address TEXT
)
RETURNS UUID AS $$
DECLARE v_shop_id UUID; v_owner_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    INSERT INTO pet_owners (shop_id, first_name, last_name, phone, emergency_phone, address,
        line_user_id, line_claim_token_hash, line_claim_expires_at, line_claim_used_at)
    VALUES (v_shop_id, p_first_name, p_last_name, p_phone, p_emergency_phone, p_address,
        NULL, NULL, NULL, NULL)
    RETURNING id INTO v_owner_id;
    RETURN v_owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION create_pet_owner(VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_pet_owner(VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION update_pet_owner_profile(
    p_owner_id UUID, p_first_name VARCHAR, p_last_name VARCHAR, p_phone VARCHAR,
    p_emergency_phone VARCHAR, p_address TEXT
)
RETURNS VOID AS $$
DECLARE v_shop_id UUID; v_pet_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    PERFORM 1 FROM pet_owners WHERE id=p_owner_id AND shop_id=v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pet owner % not found.', p_owner_id; END IF;
    UPDATE pet_owners SET first_name=p_first_name,last_name=p_last_name,phone=p_phone,
        emergency_phone=p_emergency_phone,address=p_address
    WHERE id=p_owner_id AND shop_id=v_shop_id;
    FOR v_pet_id IN SELECT id FROM pets WHERE owner_id=p_owner_id AND shop_id=v_shop_id LOOP
        PERFORM enqueue_sync_event(v_shop_id,'pet_customer',v_pet_id,'UPSERT',jsonb_build_object('pet_id',v_pet_id));
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION update_pet_owner_profile(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_pet_owner_profile(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION create_pet(
    p_owner_id UUID, p_name VARCHAR, p_species VARCHAR, p_breed VARCHAR, p_gender VARCHAR,
    p_birth_date DATE, p_weight_kg NUMERIC, p_avatar_url TEXT, p_special_care_notes TEXT, p_allergies TEXT
)
RETURNS UUID AS $$
DECLARE v_shop_id UUID; v_pet_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pet_owners WHERE id=p_owner_id AND shop_id=v_shop_id) THEN
        RAISE EXCEPTION 'Owner not found in tenant.';
    END IF;
    INSERT INTO pets (shop_id,owner_id,name,species,breed,gender,birth_date,weight_kg,avatar_url,special_care_notes,allergies)
    VALUES (v_shop_id,p_owner_id,p_name,p_species,p_breed,p_gender,p_birth_date,p_weight_kg,p_avatar_url,p_special_care_notes,p_allergies)
    RETURNING id INTO v_pet_id;
    PERFORM enqueue_sync_event(v_shop_id,'pet_customer',v_pet_id,'UPSERT',jsonb_build_object('pet_id',v_pet_id));
    RETURN v_pet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION create_pet(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,DATE,NUMERIC,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_pet(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,DATE,NUMERIC,TEXT,TEXT,TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION update_pet_profile(
    p_pet_id UUID, p_name VARCHAR, p_species VARCHAR, p_breed VARCHAR, p_gender VARCHAR,
    p_birth_date DATE, p_weight_kg NUMERIC, p_avatar_url TEXT, p_special_care_notes TEXT, p_allergies TEXT
)
RETURNS VOID AS $$
DECLARE v_shop_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    PERFORM 1 FROM pets WHERE id=p_pet_id AND shop_id=v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pet % not found.', p_pet_id; END IF;
    UPDATE pets SET name=p_name,species=p_species,breed=p_breed,gender=p_gender,birth_date=p_birth_date,
        weight_kg=p_weight_kg,avatar_url=p_avatar_url,special_care_notes=p_special_care_notes,allergies=p_allergies
    WHERE id=p_pet_id AND shop_id=v_shop_id;
    PERFORM enqueue_sync_event(v_shop_id,'pet_customer',p_pet_id,'UPSERT',jsonb_build_object('pet_id',p_pet_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION update_pet_profile(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,DATE,NUMERIC,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_pet_profile(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,DATE,NUMERIC,TEXT,TEXT,TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION transfer_pet_owner(p_pet_id UUID, p_new_owner_id UUID)
RETURNS VOID AS $$
DECLARE v_shop_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    PERFORM 1 FROM pets WHERE id=p_pet_id AND shop_id=v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pet not found.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pet_owners WHERE id=p_new_owner_id AND shop_id=v_shop_id) THEN RAISE EXCEPTION 'New owner not found.'; END IF;
    IF EXISTS (SELECT 1 FROM booking_pets bp JOIN bookings b ON b.id=bp.booking_id AND b.shop_id=bp.shop_id
        WHERE bp.pet_id=p_pet_id AND bp.shop_id=v_shop_id AND b.booking_status IN ('confirmed','checked_in')) THEN
        RAISE EXCEPTION 'Cannot transfer owner while pet has an active booking.';
    END IF;
    UPDATE pets SET owner_id=p_new_owner_id WHERE id=p_pet_id AND shop_id=v_shop_id;
    PERFORM enqueue_sync_event(v_shop_id,'pet_customer',p_pet_id,'UPSERT',jsonb_build_object('pet_id',p_pet_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION transfer_pet_owner(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transfer_pet_owner(UUID,UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION prevent_active_pet_owner_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id AND EXISTS (
        SELECT 1 FROM booking_pets bp JOIN bookings b ON b.id=bp.booking_id AND b.shop_id=bp.shop_id
        WHERE bp.pet_id=OLD.id AND bp.shop_id=OLD.shop_id AND b.booking_status IN ('confirmed','checked_in')
    ) THEN RAISE EXCEPTION 'Mutation Lock Violation: active booking exists.'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION prevent_active_pet_owner_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_prevent_active_pet_owner_change BEFORE UPDATE ON pets
FOR EACH ROW EXECUTE FUNCTION prevent_active_pet_owner_change();

CREATE OR REPLACE FUNCTION delete_pet(p_pet_id UUID)
RETURNS VOID AS $$
DECLARE v_shop_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    PERFORM 1 FROM pets WHERE id=p_pet_id AND shop_id=v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pet not found.'; END IF;
    IF EXISTS (SELECT 1 FROM booking_pets WHERE pet_id=p_pet_id AND shop_id=v_shop_id) THEN
        RAISE EXCEPTION 'Cannot delete pet with booking history.';
    END IF;
    PERFORM enqueue_sync_event(v_shop_id,'pet_customer',p_pet_id,'DELETE',jsonb_build_object('pet_id',p_pet_id));
    DELETE FROM pets WHERE id=p_pet_id AND shop_id=v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION delete_pet(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_pet(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION delete_pet_owner(p_owner_id UUID)
RETURNS VOID AS $$
DECLARE v_shop_id UUID; v_pet_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    PERFORM 1 FROM pet_owners WHERE id=p_owner_id AND shop_id=v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owner not found.'; END IF;
    IF EXISTS (
        SELECT 1 FROM pets p JOIN booking_pets bp ON bp.pet_id=p.id AND bp.shop_id=p.shop_id
        WHERE p.owner_id=p_owner_id AND p.shop_id=v_shop_id
    ) THEN RAISE EXCEPTION 'Cannot delete owner with booking history.'; END IF;
    FOR v_pet_id IN SELECT id FROM pets WHERE owner_id=p_owner_id AND shop_id=v_shop_id LOOP
        PERFORM enqueue_sync_event(v_shop_id,'pet_customer',v_pet_id,'DELETE',jsonb_build_object('pet_id',v_pet_id));
    END LOOP;
    DELETE FROM pet_owners WHERE id=p_owner_id AND shop_id=v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION delete_pet_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_pet_owner(UUID) TO authenticated, service_role;
-- DB backstop for the documented immutable booking owner invariant.
CREATE OR REPLACE FUNCTION prevent_booking_owner_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
        RAISE EXCEPTION 'Mutation Lock Violation: bookings.owner_id is immutable.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION prevent_booking_owner_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_prevent_booking_owner_change
BEFORE UPDATE OF owner_id ON bookings
FOR EACH ROW EXECUTE FUNCTION prevent_booking_owner_change();

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_sync_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

REVOKE INSERT,UPDATE,DELETE ON shops,staff_users,pet_owners,pets,rooms,bookings,
    booking_pets,daily_reports,google_sync_mappings,sync_queue FROM anon,authenticated;
GRANT SELECT ON shops,staff_users,pet_owners,pets,rooms,bookings,
    booking_pets,daily_reports,google_sync_mappings,sync_queue TO authenticated;

CREATE POLICY staff_read_shop ON shops FOR SELECT USING (id=current_staff_shop_id());
CREATE POLICY staff_read_staff ON staff_users FOR SELECT USING (shop_id=current_staff_shop_id());
CREATE POLICY staff_read_pet_owners ON pet_owners FOR SELECT USING (shop_id=current_staff_shop_id());
CREATE POLICY staff_read_pets ON pets FOR SELECT USING (shop_id=current_staff_shop_id());
CREATE POLICY staff_read_rooms ON rooms FOR SELECT USING (shop_id=current_staff_shop_id());
CREATE POLICY staff_read_bookings ON bookings FOR SELECT USING (shop_id=current_staff_shop_id());
CREATE POLICY staff_read_booking_pets ON booking_pets FOR SELECT USING (shop_id=current_staff_shop_id());
CREATE POLICY staff_read_daily_reports ON daily_reports FOR SELECT USING (shop_id=current_staff_shop_id());
CREATE POLICY staff_read_sync_mappings ON google_sync_mappings FOR SELECT USING (shop_id=current_staff_shop_id());
CREATE POLICY staff_read_sync_queue ON sync_queue FOR SELECT USING (shop_id=current_staff_shop_id());
