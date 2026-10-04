import { googleFetch } from "./fetch";

export type Task = {
  id: string;
  title: string;
  notes?: string;
  // Google Tasks only stores a due *date* — the time part is always
  // midnight UTC — so this is just YYYY-MM-DD.
  due?: string;
  webViewLink?: string;
  subtasks: Task[];
};

type GoogleTask = {
  id: string;
  title?: string;
  notes?: string;
  due?: string;
  parent?: string;
  position: string;
  webViewLink?: string;
};

// The user's default list ("My Tasks" in Google Tasks).
const LIST_URL = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";

// Fetches the incomplete tasks on the default list, with subtasks nested
// under their parent. Top-level tasks are sorted by due date (soonest —
// including overdue — first); undated ones follow in Google Tasks' order.
export async function listOpenTasks(accessToken: string): Promise<Task[]> {
  const params = new URLSearchParams({
    showCompleted: "false",
    maxResults: "100",
  });
  const data = await googleFetch<{ items?: GoogleTask[] }>(
    "Google Tasks",
    `${LIST_URL}?${params}`,
    accessToken
  );

  // `position` sorts tasks among their siblings; the API doesn't guarantee
  // the response is already in that order.
  const items = (data.items ?? []).sort((a, b) =>
    a.position.localeCompare(b.position)
  );

  const toTask = (t: GoogleTask): Task => ({
    id: t.id,
    title: t.title || "(No title)",
    notes: t.notes,
    due: t.due?.slice(0, 10),
    webViewLink: t.webViewLink,
    subtasks: [],
  });

  const topLevel = items.filter((t) => !t.parent).map(toTask);
  const byId = new Map(topLevel.map((t) => [t.id, t]));
  for (const t of items) {
    // A subtask whose parent is completed (so not returned) is dropped —
    // Google Tasks hides those too.
    if (t.parent) byId.get(t.parent)?.subtasks.push(toTask(t));
  }
  // Array.prototype.sort is stable, so equal/undated tasks keep their order.
  return topLevel.sort((a, b) =>
    a.due && b.due ? a.due.localeCompare(b.due) : a.due ? -1 : b.due ? 1 : 0
  );
}

// `due` is YYYY-MM-DD.
export async function createTask(
  accessToken: string,
  title: string,
  due?: string
) {
  await googleFetch("Google Tasks", LIST_URL, accessToken, {
    method: "POST",
    body: { title, ...(due && { due: `${due}T00:00:00.000Z` }) },
  });
}

export async function completeTask(accessToken: string, taskId: string) {
  await googleFetch(
    "Google Tasks",
    `${LIST_URL}/${encodeURIComponent(taskId)}`,
    accessToken,
    { method: "PATCH", body: { status: "completed" } }
  );
}
