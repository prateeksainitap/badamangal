import AdminShell from "@/components/admin/AdminShell";
import AdminPageHero from "@/components/admin/AdminPageHero";

/**
 * Skeleton shown while /admin/analytics is fetching its dozen Prisma
 * groupBy queries. Renders the same outer chrome (AdminShell + hero)
 * so the page swap is reflow-free, then paints muted boxes where the
 * KPI strip + funnel + table sections will land.
 */
export default function AnalyticsLoading() {
  return (
    <AdminShell navCounts={{
      bhandaras: 0, spots: 0, mentions: 0, organise: 0,
      volunteers: 0, scan: 0, gallery: 0, content: 0, emails: 0,
      botLog: 0,
    }}>
      <AdminPageHero
        subject="dashboard"
        eyebrow="Operator analytics"
        title="What's happening on the site"
        subtitle="Loading live numbers from the database..."
      />
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4"
          >
            <div className="h-3 w-24 rounded admin-skeleton motion-safe:animate-pulse" />
            <div className="mt-3 h-8 w-20 rounded admin-skeleton motion-safe:animate-pulse" />
            <div className="mt-2 h-3 w-32 rounded admin-skeleton motion-safe:animate-pulse" />
          </div>
        ))}
      </section>
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 space-y-3"
          >
            <div className="h-4 w-48 rounded admin-skeleton motion-safe:animate-pulse" />
            <div className="h-3 w-72 rounded admin-skeleton motion-safe:animate-pulse" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-32 rounded admin-skeleton motion-safe:animate-pulse" />
                  <div className="h-3 w-10 rounded admin-skeleton motion-safe:animate-pulse" />
                </div>
                <div className="h-2 w-full rounded admin-skeleton motion-safe:animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
