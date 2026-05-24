"use client";

import { useLinkStatus } from "next/link";

/**
 * Drop-in client components that surface in-flight navigation
 * feedback when a sibling/parent <Link> is pending.
 *
 * Why this exists:
 *   Admin queue pages are `force-dynamic` and do a fresh server
 *   render + nav-counts fan-out on every click of a source filter
 *   or status tab. With pgbouncer + retry middleware that's typically
 *   200–500ms, but during that window the OLD page stays on screen
 *   with no visual indication the click registered. The operator
 *   clicks twice, third time presses Enter, etc.
 *
 *   `useLinkStatus()` is the React 19 / Next 15 hook designed for
 *   exactly this: a component that renders inside a <Link> can read
 *   `{ pending: boolean }` for that link's navigation state. We use
 *   it to:
 *     • LinkPendingBadge — replace a tab's count badge with a small
 *       spinner while the navigation is in flight. Most common case.
 *     • LinkPendingOverlay — render a subtle pulsing overlay anywhere
 *       inside a Link (used by KpiStrip tiles where the count is
 *       the focal point and shouldn't be hidden).
 *
 * Both components are tiny client islands — only the indicator
 * re-renders on pending state change, the parent server-rendered
 * tab stays as-is.
 */

/** Shown inside a Link's count chip. When pending, replaces the
 *  numeric count with a same-size spinner so the tab visibly says
 *  "I'm working on it". Falls through to the count when idle. */
export function LinkPendingBadge({
  count,
  className,
}: {
  count: number;
  className: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span className={className} aria-live="polite">
      {pending ? (
        <span
          aria-hidden
          aria-label="Loading"
          className="inline-block h-2.5 w-2.5 motion-safe:animate-spin rounded-full border-2 border-current/40 border-t-current"
        />
      ) : (
        count
      )}
    </span>
  );
}

/** Renders an absolutely-positioned subtle pulse overlay when the
 *  containing Link is pending. Used by KpiStrip where the count is
 *  the tile's main content and we don't want to replace it. The
 *  parent must be `position: relative` for the overlay to attach. */
export function LinkPendingOverlay() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-2xl bg-cyan-400/[0.06] motion-safe:animate-pulse"
    />
  );
}
