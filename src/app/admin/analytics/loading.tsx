import AdminShell from "@/components/admin/AdminShell";
import { SkeletonLine } from "@/components/admin/Skeleton";

/**
 * Cold-land skeleton for /admin/analytics. Mirrors the new layout:
 * page header + weekly summary skeleton + all-time section skeleton.
 * Suspense boundaries inside page.tsx handle the per-section
 * fallbacks during a soft RSC navigation, but a cold load (direct
 * URL hit, first nav from a different surface) sees THIS as the
 * pre-render.
 */
export default function AnalyticsLoading() {
  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-2 min-w-0">
            <SkeletonLine w="w-40" h="h-3" />
            <SkeletonLine w="w-72" h="h-7" />
            <SkeletonLine w="w-96" h="h-3.5" />
          </div>
          <SkeletonLine w="w-28" h="h-7" className="rounded-lg" />
        </div>

        {/* Weekly summary skeleton */}
        <div className="mb-3">
          <SkeletonLine w="w-80" h="h-3" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-cream-50/10 bg-[#0B0E16]/85 px-3.5 py-3 admin-skeleton motion-safe:animate-pulse h-[88px]"
            />
          ))}
        </div>
        <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-48 admin-skeleton motion-safe:animate-pulse mb-4" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-44 admin-skeleton motion-safe:animate-pulse" />
          <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-44 admin-skeleton motion-safe:animate-pulse" />
        </div>

        {/* All-time section skeleton */}
        <div className="mt-10 space-y-3">
          <SkeletonLine w="w-32" h="h-5" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-56 admin-skeleton motion-safe:animate-pulse" />
            <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-56 admin-skeleton motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
