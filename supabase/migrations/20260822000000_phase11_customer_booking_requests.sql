-- PawSpace V1 Phase 11 - Customer Self-Booking via LINE LIFF (Request-First Flow)
-- Source of truth: docs/PRD.md + docs/SYSTEM_ARCHITECTURE.md + docs/BRIEF-phase11-customer-self-booking-liff.md
-- Existing Phase 1-10 migrations remain immutable.

CREATE TABLE IF NOT EXISTS booking_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES pet_owners(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    pet_ids UUID[] NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled')),
    requested_by_line_user_id VARCHAR(100) NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    special_requests TEXT,
    confirmed_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    actioned_by UUID REFERENCES staff_users(id),
    actioned_at TIMESTAMPTZ,
    decline_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (shop_id, id),
    CONSTRAINT check_request_dates_valid CHECK (check_out_date > check_in_date)
);

ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE booking_requests FROM PUBLIC, anon, authenticated;

CREATE POLICY staff_select_booking_requests ON booking_requests
FOR SELECT TO authenticated
USING (shop_id = current_staff_shop_id());

GRANT SELECT ON TABLE booking_requests TO authenticated, service_role;
GRANT ALL ON TABLE booking_requests TO service_role;

-- 1. Customer RPC: Internal submission gated by verified LINE identity
CREATE OR REPLACE FUNCTION submit_booking_request_internal(
    p_verified_line_user_id VARCHAR,
    p_shop_id UUID,
    p_room_id UUID,
    p_pet_ids UUID[],
    p_check_in_date DATE,
    p_check_out_date DATE,
    p_special_requests TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_owner_id UUID;
    v_room_price NUMERIC(10,2);
    v_room_capacity INT;
    v_m_from DATE;
    v_m_until DATE;
    v_pet_count INT;
    v_pet_id UUID;
    v_nights INT;
    v_total_amount NUMERIC(10,2);
    v_request_id UUID;
BEGIN
    IF p_verified_line_user_id IS NULL OR btrim(p_verified_line_user_id) = '' THEN
        RAISE EXCEPTION 'Invalid LINE identity.';
    END IF;
    IF p_shop_id IS NULL THEN
        RAISE EXCEPTION 'Invalid shop.';
    END IF;
    IF p_room_id IS NULL THEN
        RAISE EXCEPTION 'Invalid room.';
    END IF;
    IF p_check_out_date <= p_check_in_date THEN
        RAISE EXCEPTION 'Invalid Dates: check_out_date must be strictly after check_in_date.';
    END IF;
    IF p_pet_ids IS NULL OR array_length(p_pet_ids, 1) IS NULL OR array_length(p_pet_ids, 1) = 0 THEN
        RAISE EXCEPTION 'At least one pet must be selected.';
    END IF;

    -- Authoritative owner resolution from verified LINE ID
    SELECT id INTO v_owner_id
    FROM pet_owners
    WHERE shop_id = p_shop_id
      AND line_user_id = btrim(p_verified_line_user_id);

    IF NOT FOUND OR v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Pet owner not found or not linked to shop %.', p_shop_id;
    END IF;

    -- Validate all pets belong to this owner in this shop
    SELECT COUNT(*) INTO v_pet_count
    FROM pets
    WHERE shop_id = p_shop_id
      AND owner_id = v_owner_id
      AND id = ANY(p_pet_ids);

    IF v_pet_count <> array_length(p_pet_ids, 1) THEN
        RAISE EXCEPTION 'Invalid pet selection: one or more pets do not belong to the verified owner.';
    END IF;

    -- Validate and lock room
    SELECT base_price_per_night, capacity_pets, maintenance_from, maintenance_until
    INTO v_room_price, v_room_capacity, v_m_from, v_m_until
    FROM rooms
    WHERE id = p_room_id AND shop_id = p_shop_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room % not found for shop %.', p_room_id, p_shop_id;
    END IF;

    IF array_length(p_pet_ids, 1) > v_room_capacity THEN
        RAISE EXCEPTION 'Room Capacity Violation: Room capacity is % pets, but % pets were selected.',
            v_room_capacity, array_length(p_pet_ids, 1);
    END IF;

    -- Check maintenance window
    IF v_m_from IS NOT NULL AND v_m_until IS NOT NULL THEN
        IF daterange(p_check_in_date, p_check_out_date, '[)') && daterange(v_m_from, v_m_until, '[]') THEN
            RAISE EXCEPTION 'Room Maintenance Violation: Room is under maintenance from % to %.',
                v_m_from, v_m_until;
        END IF;
    END IF;

    -- Check room availability against active confirmed/checked_in bookings
    IF EXISTS (
        SELECT 1 FROM bookings
        WHERE room_id = p_room_id
          AND shop_id = p_shop_id
          AND booking_status IN ('confirmed', 'checked_in')
          AND daterange(check_in_date, check_out_date, '[)') && daterange(p_check_in_date, p_check_out_date, '[)')
    ) THEN
        RAISE EXCEPTION 'Room Collision: Room % is already booked for the requested dates.', p_room_id;
    END IF;

    -- Check pet conflicts against active confirmed/checked_in bookings
    FOREACH v_pet_id IN ARRAY p_pet_ids LOOP
        IF EXISTS (
            SELECT 1
            FROM booking_pets bp
            JOIN bookings b ON b.id = bp.booking_id AND b.shop_id = bp.shop_id
            WHERE bp.shop_id = p_shop_id
              AND bp.pet_id = v_pet_id
              AND b.booking_status IN ('confirmed', 'checked_in')
              AND daterange(b.check_in_date, b.check_out_date, '[)') && daterange(p_check_in_date, p_check_out_date, '[)')
        ) THEN
            RAISE EXCEPTION 'Pet Conflict: Pet % already has an active booking during the selected dates.', v_pet_id;
        END IF;
    END LOOP;

    v_nights := (p_check_out_date - p_check_in_date);
    v_total_amount := v_room_price * v_nights;

    INSERT INTO booking_requests (
        shop_id, owner_id, room_id, pet_ids,
        check_in_date, check_out_date, status,
        requested_by_line_user_id, total_amount, special_requests
    )
    VALUES (
        p_shop_id, v_owner_id, p_room_id, p_pet_ids,
        p_check_in_date, p_check_out_date, 'requested',
        btrim(p_verified_line_user_id), v_total_amount, p_special_requests
    )
    RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION submit_booking_request_internal(VARCHAR, UUID, UUID, UUID[], DATE, DATE, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_booking_request_internal(VARCHAR, UUID, UUID, UUID[], DATE, DATE, TEXT)
    TO service_role;

-- 2. Customer Context RPC: Fetches customer's pets + shop room availability without PII leakage
CREATE OR REPLACE FUNCTION get_customer_booking_context_internal(
    p_verified_line_user_id VARCHAR,
    p_shop_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_owner_id UUID;
    v_owner_name VARCHAR;
    v_owner_phone VARCHAR;
    v_shop_name VARCHAR;
    v_shop_slug VARCHAR;
    v_pets JSONB;
    v_rooms JSONB;
    v_occupied JSONB;
BEGIN
    IF p_verified_line_user_id IS NULL OR btrim(p_verified_line_user_id) = '' THEN
        RAISE EXCEPTION 'Invalid LINE identity.';
    END IF;
    IF p_shop_id IS NULL THEN
        RAISE EXCEPTION 'Invalid shop.';
    END IF;

    SELECT name, slug INTO v_shop_name, v_shop_slug
    FROM shops
    WHERE id = p_shop_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop not found.';
    END IF;

    SELECT id, first_name, phone
    INTO v_owner_id, v_owner_name, v_owner_phone
    FROM pet_owners
    WHERE shop_id = p_shop_id
      AND line_user_id = btrim(p_verified_line_user_id);

    IF NOT FOUND OR v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Pet owner not found or not linked to shop %.', p_shop_id;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'species', p.species,
        'breed', p.breed,
        'weightKg', p.weight_kg
    ) ORDER BY p.name), '[]'::jsonb)
    INTO v_pets
    FROM pets p
    WHERE p.shop_id = p_shop_id AND p.owner_id = v_owner_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', r.id,
        'roomNumber', r.room_number,
        'roomType', r.room_type,
        'capacityPets', r.capacity_pets,
        'basePricePerNight', r.base_price_per_night,
        'status', r.status,
        'maintenanceFrom', r.maintenance_from,
        'maintenanceUntil', r.maintenance_until
    ) ORDER BY r.room_number), '[]'::jsonb)
    INTO v_rooms
    FROM rooms r
    WHERE r.shop_id = p_shop_id;

    -- Occupied date ranges only (NO customer PII)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'roomId', b.room_id,
        'checkIn', b.check_in_date,
        'checkOut', b.check_out_date
    )), '[]'::jsonb)
    INTO v_occupied
    FROM bookings b
    WHERE b.shop_id = p_shop_id
      AND b.booking_status IN ('confirmed', 'checked_in')
      AND b.check_out_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date;

    RETURN jsonb_build_object(
        'shop', jsonb_build_object('id', p_shop_id, 'name', v_shop_name, 'slug', v_shop_slug),
        'owner', jsonb_build_object('id', v_owner_id, 'firstName', v_owner_name, 'phone', v_owner_phone),
        'pets', v_pets,
        'rooms', v_rooms,
        'occupiedRanges', v_occupied
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION get_customer_booking_context_internal(VARCHAR, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_customer_booking_context_internal(VARCHAR, UUID)
    TO service_role;

-- 3. Staff RPC: Confirm booking request (promotes to real booking in bookings + booking_pets)
CREATE OR REPLACE FUNCTION confirm_booking_request(
    p_request_id UUID,
    p_assigned_room_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_shop_id UUID;
    v_req RECORD;
    v_target_room_id UUID;
    v_booking_id UUID;
    v_pet_id UUID;
    v_m_from DATE;
    v_m_until DATE;
    v_capacity INT;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authenticated staff member.';
    END IF;

    SELECT * INTO v_req
    FROM booking_requests
    WHERE id = p_request_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking request % not found for shop %.', p_request_id, v_shop_id;
    END IF;

    IF v_req.status <> 'requested' THEN
        RAISE EXCEPTION 'Booking request is already %.', v_req.status;
    END IF;

    v_target_room_id := COALESCE(p_assigned_room_id, v_req.room_id);

    -- Lock and validate room
    SELECT capacity_pets, maintenance_from, maintenance_until
    INTO v_capacity, v_m_from, v_m_until
    FROM rooms
    WHERE id = v_target_room_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target room % not found.', v_target_room_id;
    END IF;

    IF array_length(v_req.pet_ids, 1) > v_capacity THEN
        RAISE EXCEPTION 'Room Capacity Violation: Room capacity is % pets, but request has % pets.',
            v_capacity, array_length(v_req.pet_ids, 1);
    END IF;

    IF v_m_from IS NOT NULL AND v_m_until IS NOT NULL THEN
        IF daterange(v_req.check_in_date, v_req.check_out_date, '[)') && daterange(v_m_from, v_m_until, '[]') THEN
            RAISE EXCEPTION 'Room Maintenance Violation: Room % is under maintenance.', v_target_room_id;
        END IF;
    END IF;

    -- Insert into bookings (GiST exclusion constraint prevents collisions)
    INSERT INTO bookings (
        shop_id, owner_id, room_id,
        check_in_date, check_out_date,
        booking_status, total_amount, special_requests
    )
    VALUES (
        v_shop_id, v_req.owner_id, v_target_room_id,
        v_req.check_in_date, v_req.check_out_date,
        'confirmed', v_req.total_amount, v_req.special_requests
    )
    RETURNING id INTO v_booking_id;

    -- Add pets to booking
    FOREACH v_pet_id IN ARRAY v_req.pet_ids LOOP
        -- Validate pet conflict
        IF EXISTS (
            SELECT 1
            FROM booking_pets bp
            JOIN bookings b ON b.id = bp.booking_id AND b.shop_id = bp.shop_id
            WHERE bp.shop_id = v_shop_id
              AND bp.pet_id = v_pet_id
              AND b.booking_status IN ('confirmed', 'checked_in')
              AND daterange(b.check_in_date, b.check_out_date, '[)') && daterange(v_req.check_in_date, v_req.check_out_date, '[)')
        ) THEN
            RAISE EXCEPTION 'Pet Conflict: Pet % has an overlapping confirmed booking.', v_pet_id;
        END IF;

        INSERT INTO booking_pets (shop_id, booking_id, pet_id)
        VALUES (v_shop_id, v_booking_id, v_pet_id);
    END LOOP;

    -- Mark request confirmed
    UPDATE booking_requests
    SET status = 'confirmed',
        confirmed_booking_id = v_booking_id,
        actioned_by = auth.uid(),
        actioned_at = now()
    WHERE id = p_request_id AND shop_id = v_shop_id;

    PERFORM enqueue_sync_event(v_shop_id, 'booking', v_booking_id, 'UPSERT', jsonb_build_object('booking_id', v_booking_id));

    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION confirm_booking_request(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_booking_request(UUID, UUID) TO authenticated, service_role;

-- 4. Staff RPC: Decline booking request
CREATE OR REPLACE FUNCTION decline_booking_request(
    p_request_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_status VARCHAR;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authenticated staff member.';
    END IF;

    SELECT status INTO v_status
    FROM booking_requests
    WHERE id = p_request_id AND shop_id = v_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking request % not found for shop %.', p_request_id, v_shop_id;
    END IF;

    IF v_status <> 'requested' THEN
        RAISE EXCEPTION 'Booking request is already %.', v_status;
    END IF;

    UPDATE booking_requests
    SET status = 'declined',
        actioned_by = auth.uid(),
        actioned_at = now(),
        decline_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
    WHERE id = p_request_id AND shop_id = v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION decline_booking_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decline_booking_request(UUID, TEXT) TO authenticated, service_role;
