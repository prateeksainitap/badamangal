import AdminShell from "@/components/admin/AdminShell";
import { SkeletonLine, SkeletonBlock } from "@/components/admin/Skeleton";
import ContentTabSkeleton from "./ContentTabSkeleton";

/**
 * Loading skeleton for /admin/content. Mirrors the new layout -
 * brand row, Mission Strip (countdown eyebrow + four status tiles
 * + CTA), tab strip, then the tab body skeleton - so the swap to
 * real content lands without a reflow.
 *
 * Fires when the operator lands cold on /admin/content. Tab-to-tab
 * navigation uses the per-tab <Suspense> in page.tsx instead so
 * the chrome stays mounted while only the body re-skeletons.
 */
export default function ContentLoading() {
  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto">
        {/* Top brand row */}
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <SkeletonBlock className="w-8 h-8 rounded-lg" />
            <SkeletonLine w="w-32" h="h-6" />
          </div>
          <SkeletonLine w="w-28" h="h-7" className="rounded-lg" />
        </div>

        {/* Mission Strip skeleton */}
        <section className="mb-6">
          {/* Eyebrow + countdown */}
          <div className="flex items-center gap-2 mb-3">
            <SkeletonLine w="w-20" h="h-3" />
            <SkeletonLine w="w-56" h="h-3" />
          </div>
          {/* Four status tiles + CTA */}
          <div className="grid grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-2.5 sm:gap-3 items-stretch">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="relative rounded-xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm px-3.5 py-3 space-y-2"
              >
                <SkeletonLine w="w-20" h="h-3" />
                <SkeletonLine w="w-12" h="h-7" />
                <SkeletonLine w="w-24" h="h-3" />
              </div>
            ))}
            <SkeletonBlock className="col-span-2 lg:col-span-1 h-[68px] rounded-xl" />
          </div>
        </section>

        {/* Tab strip */}
        <div className="mb-6 inline-flex items-center gap-1 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 p-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLine
              key={i}
              w={i === 0 ? "w-20" : i === 1 ? "w-24" : i === 2 ? "w-20" : "w-18"}
              h="h-7"
              className="rounded-full"
            />
          ))}
        </div>

        {/* Tab body skeleton - same one each tab uses during nav.
            Keeps the cold-land / tab-nav experience consistent. */}
        <ContentTabSkeleton />
      </div>
    </AdminShell>
  );
}
