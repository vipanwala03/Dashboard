import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { UpcomingEventsList } from "@/components/upcoming-events";
import {
  getGoogleAccessToken,
  GoogleReauthRequiredError,
} from "@/lib/google/tokens";
import { listUpcomingEvents, type UpcomingEvents } from "@/lib/google/calendar";

type CalendarResult =
  | { status: "ok"; data: UpcomingEvents }
  | { status: "reauth" }
  | { status: "error"; message: string };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  let calendar: CalendarResult;
  try {
    const accessToken = await getGoogleAccessToken(supabase, user.id);
    calendar = { status: "ok", data: await listUpcomingEvents(accessToken) };
  } catch (err) {
    console.error("Calendar fetch failed:", err);
    calendar =
      err instanceof GoogleReauthRequiredError
        ? { status: "reauth" }
        : {
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          };
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 p-6 sm:p-16 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-8">
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
            Next two weeks
          </h2>
          {calendar.status === "ok" && (
            <UpcomingEventsList {...calendar.data} />
          )}
          {calendar.status === "reauth" && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-zinc-600 dark:text-zinc-400">
                Google Calendar access needs to be reconnected.
              </p>
              <SignInButton label="Reconnect Google" />
            </div>
          )}
          {calendar.status === "error" && (
            <p className="text-red-600 dark:text-red-400">
              Couldn&apos;t load your calendar: {calendar.message}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
