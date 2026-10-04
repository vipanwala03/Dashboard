"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addDays, minutesInZone } from "@/lib/dates";
import {
  rangeTitle,
  type AllDayItem,
  type PositionedEvent,
  type WeekDay,
  type WeekLayout,
} from "@/lib/week-layout";

// Pixels per hour in the time grid.
const HOUR_HEIGHT = 48;
// The grid shows this many hours at once; the rest of the day is a scroll
// away.
const WINDOW_HOURS = 12;

// First hour of the 12-hour window: an hour before now when looking at
// today, kept inside the hours that have events so empty early-morning or
// late-night time stays out of view (unless the busy span is under 12
// hours, in which case the window just covers it).
function windowStartHour(
  busyStart: number,
  busyEnd: number,
  nowHour: number | null
) {
  const latest = Math.max(busyStart, busyEnd - WINDOW_HOURS);
  const earliest = Math.min(busyStart, latest);
  const wanted = nowHour === null ? busyStart : nowHour - 1;
  const start = Math.min(Math.max(wanted, earliest), latest);
  return Math.min(Math.max(start, 0), 24 - WINDOW_HOURS);
}

type View = "day" | "3day" | "week";
const VIEW_DAYS: Record<View, number> = { day: 1, "3day": 3, week: 7 };
const VIEW_LABELS: Record<View, string> = {
  day: "Day",
  "3day": "3 days",
  week: "Week",
};

// `null` = automatic: 3 days on phones, a week from the md breakpoint up —
// done with CSS so the first render already matches the screen.
type ViewChoice = View | null;

function weekdayParts(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
    }).format(d),
    date: d.getUTCDate(),
  };
}

function hourLabel(h: number) {
  const suffix = h < 12 || h === 24 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

// Display classes for a piece of UI that belongs to one view: shown when
// that view is chosen, or — in automatic mode — at the screen size where
// that view applies.
function shownFor(choice: ViewChoice, view: View, display: "flex" | "inline") {
  if (choice !== null) return choice === view ? display : "hidden";
  // Spelled out in full so Tailwind sees every class name.
  if (view === "3day") return display === "flex" ? "flex md:hidden" : "inline md:hidden";
  if (view === "week") return display === "flex" ? "hidden md:flex" : "hidden md:inline";
  return "hidden";
}

function ViewToggle({
  choice,
  setChoice,
}: {
  choice: ViewChoice;
  setChoice: (v: View) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Calendar view"
      className="flex rounded-[10px] border border-field bg-inset p-[3px]"
    >
      {(Object.keys(VIEW_DAYS) as View[]).map((v) => {
        // In automatic mode the active option depends on screen size.
        const active =
          choice === null
            ? v === "3day"
              ? "max-md:bg-selected max-md:text-ink"
              : v === "week"
                ? "md:bg-selected md:text-ink"
                : ""
            : choice === v
              ? "bg-selected text-ink"
              : "";
        return (
          <button
            key={v}
            type="button"
            onClick={() => setChoice(v)}
            aria-pressed={choice === v}
            className={`h-8 rounded-[7px] px-3 text-[13px] text-ink-muted transition-colors hover:text-ink ${active}`}
          >
            {VIEW_LABELS[v]}
          </button>
        );
      })}
    </div>
  );
}

function AllDayChip({ item }: { item: AllDayItem }) {
  const isTask = item.kind !== "event";
  const content = (
    <>
      {isTask ? (
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] ${
            item.kind === "overdue" ? "border-warn" : "border-blue"
          }`}
        />
      ) : (
        <span
          className="h-2 w-2 shrink-0 rounded-[2px]"
          style={{ background: item.color }}
        />
      )}
      <span className="truncate">
        {item.kind === "overdue" && <span className="sr-only">Overdue: </span>}
        {item.title}
      </span>
    </>
  );
  const className = `flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-[3px] text-xs ${
    isTask
      ? `bg-raised ${item.kind === "overdue" ? "text-warn-ink" : "text-ink-soft"}`
      : "text-ink"
  }`;
  const style = isTask
    ? undefined
    : { background: `color-mix(in srgb, ${item.color} 22%, transparent)` };
  return item.href ? (
    <a href={item.href} target="_blank" rel="noreferrer" className={`${className} hover:brightness-125`} style={style} title={item.title}>
      {content}
    </a>
  ) : (
    <div className={className} style={style} title={item.title}>
      {content}
    </div>
  );
}

function EventBlock({ event }: { event: PositionedEvent }) {
  const duration = Math.max(event.endMin - event.startMin, 25);
  const compact = duration < 50;
  const top = (event.startMin / 60) * HOUR_HEIGHT;
  const height = (duration / 60) * HOUR_HEIGHT;
  const width = 100 / event.cols;
  return (
    <a
      href={event.href}
      target="_blank"
      rel="noreferrer"
      title={`${event.title}\n${event.timeLabel}${event.location ? `\n${event.location}` : ""}\n${event.calendarName}`}
      className="absolute flex flex-col gap-0.5 overflow-hidden rounded-lg border px-2 py-1 text-ink transition-[filter] hover:z-10 hover:brightness-125"
      style={{
        top: top + 1,
        height: height - 3,
        left: `calc(${event.col * width}% + 3px)`,
        width: `calc(${width}% - 6px)`,
        background: `color-mix(in srgb, ${event.color} 22%, #0d1422)`,
        borderColor: `color-mix(in srgb, ${event.color} 60%, transparent)`,
      }}
    >
      {compact ? (
        <span className="truncate text-xs leading-tight font-semibold">
          {event.title}{" "}
          <span className="font-mono font-normal opacity-80">
            {event.timeLabel.split(" – ")[0]}
          </span>
        </span>
      ) : (
        <>
          <span className="line-clamp-2 text-[13px] leading-tight font-semibold">
            {event.title}
          </span>
          <span className="truncate font-mono text-[11px] opacity-80">
            {event.timeLabel}
          </span>
          {event.location && (
            <span className="truncate text-[11px] opacity-70">
              {event.location}
            </span>
          )}
        </>
      )}
    </a>
  );
}

function NavLinks({
  startKey,
  todayKey,
  step,
  className,
}: {
  startKey: string;
  todayKey: string;
  step: number;
  className: string;
}) {
  const href = (key: string) =>
    key === todayKey ? "/dashboard" : `/dashboard?start=${key}`;
  const arrow =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-field text-ink-dim transition-colors hover:bg-raised hover:text-ink";
  return (
    <div className={`items-center gap-1 ${className}`}>
      <Link href={href(addDays(startKey, -step))} aria-label="Earlier" className={arrow} scroll={false}>
        ‹
      </Link>
      <Link href={href(addDays(startKey, step))} aria-label="Later" className={arrow} scroll={false}>
        ›
      </Link>
      {startKey !== todayKey && (
        <Link
          href="/dashboard"
          scroll={false}
          className="ml-1 flex h-8 items-center rounded-lg border border-field px-3 text-[13px] text-ink-dim transition-colors hover:bg-raised hover:text-ink"
        >
          Today
        </Link>
      )}
    </div>
  );
}

export function WeekView({
  layout,
  startKey,
  todayKey,
  timeZone,
  calendars,
  initialNowMin,
}: {
  layout: WeekLayout;
  startKey: string;
  todayKey: string;
  timeZone: string;
  calendars: { name: string; color: string }[];
  // Server's "now", so the first client render matches it.
  initialNowMin: number;
}) {
  const [choice, setChoice] = useState<ViewChoice>(null);
  const [nowMin, setNowMin] = useState(initialNowMin);

  // Keep the "now" line moving.
  useEffect(() => {
    const id = setInterval(
      () => setNowMin(minutesInZone(new Date(), timeZone)),
      60 * 1000
    );
    return () => clearInterval(id);
  }, [timeZone]);

  const gridHeight = 24 * HOUR_HEIGHT;
  const hours = Array.from({ length: 23 }, (_, i) => i + 1);

  // Frame the 12-hour window. Recomputed as the hour changes, so the view
  // follows the clock — but only moves when the window itself shifts, not
  // every minute, so it doesn't fight manual scrolling.
  const showsToday = layout.days.some((d) => d.isToday);
  const startHour = windowStartHour(
    layout.busyStartHour,
    layout.busyEndHour,
    showsToday ? Math.floor(nowMin / 60) : null
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = startHour * HOUR_HEIGHT;
    }
  }, [startHour, startKey]);

  const count = choice === null ? 7 : VIEW_DAYS[choice];
  const days = layout.days.slice(0, count);
  // In automatic mode the 4th–7th days only show from md up.
  const dayClass = (i: number) => (choice === null && i >= 3 ? "max-md:hidden" : "");
  const gridClass =
    choice === null
      ? "grid-cols-[44px_repeat(3,minmax(0,1fr))] md:grid-cols-[60px_repeat(7,minmax(0,1fr))]"
      : "";
  const gridStyle =
    choice === null
      ? undefined
      : { gridTemplateColumns: `52px repeat(${count}, minmax(0, 1fr))` };

  return (
    <section className="flex min-w-0 flex-col gap-3.5 rounded-2xl border border-line bg-panel px-3 py-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 sm:px-0">
        <div className="flex items-center gap-3">
          <h2 className="text-[17px] font-semibold text-ink-strong">
            {(["day", "3day", "week"] as View[]).map((v) => (
              <span key={v} className={shownFor(choice, v, "inline")}>
                {rangeTitle(startKey, VIEW_DAYS[v])}
              </span>
            ))}
          </h2>
          {(["day", "3day", "week"] as View[]).map((v) => (
            <NavLinks
              key={v}
              startKey={startKey}
              todayKey={todayKey}
              step={VIEW_DAYS[v]}
              className={shownFor(choice, v, "flex")}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {calendars.length > 1 && (
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
              {calendars.map((c) => (
                <li key={c.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
                  {c.name}
                </li>
              ))}
            </ul>
          )}
          <ViewToggle choice={choice} setChoice={setChoice} />
        </div>
      </div>

      <div>
        {/* Day headers */}
        <div className={`grid border-b border-line ${gridClass}`} style={gridStyle}>
          <div />
          {days.map((d: WeekDay, i) => {
            const { weekday, date } = weekdayParts(d.key);
            return (
              <div key={d.key} className={`flex flex-col items-center gap-1 px-1 pb-2.5 ${dayClass(i)}`}>
                <span className={`text-[11px] tracking-wider uppercase ${d.isToday ? "text-accent" : "text-ink-muted"}`}>
                  {weekday}
                </span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold md:h-[34px] md:w-[34px] md:text-lg ${
                    d.isToday ? "bg-accent text-accent-ink" : "text-ink"
                  }`}
                >
                  {date}
                </span>
              </div>
            );
          })}
        </div>

        {/* All-day row: all-day events and tasks due that day */}
        <div className={`grid border-b border-line ${gridClass}`} style={gridStyle}>
          <div className="pt-2 pr-1.5 text-right text-[10px] text-ink-muted md:pr-2 md:text-[11px]">
            All day
          </div>
          {days.map((d, i) => (
            <div
              key={d.key}
              className={`flex min-h-9 min-w-0 flex-col gap-1 border-l border-line-soft p-1 ${dayClass(i)}`}
            >
              {d.allDay.map((item) => (
                <AllDayChip key={item.id} item={item} />
              ))}
            </div>
          ))}
        </div>

        {/* Time grid: the full day, scrolling inside its own box */}
        <div
          ref={scrollRef}
          // Exactly WINDOW_HOURS tall (12 × 48px + the 8px top padding).
          className="h-[584px] max-h-[75vh] overflow-y-auto overscroll-contain"
        >
          <div className={`grid pt-2 ${gridClass}`} style={gridStyle}>
            <div className="relative" style={{ height: gridHeight }}>
              {hours.map((h) => (
                <span
                  key={h}
                  className="absolute right-1.5 font-mono text-[10px] whitespace-nowrap text-ink-muted md:right-2.5 md:text-[11px]"
                  style={{ top: h * HOUR_HEIGHT - 7 }}
                >
                  {hourLabel(h)}
                </span>
              ))}
            </div>
            {days.map((d, i) => (
              <div
                key={d.key}
                className={`relative border-l border-line-soft ${d.isToday ? "bg-accent/[0.03]" : ""} ${dayClass(i)}`}
                style={{
                  height: gridHeight,
                  backgroundImage: `repeating-linear-gradient(180deg, var(--color-line-soft) 0, var(--color-line-soft) 1px, transparent 1px, transparent ${HOUR_HEIGHT}px)`,
                }}
              >
                {d.timed.map((e) => (
                  <EventBlock key={e.id} event={e} />
                ))}
                {d.isToday && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 -left-1 z-20 flex items-center"
                    style={{ top: (nowMin / 60) * HOUR_HEIGHT - 4 }}
                  >
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    <span className="h-0.5 flex-1 bg-accent" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
