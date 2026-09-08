-- Pawstia PS01 Booking V2 — Rate Plans + timestamp booking engine
-- Forward-only migration. Historical Phase 1-13 migrations remain immutable.
-- Canonical stream targets public; shared-runtime generator rewrites search_path/roles to ps01.

SET search_path = public, pg_temp;

CREATE TABLE room_rate_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    room_id UUID NOT NULL,
    pricing_mode VARCHAR(32) NOT NULL DEFAULT 'FIXED_PACKAGE'
        CHECK (pricing_mode = 'FIXED_PACKAGE'),
    unit VARCHAR(16) NOT NULL CHECK (unit IN ('HOUR', 'DAY', 'MONTH')),
    quantity INT NOT NULL CHECK (quantity > 0),
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, id),
    UNIQUE (shop_id, room_id, unit, quantity),
    FOREIGN KEY (shop_id, room_id)
        REFERENCES rooms(shop_id, id) ON DELETE CASCADE
);

ALTER TABLE room_rate_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE room_rate_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE room_rate_plans TO authenticated, service_role;
CREATE POLICY staff_read_room_rate_plans ON room_rate_plans
FOR SELECT TO authenticated USING (shop_id = current_staff_shop_id());

-- Existing rooms receive one compatibility DAY package matching the old nightly price.
INSERT INTO room_rate_plans (shop_id, room_id, unit, quantity, price)
SELECT shop_id, id, 'DAY', 1, base_price_per_night
FROM rooms
ON CONFLICT (shop_id, room_id, unit, quantity) DO NOTHING;

ALTER TABLE rooms
    ADD COLUMN maintenance_start_at TIMESTAMPTZ,
    ADD COLUMN maintenance_end_at TIMESTAMPTZ;

UPDATE rooms
SET maintenance_start_at = maintenance_from::timestamp AT TIME ZONE 'Asia/Bangkok',
    maintenance_end_at = (maintenance_until + 1)::timestamp AT TIME ZONE 'Asia/Bangkok'
WHERE maintenance_from IS NOT NULL AND maintenance_until IS NOT NULL;

ALTER TABLE rooms ADD CONSTRAINT check_maintenance_v2_window CHECK (
    (maintenance_start_at IS NULL AND maintenance_end_at IS NULL)
    OR (
        maintenance_start_at IS NOT NULL
        AND maintenance_end_at IS NOT NULL
        AND maintenance_end_at > maintenance_start_at
    )
);

ALTER TABLE bookings ADD COLUMN booking_model_version SMALLINT;
UPDATE bookings SET booking_model_version = 1;
ALTER TABLE bookings ALTER COLUMN booking_model_version SET DEFAULT 2;
ALTER TABLE bookings ALTER COLUMN booking_model_version SET NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT booking_model_version_check CHECK (booking_model_version IN (1, 2));

ALTER TABLE bookings
    ADD COLUMN start_at TIMESTAMPTZ,
    ADD COLUMN end_at TIMESTAMPTZ,
    ADD COLUMN rate_plan_id UUID,
    ADD COLUMN quoted_pricing_mode VARCHAR(32),
    ADD COLUMN quoted_unit VARCHAR(16),
    ADD COLUMN quoted_quantity INT,
    ADD COLUMN quoted_price NUMERIC(10,2),
    ADD COLUMN occupancy_start_at TIMESTAMPTZ,
    ADD COLUMN occupancy_end_at TIMESTAMPTZ;

ALTER TABLE bookings ALTER COLUMN check_in_date DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN check_out_date DROP NOT NULL;

ALTER TABLE bookings
    ADD CONSTRAINT bookings_rate_plan_fk
        FOREIGN KEY (shop_id, rate_plan_id)
        REFERENCES room_rate_plans(shop_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT booking_v2_shape_check CHECK (
        booking_model_version = 1
        OR (
            start_at IS NOT NULL AND end_at IS NOT NULL AND end_at > start_at
            AND rate_plan_id IS NOT NULL
            AND quoted_pricing_mode = 'FIXED_PACKAGE'
            AND quoted_unit IN ('HOUR', 'DAY', 'MONTH')
            AND quoted_quantity > 0
            AND quoted_price >= 0
            AND total_amount = quoted_price
        )
    );

CREATE OR REPLACE FUNCTION sync_booking_occupancy_window()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.booking_model_version = 2 THEN
        IF NEW.start_at IS NULL OR NEW.end_at IS NULL THEN
            RAISE EXCEPTION 'Booking V2 requires start_at and end_at.';
        END IF;
        NEW.occupancy_start_at := NEW.start_at;
        NEW.occupancy_end_at := NEW.end_at;
    ELSE
        IF NEW.check_in_date IS NULL OR NEW.check_out_date IS NULL THEN
            RAISE EXCEPTION 'Legacy booking requires check_in_date and check_out_date.';
        END IF;
        NEW.occupancy_start_at := NEW.check_in_date::timestamp AT TIME ZONE 'Asia/Bangkok';
        NEW.occupancy_end_at := NEW.check_out_date::timestamp AT TIME ZONE 'Asia/Bangkok';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER sync_booking_occupancy_window_trigger
BEFORE INSERT OR UPDATE OF booking_model_version, check_in_date, check_out_date, start_at, end_at
ON bookings FOR EACH ROW EXECUTE FUNCTION sync_booking_occupancy_window();

UPDATE bookings SET occupancy_start_at = check_in_date::timestamp AT TIME ZONE 'Asia/Bangkok',
                    occupancy_end_at = check_out_date::timestamp AT TIME ZONE 'Asia/Bangkok'
WHERE booking_model_version = 1;

ALTER TABLE bookings ALTER COLUMN occupancy_start_at SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN occupancy_end_at SET NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT booking_occupancy_window_check CHECK (occupancy_end_at > occupancy_start_at);

ALTER TABLE bookings DROP CONSTRAINT prevent_double_booking;
ALTER TABLE bookings ADD CONSTRAINT prevent_double_booking_v2
EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(occupancy_start_at, occupancy_end_at, '[)') WITH &&
) WHERE (booking_status IN ('confirmed', 'checked_in'));

CREATE INDEX idx_bookings_shop_room_window_v2
ON bookings (shop_id, room_id, occupancy_start_at, occupancy_end_at);

ALTER TABLE booking_requests ADD COLUMN booking_model_version SMALLINT;
UPDATE booking_requests SET booking_model_version = 1;
ALTER TABLE booking_requests ALTER COLUMN booking_model_version SET DEFAULT 2;
ALTER TABLE booking_requests ALTER COLUMN booking_model_version SET NOT NULL;
ALTER TABLE booking_requests ADD CONSTRAINT booking_request_model_version_check CHECK (booking_model_version IN (1, 2));

ALTER TABLE booking_requests
    ADD COLUMN start_at TIMESTAMPTZ,
    ADD COLUMN end_at TIMESTAMPTZ,
    ADD COLUMN rate_plan_id UUID,
    ADD COLUMN quoted_pricing_mode VARCHAR(32),
    ADD COLUMN quoted_unit VARCHAR(16),
    ADD COLUMN quoted_quantity INT,
    ADD COLUMN quoted_price NUMERIC(10,2);

ALTER TABLE booking_requests ALTER COLUMN check_in_date DROP NOT NULL;
ALTER TABLE booking_requests ALTER COLUMN check_out_date DROP NOT NULL;

ALTER TABLE booking_requests
    ADD CONSTRAINT booking_requests_rate_plan_fk
        FOREIGN KEY (shop_id, rate_plan_id)
        REFERENCES room_rate_plans(shop_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT booking_request_v2_shape_check CHECK (
        booking_model_version = 1
        OR (
            start_at IS NOT NULL AND end_at IS NOT NULL AND end_at > start_at
            AND rate_plan_id IS NOT NULL
            AND quoted_pricing_mode = 'FIXED_PACKAGE'
            AND quoted_unit IN ('HOUR', 'DAY', 'MONTH')
            AND quoted_quantity > 0
            AND quoted_price >= 0
            AND total_amount = quoted_price
        )
    );

CREATE OR REPLACE FUNCTION resolve_package_end_at(
    p_start_at TIMESTAMPTZ,
    p_unit VARCHAR,
    p_quantity INT
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_local TIMESTAMP;
BEGIN
    IF p_start_at IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Invalid package duration input.';
    END IF;
    v_local := p_start_at AT TIME ZONE 'Asia/Bangkok';

    CASE p_unit
        WHEN 'HOUR' THEN
            RETURN p_start_at + make_interval(hours => p_quantity);
        WHEN 'DAY' THEN
            RETURN (v_local + make_interval(days => p_quantity)) AT TIME ZONE 'Asia/Bangkok';
        WHEN 'MONTH' THEN
            RETURN (v_local + make_interval(months => p_quantity)) AT TIME ZONE 'Asia/Bangkok';
        ELSE
            RAISE EXCEPTION 'Unsupported rate-plan unit %.', p_unit;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION resolve_package_end_at(TIMESTAMPTZ, VARCHAR, INT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION assert_booking_window_available_internal(
    p_shop_id UUID,
    p_owner_id UUID,
    p_room_id UUID,
    p_pet_ids UUID[],
    p_start_at TIMESTAMPTZ,
    p_end_at TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_capacity INT;
    v_pet_count INT;
    v_distinct_pet_count INT;
BEGIN

    IF p_shop_id IS NULL OR p_owner_id IS NULL OR p_room_id IS NULL THEN
        RAISE EXCEPTION 'Booking scope is incomplete.';
    END IF;
    IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
        RAISE EXCEPTION 'Invalid booking window.';
    END IF;
    IF p_pet_ids IS NULL OR cardinality(p_pet_ids) < 1 THEN
        RAISE EXCEPTION 'At least one pet must be selected.';
    END IF;

    SELECT COUNT(DISTINCT value) INTO v_distinct_pet_count
    FROM unnest(p_pet_ids) AS value;
    IF v_distinct_pet_count <> cardinality(p_pet_ids) THEN
        RAISE EXCEPTION 'Duplicate pet IDs are not allowed.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pet_owners
        WHERE id = p_owner_id AND shop_id = p_shop_id
    ) THEN
        RAISE EXCEPTION 'Pet owner not found for shop.';
    END IF;

    SELECT capacity_pets INTO v_capacity
    FROM rooms
    WHERE id = p_room_id AND shop_id = p_shop_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found for shop.';
    END IF;

    IF cardinality(p_pet_ids) > v_capacity THEN
        RAISE EXCEPTION 'Room Capacity Violation: capacity %, selected %.', v_capacity, cardinality(p_pet_ids);
    END IF;

    SELECT COUNT(*) INTO v_pet_count
    FROM pets
    WHERE shop_id = p_shop_id
      AND owner_id = p_owner_id
      AND id = ANY(p_pet_ids);
    IF v_pet_count <> cardinality(p_pet_ids) THEN
        RAISE EXCEPTION 'Invalid pet selection for booking owner.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM rooms
        WHERE id = p_room_id AND shop_id = p_shop_id
          AND maintenance_start_at IS NOT NULL
          AND tstzrange(maintenance_start_at, maintenance_end_at, '[)')
              && tstzrange(p_start_at, p_end_at, '[)')
    ) THEN
        RAISE EXCEPTION 'Room Maintenance Violation: requested window overlaps maintenance.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.shop_id = p_shop_id
          AND b.room_id = p_room_id
          AND b.booking_status IN ('confirmed', 'checked_in')
          AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
          AND tstzrange(b.occupancy_start_at, b.occupancy_end_at, '[)')
              && tstzrange(p_start_at, p_end_at, '[)')
    ) THEN
        RAISE EXCEPTION 'Room Collision: room is already booked for the requested time.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM booking_pets bp
        JOIN bookings b ON b.id = bp.booking_id AND b.shop_id = bp.shop_id
        WHERE bp.shop_id = p_shop_id
          AND bp.pet_id = ANY(p_pet_ids)
          AND b.booking_status IN ('confirmed', 'checked_in')
          AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
          AND tstzrange(b.occupancy_start_at, b.occupancy_end_at, '[)')
              && tstzrange(p_start_at, p_end_at, '[)')
    ) THEN
        RAISE EXCEPTION 'Pet Conflict: one or more pets already have an overlapping active booking.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION assert_booking_window_available_internal(
    UUID, UUID, UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ, UUID
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION resolve_booking_v2_quote_internal(
    p_shop_id UUID,
    p_owner_id UUID,
    p_room_id UUID,
    p_rate_plan_id UUID,
    p_pet_ids UUID[],
    p_start_at TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL,
    p_require_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE

    v_plan RECORD;
    v_end_at TIMESTAMPTZ;
BEGIN
    SELECT pricing_mode, unit, quantity, price, is_active
    INTO v_plan
    FROM room_rate_plans
    WHERE id = p_rate_plan_id
      AND shop_id = p_shop_id
      AND room_id = p_room_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rate Plan not found for room/shop.';
    END IF;
    IF p_require_active AND NOT v_plan.is_active THEN
        RAISE EXCEPTION 'Rate Plan is inactive.';
    END IF;

    v_end_at := resolve_package_end_at(p_start_at, v_plan.unit, v_plan.quantity);
    PERFORM assert_booking_window_available_internal(
        p_shop_id, p_owner_id, p_room_id, p_pet_ids,
        p_start_at, v_end_at, p_exclude_booking_id
    );

    RETURN jsonb_build_object(
        'pricingMode', v_plan.pricing_mode,
        'unit', v_plan.unit,
        'quantity', v_plan.quantity,
        'price', v_plan.price,
        'startAt', p_start_at,
        'endAt', v_end_at,
        'ratePlanId', p_rate_plan_id,
        'roomId', p_room_id
    );
END;

$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION resolve_booking_v2_quote_internal(
    UUID, UUID, UUID, UUID, UUID[], TIMESTAMPTZ, UUID, BOOLEAN
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION create_room_rate_plan(
    p_room_id UUID,
    p_unit VARCHAR,
    p_quantity INT,
    p_price NUMERIC(10,2)
)
RETURNS UUID AS $$
DECLARE
    v_shop_id UUID;
    v_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only owner or manager can create Rate Plans.';
    END IF;
    IF p_unit NOT IN ('HOUR', 'DAY', 'MONTH') OR p_quantity <= 0 OR p_price < 0 THEN
        RAISE EXCEPTION 'Invalid Rate Plan.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND shop_id = v_shop_id) THEN
        RAISE EXCEPTION 'Room not found.';
    END IF;
    INSERT INTO room_rate_plans (shop_id, room_id, unit, quantity, price)
    VALUES (v_shop_id, p_room_id, p_unit, p_quantity, p_price)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION create_room_rate_plan(UUID, VARCHAR, INT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_room_rate_plan(UUID, VARCHAR, INT, NUMERIC) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION update_room_rate_plan(
    p_rate_plan_id UUID,
    p_unit VARCHAR,
    p_quantity INT,
    p_price NUMERIC(10,2),
    p_is_active BOOLEAN
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only owner or manager can update Rate Plans.';
    END IF;
    IF p_unit NOT IN ('HOUR', 'DAY', 'MONTH') OR p_quantity <= 0 OR p_price < 0 THEN
        RAISE EXCEPTION 'Invalid Rate Plan.';
    END IF;
    UPDATE room_rate_plans
    SET unit = p_unit,
        quantity = p_quantity,
        price = p_price,
        is_active = p_is_active,
        updated_at = now()
    WHERE id = p_rate_plan_id AND shop_id = v_shop_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rate Plan not found.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION update_room_rate_plan(UUID, VARCHAR, INT, NUMERIC, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_room_rate_plan(UUID, VARCHAR, INT, NUMERIC, BOOLEAN) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION quote_booking_v2(
    p_owner_id UUID,
    p_room_id UUID,
    p_rate_plan_id UUID,
    p_pet_ids UUID[],
    p_start_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_shop_id UUID;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;
    RETURN resolve_booking_v2_quote_internal(
        v_shop_id, p_owner_id, p_room_id, p_rate_plan_id,
        p_pet_ids, p_start_at, NULL, TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION quote_booking_v2(UUID, UUID, UUID, UUID[], TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION quote_booking_v2(UUID, UUID, UUID, UUID[], TIMESTAMPTZ) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION create_booking_v2(
    p_owner_id UUID,
    p_room_id UUID,
    p_rate_plan_id UUID,
    p_pet_ids UUID[],
    p_start_at TIMESTAMPTZ,
    p_special_requests TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_shop_id UUID;
    v_quote JSONB;
    v_booking_id UUID;
    v_pet_id UUID;
BEGIN

    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    -- V2 mutation lock order: pets (sorted) -> room. Booking does not exist yet.
    PERFORM 1 FROM pets
    WHERE shop_id = v_shop_id AND id = ANY(p_pet_ids)
    ORDER BY id FOR UPDATE;
    PERFORM 1 FROM rooms
    WHERE shop_id = v_shop_id AND id = p_room_id
    FOR UPDATE;

    v_quote := resolve_booking_v2_quote_internal(
        v_shop_id, p_owner_id, p_room_id, p_rate_plan_id,
        p_pet_ids, p_start_at, NULL, TRUE
    );

    INSERT INTO bookings (
        shop_id, owner_id, room_id, booking_model_version,
        start_at, end_at, rate_plan_id,
        quoted_pricing_mode, quoted_unit, quoted_quantity, quoted_price,
        booking_status, total_amount, special_requests
    ) VALUES (
        v_shop_id, p_owner_id, p_room_id, 2,
        p_start_at, (v_quote->>'endAt')::timestamptz, p_rate_plan_id,
        v_quote->>'pricingMode', v_quote->>'unit', (v_quote->>'quantity')::int,
        (v_quote->>'price')::numeric,
        'confirmed', (v_quote->>'price')::numeric, p_special_requests
    ) RETURNING id INTO v_booking_id;

    FOREACH v_pet_id IN ARRAY p_pet_ids LOOP
        INSERT INTO booking_pets (shop_id, booking_id, pet_id)
        VALUES (v_shop_id, v_booking_id, v_pet_id);
    END LOOP;

    PERFORM enqueue_sync_event(
        v_shop_id, 'booking', v_booking_id, 'UPSERT',
        jsonb_build_object('booking_id', v_booking_id)
    );
    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION create_booking_v2(UUID, UUID, UUID, UUID[], TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_booking_v2(UUID, UUID, UUID, UUID[], TIMESTAMPTZ, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION update_booking_v2_schedule(
    p_booking_id UUID,
    p_room_id UUID,
    p_rate_plan_id UUID,
    p_start_at TIMESTAMPTZ,
    p_special_requests TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_booking RECORD;
    v_pet_ids UUID[];
    v_quote JSONB;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;

    SELECT * INTO v_booking FROM bookings
    WHERE id = p_booking_id AND shop_id = v_shop_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.'; END IF;
    IF v_booking.booking_model_version <> 2 OR v_booking.booking_status <> 'confirmed' THEN
        RAISE EXCEPTION 'Only confirmed Booking V2 records can be rescheduled.';
    END IF;

    SELECT array_agg(bp.pet_id ORDER BY bp.pet_id) INTO v_pet_ids
    FROM booking_pets bp
    WHERE bp.shop_id = v_shop_id AND bp.booking_id = p_booking_id;
    IF v_pet_ids IS NULL OR cardinality(v_pet_ids) = 0 THEN
        RAISE EXCEPTION 'Booking has no pets.';
    END IF;

    PERFORM 1 FROM pets
    WHERE shop_id = v_shop_id AND id = ANY(v_pet_ids)
    ORDER BY id FOR UPDATE;
    PERFORM 1 FROM rooms
    WHERE shop_id = v_shop_id AND id = p_room_id
    FOR UPDATE;

    v_quote := resolve_booking_v2_quote_internal(
        v_shop_id, v_booking.owner_id, p_room_id, p_rate_plan_id,
        v_pet_ids, p_start_at, p_booking_id, TRUE
    );

    UPDATE bookings SET
        room_id = p_room_id,
        start_at = p_start_at,
        end_at = (v_quote->>'endAt')::timestamptz,
        rate_plan_id = p_rate_plan_id,
        quoted_pricing_mode = v_quote->>'pricingMode',
        quoted_unit = v_quote->>'unit',
        quoted_quantity = (v_quote->>'quantity')::int,
        quoted_price = (v_quote->>'price')::numeric,
        total_amount = (v_quote->>'price')::numeric,
        special_requests = COALESCE(p_special_requests, special_requests)
    WHERE id = p_booking_id AND shop_id = v_shop_id;

    PERFORM enqueue_sync_event(v_shop_id, 'booking', p_booking_id, 'UPSERT', jsonb_build_object('booking_id', p_booking_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION update_booking_v2_schedule(UUID, UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_booking_v2_schedule(UUID, UUID, UUID, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION quote_customer_booking_v2_internal(
    p_verified_line_user_id VARCHAR,
    p_shop_id UUID,
    p_room_id UUID,
    p_rate_plan_id UUID,
    p_pet_ids UUID[],
    p_start_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    IF p_verified_line_user_id IS NULL OR btrim(p_verified_line_user_id) = '' THEN
        RAISE EXCEPTION 'Invalid LINE identity.';
    END IF;
    SELECT id INTO v_owner_id FROM pet_owners
    WHERE shop_id = p_shop_id AND line_user_id = btrim(p_verified_line_user_id);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pet owner not found or not linked to shop.';
    END IF;
    RETURN resolve_booking_v2_quote_internal(
        p_shop_id, v_owner_id, p_room_id, p_rate_plan_id,
        p_pet_ids, p_start_at, NULL, TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION quote_customer_booking_v2_internal(
    VARCHAR, UUID, UUID, UUID, UUID[], TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION quote_customer_booking_v2_internal(
    VARCHAR, UUID, UUID, UUID, UUID[], TIMESTAMPTZ
) TO service_role;

CREATE OR REPLACE FUNCTION get_customer_booking_context_v2_internal(
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
    v_rate_plans JSONB;
    v_occupied JSONB;
BEGIN
    IF p_verified_line_user_id IS NULL OR btrim(p_verified_line_user_id) = '' THEN
        RAISE EXCEPTION 'Invalid LINE identity.';
    END IF;
    SELECT name, slug INTO v_shop_name, v_shop_slug FROM shops WHERE id = p_shop_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Shop not found.'; END IF;

    SELECT id, first_name, phone INTO v_owner_id, v_owner_name, v_owner_phone
    FROM pet_owners
    WHERE shop_id = p_shop_id AND line_user_id = btrim(p_verified_line_user_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'Pet owner not found or not linked to shop.'; END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'species', p.species,
        'breed', p.breed, 'weightKg', p.weight_kg
    ) ORDER BY p.name), '[]'::jsonb)
    INTO v_pets FROM pets p
    WHERE p.shop_id = p_shop_id AND p.owner_id = v_owner_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', r.id, 'roomNumber', r.room_number, 'roomType', r.room_type,
        'capacityPets', r.capacity_pets, 'status', r.status,
        'maintenanceStartAt', r.maintenance_start_at,
        'maintenanceEndAt', r.maintenance_end_at
    ) ORDER BY r.room_number), '[]'::jsonb)
    INTO v_rooms FROM rooms r WHERE r.shop_id = p_shop_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', rp.id, 'roomId', rp.room_id,
        'pricingMode', rp.pricing_mode, 'unit', rp.unit,
        'quantity', rp.quantity, 'price', rp.price,
        'isActive', rp.is_active
    ) ORDER BY rp.room_id, rp.unit, rp.quantity), '[]'::jsonb)
    INTO v_rate_plans FROM room_rate_plans rp
    WHERE rp.shop_id = p_shop_id AND rp.is_active = TRUE;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'roomId', b.room_id,
        'startAt', b.occupancy_start_at,
        'endAt', b.occupancy_end_at
    )), '[]'::jsonb)
    INTO v_occupied FROM bookings b
    WHERE b.shop_id = p_shop_id
      AND b.booking_status IN ('confirmed', 'checked_in')
      AND b.occupancy_end_at >= now();

    RETURN jsonb_build_object(
        'shop', jsonb_build_object('id', p_shop_id, 'name', v_shop_name, 'slug', v_shop_slug),
        'owner', jsonb_build_object('id', v_owner_id, 'firstName', v_owner_name, 'phone', v_owner_phone),
        'pets', v_pets, 'rooms', v_rooms,
        'ratePlans', v_rate_plans, 'occupiedRanges', v_occupied
    );
END;

$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION get_customer_booking_context_v2_internal(VARCHAR, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_customer_booking_context_v2_internal(VARCHAR, UUID)
    TO service_role;

CREATE OR REPLACE FUNCTION submit_booking_request_v2_internal(
    p_verified_line_user_id VARCHAR,
    p_shop_id UUID,
    p_room_id UUID,
    p_rate_plan_id UUID,
    p_pet_ids UUID[],
    p_start_at TIMESTAMPTZ,
    p_special_requests TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_owner_id UUID;
    v_quote JSONB;
    v_request_id UUID;
BEGIN
    IF p_verified_line_user_id IS NULL OR btrim(p_verified_line_user_id) = '' THEN
        RAISE EXCEPTION 'Invalid LINE identity.';
    END IF;
    SELECT id INTO v_owner_id FROM pet_owners
    WHERE shop_id = p_shop_id AND line_user_id = btrim(p_verified_line_user_id);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pet owner not found or not linked to shop.';
    END IF;

    v_quote := resolve_booking_v2_quote_internal(
        p_shop_id, v_owner_id, p_room_id, p_rate_plan_id,
        p_pet_ids, p_start_at, NULL, TRUE
    );

    INSERT INTO booking_requests (
        shop_id, owner_id, room_id, pet_ids,
        booking_model_version, start_at, end_at, rate_plan_id,
        quoted_pricing_mode, quoted_unit, quoted_quantity, quoted_price,
        status, requested_by_line_user_id, total_amount, special_requests
    ) VALUES (
        p_shop_id, v_owner_id, p_room_id, p_pet_ids,
        2, p_start_at, (v_quote->>'endAt')::timestamptz, p_rate_plan_id,
        v_quote->>'pricingMode', v_quote->>'unit', (v_quote->>'quantity')::int,
        (v_quote->>'price')::numeric,
        'requested', btrim(p_verified_line_user_id),
        (v_quote->>'price')::numeric, p_special_requests
    ) RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION submit_booking_request_v2_internal(
    VARCHAR, UUID, UUID, UUID, UUID[], TIMESTAMPTZ, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_booking_request_v2_internal(
    VARCHAR, UUID, UUID, UUID, UUID[], TIMESTAMPTZ, TEXT
) TO service_role;

-- Replace the staff confirmation RPC while preserving its signature for V1 callers.
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
    v_pet_ids UUID[];
BEGIN

    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;

    SELECT * INTO v_req FROM booking_requests
    WHERE id = p_request_id AND shop_id = v_shop_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking request not found.'; END IF;
    IF v_req.status <> 'requested' THEN
        RAISE EXCEPTION 'Booking request is already %.', v_req.status;
    END IF;

    v_target_room_id := COALESCE(p_assigned_room_id, v_req.room_id);
    v_pet_ids := v_req.pet_ids;

    IF v_req.booking_model_version = 2 AND v_target_room_id <> v_req.room_id THEN
        RAISE EXCEPTION 'Booking V2 room reassignment requires a new quote/request.';
    END IF;

    PERFORM 1 FROM pets
    WHERE shop_id = v_shop_id AND id = ANY(v_pet_ids)
    ORDER BY id FOR UPDATE;
    PERFORM 1 FROM rooms
    WHERE shop_id = v_shop_id AND id = v_target_room_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Target room not found.'; END IF;

    IF v_req.booking_model_version = 2 THEN
        PERFORM assert_booking_window_available_internal(
            v_shop_id, v_req.owner_id, v_target_room_id, v_pet_ids,
            v_req.start_at, v_req.end_at, NULL
        );

        INSERT INTO bookings (
            shop_id, owner_id, room_id, booking_model_version,
            start_at, end_at, rate_plan_id,
            quoted_pricing_mode, quoted_unit, quoted_quantity, quoted_price,
            booking_status, total_amount, special_requests
        ) VALUES (

            v_shop_id, v_req.owner_id, v_target_room_id, 2,
            v_req.start_at, v_req.end_at, v_req.rate_plan_id,
            v_req.quoted_pricing_mode, v_req.quoted_unit,
            v_req.quoted_quantity, v_req.quoted_price,
            'confirmed', v_req.quoted_price, v_req.special_requests
        ) RETURNING id INTO v_booking_id;
    ELSE
        PERFORM assert_booking_window_available_internal(
            v_shop_id, v_req.owner_id, v_target_room_id, v_pet_ids,
            v_req.check_in_date::timestamp AT TIME ZONE 'Asia/Bangkok',
            v_req.check_out_date::timestamp AT TIME ZONE 'Asia/Bangkok',
            NULL
        );
        INSERT INTO bookings (
            shop_id, owner_id, room_id,
            booking_model_version, check_in_date, check_out_date,
            booking_status, total_amount, special_requests
        ) VALUES (
            v_shop_id, v_req.owner_id, v_target_room_id,
            1, v_req.check_in_date, v_req.check_out_date,
            'confirmed', v_req.total_amount, v_req.special_requests
        ) RETURNING id INTO v_booking_id;
    END IF;

    FOREACH v_pet_id IN ARRAY v_pet_ids LOOP
        INSERT INTO booking_pets (shop_id, booking_id, pet_id)
        VALUES (v_shop_id, v_booking_id, v_pet_id);
    END LOOP;

    UPDATE booking_requests
    SET status = 'confirmed', confirmed_booking_id = v_booking_id,
        actioned_by = auth.uid(), actioned_at = now()
    WHERE id = p_request_id AND shop_id = v_shop_id;

    PERFORM enqueue_sync_event(
        v_shop_id, 'booking', v_booking_id, 'UPSERT',
        jsonb_build_object('booking_id', v_booking_id)
    );
    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION confirm_booking_request(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_booking_request(UUID, UUID) TO authenticated, service_role;

-- Keep the legacy date maintenance RPC compatible while synchronizing V2 timestamps.
CREATE OR REPLACE FUNCTION set_room_maintenance(p_room_id UUID, p_from DATE, p_until DATE)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_status VARCHAR;
    v_start_at TIMESTAMPTZ;
    v_end_at TIMESTAMPTZ;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only owner or manager can set maintenance.';
    END IF;
    IF (p_from IS NULL) <> (p_until IS NULL) THEN
        RAISE EXCEPTION 'Invalid Maintenance Window: from/until must both be NULL or both be provided.';
    END IF;
    IF p_from IS NOT NULL AND p_until < p_from THEN
        RAISE EXCEPTION 'Invalid Dates: maintenance_until must be >= maintenance_from.';
    END IF;

    SELECT status INTO v_status FROM rooms
    WHERE id = p_room_id AND shop_id = v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room not found.'; END IF;

    IF p_from IS NULL THEN
        v_start_at := NULL;
        v_end_at := NULL;
    ELSE
        v_start_at := p_from::timestamp AT TIME ZONE 'Asia/Bangkok';
        v_end_at := (p_until + 1)::timestamp AT TIME ZONE 'Asia/Bangkok';
    END IF;

    IF v_start_at IS NOT NULL AND EXISTS (
        SELECT 1 FROM bookings
        WHERE room_id = p_room_id AND shop_id = v_shop_id
          AND booking_status IN ('confirmed', 'checked_in')
          AND tstzrange(occupancy_start_at, occupancy_end_at, '[)')
              && tstzrange(v_start_at, v_end_at, '[)')
    ) THEN
        RAISE EXCEPTION 'Maintenance Conflict: room has an overlapping active booking.';
    END IF;
    IF v_start_at IS NOT NULL AND now() >= v_start_at AND now() < v_end_at
       AND v_status IN ('occupied', 'cleaning') THEN
        RAISE EXCEPTION 'Maintenance State Conflict: cannot override occupied/cleaning room state.';
    END IF;

    UPDATE rooms SET
        maintenance_from = p_from,
        maintenance_until = p_until,
        maintenance_start_at = v_start_at,
        maintenance_end_at = v_end_at,
        status = CASE
            WHEN v_start_at IS NOT NULL AND now() >= v_start_at AND now() < v_end_at THEN 'maintenance'
            WHEN status = 'maintenance' THEN 'available'
            ELSE status
        END
    WHERE id = p_room_id AND shop_id = v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION set_room_maintenance(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_room_maintenance(UUID, DATE, DATE) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION set_room_maintenance_v2(
    p_room_id UUID,
    p_start_at TIMESTAMPTZ,
    p_end_at TIMESTAMPTZ
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_status VARCHAR;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only owner or manager can set maintenance.';
    END IF;
    IF (p_start_at IS NULL) <> (p_end_at IS NULL) THEN
        RAISE EXCEPTION 'Maintenance start/end must both be NULL or both be provided.';
    END IF;
    IF p_start_at IS NOT NULL AND p_end_at <= p_start_at THEN
        RAISE EXCEPTION 'Maintenance end must be after start.';
    END IF;

    SELECT status INTO v_status FROM rooms
    WHERE id = p_room_id AND shop_id = v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room not found.'; END IF;

    IF p_start_at IS NOT NULL AND EXISTS (
        SELECT 1 FROM bookings
        WHERE room_id = p_room_id AND shop_id = v_shop_id
          AND booking_status IN ('confirmed', 'checked_in')
          AND tstzrange(occupancy_start_at, occupancy_end_at, '[)')
              && tstzrange(p_start_at, p_end_at, '[)')
    ) THEN
        RAISE EXCEPTION 'Maintenance Conflict: room has an overlapping active booking.';
    END IF;

    IF p_start_at IS NOT NULL AND now() >= p_start_at AND now() < p_end_at
       AND v_status IN ('occupied', 'cleaning') THEN
        RAISE EXCEPTION 'Maintenance State Conflict: cannot override occupied/cleaning room state.';
    END IF;

    UPDATE rooms SET
        maintenance_start_at = p_start_at,
        maintenance_end_at = p_end_at,
        maintenance_from = CASE WHEN p_start_at IS NULL THEN NULL
            ELSE (p_start_at AT TIME ZONE 'Asia/Bangkok')::date END,
        maintenance_until = CASE WHEN p_end_at IS NULL THEN NULL
            ELSE ((p_end_at - interval '1 microsecond') AT TIME ZONE 'Asia/Bangkok')::date END,
        status = CASE
            WHEN p_start_at IS NOT NULL AND now() >= p_start_at AND now() < p_end_at THEN 'maintenance'
            WHEN status = 'maintenance' THEN 'available'
            ELSE status
        END
    WHERE id = p_room_id AND shop_id = v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION set_room_maintenance_v2(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_room_maintenance_v2(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- Replace lifecycle status RPC to understand both legacy date bookings and Booking V2 timestamps.
CREATE OR REPLACE FUNCTION update_booking_status(
    p_booking_id UUID,
    p_new_status VARCHAR
)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_booking RECORD;
    v_room_status VARCHAR;
    v_m_start TIMESTAMPTZ;
    v_m_end TIMESTAMPTZ;
    v_pet_count INT;
BEGIN

    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;

    SELECT * INTO v_booking FROM bookings
    WHERE id = p_booking_id AND shop_id = v_shop_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.'; END IF;

    PERFORM 1 FROM pets p
    JOIN booking_pets bp ON bp.pet_id = p.id
    WHERE bp.booking_id = p_booking_id AND bp.shop_id = v_shop_id
    ORDER BY p.id FOR UPDATE;

    SELECT status, maintenance_start_at, maintenance_end_at
    INTO v_room_status, v_m_start, v_m_end
    FROM rooms
    WHERE id = v_booking.room_id AND shop_id = v_shop_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room not found.'; END IF;

    IF v_booking.booking_status = 'confirmed' AND p_new_status = 'checked_in' THEN
        IF v_room_status = 'maintenance'
           AND NOT (v_m_start IS NOT NULL AND now() >= v_m_start AND now() < v_m_end) THEN
            UPDATE rooms SET status = 'available'
            WHERE id = v_booking.room_id AND shop_id = v_shop_id;
            v_room_status := 'available';
        END IF;

        IF v_booking.booking_model_version = 2 THEN
            IF now() < v_booking.start_at OR now() >= v_booking.end_at THEN
                RAISE EXCEPTION 'Check-in Window Violation: current time is outside Booking V2 stay window.';
            END IF;
        ELSE
            IF pawspace_business_date() <> v_booking.check_in_date THEN
                RAISE EXCEPTION 'Early/Late Check-in Violation: legacy booking can only check in on %.', v_booking.check_in_date;
            END IF;
        END IF;

        IF v_room_status <> 'available' THEN
            RAISE EXCEPTION 'Room State Conflict: room is currently %.', v_room_status;
        END IF;
        IF v_m_start IS NOT NULL AND now() >= v_m_start AND now() < v_m_end THEN
            RAISE EXCEPTION 'Room Maintenance Conflict: room is currently under maintenance.';
        END IF;

        SELECT COUNT(*) INTO v_pet_count FROM booking_pets
        WHERE booking_id = p_booking_id AND shop_id = v_shop_id;
        IF v_pet_count < 1 THEN
            RAISE EXCEPTION 'Cannot check in booking without pets.';
        END IF;

        UPDATE bookings SET booking_status = 'checked_in'
        WHERE id = p_booking_id AND shop_id = v_shop_id;
        UPDATE rooms SET status = 'occupied'
        WHERE id = v_booking.room_id AND shop_id = v_shop_id;

    ELSIF v_booking.booking_status = 'checked_in' AND p_new_status = 'checked_out' THEN
        UPDATE bookings SET booking_status = 'checked_out'
        WHERE id = p_booking_id AND shop_id = v_shop_id;
        UPDATE rooms SET status = 'cleaning'
        WHERE id = v_booking.room_id AND shop_id = v_shop_id;

    ELSIF v_booking.booking_status = 'confirmed' AND p_new_status = 'cancelled' THEN
        UPDATE bookings SET booking_status = 'cancelled'
        WHERE id = p_booking_id AND shop_id = v_shop_id;
    ELSE
        RAISE EXCEPTION 'Illegal Status Transition: cannot transition from % to %.',
            v_booking.booking_status, p_new_status;
    END IF;

    PERFORM enqueue_sync_event(v_shop_id, 'booking', p_booking_id, 'UPSERT', jsonb_build_object('booking_id', p_booking_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION update_booking_status(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_booking_status(UUID, VARCHAR) TO authenticated, service_role;

-- Cut off all new legacy booking/request creation after Booking V2 cutover.
REVOKE ALL ON FUNCTION create_booking(UUID, UUID, DATE, DATE, NUMERIC, TEXT)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION submit_booking_request_internal(VARCHAR, UUID, UUID, UUID[], DATE, DATE, TEXT)
    FROM PUBLIC, anon, authenticated, service_role;

-- Existing V1 records may still be rescheduled through the legacy signature.
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
    v_booking RECORD;
    v_pet_ids UUID[];
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;
    IF p_new_check_out <= p_new_check_in THEN RAISE EXCEPTION 'Invalid Dates.'; END IF;

    SELECT * INTO v_booking FROM bookings
    WHERE id = p_booking_id AND shop_id = v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.'; END IF;
    IF v_booking.booking_model_version <> 1 OR v_booking.booking_status <> 'confirmed' THEN
        RAISE EXCEPTION 'Legacy schedule RPC is allowed only for confirmed V1 bookings.';
    END IF;

    SELECT array_agg(bp.pet_id ORDER BY bp.pet_id) INTO v_pet_ids
    FROM booking_pets bp
    WHERE bp.shop_id = v_shop_id AND bp.booking_id = p_booking_id;

    IF v_pet_ids IS NOT NULL THEN
        PERFORM 1 FROM pets
        WHERE shop_id = v_shop_id AND id = ANY(v_pet_ids)
        ORDER BY id FOR UPDATE;
    END IF;
    PERFORM 1 FROM rooms
    WHERE shop_id = v_shop_id AND id = p_new_room_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room not found.'; END IF;

    IF EXISTS (
        SELECT 1 FROM rooms r
        WHERE r.shop_id = v_shop_id AND r.id = p_new_room_id
          AND r.maintenance_start_at IS NOT NULL
          AND tstzrange(r.maintenance_start_at, r.maintenance_end_at, '[)')
              && tstzrange(
                  p_new_check_in::timestamp AT TIME ZONE 'Asia/Bangkok',
                  p_new_check_out::timestamp AT TIME ZONE 'Asia/Bangkok', '[)'
              )
    ) THEN
        RAISE EXCEPTION 'Room Maintenance Violation.';
    END IF;

    IF v_pet_ids IS NOT NULL AND EXISTS (
        SELECT 1 FROM booking_pets bp
        JOIN bookings b ON b.id = bp.booking_id AND b.shop_id = bp.shop_id
        WHERE bp.shop_id = v_shop_id AND bp.pet_id = ANY(v_pet_ids)
          AND b.id <> p_booking_id AND b.booking_status IN ('confirmed', 'checked_in')
          AND tstzrange(b.occupancy_start_at, b.occupancy_end_at, '[)')
              && tstzrange(
                  p_new_check_in::timestamp AT TIME ZONE 'Asia/Bangkok',
                  p_new_check_out::timestamp AT TIME ZONE 'Asia/Bangkok', '[)'
              )
    ) THEN
        RAISE EXCEPTION 'Pet Conflict: overlapping active booking.';
    END IF;

    IF COALESCE(cardinality(v_pet_ids), 0) > (
        SELECT capacity_pets FROM rooms
        WHERE id = p_new_room_id AND shop_id = v_shop_id
    ) THEN
        RAISE EXCEPTION 'Room Capacity Violation.';
    END IF;

    UPDATE bookings SET
        room_id = p_new_room_id,
        check_in_date = p_new_check_in,
        check_out_date = p_new_check_out,
        special_requests = COALESCE(p_special_requests, special_requests),
        total_amount = COALESCE(p_total_amount, total_amount)
    WHERE id = p_booking_id AND shop_id = v_shop_id;

    PERFORM enqueue_sync_event(v_shop_id, 'booking', p_booking_id, 'UPSERT', jsonb_build_object('booking_id', p_booking_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION update_booking_schedule(UUID, UUID, DATE, DATE, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_booking_schedule(UUID, UUID, DATE, DATE, TEXT, NUMERIC) TO authenticated, service_role;

-- Compatibility room creation: keep legacy room field and seed one DAY x1 Rate Plan.
CREATE OR REPLACE FUNCTION create_room(
    p_room_number VARCHAR,
    p_room_type VARCHAR,
    p_capacity_pets INT,
    p_base_price_per_night NUMERIC(10,2)
)
RETURNS UUID AS $$
DECLARE
    v_shop_id UUID;
    v_room_id UUID;
BEGIN

    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL OR NOT is_shop_manager_or_owner() THEN
        RAISE EXCEPTION 'Unauthorized: Only owner or manager can create rooms.';
    END IF;
    IF p_capacity_pets < 1 OR p_base_price_per_night < 0 THEN
        RAISE EXCEPTION 'Invalid room capacity or price.';
    END IF;

    INSERT INTO rooms (
        shop_id, room_number, room_type, capacity_pets,
        base_price_per_night, status,
        maintenance_from, maintenance_until,
        maintenance_start_at, maintenance_end_at
    ) VALUES (
        v_shop_id, p_room_number, p_room_type, p_capacity_pets,
        p_base_price_per_night, 'available', NULL, NULL, NULL, NULL
    ) RETURNING id INTO v_room_id;

    INSERT INTO room_rate_plans (shop_id, room_id, unit, quantity, price)
    VALUES (v_shop_id, v_room_id, 'DAY', 1, p_base_price_per_night);

    RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION create_room(VARCHAR, VARCHAR, INT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_room(VARCHAR, VARCHAR, INT, NUMERIC) TO authenticated, service_role;

-- Legacy pet mutation RPCs remain V1-only to prevent bypassing V2 quote/capacity rules.
CREATE OR REPLACE FUNCTION add_pet_to_booking(p_booking_id UUID, p_pet_id UUID)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_booking RECORD;
    v_pet_owner_id UUID;
    v_capacity INT;
    v_current_count INT;
BEGIN

    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;

    SELECT * INTO v_booking FROM bookings
    WHERE id = p_booking_id AND shop_id = v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.'; END IF;
    IF v_booking.booking_model_version <> 1 THEN
        RAISE EXCEPTION 'Booking V2 pet membership is immutable through legacy RPCs.';
    END IF;
    IF v_booking.booking_status NOT IN ('confirmed', 'checked_in') THEN
        RAISE EXCEPTION 'Cannot add pet in booking state %.', v_booking.booking_status;
    END IF;

    SELECT owner_id INTO v_pet_owner_id FROM pets
    WHERE id = p_pet_id AND shop_id = v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pet not found.'; END IF;
    IF v_pet_owner_id <> v_booking.owner_id THEN
        RAISE EXCEPTION 'Ownership Violation: pet belongs to another owner.';
    END IF;

    SELECT capacity_pets INTO v_capacity FROM rooms
    WHERE id = v_booking.room_id AND shop_id = v_shop_id FOR UPDATE;

    IF EXISTS (
        SELECT 1 FROM booking_pets bp
        JOIN bookings b ON b.id = bp.booking_id AND b.shop_id = bp.shop_id
        WHERE bp.shop_id = v_shop_id AND bp.pet_id = p_pet_id
          AND b.id <> p_booking_id AND b.booking_status IN ('confirmed', 'checked_in')
          AND tstzrange(b.occupancy_start_at, b.occupancy_end_at, '[)')
              && tstzrange(v_booking.occupancy_start_at, v_booking.occupancy_end_at, '[)')
    ) THEN
        RAISE EXCEPTION 'Pet Conflict: pet has an overlapping active booking.';
    END IF;

    SELECT COUNT(*) INTO v_current_count FROM booking_pets
    WHERE booking_id = p_booking_id AND shop_id = v_shop_id;
    IF v_current_count >= v_capacity THEN
        RAISE EXCEPTION 'Capacity Exceeded.';
    END IF;

    INSERT INTO booking_pets (shop_id, booking_id, pet_id)
    VALUES (v_shop_id, p_booking_id, p_pet_id);
    PERFORM enqueue_sync_event(v_shop_id, 'booking', p_booking_id, 'UPSERT', jsonb_build_object('booking_id', p_booking_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION add_pet_to_booking(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_pet_to_booking(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION remove_pet_from_booking(p_booking_id UUID, p_pet_id UUID)
RETURNS VOID AS $$
DECLARE
    v_shop_id UUID;
    v_booking RECORD;
BEGIN
    v_shop_id := current_staff_shop_id();
    IF v_shop_id IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;
    SELECT * INTO v_booking FROM bookings
    WHERE id = p_booking_id AND shop_id = v_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.'; END IF;
    IF v_booking.booking_model_version <> 1 THEN
        RAISE EXCEPTION 'Booking V2 pet membership is immutable through legacy RPCs.';
    END IF;
    IF v_booking.booking_status <> 'confirmed' THEN
        RAISE EXCEPTION 'Pet removal is allowed only for confirmed V1 bookings.';
    END IF;

    PERFORM 1 FROM pets
    WHERE id = p_pet_id AND shop_id = v_shop_id FOR UPDATE;
    DELETE FROM booking_pets
    WHERE booking_id = p_booking_id AND pet_id = p_pet_id AND shop_id = v_shop_id;
    PERFORM enqueue_sync_event(v_shop_id, 'booking', p_booking_id, 'UPSERT', jsonb_build_object('booking_id', p_booking_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION remove_pet_from_booking(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_pet_from_booking(UUID, UUID) TO authenticated, service_role;

CREATE INDEX idx_room_rate_plans_shop_room_active
ON room_rate_plans (shop_id, room_id, is_active, unit, quantity);

CREATE INDEX idx_booking_requests_shop_start_v2
ON booking_requests (shop_id, start_at, end_at)
WHERE booking_model_version = 2;

COMMENT ON TABLE room_rate_plans IS
'PS01 Booking V2 fixed-package Rate Plans. Booking/request rows snapshot price and duration facts.';
COMMENT ON COLUMN bookings.quoted_price IS
'Immutable quote snapshot for Booking V2; rate-plan edits never rewrite historical booking price.';
COMMENT ON COLUMN booking_requests.quoted_price IS
'Quote snapshot captured when the customer submits a V2 request and preserved at confirmation.';
