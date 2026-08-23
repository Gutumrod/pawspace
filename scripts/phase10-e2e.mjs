import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args, options = {}) {
  const result = spawnSync(pnpm, args, {
    cwd: root,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? "";
}

const statusOutput = run(["exec", "supabase", "status", "-o", "env"], { capture: true });
const localEnv = {};
for (const line of statusOutput.split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)="(.*)"$/.exec(line.trim());
  if (match) localEnv[match[1]] = match[2];
}
const env = {
  ...process.env,
  ...localEnv,
  NEXT_PUBLIC_SUPABASE_URL: localEnv.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: localEnv.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: localEnv.SERVICE_ROLE_KEY,
  APP_BASE_URL: "http://127.0.0.1:3100",
  NODE_ENV: "test",
};

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Could not resolve local Supabase credentials from `supabase status -o env`.");
}

run(["build"], { env });
run(["exec", "playwright", "test", "tests/e2e/phase10-pilot.spec.ts"], { env });
