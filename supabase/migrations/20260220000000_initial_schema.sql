-- PawSpace V1 Phase 1 — Hardened target schema only
-- Source of truth: docs/PRD.md + docs/SYSTEM_ARCHITECTURE.md
-- Phase 2 owns RPCs, RLS policies, grants/revokes, and mutation authorization.

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
