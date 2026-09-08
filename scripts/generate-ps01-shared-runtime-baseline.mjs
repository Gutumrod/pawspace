import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = path.join(root, "supabase", "migrations");
const outputDir = path.join(root, "supabase", "shared-runtime");
const outputFile = path.join(outputDir, "ps01-baseline.sql");
const bootstrapFile = path.join(outputDir, "ps01-platform-bootstrap.sql");
const managedAssetsFile = path.join(outputDir, "ps01-managed-assets.sql");

const files = fs.readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length !== 14) {
  throw new Error(`Expected 14 canonical PS01 migrations (13 historical + Booking V2), found ${files.length}.`);
}

const sources = files.map((name) => ({
  name,
  text: fs.readFileSync(path.join(migrationDir, name), "utf8").replace(/\r\n/g, "\n"),
}));

const sourceHash = crypto.createHash("sha256")
  .update(sources.map(({ name, text }) => `${name}\n${text}`).join("\n"))
  .digest("hex");
const storageBucketMutation = /INSERT INTO storage\.buckets[\s\S]*?allowed_mime_types = EXCLUDED\.allowed_mime_types;\n?/g;

function transformMigration(text) {
  return text
    .replace(/^CREATE EXTENSION IF NOT EXISTS .*?;\r?\n/gm, "")
    .replace(storageBucketMutation, "-- Managed Storage bucket mutation emitted separately for platform-admin apply.\n")
    .replaceAll("SET search_path = public, pg_temp", "SET search_path = ps01, extensions, pg_temp")
    .replaceAll("'daily-report-photos'", "'ps01-daily-report-photos'")
    .replaceAll("auth.uid()", "ps01_request_user_id()")
    .replaceAll("UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE", "UUID PRIMARY KEY")
    .replaceAll("performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE", "performed_by UUID NOT NULL")
    .replaceAll("'user_id', u.id,", "'user_id', su.id,")
    .replaceAll("    JOIN auth.users u ON u.id = su.id\n", "")
    .replace(/    -- Look up caller details from auth\.users \/ JWT claim\n    SELECT email, COALESCE\(raw_user_meta_data ->> 'name', email, 'Owner'\)\n    INTO v_caller_email, v_caller_name\n    FROM auth\.users\n    WHERE id = v_caller_id;\n/g,
      "    -- Resolve caller details from verified PostgREST JWT claims; no direct auth schema dependency.\n    v_caller_email := ps01_request_email();\n    v_caller_name := ps01_request_name();\n")
    .replace(/    IF NOT EXISTS \(SELECT 1 FROM auth\.users WHERE id = p_user_id\) THEN\n        RAISE EXCEPTION 'Auth User % not found\.', p_user_id;\n    END IF;\n\n/g,
      "    -- Auth user existence is established by the narrow server-side Auth Admin adapter before membership creation.\n")
    .replace(/\bservice_role\b/g, "ps01_runtime");
}

const bootstrap = `-- GENERATED FILE. PLATFORM-ADMIN BOOTSTRAP ONLY.
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
`;

const prelude = `-- GENERATED FILE. DO NOT EDIT DIRECTLY.
-- PS01 shared-runtime baseline compiled from 14 canonical migrations (13 historical preserved + Booking V2 forward migration).
-- Canonical source SHA-256: ${sourceHash}
DO $$
DECLARE missing text;
BEGIN
  IF current_user <> 'ps01_migrator' THEN
    RAISE EXCEPTION 'PS01 baseline must execute as ps01_migrator, got %.', current_user;
  END IF;
  IF pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname='ps01')) <> 'ps01_migrator'
     OR pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname='ps01_internal')) <> 'ps01_migrator' THEN
    RAISE EXCEPTION 'PS01 schema ownership is not bound to ps01_migrator.';
  END IF;
  IF has_database_privilege('ps01_migrator', current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'ps01_migrator must not have database-wide CREATE.';
  END IF;
  SELECT string_agg(required.extname, ', ' ORDER BY required.extname) INTO missing
  FROM (VALUES ('btree_gist'), ('pgcrypto'), ('uuid-ossp')) AS required(extname)
  WHERE NOT EXISTS (SELECT 1 FROM pg_extension e WHERE e.extname = required.extname);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'PS01 prerequisite extensions missing: %', missing; END IF;
END $$;
`;
const namespace = `
REVOKE ALL ON SCHEMA ps01 FROM PUBLIC, anon, service_role;
REVOKE ALL ON SCHEMA ps01_internal FROM PUBLIC, anon, authenticated, service_role, ps01_runtime;
GRANT USAGE ON SCHEMA ps01 TO authenticated, ps01_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA ps01 REVOKE ALL ON TABLES FROM PUBLIC, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ps01 REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ps01 REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, service_role;
SET search_path = ps01, extensions, pg_temp;

CREATE OR REPLACE FUNCTION ps01_request_user_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
    NULLIF((COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) ->> 'sub'), '')::uuid
  );
$$;
CREATE OR REPLACE FUNCTION ps01_request_email()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    NULLIF((COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) ->> 'email'), '')
  );
$$;
CREATE OR REPLACE FUNCTION ps01_request_name()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.name', true), ''),
    NULLIF((COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) -> 'user_metadata' ->> 'name'), '')
  );
$$;
REVOKE ALL ON FUNCTION ps01_request_user_id(), ps01_request_email(), ps01_request_name() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ps01_request_user_id(), ps01_request_email(), ps01_request_name() TO authenticated, ps01_runtime;
`;

const ledger = `
CREATE TABLE IF NOT EXISTS ps01_internal.schema_migrations (
  source_hash text PRIMARY KEY,
  migration_count integer NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE ps01_internal.schema_migrations FROM PUBLIC, anon, authenticated, service_role, ps01_runtime;
INSERT INTO ps01_internal.schema_migrations (source_hash, migration_count)
VALUES ('${sourceHash}', ${files.length})
ON CONFLICT (source_hash) DO NOTHING;
`;
const body = sources.map(({ name, text }) => {
  return `\n-- BEGIN LEGACY SOURCE: ${name}\n${transformMigration(text)}\n-- END LEGACY SOURCE: ${name}\n`;
}).join("\n");

const managedAssets = `-- GENERATED FILE. PLATFORM-ADMIN MANAGED-ASSET APPLY ONLY.
DO $$ BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'PS01 managed assets require platform-admin postgres session.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ps01') THEN
    RAISE EXCEPTION 'PS01 schema must exist before managed assets are applied.';
  END IF;
END $$;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ps01-daily-report-photos', 'ps01-daily-report-photos', TRUE, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif','image/tiff','image/bmp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
`;

const output = `${prelude}${namespace}${body}${ledger}`;
if (/GRANT\s+[\s\S]*?\bTO\s+service_role\b/i.test(output)) {
  throw new Error("Generated PS01 baseline must not grant privileges to service_role.");
}
if (output.includes("SET search_path = public, pg_temp")) {
  throw new Error("Generated PS01 baseline still contains legacy public search_path.");
}
if (output.includes("storage.buckets")) {
  throw new Error("Generated PS01 baseline must not mutate managed Storage tables.");
}
if (output.includes("'daily-report-photos'")) {
  throw new Error("Generated PS01 baseline still contains the legacy storage bucket name.");
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(bootstrapFile, bootstrap, "utf8");
fs.writeFileSync(outputFile, output, "utf8");
fs.writeFileSync(managedAssetsFile, managedAssets, "utf8");
console.log(`Generated ${path.relative(root, bootstrapFile)}`);
console.log(`Generated ${path.relative(root, outputFile)}`);
console.log(`Generated ${path.relative(root, managedAssetsFile)}`);
console.log(`Source hash: ${sourceHash}`);
console.log(`Migrations: ${files.length}`);
