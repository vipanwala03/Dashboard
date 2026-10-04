// YYYY-MM-DD for an instant, as seen in the given time zone.
export function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Formats a YYYY-MM-DD key, e.g. "Monday, Oct 6".
export function formatDayKey(
  key: string,
  weekday: "long" | "short" = "long"
) {
  // Noon UTC keeps the date stable no matter how it's formatted.
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday,
    month: "short",
    day: "numeric",
  }).format(new Date(`${key}T12:00:00Z`));
}

// Shifts a YYYY-MM-DD key by whole days (calendar arithmetic, no time zone).
export function addDays(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Minutes since midnight for an instant, as seen in the given time zone.
export function minutesInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}
