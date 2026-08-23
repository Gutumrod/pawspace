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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION update_shop_profile(VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_shop_profile(VARCHAR, VARCHAR, VARCHAR) TO authenticated, service_role;


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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION import_customers_and_pets_atomic(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION import_customers_and_pets_atomic(JSONB) TO authenticated, service_role;
