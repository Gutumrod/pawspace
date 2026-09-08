-- GENERATED FILE. PLATFORM-ADMIN BOOTSTRAP ONLY.
-- Creates bounded PS01 roles/namespaces without touching another Product schema.
DO $$ BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'PS01 bootstrap requires platform-admin postgres session.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ps01_migrator') THEN
    CREATE ROLE ps01_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ps01_runtime') THEN
    CREATE ROLE ps01_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ps01_runtime_login') THEN
    CREATE ROLE ps01_runtime_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname IN ('ps01_migrator','ps01_runtime')
      AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'Existing PS01 role has unsafe attributes.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'ps01_runtime_login'
      AND (NOT rolcanlogin OR NOT rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'Existing ps01_runtime_login role has unsafe attributes.';
  END IF;
END $$;
GRANT ps01_migrator TO postgres;
GRANT ps01_runtime TO authenticator;
GRANT ps01_runtime TO ps01_runtime_login;
ALTER ROLE ps01_runtime_login SET search_path = 'ps01', 'pg_catalog';
ALTER ROLE ps01_runtime_login SET statement_timeout = '8s';
ALTER ROLE ps01_runtime_login SET lock_timeout = '8s';
CREATE SCHEMA IF NOT EXISTS ps01 AUTHORIZATION ps01_migrator;
CREATE SCHEMA IF NOT EXISTS ps01_internal AUTHORIZATION ps01_migrator;
ALTER SCHEMA ps01 OWNER TO ps01_migrator;
ALTER SCHEMA ps01_internal OWNER TO ps01_migrator;
REVOKE ALL ON SCHEMA ps01 FROM PUBLIC, anon, service_role, ps01_runtime;
REVOKE ALL ON SCHEMA ps01_internal FROM PUBLIC, anon, authenticated, service_role, ps01_runtime;
GRANT USAGE ON SCHEMA ps01 TO authenticated, ps01_runtime;
GRANT USAGE ON SCHEMA extensions TO ps01_migrator;
DO $$ BEGIN
  EXECUTE format('REVOKE CREATE ON DATABASE %I FROM ps01_migrator', current_database());
  EXECUTE format('REVOKE CREATE ON DATABASE %I FROM ps01_runtime', current_database());
  EXECUTE format('REVOKE CREATE ON DATABASE %I FROM ps01_runtime_login', current_database());
END $$;
