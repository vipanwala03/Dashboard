"use client";

import { useEffect } from "react";

// Registers public/sw.js (the offline page only). Skipped in dev so a stale
// worker never hides code changes.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => console.error("Service worker failed:", err));
  }, []);
  return null;
}
