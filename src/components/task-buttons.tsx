"use client";

import { useFormStatus } from "react-dom";

// Circle checkbox for a task row. Lives inside a <form> that submits the
// task's id to completeTaskAction; fills in while the request is in flight.
export function CompleteTaskButton({ title }: { title: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Mark "${title}" as done`}
      // The visible circle is 20px; the padding makes the tap target 32px.
      className="group -m-1.5 shrink-0 p-1.5"
    >
      <span className="block h-5 w-5 rounded-full border-2 border-[#3b4b6b] transition-colors group-hover:border-accent group-disabled:border-accent group-disabled:bg-accent" />
    </button>
  );
}
