"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { askPlannerAction, sendEmailAction } from "@/app/dashboard/actions";
import type { EmailDraft } from "@/lib/ai/planner";
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
      {state?.email && (
        // Keyed on the draft so a new request starts a fresh editable form.
        <EmailPreview
          key={`${state.email.to}|${state.email.subject}|${state.email.body}`}
          draft={state.email}
        />
      )}
    </div>
  );
}

// Review step for an AI-drafted email: everything is editable, and nothing
// is sent until Send is pressed.
function EmailPreview({ draft }: { draft: EmailDraft }) {
  const [state, formAction] = useActionState(sendEmailAction, null);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  if (state?.sentTo) {
    return (
      <p className="rounded-xl border border-accent-line bg-accent/5 p-3 text-sm text-ink-soft">
        Sent to {state.sentTo}.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-xl border border-dashed border-[#1f4a66] bg-accent/5 p-3.5"
    >
      <p className="text-xs font-medium tracking-wider text-ink-muted uppercase">
        Draft email — review before sending
      </p>
      <input
        name="to"
        type="email"
        required
        defaultValue={draft.to}
        placeholder="To (email address)"
        aria-label="To"
        className={`${fieldClass} h-10 text-sm`}
      />
      <input
        name="subject"
        required
        defaultValue={draft.subject}
        placeholder="Subject"
        aria-label="Subject"
        className={`${fieldClass} h-10 text-sm`}
      />
      <textarea
        name="body"
        required
        defaultValue={draft.body}
        rows={7}
        aria-label="Message"
        className={`${fieldClass} py-2.5 text-sm leading-relaxed`}
      />
      {state?.error && <p className="text-sm text-danger-ink">{state.error}</p>}
      <div className="flex gap-2">
        <SendButton />
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="h-9 rounded-full border border-field px-3.5 text-[13px] text-ink-dim transition-colors hover:bg-raised hover:text-ink"
        >
          Discard
        </button>
      </div>
    </form>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${primaryButtonColors} h-9 px-3.5 text-[13px]`}
    >
      {pending ? "Sending…" : "Send email"}
    </button>
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
