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
  // Matches the redesigned page: left-aligned hero, then the content.
  return (
    <main className="min-h-[70vh] bg-[#fbf7f0]" aria-busy="true">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-16">
        <div className="space-y-4 max-w-2xl">
          <div className="h-3 w-32 rounded-full bg-[#f5eac9] motion-safe:animate-pulse" />
          <div className="h-12 w-11/12 rounded-md bg-[#f5eac9] motion-safe:animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-[#f5efe3] motion-safe:animate-pulse" />
        </div>
        <div className="mt-10 rounded-[28px] bg-white/55 p-6 space-y-5" style={{ boxShadow: "inset 0 0 0 1px rgba(201,162,74,0.28)" }}>
          <div className="h-6 w-40 rounded bg-[#f5eac9] motion-safe:animate-pulse" />
          <div className="h-44 rounded-[20px] bg-[#f5efe3] motion-safe:animate-pulse" />
          <div className="h-6 w-52 rounded bg-[#f5eac9] motion-safe:animate-pulse" />
          <div className="h-[52px] rounded-[14px] bg-[#f5efe3] motion-safe:animate-pulse" />
        </div>
      </div>
    </main>
  );
}
