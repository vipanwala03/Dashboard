import { fieldClass, MicButton, Panel, primaryButtonColors } from "./ui";

// Placeholder for Phase 7: the layout the AI planner will fill in, with
// every control disabled. One example card shows what a suggestion will
// look like.
export function AiPlannerPanel() {
  return (
    <Panel
      ai
      title={
        <>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className="text-accent"
          >
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
          </svg>
          AI planner
        </>
      }
      aside={
        <span className="rounded-full border border-accent-line px-2.5 py-1 text-xs text-accent-soft">
          Coming soon
        </span>
      }
    >
      <div className="flex gap-2">
        <label htmlFor="ai-ask" className="sr-only">
          Ask the AI planner
        </label>
        <input
          id="ai-ask"
          disabled
          placeholder="“Find two hours to study for the midterm”"
          className={`${fieldClass} h-11 min-w-0 flex-1 text-sm opacity-80`}
        />
        <MicButton listening={false} disabled aria-label="Dictate to the AI planner" />
      </div>
      <p className="mt-0.5 text-xs font-medium tracking-wider text-ink-muted uppercase">
        Suggestions
      </p>
      <div className="rounded-xl border border-dashed border-[#1f4a66] bg-accent/5 p-3.5">
        <p className="text-sm leading-relaxed text-ink-soft">
          Your professor’s office hours are Monday 2–3 PM and you’re free then.
          Add it to your calendar?
        </p>
        <p className="mt-1.5 text-xs text-ink-muted">
          Example — suggestions from your notes will show up here.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled className={`${primaryButtonColors} h-9 px-3.5 text-[13px]`}>
            Add to calendar
          </button>
          <button
            type="button"
            disabled
            className="h-9 rounded-full border border-field px-3.5 text-[13px] text-ink-dim opacity-75"
          >
            Dismiss
          </button>
        </div>
      </div>
    </Panel>
  );
}
