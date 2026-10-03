import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 p-16 text-center dark:bg-black">
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Signed in as{" "}
        <span className="font-medium text-black dark:text-zinc-50">
          {user.email}
        </span>
      </p>
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Your dashboard is empty — for now.
      </h1>
      <SignOutButton />
    </div>
  );
}
