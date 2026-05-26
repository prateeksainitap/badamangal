"use client";

import { useLinkStatus } from "next/link";

/**
 * Tiny client-island spinner that surfaces in-flight navigation
 * feedback when its parent `<Link>` is pending.
 *
 * Why this exists:
 *   The public "Add a bhandara" and "Spot a bhandara" CTAs route to
 *   /list-bhandara and /spot, both ISR'd pages that take ~200ms on a
 *   warm cache but 1.7–3.3s on the cold path through the Supabase
 *   pooler. Without any pending feedback, a Lucknow visitor on a 4G
 *   connection taps the button, sees nothing for ~2 seconds, and
 *   starts tapping again, sometimes navigating mid-load and
 *   triggering a second uncached request. This spinner closes that
 *   feedback gap.
 *
 *   `useLinkStatus()` is the React 19 / Next 15 hook designed for
 *   exactly this. The component MUST be rendered inside a `<Link>`,
 *   that's how the hook resolves which link's pending state to read.
 *   The full-page `loading.tsx` skeleton still fires when the route
 *   transition starts, so this is the *first 100ms* indicator that
 *   bridges the click to the route-level loading state.
 *
 * Usage:
 *   <Link href="/list-bhandara" className="btn btn-primary">
 *     Add a bhandara
 *     <CtaPendingDot />
 *   </Link>
 */
export default function CtaPendingDot({
  className = "ml-2 inline-block h-3 w-3 rounded-full border-2 border-current/40 border-t-current motion-safe:animate-spin align-[-2px]",
}: {
  /** Optional override. Default sizes the spinner for a
   *  saffron-on-cream primary button at btn-sm. */
  className?: string;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span aria-hidden className={className} aria-label="Loading" />;
}
