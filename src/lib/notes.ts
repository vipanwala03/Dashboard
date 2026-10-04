import type { SupabaseClient } from "@supabase/supabase-js";

export type Note = {
  id: string;
  content: string;
  source: "text" | "voice";
  created_at: string;
};

// The signed-in user's most recent notes, newest first (RLS scopes the
// query to their own rows).
export async function listRecentNotes(
  supabase: SupabaseClient,
  limit = 20
): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("id, content, source, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }
  return data;
}
