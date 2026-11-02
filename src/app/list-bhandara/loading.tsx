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
  // Matches the redesigned page: left-aligned hero, then the content.
  return (
    <main className="min-h-[70vh] bg-[#fbf7f0]" aria-busy="true">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-16">
        <div className="space-y-4 max-w-2xl">
          <div className="h-3 w-32 rounded-full bg-[#f5eac9] motion-safe:animate-pulse" />
          <div className="h-12 w-11/12 rounded-md bg-[#f5eac9] motion-safe:animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-[#f5efe3] motion-safe:animate-pulse" />
        </div>
        <ul className="mt-10 border-t border-[rgba(201,162,74,0.38)]">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-4 py-6 border-b border-[rgba(201,162,74,0.38)]">
              <div className="w-14 h-14 rounded-full bg-[#f5eac9] motion-safe:animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-[#f5eac9] motion-safe:animate-pulse" />
                <div className="h-6 w-3/4 rounded bg-[#f5eac9] motion-safe:animate-pulse" />
                <div className="h-3 w-5/6 rounded bg-[#f5efe3] motion-safe:animate-pulse" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
