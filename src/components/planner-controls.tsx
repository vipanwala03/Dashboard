"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { askPlannerAction } from "@/app/dashboard/actions";
import { appendPhrase, useDictation } from "@/lib/use-dictation";
import { fieldClass, MicButton, primaryButtonColors } from "./ui";

function AskButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`${primaryButtonColors} h-11 px-4.5 text-sm`}
    >
      {pending ? "Planning…" : "Ask"}
    </button>
  );
}

function PlannerNotice({
  state,
}: {
  state: { error?: string; message?: string } | null;
}) {
  if (state?.error) {
    return <p className="text-sm text-danger-ink">{state.error}</p>;
  }
  if (state?.message) {
    return <p className="text-sm text-ink-muted">{state.message}</p>;
  }
  return null;
}

// The planner's ask box: type or dictate a request, get suggestions back.
export function PlannerForm() {
  const [request, setRequest] = useState("");
  const dictation = useDictation((phrase) =>
    setRequest((prev) => appendPhrase(prev, phrase))
  );
  const [state, formAction] = useActionState(
    async (
      prev: Awaited<ReturnType<typeof askPlannerAction>>,
      fd: FormData
    ) => {
      dictation.stop();
      const next = await askPlannerAction(prev, fd);
      // Keep the text if it failed so the user can retry.
      if (!next?.error) setRequest("");
      return next;
    },
    null
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <label htmlFor="ai-ask" className="sr-only">
            Ask the AI planner
          </label>
          <input
            id="ai-ask"
            name="request"
            value={
              dictation.listening && dictation.interim
                ? appendPhrase(request, dictation.interim)
                : request
            }
            onChange={(e) => setRequest(e.target.value)}
            readOnly={dictation.listening}
            placeholder="“Find two hours to study for the midterm”"
            className={`${fieldClass} h-11 min-w-0 flex-1 text-sm`}
          />
          {dictation.supported && (
            <MicButton
              listening={dictation.listening}
              aria-label={
                dictation.listening
                  ? "Stop dictating"
                  : "Dictate to the AI planner"
              }
              onClick={dictation.listening ? dictation.stop : dictation.start}
            />
          )}
          <AskButton disabled={!request.trim() || dictation.listening} />
        </div>
        {dictation.error && (
          <p className="text-sm text-danger-ink">{dictation.error}</p>
        )}
        <PlannerNotice state={state} />
      </form>
    </div>
  );
}

// "Plan this" under a note: asks the planner to schedule what the note says.
export function PlanNoteButton({ noteId }: { noteId: string }) {
  const [state, formAction, pending] = useActionState(askPlannerAction, null);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="noteId" value={noteId} />
      {state?.error && <span className="text-danger-ink">{state.error}</span>}
      {state?.message && <span>{state.message}</span>}
      <button
        type="submit"
        disabled={pending}
        className="py-1 text-accent-soft underline-offset-2 hover:underline disabled:opacity-60"
      >
        {pending ? "Planning…" : "Plan this"}
      </button>
    </form>
  );
}

// Submit button for the Add to calendar / Dismiss forms.
export function PendingButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
