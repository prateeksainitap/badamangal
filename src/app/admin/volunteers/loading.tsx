import AdminShell from "@/components/admin/AdminShell";
import {
  SkeletonBlock,
  SkeletonLine,
  SkeletonPageHeader,
} from "@/components/admin/Skeleton";

/**
 * Loading skeleton for /admin/volunteers. Mirrors the three-section
 * layout: pending applications card, optional weekly payout panel,
 * and the active volunteers list. Renders inside AdminShell.
 */
export default function VolunteersLoading() {
  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto">
        <SkeletonPageHeader withCta />

        {/* Active registry section */}
        <SkeletonLine w="w-40" h="h-5" className="mb-3" />
        <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-5 mb-6 space-y-4">
          {/* Volunteer row */}
          <div className="flex items-center gap-3 flex-wrap pb-4 border-b border-cyan-400/[0.08]">
            <SkeletonBlock className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <SkeletonLine w="w-32" h="h-4" />
              <SkeletonLine w="w-48" h="h-3" />
            </div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonLine
                  key={i}
                  w={i === 0 ? "w-16" : "w-12"}
                  h="h-6"
                  className="rounded-full"
                />
              ))}
            </div>
          </div>
          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-cyan-400/15 bg-[#080A10]/55 p-3 space-y-1.5"
              >
                <SkeletonLine w="w-14" h="h-3" />
                <SkeletonLine w="w-10" h="h-7" />
              </div>
            ))}
          </div>
        </div>

        {/* Other volunteer cards */}
        <SkeletonLine w="w-32" h="h-5" className="mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4 flex items-center gap-3"
            >
              <SkeletonBlock className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <SkeletonLine w="w-1/3" h="h-4" />
                <SkeletonLine w="w-1/2" h="h-3" />
              </div>
              <SkeletonLine w="w-16" h="h-7" className="rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
