import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInButton } from "@/components/sign-in-button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center sm:p-16">
      <h1 className="text-4xl font-semibold tracking-tight text-ink-strong">
        Dashboard
      </h1>
      <p className="max-w-sm text-lg text-ink-muted">
        Sign in with your Google account to get started.
      </p>
      <SignInButton />
    </div>
  );
}
