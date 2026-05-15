/**
 * Loading skeleton for /admin routes.
 *
 * The admin pages are intentionally force-dynamic (cookie-based auth +
 * fresh moderation counts) so every tab click re-runs Prisma queries
 * end-to-end. On a cold Netlify Function that's 1–2 seconds of dead
 * silence between clicking and seeing anything. This file makes Next
 * stream a skeleton instantly while the real render finishes, so the
 * UI never feels frozen.
 *
 * Mirrors the actual admin layout (header band + tabs + card list) so
 * the transition from skeleton → real content is visually stable
 * (no layout shift). All shimmer animations are gated by motion-safe
 * so reduced-motion visitors get a static placeholder instead.
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-8 pb-4 bg-cream-50/92 backdrop-blur-md border-b border-gold-500/30">
        <header className="flex flex-wrap items-end justify-between gap-4 pb-4">
          <div>
            <div className="h-3 w-28 rounded bg-gold-500/30 motion-safe:animate-pulse" />
            <div className="h-8 w-56 mt-2 rounded bg-sindoor-700/15 motion-safe:animate-pulse" />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-6 w-32 rounded-full bg-leaf-600/10 motion-safe:animate-pulse" />
            <div className="h-9 w-36 rounded-full bg-saffron-600/20 motion-safe:animate-pulse" />
            <div className="h-9 w-28 rounded-full bg-saffron-600/30 motion-safe:animate-pulse" />
          </div>
        </header>

        {/* Search bar placeholder */}
        <div className="mt-5">
          <div className="h-10 w-full max-w-md rounded-full bg-cream-50 border border-gold-500/30 motion-safe:animate-pulse" />
        </div>

        {/* Tab strip placeholder */}
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-28 rounded-full bg-cream-50 border border-gold-500/30 motion-safe:animate-pulse"
            />
          ))}
        </nav>
      </div>

      {/* Card list placeholder — three rows, same height as a real
          bhandara row so the page doesn't reflow when content lands. */}
      <ul className="mt-5 grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="rounded-2xl border border-gold-500/40 bg-cream-50 p-5 sm:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl bg-saffron-50 motion-safe:animate-pulse shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-6 w-2/3 rounded bg-sindoor-700/15 motion-safe:animate-pulse" />
                <div className="h-5 w-1/2 rounded bg-ink-900/10 motion-safe:animate-pulse" />
                <div className="h-4 w-1/3 rounded bg-ink-600/15 motion-safe:animate-pulse" />
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <div className="h-3 w-20 rounded bg-gold-500/30 motion-safe:animate-pulse" />
                  <div className="h-4 w-3/4 rounded bg-ink-900/10 motion-safe:animate-pulse" />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
