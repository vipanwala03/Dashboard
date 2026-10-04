"use client";

import { createClient } from "@/lib/supabase/client";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
  // Send-only: lets the AI planner send emails you've approved. Can't read mail.
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

export function SignInButton({
  label = "Sign in with Google",
}: {
  label?: string;
}) {
  const supabase = createClient();

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: GOOGLE_SCOPES,
        // Forces Google to hand back a refresh token every time, so the
        // Calendar/Tasks access (Phase 3/4) survives past the 1-hour
        // access token lifetime without asking you to sign in again.
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  };

  return (
    <button
      onClick={handleSignIn}
      className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
    >
      {label}
    </button>
  );
}
