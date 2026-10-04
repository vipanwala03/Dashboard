// Shown by the service worker (public/sw.js) when a page can't be loaded
// because the device is offline. Deliberately static and signed-out safe.
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-ink-strong">
        You&apos;re offline
      </h1>
      <p className="max-w-xs text-sm text-ink-muted">
        The dashboard shows live calendar, task, and note data, so it needs a
        connection. Reconnect and try again.
      </p>
      <a
        href="/dashboard"
        className="rounded-full bg-button px-5 py-2.5 text-sm font-semibold text-accent-ink"
      >
        Try again
      </a>
    </main>
  );
}
