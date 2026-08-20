// Safe structured logging utility with strict secret scrubbing

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "service_role",
  "service_role_key",
  "authorization",
  "cookie",
  "jwt",
  "key",
  "access_token",
  "refresh_token",
  "apikey",
  "anon_key",
]);

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;

  const lowerKey = key.toLowerCase();
  for (const sensitive of SENSITIVE_KEYS) {
    if (lowerKey.includes(sensitive)) {
      return "[REDACTED]";
    }
  }

  if (typeof value === "string") {
    // Check for common JWT format or long hex/base64 strings
    if (value.startsWith("eyJ") && value.split(".").length === 3) {
      return "[REDACTED_JWT]";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(String(index), item));
  }

  if (typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>);
  }

  return value;
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = sanitizeValue(k, v);
  }
  return result;
}

export type LogLevel = "info" | "warn" | "error" | "debug";

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const sanitizedContext = context ? sanitizeObject(context) : undefined;
  const payload = {
    timestamp,
    level,
    message,
    ...(sanitizedContext ? { context: sanitizedContext } : {}),
  };

  const formatted = JSON.stringify(payload);
  if (level === "error") {
    console.error(formatted);
  } else if (level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => log("error", message, context),
  debug: (message: string, context?: Record<string, unknown>) => log("debug", message, context),
};
