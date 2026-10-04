"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const DISMISSED_KEY = "install-hint-dismissed";

function wasDismissed() {
  try {
    return !!localStorage.getItem(DISMISSED_KEY);
  } catch {
    return false; // Storage blocked (private window): just show the hint.
  }
}

// True on an iPhone/iPad browser tab that hasn't been installed or dismissed.
// Read through useSyncExternalStore so the server render (false) and the
// first client render agree.
function showIosSteps() {
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isIos =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return isIos && !installed && !wasDismissed();
}

const subscribeNothing = () => () => {};

// Nudges the user to install the app: a button where the browser offers a
// real install prompt (Android / desktop Chrome), or the Share → Add to Home
// Screen steps on iPhone. Hidden once installed or dismissed.
export function InstallHint() {
  const iosSteps = useSyncExternalStore(
    subscribeNothing,
    showIosSteps,
    () => false
  );
  const [promptReady, setPromptReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const promptEvent = useRef<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (wasDismissed()) return;
      promptEvent.current = e as InstallPromptEvent;
      setPromptReady(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const mode = dismissed
    ? "none"
    : promptReady
      ? "prompt"
      : iosSteps
        ? "ios"
        : "none";
  if (mode === "none") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Not persisted; it will show again next visit.
    }
    setDismissed(true);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-sm text-ink-muted">
      <span>
        {mode === "ios"
          ? "Install this app: tap the Share button, then “Add to Home Screen”."
          : "Install this app for quick, full-screen access."}
      </span>
      <div className="flex items-center gap-3">
        {mode === "prompt" && (
          <button
            type="button"
            onClick={async () => {
              await promptEvent.current?.prompt();
              dismiss();
            }}
            className="rounded-full bg-button px-3.5 py-1.5 text-[13px] font-semibold text-accent-ink"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="py-1 underline-offset-2 hover:text-ink hover:underline"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
