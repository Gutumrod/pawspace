const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const LOCAL_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function bangkokLocalInputToIso(value: string): string | null {
  const match = LOCAL_INPUT_RE.exec(value);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const utcMs = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)) - BANGKOK_OFFSET_MS;
  const parsed = new Date(utcMs);
  if (!Number.isFinite(parsed.valueOf())) return null;
  const roundTrip = new Date(utcMs + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
  return roundTrip === value ? parsed.toISOString() : null;
}

export function isoToBangkokLocalInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return "";
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
}

export function defaultBangkokLocalInput(hoursFromNow = 1): string {
  const now = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  now.setUTCMinutes(0, 0, 0);
  return isoToBangkokLocalInput(now.toISOString());
}

export function formatBangkokDateTime(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
}
