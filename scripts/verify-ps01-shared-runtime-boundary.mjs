import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const fail = (message) => { throw new Error(message); };

const baselineRel = "supabase/shared-runtime/ps01-baseline.sql";
const baseline = read(baselineRel);

const required = [
  "CREATE SCHEMA IF NOT EXISTS ps01;",
  "CREATE SCHEMA IF NOT EXISTS ps01_internal;",
  "CREATE ROLE ps01_runtime NOLOGIN;",
  "SET search_path = ps01, extensions, pg_temp;",
  "ps01_internal.schema_migrations",
];
for (const needle of required) {
  if (!baseline.includes(needle)) fail(`Baseline missing: ${needle}`);
}

if (baseline.includes("SET search_path = public, pg_temp")) fail("Legacy public search_path remains.");
if (baseline.includes("'daily-report-photos'")) fail("Legacy storage bucket remains.");
if (/GRANT\s+[^;]+\bTO\s+service_role\b/is.test(baseline)) fail("service_role grant found in baseline.");
if (/CREATE EXTENSION/i.test(baseline)) fail("PS01 baseline must not mutate shared extensions.");
const clientFiles = [
  "lib/supabase-server.ts",
  "lib/supabase-admin.ts",
  "lib/supabase.ts",
  "lib/supabase-browser.ts",
];
for (const rel of clientFiles) {
  const text = read(rel);
  if (!text.includes("ps01DatabaseOptions")) fail(`${rel} is not pinned to PS01 schema.`);
}

const coreFiles = [
  "lib/auth.ts",
  "lib/tenant-context.ts",
  "lib/operations-service.ts",
  "lib/booking-service.ts",
  "lib/csv-import-service.ts",
];
for (const rel of coreFiles) {
  if (read(rel).includes("getSupabaseAdminClient")) {
    fail(`Closed Beta core unexpectedly depends on project admin client: ${rel}`);
  }
}

const sourceRoots = ["app", "lib"];
for (const sourceRoot of sourceRoots) {
  const result = spawnSync("rg", ["-n", "\\.schema\\(", sourceRoot], { cwd: root, encoding: "utf8" });
  if (result.status === 0 && result.stdout.trim()) {
    fail(`Explicit schema override found outside PS01 client boundary:\n${result.stdout}`);
  }
  if (result.status !== 0 && result.status !== 1) fail(`rg failed while checking ${sourceRoot}.`);
}
const markerCount = (baseline.match(/-- BEGIN LEGACY SOURCE:/g) || []).length;
if (markerCount !== 13) fail(`Expected 13 legacy source markers, found ${markerCount}.`);

const storage = read("lib/daily-report-storage.ts");
if (!storage.includes("PS01_DAILY_REPORT_BUCKET")) {
  fail("Daily Report storage is not pinned to the PS01-prefixed bucket.");
}

const migrationDiff = execFileSync("git", ["diff", "--name-only", "--", "supabase/migrations"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (migrationDiff) fail(`Historical migrations were modified:\n${migrationDiff}`);

console.log("PS01 shared-runtime boundary verification PASS");
console.log(`Legacy migrations preserved: ${markerCount}/13`);
console.log("Core PMS admin-client dependency: none");
console.log("Runtime database schema: ps01");
