import { GoogleReauthRequiredError } from "./tokens";

export type CalendarEvent = {
  id: string;
  title: string;
  htmlLink?: string;
  location?: string;
  // All-day events only have a date (YYYY-MM-DD); timed events have a
  // full ISO dateTime.
  allDay: boolean;
  start: string;
  end: string;
};

export type UpcomingEvents = {
  // The calendar's own time zone — the server runs in UTC on Vercel, so
  // grouping and formatting have to use this instead of the server's.
  timeZone: string;
  events: CalendarEvent[];
};

type GoogleEvent = {
  id: string;
  summary?: string;
  htmlLink?: string;
  location?: string;
  status?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
};

// Fetches events on the primary calendar from now through `days` days out.
export async function listUpcomingEvents(
  accessToken: string,
  days = 14
): Promise<UpcomingEvents> {
  const now = new Date();
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
    // Expands recurring events into individual occurrences.
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (res.status === 401) {
    throw new GoogleReauthRequiredError(
      "Google Calendar rejected the access token."
    );
  }
  if (!res.ok) {
    // 403s are usually "Calendar API not enabled" or a missing scope —
    // Google's message says which, so pass it through.
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Google Calendar request failed (${res.status}): ${body.error?.message ?? "unknown error"}`
    );
  }

  const data: { timeZone: string; items?: GoogleEvent[] } = await res.json();

  return {
    timeZone: data.timeZone,
    events: (data.items ?? [])
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({
        id: e.id,
        title: e.summary ?? "(No title)",
        htmlLink: e.htmlLink,
        location: e.location,
        allDay: !e.start.dateTime,
        start: (e.start.dateTime ?? e.start.date)!,
        end: (e.end.dateTime ?? e.end.date)!,
      })),
  };
}
