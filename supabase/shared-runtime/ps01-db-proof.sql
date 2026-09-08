\set ON_ERROR_STOP on

-- PS01 isolated shared-runtime DB proof. Sandbox only.
-- This file must never be executed against WSTERA LAB or Production directly.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ps01') THEN
    RAISE EXCEPTION 'PS01_PROOF: ps01 schema missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ps01_internal') THEN
    RAISE EXCEPTION 'PS01_PROOF: ps01_internal schema missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ps01_runtime') THEN
    RAISE EXCEPTION 'PS01_PROOF: ps01_runtime role missing';
  END IF;
END $$;

DO $$
DECLARE table_count integer;
BEGIN
  SELECT count(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'ps01' AND table_type = 'BASE TABLE';
  IF table_count <> 21 THEN
    RAISE EXCEPTION 'PS01_PROOF: expected 21 ps01 tables (Booking V2 included), found %', table_count;
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'shops','staff_users','pet_owners','pets','rooms','bookings','booking_pets',
        'daily_reports','google_sync_mappings','sync_queue','camera_settings',
        'camera_visitor_credentials','camera_rate_limit_buckets','camera_access_audit',
        'commercial_packages','shop_commercial_assignments','booking_requests',
        'import_batches','shop_subscriptions','subscription_audit_log'
      )
  ) THEN
    RAISE EXCEPTION 'PS01_PROOF: PS01 table leaked into public schema';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'ps01'
      AND EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg = 'search_path=public, pg_temp'
      )
  ) THEN
    RAISE EXCEPTION 'PS01_PROOF: function retains public search_path';
  END IF;
END $$;
DO $$
DECLARE r record;
BEGIN
  SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
  INTO r
  FROM pg_roles WHERE rolname = 'ps01_runtime';
  IF r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole
     OR r.rolreplication OR r.rolbypassrls THEN
    RAISE EXCEPTION 'PS01_PROOF: ps01_runtime has elevated role attributes';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'ps01-daily-report-photos'
  ) THEN
    RAISE EXCEPTION 'PS01_PROOF: PS01 storage bucket missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'daily-report-photos'
  ) THEN
    RAISE EXCEPTION 'PS01_PROOF: legacy generic storage bucket exists';
  END IF;
END $$;

DROP SCHEMA IF EXISTS ps01_foreign_probe CASCADE;
DROP ROLE IF EXISTS ps01_foreign_probe;
CREATE ROLE ps01_foreign_probe NOLOGIN;
CREATE SCHEMA ps01_foreign_probe;
CREATE TABLE ps01_foreign_probe.secret_probe(id integer primary key, note text);
INSERT INTO ps01_foreign_probe.secret_probe VALUES (1, 'must-not-cross');
REVOKE ALL ON SCHEMA ps01_foreign_probe FROM PUBLIC, ps01_runtime, ps01_foreign_probe;
REVOKE ALL ON TABLE ps01_foreign_probe.secret_probe FROM PUBLIC, ps01_runtime, ps01_foreign_probe;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
     AND has_schema_privilege('service_role', 'ps01', 'USAGE') THEN
    RAISE EXCEPTION 'PS01_PROOF: project service_role still has ps01 schema USAGE';
  END IF;
END $$;

DO $$
DECLARE r record;
BEGIN
  SELECT rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls
  INTO r FROM pg_roles WHERE rolname = 'ps01_runtime';
  IF r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolcanlogin OR r.rolbypassrls THEN
    RAISE EXCEPTION 'PS01_PROOF: ps01_runtime has unsafe role attributes';
  END IF;
  IF NOT has_schema_privilege('ps01_runtime', 'ps01', 'USAGE') THEN
    RAISE EXCEPTION 'PS01_PROOF: ps01_runtime lacks PS01 schema USAGE';
  END IF;
  IF has_schema_privilege('ps01_runtime', 'ps01_foreign_probe', 'USAGE')
     OR has_schema_privilege('ps01_runtime', 'ps01_foreign_probe', 'CREATE')
     OR has_table_privilege('ps01_runtime', 'ps01_foreign_probe.secret_probe', 'SELECT')
     OR has_table_privilege('ps01_runtime', 'ps01_foreign_probe.secret_probe', 'INSERT')
     OR has_schema_privilege('ps01_runtime', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'PS01_PROOF: ps01_runtime crossed foreign/public boundary';
  END IF;
  IF has_schema_privilege('ps01_foreign_probe', 'ps01', 'USAGE')
     OR has_table_privilege('ps01_foreign_probe', 'ps01.shops', 'SELECT') THEN
    RAISE EXCEPTION 'PS01_PROOF: foreign role can access PS01';
  END IF;
END $$;
DROP SCHEMA ps01_foreign_probe CASCADE;
DROP ROLE ps01_foreign_probe;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ps01_internal.schema_migrations
    WHERE migration_count = 14
  ) THEN
    RAISE EXCEPTION 'PS01_PROOF: PS01 migration ledger missing canonical baseline';
  END IF;
END $$;

SELECT
  'PS01_DB_PROOF_PASS' AS verdict,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'ps01') AS ps01_tables,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'ps01') AS ps01_functions;
