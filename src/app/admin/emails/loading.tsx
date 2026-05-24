import AdminShell from "@/components/admin/AdminShell";
import { SkeletonBlock, SkeletonLine } from "@/components/admin/Skeleton";

/** Loading skeleton for the two-pane /admin/emails inbox. Mirrors
 *  the real layout (header + tab strip + list pane + reader pane)
 *  so the Suspense swap is reflow-free. */
export default function EmailsLoading() {
  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0 space-y-2">
            <SkeletonLine w="w-20" h="h-5" className="rounded-full" />
            <SkeletonLine w="w-64" h="h-8" />
            <SkeletonLine w="w-40" h="h-3" />
          </div>
          <SkeletonLine w="w-32" h="h-9" className="rounded-lg" />
        </div>

        {/* Tab strip */}
        <div className="mb-5 inline-flex items-center gap-1 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 p-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLine
              key={i}
              w="w-16"
              h="h-7"
              className="rounded-full"
            />
          ))}
        </div>

        {/* Two-pane shell */}
        <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm overflow-hidden lg:grid lg:grid-cols-12 lg:divide-x lg:divide-cyan-400/[0.10] h-[calc(100dvh-16rem)] min-h-[34rem]">
          {/* List pane */}
          <aside className="lg:col-span-4 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-cyan-400/[0.10] space-y-1.5">
              <SkeletonLine w="w-16" h="h-3" />
              <SkeletonLine w="w-24" h="h-3" />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-cyan-400/[0.06]">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-3.5 py-3 flex items-start gap-3">
                  <SkeletonBlock className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <SkeletonLine w="w-24" h="h-3" />
                      <SkeletonLine
                        w="w-6"
                        h="h-3"
                        className="ml-auto"
                      />
                    </div>
                    <SkeletonLine w="w-3/4" h="h-3" />
                    <SkeletonLine w="w-full" h="h-2.5" />
                  </div>
                </div>
              ))}
            </div>
          </aside>
          {/* Reader pane */}
          <section className="hidden lg:flex lg:col-span-8 flex-col min-h-0 bg-[#080A10]/40 p-4">
            <SkeletonBlock className="flex-1 rounded-2xl" />
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
