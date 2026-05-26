import AdminShell from "@/components/admin/AdminShell";
import { SkeletonBlock, SkeletonLine } from "@/components/admin/Skeleton";

/**
 * Loading skeleton for /admin/content, mirrors the structure of
 * the real page (hero band, header, tab strip, list of cards) so
 * the swap is reflow-free.
 */
export default function ContentLoading() {
  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto">
        <div className="mb-5 rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-[#0B0E16] via-[#0A0C13] to-[#080A10] h-24 sm:h-28 md:h-32 lg:h-36 overflow-hidden" />
        <div className="mb-7 flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0 space-y-2">
            <SkeletonLine w="w-44" h="h-5" className="rounded-full" />
            <SkeletonLine w="w-72" h="h-10" />
            <SkeletonLine w="w-96" h="h-4" />
          </div>
          <SkeletonLine w="w-32" h="h-9" className="rounded-lg" />
        </div>
        {/* Tab strip */}
        <div className="mb-6 inline-flex items-center gap-1 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 p-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLine
              key={i}
              w="w-20"
              h="h-7"
              className="rounded-full"
            />
          ))}
        </div>
        <div className="mb-5 flex items-center gap-3">
          <SkeletonLine w="w-32" h="h-6" />
          <SkeletonLine w="w-48" h="h-3" />
        </div>
        {/* Filter chips */}
        <div className="mb-5 space-y-2">
          <div className="flex items-center gap-1.5">
            <SkeletonLine w="w-20" h="h-3" />
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLine key={i} w="w-16" h="h-6" className="rounded-md" />
            ))}
          </div>
        </div>
        {/* Card list */}
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-5 space-y-3"
            >
              <div className="flex items-center gap-1.5">
                <SkeletonLine w="w-16" h="h-5" className="rounded-md" />
                <SkeletonLine w="w-20" h="h-5" className="rounded-md" />
                <SkeletonLine w="w-16" h="h-5" className="rounded-md" />
              </div>
              <SkeletonLine w="w-3/4" h="h-6" />
              <SkeletonLine w="w-1/2" h="h-4" />
              <SkeletonBlock className="h-24 rounded-lg" />
              <div className="flex items-center gap-2">
                <SkeletonLine w="w-20" h="h-7" className="rounded-lg" />
                <SkeletonLine w="w-24" h="h-7" className="rounded-lg" />
                <SkeletonLine w="w-20" h="h-7" className="rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
