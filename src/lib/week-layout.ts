import type { CalendarRange } from "@/lib/google/calendar";
import type { Task } from "@/lib/google/tasks";
import { addDays, dayKey, minutesInZone } from "@/lib/dates";

export type AllDayItem = {
  id: string;
  title: string;
  // "event" = an all-day calendar event; "task" = a task due that day;
  // "overdue" = an overdue task (shown on today).
  kind: "event" | "task" | "overdue";
  color?: string;
  href?: string;
};

export type PositionedEvent = {
  id: string;
  title: string;
  timeLabel: string;
  location?: string;
  calendarName: string;
  color: string;
  href?: string;
  // Minutes since local midnight, clipped to this day.
  startMin: number;
  endMin: number;
  // Side-by-side placement among overlapping events: column `col` of `cols`.
  col: number;
  cols: number;
};

export type WeekDay = {
  key: string;
  isToday: boolean;
  allDay: AllDayItem[];
  timed: PositionedEvent[];
};

export type WeekLayout = {
  days: WeekDay[];
  // The hours that actually have events across the range (whole hours,
  // 0–24) — the time grid frames its 12-hour window inside these.
  busyStartHour: number;
  busyEndHour: number;
};

// Used when the range has no timed events at all.
const DEFAULT_BUSY = { start: 8, end: 20 };
// Short events still get a readable block.
const MIN_DURATION = 25;

// Assigns columns so overlapping events sit side by side, like Google
// Calendar: events that transitively overlap form a cluster, and every
// event in a cluster shares its column count.
function placeOverlaps(events: Omit<PositionedEvent, "col" | "cols">[]) {
  const sorted = [...events].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin
  );
  const placed: PositionedEvent[] = [];
  let cluster: PositionedEvent[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;

  const finish = () => {
    for (const e of cluster) e.cols = columnEnds.length;
    placed.push(...cluster);
    cluster = [];
    columnEnds = [];
  };

  for (const e of sorted) {
    const end = Math.max(e.endMin, e.startMin + MIN_DURATION);
    if (e.startMin >= clusterEnd) finish();
    let col = columnEnds.findIndex((colEnd) => colEnd <= e.startMin);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[col] = end;
    }
    cluster.push({ ...e, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  finish();
  return placed;
}

function flatten(tasks: Task[]): Task[] {
  return tasks.flatMap((t) => [t, ...flatten(t.subtasks)]);
}

// Lays out a calendar range (plus tasks with due dates) as day columns for
// the week view: all-day items per day and timed events positioned by
// minute in the calendar's time zone.
export function buildWeekLayout(
  range: CalendarRange,
  tasks: Task[] | null
): WeekLayout {
  const { timeZone, todayKey } = range;
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  const allTasks = tasks ? flatten(tasks) : [];

  let busyStart = Infinity;
  let busyEnd = -Infinity;

  const days = range.dayKeys.map((key): WeekDay => {
    const allDay: AllDayItem[] = [];
    const timed: Omit<PositionedEvent, "col" | "cols">[] = [];

    for (const e of range.events) {
      if (e.allDay) {
        // All-day end dates are exclusive.
        if (e.start <= key && key < e.end) {
          allDay.push({
            id: `${e.id}:${key}`,
            title: e.title,
            kind: "event",
            color: e.color,
            href: e.htmlLink,
          });
        }
        continue;
      }
      const start = new Date(e.start);
      const end = new Date(e.end);
      const startDay = dayKey(start, timeZone);
      const endDay = dayKey(end, timeZone);
      if (key < startDay || key > endDay) continue;
      // An event ending exactly at midnight doesn't spill into the next day.
      const endMin = key < endDay ? 24 * 60 : minutesInZone(end, timeZone);
      if (key === endDay && key !== startDay && endMin === 0) continue;
      const startMin = key > startDay ? 0 : minutesInZone(start, timeZone);

      // Only real start/end times count — a late event clipped at midnight
      // shouldn't make 12 AM look busy.
      if (key === startDay) {
        busyStart = Math.min(busyStart, Math.floor(startMin / 60));
      }
      if (key === endDay) {
        busyEnd = Math.max(busyEnd, Math.ceil(endMin / 60));
      }
      timed.push({
        id: `${e.id}:${key}`,
        title: e.title,
        timeLabel: `${timeFmt.format(start)} – ${timeFmt.format(end)}`,
        location: e.location,
        calendarName: e.calendarName,
        color: e.color,
        href: e.htmlLink,
        startMin,
        endMin,
      });
    }

    for (const t of allTasks) {
      if (t.due === key) {
        allDay.push({ id: `task:${t.id}`, title: t.title, kind: "task", href: t.webViewLink });
      } else if (key === todayKey && t.due && t.due < todayKey) {
        allDay.push({ id: `task:${t.id}`, title: t.title, kind: "overdue", href: t.webViewLink });
      }
    }

    return { key, isToday: key === todayKey, allDay, timed: placeOverlaps(timed) };
  });

  return busyStart === Infinity
    ? { days, busyStartHour: DEFAULT_BUSY.start, busyEndHour: DEFAULT_BUSY.end }
    : {
        days,
        busyStartHour: busyStart,
        busyEndHour: Math.max(busyEnd, busyStart + 1),
      };
}

// Keys for a range title like "Oct 3 – 9" or "Sep 29 – Oct 5".
export function rangeTitle(firstKey: string, count: number) {
  const lastKey = addDays(firstKey, count - 1);
  const md = (key: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    }).format(new Date(`${key}T12:00:00Z`));
  if (count === 1) return md(firstKey);
  const sameMonth = firstKey.slice(0, 7) === lastKey.slice(0, 7);
  return `${md(firstKey)} – ${sameMonth ? Number(lastKey.slice(8)) : md(lastKey)}`;
}
