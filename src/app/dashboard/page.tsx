import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { NoteComposer } from "@/components/note-composer";
import { NoteList } from "@/components/note-list";
import { TaskComposer } from "@/components/task-composer";
import { TaskList } from "@/components/task-list";
import { AiPlannerPanel } from "@/components/ai-planner-panel";
import { GlanceLine } from "@/components/glance-line";
import { WeekView } from "@/components/week-view";
import { Panel } from "@/components/ui";
import {
  getGoogleAccessToken,
  GoogleReauthRequiredError,
} from "@/lib/google/tokens";
import { listCalendarRange } from "@/lib/google/calendar";
import { listOpenTasks } from "@/lib/google/tasks";
import { listRecentNotes } from "@/lib/notes";
import { listPendingSuggestions } from "@/lib/suggestions";
import { getAiUsage } from "@/lib/ai/usage";
import { dayKey, formatDayKey, minutesInZone } from "@/lib/dates";
import { buildWeekLayout } from "@/lib/week-layout";

type Result<T> =
  | { status: "ok"; data: T }
  | { status: "reauth" }
  | { status: "error"; message: string };

// Turns a failed fetch into something the page can render, so one
// broken section (say, Tasks API disabled) doesn't take down the others.
async function settle<T>(
  label: string,
  work: () => Promise<T>
): Promise<Result<T>> {
  try {
    return { status: "ok", data: await work() };
  } catch (err) {
    console.error(`${label} failed:`, err);
    if (err instanceof GoogleReauthRequiredError) {
      return { status: "reauth" };
    }
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function SectionProblem({
  result,
  what,
}: {
  result: Exclude<Result<unknown>, { status: "ok" }>;
  what: string;
}) {
  if (result.status === "reauth") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-ink-muted">
          Google access needs to be reconnected.
        </p>
        <SignInButton label="Reconnect Google" />
      </div>
    );
  }
  return (
    <p className="text-sm text-danger-ink">
      Couldn&apos;t load your {what}: {result.message}
    </p>
  );
}

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // ?start=YYYY-MM-DD moves the calendar; anything else means "today".
  const { start } = await searchParams;
  const startKey =
    typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start)
      ? start
      : undefined;

  // Fetch (and if needed refresh) the token once, then hit both APIs in
  // parallel. A token failure fails both sections the same way.
  const token = settle("Google token", () =>
    getGoogleAccessToken(supabase, user.id)
  );
  const [calendar, tasks, notes, suggestions, aiUsage] = await Promise.all([
    token.then((t) =>
      t.status === "ok"
        ? settle("Calendar fetch", () =>
            listCalendarRange(t.data, { startKey })
          )
        : t
    ),
    token.then((t) =>
      t.status === "ok" ? settle("Tasks fetch", () => listOpenTasks(t.data)) : t
    ),
    settle("Notes fetch", () => listRecentNotes(supabase)),
    settle("Suggestions fetch", () => listPendingSuggestions(supabase)),
    settle("AI usage fetch", () => getAiUsage(supabase)),
  ]);

  // Tasks only store a date, and notes and the greeting need a zone to show
  // times in; all follow the calendar's time zone when we have it.
  const timeZone = calendar.status === "ok" ? calendar.data.timeZone : "UTC";
  const now = new Date();
  const todayKey = dayKey(now, timeZone);

  const hour = Math.floor(minutesInZone(now, timeZone) / 60);
  const greeting =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 17
        ? "Good afternoon"
        : "Good evening";
  // Google sign-in puts the account's display name here.
  const firstName = (
    user.user_metadata?.full_name as string | undefined
  )?.split(" ")[0];

  return (
    <div className="flex flex-1 flex-col items-center px-4 pt-7 pb-10 sm:px-8 sm:pt-10 sm:pb-16">
      <div className="flex w-full max-w-[1376px] flex-col gap-6 sm:gap-7">
        <header className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-4 sm:hidden">
            <span className="text-sm text-ink-muted">
              {formatDayKey(todayKey)}
            </span>
            <SignOutButton />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-ink-strong sm:text-[46px]">
              {greeting}
              {firstName && `, ${firstName}`}
            </h1>
            <div className="flex items-center gap-3.5 text-sm text-ink-muted max-sm:hidden">
              <span>{user.email}</span>
              <SignOutButton />
            </div>
          </div>
          <GlanceLine
            calendar={
              calendar.status === "ok" && calendar.data.startKey === todayKey
                ? calendar.data
                : null
            }
            tasks={tasks.status === "ok" ? tasks.data : null}
            todayKey={todayKey}
          />
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Panel
            title="Notes"
            aside={
              notes.status === "ok" && notes.data.length > 0 ? (
                <span className="text-[13px] text-ink-muted">
                  {notes.data.length} recent
                </span>
              ) : undefined
            }
          >
            <NoteComposer />
            {notes.status === "ok" ? (
              <NoteList notes={notes.data} timeZone={timeZone} />
            ) : (
              <SectionProblem result={notes} what="notes" />
            )}
          </Panel>

          <Panel
            title="To-do"
            aside={
              tasks.status === "ok" && tasks.data.length > 0 ? (
                <span className="text-[13px] text-ink-muted">
                  {tasks.data.length} open
                </span>
              ) : undefined
            }
          >
            <TaskComposer />
            {tasks.status === "ok" ? (
              <TaskList tasks={tasks.data} todayKey={todayKey} />
            ) : (
              <SectionProblem result={tasks} what="tasks" />
            )}
          </Panel>

          <AiPlannerPanel
            suggestions={suggestions.status === "ok" ? suggestions.data : []}
            usage={aiUsage.status === "ok" ? aiUsage.data : null}
            timeZone={timeZone}
          />
        </div>

        {calendar.status === "ok" ? (
          <WeekView
            layout={buildWeekLayout(
              calendar.data,
              tasks.status === "ok" ? tasks.data : null,
              suggestions.status === "ok" ? suggestions.data : []
            )}
            startKey={calendar.data.startKey}
            todayKey={todayKey}
            timeZone={timeZone}
            calendars={calendar.data.calendars}
            initialNowMin={minutesInZone(now, timeZone)}
          />
        ) : (
          <Panel title="Calendar">
            <SectionProblem result={calendar} what="calendar" />
          </Panel>
        )}
      </div>
    </div>
  );
}
