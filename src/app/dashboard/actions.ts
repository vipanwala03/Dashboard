"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getGoogleAccessToken,
  GoogleReauthRequiredError,
} from "@/lib/google/tokens";
import { completeTask, createTask, listOpenTasks } from "@/lib/google/tasks";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarRange,
} from "@/lib/google/calendar";
import {
  planWithClaude,
  type DeletionCandidate,
  type EmailDraft,
} from "@/lib/ai/planner";
import { EMAIL_PATTERN, sendEmail } from "@/lib/google/gmail";
import { DAILY_LIMIT, getAiUsage } from "@/lib/ai/usage";

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
  // An email Claude drafted, waiting for the user to review and send.
  email?: EmailDraft;
  // Events Claude wants removed, waiting for the user to confirm.
  deletions?: DeletionCandidate[];
  // Time zone to show those events' times in.
  timeZone?: string;
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

  // Cap checked before any Claude call, since each one costs real money.
  const usage = await getAiUsage(supabase).catch(() => null);
  if (usage && usage.requestsLast24h >= DAILY_LIMIT) {
    return {
      error: `Daily AI limit reached (${DAILY_LIMIT} requests per 24 hours). Try again later.`,
    };
  }

  let tokens: { inputTokens: number; outputTokens: number } | undefined;
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
    const { proposals, email, deletions, skippedReadOnly } =
      await planWithClaude({
        request,
        note,
        senderName: (user.user_metadata?.full_name as string | undefined) ?? "",
      onUsage: (u) => (tokens = u),
        range,
        tasks,
      });
    // Emails only come from the ask box; "Plan this" on a note is scheduling.
    if (email && !noteId) return { email };
    if (deletions.length > 0 && !noteId) {
      return { deletions, timeZone: range.timeZone };
    }
    if (skippedReadOnly > 0 && !noteId) {
      return {
        error:
          "Those events are on a read-only calendar, so they can't be deleted here.",
      };
    }
    if (proposals.length === 0) {
      return {
        message:
          "I couldn't find anything to schedule, send or delete from that. Try being more specific.",
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
  } finally {
    // Log what the call used (even if the answer was unusable) so the cap and
    // the usage counter stay accurate.
    if (tokens) {
      const { error } = await supabase.from("ai_usage").insert({
        input_tokens: tokens.inputTokens,
        output_tokens: tokens.outputTokens,
      });
      if (error) console.error("Couldn't log AI usage:", error.message);
      revalidatePath("/dashboard");
    }
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

export type SendEmailState = { error?: string; sentTo?: string } | null;

// Sends exactly what the user approved in the preview form — nothing the AI
// produced goes out without passing through that form first.
export async function sendEmailAction(
  _prev: SendEmailState,
  formData: FormData
): Promise<SendEmailState> {
  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!EMAIL_PATTERN.test(to)) {
    return { error: "Enter one valid email address in To." };
  }
  if (!subject || subject.length > 200) {
    return { error: "Add a subject (200 characters at most)." };
  }
  if (!body || body.length > 10000) {
    return { error: "Add a message (10,000 characters at most)." };
  }

  try {
    const accessToken = await googleTokenForCurrentUser();
    await sendEmail(accessToken, { to, subject, body });
    return { sentTo: to };
  } catch (err) {
    console.error("Send email failed:", err);
    if (err instanceof GoogleReauthRequiredError) {
      return { error: "Google access needs to be reconnected." };
    }
    const message = err instanceof Error ? err.message : "";
    if (/scope|permission|insufficient/i.test(message)) {
      return {
        error:
          "Gmail sending isn't allowed yet. Sign out and back in to approve it.",
      };
    }
    return { error: message || "Couldn't send the email." };
  }
}

export type DeleteEventsState = { error?: string; deleted?: number } | null;

// Deletes the events the user confirmed. Each `event` field is a JSON
// [calendarId, eventId] pair. The calls use the user's own Google token, so
// they can only ever touch their own calendars.
export async function deleteEventsAction(
  _prev: DeleteEventsState,
  formData: FormData
): Promise<DeleteEventsState> {
  const refs: [string, string][] = [];
  for (const value of formData.getAll("event")) {
    try {
      const pair = JSON.parse(String(value));
      if (
        Array.isArray(pair) &&
        typeof pair[0] === "string" &&
        typeof pair[1] === "string" &&
        pair[0] &&
        pair[1] &&
        refs.length < 10
      ) {
        refs.push([pair[0], pair[1]]);
      }
    } catch {
      // Ignore malformed entries.
    }
  }
  if (refs.length === 0) return { error: "Nothing to delete." };

  try {
    const accessToken = await googleTokenForCurrentUser();
    for (const [calendarId, eventId] of refs) {
      await deleteCalendarEvent(accessToken, calendarId, eventId);
    }
    revalidatePath("/dashboard");
    return { deleted: refs.length };
  } catch (err) {
    console.error("Delete events failed:", err);
    // Some may already be gone; refresh so the page shows what's left.
    revalidatePath("/dashboard");
    if (err instanceof GoogleReauthRequiredError) {
      return { error: "Google access needs to be reconnected." };
    }
    return {
      error: err instanceof Error ? err.message : "Couldn't delete the event.",
    };
  }
}
