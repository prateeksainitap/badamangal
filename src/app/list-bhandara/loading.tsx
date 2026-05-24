/**
 * Skeleton shown the instant a visitor clicks an "Add a bhandara" CTA.
 *
 * Why this file exists:
 *   /list-bhandara is ISR'd with a 5-minute revalidate window and shares
 *   the build-time bhandara cache via `getAllApprovedBhandaras`, so a
 *   warm cache returns in ~200ms. The cold-start path through the
 *   Supabase pooler + the React Server Components render takes up to
 *   3 seconds though, and without this file the visitor sees the old
 *   page sitting frozen with no feedback after their click. Next's
 *   App Router renders this Suspense fallback immediately when the
 *   route is loading, so even on the cold path the screen swaps to
 *   "something is happening" within microseconds.
 *
 * Visual design: a paper-cream card that matches AddBhandaraSwitcher's
 * three-choice chooser. Two big pulsing role cards (Organizer / Spotter)
 * plus a smaller scanner card so the swap to the real chooser is
 * reflow-free.
 */
export default function ListBhandaraLoading() {
  return (
    <main className="min-h-[70vh] bg-cream-50 px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-3xl">
        {/* Eyebrow + heading skeleton */}
        <div className="text-center space-y-3 mb-10">
          <div className="mx-auto h-3 w-32 rounded-full bg-saffron-200/60 motion-safe:animate-pulse" />
          <div className="mx-auto h-9 w-3/4 rounded-md bg-gold-200/60 motion-safe:animate-pulse" />
          <div className="mx-auto h-4 w-5/6 rounded bg-gold-100/70 motion-safe:animate-pulse" />
        </div>

        {/* Two big role cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-3xl border border-gold-500/40 bg-cream-50 p-6 shadow-warm"
            >
              <div className="w-14 h-14 rounded-2xl bg-saffron-200/60 motion-safe:animate-pulse" />
              <div className="mt-5 h-5 w-32 rounded bg-gold-200/60 motion-safe:animate-pulse" />
              <div className="mt-3 space-y-1.5">
                <div className="h-3 w-full rounded bg-gold-100/70 motion-safe:animate-pulse" />
                <div className="h-3 w-5/6 rounded bg-gold-100/70 motion-safe:animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-gold-100/70 motion-safe:animate-pulse" />
              </div>
              <div className="mt-6 h-10 w-32 rounded-full bg-saffron-300/60 motion-safe:animate-pulse" />
            </div>
          ))}
        </div>

        {/* "Or, AI Scanner" pill underneath */}
        <div className="mt-6 mx-auto max-w-md rounded-2xl border border-gold-500/30 bg-saffron-50/40 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-saffron-200/60 motion-safe:animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-44 rounded bg-gold-200/60 motion-safe:animate-pulse" />
              <div className="h-3 w-32 rounded bg-gold-100/70 motion-safe:animate-pulse" />
            </div>
          </div>
        </div>

        {/* Subtle wording so the visitor knows the wait is meaningful, not broken */}
        <p className="mt-8 text-center text-xs text-ink-700/60 italic">
          Loading bhandara form...
        </p>
      </div>
    </main>
  );
}
