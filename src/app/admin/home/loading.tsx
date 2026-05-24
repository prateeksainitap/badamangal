import AdminShell from "@/components/admin/AdminShell";
import {
  SkeletonBlock,
  SkeletonLine,
} from "@/components/admin/Skeleton";

/**
 * Loading skeleton for /admin/home.
 *
 * Mirrors the dashboard's structure so the swap to real content
 * lands without a layout shift: terminal eyebrow + greeting line,
 * a filled-style quick-actions strip on top (matches page.tsx
 * which moved these to the first surface), five KPI tiles below,
 * then a 60/40 hero panel + activity stream. Renders inside
 * AdminShell so the sidebar + top bar stay populated while the
 * page fetches.
 */
export default function DashboardLoading() {
  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto">
        {/* Merged hero + greeting panel — the real page no longer
            stacks AdminPageHero above the greeting, it composes them
            side-by-side in a single cyan-bordered panel. The
            skeleton mirrors that shape so the swap is reflow-free. */}
        <div className="mb-6 rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-[#0B0E16] via-[#0A0C13] to-[#080A10] overflow-hidden">
          <div className="grid items-center gap-4 sm:gap-5 p-4 sm:p-5 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0 space-y-2">
              <SkeletonLine w="w-44" h="h-5" className="rounded-full" />
              <SkeletonLine w="w-72" h="h-8" />
              <SkeletonLine w="w-96" h="h-3" />
            </div>
            {/* Compact illustration placeholder — matches the trimmed
                AdminHeroArt slot dimensions. */}
            <div className="hidden sm:block w-40 md:w-52 lg:w-60 h-20 md:h-24 lg:h-28 rounded-2xl bg-cyan-400/[0.04]" />
          </div>
        </div>

        {/* Quick actions — filled-style skeleton tiles match the
            real strip's brightness so the first paint doesn't read
            as a darker placeholder. (The quick.actions divider that
            used to sit above this strip was removed from the real
            page; we skip it here too for parity.) */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-7">
          {[
            "bg-gradient-to-br from-cyan-500/85 via-cyan-500/75 to-violet-500/85",
            "bg-gradient-to-br from-violet-500/80 to-violet-600/85",
            "bg-gradient-to-br from-cyan-500/75 to-cyan-600/85",
            "bg-gradient-to-br from-leaf-600/85 to-leaf-600/95",
            "bg-gradient-to-br from-saffron-500/85 to-saffron-600/95",
            "bg-gradient-to-br from-sindoor-700 to-sindoor-700/85",
          ].map((surface, i) => (
            <div
              key={i}
              className={`rounded-2xl border border-cream-50/15 p-4 overflow-hidden ${surface}`}
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-11 h-11 rounded-xl bg-cream-50/15" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-24 rounded bg-cream-50/25" />
                  <div className="h-3 w-20 rounded bg-cream-50/15" />
                </div>
                <div className="shrink-0 w-6 h-6 rounded-md bg-cream-50/20" />
              </div>
            </div>
          ))}
        </div>

        {/* KPI tile row — 5 tiles. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-7">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="relative rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-5 overflow-hidden h-[140px]"
            >
              <div className="flex items-start justify-between mb-3">
                <SkeletonLine w="w-20" h="h-3" />
                <SkeletonBlock className="w-11 h-11" />
              </div>
              <SkeletonLine w="w-16" h="h-10" />
              <SkeletonLine w="w-24" h="h-3" className="mt-2" />
            </div>
          ))}
        </div>

        {/* Merged Live-chat panel — single bordered card with a
            shared header on top and two columns underneath (map ~60%,
            chronological stream ~40%) on lg, stacked below. */}
        <div className="mb-7 rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-[#0B0E16] to-[#0A0C13] overflow-hidden">
          {/* Shared header */}
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-3 flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-2">
              <SkeletonLine w="w-36" h="h-3" />
              <SkeletonLine w="w-32" h="h-7" />
              <SkeletonLine w="w-56" h="h-3" />
            </div>
            <SkeletonLine w="w-24" h="h-7" className="rounded-lg" />
          </div>

          {/* Body — map on left, stream on right at lg, stacked below. */}
          <div className="grid grid-cols-1 lg:grid-cols-5 lg:divide-x lg:divide-cyan-400/[0.10]">
            <div className="lg:col-span-3 relative">
              {/* Fixed-height map placeholder, matches AdminOlaMap's
                  h-[22rem] sm:h-[24rem] lg:h-[28rem]. */}
              <SkeletonBlock className="h-[22rem] sm:h-[24rem] lg:h-[28rem] rounded-none" />
              <div className="px-5 sm:px-6 pb-5 pt-3 grid grid-cols-3 gap-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-cyan-400/20 bg-[#0B0E16]/55 p-3 space-y-2"
                  >
                    <SkeletonLine w="w-16" h="h-3" />
                    <SkeletonLine w="w-12" h="h-6" />
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col min-h-[22rem]">
              <div className="px-5 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-2 border-b border-cyan-400/[0.08] lg:border-b-0">
                <SkeletonLine w="w-16" h="h-3" />
                <SkeletonLine w="w-16" h="h-3" />
              </div>
              <div className="p-3 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg"
                  >
                    <SkeletonBlock className="w-9 h-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <SkeletonLine w="w-3/4" h="h-3" />
                      <SkeletonLine w="w-1/2" h="h-2.5" />
                    </div>
                    <SkeletonLine w="w-10" h="h-5" className="rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </AdminShell>
  );
}
