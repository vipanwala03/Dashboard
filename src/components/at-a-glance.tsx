import type { UpcomingEvents } from "@/lib/google/calendar";
import type { Task } from "@/lib/google/tasks";
import { dayKey, formatDayKey } from "@/lib/dates";

function Tile({
  label,
  value,
  detail,
  detailTone = "muted",
}: {
  label: string;
  value: string;
  detail?: string;
  detailTone?: "muted" | "critical";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="truncate text-2xl font-semibold text-black dark:text-zinc-50">
        {value}
      </p>
      {detail && (
        <p
          className={`truncate text-sm ${
            detailTone === "critical"
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-500"
          }`}
        >
          {detail}
        </p>
      )}
    </div>
  );
}

function flatten(tasks: Task[]): Task[] {
  return tasks.flatMap((t) => [t, ...flatten(t.subtasks)]);
}

// A row of three headline numbers for the top of the dashboard: what's
// next, what's due, and how busy today is. A section that failed to load
// passes `null` and its tile shows a dash.
export function AtAGlance({
  calendar,
  tasks,
  timeZone,
}: {
  calendar: UpcomingEvents | null;
  tasks: Task[] | null;
  timeZone: string;
}) {
  const now = new Date();
  const todayKey = dayKey(now, timeZone);
  const tomorrowKey = dayKey(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    timeZone
  );
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });

  // Next up: the first timed event that hasn't ended (all-day events are
  // context, not something you need to be somewhere for).
  let nextUp = { value: "—", detail: "Calendar unavailable" };
  let todayCount = "—";
  if (calendar) {
    const next = calendar.events.find(
      (e) => !e.allDay && new Date(e.end) > now
    );
    if (!next) {
      nextUp = { value: "Free", detail: "Nothing else this week" };
    } else {
      const start = new Date(next.start);
      const key = dayKey(start, timeZone);
      const when =
        start <= now
          ? "Now"
          : key === todayKey
            ? timeFmt.format(start)
            : `${key === tomorrowKey ? "Tomorrow" : formatDayKey(key, "short")}, ${timeFmt.format(start)}`;
      nextUp = { value: when, detail: next.title };
    }
    const count = calendar.events.filter(
      (e) => (e.allDay ? e.start : dayKey(new Date(e.start), timeZone)) === todayKey
    ).length;
    todayCount = String(count);
  }

  let due = { value: "—", detail: "Tasks unavailable", overdue: false };
  if (tasks) {
    const all = flatten(tasks);
    const dueToday = all.filter((t) => t.due === todayKey).length;
    const overdue = all.filter((t) => t.due && t.due < todayKey).length;
    due = {
      value: String(dueToday),
      detail: overdue > 0 ? `${overdue} overdue` : "Nothing overdue",
      overdue: overdue > 0,
    };
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Tile label="Next up" value={nextUp.value} detail={nextUp.detail} />
      <Tile
        label="Due today"
        value={due.value}
        detail={due.detail}
        detailTone={due.overdue ? "critical" : "muted"}
      />
      <Tile
        label="Events today"
        value={todayCount}
        detail={calendar ? formatDayKey(todayKey) : undefined}
      />
    </div>
  );
}
