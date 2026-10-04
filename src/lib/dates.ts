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

// The instant for a wall-clock time ("YYYY-MM-DDTHH:mm") in the given time
// zone. Two passes of offset correction land on the right instant, including
// across daylight-saving changes.
export function zonedTimeToDate(local: string, timeZone: string) {
  const asUtc = Date.parse(`${local}:00Z`);
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const base = Math.floor(guess / 60000) * 60000;
    const localAsUtc =
      Date.parse(`${dayKey(new Date(base), timeZone)}T00:00:00Z`) +
      minutesInZone(new Date(base), timeZone) * 60000;
    guess = asUtc - (localAsUtc - base);
  }
  return new Date(guess);
}
