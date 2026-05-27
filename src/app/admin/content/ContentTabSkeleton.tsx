import { SkeletonLine, SkeletonBlock } from "@/components/admin/Skeleton";

/**
 * Skeleton fallback for any Content Hub tab body
 * (Pitches / Templates / Strategy / Prompts / Images). Wrapped by
 * the per-tab `<Suspense>` boundary in page.tsx so the chrome
 * (Mission Strip + tab pills + filters) stays mounted while only
 * the tab body shows a loading state during navigation.
 *
 * Shape mirrors the real ContentCard layout (audience stripe,
 * kind/meta row, title, body preview, action strip) so the swap
 * to real content lands without a visible reflow.
 *
 * Default is 3 card skeletons; the most-common tab (Pitches) shows
 * 5-10 cards in practice but 3 placeholders is plenty to fill the
 * fold and signal "loading", without over-promising volume.
 */
export default function ContentTabSkeleton({
  rows = 3,
}: {
  rows?: number;
}) {
  return (
    <div className="space-y-4">
      {/* FilterBar skeleton, two rows of chips + a search input.
          Sits where the real FilterBar will render so the row
          doesn't jump when real chips appear. */}
      <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <SkeletonLine w="w-14" h="h-3" />
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLine
              key={i}
              w={i === 0 ? "w-10" : i === 1 ? "w-20" : "w-16"}
              h="h-6"
              className="rounded-md"
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <SkeletonLine w="w-16" h="h-3" />
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLine
              key={i}
              w={i === 0 ? "w-14" : "w-20"}
              h="h-6"
              className="rounded-md"
            />
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SkeletonLine w="w-20" h="h-7" className="rounded-md" />
          <SkeletonLine w="w-56 flex-1" h="h-7" className="rounded-md" />
          <SkeletonLine w="w-16" h="h-7" className="rounded-md" />
        </div>
      </div>

      {/* "+ Draft new" trigger row — slim button placeholder. */}
      <div>
        <SkeletonLine w="w-32" h="h-9" className="rounded-lg" />
      </div>

      {/* Card list. Each placeholder mirrors a ContentCard:
            • audience stripe on the left (rendered via the rounded
              container itself, not a separate element)
            • kind icon disc + meta row at top
            • title (large)
            • body preview (3 lines)
            • action strip at bottom */}
      <div className="grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4 sm:p-5 overflow-hidden"
          >
            <div className="flex items-start gap-3">
              {/* Kind icon disc */}
              <SkeletonBlock className="shrink-0 w-10 h-10 rounded-xl" />
              <div className="flex-1 min-w-0 space-y-2">
                {/* Meta pills row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <SkeletonLine w="w-12" h="h-4" className="rounded-md" />
                  <SkeletonLine w="w-20" h="h-4" className="rounded-md" />
                  <SkeletonLine w="w-16" h="h-4" className="rounded-md" />
                </div>
              </div>
              {/* Action cluster top-right */}
              <div className="shrink-0 flex items-center gap-1.5">
                <SkeletonLine w="w-16" h="h-7" className="rounded-lg" />
                <SkeletonLine w="w-8" h="h-7" className="rounded-lg" />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <SkeletonLine w="w-3/4" h="h-5" />
              <SkeletonLine w="w-full" h="h-3" />
              <SkeletonLine w="w-11/12" h="h-3" />
              <SkeletonLine w="w-2/3" h="h-3" />
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <SkeletonLine w="w-24" h="h-6" className="rounded-lg" />
              <SkeletonLine w="w-28" h="h-6" className="rounded-lg" />
              <SkeletonLine w="w-32" h="h-6" className="rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
