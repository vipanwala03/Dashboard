import { googleFetch } from "./fetch";
import { dayKey } from "@/lib/dates";

export type CalendarEvent = {
  // Prefixed with the calendar id — event ids are only unique per calendar.
  id: string;
  title: string;
  htmlLink?: string;
  location?: string;
  // All-day events only have a date (YYYY-MM-DD); timed events have a
  // full ISO dateTime.
  allDay: boolean;
  start: string;
  end: string;
  calendarName: string;
  // The calendar's color in Google Calendar, e.g. "#9fe1e7".
  color: string;
};

export type UpcomingEvents = {
  // The primary calendar's time zone — the server runs in UTC on Vercel, so
  // grouping and formatting have to use this instead of the server's.
  timeZone: string;
  // More than one calendar contributed events (so it's worth naming them).
  multipleCalendars: boolean;
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
// (class schedules often live on their own calendar), from now through
// `days` days out, merged into one list sorted by start.
export async function listUpcomingEvents(
  accessToken: string,
  days = 7
): Promise<UpcomingEvents> {
  const list = await googleFetch<{ items?: GoogleCalendarListEntry[] }>(
    "Google Calendar",
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    accessToken
  );
  const calendars = (list.items ?? []).filter((c) => c.primary || c.selected);
  const timeZone =
    calendars.find((c) => c.primary)?.timeZone ?? calendars[0]?.timeZone ?? "UTC";

  const now = new Date();
  const params = new URLSearchParams({
    // Filters on end time, so events already in progress are included.
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
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
  const sortable: { event: CalendarEvent; day: string; time: number }[] = [];
  let contributingCalendars = 0;
  for (const entries of perCalendar) {
    if (entries.length > 0) contributingCalendars++;
    for (const { cal, e } of entries) {
      const start = (e.start.dateTime ?? e.start.date)!;
      const dedupeKey = `${e.iCalUID}|${start}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const allDay = !e.start.dateTime;
      const event: CalendarEvent = {
        id: `${cal.id}:${e.id}`,
        title: e.summary ?? "(No title)",
        htmlLink: e.htmlLink,
        location: e.location,
        allDay,
        start,
        end: (e.end.dateTime ?? e.end.date)!,
        calendarName: cal.summaryOverride ?? cal.summary,
        color: cal.backgroundColor,
      };
      sortable.push({
        event,
        day: allDay ? start : dayKey(new Date(start), timeZone),
        time: allDay ? 0 : new Date(start).getTime(),
      });
    }
  }

  // Day first, all-day events at the top of each day, then by start time.
  sortable.sort((a, b) =>
    a.day !== b.day ? a.day.localeCompare(b.day) : a.time - b.time
  );

  return {
    timeZone,
    multipleCalendars: contributingCalendars > 1,
    events: sortable.map((s) => s.event),
  };
}
