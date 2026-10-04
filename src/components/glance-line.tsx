import type { CalendarRange } from "@/lib/google/calendar";
import type { Task } from "@/lib/google/tasks";
import { addDays, dayKey, formatDayKey } from "@/lib/dates";

function flatten(tasks: Task[]): Task[] {
  return tasks.flatMap((t) => [t, ...flatten(t.subtasks)]);
}

function Item({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

// One line under the greeting: what's next, what's due, what's overdue.
// `calendar` is null when it failed to load or isn't showing this week
// (then "next up" can't be worked out from it).
export function GlanceLine({
  calendar,
  tasks,
  todayKey,
}: {
  calendar: CalendarRange | null;
  tasks: Task[] | null;
  todayKey: string;
}) {
  let nextUp: string | null = null;
  if (calendar) {
    const now = new Date();
    const next = calendar.events.find(
      (e) => !e.allDay && new Date(e.end) > now
    );
    if (!next) {
      nextUp = "Nothing else this week";
    } else {
      const start = new Date(next.start);
      const key = dayKey(start, calendar.timeZone);
      const time = new Intl.DateTimeFormat("en-US", {
        timeZone: calendar.timeZone,
        hour: "numeric",
        minute: "2-digit",
      }).format(start);
      const when =
        start <= now
          ? "now"
          : key === todayKey
            ? time
            : key === addDays(todayKey, 1)
              ? `tomorrow ${time}`
              : `${formatDayKey(key, "short").split(",")[0]} ${time}`;
      nextUp = `${next.title} · ${when}`;
    }
  }

  const all = tasks ? flatten(tasks) : [];
  const dueToday = all.filter((t) => t.due === todayKey).length;
  const overdue = all.filter((t) => t.due && t.due < todayKey).length;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[15px] text-ink-muted max-sm:text-sm">
      <span className="max-sm:hidden">{formatDayKey(todayKey)}</span>
      {nextUp && (
        <Item dot="bg-accent">
          Next up <span className="text-ink">{nextUp}</span>
        </Item>
      )}
      {tasks && (
        <Item dot="bg-blue">
          <span>
            <span className="text-ink">{dueToday}</span> due today
          </span>
        </Item>
      )}
      {overdue > 0 && (
        <Item dot="bg-warn">
          <span className="text-warn-ink">{overdue} overdue</span>
        </Item>
      )}
    </div>
  );
}
