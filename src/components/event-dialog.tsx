"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteEventsAction } from "@/app/dashboard/actions";
import { formatDayKey } from "@/lib/dates";
import type { PositionedEvent } from "@/lib/week-layout";

// Details for a clicked calendar event, with a two-step delete. Uses the
// native <dialog> so Escape, focus trapping and the backdrop come for free.
export function EventDialog({
  event,
  dayKey,
  onClose,
}: {
  event: PositionedEvent;
  dayKey: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteEventsAction, null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // Once Google confirms the delete, the page refreshes without the event.
  useEffect(() => {
    if (state?.deleted) onClose();
  }, [state, onClose]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-line bg-panel p-5 text-ink backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span
            className="mt-1.5 h-3 w-3 shrink-0 rounded-[3px]"
            style={{ background: event.color }}
          />
          <div className="min-w-0">
            <h3 className="text-lg leading-snug font-semibold break-words text-ink-strong">
              {event.title}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-accent-soft">
              {formatDayKey(dayKey)} · {event.timeLabel}
            </p>
          </div>
        </div>
        {event.location && (
          <p className="text-sm text-ink-soft">{event.location}</p>
        )}
        <p className="text-xs text-ink-muted">{event.calendarName}</p>

        {state?.error && (
          <p className="text-sm text-danger-ink">{state.error}</p>
        )}

        {confirming ? (
          <form action={formAction} className="flex flex-col gap-2.5">
            <input
              type="hidden"
              name="event"
              value={JSON.stringify([event.calendarId, event.eventId])}
            />
            <p className="text-sm text-ink-soft">
              Delete this event from Google Calendar? If it repeats, only this
              one is removed.
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-full bg-danger-ink px-3.5 text-[13px] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-9 rounded-full border border-field px-3.5 text-[13px] text-ink-dim transition-colors hover:bg-raised hover:text-ink"
              >
                Keep it
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {event.canDelete ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="h-9 rounded-full border border-danger-ink/60 px-3.5 text-[13px] text-danger-ink transition-colors hover:bg-danger-ink/10"
              >
                Delete
              </button>
            ) : (
              <span className="text-xs text-ink-muted">
                Read-only calendar — can&apos;t be deleted here.
              </span>
            )}
            {event.href && (
              <a
                href={event.href}
                target="_blank"
                rel="noreferrer"
                className="h-9 content-center rounded-full border border-field px-3.5 text-[13px] text-ink-dim transition-colors hover:bg-raised hover:text-ink"
              >
                Open in Google Calendar
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto h-9 px-2 text-[13px] text-ink-muted hover:text-ink"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
