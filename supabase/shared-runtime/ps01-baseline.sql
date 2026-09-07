-- GENERATED FILE. DO NOT EDIT DIRECTLY.
-- PS01 shared-runtime baseline compiled from the 13 canonical historical migrations.
-- Canonical source SHA-256: 0ee8857ae05aecc732bf92f6bdca980ae3b0547ba7eeca7e16a0cab575ccbba5

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(required.extname, ', ' ORDER BY required.extname)
  INTO missing
  FROM (VALUES ('btree_gist'), ('pgcrypto'), ('uuid-ossp')) AS required(extname)
  WHERE NOT EXISTS (SELECT 1 FROM pg_extension e WHERE e.extname = required.extname);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'PS01 prerequisite extensions missing: %', missing;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ps01_runtime') THEN
    CREATE ROLE ps01_runtime NOLOGIN;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS ps01;
CREATE SCHEMA IF NOT EXISTS ps01_internal;

REVOKE ALL ON SCHEMA ps01 FROM PUBLIC, anon, service_role;
REVOKE ALL ON SCHEMA ps01_internal FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA ps01 TO authenticated, ps01_runtime;
GRANT USAGE ON SCHEMA ps01_internal TO ps01_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA ps01 REVOKE ALL ON TABLES FROM PUBLIC, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ps01 REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ps01 REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, service_role;

SET search_path = ps01, extensions, pg_temp;

-- BEGIN LEGACY SOURCE: 20260220000000_initial_schema.sql
-- PawSpace V1 Phase 1 — Hardened target schema only
-- Source of truth: docs/PRD.md + docs/SYSTEM_ARCHITECTURE.md
-- Phase 2 owns RPCs, RLS policies, grants/revokes, and mutation authorization.


CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(50),
    line_oa_id VARCHAR(100),
    google_sheet_id VARCHAR(255) UNIQUE,
    google_sheet_claim_token_hash VARCHAR(64),
    google_sheet_claim_expires_at TIMESTAMPTZ,
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'trial'
        CHECK (subscription_status IN ('trial', 'active', 'past_due')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (id),
    UNIQUE (google_sheet_claim_token_hash)
);

CREATE TABLE staff_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'staff'
        CHECK (role IN ('owner', 'manager', 'staff')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    disabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (shop_id, id)
);

CREATE TABLE pet_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    line_user_id VARCHAR(100),
    line_claim_token_hash VARCHAR(64),
    line_claim_expires_at TIMESTAMPTZ,
    line_claim_used_at TIMESTAMPTZ,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    phone VARCHAR(50) NOT NULL,
    emergency_phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (shop_id, id),
    UNIQUE (shop_id, phone),
    UNIQUE (shop_id, line_user_id),
    UNIQUE (line_claim_token_hash)
);

CREATE TABLE pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    species VARCHAR(50) NOT NULL CHECK (species IN ('dog', 'cat')),
    breed VARCHAR(100),
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'neutered_male', 'spayed_female')),
    birth_date DATE,
    weight_kg NUMERIC(5,2),
    avatar_url TEXT,
    special_care_notes TEXT,
    allergies TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (shop_id, id),
    FOREIGN KEY (shop_id, owner_id)
        REFERENCES pet_owners(shop_id, id) ON DELETE CASCADE
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    room_type VARCHAR(50) NOT NULL
        CHECK (room_type IN ('standard', 'deluxe', 'vip', 'cat_condo')),
    capacity_pets INT NOT NULL DEFAULT 1 CHECK (capacity_pets >= 1),
    base_price_per_night NUMERIC(10,2) NOT NULL CHECK (base_price_per_night >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'occupied', 'cleaning', 'maintenance')),
    maintenance_from DATE,
    maintenance_until DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (shop_id, id),
    UNIQUE (shop_id, room_number),
    CONSTRAINT check_maintenance_dates CHECK (
        (maintenance_from IS NULL AND maintenance_until IS NULL)
        OR (
            maintenance_from IS NOT NULL
            AND maintenance_until IS NOT NULL
            AND maintenance_until >= maintenance_from
        )
    )
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    room_id UUID NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    booking_status VARCHAR(50) NOT NULL DEFAULT 'confirmed'
        CHECK (booking_status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled')),
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    special_requests TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (shop_id, id),
    FOREIGN KEY (shop_id, owner_id)
        REFERENCES pet_owners(shop_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (shop_id, room_id)
        REFERENCES rooms(shop_id, id) ON DELETE RESTRICT,
    CONSTRAINT check_dates_valid CHECK (check_out_date > check_in_date),
    CONSTRAINT prevent_double_booking EXCLUDE USING gist (
        room_id WITH =,
        daterange(check_in_date, check_out_date, '[)') WITH &&
    ) WHERE (booking_status IN ('confirmed', 'checked_in'))
);

CREATE TABLE booking_pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    booking_id UUID NOT NULL,
    pet_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (booking_id, pet_id),
    UNIQUE (shop_id, booking_id, pet_id),
    FOREIGN KEY (shop_id, booking_id)
        REFERENCES bookings(shop_id, id) ON DELETE CASCADE,
    FOREIGN KEY (shop_id, pet_id)
        REFERENCES pets(shop_id, id) ON DELETE RESTRICT
);

CREATE TABLE daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL,
    pet_id UUID NOT NULL,
    report_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date),
    idempotency_key UUID NOT NULL,
    request_fingerprint TEXT NOT NULL,
    line_delivery_retry_key UUID NOT NULL UNIQUE,
    food_status VARCHAR(50) NOT NULL
        CHECK (food_status IN ('finished', 'half', 'little', 'refused')),
    excretion_status VARCHAR(50) NOT NULL
        CHECK (excretion_status IN ('normal', 'diarrhea', 'none')),
    mood_status VARCHAR(50) NOT NULL
        CHECK (mood_status IN ('happy', 'calm', 'stressed')),
    photo_urls TEXT[] NOT NULL DEFAULT '{}',
    staff_notes TEXT,
    line_delivery_status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (line_delivery_status IN ('pending', 'sending', 'sent', 'failed')),
    line_delivery_started_at TIMESTAMPTZ,
    line_sent_at TIMESTAMPTZ,
    line_error_message TEXT,
    line_retry_count INT NOT NULL DEFAULT 0 CHECK (line_retry_count >= 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (shop_id, booking_id, pet_id)
        REFERENCES booking_pets(shop_id, booking_id, pet_id) ON DELETE CASCADE,
    UNIQUE (shop_id, idempotency_key),
    CONSTRAINT check_photo_count CHECK (cardinality(photo_urls) BETWEEN 1 AND 4)
);

CREATE TABLE google_sync_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL
        CHECK (entity_type IN ('pet_customer', 'booking')),
    entity_id UUID NOT NULL,
    sheet_name VARCHAR(100) NOT NULL,
    synced_hash TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (shop_id, entity_type, entity_id)
);

CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL
        CHECK (entity_type IN ('pet_customer', 'booking')),
    entity_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('UPSERT', 'DELETE')),
    payload JSONB NOT NULL,
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'failed', 'completed')),
    processing_started_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Operational indexes. Constraints above remain the correctness layer.
CREATE INDEX idx_staff_users_shop_active ON staff_users (shop_id, is_active);
CREATE INDEX idx_pets_shop_owner ON pets (shop_id, owner_id);
CREATE INDEX idx_bookings_shop_owner_status ON bookings (shop_id, owner_id, booking_status);
CREATE INDEX idx_bookings_shop_room_dates ON bookings (shop_id, room_id, check_in_date, check_out_date);
CREATE INDEX idx_booking_pets_shop_pet ON booking_pets (shop_id, pet_id);
CREATE INDEX idx_daily_reports_booking_pet_date ON daily_reports (shop_id, booking_id, pet_id, report_date DESC);
CREATE INDEX idx_daily_reports_line_worker ON daily_reports (line_delivery_status, line_delivery_started_at, created_at)
    WHERE line_delivery_status IN ('pending', 'sending', 'failed');
CREATE INDEX idx_sync_queue_worker ON sync_queue (status, next_attempt_at, created_at)
    WHERE status IN ('pending', 'processing', 'failed');

-- END LEGACY SOURCE: 20260220000000_initial_schema.sql


-- BEGIN LEGACY SOURCE: 20260820020000_phase2_authoritative_gateways.sql
-- PawSpace V1 Phase 2 - Authoritative mutation gateways, constraints, and RLS
-- Source of truth: docs/PRD.md + docs/SYSTEM_ARCHITECTURE.md
-- Phase scope excludes Auth bootstrap/staff admin, LINE claim, worker transports, and Google binding.

CREATE OR REPLACE FUNCTION pawspace_business_date()
RETURNS DATE AS $$
    SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date;
$$ LANGUAGE sql STABLE SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION pawspace_business_date() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pawspace_business_date() TO authenticated, ps01_runtime;

CREATE OR REPLACE FUNCTION current_staff_shop_id()
RETURNS UUID AS $$
    SELECT shop_id
    FROM staff_users
    WHERE id = auth.uid() AND is_active = TRUE;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION current_staff_shop_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_staff_shop_id() TO authenticated, ps01_runtime;

CREATE OR REPLACE FUNCTION is_shop_owner()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_users
        WHERE id = auth.uid() AND is_active = TRUE AND role = 'owner'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION is_shop_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_shop_owner() TO authenticated, ps01_runtime;

CREATE OR REPLACE FUNCTION is_shop_manager_or_owner()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_users
        WHERE id = auth.uid() AND is_active = TRUE AND role IN ('owner', 'manager')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION is_shop_manager_or_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_shop_manager_or_owner() TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION enqueue_sync_event(UUID, VARCHAR, UUID, VARCHAR, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION enqueue_sync_event(UUID, VARCHAR, UUID, VARCHAR, JSONB) TO ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION create_booking(UUID, UUID, DATE, DATE, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_booking(UUID, UUID, DATE, DATE, NUMERIC, TEXT) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION add_pet_to_booking(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_pet_to_booking(UUID, UUID) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION remove_pet_from_booking(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_pet_from_booking(UUID, UUID) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION update_booking_status(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_booking_status(UUID, VARCHAR) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION update_booking_schedule(UUID, UUID, DATE, DATE, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_booking_schedule(UUID, UUID, DATE, DATE, TEXT, NUMERIC) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION create_daily_report(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT[], TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_daily_report(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT[], TEXT, UUID) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION retry_daily_report_delivery(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION retry_daily_report_delivery(UUID) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION create_room(VARCHAR, VARCHAR, INT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_room(VARCHAR, VARCHAR, INT, NUMERIC) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION update_room_config(UUID, VARCHAR, VARCHAR, INT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_room_config(UUID, VARCHAR, VARCHAR, INT, NUMERIC) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION set_room_maintenance(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_room_maintenance(UUID, DATE, DATE) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION mark_room_clean(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_room_clean(UUID) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION create_pet_owner(VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_pet_owner(VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION update_pet_owner_profile(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_pet_owner_profile(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION create_pet(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,DATE,NUMERIC,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_pet(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,DATE,NUMERIC,TEXT,TEXT,TEXT) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION update_pet_profile(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,DATE,NUMERIC,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_pet_profile(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,DATE,NUMERIC,TEXT,TEXT,TEXT) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION transfer_pet_owner(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transfer_pet_owner(UUID,UUID) TO authenticated, ps01_runtime;

CREATE OR REPLACE FUNCTION prevent_active_pet_owner_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id AND EXISTS (
        SELECT 1 FROM booking_pets bp JOIN bookings b ON b.id=bp.booking_id AND b.shop_id=bp.shop_id
        WHERE bp.pet_id=OLD.id AND bp.shop_id=OLD.shop_id AND b.booking_status IN ('confirmed','checked_in')
    ) THEN RAISE EXCEPTION 'Mutation Lock Violation: active booking exists.'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = ps01, extensions, pg_temp;
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION delete_pet(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_pet(UUID) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION delete_pet_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_pet_owner(UUID) TO authenticated, ps01_runtime;
-- DB backstop for the documented immutable booking owner invariant.
CREATE OR REPLACE FUNCTION prevent_booking_owner_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
        RAISE EXCEPTION 'Mutation Lock Violation: bookings.owner_id is immutable.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = ps01, extensions, pg_temp;
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

-- END LEGACY SOURCE: 20260820020000_phase2_authoritative_gateways.sql


-- BEGIN LEGACY SOURCE: 20260820030000_phase3_auth_tenant.sql
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
$$ LANGUAGE plpgsql SET search_path = ps01, extensions, pg_temp;

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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION get_current_staff_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_staff_context() TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION bootstrap_shop(VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bootstrap_shop(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION create_staff_membership(UUID, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_staff_membership(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION disable_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION disable_staff(UUID) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION enable_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enable_staff(UUID) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION change_staff_role(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION change_staff_role(UUID, VARCHAR) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION remove_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_staff(UUID) TO authenticated, ps01_runtime;

-- END LEGACY SOURCE: 20260820030000_phase3_auth_tenant.sql


-- BEGIN LEGACY SOURCE: 20260820221500_phase5_line_claim.sql
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION generate_line_claim_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_line_claim_token(UUID) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION reset_line_link(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_line_link(UUID) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION consume_line_claim_token_internal(TEXT, VARCHAR, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_line_claim_token_internal(TEXT, VARCHAR, UUID)
    TO ps01_runtime;

-- END LEGACY SOURCE: 20260820221500_phase5_line_claim.sql


-- BEGIN LEGACY SOURCE: 20260820233000_phase6_daily_report_line_delivery.sql
-- PawSpace V1 Phase 6 — Daily Report media bucket + authoritative LINE worker lifecycle
-- Source of truth: docs/PRD.md + docs/SYSTEM_ARCHITECTURE.md

ALTER TABLE daily_reports
    ADD COLUMN IF NOT EXISTS line_first_attempt_at TIMESTAMPTZ;

COMMENT ON COLUMN daily_reports.line_first_attempt_at IS
    'First request attempt sent to LINE; used to enforce LINE retry-key 24h safety window.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ps01-daily-report-photos',
    'ps01-daily-report-photos',
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION claim_line_delivery_internal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_line_delivery_internal() TO ps01_runtime;
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION mark_line_delivery_sent_internal(UUID, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_line_delivery_sent_internal(UUID, UUID) TO ps01_runtime;
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION mark_line_delivery_failed_internal(UUID, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_line_delivery_failed_internal(UUID, UUID, TEXT) TO ps01_runtime;

-- END LEGACY SOURCE: 20260820233000_phase6_daily_report_line_delivery.sql


-- BEGIN LEGACY SOURCE: 20260821094000_phase7_google_sheets_sync.sql
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION generate_google_sheet_claim_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_google_sheet_claim_token() TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION connect_google_sheet_internal(TEXT, VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION connect_google_sheet_internal(TEXT, VARCHAR, UUID) TO ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION disconnect_google_sheet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION disconnect_google_sheet() TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION claim_google_sync_event_internal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_google_sync_event_internal() TO ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION mark_google_sync_completed_internal(UUID, VARCHAR, VARCHAR, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_google_sync_completed_internal(UUID, VARCHAR, VARCHAR, TEXT)
    TO ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION mark_google_sync_failed_internal(UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_google_sync_failed_internal(UUID, TEXT)
    TO ps01_runtime;

-- Browser table mutation remains forbidden. Phase 2 grants only tenant-scoped SELECT.
-- Internal worker RPCs above are service-role only and keep sync_queue/google_sync_mappings authoritative.

-- END LEGACY SOURCE: 20260821094000_phase7_google_sheets_sync.sql


-- BEGIN LEGACY SOURCE: 20260821150000_phase8_camera_access.sql
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

GRANT SELECT, INSERT, UPDATE, DELETE ON camera_settings, camera_visitor_credentials, camera_rate_limit_buckets TO ps01_runtime;
GRANT SELECT, INSERT ON camera_access_audit TO ps01_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON camera_access_audit FROM ps01_runtime;

CREATE OR REPLACE FUNCTION prevent_camera_access_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'camera_access_audit is append-only.';
END;
$$ LANGUAGE plpgsql SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION prevent_camera_access_audit_mutation() FROM PUBLIC, anon, authenticated, ps01_runtime;

CREATE TRIGGER trg_camera_access_audit_no_update_delete
BEFORE UPDATE OR DELETE ON camera_access_audit
FOR EACH ROW EXECUTE FUNCTION prevent_camera_access_audit_mutation();

CREATE TRIGGER trg_camera_access_audit_no_truncate
BEFORE TRUNCATE ON camera_access_audit
FOR EACH STATEMENT EXECUTE FUNCTION prevent_camera_access_audit_mutation();

CREATE OR REPLACE FUNCTION camera_rate_window_start(p_now TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
    SELECT to_timestamp(floor(extract(epoch FROM p_now) / 600.0) * 600.0);
$$ LANGUAGE sql IMMUTABLE SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION camera_rate_window_start(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION camera_rate_window_start(TIMESTAMPTZ) TO ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION rotate_camera_visitor_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rotate_camera_visitor_code() TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION set_camera_feed_config(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_camera_feed_config(TEXT, BOOLEAN) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION get_camera_staff_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_camera_staff_settings() TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION verify_camera_visitor_code_internal(UUID, VARCHAR, VARCHAR)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_camera_visitor_code_internal(UUID, VARCHAR, VARCHAR)
    TO ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION get_camera_feed_internal(UUID, BIGINT, VARCHAR, VARCHAR)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_camera_feed_internal(UUID, BIGINT, VARCHAR, VARCHAR)
    TO ps01_runtime;

-- Browser clients have no direct SELECT/INSERT/UPDATE/DELETE privileges on any camera table.
-- Public camera access is possible only through trusted server routes calling the service-role-only internal RPCs.

-- END LEGACY SOURCE: 20260821150000_phase8_camera_access.sql


-- BEGIN LEGACY SOURCE: 20260821160000_phase9_commercial_entitlements.sql
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
    ELSIF auth.role() = 'ps01_runtime' THEN
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION get_shop_effective_entitlement(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_shop_effective_entitlement(UUID) TO authenticated, ps01_runtime;
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION get_owner_manager_dashboard_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_owner_manager_dashboard_summary() TO authenticated;


-- END LEGACY SOURCE: 20260821160000_phase9_commercial_entitlements.sql


-- BEGIN LEGACY SOURCE: 20260822000000_phase11_customer_booking_requests.sql
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

GRANT SELECT ON TABLE booking_requests TO authenticated, ps01_runtime;
GRANT ALL ON TABLE booking_requests TO ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION submit_booking_request_internal(VARCHAR, UUID, UUID, UUID[], DATE, DATE, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_booking_request_internal(VARCHAR, UUID, UUID, UUID[], DATE, DATE, TEXT)
    TO ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION get_customer_booking_context_internal(VARCHAR, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_customer_booking_context_internal(VARCHAR, UUID)
    TO ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION confirm_booking_request(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_booking_request(UUID, UUID) TO authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION decline_booking_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decline_booking_request(UUID, TEXT) TO authenticated, ps01_runtime;

-- END LEGACY SOURCE: 20260822000000_phase11_customer_booking_requests.sql


-- BEGIN LEGACY SOURCE: 20260823170000_phase12_pilot_onboarding.sql
-- PawSpace V1 Phase 12 - Pilot Onboarding & Closed Beta Readiness
-- Source of truth: docs/PRD.md + Phase 12 Implementation Brief & Gate 1 Remediation

-- 1. Authoritative Shop Profile Update RPC
CREATE OR REPLACE FUNCTION update_shop_profile(
    p_name VARCHAR,
    p_phone VARCHAR DEFAULT NULL,
    p_line_oa_id VARCHAR DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only an active shop owner or manager can update shop profile.';
    END IF;

    IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
        RAISE EXCEPTION 'Invalid Parameter: Shop name cannot be empty.';
    END IF;

    UPDATE shops
    SET name = trim(p_name),
        phone = nullif(trim(p_phone), ''),
        line_oa_id = nullif(trim(p_line_oa_id), '')
    WHERE id = v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION update_shop_profile(VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_shop_profile(VARCHAR, VARCHAR, VARCHAR) TO authenticated, ps01_runtime;


-- 2. Persistent Import Audit Batches
CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    format VARCHAR(20) NOT NULL DEFAULT 'csv',
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
    total_rows INT NOT NULL DEFAULT 0,
    created_customers INT NOT NULL DEFAULT 0,
    created_pets INT NOT NULL DEFAULT 0,
    skipped_duplicates INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE import_batches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE import_batches TO authenticated;

CREATE POLICY staff_select_import_batches ON import_batches
    FOR SELECT TO authenticated
    USING (shop_id = current_staff_shop_id() AND is_shop_manager_or_owner());


-- 3. Authoritative Atomic Customer + Pet Import RPC (Strict Source-Row Semantics)
CREATE OR REPLACE FUNCTION import_customers_and_pets_atomic(
    p_records JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_shop_id UUID;
    v_caller_id UUID;
    v_batch_id UUID;
    v_item JSONB;
    v_pet JSONB;
    v_cust_phone VARCHAR;
    v_cust_first_name VARCHAR;
    v_cust_last_name VARCHAR;
    v_cust_emergency VARCHAR;
    v_cust_address TEXT;
    v_owner_id UUID;
    v_existing_first_name VARCHAR;
    v_pet_name VARCHAR;
    v_pet_species VARCHAR;
    v_pet_breed VARCHAR;
    v_pet_gender VARCHAR;
    v_pet_birth_date DATE;
    v_pet_weight NUMERIC;
    v_pet_notes TEXT;
    v_pet_allergies TEXT;
    v_pet_id UUID;
    v_created_customers INT := 0;
    v_created_pets INT := 0;
    v_skipped_duplicates INT := 0;
    v_total_rows INT := 0;
BEGIN
    v_shop_id := current_staff_shop_id();
    v_caller_id := auth.uid();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only an active shop owner or manager can import data.';
    END IF;

    IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' OR jsonb_array_length(p_records) = 0 THEN
        RAISE EXCEPTION 'Invalid Parameter: Import records array cannot be empty.';
    END IF;
    IF jsonb_array_length(p_records) > 2000 THEN
        RAISE EXCEPTION 'IMPORT_ROW_LIMIT_EXCEEDED: Import cannot exceed 2000 source rows.';
    END IF;

    -- Authoritative source row count: strictly derived from JSONB array length of validated records
    v_total_rows := jsonb_array_length(p_records);

    -- Loop through each validated source CSV row
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records) LOOP
        IF v_item->'customer' IS NULL OR jsonb_typeof(v_item->'customer') <> 'object' THEN
            RAISE EXCEPTION 'Validation Error: Customer object is required for each source row.';
        END IF;

        v_cust_phone := trim(v_item->'customer'->>'phone');
        v_cust_first_name := trim(v_item->'customer'->>'firstName');
        v_cust_last_name := nullif(trim(v_item->'customer'->>'lastName'), '');
        v_cust_emergency := nullif(trim(v_item->'customer'->>'emergencyPhone'), '');
        v_cust_address := nullif(trim(v_item->'customer'->>'address'), '');

        IF v_cust_phone IS NULL OR length(v_cust_phone) = 0 THEN
            RAISE EXCEPTION 'Validation Error: Customer phone is required.';
        END IF;
        IF v_cust_phone !~ '^[0-9]{9,15}$' THEN
            RAISE EXCEPTION 'Validation Error: Customer phone must be a normalized 9-15 digit value.';
        END IF;
        IF v_cust_first_name IS NULL OR length(v_cust_first_name) = 0 THEN
            RAISE EXCEPTION 'Validation Error: Customer first name is required.';
        END IF;

        -- Check existing customer with same phone in this tenant
        SELECT id, first_name INTO v_owner_id, v_existing_first_name
        FROM pet_owners
        WHERE shop_id = v_shop_id AND phone = v_cust_phone;

        IF v_owner_id IS NOT NULL THEN
            -- Deterministic Identity Conflict Check: First name must match existing/earlier record
            IF lower(trim(v_existing_first_name)) <> lower(trim(v_cust_first_name)) THEN
                RAISE EXCEPTION 'Identity Conflict: Phone % already belongs to "%", but CSV provides "%".',
                    v_cust_phone, v_existing_first_name, v_cust_first_name;
            END IF;
        ELSE
            -- Create new pet owner
            INSERT INTO pet_owners (shop_id, first_name, last_name, phone, emergency_phone, address)
            VALUES (v_shop_id, v_cust_first_name, v_cust_last_name, v_cust_phone, v_cust_emergency, v_cust_address)
            RETURNING id INTO v_owner_id;

            v_created_customers := v_created_customers + 1;
        END IF;

        -- Process pet for this row if present. Direct RPC callers must satisfy the
        -- same semantic contract as validated CSV callers; malformed pet payloads
        -- are never silently downgraded to customer-only rows.
        IF v_item ? 'pet' AND v_item->'pet' IS NOT NULL THEN
            IF jsonb_typeof(v_item->'pet') <> 'object' THEN
                RAISE EXCEPTION 'Validation Error: Pet must be an object or null.';
            END IF;

            v_pet := v_item->'pet';
            v_pet_name := trim(v_pet->>'name');
            v_pet_species := trim(v_pet->>'species');
            v_pet_breed := nullif(trim(v_pet->>'breed'), '');
            v_pet_gender := nullif(trim(v_pet->>'gender'), '');
            v_pet_birth_date := nullif(v_pet->>'birthDate', '')::DATE;
            v_pet_weight := nullif(v_pet->>'weightKg', '')::NUMERIC;
            v_pet_notes := nullif(trim(v_pet->>'specialCareNotes'), '');
            v_pet_allergies := nullif(trim(v_pet->>'allergies'), '');

            IF v_pet_name IS NULL OR length(v_pet_name) = 0 THEN
                RAISE EXCEPTION 'Validation Error: Pet name is required when pet data is provided.';
            END IF;
            IF v_pet_species NOT IN ('dog', 'cat') THEN
                RAISE EXCEPTION 'Validation Error: Pet species must be dog or cat.';
            END IF;
            IF v_pet_gender IS NOT NULL AND v_pet_gender NOT IN ('male', 'female', 'neutered_male', 'spayed_female') THEN
                RAISE EXCEPTION 'Validation Error: Pet gender is invalid.';
            END IF;
            IF v_pet_weight IS NOT NULL AND v_pet_weight < 0 THEN
                RAISE EXCEPTION 'Validation Error: Pet weight must be non-negative.';
            END IF;

            -- Check if pet already exists for this owner
            IF EXISTS (
                SELECT 1 FROM pets
                WHERE shop_id = v_shop_id
                  AND owner_id = v_owner_id
                  AND lower(name) = lower(v_pet_name)
                  AND species = v_pet_species
            ) THEN
                v_skipped_duplicates := v_skipped_duplicates + 1;
            ELSE
                INSERT INTO pets (
                    shop_id, owner_id, name, species, breed, gender,
                    birth_date, weight_kg, special_care_notes, allergies
                )
                VALUES (
                    v_shop_id, v_owner_id, v_pet_name, v_pet_species, v_pet_breed, v_pet_gender,
                    v_pet_birth_date, v_pet_weight, v_pet_notes, v_pet_allergies
                )
                RETURNING id INTO v_pet_id;

                PERFORM enqueue_sync_event(v_shop_id, 'pet_customer', v_pet_id, 'UPSERT', jsonb_build_object('pet_id', v_pet_id));
                v_created_pets := v_created_pets + 1;
            END IF;
        END IF;
    END LOOP;

    -- Record successful audit batch
    INSERT INTO import_batches (
        shop_id, performed_by, format, status, total_rows,
        created_customers, created_pets, skipped_duplicates
    )
    VALUES (
        v_shop_id, v_caller_id, 'csv', 'completed', v_total_rows,
        v_created_customers, v_created_pets, v_skipped_duplicates
    )
    RETURNING id INTO v_batch_id;

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', v_batch_id,
        'total_processed', v_total_rows,
        'created_customers', v_created_customers,
        'created_pets', v_created_pets,
        'skipped_duplicates', v_skipped_duplicates
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION import_customers_and_pets_atomic(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION import_customers_and_pets_atomic(JSONB) TO authenticated, ps01_runtime;

-- END LEGACY SOURCE: 20260823170000_phase12_pilot_onboarding.sql


-- BEGIN LEGACY SOURCE: 20260825141500_phase13_subscription_lifecycle.sql
-- PawSpace Phase 13: authoritative subscription lifecycle + entitlement enforcement.
-- Provider-agnostic by design. Payment truth is not created in this migration.

-- Replace the Phase 1 check before normalizing legacy `trial` rows. The
-- historical constraint accepts `trial` but rejects canonical `trialing`, so
-- the normalization must not run while that constraint remains active.
-- The prevent_legacy_subscription_status_write trigger does not exist yet at
-- this point in the migration, so no set_config bypass is needed here.
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_subscription_status_check;
UPDATE shops SET subscription_status='trialing' WHERE subscription_status='trial';
ALTER TABLE shops ADD CONSTRAINT shops_subscription_status_check CHECK (
  subscription_status IN (
    'trialing','active','past_due','grace_period','suspended',
    'cancel_at_period_end','cancelled','expired'
  )
);

CREATE TABLE shop_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  package_id VARCHAR(50) NOT NULL REFERENCES commercial_packages(id),
  commercial_offer VARCHAR(50) NOT NULL DEFAULT 'standard'
    CHECK (commercial_offer IN ('standard','founding_member')),
  billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly','annual')),
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'trialing','active','past_due','grace_period','suspended',
    'cancel_at_period_end','cancelled','expired'
  )),
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  grace_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  founding_member_continuity_valid BOOLEAN NOT NULL DEFAULT TRUE,
  last_transition_source VARCHAR(50) NOT NULL DEFAULT 'migration'
    CHECK (last_transition_source IN ('bootstrap','migration','manual_admin','system','future_billing_event')),
  last_transition_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT founding_member_requires_starter
    CHECK (commercial_offer <> 'founding_member' OR package_id = 'starter'),
  CONSTRAINT valid_trial_window CHECK (
    trial_started_at IS NULL OR trial_ends_at IS NULL OR trial_ends_at > trial_started_at
  ),
  CONSTRAINT valid_period_window CHECK (
    current_period_start IS NULL OR current_period_end IS NULL OR current_period_end > current_period_start
  )
);

CREATE TABLE subscription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES shop_subscriptions(id) ON DELETE CASCADE,
  actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('system','ps01_runtime','platform_admin','future_billing_event')),
  actor_id UUID,
  action VARCHAR(100) NOT NULL,
  previous_status VARCHAR(50),
  resulting_status VARCHAR(50),
  previous_package_id VARCHAR(50),
  resulting_package_id VARCHAR(50),
  previous_offer VARCHAR(50),
  resulting_offer VARCHAR(50),
  transition_source VARCHAR(50) NOT NULL CHECK (
    transition_source IN ('bootstrap','migration','manual_admin','system','future_billing_event')
  ),
  reason TEXT,
  idempotency_key UUID,
  request_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, idempotency_key)
);

CREATE INDEX idx_subscription_audit_shop_created
  ON subscription_audit_log(shop_id, created_at DESC);

ALTER TABLE shop_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON shop_subscriptions FROM PUBLIC, anon, authenticated, ps01_runtime;
REVOKE ALL ON subscription_audit_log FROM PUBLIC, anon, authenticated, ps01_runtime;
GRANT SELECT ON shop_subscriptions TO authenticated, ps01_runtime;
GRANT SELECT ON subscription_audit_log TO ps01_runtime;

CREATE POLICY shop_subscriptions_owner_manager_read ON shop_subscriptions
  FOR SELECT TO authenticated
  USING (shop_id = current_staff_shop_id() AND is_shop_manager_or_owner());

CREATE OR REPLACE FUNCTION sync_legacy_subscription_status(p_shop_id UUID, p_status VARCHAR)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('pawspace.subscription_mirror_write','1',true);
  UPDATE shops SET subscription_status = p_status WHERE id = p_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;REVOKE ALL ON FUNCTION sync_legacy_subscription_status(UUID,VARCHAR) FROM PUBLIC, anon, authenticated, ps01_runtime;

CREATE OR REPLACE FUNCTION prevent_legacy_subscription_status_write()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.subscription_status IS DISTINCT FROM NEW.subscription_status
     AND current_setting('pawspace.subscription_mirror_write', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'SUBSCRIPTION_STATUS_IS_DERIVED: use authoritative subscription lifecycle RPCs.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION prevent_legacy_subscription_status_write() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_prevent_legacy_subscription_status_write
BEFORE UPDATE OF subscription_status ON shops
FOR EACH ROW EXECUTE FUNCTION prevent_legacy_subscription_status_write();

INSERT INTO shop_subscriptions (
  shop_id, package_id, commercial_offer, billing_interval, status,
  trial_started_at, trial_ends_at, founding_member_continuity_valid,
  last_transition_source, last_transition_reason
)
SELECT
  s.id,
  COALESCE(sca.package_id, 'starter'),
  COALESCE(sca.commercial_offer, 'standard'),
  COALESCE(sca.billing_interval, 'monthly'),
  CASE
    WHEN s.subscription_status = 'active' THEN 'active'
    WHEN s.subscription_status = 'past_due' THEN 'past_due'
    WHEN s.created_at + interval '30 days' <= now() THEN 'expired'
    ELSE 'trialing'
  END,
  s.created_at,
  s.created_at + interval '30 days',
  TRUE,
  'migration',
  'Phase 13 backfill from legacy shop status and Phase 9 assignment'
FROM shops s
LEFT JOIN shop_commercial_assignments sca
  ON sca.shop_id = s.id AND sca.is_active = TRUE
ON CONFLICT (shop_id) DO NOTHING;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT shop_id, status FROM shop_subscriptions LOOP
    PERFORM sync_legacy_subscription_status(r.shop_id, r.status);
  END LOOP;
END $$;

-- Belt-and-suspenders normalization after the trigger is in place.
-- prevent_legacy_subscription_status_write blocks direct UPDATE on subscription_status
-- unless pawspace.subscription_mirror_write='1' is set for the current transaction.
SELECT set_config('pawspace.subscription_mirror_write','1',true);
UPDATE shops SET subscription_status='trialing' WHERE subscription_status='trial';

ALTER TABLE shops ALTER COLUMN subscription_status SET DEFAULT 'trialing';
ALTER TABLE shops DROP CONSTRAINT shops_subscription_status_check;
ALTER TABLE shops ADD CONSTRAINT shops_subscription_status_check CHECK (
  subscription_status IN (
    'trialing','active','past_due','grace_period','suspended',
    'cancel_at_period_end','cancelled','expired'
  )
);

INSERT INTO subscription_audit_log (
  shop_id, subscription_id, actor_type, action,
  previous_status, resulting_status,
  previous_package_id, resulting_package_id,
  previous_offer, resulting_offer,
  transition_source, reason
)
SELECT
  ss.shop_id, ss.id, 'system', 'subscription.migrated',
  NULL, ss.status, NULL, ss.package_id, NULL, ss.commercial_offer,
  'migration', 'Phase 13 authoritative subscription initialized from existing shop state'
FROM shop_subscriptions ss
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_audit_log sal
  WHERE sal.subscription_id = ss.id AND sal.action = 'subscription.migrated'
);
CREATE OR REPLACE FUNCTION resolve_shop_commercial_authority(p_shop_id UUID)
RETURNS JSONB AS $$
DECLARE
  ss shop_subscriptions%ROWTYPE;
  cp commercial_packages%ROWTYPE;
  pro commercial_packages%ROWTYPE;
  v_access BOOLEAN := FALSE;
  v_room_limit INT;
  v_pet_limit INT;
  v_package_name VARCHAR(100);
  v_monthly_price INT;
  v_annual_price INT;
  v_support_tier VARCHAR(50);
  v_block_reason TEXT;
BEGIN
  SELECT * INTO ss FROM shop_subscriptions WHERE shop_id = p_shop_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'shop_id', p_shop_id, 'subscription_id', NULL, 'package_id', 'starter',
      'package_name', 'Starter', 'commercial_offer', 'standard',
      'lifecycle_status', 'expired', 'commercial_access', FALSE,
      'room_limit', 10, 'pet_history_limit', 300,
      'monthly_price', 990, 'annual_price', 9900,
      'support_tier', NULL, 'future_paid_addons_included', FALSE,
      'blocked_reason', 'missing_subscription'
    );
  END IF;
  SELECT * INTO cp FROM commercial_packages WHERE id = ss.package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMMERCIAL_CONFIGURATION_INVALID: package definition missing.';
  END IF;

  v_access := CASE ss.status
    WHEN 'trialing' THEN ss.trial_ends_at IS NOT NULL AND now() < ss.trial_ends_at
    WHEN 'active' THEN TRUE
    WHEN 'past_due' THEN TRUE
    WHEN 'grace_period' THEN ss.grace_period_end IS NOT NULL AND now() < ss.grace_period_end
    WHEN 'cancel_at_period_end' THEN ss.current_period_end IS NOT NULL AND now() < ss.current_period_end
    ELSE FALSE
  END;

  v_block_reason := CASE
    WHEN v_access THEN NULL
    WHEN ss.status = 'trialing' AND ss.trial_ends_at IS NOT NULL AND now() >= ss.trial_ends_at THEN 'trial_expired'
    WHEN ss.status = 'grace_period' AND ss.grace_period_end IS NOT NULL AND now() >= ss.grace_period_end THEN 'grace_expired'
    WHEN ss.status = 'cancel_at_period_end' AND ss.current_period_end IS NOT NULL AND now() >= ss.current_period_end THEN 'period_ended'
    ELSE ss.status
  END;

  IF ss.commercial_offer = 'founding_member' AND ss.founding_member_continuity_valid THEN
    SELECT * INTO pro FROM commercial_packages WHERE id = 'pro';
    IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCIAL_CONFIGURATION_INVALID: Pro package missing.'; END IF;
    v_room_limit := pro.room_limit;
    v_pet_limit := pro.pet_history_limit;
    v_package_name := 'Starter (Founding Member Pro)';
    v_monthly_price := 990;
    v_annual_price := NULL;
    v_support_tier := NULL;
  ELSE
    v_room_limit := cp.room_limit;
    v_pet_limit := cp.pet_history_limit;
    v_package_name := cp.name;
    v_monthly_price := cp.monthly_price;
    v_annual_price := cp.annual_price;
    v_support_tier := cp.support_tier;
  END IF;

  RETURN jsonb_build_object(
    'shop_id', ss.shop_id,
    'subscription_id', ss.id,
    'package_id', ss.package_id,
    'package_name', v_package_name,
    'commercial_offer', ss.commercial_offer,
    'lifecycle_status', ss.status,
    'commercial_access', v_access,
    'room_limit', v_room_limit,
    'pet_history_limit', v_pet_limit,
    'monthly_price', v_monthly_price,
    'annual_price', v_annual_price,
    'support_tier', v_support_tier,
    'future_paid_addons_included', FALSE,
    'trial_ends_at', ss.trial_ends_at,
    'current_period_end', ss.current_period_end,
    'grace_period_end', ss.grace_period_end,
    'founding_member_continuity_valid', ss.founding_member_continuity_valid,
    'blocked_reason', v_block_reason,
    'current_room_usage', (SELECT COUNT(*) FROM rooms r WHERE r.shop_id = ss.shop_id),
    'current_pet_usage', (SELECT COUNT(*) FROM pets p WHERE p.shop_id = ss.shop_id)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION resolve_shop_commercial_authority(UUID) FROM PUBLIC, anon, authenticated, ps01_runtime;

CREATE OR REPLACE FUNCTION get_shop_commercial_status(p_shop_id UUID)
RETURNS JSONB AS $$
DECLARE v_staff_shop UUID;
BEGIN
  IF auth.role() = 'authenticated' THEN
    v_staff_shop := current_staff_shop_id();
    IF v_staff_shop IS NULL OR v_staff_shop <> p_shop_id OR NOT is_shop_manager_or_owner() THEN
      RAISE EXCEPTION 'Unauthorized: owner/manager membership for this shop is required.';
    END IF;
  ELSIF auth.role() <> 'ps01_runtime' THEN
    RAISE EXCEPTION 'Unauthorized commercial status query.';
  END IF;
  RETURN resolve_shop_commercial_authority(p_shop_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION get_shop_commercial_status(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_shop_commercial_status(UUID) TO authenticated, ps01_runtime;
CREATE OR REPLACE FUNCTION get_shop_effective_entitlement(p_shop_id UUID)
RETURNS TABLE (
  shop_id UUID, package_id VARCHAR(50), package_name VARCHAR(100),
  commercial_offer VARCHAR(50), monthly_price INTEGER, annual_price INTEGER,
  room_limit INTEGER, pet_history_limit INTEGER, support_tier VARCHAR(50),
  future_paid_addons_included BOOLEAN
) AS $$
DECLARE
  v_staff_shop UUID;
  v JSONB;
BEGIN
  IF auth.role() = 'authenticated' THEN
    v_staff_shop := current_staff_shop_id();
    IF v_staff_shop IS NULL OR v_staff_shop <> p_shop_id OR NOT is_shop_manager_or_owner() THEN
      RAISE EXCEPTION 'Unauthorized: owner/manager membership for this shop is required.';
    END IF;
  ELSIF auth.role() <> 'ps01_runtime' THEN
    RAISE EXCEPTION 'Unauthorized entitlement query.';
  END IF;

  v := resolve_shop_commercial_authority(p_shop_id);
  RETURN QUERY SELECT
    p_shop_id,
    (v->>'package_id')::VARCHAR(50),
    (v->>'package_name')::VARCHAR(100),
    (v->>'commercial_offer')::VARCHAR(50),
    (v->>'monthly_price')::INTEGER,
    NULLIF(v->>'annual_price','')::INTEGER,
    NULLIF(v->>'room_limit','')::INTEGER,
    NULLIF(v->>'pet_history_limit','')::INTEGER,
    NULLIF(v->>'support_tier','')::VARCHAR(50),
    FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION get_shop_effective_entitlement(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_shop_effective_entitlement(UUID) TO authenticated, ps01_runtime;

CREATE OR REPLACE FUNCTION initialize_shop_subscription_internal(p_shop_id UUID)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM shop_subscriptions WHERE shop_id = p_shop_id;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  INSERT INTO shop_subscriptions (
    shop_id, package_id, commercial_offer, billing_interval, status,
    trial_started_at, trial_ends_at,
    last_transition_source, last_transition_reason
  )
  VALUES (
    p_shop_id, 'starter', 'standard', 'monthly', 'trialing',
    now(), now() + interval '30 days',
    'bootstrap', '30-day trial initialized with shop creation'
  )
  RETURNING id INTO v_id;

  PERFORM sync_legacy_subscription_status(p_shop_id, 'trialing');
  INSERT INTO subscription_audit_log (
    shop_id, subscription_id, actor_type, action,
    resulting_status, resulting_package_id, resulting_offer,
    transition_source, reason
  )
  SELECT p_shop_id, v_id, 'system', 'subscription.initialized',
         'trialing', 'starter', 'standard', 'bootstrap',
         '30-day trial initialized with shop creation'
  WHERE NOT EXISTS (
    SELECT 1 FROM subscription_audit_log
    WHERE subscription_id = v_id AND action = 'subscription.initialized'
  );
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION initialize_shop_subscription_internal(UUID) FROM PUBLIC, anon, authenticated, ps01_runtime;

CREATE OR REPLACE FUNCTION initialize_shop_subscription_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_shop_subscription_internal(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION initialize_shop_subscription_after_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_initialize_shop_subscription_after_insert
AFTER INSERT ON shops
FOR EACH ROW EXECUTE FUNCTION initialize_shop_subscription_after_insert();

CREATE OR REPLACE FUNCTION set_shop_commercial_package(
  p_shop_id UUID,
  p_package_id VARCHAR,
  p_commercial_offer VARCHAR,
  p_source VARCHAR,
  p_reason TEXT,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  ss shop_subscriptions%ROWTYPE;
  v_actor_type VARCHAR(50);
BEGIN
  IF auth.role() <> 'ps01_runtime' THEN
    RAISE EXCEPTION 'Unauthorized commercial package mutation.';
  END IF;
  IF p_source NOT IN ('manual_admin','system','future_billing_event') THEN
    RAISE EXCEPTION 'Invalid transition source.';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Invalid transition reason.';
  END IF;
  IF p_source = 'manual_admin' AND p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Manual admin transition requires actor id.';
  END IF;
  IF p_commercial_offer NOT IN ('standard','founding_member') THEN
    RAISE EXCEPTION 'Invalid commercial offer.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM commercial_packages WHERE id = p_package_id) THEN
    RAISE EXCEPTION 'Unknown commercial package.';
  END IF;
  IF p_commercial_offer = 'founding_member' AND p_package_id <> 'starter' THEN
    RAISE EXCEPTION 'Founding Member must use Starter commercial package identity.';
  END IF;

  SELECT * INTO ss FROM shop_subscriptions WHERE shop_id = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found for shop.'; END IF;
  IF p_commercial_offer = 'founding_member' AND NOT ss.founding_member_continuity_valid THEN
    RAISE EXCEPTION 'Founding Member continuity has lapsed and cannot be restored.';
  END IF;

  v_actor_type := CASE p_source
    WHEN 'future_billing_event' THEN 'future_billing_event'
    WHEN 'manual_admin' THEN 'platform_admin'
    ELSE 'ps01_runtime'
  END;
  UPDATE shop_subscriptions
  SET package_id = p_package_id,
      commercial_offer = p_commercial_offer,
      updated_at = now(),
      last_transition_source = p_source,
      last_transition_reason = p_reason
  WHERE id = ss.id;

  INSERT INTO shop_commercial_assignments(
    shop_id, package_id, commercial_offer, billing_interval, is_active
  ) VALUES (
    p_shop_id, p_package_id, p_commercial_offer, 'monthly', TRUE
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    package_id = EXCLUDED.package_id,
    commercial_offer = EXCLUDED.commercial_offer,
    is_active = TRUE,
    updated_at = now();

  INSERT INTO subscription_audit_log (
    shop_id, subscription_id, actor_type, actor_id, action,
    previous_status, resulting_status,
    previous_package_id, resulting_package_id,
    previous_offer, resulting_offer,
    transition_source, reason
  ) VALUES (
    p_shop_id, ss.id, v_actor_type, p_actor_id, 'subscription.package_changed',
    ss.status, ss.status,
    ss.package_id, p_package_id,
    ss.commercial_offer, p_commercial_offer,
    p_source, p_reason
  );
  RETURN resolve_shop_commercial_authority(p_shop_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION set_shop_commercial_package(UUID,VARCHAR,VARCHAR,VARCHAR,TEXT,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_shop_commercial_package(UUID,VARCHAR,VARCHAR,VARCHAR,TEXT,UUID)
  TO ps01_runtime;

CREATE OR REPLACE FUNCTION transition_shop_subscription(
  p_shop_id UUID,
  p_to_status VARCHAR,
  p_source VARCHAR,
  p_reason TEXT,
  p_idempotency_key UUID DEFAULT NULL,
  p_current_period_end TIMESTAMPTZ DEFAULT NULL,
  p_grace_period_end TIMESTAMPTZ DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  ss shop_subscriptions%ROWTYPE;
  v_allowed BOOLEAN := FALSE;
  v_actor_type VARCHAR(50);
  v_fingerprint TEXT;
  v_existing subscription_audit_log%ROWTYPE;
  v_new_period_start TIMESTAMPTZ;
  v_new_period_end TIMESTAMPTZ;
  v_new_grace_end TIMESTAMPTZ;
  v_cancel_at_period_end BOOLEAN;
  v_cancelled_at TIMESTAMPTZ;
  v_suspended_at TIMESTAMPTZ;
  v_continuity BOOLEAN;
  v_new_offer VARCHAR(50);
BEGIN
  IF auth.role() <> 'ps01_runtime' THEN
    RAISE EXCEPTION 'Unauthorized subscription transition.';
  END IF;
  IF p_source NOT IN ('manual_admin','system','future_billing_event') THEN
    RAISE EXCEPTION 'Invalid transition source.';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Invalid transition reason.';
  END IF;
  IF p_source = 'manual_admin' AND p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Manual admin transition requires actor id.';
  END IF;
  IF p_to_status NOT IN (
    'trialing','active','past_due','grace_period','suspended',
    'cancel_at_period_end','cancelled','expired'
  ) THEN
    RAISE EXCEPTION 'Invalid subscription lifecycle status.';
  END IF;

  SELECT * INTO ss FROM shop_subscriptions WHERE shop_id = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found for shop.'; END IF;

  v_fingerprint := md5(concat_ws('|', p_to_status, p_source, COALESCE(p_reason,''),
    COALESCE(p_current_period_end::text,''), COALESCE(p_grace_period_end::text,''), COALESCE(p_actor_id::text,'')));
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM subscription_audit_log
    WHERE subscription_id = ss.id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      IF v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
        RAISE EXCEPTION 'SUBSCRIPTION_IDEMPOTENCY_CONFLICT';
      END IF;
      RETURN resolve_shop_commercial_authority(p_shop_id);
    END IF;
  END IF;

  v_allowed := CASE ss.status
    WHEN 'trialing' THEN p_to_status IN ('active','expired','cancelled')
    WHEN 'active' THEN p_to_status IN ('past_due','cancel_at_period_end','suspended','cancelled')
    WHEN 'past_due' THEN p_to_status IN ('active','grace_period','suspended','cancelled')
    WHEN 'grace_period' THEN p_to_status IN ('active','expired','suspended','cancelled')
    WHEN 'cancel_at_period_end' THEN p_to_status IN ('active','expired','cancelled')
    WHEN 'suspended' THEN p_to_status IN ('active','cancelled','expired')
    ELSE FALSE
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'ILLEGAL_SUBSCRIPTION_TRANSITION: % -> %', ss.status, p_to_status;
  END IF;

  IF p_to_status = 'active' THEN
    v_new_period_start := COALESCE(ss.current_period_start, now());
    v_new_period_end := COALESCE(p_current_period_end, ss.current_period_end);
    IF v_new_period_end IS NULL OR v_new_period_end <= now() THEN
      RAISE EXCEPTION 'ACTIVE_PERIOD_END_REQUIRED: active access requires a future authoritative period end.';
    END IF;
  ELSE
    v_new_period_start := ss.current_period_start;
    v_new_period_end := ss.current_period_end;
  END IF;

  IF p_to_status = 'grace_period' THEN
    IF p_grace_period_end IS NULL OR p_grace_period_end <= now() THEN
      RAISE EXCEPTION 'GRACE_PERIOD_END_REQUIRED: grace period must end in the future.';
    END IF;
    v_new_grace_end := p_grace_period_end;
  ELSIF p_to_status = 'active' THEN
    v_new_grace_end := NULL;
  ELSE
    v_new_grace_end := ss.grace_period_end;
  END IF;

  IF p_to_status = 'cancel_at_period_end' THEN
    IF ss.current_period_end IS NULL OR ss.current_period_end <= now() THEN
      RAISE EXCEPTION 'CANCEL_PERIOD_END_REQUIRED: current period end must be in the future.';
    END IF;
    v_cancel_at_period_end := TRUE;
  ELSE
    v_cancel_at_period_end := FALSE;
  END IF;

  v_cancelled_at := CASE WHEN p_to_status = 'cancelled' THEN now() WHEN p_to_status = 'active' THEN NULL ELSE ss.cancelled_at END;
  v_suspended_at := CASE WHEN p_to_status = 'suspended' THEN now() WHEN p_to_status = 'active' THEN NULL ELSE ss.suspended_at END;
  v_continuity := ss.founding_member_continuity_valid;
  v_new_offer := ss.commercial_offer;
  IF p_to_status IN ('cancelled','expired') THEN
    v_continuity := FALSE;
    IF ss.commercial_offer = 'founding_member' THEN v_new_offer := 'standard'; END IF;
  END IF;
  UPDATE shop_subscriptions
  SET status = p_to_status,
      commercial_offer = v_new_offer,
      current_period_start = v_new_period_start,
      current_period_end = v_new_period_end,
      grace_period_end = v_new_grace_end,
      cancel_at_period_end = v_cancel_at_period_end,
      cancelled_at = v_cancelled_at,
      suspended_at = v_suspended_at,
      founding_member_continuity_valid = v_continuity,
      last_transition_source = p_source,
      last_transition_reason = p_reason,
      updated_at = now()
  WHERE id = ss.id;

  PERFORM sync_legacy_subscription_status(p_shop_id, p_to_status);
  v_actor_type := CASE p_source
    WHEN 'future_billing_event' THEN 'future_billing_event'
    WHEN 'manual_admin' THEN 'platform_admin'
    ELSE 'ps01_runtime'
  END;

  INSERT INTO subscription_audit_log (
    shop_id, subscription_id, actor_type, actor_id, action,
    previous_status, resulting_status,
    previous_package_id, resulting_package_id,
    previous_offer, resulting_offer,
    transition_source, reason, idempotency_key, request_fingerprint
  ) VALUES (
    p_shop_id, ss.id, v_actor_type, p_actor_id,
    'subscription.status_changed', ss.status, p_to_status,
    ss.package_id, ss.package_id, ss.commercial_offer, v_new_offer,
    p_source, p_reason, p_idempotency_key, v_fingerprint
  );

  RETURN resolve_shop_commercial_authority(p_shop_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;
REVOKE ALL ON FUNCTION transition_shop_subscription(UUID,VARCHAR,VARCHAR,TEXT,UUID,TIMESTAMPTZ,TIMESTAMPTZ,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION transition_shop_subscription(UUID,VARCHAR,VARCHAR,TEXT,UUID,TIMESTAMPTZ,TIMESTAMPTZ,UUID)
  TO ps01_runtime;

CREATE OR REPLACE FUNCTION enforce_room_commercial_quota()
RETURNS TRIGGER AS $$
DECLARE
  v JSONB;
  v_limit INT;
  v_count INT;
BEGIN
  PERFORM 1 FROM shop_subscriptions WHERE shop_id = NEW.shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: subscription is not initialized.'; END IF;
  v := resolve_shop_commercial_authority(NEW.shop_id);
  IF COALESCE((v->>'commercial_access')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: subscription does not allow this mutation.';
  END IF;
  v_limit := NULLIF(v->>'room_limit','')::INT;
  IF v_limit IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_count FROM rooms WHERE shop_id = NEW.shop_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'ROOM_QUOTA_EXCEEDED: current package room limit reached.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION enforce_room_commercial_quota() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_room_commercial_quota
BEFORE INSERT ON rooms
FOR EACH ROW EXECUTE FUNCTION enforce_room_commercial_quota();
CREATE OR REPLACE FUNCTION enforce_pet_commercial_quota()
RETURNS TRIGGER AS $$
DECLARE
  v JSONB;
  v_limit INT;
  v_count INT;
BEGIN
  PERFORM 1 FROM shop_subscriptions WHERE shop_id = NEW.shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: subscription is not initialized.'; END IF;
  v := resolve_shop_commercial_authority(NEW.shop_id);
  IF COALESCE((v->>'commercial_access')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'COMMERCIAL_ACCESS_BLOCKED: subscription does not allow this mutation.';
  END IF;
  v_limit := NULLIF(v->>'pet_history_limit','')::INT;
  IF v_limit IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_count FROM pets WHERE shop_id = NEW.shop_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'PET_QUOTA_EXCEEDED: current package pet record limit reached.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION enforce_pet_commercial_quota() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_pet_commercial_quota
BEFORE INSERT ON pets
FOR EACH ROW EXECUTE FUNCTION enforce_pet_commercial_quota();

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON shop_subscriptions FROM ps01_runtime;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON subscription_audit_log FROM ps01_runtime;

-- END LEGACY SOURCE: 20260825141500_phase13_subscription_lifecycle.sql


-- BEGIN LEGACY SOURCE: 20260825141600_phase13_subscription_hardening.sql
-- PawSpace Phase 13 hardening: one-way compatibility, immutable audit,
-- centralized commercial access, and idempotent package mutation authority.

CREATE OR REPLACE FUNCTION prevent_subscription_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'SUBSCRIPTION_AUDIT_IMMUTABLE';
END;
$$ LANGUAGE plpgsql SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION prevent_subscription_audit_mutation() FROM PUBLIC, anon, authenticated, ps01_runtime;
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
$$ LANGUAGE plpgsql SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION prevent_commercial_assignment_authority_write() FROM PUBLIC, anon, authenticated, ps01_runtime;
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION sync_trusted_assignment_fixture_to_subscription() FROM PUBLIC, anon, authenticated, ps01_runtime;
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
  IF auth.role() <> 'ps01_runtime' THEN
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
    ELSE 'ps01_runtime'
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION set_shop_commercial_package(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT,UUID,UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_shop_commercial_package(UUID,VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT,UUID,UUID)
TO ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION assert_shop_commercial_mutation_allowed(UUID) FROM PUBLIC, anon, authenticated, ps01_runtime;

CREATE OR REPLACE FUNCTION enforce_shop_commercial_mutation()
RETURNS TRIGGER AS $$
DECLARE v_shop_id UUID;
BEGIN
  v_shop_id := CASE WHEN TG_OP='DELETE' THEN OLD.shop_id ELSE NEW.shop_id END;
  PERFORM assert_shop_commercial_mutation_allowed(v_shop_id);
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION enforce_shop_commercial_mutation() FROM PUBLIC, anon, authenticated, ps01_runtime;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION enforce_shop_profile_commercial_mutation() FROM PUBLIC, anon, authenticated, ps01_runtime;
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION get_owner_manager_dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_owner_manager_dashboard_summary() TO authenticated, ps01_runtime;

-- END LEGACY SOURCE: 20260825141600_phase13_subscription_hardening.sql


-- BEGIN LEGACY SOURCE: 20260825141700_phase13_bootstrap_trialing_remediation.sql
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ps01, extensions, pg_temp;

REVOKE ALL ON FUNCTION bootstrap_shop(VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bootstrap_shop(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated, ps01_runtime;

-- END LEGACY SOURCE: 20260825141700_phase13_bootstrap_trialing_remediation.sql

CREATE TABLE IF NOT EXISTS ps01_internal.schema_migrations (
  source_hash text PRIMARY KEY,
  migration_count integer NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE ps01_internal.schema_migrations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE ps01_internal.schema_migrations TO ps01_runtime;
INSERT INTO ps01_internal.schema_migrations (source_hash, migration_count)
VALUES ('0ee8857ae05aecc732bf92f6bdca980ae3b0547ba7eeca7e16a0cab575ccbba5', 13)
ON CONFLICT (source_hash) DO NOTHING;
