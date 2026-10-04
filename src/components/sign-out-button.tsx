"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      className="h-9 rounded-[10px] border border-field px-3.5 text-sm text-ink-dim transition-colors hover:bg-raised hover:text-ink"
    >
      Sign out
    </button>
  );
}
