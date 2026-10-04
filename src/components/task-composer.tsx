"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { addTaskAction } from "@/app/dashboard/actions";
import { appendPhrase, useDictation } from "@/lib/use-dictation";
import { fieldClass, MicButton, primaryButtonColors } from "./ui";

function AddButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`${primaryButtonColors} h-11 px-4.5 text-sm`}
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}

export function TaskComposer() {
  const [title, setTitle] = useState("");
  const dictation = useDictation((phrase) =>
    setTitle((prev) => appendPhrase(prev, phrase))
  );

  return (
    <form
      action={async (formData) => {
        dictation.stop();
        await addTaskAction(formData);
        setTitle("");
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <label htmlFor="task-title" className="sr-only">
          New task
        </label>
        <input
          id="task-title"
          name="title"
          required
          value={
            dictation.listening && dictation.interim
              ? appendPhrase(title, dictation.interim)
              : title
          }
          onChange={(e) => setTitle(e.target.value)}
          readOnly={dictation.listening}
          placeholder={
            dictation.supported ? "Add a task, or dictate it" : "Add a task"
          }
          className={`${fieldClass} h-11 min-w-0 flex-1`}
        />
        {dictation.supported && (
          <MicButton
            listening={dictation.listening}
            aria-label={
              dictation.listening ? "Stop dictating" : "Dictate a task"
            }
            onClick={dictation.listening ? dictation.stop : dictation.start}
          />
        )}
        <AddButton disabled={!title.trim() || dictation.listening} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label htmlFor="task-due" className="text-xs text-ink-muted">
          Due
        </label>
        <input
          id="task-due"
          type="date"
          name="due"
          className={`${fieldClass} h-9 px-2.5 text-sm text-ink-dim [color-scheme:dark] max-sm:text-sm`}
        />
        <span className="text-xs text-ink-muted">
          No time given? The AI planner will suggest a slot.
        </span>
      </div>
      {dictation.error && (
        <p className="text-sm text-danger-ink">{dictation.error}</p>
      )}
    </form>
  );
}
