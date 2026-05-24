/**
 * Skeleton shown the instant a visitor taps "Spot a bhandara".
 *
 * Mirrors the structure of /spot's real page (hero band + quick form
 * card) so the swap to the loaded page is reflow-free. Renders the
 * moment the route starts loading via Next's App Router Suspense
 * boundary, eliminating the "tapped a dead button" feel on the
 * cold-start path.
 */
export default function SpotLoading() {
  return (
    <main className="min-h-[70vh] bg-cream-50">
      {/* Hero band */}
      <section className="relative bg-gradient-to-br from-saffron-50 via-cream-50 to-cream-50 px-4 sm:px-6 py-10 border-b border-gold-500/30">
        <div className="mx-auto max-w-2xl text-center space-y-3">
          <div className="mx-auto h-3 w-28 rounded-full bg-saffron-200/60 motion-safe:animate-pulse" />
          <div className="mx-auto h-9 w-3/4 rounded-md bg-gold-200/60 motion-safe:animate-pulse" />
          <div className="mx-auto h-4 w-5/6 rounded bg-gold-100/70 motion-safe:animate-pulse" />
        </div>
      </section>

      {/* Quick form card */}
      <section className="px-4 sm:px-6 py-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-gold-500/40 bg-cream-50 p-6 shadow-warm space-y-5">
          {/* Photo upload area */}
          <div className="rounded-2xl border-2 border-dashed border-gold-500/40 bg-saffron-50/30 h-44 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="mx-auto w-10 h-10 rounded-xl bg-saffron-200/60 motion-safe:animate-pulse" />
              <div className="mx-auto h-3 w-32 rounded bg-gold-200/60 motion-safe:animate-pulse" />
            </div>
          </div>

          {/* Caption field */}
          <div className="space-y-1.5">
            <div className="h-3 w-20 rounded bg-gold-200/60 motion-safe:animate-pulse" />
            <div className="h-11 w-full rounded-lg bg-cream-100/80 motion-safe:animate-pulse" />
          </div>

          {/* Location field */}
          <div className="space-y-1.5">
            <div className="h-3 w-24 rounded bg-gold-200/60 motion-safe:animate-pulse" />
            <div className="h-11 w-full rounded-lg bg-cream-100/80 motion-safe:animate-pulse" />
          </div>

          {/* Submit button */}
          <div className="h-12 w-full rounded-full bg-saffron-300/60 motion-safe:animate-pulse" />
        </div>

        <p className="mt-6 text-center text-xs text-ink-700/60 italic">
          Loading spot form...
        </p>
      </section>
    </main>
  );
}
