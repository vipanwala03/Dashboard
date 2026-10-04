import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { UpcomingEventsList } from "@/components/upcoming-events";
import { TaskList } from "@/components/task-list";
import {
  getGoogleAccessToken,
  GoogleReauthRequiredError,
} from "@/lib/google/tokens";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { listOpenTasks } from "@/lib/google/tasks";

type Result<T> =
  | { status: "ok"; data: T }
  | { status: "reauth" }
  | { status: "error"; message: string };

// Turns a failed Google call into something the page can render, so one
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
  const [calendar, tasks] = await Promise.all([
    token.then((t) =>
      t.status === "ok"
        ? settle("Calendar fetch", () => listUpcomingEvents(t.data))
        : t
    ),
    token.then((t) =>
      t.status === "ok" ? settle("Tasks fetch", () => listOpenTasks(t.data)) : t
    ),
  ]);

  // Tasks only store a date; "today" for overdue checks follows the
  // calendar's time zone when we have it.
  const timeZone = calendar.status === "ok" ? calendar.data.timeZone : "UTC";

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 p-6 sm:p-16 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-10">
        <header className="flex items-center justify-between gap-4">
          <p className="text-zinc-600 dark:text-zinc-400">
            Signed in as{" "}
            <span className="font-medium text-black dark:text-zinc-50">
              {user.email}
            </span>
          </p>
          <SignOutButton />
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
            To-do
          </h2>
          {tasks.status === "ok" ? (
            <TaskList tasks={tasks.data} timeZone={timeZone} />
          ) : (
            <SectionProblem result={tasks} what="tasks" />
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Next two weeks
          </h2>
          {calendar.status === "ok" ? (
            <UpcomingEventsList {...calendar.data} />
          ) : (
            <SectionProblem result={calendar} what="calendar" />
          )}
        </section>
      </div>
    </div>
  );
}
