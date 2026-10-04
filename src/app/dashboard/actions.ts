"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/tokens";
import { completeTask, createTask } from "@/lib/google/tasks";

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
