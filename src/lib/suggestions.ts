import type { SupabaseClient } from "@supabase/supabase-js";

export type Suggestion = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  reason: string | null;
};

// The signed-in user's pending suggestions that haven't already passed,
// soonest first (RLS scopes the query to their own rows).
export async function listPendingSuggestions(
  supabase: SupabaseClient
): Promise<Suggestion[]> {
  const { data, error } = await supabase
    .from("suggestions")
    .select("id, title, start_at, end_at, reason")
    .eq("status", "pending")
    .gte("end_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }
  return data;
}
