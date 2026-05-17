"use client";

/**
 * One-time visitor-counter bump.
 *
 * Posts to `/api/visit` once per mount, after first paint. Used to keep
 * the homepage HTML statically-cacheable (ISR) without losing the
 * "welcome, visitor #N" counter, the counter just bumps a beat after
 * paint instead of blocking SSR with a DB write.
 *
 * We guard with a session-scoped flag so a soft client-nav back to the
 * homepage within the same tab doesn't double-count. A fresh tab /
 * full reload counts as a new visit, which matches the human notion
 * of a "visit" better than a route-change in an SPA.
 */
import { useEffect } from "react";

const SESSION_KEY = "bm_visited";

export default function VisitorBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Storage may be blocked (private mode / strict cookie settings).
      // In that case we'll over-count slightly, better than under-counting.
    }

    // Use `keepalive` so the request survives even if the user navigates
    // away in the same tick. No await, the beacon is fire-and-forget.
    void fetch("/api/visit", {
      method: "POST",
      keepalive: true,
      cache: "no-store",
    }).catch(() => {
      /* network blip, counter just misses this tick, no UX impact */
    });
  }, []);

  return null;
}
