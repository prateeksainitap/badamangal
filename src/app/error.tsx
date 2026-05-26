"use client";

/**
 * Segment-level error boundary for every public route under /.
 *
 * Why this file (and not just global-error.tsx):
 *
 *   - `global-error.tsx` is the LAST line of defence — it catches
 *     anything that escapes every nested boundary, INCLUDING errors
 *     thrown by `layout.tsx` itself. It renders its own <html><body>
 *     and replaces the entire page chrome.
 *
 *   - `error.tsx` (this file) lives in the public segment so a thrown
 *     error during page rendering (a child component crashing on bad
 *     data, a transient SSR-time fetch failure that escapes our
 *     Promise.allSettled net, a stale ISR cache after schema drift)
 *     is caught BEFORE it bubbles up to the global boundary. The
 *     surface is calmer (it keeps the brand layout intact), and we
 *     can auto-retry on mount so a transient blip self-heals without
 *     the visitor noticing.
 *
 *   - We do NOT auto-retry inside global-error.tsx because by then
 *     something deep is broken; reloading in a loop would be hostile.
 *     Here, one immediate `reset()` is appropriate: most homepage
 *     errors at this layer are transient (Supabase pooler recycle
 *     during a Vercel deploy swap, momentary cold-start saturation)
 *     and self-clear within milliseconds.
 *
 * Behaviour:
 *
 *   1. On mount, fire `reset()` once (after a 50 ms tick so React
 *      finishes painting the fallback — otherwise we throw an
 *      "error during render" loop). If the underlying issue was
 *      transient, the page re-renders cleanly and the visitor sees
 *      a single ~200 ms blink, not an error screen.
 *
 *   2. If the auto-retry also throws, React keeps us on this
 *      boundary and the user sees the cream/saffron fallback with a
 *      manual "Try again" button. They can also navigate back home,
 *      reload, or hit any other link in the surrounding chrome
 *      (which is still mounted because this is a segment boundary).
 *
 *   3. The error digest is exposed in a muted footer line so support
 *      reports include a real reference for ops to grep against
 *      Vercel function logs.
 *
 * Reference for ops:
 *   The corresponding `error.digest` is logged server-side by
 *   Next.js automatically whenever this boundary fires. Cross-
 *   reference with the [homepage] error lines emitted by
 *   page.tsx's Promise.allSettled unwrap helpers when triaging.
 */

import { useEffect, useRef } from "react";

export default function PublicSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Fire reset() exactly once on mount. Subsequent renders are
  // either the recovered page (we're unmounted) or a second crash
  // (we want to show the manual UI, not loop). The ref makes the
  // guard survive React 18 double-mount in dev.
  const retriedRef = useRef(false);
  useEffect(() => {
    if (retriedRef.current) return;
    retriedRef.current = true;
    // 50 ms breathing room lets React finish flushing this boundary
    // before we ask it to re-render the segment. Without the tick,
    // a synchronous reset() can throw "error during render".
    const t = window.setTimeout(() => {
      try {
        reset();
      } catch {
        // reset() throwing means the boundary cannot recover; we'll
        // fall through to the visible fallback below and the user
        // gets the manual retry button.
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [reset]);

  return (
    <main
      className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center"
      aria-live="polite"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-saffron-600">
        🪔 One moment
      </p>
      <h1 className="mt-3 font-fraunces text-2xl text-sindoor-700 sm:text-3xl">
        Reloading this page…
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        We had a brief hiccup loading the latest data. If this card stays
        visible after a second, tap Try again or head back to the home
        page.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="btn btn-sindoor btn-sm"
          data-ga="public_error_try_again"
        >
          Try again
        </button>
        <a
          href="/"
          className="btn btn-ghost btn-sm"
          data-ga="public_error_back_home"
        >
          ← Back home
        </a>
      </div>
      {error?.digest ? (
        <p className="mt-6 font-mono text-[10px] tracking-wide text-ink-600/60">
          Reference: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
