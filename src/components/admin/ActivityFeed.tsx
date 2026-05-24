import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { stripBotProvenance } from "@/lib/sanitize";
import { istTodayIso } from "@/lib/dates";
import ActivityStream, {
  type ActivityEvent,
} from "@/components/admin/ActivityStream";

/** Format an "HH:MM" 24h string as "11:00 AM". Falls back to the raw
 *  string if it doesn't parse. Local to ActivityFeed because the rest
 *  of the codebase already does this inline in BhandaraRow, etc., and
 *  we don't want a shared helper just for two characters of "AM"/"PM". */
function formatTimeIst(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const mm = m[2];
  if (!Number.isFinite(h)) return hhmm;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${ampm}`;
}

/** Pick the most relevant date out of a JSON-encoded tuesdayDates
 *  array, formatted as "26 May". Preference order:
 *    1. the next upcoming date (>= today IST)
 *    2. the most recent past date (if all dates have passed)
 *    3. empty string if the column is empty / malformed
 *  ISO yyyy-mm-dd strings compare lexicographically === chronologically,
 *  so we can skip Date parsing for the comparison. */
function pickBhandaraDate(tuesdayDatesJson: string): string {
  let dates: string[] = [];
  try {
    const parsed = JSON.parse(tuesdayDatesJson);
    if (Array.isArray(parsed)) {
      dates = parsed
        .filter((d): d is string => typeof d === "string")
        .sort();
    }
  } catch {
    /* legacy / malformed rows */
  }
  if (dates.length === 0) return "";
  const today = istTodayIso();
  const upcoming = dates.find((d) => d >= today);
  const chosen = upcoming ?? dates[dates.length - 1];
  // "2026-05-26" → "26 May". Construct via UTC so the day component
  // is stable regardless of the server's local TZ.
  const parts = chosen.split("-");
  if (parts.length !== 3) return chosen;
  const day = parts[2].replace(/^0/, "");
  const monthIdx = Number(parts[1]) - 1;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  if (monthIdx < 0 || monthIdx > 11) return chosen;
  return `${day} ${months[monthIdx]}`;
}

/**
 * Async server component for the dashboard's recent-activity stream.
 *
 * Lifted out of /admin/home/page.tsx so it can stream independently
 * via a parent Suspense boundary. The four `findMany` queries this
 * runs are the slowest of the dashboard fan-out (each pulls 6 rows
 * with selects across joined tables), and previously blocked the
 * KPI + hero render. With Suspense streaming, the operator sees the
 * KPIs + live map instantly while this section paints in seconds
 * later.
 *
 * In addition to Suspense streaming, the 4 queries are now wrapped
 * in `unstable_cache` with a 20-second TTL. The activity stream is
 * a "what just happened" view — 20s of staleness is invisible to
 * the operator and saves ~400–800ms on every dashboard load that
 * hits the cache. Tag `dashboard-activity` lets future mutations
 * call `revalidateTag` to punch through if needed; today we lean
 * on the TTL alone.
 */

const fetchRecentActivity = unstable_cache(
  async () => {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [bhandaras, spots, mentions, volunteers] = await Promise.all([
      prisma.bhandara.findMany({
        where: { createdAt: { gt: dayAgo } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          slug: true,
          name: true,
          area: true,
          // Extra fields surface in the activity-row subtitle as
          // "area · time · date · organizer" so the operator can
          // skim what's been published without clicking through.
          timeStart: true,
          tuesdayDates: true,
          organizerName: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.spot.findMany({
        where: { createdAt: { gt: dayAgo } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          area: true,
          address: true,
          caption: true,
          reporterName: true,
          createdAt: true,
          status: true,
        },
      }),
      prisma.bhandaraMention.findMany({
        where: {
          status: "APPROVED",
          createdAt: { gt: dayAgo },
          intent: "SHARING",
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          cleanedText: true,
          originalText: true,
          senderName: true,
          locationLabel: true,
          createdAt: true,
        },
      }),
      prisma.volunteer.findMany({
        where: { createdAt: { gt: dayAgo } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // Normalise every Date → ISO string BEFORE returning so the
    // downstream `.map` callers can always read `createdAt` as a
    // string. Reason: `unstable_cache` serialises its return value
    // for storage, which converts Date instances into ISO strings.
    // On a cache HIT we'd then get strings back; calling
    // `.toISOString()` on a string crashes with "toISOString is
    // not a function". Coercing once here means consumers don't
    // need to branch on the type. The same goes for any future
    // Date field the queries add.
    return [
      bhandaras.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })),
      spots.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      mentions.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
      volunteers.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })),
    ] as const;
  },
  ["dashboard-activity-feed"],
  { revalidate: 20, tags: ["dashboard-activity"] },
);

export default async function ActivityFeed() {
  const [recentBhandaras, recentSpots, recentMentions, recentVolunteers] =
    await fetchRecentActivity();

  const events: ActivityEvent[] = [
    ...recentBhandaras.map((b): ActivityEvent => {
      // Subtitle = "area · time · date · organizer" with empty
      // segments filtered out so a sparsely-extracted bot row still
      // reads cleanly. Truncates on the row if it overflows.
      const dateLabel = pickBhandaraDate(b.tuesdayDates);
      const timeLabel = formatTimeIst(b.timeStart);
      const orgLabel = (b.organizerName ?? "").trim();
      const subtitle =
        [b.area ?? "", timeLabel, dateLabel, orgLabel]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(" · ") || undefined;
      return {
        id: `bhandara:${b.id}`,
        kind: "bhandara",
        title:
          b.status === "PENDING"
            ? `New bhandara — ${b.name}`
            : `Bhandara published — ${b.name}`,
        subtitle,
        senderName: b.name,
        status: b.status === "PENDING" ? "Pending" : "Live",
        createdAt: b.createdAt,
        // Both states route to the admin edit page so the operator
        // stays in admin context. The edit page renders all fields
        // (pamphlet + form) and is reachable for APPROVED rows too —
        // it just gates the "publish" action behind the verify flow.
        // Previously the LIVE state linked to /bhandara/<slug> which
        // bounced the operator out of admin onto the public site.
        href: `/admin/edit/${b.id}`,
      };
    }),
    ...recentSpots.map((s): ActivityEvent => ({
      id: `spot:${s.id}`,
      kind: "spot",
      title: stripBotProvenance(s.caption) || "New live spot",
      subtitle: [
        s.reporterName?.split(" ")[0] ?? "anon",
        s.area || s.address || "—",
      ]
        .filter(Boolean)
        .join(" · "),
      senderName: s.reporterName,
      status: "Live",
      createdAt: s.createdAt,
      href: `/admin/edit-spot/${s.id}`,
    })),
    ...recentMentions.map((m): ActivityEvent => {
      const text = m.cleanedText ?? m.originalText.split("\n\n[bot:")[0] ?? "";
      return {
        id: `mention:${m.id}`,
        kind: "mention",
        title: text.length > 80 ? text.slice(0, 77) + "…" : text,
        subtitle: [
          m.senderName?.split(" ")[0] ?? "anon",
          m.locationLabel ?? null,
        ]
          .filter(Boolean)
          .join(" · "),
        senderName: m.senderName,
        status: "Sharing",
        createdAt: m.createdAt,
        href: "/admin/mentions",
      };
    }),
    ...recentVolunteers.map((v): ActivityEvent => ({
      id: `volunteer:${v.id}`,
      kind: "volunteer",
      title: v.name?.trim() || "New volunteer signup",
      subtitle: undefined,
      senderName: v.name,
      status: v.status === "PENDING" ? "Pending" : "Active",
      createdAt: v.createdAt,
      href: "/admin/volunteers",
    })),
  ]
    .sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    )
    .slice(0, 14);

  // The dashboard always renders this inside the merged Live-chat
  // panel which supplies its own shared header (eyebrow + count +
  // open-live link), so this component emits ONLY the event list
  // and exposes the count via `events.length` for the parent to
  // read. `bare=true` keeps the list flush inside the parent's
  // bordered card without doubling up the ring. `dismissable=true`
  // adds the inline ✕ button on the right of each deletable row
  // (spots / bhandaras / mentions) so the operator can prune the
  // feed without context-switching to the source queue.
  return <ActivityStream events={events} bare dismissable />;
}

/** Skeleton shown by the Suspense boundary while ActivityFeed
 *  awaits its four queries. Renders just the row placeholders —
 *  the merged Live-chat panel supplies the surrounding chrome
 *  (header + outer border). Match the real ActivityStream rendering
 *  (no outer border) so the swap is reflow-free. */
export function ActivityFeedSkeleton() {
  return (
    <div className="p-3 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-2 py-2 rounded-lg"
        >
          <div className="w-9 h-9 rounded-full admin-skeleton motion-safe:animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 rounded-md admin-skeleton motion-safe:animate-pulse" />
            <div className="h-2.5 w-1/2 rounded-md admin-skeleton motion-safe:animate-pulse" />
          </div>
          <div className="h-5 w-10 rounded-full admin-skeleton motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}
