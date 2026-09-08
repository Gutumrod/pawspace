import "server-only";

import { Pool, type QueryResult } from "pg";
import { requirePs01RuntimeDatabaseEnv } from "./env";
import type { Ps01RuntimeRpcClient } from "./line-booking-core";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const env = requirePs01RuntimeDatabaseEnv();
  if (!env.user.startsWith("ps01_runtime_login.")) {
    throw new Error("PS01 runtime database user must be the bounded ps01_runtime_login pooler identity.");
  }
  pool = new Pool({
    host: env.host,
    port: env.port,
    database: env.database,
    user: env.user,
    password: env.password,
    ssl: { rejectUnauthorized: true },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    application_name: "ps01-line-runtime",
  });
  return pool;
}
type RpcError = { message: string };

type RpcResult = {
  data: unknown;
  error: RpcError | null;
};

async function one(sql: string, values: unknown[]): Promise<RpcResult> {
  try {
    const result: QueryResult<{ data: unknown }> = await getPool().query(sql, values);
    return { data: result.rows[0]?.data ?? null, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PS01 runtime database call failed.";
    return { data: null, error: { message } };
  }
}

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing RPC argument: ${key}`);
  return value;
}

function stringArrayArg(args: Record<string, unknown>, key: string): string[] {
  const value = args[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid RPC argument: ${key}`);
  }
  return value as string[];
}
export function getPs01RuntimeDatabaseClient(): Ps01RuntimeRpcClient {
  return {
    async rpc(name, args) {
      if (name === "get_customer_booking_context_v2_internal") {
        return one(
          "select ps01.get_customer_booking_context_v2_internal($1::varchar,$2::uuid) as data",
          [stringArg(args, "p_verified_line_user_id"), stringArg(args, "p_shop_id")],
        );
      }

      if (name === "quote_customer_booking_v2_internal") {
        return one(
          "select ps01.quote_customer_booking_v2_internal($1::varchar,$2::uuid,$3::uuid,$4::uuid,$5::uuid[],$6::timestamptz) as data",
          [
            stringArg(args, "p_verified_line_user_id"),
            stringArg(args, "p_shop_id"),
            stringArg(args, "p_room_id"),
            stringArg(args, "p_rate_plan_id"),
            stringArrayArg(args, "p_pet_ids"),
            stringArg(args, "p_start_at"),
          ],
        );
      }
      if (name === "submit_booking_request_v2_internal") {
        return one(
          "select ps01.submit_booking_request_v2_internal($1::varchar,$2::uuid,$3::uuid,$4::uuid,$5::uuid[],$6::timestamptz,$7::text) as data",
          [
            stringArg(args, "p_verified_line_user_id"),
            stringArg(args, "p_shop_id"),
            stringArg(args, "p_room_id"),
            stringArg(args, "p_rate_plan_id"),
            stringArrayArg(args, "p_pet_ids"),
            stringArg(args, "p_start_at"),
            typeof args.p_special_requests === "string" ? args.p_special_requests : null,
          ],
        );
      }

      return {
        data: null,
        error: { message: `PS01 runtime RPC is not allowlisted: ${name}` },
      };
    },
  };
}
