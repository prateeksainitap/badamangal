import AdminShell from "@/components/admin/AdminShell";
import {
  SkeletonBlock,
  SkeletonLine,
  SkeletonPageHeader,
} from "@/components/admin/Skeleton";

/**
 * Loading skeleton for /admin/discover, the "find bhandaras on
 * the web" tool. Header + search query bar + a 2-column results
 * grid placeholder. Renders inside AdminShell.
 */
export default function DiscoverLoading() {
  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto">
        <SkeletonPageHeader />
        {/* Search bar */}
        <div className="mb-6 rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4 space-y-3">
          <SkeletonLine w="w-32" h="h-3" />
          <SkeletonLine w="w-full" h="h-10" className="rounded-full" />
          <div className="flex gap-2">
            <SkeletonLine w="w-28" h="h-9" className="rounded-full" />
            <SkeletonLine w="w-24" h="h-9" className="rounded-full" />
          </div>
        </div>
        {/* Results grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <SkeletonBlock className="w-16 h-16" />
                <div className="flex-1 space-y-2">
                  <SkeletonLine w="w-3/4" h="h-5" />
                  <SkeletonLine w="w-1/2" h="h-3" />
                </div>
              </div>
              <SkeletonLine w="w-full" h="h-3" />
              <SkeletonLine w="w-5/6" h="h-3" />
              <div className="flex gap-2 pt-1">
                <SkeletonLine w="w-20" h="h-8" className="rounded-full" />
                <SkeletonLine w="w-20" h="h-8" className="rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
