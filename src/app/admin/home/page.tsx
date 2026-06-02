import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import {
  getCachedCommunityMembers,
  getCachedVisitorCount,
} from "@/lib/admin-cache";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import KpiTile from "@/components/admin/KpiTile";
import DashboardLiveMap, {
  DashboardLiveMapSkeleton,
} from "@/components/admin/DashboardLiveMap";
// Dashboard composes the hero illustration directly (alongside the
// greeting) instead of stacking AdminPageHero above it, so we
// import the inner art component rather than the band wrapper.
import AdminHeroArt from "@/components/admin/AdminHeroArt";
import { NotificationBell } from "@/components/admin/DashboardAlerts";
import {
  isLiveChatOpenToday,
  mostRecentOpenDayIST,
  dayNameEn,
} from "@/lib/live-chat-schedule";
import {
  ALL_SEASON_ISO,
  istTodayIso,
} from "@/lib/dates";
import ActivityFeed, {
  ActivityFeedSkeleton,
} from "@/components/admin/ActivityFeed";

export const metadata: Metadata = {
  title: "Dashboard · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Admin Dashboard home.
 *
 * The "first surface" of the redesigned admin, what the operator
 * sees on /admin/home after sign-in. Answers four questions at a
 * glance:
 *
 *   1. What's pending my action?      → Pending review tile
 *   2. What's live right now?         → Live spots, Mentions tiles
 *   3. What's the bot doing?          → Bot status tile
 *   4. What just happened?            → Activity stream
 *
 * Pure SSR, every query runs once per request through the Supabase
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
  // Upcoming + today's season service-days (Tuesdays + Saturdays
  // through end of season). Used by the "Live bhandaras" tile to
  // match the public-homepage filter exactly - same predicate as
  // lib/dates.ts:hasUpcomingDate, just expressed at the SQL layer
  // so we don't have to fetch every APPROVED row to count.
  const todayIso = istTodayIso(now);
  const upcomingSeasonIso = ALL_SEASON_ISO.filter((d) => d >= todayIso);

  // Above-the-fold queries only, KPI counts. The 3 map `findMany`
  // queries (live spots / bhandaras / mentions with coords) used to
  // live in this Promise.all and added ~150–300ms to time-to-first
  // byte. They now live inside <DashboardLiveMap/> behind its own
  // Suspense boundary, streaming in after the KPIs paint. Same
  // pattern as the ActivityFeed split, the page's first paint
  // depends only on cheap COUNT queries plus the cached community
  // members + visitor counters.
  //
  // Community-counter query is wrapped in `unstable_cache` because
  // it only updates ~hourly (bot push); serving from in-memory cache
  // shaves a Prisma round-trip off every dashboard load. Tags allow
  // `revalidateTag("community-counter")` from the bot's stats route
  // to punch through immediately when fresh data lands.
  // Promise.allSettled (not Promise.all) so a single transient
  // EMAXCONN doesn't take down the whole dashboard. Each query
  // resolves independently; if one rejects, that single tile shows
  // a zero/dash while the rest of the page still paints. The error
  // boundary catching one bad count() was the actual bug behind
  // the "Something tripped while rendering this page." regression
  // on Tuesday-1 peak traffic.
  const settled = await Promise.allSettled([
    prisma.bhandara.count({ where: { status: "PENDING" } }),
    prisma.spot.count({
      where: { status: "APPROVED", expiresAt: { gt: now } },
    }),
    prisma.bhandaraMention.count({
      where: { status: "APPROVED", createdAt: { gt: dayAgo } },
    }),
    getCachedCommunityMembers(),
    getCachedVisitorCount(),
    prisma.volunteer.count({ where: { status: "PENDING" } }),
    // Unread inbox count for the Emails quick-action tile + sidebar.
    // Fast, `status` is indexed via @@index([status, createdAt]).
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    // Live-on-website bhandara count. Matches the exact predicate
    // the public homepage uses to decide what to render: APPROVED +
    // has at least one service-day (Tuesday or Saturday) that's
    // today or in the future. A plain status=APPROVED count would
    // over-report by including rows whose tuesdayDates are entirely
    // in the past (still APPROVED but auto-hidden from the public
    // surface - see lib/dates.ts:hasUpcomingDate).
    //
    // tuesdayDates is a JSON-encoded string column ('["2026-05-19",
    // "2026-06-02",…]'); Prisma's `contains` filter runs Postgres
    // LIKE under the hood, and ISO dates are zero-padded so each
    // upcoming-date substring matches without false positives. We
    // OR every upcoming service-day in the season window so a
    // bhandara serving on any future date counts as live.
    //
    // End-of-season guard: when no service-days remain, short-circuit
    // to a literal 0 instead of issuing OR: [] (Prisma's behaviour
    // on empty OR is version-dependent and we don't want to risk
    // accidentally counting every APPROVED row off-season).
    upcomingSeasonIso.length === 0
      ? Promise.resolve(0)
      : prisma.bhandara.count({
          where: {
            status: "APPROVED",
            OR: upcomingSeasonIso.map((d) => ({
              tuesdayDates: { contains: d },
            })),
          },
        }),
  ]);
  const unwrap = <T,>(idx: number, fallback: T): T => {
    const r = settled[idx];
    if (r && r.status === "fulfilled") return r.value as T;
    if (r && r.status === "rejected") {
      console.error(
        `[admin/home] query ${idx} rejected:`,
        r.reason instanceof Error ? r.reason.message : r.reason,
      );
    }
    return fallback;
  };
  const pendingBhandaras = unwrap<number>(0, 0);
  const liveSpotsCount = unwrap<number>(1, 0);
  const mentions24hCount = unwrap<number>(2, 0);
  const communityMembers = unwrap<number>(3, 0);
  const visitorCount = unwrap<number>(4, 0);
  const pendingVolunteers = unwrap<number>(5, 0);
  const newEmailsCount = unwrap<number>(6, 0);
  const liveBhandarasCount = unwrap<number>(7, 0);

  // "Total reach" = WhatsApp community members + cumulative website
  // visitor count. The KPI tile shows the sum (a single big number
  // the operator reads as "the size of the network we touch") with
  // the per-source breakdown in the delta line.
  const totalReach = communityMembers + visitorCount;

  // Activity stream is now a separate Suspense boundary
  // (<ActivityFeed/>) so its four `findMany` queries no longer
  // block the dashboard's first paint.

  // Time-of-day greeting in IST. Tuesday is the Bada Mangal day so
  // we surface "It's Tuesday" with a pulsing dot when the operator
  // logs in on a season Tuesday, the most "alive" day for the bot.
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const istHour = istNow.getUTCHours();
  const greeting =
    istHour < 12 ? "Good morning" : istHour < 17 ? "Good afternoon" : "Good evening";
  const isTuesday = istNow.getUTCDay() === 2;
  const todayLabel = istNow.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Live-chat-day label, on Tue/Sat the public chat is live (matches
  // the public LiveChatterBoard's schedule). On other days the panel
  // shows the most-recent open day's discussion as a backlog view,
  // so we relabel "Live chat" → "Saturday's chat" / "Tuesday's chat"
  // so the operator knows they're reading yesterday's signal not
  // today's. Schedule helpers live in src/lib/live-chat-schedule.ts.
  const chatOpenToday = isLiveChatOpenToday();
  const lastOpenDayName = dayNameEn(mostRecentOpenDayIST());
  const chatTitleLeader = chatOpenToday ? "Live" : `${lastOpenDayName}'s`;
  const chatEyebrowLabel = chatOpenToday
    ? "lucknow.network · live chat"
    : `lucknow.network · ${lastOpenDayName.toLowerCase()}'s chat`;

  // Alerts source, same Promise.all data the rest of the dashboard
  // reads, plumbed into the NotificationBell shown in the AdminShell
  // header. Used to render inline at the top of /admin/home; now
  // lives behind the bell so the dashboard surface stays clean.
  const alertsProps = {
    pendingBhandaras,
    pendingVolunteers,
    newEmailsCount,
    mentions24hCount,
    isTuesday,
  };

  return (
    <AdminShell
      navCounts={await getAdminNavCounts()}
      botHeartbeat={<BotHeartbeat />}
      notifications={<NotificationBell {...alertsProps} />}
    >
    <div className="max-w-7xl mx-auto">
      {/* Combined hero + greeting, used to be two stacked panels
          (a full-width AdminPageHero band on top, then the greeting
          row underneath), which ate ~260px of vertical space before
          the operator saw any data. Now the isometric illustration
          tucks to the right of the greeting as a decorative aside, so
          the whole header collapses to a single ~160px panel while
          keeping the playful AI/ops console personality intact. */}
      <div className="relative mb-6 rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-[#0B0E16] via-[#0A0C13] to-[#080A10] overflow-hidden">
        {/* Same faint data-grid texture AdminPageHero used to render.
            Inlined here so the panel reads as the same console
            surface even after the merge. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-50 admin-data-grid pointer-events-none"
        />
        <div className="relative grid items-center gap-4 sm:gap-5 p-4 sm:p-5 sm:grid-cols-[1fr_auto]">
          {/* Left column, eyebrow + greeting + subtitle */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 font-mono text-[10px] flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/[0.06] border border-cyan-400/20 px-2.5 py-1 uppercase tracking-[0.18em] text-cyan-300/85">
                <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                </span>
                {todayLabel}
              </span>
              {isTuesday ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-saffron-500/20 to-violet-500/20 border border-saffron-500/35 px-2.5 py-1 uppercase tracking-[0.18em] text-saffron-400">
                  <span aria-hidden>◉</span> Bada Mangal · live
                </span>
              ) : null}
              <span className="text-cream-50/35 ml-1">
                sys.uptime <span className="text-cream-50/70">stable</span>
              </span>
            </div>
            <h1 className="font-fraunces text-2xl sm:text-3xl text-cream-50 leading-[1.05] tracking-tight">
              {greeting},{" "}
              <span className="bg-gradient-to-br from-cyan-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
                Prateek
              </span>
              .
              <span className="admin-cursor text-cyan-300/85" />
            </h1>
            <p className="text-[13px] text-cream-50/55 mt-1.5 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="text-cyan-300/85">$</span>{" "}
              <span className="text-cream-50/75">monitor</span>{" "}
              bhandara.network ·{" "}
              <span className="text-cream-50/40">
                bot, volunteers, mentions all reporting in
              </span>
            </p>
            {/* Header CTAs intentionally removed, duplicates of the
                quick.actions strip directly below this hero. */}
          </div>

          {/* Right column, compact isometric illustration. Hidden on
              narrow screens; revealed at sm+ as a fixed-size aside.
              Smaller dimensions now (h-20→24→28 vs the old 28→32→36)
              so the whole hero collapses to ~120px tall. */}
          <div
            aria-hidden
            className="relative shrink-0 hidden sm:block w-40 md:w-52 lg:w-60 h-20 md:h-24 lg:h-28"
          >
            <AdminHeroArt subject="dashboard" />
          </div>
        </div>
      </div>

      {/* Quick actions, bumped to the TOP (above KPI tiles) so the
          operator's most-frequent destinations are the first thing
          they see. Tiles use a FILLED accent fill so they read as
          first-class "do this now" buttons. The decorative
          quick.actions divider that used to sit above this strip
          was removed, the tiles themselves are self-explanatory
          and the divider was visual chrome with no information value. */}
      {/* Trimmed from six tiles down to two: scan_and_publish
          and emails, the only destinations the operator hits
          frequently enough to deserve top-of-dashboard real
          estate. Everything else (review queue, discover,
          content hub, volunteers) is one click away via the
          sidebar, so the duplicate quick-action shortcuts were
          mostly visual noise. Two-column grid below sm so the
          tiles stay readable at full width on phones. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
        <QuickAction
          href="/admin/scan"
          label="scan_and_publish"
          subtitle="Upload an invite poster"
          icon={<QuickIconScan />}
          accent="primary"
          shortcut="S"
        />
        <QuickAction
          href="/admin/emails"
          label="emails"
          subtitle={
            newEmailsCount > 0
              ? `${newEmailsCount} unread`
              : "Inbox zero"
          }
          icon={<QuickIconEnvelope />}
          accent="sindoor"
          shortcut="E"
        />
      </div>

      {/* KPI tile row, 6 tiles with Fraunces serif hero numbers.
          Total Reach (WhatsApp + visitors combined) sits next to its
          two component metrics, Site visitors gets its own tile so
          the website-traffic number doesn't hide in a delta-line
          subtitle. Attention tiles breathe a slow saffron glow
          until cleared. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-7">
        <KpiTile
          label="Live bhandaras"
          value={liveBhandarasCount.toLocaleString("en-IN")}
          // Delta line surfaces the pending-review backlog so the
          // tile still carries the "what needs your attention"
          // signal that the old PENDING REVIEW tile used to. When
          // the queue is empty we drop a quiet "all approved"
          // line instead so the tile doesn't read as suspiciously
          // silent.
          delta={
            pendingBhandaras > 0
              ? `${pendingBhandaras} pending review`
              : "All approved"
          }
          // Stay green when pending review is empty; flip to the
          // saffron "attention" glow when pending review > 0 so
          // the tile doubles as a "you have queue work" cue.
          variant={pendingBhandaras > 0 ? "attention" : "success"}
          href="/admin/bhandaras?status=LIVE"
          icon={<KpiIconDiya />}
        />
        <KpiTile
          label="Live spots"
          value={liveSpotsCount.toLocaleString("en-IN")}
          delta="Auto-expire in 8h"
          variant="default"
          href="/admin/spots?status=LIVE"
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
          label="Site visitors"
          value={visitorCount.toLocaleString("en-IN")}
          delta="Cumulative since launch"
          variant="default"
          icon={<KpiIconGlobe />}
        />
        <KpiTile
          label="Total reach"
          value={totalReach.toLocaleString("en-IN")}
          delta={`${communityMembers.toLocaleString("en-IN")} WhatsApp · ${visitorCount.toLocaleString("en-IN")} site`}
          variant="success"
          icon={<KpiIconUsers />}
        />
        <KpiTile
          label="Volunteer signups"
          value={pendingVolunteers.toLocaleString("en-IN")}
          delta={
            pendingVolunteers > 0
              ? `${pendingVolunteers} pending`
              : "All processed"
          }
          variant={pendingVolunteers > 0 ? "attention" : "default"}
          href="/admin/volunteers"
          icon={<KpiIconUserCheck />}
        />
      </div>

      {/* Live chat, merged hero. Used to be two side-by-side panels
          (a city-firing map on the left, a Recent-activity feed on
          the right) which felt like two separate readouts. They're
          actually the same thing told two ways: WHERE in the city
          things are happening (map) + WHEN they happened (stream).
          One bordered panel, shared header, two-column body on lg+,
          stacked on smaller screens. */}
      <section className="mb-7 rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-[#0B0E16] to-[#0A0C13] overflow-hidden admin-card-glow">
        {/* Shared header, eyebrow + title + count + open-live link. */}
        <div className="relative px-5 sm:px-6 pt-5 sm:pt-6 pb-3 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/85 font-mono mb-1.5 inline-flex items-center gap-1.5">
              <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
                {chatOpenToday ? (
                  <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
                ) : null}
                <span
                  className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                    chatOpenToday ? "bg-cyan-400" : "bg-cream-50/40"
                  }`}
                />
              </span>
              {chatEyebrowLabel}
            </div>
            <h2 className="font-fraunces text-2xl text-cream-50 leading-tight">
              {chatTitleLeader}{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
                chat
              </span>
            </h2>
            <p className="text-[11.5px] text-cream-50/55 font-mono mt-0.5">
              {liveSpotsCount} live · {mentions24hCount} mentions · 24h ·{" "}
              <span className="text-cream-50/40">
                {chatOpenToday
                  ? isTuesday
                    ? "today is Tuesday, chat is live"
                    : "today is Saturday, chat is live"
                  : `off-day, showing ${lastOpenDayName}'s discussion`}
              </span>
            </p>
          </div>
          <Link
            href="/live"
            target="_blank"
            prefetch={false}
            className="inline-flex items-center gap-1 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-3 py-1.5 text-[11px] transition-colors font-mono"
          >
            open live ↗
          </Link>
        </div>

        {/* Body, map full-width on top, chronological stream below.
            Was previously a two-column lg:grid-cols-5 (3 + 2) split
            with a vertical divider, but the right-column chat felt
            cramped at narrow widths and the map lost canvas width
            it could use for label density. New stacking treatment
            gives the map the full row so it reads as the dashboard's
            primary "city right now" canvas, then the stream sits
            beneath it as a continuous chronological tail. The
            horizontal divider on the stream replaces the old
            vertical lg:divide-x. */}
        <div className="grid grid-cols-1">
          {/* TOP, map. Plain block container (no flex-1 chain) so
              AdminOlaMap's own h-[22rem] sm:h-[24rem] lg:h-[28rem]
              dimensions are what actually drive the canvas size. */}
          <div className="relative">
            {/* Map data lives inside this Suspense boundary so the
                3 `findMany`s no longer block the KPI tile paint
                above. While the queries run, the skeleton renders at
                the exact same height stack the real map will occupy,
                so the layout doesn't jump on swap. */}
            <Suspense fallback={<DashboardLiveMapSkeleton />}>
              <DashboardLiveMap liveSpotsCount={liveSpotsCount} />
            </Suspense>
            {/* Mini stats row pinned to the bottom of the map column. */}
            <div className="relative px-5 sm:px-6 pb-5 pt-3 bg-gradient-to-t from-[#0B0E16] via-[#0B0E16]/85 to-transparent">
              <div className="grid grid-cols-3 gap-2.5">
                <HeroStat
                  label="live_spots"
                  value={liveSpotsCount}
                  accent="cyan"
                />
                <HeroStat
                  label="mentions_24h"
                  value={mentions24hCount}
                  accent="violet"
                />
                <HeroStat
                  label="today"
                  value={
                    chatOpenToday
                      ? dayNameEn(istNow.getUTCDay()).toUpperCase()
                      : `${lastOpenDayName.toUpperCase()}'S`
                  }
                  accent="leaf"
                  isText
                />
              </div>
            </div>
          </div>

          {/* BOTTOM, chronological activity stream. Wrapped in
              Suspense so the four `findMany` queries that populate it
              never block the dashboard's KPI/hero paint. ActivityFeed
              runs in `bare` mode (no inner border / no inner header),
              the wrapping panel here owns those. With the new stacked
              layout, the stream gets the full row width and can show
              more rows before scrolling, bumped max-h from 34rem
              (the old side-by-side cap) to 40rem so a busy Tuesday
              chats list doesn't get cramped. Border-top replaces the
              old vertical lg:divide-x between the two columns. */}
          <div className="flex flex-col min-h-[22rem] max-h-[40rem] border-t border-cyan-400/[0.10]">
            <div className="px-5 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-2 border-b border-cyan-400/[0.08]">
              <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/85 font-mono">
                Stream
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10.5px] text-cream-50/45 tabular-nums font-mono">
                  last 24h
                </span>
                <a
                  href="/admin/live"
                  className="text-[10.5px] uppercase tracking-[0.16em] font-mono text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  View all ↗
                </a>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Suspense fallback={<ActivityFeedSkeleton />}>
                <ActivityFeed />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

    </div>
    </AdminShell>
  );
}

/* ───────── HeroStat, small in-hero stat readout ───────── */

function HeroStat({
  label,
  value,
  accent,
  isText,
}: {
  label: string;
  value: number | string;
  accent: "cyan" | "violet" | "leaf" | "saffron" | "sindoor";
  isText?: boolean;
}) {
  const accentMap: Record<typeof accent, { text: string; border: string }> = {
    cyan: { text: "text-cyan-300", border: "border-cyan-400/25" },
    violet: { text: "text-violet-300", border: "border-violet-400/25" },
    leaf: { text: "text-leaf-400", border: "border-leaf-400/25" },
    saffron: { text: "text-saffron-400", border: "border-saffron-400/25" },
    sindoor: { text: "text-sindoor-700", border: "border-sindoor-700/30" },
  };
  const a = accentMap[accent];
  return (
    <div className={`rounded-xl border ${a.border} bg-[#0B0E16]/55 backdrop-blur-sm px-3 py-2.5`}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-cream-50/55 font-mono">
        {label}
      </div>
      <div
        className={[
          "mt-1 font-mono font-bold tabular-nums tracking-tight",
          isText ? "text-sm" : "text-2xl leading-none",
          a.text,
        ].join(" ")}
      >
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </div>
    </div>
  );
}

/* ───────── QuickAction tile ─────────
 *
 * Terminal-command palette aesthetic. Each tile reads as a callable
 * function, mono label like `scan_and_publish()`, a per-accent
 * coloured icon plate, a keyboard-shortcut chip on the right, and a
 * thin animated underline on hover that doubles as a "ready to fire"
 * cue. The primary action gets the cyan→violet gradient plate; the
 * rest get the variant accent at lower intensity.
 */

type QuickAccent = "primary" | "cyan" | "violet" | "leaf" | "saffron" | "sindoor";

const QUICK_ACCENTS: Record<
  QuickAccent,
  {
    surface: string;
    iconWrap: string;
    label: string;
    sub: string;
    chip: string;
  }
> = {
  // Filled-style accents. Each tile gets its accent colour as the
  // dominant card fill (vs the old outlined dark-bg cards) so the
  // strip reads as primary, high-contrast CTAs at the very top of
  // the dashboard. Icon plate is a brighter solid block of the same
  // hue; the keyboard-shortcut chip is reversed (light glass on the
  // colour fill) so it stays legible.
  primary: {
    surface:
      "bg-gradient-to-br from-cyan-500/90 via-cyan-500/80 to-violet-500/90 hover:from-cyan-400 hover:to-violet-400 shadow-[0_12px_30px_-12px_rgba(34,211,238,0.7)]",
    iconWrap: "bg-cream-50/15 text-cream-50",
    label: "text-cream-50",
    sub: "text-cream-50/85",
    chip: "bg-cream-50/20 text-cream-50",
  },
  cyan: {
    surface:
      "bg-gradient-to-br from-cyan-500/85 to-cyan-600/95 hover:from-cyan-400 hover:to-cyan-500 shadow-[0_12px_30px_-12px_rgba(34,211,238,0.55)]",
    iconWrap: "bg-cream-50/15 text-cream-50",
    label: "text-cream-50",
    sub: "text-cream-50/85",
    chip: "bg-cream-50/20 text-cream-50",
  },
  violet: {
    surface:
      "bg-gradient-to-br from-violet-500/90 to-violet-600/95 hover:from-violet-400 hover:to-violet-500 shadow-[0_12px_30px_-12px_rgba(139,92,246,0.6)]",
    iconWrap: "bg-cream-50/15 text-cream-50",
    label: "text-cream-50",
    sub: "text-cream-50/85",
    chip: "bg-cream-50/20 text-cream-50",
  },
  leaf: {
    surface:
      "bg-gradient-to-br from-leaf-600/95 to-leaf-600 hover:from-leaf-600 hover:to-leaf-600/95 shadow-[0_12px_30px_-12px_rgba(93,174,93,0.55)]",
    iconWrap: "bg-cream-50/15 text-cream-50",
    label: "text-cream-50",
    sub: "text-cream-50/85",
    chip: "bg-cream-50/20 text-cream-50",
  },
  // Saffron, used by the Content Hub tile so the "creative / outbound
  // content" surface gets its own warm fill, distinct from the cooler
  // cyan/violet ops accents. Carries the brand's saffron continuity
  // through to the dashboard without dominating it.
  saffron: {
    surface:
      "bg-gradient-to-br from-saffron-500/90 to-saffron-600 hover:from-saffron-500 hover:to-saffron-500 shadow-[0_12px_30px_-12px_rgba(242,148,76,0.6)]",
    iconWrap: "bg-cream-50/15 text-cream-50",
    label: "text-cream-50",
    sub: "text-cream-50/85",
    chip: "bg-cream-50/20 text-cream-50",
  },
  // Sindoor, deep red used by the Emails tile. The tone signals
  // "incoming attention" without overlapping any of the cooler ops
  // accents (cyan / violet) or the warm content accent (saffron),
  // so the operator's eye lands on Emails immediately when there's
  // unread mail. Still inside the brand palette (sindoor-700 is
  // also the destructive-action token used elsewhere in admin).
  sindoor: {
    surface:
      "bg-gradient-to-br from-sindoor-700 to-sindoor-700/85 hover:from-sindoor-700 hover:to-sindoor-700 shadow-[0_12px_30px_-12px_rgba(156,42,42,0.65)]",
    iconWrap: "bg-cream-50/15 text-cream-50",
    label: "text-cream-50",
    sub: "text-cream-50/85",
    chip: "bg-cream-50/20 text-cream-50",
  },
};

function QuickAction({
  href,
  label,
  subtitle,
  icon,
  accent,
  shortcut,
}: {
  href: string;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: QuickAccent;
  shortcut?: string;
}) {
  const a = QUICK_ACCENTS[accent];
  return (
    <Link
      href={href}
      className={[
        // Bumped vertical padding so the bigger / bolder label has
        // breathing room above and below. Horizontal padding stays
        // tight (px-3.5) so the label keeps as much width as possible
        // in the 6-up grid at lg.
        "group relative rounded-2xl px-3.5 py-3 transition-all duration-300 overflow-hidden border border-cream-50/15 hover:-translate-y-0.5",
        a.surface,
      ].join(" ")}
    >
      {/* Subtle inner highlight on the top edge to give the filled
          card a soft "lifted" feel rather than a flat slab. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cream-50/40 to-transparent"
      />
      <div className="relative flex items-center gap-3">
        <div
          className={[
            // 40×40 icon plate (was 36), matches the bolder type
            // weight so the icon doesn't look small next to the new
            // heading size.
            "shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg",
            a.iconWrap,
          ].join(" ")}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={[
              // Heading bump: text-[13px]/semibold → text-[15px]/bold,
              // and leading-tight so the bigger glyphs don't stretch
              // the row. tracking-tight still helps long labels like
              // "scan_and_publish" hold their ground before truncating.
              "font-mono text-[15px] leading-tight tracking-tight truncate font-bold",
              a.label,
            ].join(" ")}
          >
            {label}
            <span className="opacity-65">()</span>
          </div>
          <div
            className={[
              // Subtitle bumped 11px → 12px so the hierarchy stays
              // proportional to the bigger heading. Still distinctly
              // secondary to the label.
              "text-[12px] mt-1 truncate font-mono",
              a.sub,
            ].join(" ")}
          >
            {subtitle}
          </div>
        </div>
        {shortcut ? (
          <div
            className={[
              // Shortcut chip nudged up to match the heavier heading
              //, 1.4rem min, 5.5 height. Still distinctly secondary
              // to the now-bolder label.
              "shrink-0 inline-flex items-center justify-center min-w-[1.4rem] h-[1.4rem] px-1 rounded-md font-mono text-[10.5px] font-bold uppercase tracking-[0.08em]",
              a.chip,
            ].join(" ")}
            aria-hidden
          >
            {shortcut}
          </div>
        ) : (
          <span
            aria-hidden
            className="text-cream-50/75 group-hover:translate-x-0.5 transition-transform"
          >
            →
          </span>
        )}
      </div>
    </Link>
  );
}

/* ───────── KPI Icons, sized for the larger 44×44 icon plate
 *  on each KpiTile. Stroke 2.2 reads bold without going pictographic. */
/** Diya for the "Live bhandaras" KPI tile - same silhouette as
 *  the sidebar's Bhandaras nav glyph (gada-on-disc flame on top
 *  of an arched plate), upscaled to 22 px to match the bolder
 *  KPI icon weight. The flame fills with currentColor so the
 *  variant-tinted ring around the icon reads "lit / live". */
function KpiIconDiya() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M12 4 c1.6 1.5 2.5 3.2 0 5.5 c-2.5 -2.3 -1.6 -4 0 -5.5 z"
        fill="currentColor"
      />
      <path d="M4 14 q8 5 16 0 l-2 5 h-12 z" />
    </svg>
  );
}
function KpiIconCamera() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M9 7 l1.5 -3 h3 l1.5 3" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
function KpiIconChat() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.6A8 8 0 0 1 21 12z" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="12.5" cy="12" r="1" fill="currentColor" />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
function KpiIconUsers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="3.5" />
      <path d="M2.5 20 c0 -4 3 -7 6.5 -7 s6.5 3 6.5 7" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M15 20 c0 -3 2 -5 4.5 -5 s2 1 2 5" />
    </svg>
  );
}
function KpiIconUserCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="9" r="3.5" />
      <path d="M3 20 c0 -4 3 -7 7 -7 s7 3 7 7" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}
/** Globe, used by the Site visitors KPI tile. Plain meridians +
 *  equator on a circle. Same stroke weight (2.2) as the other KPI
 *  icons so the row reads as a single family. */
function KpiIconGlobe() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
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
function QuickIconEnvelope() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7 L12 13 L21 7" />
    </svg>
  );
}
