"use client";

import { useFormStatus } from "react-dom";

// Circle checkbox for a task row. Lives inside a <form> that submits the
// task's id to completeTaskAction; dims while the request is in flight.
export function CompleteTaskButton({ title }: { title: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Mark "${title}" as done`}
      className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-100 disabled:border-zinc-700 disabled:bg-zinc-700 dark:border-zinc-500 dark:hover:border-zinc-300 dark:hover:bg-zinc-800 dark:disabled:border-zinc-300 dark:disabled:bg-zinc-300"
    />
  );
}

export function AddTaskButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 shrink-0 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}
