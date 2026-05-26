import AdminShell from "@/components/admin/AdminShell";
import {
  SkeletonLine,
  SkeletonRow,
  SkeletonTabStrip,
  SkeletonPageHeader,
} from "@/components/admin/Skeleton";

/**
 * Generic loading scaffold for the moderation-queue routes
 * (/admin/bhandaras, /admin/spots, /admin/mentions, /admin/organise).
 *
 * Renders the AdminShell scaffolding + the ModerationQueue chrome
 * shape (header, filter ribbon, summary line, row list) as
 * shimmer placeholders. Used by each queue's own `loading.tsx` so
 * the visual contract between skeleton and real page stays in one
 * file, change the skeleton here once and every queue picks it up.
 *
 * `rowCount` controls how many placeholder cards the skeleton paints
 * by default; queues with denser-than-usual lists (Mentions) pass a
 * higher number so the page doesn't visibly grow when content lands.
 * `withThumb` toggles the thumbnail block, true for Bhandaras +
 * Spots (where the row carries a photo), false for Mentions and
 * Organise (text-only rows).
 */
export default function QueueLoadingScaffold({
  rowCount = 5,
  withThumb = true,
  tabCount = 4,
  withCta = true,
}: {
  rowCount?: number;
  withThumb?: boolean;
  tabCount?: number;
  withCta?: boolean;
}) {
  return (
    <AdminShell>
      <div className="max-w-7xl mx-auto">
        <SkeletonPageHeader withCta={withCta} />
        <SkeletonTabStrip tabCount={tabCount} />
        <div className="mb-3">
          <SkeletonLine w="w-40" h="h-3" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: rowCount }).map((_, i) => (
            <SkeletonRow key={i} withThumb={withThumb} />
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
