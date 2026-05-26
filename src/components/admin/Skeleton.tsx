/**
 * Shimmer primitives for the admin loading.tsx files.
 *
 * The admin pages are `force-dynamic` + cookie-auth gated, so every
 * tab click round-trips Prisma. On a cold pool that's 1–2s of dead
 * silence. These primitives let each route's `loading.tsx` stream
 * an instant skeleton that matches the real layout closely enough
 * that the swap to real content lands without a visible reflow.
 *
 * Design choices:
 *   • All shimmers gate on `motion-safe` so reduced-motion users
 *     see a static fill, the AI-console look isn't worth the
 *     vestibular cost.
 *   • Two-tone fill (cyan-tinted box with a brighter sweep) so the
 *     skeleton reads as "system is fetching", not "image broken".
 *   • Animation keyframe lives in globals.css (`admin-shimmer-sweep`)
 *     so we don't ship inline @keyframes per component.
 */

type LineProps = {
  /** Width as Tailwind class (e.g. "w-32", "w-1/2", "w-full"). Default w-full. */
  w?: string;
  /** Height as Tailwind class. Default h-3 (12px). */
  h?: string;
  /** Optional extra classes (margin, custom radius, etc.). */
  className?: string;
};

/** Single bar of skeleton text. Defaults to a 12px line, full width. */
export function SkeletonLine({ w = "w-full", h = "h-3", className = "" }: LineProps) {
  return (
    <div
      className={[
        "rounded-md admin-skeleton motion-safe:animate-pulse",
        w,
        h,
        className,
      ].join(" ")}
    />
  );
}

/** Bigger rounded block, for thumbnails, cards, map areas. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "rounded-2xl admin-skeleton motion-safe:animate-pulse",
        className,
      ].join(" ")}
    />
  );
}

/** Skeleton mock of a moderation-queue row card. Matches the real
 *  row's outer dimensions (rounded-2xl, padded, cyan-tinted) so the
 *  page doesn't reflow when actual rows mount. */
export function SkeletonRow({ withThumb = true }: { withThumb?: boolean }) {
  return (
    <div className="relative rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4 sm:p-5 overflow-hidden">
      <div className="flex gap-4">
        {withThumb ? (
          <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl admin-skeleton motion-safe:animate-pulse" />
        ) : null}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SkeletonLine w="w-2/5" h="h-4" />
            <SkeletonLine w="w-16" h="h-5" className="rounded-full" />
          </div>
          <SkeletonLine w="w-3/4" h="h-3" />
          <SkeletonLine w="w-1/2" h="h-3" />
          <div className="pt-2 flex items-center gap-2">
            <SkeletonLine w="w-20" h="h-7" className="rounded-full" />
            <SkeletonLine w="w-20" h="h-7" className="rounded-full" />
            <SkeletonLine w="w-9" h="h-7" className="rounded-full ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton header, eyebrow chip + big title line + subtitle.
 *  Optional right-side CTA cluster placeholder. */
export function SkeletonPageHeader({ withCta = false }: { withCta?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0 space-y-2">
        <SkeletonLine w="w-32" h="h-5" className="rounded-full" />
        <SkeletonLine w="w-72" h="h-9" />
        <SkeletonLine w="w-96" h="h-4" />
      </div>
      {withCta ? (
        <div className="flex items-center gap-2">
          <SkeletonLine w="w-28" h="h-9" className="rounded-full" />
          <SkeletonLine w="w-32" h="h-9" className="rounded-full" />
        </div>
      ) : null}
    </div>
  );
}

/** Filter-tab strip skeleton. */
export function SkeletonTabStrip({ tabCount = 4 }: { tabCount?: number }) {
  return (
    <div className="mb-5 flex items-center gap-3 flex-wrap">
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#0B0E16]/85 border border-cyan-400/15">
        {Array.from({ length: tabCount }).map((_, i) => (
          <SkeletonLine
            key={i}
            w={i === 0 ? "w-16" : i === 1 ? "w-20" : "w-24"}
            h="h-7"
            className="rounded-full"
          />
        ))}
      </div>
      <SkeletonLine w="w-64" h="h-9" className="rounded-full" />
    </div>
  );
}
