import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const fail = (message) => { throw new Error(message); };

const baselineRel = "supabase/shared-runtime/ps01-baseline.sql";
const bootstrapRel = "supabase/shared-runtime/ps01-platform-bootstrap.sql";
const managedAssetsRel = "supabase/shared-runtime/ps01-managed-assets.sql";
const baseline = read(baselineRel);
const bootstrap = read(bootstrapRel);
const managedAssets = read(managedAssetsRel);

const requiredBaseline = [
  "PS01 baseline must execute as ps01_migrator",
  "SET search_path = ps01, extensions, pg_temp;",
  "ps01_internal.schema_migrations",
];
for (const needle of requiredBaseline) {
  if (!baseline.includes(needle)) fail(`Baseline missing: ${needle}`);
}
const requiredBootstrap = [
  "CREATE ROLE ps01_migrator NOLOGIN",
  "CREATE ROLE ps01_runtime NOLOGIN",
  "CREATE ROLE ps01_runtime_login LOGIN",
  "GRANT ps01_runtime TO ps01_runtime_login;",
  "ALTER ROLE ps01_runtime_login SET search_path = 'ps01', 'pg_catalog';",
  "CREATE SCHEMA IF NOT EXISTS ps01 AUTHORIZATION ps01_migrator;",
  "CREATE SCHEMA IF NOT EXISTS ps01_internal AUTHORIZATION ps01_migrator;",
  "REVOKE CREATE ON DATABASE",
];
for (const needle of requiredBootstrap) {
  if (!bootstrap.includes(needle)) fail(`Platform bootstrap missing: ${needle}`);
}
if (baseline.includes("CREATE SCHEMA") || baseline.includes("CREATE ROLE")) fail("PS01 baseline must not bootstrap platform roles/schemas.");
if (baseline.includes("storage.buckets")) fail("PS01 baseline must not mutate managed Storage tables.");
if (/auth\.(?:users|uid\s*\()/i.test(baseline)) fail("PS01 baseline must not depend directly on managed auth schema objects.");
if (baseline.includes("SET search_path = public, pg_temp")) fail("Legacy public search_path remains.");
if (baseline.includes("'daily-report-photos'")) fail("Legacy storage bucket remains.");
if (/GRANT\s+[^;]+\bTO\s+service_role\b/is.test(baseline)) fail("service_role grant found in baseline.");
if (/CREATE EXTENSION/i.test(baseline)) fail("PS01 baseline must not mutate shared extensions.");
if (!managedAssets.includes("'ps01-daily-report-photos'")) fail("Managed Storage asset is not PS01-prefixed.");
const clientFiles = [
  "lib/supabase-server.ts",
  "lib/supabase-admin.ts",
  "lib/supabase.ts",
  "lib/supabase-browser.ts",
  "lib/ps01-runtime.ts",
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
  "lib/line-booking-core.ts",
  "lib/line-booking-server.ts",
];
for (const rel of coreFiles) {
  if (read(rel).includes("getSupabaseAdminClient")) {
    fail(`Closed Beta core unexpectedly depends on project admin client: ${rel}`);
  }
}
const lineBookingServer = read("lib/line-booking-server.ts");
if (!lineBookingServer.includes("getPs01RuntimeDatabaseClient")) {
  fail("Customer Booking V2 is not routed through the bounded PS01 database runtime client.");
}
const runtimeDb = read("lib/ps01-runtime-db.ts");
for (const rpc of [
  "get_customer_booking_context_v2_internal",
  "quote_customer_booking_v2_internal",
  "submit_booking_request_v2_internal",
]) {
  if (!runtimeDb.includes(rpc)) fail(`Bounded runtime adapter missing allowlisted RPC: ${rpc}`);
}
if (runtimeDb.includes("local_service") || runtimeDb.includes("service_role") || runtimeDb.includes("SUPABASE_SERVICE_ROLE_KEY")) {
  fail("Bounded runtime adapter contains cross-product/admin privilege references.");
}
if (!runtimeDb.includes("ps01_runtime_login.")) fail("Bounded runtime adapter does not fail closed on the PS01 login identity.");

function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}
for (const sourceRoot of ["app", "lib"]) {
  for (const full of walkFiles(path.join(root, sourceRoot))) {
    if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    if (text.includes(".schema(")) {
      fail(`Explicit schema override found outside PS01 client boundary: ${path.relative(root, full)}`);
    }
  }
}
const markerCount = (baseline.match(/-- BEGIN LEGACY SOURCE:/g) || []).length;
if (markerCount !== 14) fail(`Expected 14 canonical source markers, found ${markerCount}.`);

const storage = read("lib/daily-report-storage.ts");
if (!storage.includes("PS01_DAILY_REPORT_BUCKET")) {
  fail("Daily Report storage is not pinned to the PS01-prefixed bucket.");
}

const migrationDiff = execFileSync("git", ["diff", "--name-only", "--", "supabase/migrations"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (migrationDiff) fail(`Tracked historical migrations were modified:\n${migrationDiff}`);

console.log("PS01 shared-runtime boundary verification PASS");
console.log(`Canonical migration sources included: ${markerCount}/14`);
console.log("Core PMS admin-client dependency: none");
console.log("Runtime database schema: ps01");
