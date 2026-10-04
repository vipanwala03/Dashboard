import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { UpcomingEventsList } from "@/components/upcoming-events";
import { TaskList } from "@/components/task-list";
import { NoteComposer } from "@/components/note-composer";
import { NoteList } from "@/components/note-list";
import { AtAGlance } from "@/components/at-a-glance";
import {
  getGoogleAccessToken,
  GoogleReauthRequiredError,
} from "@/lib/google/tokens";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { listOpenTasks } from "@/lib/google/tasks";
import { listRecentNotes } from "@/lib/notes";
import { dayKey, formatDayKey } from "@/lib/dates";

type Result<T> =
  | { status: "ok"; data: T }
  | { status: "reauth" }
  | { status: "error"; message: string };

// Turns a failed fetch into something the page can render, so one
// broken section (say, Tasks API disabled) doesn't take down the others.
async function settle<T>(label: string, work: () => Promise<T>): Promise<Result<T>> {
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
        <p className="text-zinc-600 dark:text-zinc-400">
          Google access needs to be reconnected.
        </p>
        <SignInButton label="Reconnect Google" />
      </div>
    );
  }
  return (
    <p className="text-red-600 dark:text-red-400">
      Couldn&apos;t load your {what}: {result.message}
    </p>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch (and if needed refresh) the token once, then hit both APIs in
  // parallel. A token failure fails both sections the same way.
  const token = settle("Google token", () =>
    getGoogleAccessToken(supabase, user.id)
  );
  const [calendar, tasks, notes] = await Promise.all([
    token.then((t) =>
      t.status === "ok"
        ? settle("Calendar fetch", () => listUpcomingEvents(t.data))
        : t
    ),
    token.then((t) =>
      t.status === "ok" ? settle("Tasks fetch", () => listOpenTasks(t.data)) : t
    ),
    settle("Notes fetch", () => listRecentNotes(supabase)),
  ]);

  // Tasks only store a date, and notes and the greeting need a zone to show
  // times in; all follow the calendar's time zone when we have it.
  const timeZone = calendar.status === "ok" ? calendar.data.timeZone : "UTC";

  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date())
  );
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
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-6 sm:p-10 dark:bg-black">
      <div className="flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div>
            <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
              {greeting}
              {firstName && `, ${firstName}`}
            </h1>
            <p className="text-zinc-500">
              {formatDayKey(dayKey(new Date(), timeZone))}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span className="hidden sm:inline">{user.email}</span>
            <SignOutButton />
          </div>
        </header>

        <AtAGlance
          calendar={calendar.status === "ok" ? calendar.data : null}
          tasks={tasks.status === "ok" ? tasks.data : null}
          timeZone={timeZone}
        />

        {/* What's next, what's due, what you jotted down — side by side on
            wide screens, stacked in that order on phones. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <section className="flex min-w-0 flex-col gap-4">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
              This week
            </h2>
            {calendar.status === "ok" ? (
              <UpcomingEventsList {...calendar.data} />
            ) : (
              <SectionProblem result={calendar} what="calendar" />
            )}
          </section>

          <section className="flex min-w-0 flex-col gap-4">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
              To-do
            </h2>
            {tasks.status === "ok" ? (
              <TaskList tasks={tasks.data} timeZone={timeZone} />
            ) : (
              <SectionProblem result={tasks} what="tasks" />
            )}
          </section>

          <section className="flex min-w-0 flex-col gap-4">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
              Notes
            </h2>
            <NoteComposer />
            {notes.status === "ok" ? (
              <NoteList notes={notes.data} timeZone={timeZone} />
            ) : (
              <SectionProblem result={notes} what="notes" />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
