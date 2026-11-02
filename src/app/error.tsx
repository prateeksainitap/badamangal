"use client";

import { useLocaleFromContext } from "@/lib/locale-context";
import { Actions, Button, Heading, InnerShell, Kicker } from "@/components/v2";

/**
 * Segment-level error boundary for every public route under /.
 *
 * Why this file (and not just global-error.tsx):
 *
 *   - `global-error.tsx` is the LAST line of defence, it catches
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
 *   1. Render the calm fallback IMMEDIATELY with a manual "Try
 *      again" button. We deliberately do NOT auto-fire `reset()` on
 *      mount: a previous build did, expecting the underlying error
 *      to be transient, but a PERSISTENT SSR error puts the page
 *      into an infinite re-render storm, each reset triggers a new
 *      render that throws, which mounts this boundary fresh, which
 *      auto-resets again, etc. Real production incident on
 *      2026-05-26 hit ~1000 retries in a few seconds with the error
 *      counter climbing in real time. Manual retry only.
 *
 *   2. If the visitor taps "Try again" and it works, great. If it
 *      doesn't, they get the same screen + can navigate elsewhere
 *      (the surrounding chrome is still mounted because this is a
 *      segment boundary, not the global one).
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

export default function PublicSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // NO auto-reset. A previous build of this file fired reset() once
  // on mount expecting transient errors to self-heal, but a
  // persistent SSR error produces an infinite re-render storm
  // (each reset re-renders the page, SSR throws, the boundary
  // remounts, auto-reset fires again, a loop). Real prod incident
  // saw ~1000 retries in seconds with the GA error counter climbing.
  // Manual retry only.
  const isHi = useLocaleFromContext() === "hi";
  return (
    <InnerShell>
      <section className="bmi-sec bmi-lost err" aria-live="polite">
        <div className="bmi-wrap narrow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="bmi-lost-art"
            src="/illustrations/error-diya.webp"
            alt=""
            width={1200}
            height={1200}
            loading="eager"
            decoding="async"
          />
          <Kicker>{isHi ? "एक पल" : "One moment"}</Kicker>
          <Heading
            as="h1"
            size="section"
            words={false}
            en="Something hiccuped on our end."
            hi="हमारी तरफ़ कुछ अटक गया।"
          />
          <p className="bmi-lede">
            {isHi
              ? "ताज़ा जानकारी लोड नहीं हो पाई। फिर से कोशिश करें, या होम पेज पर लौटें।"
              : "We couldn't load the latest data. Tap Try again, or head back to the home page."}
          </p>
          <Actions split>
            <Button onClick={() => reset()} data-ga="public_error_try_again">
              {isHi ? "फिर से कोशिश करें" : "Try again"}
            </Button>
            <Button variant="secondary" href={isHi ? "/" : "/?lang=en"} data-ga="public_error_back_home">
              {isHi ? "होम पर लौटें" : "Back home"}
            </Button>
          </Actions>
          {error?.digest ? (
            <p className="bmi-ref">
              {isHi ? "संदर्भ: " : "Reference: "}
              {error.digest}
            </p>
          ) : null}
        </div>
      </section>
    </InnerShell>
  );
}
