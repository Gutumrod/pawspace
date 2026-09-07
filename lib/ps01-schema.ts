export const PS01_DATABASE_SCHEMA = "ps01" as const;
export const PS01_INTERNAL_SCHEMA = "ps01_internal" as const;
export const PS01_DAILY_REPORT_BUCKET = "ps01-daily-report-photos" as const;

/**
 * PS01 owns only its own database namespace. This intentionally has no
 * environment override: a Pawstia runtime must never be pointed at another
 * Product schema by configuration.
 */
export function ps01DatabaseOptions() {
  return {
    db: { schema: PS01_DATABASE_SCHEMA },
  } as const;
}
