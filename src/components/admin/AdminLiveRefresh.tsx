"use client";

/**
 * Tiny auto-refresh helper for server-rendered admin pages.
 *
 * Fires `router.refresh()` on a fixed interval, which re-runs the
 * page's server component (re-fetching the Prisma query) and reconciles
 * the response into the client tree — no full reload, no scroll jump.
 * Per-row form state (open dropdowns, focus, scroll position) is
 * preserved by React's reconciler.
 *
 * Mount on any admin page where the operator expects new rows to
 * appear without manually F5-ing. Currently used on /admin/mentions
 * so PENDING mentions from /api/bot/message land in the queue within
 * the next refresh tick without operator action.
 *
 * The interval is short-ish (default 10s) because the moderation
 * loop's value is "see new message → approve → see it on homepage";
 * waiting longer than ~15s here makes the loop feel sluggish. Each
 * refresh is one Prisma query (under a few ms) so the cost is
 * negligible.
 *
 * Renders nothing visible — it's purely an effect.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLiveRefresh({
  intervalMs = 10_000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    // `router.refresh()` is intentionally fire-and-forget — Next.js
    // dedupes in-flight refreshes, so a tick that lands while the
    // previous fetch is still pending becomes a no-op rather than a
    // queued duplicate.
    const id = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, router]);
  return null;
}
