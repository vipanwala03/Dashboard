import type { Task } from "@/lib/google/tasks";
import { formatDayKey } from "@/lib/dates";
import { completeTaskAction } from "@/app/dashboard/actions";
import { CompleteTaskButton } from "./task-buttons";

function dueLabel(due: string, todayKey: string) {
  if (due === todayKey) return { text: "Due today", tone: "text-accent-soft" };
  if (due < todayKey) {
    return {
      text: `Overdue · ${formatDayKey(due, "short")}`,
      tone: "text-warn-ink",
    };
  }
  return { text: `Due ${formatDayKey(due, "short")}`, tone: "text-ink-muted" };
}

function TaskRow({ task, todayKey }: { task: Task; todayKey: string }) {
  const due = task.due ? dueLabel(task.due, todayKey) : null;
  return (
    <li>
      <div className="flex items-start gap-3 py-2.5">
        <form action={completeTaskAction} className="mt-0.5 flex">
          <input type="hidden" name="taskId" value={task.id} />
          <CompleteTaskButton title={task.title} />
        </form>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink max-sm:text-[15px]">{task.title}</p>
          {task.notes && (
            <p className="truncate text-xs text-ink-muted">{task.notes}</p>
          )}
          {due && <p className={`mt-0.5 text-xs ${due.tone}`}>{due.text}</p>}
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
  todayKey,
}: {
  tasks: Task[];
  todayKey: string;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-ink-muted">No open tasks — nice.</p>;
  }
  return (
    <ul className="-mr-2 flex max-h-80 flex-col divide-y divide-line-soft overflow-y-auto border-t border-line-soft pr-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} todayKey={todayKey} />
      ))}
    </ul>
  );
}
