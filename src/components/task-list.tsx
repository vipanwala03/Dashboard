import type { Task } from "@/lib/google/tasks";
import { dayKey, formatDayKey } from "@/lib/dates";
import { addTaskAction, completeTaskAction } from "@/app/dashboard/actions";
import { AddTaskButton, CompleteTaskButton } from "./task-buttons";

function TaskRow({ task, todayKey }: { task: Task; todayKey: string }) {
  const overdue = task.due !== undefined && task.due < todayKey;
  return (
    <li>
      <div className="flex items-start gap-3 py-2">
        <form action={completeTaskAction} className="flex">
          <input type="hidden" name="taskId" value={task.id} />
          <CompleteTaskButton title={task.title} />
        </form>
        <div className="min-w-0 flex-1">
          <p className="text-black dark:text-zinc-50">{task.title}</p>
          {task.notes && (
            <p className="truncate text-sm text-zinc-500">{task.notes}</p>
          )}
          {task.due && (
            <p
              className={`text-sm ${overdue ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}
            >
              {task.due === todayKey
                ? "Due today"
                : `${overdue ? "Overdue" : "Due"} · ${formatDayKey(task.due, "short")}`}
            </p>
          )}
        </div>
      </div>
      {task.subtasks.length > 0 && (
        <ul className="ml-8">
          {task.subtasks.map((sub) => (
            <TaskRow key={sub.id} task={sub} todayKey={todayKey} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TaskList({
  tasks,
  timeZone,
}: {
  tasks: Task[];
  // Used to decide what counts as "today" for due dates.
  timeZone: string;
}) {
  const todayKey = dayKey(new Date(), timeZone);

  return (
    <div className="flex flex-col gap-4">
      <form action={addTaskAction} className="flex flex-wrap gap-2">
        <input
          name="title"
          required
          placeholder="Add a task"
          className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-black placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <input
          type="date"
          name="due"
          aria-label="Due date (optional)"
          className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        />
        <AddTaskButton />
      </form>

      {tasks.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          No open tasks — nice.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white px-4 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} todayKey={todayKey} />
          ))}
        </ul>
      )}
    </div>
  );
}
