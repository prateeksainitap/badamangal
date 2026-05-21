"use client";

import { useEffect, useState } from "react";

/**
 * ScrollToTopButton
 *
 * A small floating icon button that appears when the visitor has
 * scrolled past ~800 px and snaps the page back to the top on click.
 *
 * Mobile-only by design (`lg:hidden`). The homepage is intentionally
 * long on mobile (hero → featured → countdown → map → live spots →
 * cards → resources → footer), and a one-tap return path beats
 * thumb-flinging back up. Desktop users have wheel + Home key, so
 * the button would just be visual noise there.
 *
 * Positioning: bottom-right, but `bottom-20` so it sits ABOVE the
 * SpotFloatingCta (which lives at `bottom-5`). Same `right-5` column
 * so the two FABs read as a vertical stack rather than a clutter.
 *
 * Show / hide is tied to a scroll listener with passive: true (cheap)
 * and a small threshold (800 px) — below the fold of any reasonable
 * mobile viewport, so the button doesn't appear immediately on first
 * paint.
 */
const SCROLL_THRESHOLD_PX = 800;

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      setVisible(y > SCROLL_THRESHOLD_PX);
    };
    // Set initial state in case the page loaded already-scrolled
    // (e.g. coming back via browser back to a remembered scroll pos)
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => {
        try {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {
          // Some older browsers reject the options object; fall back
          // to the bare jump-to-top.
          window.scrollTo(0, 0);
        }
      }}
      aria-label="Scroll to top"
      title="Scroll to top"
      className="lg:hidden fixed z-[900] bottom-20 right-5 inline-flex items-center justify-center w-11 h-11 rounded-full bg-cream-50 border border-saffron-500/50 text-saffron-600 shadow-warm hover:bg-saffron-50 hover:border-saffron-500 transition-colors"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}
