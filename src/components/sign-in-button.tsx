"use client";

import { createClient } from "@/lib/supabase/client";

export function SignInButton() {
  const supabase = createClient();

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Ask Google for offline access now so a refresh token comes back —
        // Phase 3/4 (Calendar + Tasks) need it and re-prompting later is a pain.
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
      className="flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
    >
      Sign in with Google
    </button>
  );
}
