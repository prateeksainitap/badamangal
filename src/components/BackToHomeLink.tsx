"use client";

import Link from "next/link";
import { useRef } from "react";

type Props = {
  /** Fallback URL when there's no in-app history to go back to. */
  fallbackHref: string;
  label: string;
  className?: string;
};

/**
 * "Back to all bhandaras" link used on bhandara detail pages.
 *
 * Behaviour:
 *   • If the user arrived from another page on this site (referrer
 *     matches current origin AND there's at least one history entry),
 *     calls `history.back()` so the browser restores their scroll
 *     position, they land back on the exact map pin / card row they
 *     clicked from.
 *   • Otherwise (deep link, fresh tab, social share), falls through
 *     to a normal client-side navigation to `fallbackHref`
 *     (typically the homepage `#map` anchor).
 */
export default function BackToHomeLink({
  fallbackHref,
  label,
  className,
}: Props) {
  const guard = useRef(false);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Prevent double-fire if the user double-taps.
    if (guard.current) return;
    if (typeof window === "undefined") return;

    // Modifier keys / non-primary clicks: let the browser handle it
    // (open in new tab, etc.) using the fallback href.
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }

    const sameOrigin =
      typeof document !== "undefined" &&
      document.referrer &&
      (() => {
        try {
          return new URL(document.referrer).origin === window.location.origin;
        } catch {
          return false;
        }
      })();

    // history.length > 1 doesn't always mean there's an in-app entry,
    // but combined with a same-origin referrer it's a reliable proxy
    // for "the user clicked here from somewhere on this site".
    if (sameOrigin && window.history.length > 1) {
      e.preventDefault();
      guard.current = true;
      window.history.back();
    }
    // else: fall through, Next's <Link> will navigate to fallbackHref.
  };

  return (
    <Link href={fallbackHref} onClick={handleClick} className={className}>
      <span aria-hidden>←</span> {label}
    </Link>
  );
}
