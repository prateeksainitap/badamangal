import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { stripBotProvenance } from "@/lib/sanitize";
import AdminShell from "@/components/admin/AdminShell";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import KpiTile from "@/components/admin/KpiTile";
import ActivityStream, {
  type ActivityEvent,
} from "@/components/admin/ActivityStream";

export const metadata: Metadata = {
  title: "Dashboard · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Admin Dashboard home.
 *
 * The "first surface" of the redesigned admin — what the operator
 * sees on /admin/home after sign-in. Answers four questions at a
 * glance:
 *
 *   1. What's pending my action?      → Pending review tile
 *   2. What's live right now?         → Live spots, Mentions tiles
 *   3. What's the bot doing?          → Bot status tile
 *   4. What just happened?            → Activity stream
 *
 * Pure SSR — every query runs once per request through the Supabase
 * pooler. `force-dynamic` because the dashboard is real-time by
 * nature; ISR would make the counts lie. Worst-case page render is
 * ~6 parallel queries through pgbouncer, well under 1s warm.
 */
export default async function AdminDashboardPage() {
  // Layout already gates auth, but defense-in-depth: any caller
  // who somehow bypasses the layout gets bounced to /admin login.
  if (!(await isAdmin())) redirect("/admin");

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Fan out every read in parallel — they hit different tables so
  // there's no contention, and the dashboard's first-paint feel is
  // bounded by the slowest query, not the sum.
  const [
    pendingBhandaras,
    liveSpotsCount,
    mentions24hCount,
    communityCounter,
    pendingVolunteers,
    recentBhandaras,
    recentSpots,
    recentMentions,
    recentVolunteers,
  ] = await Promise.all([
    prisma.bhandara.count({ where: { status: "PENDING" } }),
    prisma.spot.count({
      where: { status: "APPROVED", expiresAt: { gt: now } },
    }),
    prisma.bhandaraMention.count({
      where: { status: "APPROVED", createdAt: { gt: dayAgo } },
    }),
    prisma.siteCounter.findUnique({
      where: { id: "community_total_members" },
      select: { count: true },
    }),
    prisma.volunteer.count({ where: { status: "PENDING" } }),
    prisma.bhandara.findMany({
      where: { createdAt: { gt: dayAgo } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        slug: true,
        name: true,
        area: true,
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

  const communityMembers = communityCounter?.count ?? 0;

  // Build a unified activity feed from the four sources. Each event
  // gets a discriminator + a deep-link target so the operator can
  // act on it in one click.
  const events: ActivityEvent[] = [
    ...recentBhandaras.map((b): ActivityEvent => ({
      id: `bhandara:${b.id}`,
      kind: "bhandara",
      title:
        b.status === "PENDING"
          ? `New bhandara pending review — ${b.name}`
          : `Bhandara published — ${b.name}`,
      subtitle: b.area ? `${b.area} · ${b.status.toLowerCase()}` : b.status.toLowerCase(),
      createdAt: b.createdAt.toISOString(),
      href:
        b.status === "PENDING"
          ? `/admin/edit/${b.id}`
          : `/bhandara/${b.slug}`,
    })),
    ...recentSpots.map((s): ActivityEvent => ({
      id: `spot:${s.id}`,
      kind: "spot",
      title: stripBotProvenance(s.caption) || "New live spot",
      subtitle: [s.reporterName?.split(" ")[0] ?? "anon", s.area || s.address || "—"]
        .filter(Boolean)
        .join(" · "),
      createdAt: s.createdAt.toISOString(),
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
        createdAt: m.createdAt.toISOString(),
        href: "/admin/mentions",
      };
    }),
    ...recentVolunteers.map((v): ActivityEvent => ({
      id: `volunteer:${v.id}`,
      kind: "volunteer",
      title: v.name?.trim() || "New volunteer signup",
      subtitle: v.status.toLowerCase(),
      createdAt: v.createdAt.toISOString(),
      href: "/admin/volunteers",
    })),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, 14);

  return (
    <AdminShell botHeartbeat={<BotHeartbeat />}>
    <div className="max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-fraunces text-2xl sm:text-3xl text-cream-50 leading-tight">
            Dashboard
          </h1>
          <p className="text-sm text-cream-50/55 mt-1">
            What&apos;s happening across Bada Mangal right now.
          </p>
        </div>
        <Link
          href="/admin/scan"
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-saffron-500 to-saffron-600 text-cream-50 px-4 py-2 text-sm font-medium shadow-[0_6px_20px_-6px_rgba(242,148,76,0.7)] hover:from-saffron-600 hover:to-saffron-600 transition-all"
        >
          <span aria-hidden>+</span> Scan &amp; publish
        </Link>
      </div>

      {/* KPI tile row — 5 tiles. Grid collapses to 2/3/5 across
          breakpoints so the dashboard reads well on tablet too. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <KpiTile
          label="Pending review"
          value={pendingBhandaras.toLocaleString("en-IN")}
          delta={
            pendingBhandaras > 0
              ? "Waiting for your call"
              : "Caught up"
          }
          variant={pendingBhandaras > 0 ? "attention" : "default"}
          href="/admin"
          icon={<KpiIconClipboard />}
        />
        <KpiTile
          label="Live spots"
          value={liveSpotsCount.toLocaleString("en-IN")}
          delta="Auto-expire in 8h"
          variant="default"
          href="/admin?type=spot"
          icon={<KpiIconCamera />}
        />
        <KpiTile
          label="Mentions · 24h"
          value={mentions24hCount.toLocaleString("en-IN")}
          delta="From 14 WhatsApp groups"
          variant="default"
          href="/admin/mentions"
          icon={<KpiIconChat />}
        />
        <KpiTile
          label="Community"
          value={communityMembers.toLocaleString("en-IN")}
          delta="Total WhatsApp members"
          variant="success"
          icon={<KpiIconUsers />}
        />
        <KpiTile
          label="Volunteers"
          value={pendingVolunteers.toLocaleString("en-IN")}
          delta={
            pendingVolunteers > 0
              ? "Pending signups"
              : "All processed"
          }
          variant={pendingVolunteers > 0 ? "attention" : "default"}
          href="/admin/volunteers"
          icon={<KpiIconUserCheck />}
        />
      </div>

      {/* Hero panel — 60/40 split on lg. Map on left, activity on
          right. Stacks vertically on smaller viewports. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* MAP slot — placeholder card for now. Real map widget
            (MentionHeatmap with an admin overlay) lands in Phase 2;
            wiring it cleanly requires moving the SSR mention fetch
            into a shared loader so dashboard + homepage share one
            source of truth. Until then, this card communicates
            intent + offers a direct link to the live homepage map. */}
        <div className="lg:col-span-3 rounded-2xl border border-cream-50/10 bg-cream-50/[0.03] backdrop-blur-sm overflow-hidden min-h-[22rem]">
          <div className="px-5 pt-5 pb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-fraunces text-lg text-cream-50">
                Lucknow — mention heatmap
              </h2>
              <p className="text-xs text-cream-50/55 mt-1">
                Live activity across the city, last 24h
              </p>
            </div>
            <Link
              href="/#live-chat"
              target="_blank"
              prefetch={false}
              className="inline-flex items-center gap-1 rounded-full border border-cream-50/15 px-3 py-1 text-xs text-cream-50/75 hover:text-cream-50 hover:border-cream-50/30 transition-colors"
            >
              Open public map ↗
            </Link>
          </div>
          <div className="px-5 pb-5">
            <div className="aspect-[16/9] rounded-xl overflow-hidden relative bg-[radial-gradient(circle_at_60%_30%,rgba(242,148,76,0.18),transparent_55%),radial-gradient(circle_at_30%_75%,rgba(156,42,42,0.16),transparent_55%)] border border-cream-50/10 flex items-center justify-center">
              <div className="text-center px-6">
                <div className="font-fraunces text-cream-50 text-lg">
                  {mentions24hCount.toLocaleString("en-IN")} mentions
                </div>
                <div className="text-xs text-cream-50/55 mt-1">
                  from {communityMembers.toLocaleString("en-IN")} community members across 14 WhatsApp groups
                </div>
                <Link
                  href="/#live-chat"
                  target="_blank"
                  prefetch={false}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-saffron-500/15 text-saffron-500 px-3 py-1.5 text-xs hover:bg-saffron-500/25 transition-colors"
                >
                  View live heatmap ↗
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ACTIVITY STREAM slot — 40% on lg. */}
        <div className="lg:col-span-2 flex flex-col min-h-[22rem]">
          <div className="px-1 pb-2 flex items-end justify-between gap-3">
            <h2 className="font-fraunces text-lg text-cream-50">
              Recent activity
            </h2>
            <span className="text-[11px] text-cream-50/45 tabular-nums">
              {events.length} events · 24h
            </span>
          </div>
          <ActivityStream events={events} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction
          href="/admin/scan"
          label="Scan & publish"
          subtitle="Upload an invite poster"
          icon={<QuickIconScan />}
          accent="saffron"
        />
        <QuickAction
          href="/admin"
          label="Review queue"
          subtitle={`${pendingBhandaras} pending`}
          icon={<QuickIconClipboard />}
          accent="cream"
        />
        <QuickAction
          href="/admin/discover"
          label="Discover"
          subtitle="Find new bhandaras"
          icon={<QuickIconCompass />}
          accent="cream"
        />
        <QuickAction
          href="/admin/volunteers"
          label="Volunteers"
          subtitle={`${pendingVolunteers} new`}
          icon={<QuickIconUsers />}
          accent="cream"
        />
      </div>
    </div>
    </AdminShell>
  );
}

/* ───────── QuickAction tile ───────── */

function QuickAction({
  href,
  label,
  subtitle,
  icon,
  accent,
}: {
  href: string;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: "saffron" | "cream";
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={[
        "group rounded-2xl border bg-cream-50/[0.03] backdrop-blur-sm p-4 transition-all",
        accent === "saffron"
          ? "border-saffron-500/40 hover:border-saffron-500/60 hover:bg-saffron-500/[0.06]"
          : "border-cream-50/12 hover:border-cream-50/22 hover:bg-cream-50/[0.05]",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div
          className={[
            "shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl",
            accent === "saffron"
              ? "bg-gradient-to-br from-saffron-500 to-saffron-600 text-cream-50 shadow-[0_4px_14px_-4px_rgba(242,148,76,0.6)]"
              : "bg-cream-50/[0.06] text-cream-50/85",
          ].join(" ")}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-cream-50 text-sm">{label}</div>
          <div className="text-xs text-cream-50/55 mt-0.5 truncate">
            {subtitle}
          </div>
        </div>
        <span
          aria-hidden
          className="text-cream-50/45 group-hover:text-cream-50/85 transition-colors"
        >
          →
        </span>
      </div>
    </Link>
  );
}

/* ───────── Icons ───────── */
function KpiIconClipboard() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}
function KpiIconCamera() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
function KpiIconChat() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.6A8 8 0 0 1 21 12z" />
    </svg>
  );
}
function KpiIconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="3.5" />
      <path d="M2.5 20 c0 -4 3 -7 6.5 -7 s6.5 3 6.5 7" />
      <circle cx="17" cy="10" r="2.5" />
    </svg>
  );
}
function KpiIconUserCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="9" r="3.5" />
      <path d="M3 20 c0 -4 3 -7 7 -7 s7 3 7 7" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function QuickIconScan() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8 V5 a2 2 0 0 1 2 -2 h3" />
      <path d="M21 8 V5 a2 2 0 0 0 -2 -2 h-3" />
      <path d="M3 16 v3 a2 2 0 0 0 2 2 h3" />
      <path d="M21 16 v3 a2 2 0 0 1 -2 2 h-3" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}
function QuickIconClipboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="9" y1="18" x2="13" y2="18" />
    </svg>
  );
}
function QuickIconCompass() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polygon points="14.5,9.5 11,13 9.5,14.5 13,11" fill="currentColor" />
    </svg>
  );
}
function QuickIconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="3.5" />
      <path d="M2.5 20 c0 -4 3 -7 6.5 -7 s6.5 3 6.5 7" />
      <circle cx="17" cy="10" r="2.5" />
    </svg>
  );
}
