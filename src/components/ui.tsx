// Small shared building blocks for the dashboard's look, so cards, buttons
// and the mic button stay consistent across sections.

import type { ComponentProps, ReactNode } from "react";

export function Panel({
  title,
  aside,
  ai = false,
  className = "",
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  // The AI planner card gets a slightly bluer surface and border.
  ai?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col gap-3.5 rounded-2xl border p-4 sm:p-5 ${
        ai ? "border-accent-line bg-panel-ai" : "border-line bg-panel"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink-strong">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

// Brighter than the accent itself, with a soft glow, so primary actions
// stand out on the dark panels. They're disabled whenever their field is
// empty (most of the time), so disabled only dims them slightly and keeps
// a fainter glow rather than fading them out.
export const primaryButtonColors =
  "shrink-0 rounded-full bg-button font-semibold text-accent-ink shadow-[0_0_6px_rgb(122_240_255/0.35),0_0_20px_rgb(122_240_255/0.3)] transition-[background-color,box-shadow] hover:bg-button-hover hover:shadow-[0_0_8px_rgb(122_240_255/0.45),0_0_26px_rgb(122_240_255/0.4)] disabled:cursor-not-allowed disabled:opacity-90 disabled:shadow-[0_0_14px_rgb(122_240_255/0.18)] disabled:hover:bg-button";
export const primaryButton = `${primaryButtonColors} h-11 px-5 text-sm`;

export const secondaryButton =
  "rounded-[10px] border border-field text-ink-dim transition-colors hover:bg-raised hover:text-ink";

export const fieldClass =
  "rounded-xl border border-field bg-inset px-3.5 text-[15px] text-ink outline-none transition-colors focus:border-accent-line focus:ring-2 focus:ring-accent/25 max-sm:text-base";

export function MicIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
    </svg>
  );
}

// Round mic toggle. `label` shows next to the icon when given; otherwise
// it's icon-only and `aria-label` names it.
export function MicButton({
  listening,
  label,
  className = "",
  ...props
}: { listening: boolean; label?: string } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={listening}
      className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border text-sm transition-colors disabled:opacity-60 ${
        label ? "px-4" : "w-11"
      } ${
        listening
          ? "border-accent bg-accent/15 text-accent"
          : "border-accent-line bg-accent-wash text-accent-soft hover:border-accent/60"
      } ${className}`}
      {...props}
    >
      {listening ? (
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
      ) : (
        <MicIcon />
      )}
      {label && (listening ? "Stop" : label)}
    </button>
  );
}
