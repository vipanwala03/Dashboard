"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getGoogleAccessToken,
  GoogleReauthRequiredError,
} from "@/lib/google/tokens";
import { completeTask, createTask, listOpenTasks } from "@/lib/google/tasks";
import { createCalendarEvent, listCalendarRange } from "@/lib/google/calendar";
import { planWithClaude } from "@/lib/ai/planner";

// Server Actions are reachable by direct POST, so each one re-checks the
// session rather than trusting that the caller came from /dashboard.
async function googleTokenForCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }
  return getGoogleAccessToken(supabase, user.id);
}

export async function addTaskAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const due = String(formData.get("due") ?? "");
  if (!title) return;

  const accessToken = await googleTokenForCurrentUser();
  await createTask(
    accessToken,
    title,
    /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : undefined
  );
  revalidatePath("/dashboard");
}

export async function completeTaskAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  const accessToken = await googleTokenForCurrentUser();
  await completeTask(accessToken, taskId);
  revalidatePath("/dashboard");
}

export async function addNoteAction(formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  const source = formData.get("source") === "voice" ? "voice" : "text";
  if (!content) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  // user_id defaults to auth.uid() in the database, and RLS rejects any
  // other value, so it isn't sent from here.
  const { error } = await supabase.from("notes").insert({ content, source });
  if (error) {
    throw new Error(`Couldn't save note: ${error.message}`);
  }
  revalidatePath("/dashboard");
}

export async function deleteNoteAction(formData: FormData) {
  const noteId = String(formData.get("noteId") ?? "");
  if (!noteId) return;

  const supabase = await createClient();
  // RLS limits this to the signed-in user's own notes.
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) {
    throw new Error(`Couldn't delete note: ${error.message}`);
  }
  revalidatePath("/dashboard");
}

export type PlannerState = {
  error?: string;
  message?: string;
} | null;

// Asks Claude for calendar-event proposals from what the user typed and/or a
// note, and stores them as pending suggestions. Errors come back as state
// (not thrown) so the planner panel can show them inline.
export async function askPlannerAction(
  _prev: PlannerState,
  formData: FormData
): Promise<PlannerState> {
  const request = String(formData.get("request") ?? "")
    .trim()
    .slice(0, 1000);
  const noteId = String(formData.get("noteId") ?? "");
  if (!request && !noteId)
    return { error: "Tell the planner what to schedule." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  try {
    let note: string | undefined;
    if (noteId) {
      // RLS limits this to the signed-in user's own notes.
      const { data, error } = await supabase
        .from("notes")
        .select("content")
        .eq("id", noteId)
        .single();
      if (error) return { error: "Couldn't find that note." };
      note = data.content;
    }

    const accessToken = await getGoogleAccessToken(supabase, user.id);
    const [range, tasks] = await Promise.all([
      listCalendarRange(accessToken),
      listOpenTasks(accessToken),
    ]);
    const proposals = await planWithClaude({ request, note, range, tasks });
    if (proposals.length === 0) {
      return {
        message: "Nothing to schedule from that — or no free slot fit.",
      };
    }

    const { error } = await supabase.from("suggestions").insert(
      proposals.map((p) => ({
        note_id: noteId || null,
        title: p.title,
        start_at: p.start,
        end_at: p.end,
        reason: p.reason,
      }))
    );
    if (error) return { error: `Couldn't save suggestions: ${error.message}` };

    revalidatePath("/dashboard");
    return null;
  } catch (err) {
    console.error("Planner failed:", err);
    if (err instanceof GoogleReauthRequiredError) {
      return { error: "Google access needs to be reconnected." };
    }
    return { error: err instanceof Error ? err.message : "Planner failed." };
  }
}

// Accepting writes the event to Google Calendar. The row is claimed first
// (pending → accepted) so a double click can't create the event twice, and
// put back if Google rejects it.
export async function acceptSuggestionAction(formData: FormData) {
  const id = String(formData.get("suggestionId") ?? "");
  if (!id) return;

  const accessToken = await googleTokenForCurrentUser();
  const supabase = await createClient();
  const { data: claimed, error } = await supabase
    .from("suggestions")
    .update({ status: "accepted" })
    .eq("id", id)
    .eq("status", "pending")
    .select("title, start_at, end_at, reason")
    .maybeSingle();
  if (error) {
    throw new Error(`Couldn't accept suggestion: ${error.message}`);
  }
  if (!claimed) return;

  try {
    const event = await createCalendarEvent(accessToken, {
      title: claimed.title,
      start: claimed.start_at,
      end: claimed.end_at,
      description: claimed.reason ?? undefined,
    });
    await supabase
      .from("suggestions")
      .update({ calendar_event_id: event.id })
      .eq("id", id);
  } catch (err) {
    await supabase
      .from("suggestions")
      .update({ status: "pending" })
      .eq("id", id);
    throw err;
  }
  revalidatePath("/dashboard");
}

export async function dismissSuggestionAction(formData: FormData) {
  const id = String(formData.get("suggestionId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // RLS limits this to the signed-in user's own suggestions.
  const { error } = await supabase
    .from("suggestions")
    .update({ status: "dismissed" })
    .eq("id", id);
  if (error) {
    throw new Error(`Couldn't dismiss suggestion: ${error.message}`);
  }
  revalidatePath("/dashboard");
}
