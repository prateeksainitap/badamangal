"use client";

import { useLinkStatus } from "next/link";

/**
 * Per-tab pending indicator for the analytics feature tab strip.
 *
 * Renders nothing while idle; flips to an inline spinning circle
 * the moment the parent <Link> starts navigating (Next 15.3+'s
 * useLinkStatus reports per-link in-flight state). Lets the
 * operator know a tab click registered, even on a cold-pool
 * tab that takes ~500-1000 ms to land.
 *
 * Used INSIDE each <Link> child in /admin/analytics/page.tsx —
 * the hook gives the pending status of the nearest ancestor Link.
 */
export default function TabPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
      className="motion-safe:animate-spin -mr-0.5"
    >
      <path d="M12 3 a9 9 0 1 1 -9 9" />
    </svg>
  );
}
