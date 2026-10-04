import type { CalendarEvent, UpcomingEvents } from "@/lib/google/calendar";

// YYYY-MM-DD for an instant, as seen in the calendar's time zone.
function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function eventDayKey(event: CalendarEvent, timeZone: string) {
  return event.allDay ? event.start : dayKey(new Date(event.start), timeZone);
}

function dayLabel(key: string, todayKey: string, tomorrowKey: string) {
  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";
  // Noon UTC keeps the date stable no matter how it's formatted.
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${key}T12:00:00Z`));
}

function timeRange(event: CalendarEvent, timeZone: string) {
  if (event.allDay) return "All day";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${fmt.format(new Date(event.start))} – ${fmt.format(new Date(event.end))}`;
}

export function UpcomingEventsList({ timeZone, events }: UpcomingEvents) {
  if (events.length === 0) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        Nothing on your calendar for the next two weeks.
      </p>
    );
  }

  const now = new Date();
  const todayKey = dayKey(now, timeZone);
  const tomorrowKey = dayKey(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    timeZone
  );

  // Events arrive sorted by start time, so insertion order is day order.
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = eventDayKey(event, timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }

  return (
    <div className="flex flex-col gap-6">
      {[...byDay].map(([key, dayEvents]) => (
        <section key={key}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {dayLabel(key, todayKey, tomorrowKey)}
          </h3>
          <ul className="flex flex-col gap-2">
            {dayEvents.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-black hover:underline dark:text-zinc-50"
                  >
                    {event.title}
                  </a>
                  <span className="shrink-0 text-sm text-zinc-500">
                    {timeRange(event, timeZone)}
                  </span>
                </div>
                {event.location && (
                  <p className="mt-1 truncate text-sm text-zinc-500">
                    {event.location}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
