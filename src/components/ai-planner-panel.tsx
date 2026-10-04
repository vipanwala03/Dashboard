import {
  acceptSuggestionAction,
  dismissSuggestionAction,
} from "@/app/dashboard/actions";
import type { Suggestion } from "@/lib/suggestions";
import { DAILY_LIMIT, type AiUsage } from "@/lib/ai/usage";
import { PendingButton, PlannerForm } from "./planner-controls";
import { Panel, primaryButtonColors } from "./ui";

function SuggestionCard({
  suggestion,
  timeZone,
}: {
  suggestion: Suggestion;
  timeZone: string;
}) {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  const start = new Date(suggestion.start_at);
  const end = new Date(suggestion.end_at);

  return (
    <li className="rounded-xl border border-dashed border-[#1f4a66] bg-accent/5 p-3.5">
      <p className="text-sm font-semibold text-ink-strong">
        {suggestion.title}
      </p>
      <p className="mt-0.5 font-mono text-xs text-accent-soft">
        {day.format(start)} · {time.format(start)} – {time.format(end)}
      </p>
      {suggestion.reason && (
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          {suggestion.reason}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <form action={acceptSuggestionAction}>
          <input type="hidden" name="suggestionId" value={suggestion.id} />
          <PendingButton
            pendingLabel="Adding…"
            className={`${primaryButtonColors} h-9 px-3.5 text-[13px]`}
          >
            Add to calendar
          </PendingButton>
        </form>
        <form action={dismissSuggestionAction}>
          <input type="hidden" name="suggestionId" value={suggestion.id} />
          <PendingButton
            pendingLabel="Dismissing…"
            className="h-9 rounded-full border border-field px-3.5 text-[13px] text-ink-dim transition-colors hover:bg-raised hover:text-ink disabled:opacity-60"
          >
            Dismiss
          </PendingButton>
        </form>
      </div>
    </li>
  );
}

export function AiPlannerPanel({
  suggestions,
  usage,
  timeZone,
}: {
  suggestions: Suggestion[];
  usage: AiUsage | null;
  timeZone: string;
}) {
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
        suggestions.length > 0 ? (
          <span className="text-[13px] text-ink-muted">
            {suggestions.length} suggested
          </span>
        ) : undefined
      }
    >
      <PlannerForm />
      <p className="mt-0.5 text-xs font-medium tracking-wider text-ink-muted uppercase">
        Suggestions
      </p>
      {suggestions.length > 0 ? (
        <ul className="-mr-2 flex max-h-72 flex-col gap-2.5 overflow-y-auto pr-2">
          {suggestions.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} timeZone={timeZone} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">
          Ask for a time block above, or use “Plan this” on a note. Suggestions
          appear here and as dashed blocks on the calendar until you add them.
        </p>
      )}
      {usage && <UsageLine usage={usage} />}
    </Panel>
  );
}

// Small footer: how much of the daily AI cap is used, and the month's
// estimated spend (see usage.ts for how it's calculated).
function UsageLine({ usage }: { usage: AiUsage }) {
  const atLimit = usage.requestsLast24h >= DAILY_LIMIT;
  const cost =
    usage.costThisMonth < 0.01
      ? "under 1¢"
      : `$${usage.costThisMonth.toFixed(2)}`;
  return (
    <p
      className={`mt-auto pt-1 text-xs ${atLimit ? "text-danger-ink" : "text-ink-muted"}`}
    >
      {usage.requestsLast24h} of {DAILY_LIMIT} AI requests used in the last 24
      hours · about {cost} this month
    </p>
  );
}
