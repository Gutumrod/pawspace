import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = path.join(root, "supabase", "migrations");
const outputDir = path.join(root, "supabase", "shared-runtime");
const outputFile = path.join(outputDir, "ps01-baseline.sql");

const files = fs.readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length !== 13) {
  throw new Error(`Expected 13 canonical PS01 migrations, found ${files.length}.`);
}

const sources = files.map((name) => ({
  name,
  text: fs.readFileSync(path.join(migrationDir, name), "utf8"),
}));

const sourceHash = crypto.createHash("sha256")
  .update(sources.map(({ name, text }) => `${name}\n${text}`).join("\n"))
  .digest("hex");
function transformMigration(text) {
  return text
    .replace(/^CREATE EXTENSION IF NOT EXISTS .*?;\r?\n/gm, "")
    .replaceAll("SET search_path = public, pg_temp", "SET search_path = ps01, extensions, pg_temp")
    .replaceAll("'daily-report-photos'", "'ps01-daily-report-photos'")
    .replace(/\bservice_role\b/g, "ps01_runtime");
}

const prelude = `-- GENERATED FILE. DO NOT EDIT DIRECTLY.
-- PS01 shared-runtime baseline compiled from the 13 canonical historical migrations.
-- Canonical source SHA-256: ${sourceHash}

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
`;
const namespace = `
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
`;

const ledger = `
CREATE TABLE IF NOT EXISTS ps01_internal.schema_migrations (
  source_hash text PRIMARY KEY,
  migration_count integer NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE ps01_internal.schema_migrations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE ps01_internal.schema_migrations TO ps01_runtime;
INSERT INTO ps01_internal.schema_migrations (source_hash, migration_count)
VALUES ('${sourceHash}', ${files.length})
ON CONFLICT (source_hash) DO NOTHING;
`;
const body = sources.map(({ name, text }) => {
  return `\n-- BEGIN LEGACY SOURCE: ${name}\n${transformMigration(text)}\n-- END LEGACY SOURCE: ${name}\n`;
}).join("\n");

const output = `${prelude}${namespace}${body}${ledger}`;

if (/GRANT\s+[\s\S]*?\bTO\s+service_role\b/i.test(output)) {
  throw new Error("Generated PS01 baseline must not grant privileges to service_role.");
}
if (output.includes("SET search_path = public, pg_temp")) {
  throw new Error("Generated PS01 baseline still contains legacy public search_path.");
}
if (output.includes("'daily-report-photos'")) {
  throw new Error("Generated PS01 baseline still contains the legacy storage bucket name.");
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, output, "utf8");
console.log(`Generated ${path.relative(root, outputFile)}`);
console.log(`Source hash: ${sourceHash}`);
console.log(`Migrations: ${files.length}`);
