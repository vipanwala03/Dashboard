import type { CalendarEvent, UpcomingEvents } from "@/lib/google/calendar";
import { dayKey, formatDayKey } from "@/lib/dates";

function eventDayKey(event: CalendarEvent, timeZone: string) {
  return event.allDay ? event.start : dayKey(new Date(event.start), timeZone);
}

function dayLabel(key: string, todayKey: string, tomorrowKey: string) {
  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";
  return formatDayKey(key);
}

export function timeRange(event: CalendarEvent, timeZone: string) {
  if (event.allDay) return "All day";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${fmt.format(new Date(event.start))} – ${fmt.format(new Date(event.end))}`;
}

export function UpcomingEventsList({
  timeZone,
  multipleCalendars,
  events,
}: UpcomingEvents) {
  if (events.length === 0) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        Nothing on your calendar this week.
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
    <div className="flex flex-col gap-5">
      {[...byDay].map(([key, dayEvents]) => (
        <section key={key}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {dayLabel(key, todayKey, tomorrowKey)}
          </h3>
          <ul className="flex flex-col gap-2">
            {dayEvents.map((event) => (
              <li
                key={event.id}
                // The calendar's own color, as a stripe — same cue Google
                // Calendar uses, with the name spelled out below when there's
                // more than one calendar so it never relies on color alone.
                style={{ borderLeftColor: event.color }}
                className="rounded-lg border border-l-4 border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <a
                  href={event.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-black hover:underline dark:text-zinc-50"
                >
                  {event.title}
                </a>
                <p className="truncate text-sm text-zinc-500">
                  {[
                    timeRange(event, timeZone),
                    event.location,
                    multipleCalendars && event.calendarName,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
