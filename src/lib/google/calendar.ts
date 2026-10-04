import { googleFetch } from "./fetch";
import { addDays, dayKey } from "@/lib/dates";

export type CalendarEvent = {
  // Prefixed with the calendar id — event ids are only unique per calendar.
  id: string;
  title: string;
  htmlLink?: string;
  location?: string;
  // All-day events only have dates (YYYY-MM-DD, end exclusive); timed
  // events have full ISO dateTimes.
  allDay: boolean;
  start: string;
  end: string;
  calendarName: string;
  // The calendar's color in Google Calendar, e.g. "#9fe1e7".
  color: string;
};

export type CalendarRange = {
  // The primary calendar's time zone — the server runs in UTC on Vercel, so
  // day boundaries and times have to use this instead of the server's.
  timeZone: string;
  todayKey: string;
  // First day shown (YYYY-MM-DD) and the days in range, in order.
  startKey: string;
  dayKeys: string[];
  // Calendars that have events in range, for the legend.
  calendars: { name: string; color: string }[];
  // Sorted: by day, all-day events first, then by start time.
  events: CalendarEvent[];
};

type GoogleCalendarListEntry = {
  id: string;
  summary: string;
  summaryOverride?: string;
  backgroundColor: string;
  timeZone: string;
  primary?: boolean;
  // Checked in Google Calendar's sidebar.
  selected?: boolean;
};

type GoogleEvent = {
  id: string;
  iCalUID: string;
  summary?: string;
  htmlLink?: string;
  location?: string;
  status?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
};

// Fetches events from every calendar that's switched on in Google Calendar
// (class schedules often live on their own calendar) for `days` days
// starting at `startKey` (default: today), merged into one sorted list.
export async function listCalendarRange(
  accessToken: string,
  { startKey, days = 7 }: { startKey?: string; days?: number } = {}
): Promise<CalendarRange> {
  const list = await googleFetch<{ items?: GoogleCalendarListEntry[] }>(
    "Google Calendar",
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    accessToken
  );
  const calendars = (list.items ?? []).filter((c) => c.primary || c.selected);
  const timeZone =
    calendars.find((c) => c.primary)?.timeZone ??
    calendars[0]?.timeZone ??
    "UTC";

  const todayKey = dayKey(new Date(), timeZone);
  const first = startKey ?? todayKey;
  const dayKeys = Array.from({ length: days }, (_, i) => addDays(first, i));
  const endKey = addDays(first, days);

  // Day boundaries depend on the time zone, so over-fetch by 14 hours (the
  // largest UTC offset) on each side and filter by local day below.
  const pad = 14 * 60 * 60 * 1000;
  const params = new URLSearchParams({
    timeMin: new Date(new Date(`${first}T00:00:00Z`).getTime() - pad).toISOString(),
    timeMax: new Date(new Date(`${endKey}T00:00:00Z`).getTime() + pad).toISOString(),
    // Expands recurring events into individual occurrences.
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const perCalendar = await Promise.all(
    calendars.map(async (cal) => {
      const data = await googleFetch<{ items?: GoogleEvent[] }>(
        "Google Calendar",
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
        accessToken
      );
      return (data.items ?? [])
        .filter((e) => e.status !== "cancelled")
        .map((e) => ({ cal, e }));
    })
  );

  // An invite can show up on two of your calendars; keep the first copy.
  const seen = new Set<string>();
  const legend = new Map<string, string>();
  const sortable: { event: CalendarEvent; day: string; time: number }[] = [];
  for (const entries of perCalendar) {
    for (const { cal, e } of entries) {
      const start = (e.start.dateTime ?? e.start.date)!;
      const end = (e.end.dateTime ?? e.end.date)!;
      const allDay = !e.start.dateTime;
      const startDay = allDay ? start : dayKey(new Date(start), timeZone);
      const endDay = allDay ? end : dayKey(new Date(end), timeZone);
      // Keep anything that overlaps the range in local days.
      if (startDay >= endKey || (allDay ? endDay <= first : endDay < first)) {
        continue;
      }

      const dedupeKey = `${e.iCalUID}|${start}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const calendarName = cal.summaryOverride ?? cal.summary;
      legend.set(calendarName, cal.backgroundColor);
      sortable.push({
        event: {
          id: `${cal.id}:${e.id}`,
          title: e.summary ?? "(No title)",
          htmlLink: e.htmlLink,
          location: e.location,
          allDay,
          start,
          end,
          calendarName,
          color: cal.backgroundColor,
        },
        day: startDay,
        time: allDay ? 0 : new Date(start).getTime(),
      });
    }
  }

  sortable.sort((a, b) =>
    a.day !== b.day ? a.day.localeCompare(b.day) : a.time - b.time
  );

  return {
    timeZone,
    todayKey,
    startKey: first,
    dayKeys,
    calendars: [...legend].map(([name, color]) => ({ name, color })),
    events: sortable.map((s) => s.event),
  };
}

// Adds an event to the user's primary calendar and returns its id. Used when
// the user accepts an AI suggestion — suggestions themselves never touch
// Google.
export async function createCalendarEvent(
  accessToken: string,
  event: { title: string; start: string; end: string; description?: string }
): Promise<{ id: string; htmlLink?: string }> {
  return googleFetch(
    "Google Calendar",
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    accessToken,
    {
      method: "POST",
      body: {
        summary: event.title,
        description: event.description,
        start: { dateTime: event.start },
        end: { dateTime: event.end },
      },
    }
  );
}
