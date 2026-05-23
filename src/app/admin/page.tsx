import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { cache } from "react";
import { prisma, toBhandara } from "@/lib/db";
import {
  approveAction,
  approveSpotAction,
  clearBotQueueAction,
  delistSpotAction,
  extendSpotAction,
  logoutAction,
  publishVerifiedAction,
  refreshNewsAction,
  rejectAction,
  verifyAction,
  unverifyAction,
} from "@/app/admin/actions";
import AdminSearchBox from "@/components/admin/AdminSearchBox";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import SubmitButton from "@/components/admin/SubmitButton";
// NOTE: hard-delete (deleteBhandaraAction / deleteSpotAction) and its
// ConfirmSubmit prompt are intentionally NOT wired into the UI here,
// admin policy is delist-only so historical data is preserved across
// seasons. The server actions remain in `actions.ts` as a defensive
// hatch, but there is no path to trigger them from the dashboard.

export const metadata: Metadata = {
  title: "Admin · BadaMangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
// Server actions on this page run as serverless functions and inherit
// the page's maxDuration. refreshNewsAction in particular fetches 4
// RSS feeds + OG image scrapes + DB writes, can take 20-40s on a
// cold start. Bumping to 60 (Vercel Hobby max) leaves headroom.
export const maxDuration = 60;

// Admin auth check imported from @/lib/admin-auth (one source of
// truth across the 12 places we used to reimplement it).

type SearchParams = Promise<{
  error?: string;
  status?: string;
  q?: string;
  /** "bhandara" (default), moderate listed bhandaras.
   *  "spot" , moderate spotted-live pins (the saffron pulse markers). */
  type?: string;
}>;

function format12h(time: string): string {
  if (!time) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(min).padStart(2, "0")} ${period}`;
}

/**
 * Smart-formatted submission timestamp for the bot-ingest cards.
 *
 *   < 60s        →  "just now"
 *   < 60 min     →  "12 min ago"
 *   < 24 h       →  "5 hr ago"
 *   ≥ 24 h       →  absolute IST: "19 May · 9:15 PM"
 *
 * The relative buckets help the admin triage today's burst (Bada
 * Mangal mornings = lots of incoming spots); the absolute form
 * surfaces stale rows ("why is this still PENDING from 3 days
 * ago?"). The DB stores UTC, the admin team works in IST, explicit
 * timeZone: "Asia/Kolkata" pins the absolute output regardless of
 * which machine renders the page.
 *
 * Server-rendered, so the relative value is accurate AT page-load
 * only. Refreshing the page recomputes. Acceptable for moderation
 * UX since the admin reloads naturally after each action anyway.
 */
function formatSubmissionTime(d: Date): string {
  const date = new Date(d);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return formatAbsoluteIst(date);
  const diffMin = Math.floor(diffMs / (60 * 1000));
  const diffHr = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  return formatAbsoluteIst(date);
}

/** Helper for the absolute branch, "19 May · 9:15 PM" IST. */
function formatAbsoluteIst(d: Date): string {
  const date = d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  const time = d.toLocaleString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  return `${date} · ${time}`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  if (!(await isAdmin())) {
    return <LoginScreen error={Boolean(sp.error)} />;
  }

  // Top-level mode toggle: bhandara (default) / spot / whatsapp bot.
  // Each mode has its own status tabs + counts; the search bar adapts
  // to query fields that make sense for the active mode. The
  // WhatsApp-bot mode is its own *source-of-rows* view rather than a
  // status filter, see WhatsAppBotView for the group-by-source-group
  // breakdown.
  const mode: "bhandara" | "spot" | "whatsapp" =
    sp.type === "spot"
      ? "spot"
      : sp.type === "whatsapp"
        ? "whatsapp"
        : "bhandara";
  const q = (sp.q ?? "").trim();

  if (mode === "spot") {
    // Await the spot view's async body so the page returns its
    // resolved JSX, not a Promise, Next.js can handle either, but
    // awaiting keeps types straight.
    return await SpotsView({ sp, q });
  }
  if (mode === "whatsapp") {
    return await WhatsAppBotView({ sp, q });
  }

  // Tab routing. `?status=` accepts:
  //   ALL        → every row in the DB regardless of status (default
  //                landing tab, the source-of-truth view).
  //   PENDING    → new submissions awaiting the team's confirmation call
  //   UNVERIFIED → live on the map but no verified badge yet
  //   VERIFIED   → live + team-confirmed
  //   REJECTED   → unpublished / delisted
  //
  // (Bot-ingested rows previously had a FROM_BOT tab here; they now
  // live in their own top-level "📱 WhatsApp bot" mode, see
  // WhatsAppBotView. Removing the tab keeps the moderation queue
  // focused on canonical statuses only.)
  const filter = sp.status?.toUpperCase();
  const allowed = ["ALL", "PENDING", "UNVERIFIED", "VERIFIED", "REJECTED"] as const;
  const tab = (allowed as readonly string[]).includes(filter ?? "")
    ? (filter as (typeof allowed)[number])
    : "ALL";

  // Free-text search across name (en/hi), address (en/hi), area,
  // landmark, organizer name + phone, and slug. Case-insensitive,
  // matches anywhere in the field (Prisma `contains`). Empty string
  // / whitespace skips the filter entirely.

  const statusWhere =
    tab === "PENDING"
      ? { status: "PENDING" }
      : tab === "UNVERIFIED"
        ? { status: "APPROVED", isVerified: false }
        : tab === "VERIFIED"
          ? { status: "APPROVED", isVerified: true }
          : tab === "ALL"
            ? {}
            : { status: tab };

  const where = q
    ? {
        AND: [
          statusWhere,
          {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { nameHi: { contains: q, mode: "insensitive" as const } },
              { area: { contains: q, mode: "insensitive" as const } },
              { address: { contains: q, mode: "insensitive" as const } },
              { addressHi: { contains: q, mode: "insensitive" as const } },
              { landmark: { contains: q, mode: "insensitive" as const } },
              {
                organizerName: { contains: q, mode: "insensitive" as const },
              },
              { organizerPhone: { contains: q } },
              { slug: { contains: q, mode: "insensitive" as const } },
            ],
          },
        ],
      }
    : statusWhere;

  // Fan out the list query + every tab count in ONE Promise.all so
  // the supabase pooler does one parallel batch instead of two serial
  // round-trips. On a cold function this is the difference between
  // ~600ms and ~1200ms of pure DB latency before any HTML can stream.
  const [
    records,
    pendingCount,
    unverifiedCount,
    verifiedCount,
    rejectedCount,
    allCount,
  ] = await Promise.all([
    prisma.bhandara.findMany({
      where,
      orderBy: { createdAt: "desc" },
    }),
    prisma.bhandara.count({ where: { status: "PENDING" } }),
    prisma.bhandara.count({
      where: { status: "APPROVED", isVerified: false },
    }),
    prisma.bhandara.count({
      where: { status: "APPROVED", isVerified: true },
    }),
    prisma.bhandara.count({ where: { status: "REJECTED" } }),
    prisma.bhandara.count({}),
  ]);
  // Pair each public-shape Bhandara with the raw DB record so the
  // admin view can still read `status` (which is intentionally
  // stripped from the public Bhandara type, moderation state isn't
  // part of the public contract).
  const bhandaras = records.map((r) => ({
    ...toBhandara(r),
    status: r.status,
  }));
  const countOf = (s: string) =>
    s === "PENDING"
      ? pendingCount
      : s === "UNVERIFIED"
        ? unverifiedCount
        : s === "VERIFIED"
          ? verifiedCount
          : s === "REJECTED"
            ? rejectedCount
            : s === "ALL"
              ? allCount
              : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-10">
      {/* Sticky header strip, title row + search bar + tab pills all
          travel together. `position: sticky` pins it to the top of the
          viewport as the bhandara list scrolls under it. The slight
          translucent background + backdrop blur (cream tinted so it
          matches the page) keeps text legible as cards pass behind. */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-8 pb-3 bg-cream-50/92 backdrop-blur-md border-b border-gold-500/30">
        {/* ── Header row 1: title (left) · auxiliary status + sign-out (right)
            Aux controls grouped here so they don't compete with primary
            navigation for attention. */}
        <header className="flex flex-wrap items-start justify-between gap-3 pb-3">
          <div>
            <p className="font-cormorant text-sm uppercase tracking-[0.25em] text-gold-500">
              Admin · Bhandaras
            </p>
            <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
              Moderation queue
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Bot ingest liveness, renders only after the MacBook has
                pinged at least once. Green pulsing dot when fresh,
                gold when stale, red when offline. */}
            <BotHeartbeat />
            {/* Manual news refresh. Same aggregator as the daily
                Vercel Cron (06:00 IST), use this when you want
                fresh items NOW instead of waiting for the cron
                tick. Takes 5-30s while it fetches 4 RSS feeds +
                OG image scrapes. Look for ?news=refreshed in the
                URL after the redirect to confirm success. */}
            <form action={refreshNewsAction}>
              <SubmitButton variant="outline-ink" pendingLabel="Refreshing news…">
                Refresh news
              </SubmitButton>
            </form>
            <form action={logoutAction}>
              <SubmitButton variant="outline-ink" pendingLabel="Signing out…">
                Sign out
              </SubmitButton>
            </form>
          </div>
        </header>

        {/* ── Header row 2: current view (left) · actions + queues (right)
            ModeToggle anchors the "where you ARE" position. The right
            cluster has primary CTA (Scan & publish, saffron filled,
            most visual weight) followed by cross-queue navigation
            pills (Organise / Volunteer subs / Volunteer registry).
            All wrap onto multiple lines on narrow viewports. */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <ModeToggle current="bhandara" />
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="/admin/scan"
              className="inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-warm"
            >
              ✨ Scan &amp; publish
            </a>
            <OrganiseRequestsLink />
            <VolunteerSubmissionsLink />
            <VolunteersRegistryLink />
          </div>
        </div>

      {/* Instant search: AdminSearchBox is a tiny client component
          that debounces keystrokes and `router.replace`s the URL with
          a fresh `?q=…`. The page itself stays a server component, so
          Prisma still runs the filter, the only thing that changed
          is *when* the navigation fires (every keystroke instead of
          on submit). URL stays bookmarkable, tab-preservation still
          works via the `status` prop. */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <AdminSearchBox status={tab} />
        {q ? (
          <span className="text-xs text-ink-600 ml-auto">
            <span className="font-numerals tabular-nums font-semibold text-sindoor-700">
              {bhandaras.length}
            </span>
            {" match"}
            {bhandaras.length === 1 ? "" : "es"} for
            <span className="ml-1 px-1.5 py-0.5 rounded bg-saffron-50 border border-saffron-500/40 font-mono">
              {q}
            </span>
          </span>
        ) : null}
      </div>

      {/* Filter tabs, bot-ingested rows have moved to their own
          top-level "📱 WhatsApp bot" mode (see ModeToggle). */}
      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        {(
          ["ALL", "PENDING", "UNVERIFIED", "VERIFIED", "REJECTED"] as const
        ).map((s) => {
          const active = s === tab;
          // Preserve the active search across tab changes, admins
          // often want to narrow their search result by status.
          const href = q
            ? `/admin?status=${s}&q=${encodeURIComponent(q)}`
            : `/admin?status=${s}`;
          return (
            <a
              key={s}
              href={href}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border transition-colors ${
                active
                  ? "bg-saffron-600 border-saffron-600 text-cream-50"
                  : "bg-cream-50 border-gold-500/40 text-ink-600 hover:border-saffron-500"
              }`}
            >
              {s === "PENDING"
                ? "Needs call"
                : s === "UNVERIFIED"
                  ? "Live · unverified"
                  : s === "VERIFIED"
                    ? "Verified"
                    : s === "REJECTED"
                      ? "Rejected"
                      : "All"}
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 ${
                  active ? "bg-cream-50/20" : "bg-gold-100"
                }`}
              >
                {countOf(s)}
              </span>
            </a>
          );
        })}
      </nav>
      </div>

      {/* List */}
      {bhandaras.length === 0 ? (
        <p className="mt-12 text-center text-ink-600">
          {q
            ? `No bhandaras match “${q}” in the ${tab.toLowerCase()} tab.`
            : `Nothing in “${tab.toLowerCase()}” right now.`}
        </p>
      ) : (
        <ul className="mt-6 grid gap-5">
          {bhandaras.map((b) => {
            // Compute the row's *actual* state, used for both the
            // status pill and the action-button cluster. The previous
            // logic keyed off `tab`, which was wrong on the ALL tab
            // (mixed statuses) and made the buttons offer the wrong
            // verbs for the row's real state.
            const rowState: "PENDING" | "UNVERIFIED" | "VERIFIED" | "REJECTED" =
              b.status === "PENDING"
                ? "PENDING"
                : b.status === "REJECTED"
                  ? "REJECTED"
                  : b.isVerified
                    ? "VERIFIED"
                    : "UNVERIFIED";
            // Detect bot-ingested rows by the `[bot:` prefix /api/bot/ingest
            // embeds into the description column. Shows a "📱 From bot"
            // pill on the card so the admin can spot the queue at a glance.
            const isFromBot =
              typeof b.description === "string" &&
              b.description.includes("[bot:");
            return (
            <li
              key={b.id}
              id={b.id}
              className={`rounded-2xl border bg-cream-50 p-5 sm:p-6 ${
                isFromBot
                  ? "border-sindoor-700/35 bg-saffron-50/30"
                  : "border-gold-500/40"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* Photo thumbnail + name block.
                    The bhandara list previously rendered photoUrl only as
                    a text Row inside the dl below, admins had to click
                    the URL to see what they were reviewing. Now the
                    photo sits left of the name, same pattern the Spots
                    view already uses. Falls back to a 🕉️ glyph for the
                    rare row without an attached image. */}
                <div className="flex items-start gap-4 min-w-0">
                  {b.photoUrl ? (
                    // Wrap the thumbnail in a new-tab link so the admin can
                    // see the *full-resolution* invite poster, text on the
                    // 80px thumb is unreadable for any banner with more than
                    // a sentence or two of Hindi. `noopener` keeps the
                    // launched tab from being able to script back into the
                    // admin window.
                    <a
                      href={b.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 group block focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600 rounded-xl"
                      aria-label="Open full image in a new tab"
                      title="Open full image"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.photoUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover border border-gold-500/40 bg-cream-50 group-hover:border-saffron-500 transition-colors"
                      />
                    </a>
                  ) : (
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl border border-dashed border-gold-500/40 bg-saffron-50 grid place-items-center text-2xl text-saffron-600 shrink-0">
                      🕉️
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="font-tiro text-2xl text-sindoor-700">
                      {b.nameHi}
                    </h2>
                    <p className="font-fraunces text-lg text-ink-900">{b.name}</p>
                    <p className="mt-1 text-sm text-ink-600">
                      {b.area}
                      {b.landmark ? ` · ${b.landmark}` : ""} ·{" "}
                      {format12h(b.timeStart)}
                      {b.timeEnd ? `–${format12h(b.timeEnd)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {isFromBot ? (
                    <span className="text-[11px] uppercase tracking-wider rounded-full px-2.5 py-1 border bg-sindoor-700/8 border-sindoor-700/40 text-sindoor-700">
                      📱 From bot
                    </span>
                  ) : null}
                  <span
                    className={`text-[11px] uppercase tracking-wider rounded-full px-2.5 py-1 border ${
                      rowState === "VERIFIED"
                        ? "bg-leaf-600/12 border-leaf-600/55 text-leaf-600"
                        : rowState === "PENDING"
                          ? "bg-saffron-50 border-saffron-500/55 text-saffron-600"
                          : rowState === "REJECTED"
                            ? "bg-alert-500/10 border-alert-500/55 text-alert-500"
                            : "bg-cream-50 border-gold-500/40 text-ink-600"
                    }`}
                  >
                    {rowState === "VERIFIED"
                      ? "✓ Verified"
                      : rowState === "PENDING"
                        ? "Needs call"
                        : rowState === "REJECTED"
                          ? "Unpublished"
                          : "Live · unverified"}
                  </span>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                <Row label="Address" value={b.address} />
                <Row label="Coords" value={`${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}`} />
                <Row
                  label="Tuesdays"
                  value={b.tuesdayDates.join(", ")}
                />
                <Row
                  label="Menu"
                  value={b.menu.join(", ")}
                />
                <Row
                  label="Organizer"
                  value={`${b.organizerName} · ${b.organizerPhone}${
                    b.organizerWhatsapp ? ` · WA ${b.organizerWhatsapp}` : ""
                  }`}
                />
                {b.upiId ? <Row label="UPI" value={b.upiId} /> : null}
                {/* Photo is now rendered as a thumbnail in the card
                    header above; the URL itself stays accessible as
                    a link for admins who need to copy or open it. */}
                {b.photoUrl ? (
                  <Row label="Photo URL" value={b.photoUrl} />
                ) : null}
                {b.description ? (
                  <Row label="Description" value={b.description} wide />
                ) : null}
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                {rowState === "PENDING" ? (
                  <>
                    {/* Edit-first for bot-ingested rows: Gemini typically
                        misses lat/lng and often the organizer phone, so
                        the admin needs the edit form before the listing
                        goes live. We surface this button first for bot
                        rows; non-bot PENDING rows (manual submissions
                        that need a callback) keep the original "Called &
                        confirmed" green as the first action. */}
                    {isFromBot ? (
                      <Link
                        href={`/admin/edit/${b.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm"
                      >
                        ✎ Edit &amp; publish
                      </Link>
                    ) : null}
                    <form action={publishVerifiedAction.bind(null, b.id)}>
                      <SubmitButton
                        variant={isFromBot ? "outline-leaf" : "primary-green"}
                        pendingLabel="Publishing…"
                      >
                        ✓ Called &amp; confirmed, publish
                      </SubmitButton>
                    </form>
                    {!isFromBot ? (
                      <Link
                        href={`/admin/edit/${b.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink-600 text-ink-900 hover:bg-cream-50 font-medium px-4 py-2 text-sm"
                      >
                        ✎ Edit
                      </Link>
                    ) : null}
                    <form action={approveAction.bind(null, b.id)}>
                      <SubmitButton
                        variant="outline-saffron"
                        pendingLabel="Publishing…"
                      >
                        Publish without badge
                      </SubmitButton>
                    </form>
                    <form action={rejectAction.bind(null, b.id)}>
                      <SubmitButton
                        variant="outline-alert"
                        pendingLabel="Rejecting…"
                        confirm="Reject this bhandara?"
                      >
                        Reject
                      </SubmitButton>
                    </form>
                  </>
                ) : rowState === "UNVERIFIED" ? (
                  <>
                    <form action={verifyAction.bind(null, b.id)}>
                      <SubmitButton
                        variant="primary-green"
                        pendingLabel="Verifying…"
                      >
                        ✓ Mark as Verified
                      </SubmitButton>
                    </form>
                    {/* Edit on every live row, previously only PENDING
                        rows had an Edit path, so the only way to fix
                        wrong coordinates / typos on a Live row was via
                        Delist → re-edit → re-approve, which had a
                        public-facing downtime window. /admin/edit/[id]
                        already works for any status; we just needed the
                        link surfaced everywhere. */}
                    <Link
                      href={`/admin/edit/${b.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink-600/45 text-ink-900 hover:bg-cream-50 font-medium px-4 py-2 text-sm"
                    >
                      ✎ Edit
                    </Link>
                    <a
                      href={`/bhandara/${b.slug}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-4 py-2 text-sm"
                    >
                      View public page ↗
                    </a>
                    <form action={rejectAction.bind(null, b.id)}>
                      <SubmitButton
                        variant="outline-alert"
                        pendingLabel="Delisting…"
                        confirm="Delist this listing from the public site?"
                      >
                        Delist
                      </SubmitButton>
                    </form>
                  </>
                ) : rowState === "VERIFIED" ? (
                  <>
                    <Link
                      href={`/admin/edit/${b.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink-600/45 text-ink-900 hover:bg-cream-50 font-medium px-4 py-2 text-sm"
                    >
                      ✎ Edit
                    </Link>
                    <a
                      href={`/bhandara/${b.slug}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-4 py-2 text-sm"
                    >
                      View public page ↗
                    </a>
                    <form action={unverifyAction.bind(null, b.id)}>
                      {/* Outline-gold variant isn't in SubmitButton's
                          preset list (gold is used so rarely it didn't
                          earn a slot); fall back to outline-saffron
                          which reads as "secondary destructive-ish"
                          and matches the other rollback CTAs. */}
                      <SubmitButton
                        variant="outline-saffron"
                        pendingLabel="Removing…"
                        confirm="Remove the verification badge?"
                      >
                        Remove verification
                      </SubmitButton>
                    </form>
                    <form action={rejectAction.bind(null, b.id)}>
                      <SubmitButton
                        variant="outline-alert"
                        pendingLabel="Delisting…"
                        confirm="Delist this listing from the public site?"
                      >
                        Delist
                      </SubmitButton>
                    </form>
                  </>
                ) : (
                  // REJECTED row, Edit + Re-publish.
                  <>
                    <Link
                      href={`/admin/edit/${b.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink-600/45 text-ink-900 hover:bg-cream-50 font-medium px-4 py-2 text-sm"
                    >
                      ✎ Edit
                    </Link>
                    <form action={approveAction.bind(null, b.id)}>
                      <SubmitButton
                        variant="primary-green"
                        pendingLabel="Republishing…"
                      >
                        Re-publish
                      </SubmitButton>
                    </form>
                  </>
                )}

              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Compact pill toggle between the Bhandara and Spot moderation views.
 * The "other" mode is rendered as a link so a single click hops the
 * admin between queues without losing their place.
 */
/**
 * Top-of-queue counts for the three Mode tabs + the Organise link.
 * React.cache dedupes within a single request, so ModeToggle and
 * OrganiseRequestsLink can both call this without firing the
 * underlying COUNT queries twice. 4 quick parallel reads.
 *
 *   bhandaraPending, rows awaiting admin moderation (status=PENDING)
 *   spotLive       , APPROVED spots currently visible (not yet
 *                     past expiresAt); the actionable Spotted view
 *   whatsappBot    , bot-ingested PENDING bhandaras specifically
 *                     (`[bot:` prefix in description). Doesn't
 *                     include spotted-via-bot rows since those auto-
 *                     approve on ingest; admin only revisits if a
 *                     spot needs delisting.
 *   organiseNew    , fresh leads in /admin/organise (status=NEW)
 */
const getAdminTabCounts = cache(async () => {
  const now = new Date();
  const [
    bhandaraPending,
    spotLive,
    whatsappBot,
    organiseNew,
    volunteerNew,
    volunteerPending,
    mentionsPending,
  ] = await Promise.all([
    prisma.bhandara.count({ where: { status: "PENDING" } }),
    prisma.spot.count({
      where: { status: "APPROVED", expiresAt: { gt: now } },
    }),
    prisma.bhandara.count({
      where: {
        status: "PENDING",
        description: { contains: "[bot:" },
      },
    }),
    prisma.organiseRequest.count({ where: { status: "NEW" } }),
    prisma.volunteerSubmission.count({ where: { status: "NEW" } }),
    // PENDING signups in the volunteer programme, admin must
    // approve each before a code can be issued. Surfaced as a
    // count badge on the "👥 Volunteers" pill so the admin sees
    // unactioned applications without having to click in.
    prisma.volunteer.count({ where: { status: "PENDING" } }),
    // PENDING WhatsApp text-message mentions (fed by /api/bot/message).
    // Surfaced as a count badge on the "💬 Mentions" link so the
    // admin sees the chatter-moderation backlog without leaving the
    // main /admin view. Routes to /admin/mentions (separate page,
    // not a tab on /admin).
    prisma.bhandaraMention.count({ where: { status: "PENDING" } }),
  ]);
  return {
    bhandaraPending,
    spotLive,
    whatsappBot,
    organiseNew,
    volunteerNew,
    volunteerPending,
    mentionsPending,
  };
});

/**
 * Small count chip rendered next to a button label. Auto-hides when
 * the count is 0 so the nav doesn't read as a wall of zeros, and
 * shows "99+" when crossing three digits to keep the chip width
 * stable across breakpoints. Variants tint the chip to match its
 * parent button's tone (saffron/sindoor/gold).
 */
function CountBadge({
  n,
  tone,
}: {
  n: number;
  tone: "saffron" | "sindoor" | "gold" | "ink";
}) {
  if (n <= 0) return null;
  const display = n > 99 ? "99+" : String(n);
  const cls = {
    saffron: "bg-saffron-600 text-cream-50",
    sindoor: "bg-sindoor-700 text-cream-50",
    gold: "bg-gold-500 text-cream-50",
    ink: "bg-ink-900 text-cream-50",
  }[tone];
  return (
    <span
      className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[0.65rem] font-numerals font-semibold tabular-nums leading-none ${cls}`}
      title={`${n} item${n === 1 ? "" : "s"}`}
    >
      {display}
    </span>
  );
}

async function ModeToggle({
  current,
}: {
  current: "bhandara" | "spot" | "whatsapp";
}) {
  // Three top-level admin queues. "WhatsApp bot" is its own slot
  // (distinct sindoor styling) because it's a *source*, not a
  // *status*, it holds rows from the WhatsApp ingest pipeline that
  // are awaiting admin review, grouped by their source group.
  //
  // Each item now shows a count badge of its actionable items
  // (PENDING bhandaras, LIVE spots, PENDING bot rows) so the team
  // sees backlog without having to click each tab. Counts source
  // from the shared cached getAdminTabCounts() call above.
  const counts = await getAdminTabCounts();
  const items = [
    { id: "bhandara", label: "Bhandaras", href: "/admin", count: counts.bhandaraPending },
    { id: "spot", label: "Spotted", href: "/admin?type=spot", count: counts.spotLive },
    {
      id: "whatsapp",
      label: "📱 WhatsApp bot",
      href: "/admin?type=whatsapp",
      count: counts.whatsappBot,
    },
    // Mentions is a separate page (/admin/mentions, not a ?type filter
    // on /admin) so clicking this navigates AWAY from the tab bar. The
    // tab can never appear active here, by design — it's a discovery
    // link to the chatter-moderation queue, not part of the bhandara
    // / spot / bot triage flow.
    {
      id: "mentions",
      label: "💬 Mentions",
      href: "/admin/mentions",
      count: counts.mentionsPending,
    },
    // Discover-on-the-web tool (Gemini grounded search → PENDING
    // bhandaras). Separate page like /admin/mentions; no count badge
    // because it's a manual-run tool, not a queue.
    {
      id: "discover",
      label: "🔎 Discover",
      href: "/admin/discover",
      count: 0,
    },
  ] as const;
  return (
    <div className="inline-flex rounded-full border border-gold-500/40 bg-cream-50 p-1 text-sm">
      {items.map((it) => {
        const active = it.id === current;
        const isWa = it.id === "whatsapp";
        return (
          <a
            key={it.id}
            href={it.href}
            className={`inline-flex items-center px-3 py-1 rounded-full transition-colors ${
              active
                ? isWa
                  ? "bg-sindoor-700 text-cream-50 shadow-warm"
                  : "bg-saffron-600 text-cream-50 shadow-warm"
                : "text-ink-600 hover:text-sindoor-700"
            }`}
          >
            {it.label}
            {/* Badge tone: when the tab is active, use a quiet "ink"
                chip so it doesn't fight with the filled tab background.
                When inactive, use the tab's brand tone (saffron for
                Bhandaras/Spotted, sindoor for WhatsApp). */}
            <CountBadge
              n={it.count}
              tone={
                active
                  ? "ink"
                  : isWa
                    ? "sindoor"
                    : "saffron"
              }
            />
          </a>
        );
      })}
    </div>
  );
}

/**
 * Header link to /admin/organise with a NEW-count badge. Async so it
 * can pull the count itself (same cached getAdminTabCounts call as
 * ModeToggle, so they share one DB roundtrip per request). Renders
 * the gold-outline pill that visually pairs with the saffron-filled
 * "Scan & publish" CTA next to it.
 */
async function OrganiseRequestsLink() {
  const counts = await getAdminTabCounts();
  return (
    <a
      href="/admin/organise"
      className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/55 text-sindoor-700 hover:bg-gold-500/10 font-medium px-4 py-2 text-sm"
    >
      📋 Organise requests
      <CountBadge n={counts.organiseNew} tone="gold" />
    </a>
  );
}

/**
 * Header link to the volunteer-programme moderation queue. Same
 * gold-outline pill style as OrganiseRequestsLink. NEW count comes
 * from the shared getAdminTabCounts cache, single DB roundtrip
 * even though it's the 5th caller. The 🧑‍🤝‍🧑 emoji signals "this is
 * people-managed" vs the OrganiseRequest's 📋 (which is paperwork).
 */
async function VolunteerSubmissionsLink() {
  const counts = await getAdminTabCounts();
  return (
    <a
      href="/admin/volunteer-submissions"
      className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/55 text-sindoor-700 hover:bg-gold-500/10 font-medium px-4 py-2 text-sm"
    >
      📥 Volunteer submissions
      <CountBadge n={counts.volunteerNew} tone="saffron" />
    </a>
  );
}

/**
 * Header link to the Volunteer registry (the directory of all
 * signed-up volunteers + per-volunteer earnings + the weekly
 * payout CSV + the PENDING approval queue). Companion to
 * VolunteerSubmissionsLink, that one shows work submitted by
 * approved volunteers, this one shows the people behind it.
 *
 * NEW-count badge surfaces PENDING applications waiting for
 * admin approval (admin needs to issue codes via WhatsApp before
 * the volunteer can do anything). Same getAdminTabCounts cache
 * as the other pill counts, single roundtrip.
 */
async function VolunteersRegistryLink() {
  const counts = await getAdminTabCounts();
  return (
    <a
      href="/admin/volunteers"
      className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/55 text-sindoor-700 hover:bg-gold-500/10 font-medium px-4 py-2 text-sm"
    >
      👥 Volunteers
      <CountBadge n={counts.volunteerPending} tone="saffron" />
    </a>
  );
}

// ────────────────────────────────────────────────────────────────────
// Spots moderation view
// ────────────────────────────────────────────────────────────────────
//
// Spots are simpler than bhandaras:
//   • Status: APPROVED or REJECTED only (no PENDING / VERIFIED).
//   • Auto-expire 8 h after createdAt, once past `expiresAt`, they
//     vanish from the public map even though `status` may still be
//     APPROVED. The "Live" tab below filters on both conditions.
// Tabs:
//   • ALL      → every spot ever recorded
//   • LIVE     → APPROVED + not yet expired (these are the pulsing
//                pins users see on the city map right now)
//   • EXPIRED  → APPROVED but past expiresAt (read-only history)
//   • REJECTED → manually delisted
async function SpotsView({
  sp,
  q,
}: {
  // Re-decode searchParams here because the Promise was already
  // awaited up in AdminPage, passing the resolved value avoids a
  // second await.
  sp: { status?: string; q?: string; type?: string };
  q: string;
}) {
  const filter = sp.status?.toUpperCase();
  const allowed = ["ALL", "LIVE", "EXPIRED", "REJECTED"] as const;
  const tab = (allowed as readonly string[]).includes(filter ?? "")
    ? (filter as (typeof allowed)[number])
    : "ALL";

  const now = new Date();
  const statusWhere =
    tab === "LIVE"
      ? { status: "APPROVED", expiresAt: { gt: now } }
      : tab === "EXPIRED"
        ? { status: "APPROVED", expiresAt: { lte: now } }
        : tab === "REJECTED"
          ? { status: "REJECTED" }
          : {};

  // Spot search hits the human-facing fields: caption, area, address,
  // and reporter name. Phone is hashed (`reporterPhoneHash`) so we
  // skip it, there's nothing useful to type-search there.
  const where = q
    ? {
        AND: [
          statusWhere,
          {
            OR: [
              { caption: { contains: q, mode: "insensitive" as const } },
              { area: { contains: q, mode: "insensitive" as const } },
              { address: { contains: q, mode: "insensitive" as const } },
              {
                reporterName: { contains: q, mode: "insensitive" as const },
              },
            ],
          },
        ],
      }
    : statusWhere;

  // Single parallel batch, same speed-up as the Bhandaras view.
  const [spots, liveCount, expiredCount, rejectedCount, allCount] =
    await Promise.all([
      prisma.spot.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          bhandara: { select: { slug: true, name: true, nameHi: true } },
        },
      }),
      prisma.spot.count({
        where: { status: "APPROVED", expiresAt: { gt: now } },
      }),
      prisma.spot.count({
        where: { status: "APPROVED", expiresAt: { lte: now } },
      }),
      prisma.spot.count({ where: { status: "REJECTED" } }),
      prisma.spot.count({}),
    ]);
  const countOf = (s: string) =>
    s === "LIVE"
      ? liveCount
      : s === "EXPIRED"
        ? expiredCount
        : s === "REJECTED"
          ? rejectedCount
          : s === "ALL"
            ? allCount
            : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-10">
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-8 pb-3 bg-cream-50/92 backdrop-blur-md border-b border-gold-500/30">
        {/* Mirrors BhandarasView's 2-row header, same hierarchy so the
            admin's eye lands on the right thing regardless of which
            mode tab they're on. */}
        <header className="flex flex-wrap items-start justify-between gap-3 pb-3">
          <div>
            <p className="font-cormorant text-sm uppercase tracking-[0.25em] text-gold-500">
              Admin · Spotted
            </p>
            <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
              Live spots queue
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <BotHeartbeat />
            <form action={logoutAction}>
              <SubmitButton variant="outline-ink" pendingLabel="Signing out…">
                Sign out
              </SubmitButton>
            </form>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <ModeToggle current="spot" />
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="/admin/scan"
              className="inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-warm"
            >
              ✨ Scan &amp; publish
            </a>
            <OrganiseRequestsLink />
            <VolunteerSubmissionsLink />
            <VolunteersRegistryLink />
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <AdminSearchBox status={tab} type="spot" />
          {q ? (
            <span className="text-xs text-ink-600 ml-auto">
              <span className="font-numerals tabular-nums font-semibold text-sindoor-700">
                {spots.length}
              </span>
              {" match"}
              {spots.length === 1 ? "" : "es"} for
              <span className="ml-1 px-1.5 py-0.5 rounded bg-saffron-50 border border-saffron-500/40 font-mono">
                {q}
              </span>
            </span>
          ) : null}
        </div>

        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          {(["ALL", "LIVE", "EXPIRED", "REJECTED"] as const).map((s) => {
            const active = s === tab;
            const href = q
              ? `/admin?type=spot&status=${s}&q=${encodeURIComponent(q)}`
              : `/admin?type=spot&status=${s}`;
            return (
              <a
                key={s}
                href={href}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border transition-colors ${
                  active
                    ? "bg-saffron-600 border-saffron-600 text-cream-50"
                    : "bg-cream-50 border-gold-500/40 text-ink-600 hover:border-saffron-500"
                }`}
              >
                {s === "LIVE"
                  ? "Live now"
                  : s === "EXPIRED"
                    ? "Expired"
                    : s === "REJECTED"
                      ? "Rejected"
                      : "All"}
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 ${
                    active ? "bg-cream-50/20" : "bg-gold-100"
                  }`}
                >
                  {countOf(s)}
                </span>
              </a>
            );
          })}
        </nav>
      </div>

      {spots.length === 0 ? (
        <p className="mt-12 text-center text-ink-600">
          {q
            ? `No spots match “${q}” in the ${tab.toLowerCase()} tab.`
            : `Nothing in “${tab.toLowerCase()}” right now.`}
        </p>
      ) : (
        <ul className="mt-6 grid gap-5">
          {spots.map((s) => {
            const isExpired = s.expiresAt.getTime() <= now.getTime();
            const isRejected = s.status === "REJECTED";
            const stateLabel = isRejected
              ? "Rejected"
              : isExpired
                ? "Expired"
                : "Live";
            const stateClass = isRejected
              ? "bg-alert-500/10 border-alert-500/55 text-alert-500"
              : isExpired
                ? "bg-cream-50 border-gold-500/40 text-ink-600"
                : "bg-leaf-600/12 border-leaf-600/55 text-leaf-600";

            const hoursLeft =
              (s.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
            const expiryLabel = isExpired
              ? `Expired ${Math.abs(hoursLeft).toFixed(1)} h ago`
              : `Live · ${hoursLeft.toFixed(1)} h left`;

            return (
              <li
                key={s.id}
                className="rounded-2xl border border-gold-500/40 bg-cream-50 p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-4 min-w-0">
                    {s.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.photoUrl}
                        alt=""
                        className="h-20 w-20 rounded-xl object-cover border border-gold-500/40 shrink-0"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-xl border border-dashed border-gold-500/40 bg-saffron-50 grid place-items-center text-2xl text-saffron-600 shrink-0">
                        🪔
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-fraunces text-lg text-ink-900">
                        {s.caption ?? <em className="text-ink-600">No caption</em>}
                      </p>
                      <p className="mt-1 text-sm text-ink-600">
                        {s.area ?? "Unknown area"}
                        {s.bhandara?.name
                          ? ` · linked to ${s.bhandara.name}`
                          : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-600 font-numerals tabular-nums">
                        {s.lat.toFixed(4)}, {s.lng.toFixed(4)} ·{" "}
                        {new Date(s.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] uppercase tracking-wider rounded-full px-2.5 py-1 border ${stateClass}`}
                  >
                    {stateLabel}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                  {s.address ? <Row label="Address" value={s.address} /> : null}
                  <Row label="Status" value={`${s.status} · ${expiryLabel}`} />
                  <Row
                    label="Reporter"
                    value={`${s.reporterName ?? "anon"} · ${s.language}`}
                  />
                  <Row label="IP hash" value={s.ipHash.slice(0, 18) + "…"} />
                </dl>

                <div className="mt-5 flex flex-wrap gap-2">
                  {/* Edit & approve is available on every spot, caption
                      typos, area mis-tags, and coord fixes are common
                      after the initial APPROVED-by-default flow. Loops
                      back to /admin?type=spot on save. */}
                  <Link
                    href={`/admin/edit-spot/${s.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink-600/45 text-ink-900 hover:bg-cream-50 font-medium px-4 py-2 text-sm"
                  >
                    ✎ Edit
                  </Link>
                  {!isRejected ? (
                    <form action={delistSpotAction.bind(null, s.id)}>
                      <SubmitButton
                        variant="outline-alert"
                        pendingLabel="Delisting…"
                        confirm="Delist this spot from the map?"
                      >
                        Delist
                      </SubmitButton>
                    </form>
                  ) : (
                    <form action={approveSpotAction.bind(null, s.id)}>
                      <SubmitButton
                        variant="primary-green"
                        pendingLabel="Re-approving…"
                      >
                        Re-approve
                      </SubmitButton>
                    </form>
                  )}
                  {(isExpired || isRejected) ? (
                    <form action={extendSpotAction.bind(null, s.id)}>
                      <SubmitButton
                        variant="outline-saffron"
                        pendingLabel="Extending…"
                      >
                        + 8 h &amp; approve
                      </SubmitButton>
                    </form>
                  ) : null}
                  {s.bhandara?.slug ? (
                    <a
                      href={`/bhandara/${s.bhandara.slug}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center rounded-full border-2 border-gold-500 text-gold-500 hover:bg-gold-500 hover:text-cream-50 font-medium px-4 py-2 text-sm"
                    >
                      Linked bhandara ↗
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// WhatsApp bot moderation view
// ────────────────────────────────────────────────────────────────────
//
// A *source-of-rows* queue (not a status filter). Surfaces everything
// the WhatsApp ingest pipeline has dropped into the DB, both Bhandara
// invite posters and Spot live-photos, grouped by the originating
// WhatsApp group so the admin can drain one group's submissions at a
// time.
//
// Row provenance comes from the ingest tag the bot endpoint embeds
// into description (for Bhandaras) / caption (for Spots):
//   [bot:whatsapp · from:<sender · group> · msg:<id> · <timestamp>]
// We parse that tag once per row and surface group + sender prominently
// at the top of each card so the admin can see who flagged what.

/** Pull sender + group + msgId out of the [bot:…] tag. */
function parseBotTag(text: string | null | undefined): {
  sender: string;
  group: string;
  msgId: string;
} {
  if (!text) return { sender: "", group: "", msgId: "" };
  // Liberal match, bot tag may appear at the start of description or
  // appended after the model-extracted prose with a blank line in
  // between. We capture the from/msg/timestamp fragment regardless of
  // surrounding whitespace.
  const m = text.match(
    /\[bot:whatsapp\s*·\s*from:([^\n\]]+?)(?:\s*·\s*msg:([^·\]]+?))?\s*·\s*\d{4}-\d{2}-\d{2}[^\]]*\]/,
  );
  if (!m) return { sender: "", group: "", msgId: "" };
  const fromField = (m[1] ?? "").trim();
  // The ingester encodes from-with-group as "Sender · Group Name".
  // Split on the first " · " to peel off the group; anything after is
  // the group name (groups can themselves contain "·" in their subject
  //, we re-join the trailing parts so we don't truncate).
  const parts = fromField.split(/\s*·\s*/);
  const sender = parts.shift() ?? "";
  const group = parts.join(" · ").trim();
  return { sender: sender.trim(), group, msgId: (m[2] ?? "").trim() };
}

type BotBhandara = ReturnType<typeof toBhandara> & {
  status: string;
  createdAt: Date;
  _bot: ReturnType<typeof parseBotTag>;
};
type BotSpot = {
  id: string;
  caption: string | null;
  // Spots are inserted with a non-null photoUrl by /api/bot/ingest,
  // but the Prisma Spot.photoUrl column type is `String?` (nullable)
  // so the type system still surfaces `string | null` here. We
  // render an empty/placeholder photo if it ever lands null, which
  // shouldn't happen via the bot pipeline, but we don't want a runtime
  // crash if it does.
  photoUrl: string | null;
  area: string | null;
  address: string | null;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  _bot: ReturnType<typeof parseBotTag>;
};

async function WhatsAppBotView({
  sp,
  q,
}: {
  sp: { status?: string; q?: string; type?: string };
  q: string;
}) {
  // The "sub-tab" inside this view picks between the two row types
  // the bot produces. Default to invites since that's the bulk of the
  // pipeline (live-photo forwards are rarer).
  const sub: "bhandara" | "spot" =
    sp.status?.toLowerCase() === "spot" ? "spot" : "bhandara";

  // Free-text search inside the bot queue. Hits the same human fields
  // the bhandara moderation list does, plus the tag fragment so admins
  // can search "Aliganj" or "Prateek" and find the rows whose group
  // matched.
  const qFilter = q.trim();
  const bhandaraWhere = qFilter
    ? {
        AND: [
          { description: { contains: "[bot:" } },
          {
            OR: [
              { name: { contains: qFilter, mode: "insensitive" as const } },
              { nameHi: { contains: qFilter, mode: "insensitive" as const } },
              { area: { contains: qFilter, mode: "insensitive" as const } },
              { address: { contains: qFilter, mode: "insensitive" as const } },
              {
                description: {
                  contains: qFilter,
                  mode: "insensitive" as const,
                },
              },
              {
                organizerName: {
                  contains: qFilter,
                  mode: "insensitive" as const,
                },
              },
            ],
          },
        ],
      }
    : { description: { contains: "[bot:" } };
  const spotWhere = qFilter
    ? {
        AND: [
          { ipHash: "bot:whatsapp" },
          {
            OR: [
              { caption: { contains: qFilter, mode: "insensitive" as const } },
              { area: { contains: qFilter, mode: "insensitive" as const } },
              { address: { contains: qFilter, mode: "insensitive" as const } },
            ],
          },
        ],
      }
    : { ipHash: "bot:whatsapp" };

  const [bhandaraRows, spotRows, bhandaraTotal, spotTotal] = await Promise.all([
    prisma.bhandara.findMany({
      where: bhandaraWhere,
      orderBy: { createdAt: "desc" },
    }),
    prisma.spot.findMany({
      where: spotWhere,
      orderBy: { createdAt: "desc" },
    }),
    prisma.bhandara.count({ where: { description: { contains: "[bot:" } } }),
    prisma.spot.count({ where: { ipHash: "bot:whatsapp" } }),
  ]);

  // Decode the bot tag once per row so render-time stays cheap.
  const bhandaras: BotBhandara[] = bhandaraRows.map((r) => ({
    ...toBhandara(r),
    status: r.status,
    createdAt: r.createdAt,
    _bot: parseBotTag(r.description),
  }));
  const spots: BotSpot[] = spotRows.map((s) => ({
    id: s.id,
    caption: s.caption,
    photoUrl: s.photoUrl,
    area: s.area,
    address: s.address,
    status: s.status,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    _bot: parseBotTag(s.caption),
  }));

  // Group rows by source WhatsApp group. Unknown / empty group falls
  // into "(no group detected)", usually means an older row from
  // before the ingester started forwarding group names, or a manual
  // curl smoke test.
  const groupBhandaras = groupBy(bhandaras, (b) => b._bot.group || "(no group detected)");
  const groupSpots = groupBy(spots, (s) => s._bot.group || "(no group detected)");

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-8 pb-3 bg-cream-50/92 backdrop-blur-md border-b border-gold-500/30">
        {/* Mirrors the 2-row header of the other admin views. Difference
            here: there's no "Scan & publish" CTA (this view ingests
            from WhatsApp, not from manual scan), and we keep "Clear
            queue" as the destructive maintenance action grouped with
            the other view-scoped controls. */}
        <header className="flex flex-wrap items-start justify-between gap-3 pb-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-600">
              Source · WhatsApp ingest
            </p>
            <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
              📱 WhatsApp bot
            </h1>
            <p className="mt-1 text-sm text-ink-600">
              Auto-classified images forwarded into bhandara groups.
              Grouped by source group below.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <BotHeartbeat />
            <form action={logoutAction}>
              <SubmitButton variant="outline-ink" pendingLabel="Signing out…">
                Sign out
              </SubmitButton>
            </form>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <ModeToggle current="whatsapp" />
          <div className="flex items-center gap-2 flex-wrap">
            <form action={clearBotQueueAction}>
              <SubmitButton
                variant="outline-alert"
                pendingLabel="Clearing…"
                confirm="This permanently deletes EVERY bot-ingested row (both bhandaras and spots), no undo. Continue?"
              >
                🗑 Clear queue
              </SubmitButton>
            </form>
            <OrganiseRequestsLink />
            <VolunteerSubmissionsLink />
            <VolunteersRegistryLink />
          </div>
        </div>

        {/* Search bar, same shape as the bhandara view so muscle memory
            translates. The status prop is ignored by AdminSearchBox in
            this mode because the parent route forwards ?type=whatsapp. */}
        <div className="mt-5">
          <AdminSearchBox status={sub} type="whatsapp" />
        </div>

        {/* Sub-tabs: bhandara invites vs spot photos */}
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          {(
            [
              { id: "bhandara", label: "Bhandara invites", count: bhandaraTotal },
              { id: "spot", label: "Spot photos", count: spotTotal },
            ] as const
          ).map((it) => {
            const active = it.id === sub;
            const href = qFilter
              ? `/admin?type=whatsapp&status=${it.id}&q=${encodeURIComponent(qFilter)}`
              : `/admin?type=whatsapp&status=${it.id}`;
            return (
              <a
                key={it.id}
                href={href}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border transition-colors ${
                  active
                    ? "bg-sindoor-700 border-sindoor-700 text-cream-50"
                    : "bg-cream-50 border-sindoor-700/40 text-sindoor-700 hover:border-sindoor-700"
                }`}
              >
                {it.label}
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 ${
                    active ? "bg-cream-50/20" : "bg-sindoor-700/10"
                  }`}
                >
                  {it.count}
                </span>
              </a>
            );
          })}
        </nav>
      </div>

      {/* Group-by-source-group sections. Within each section, rows
          render with a leaner card than the main bhandara queue,
          group + sender at the top, photo prominent, then minimal
          extracted fields. Heavy editing happens on /admin/edit/[id]
          for bhandaras; for spots admins just publish/reject. */}
      {sub === "bhandara" ? (
        <BotBhandaraList groups={groupBhandaras} q={qFilter} />
      ) : (
        <BotSpotList groups={groupSpots} q={qFilter} />
      )}
    </div>
  );
}

/** Simple groupBy that preserves first-seen ordering of keys. */
function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = keyFn(it);
    const bucket = m.get(k);
    if (bucket) bucket.push(it);
    else m.set(k, [it]);
  }
  return m;
}

function BotBhandaraList({
  groups,
  q,
}: {
  groups: Map<string, BotBhandara[]>;
  q: string;
}) {
  if (groups.size === 0) {
    return (
      <p className="mt-12 text-center text-ink-600">
        {q
          ? `No bot-ingested invites match “${q}”.`
          : "Bot queue is empty. Forwards into bhandara WhatsApp groups will appear here."}
      </p>
    );
  }
  return (
    <div className="mt-6 space-y-8">
      {[...groups.entries()].map(([groupName, rows]) => (
        <section key={groupName}>
          <h2 className="text-sm font-medium text-sindoor-700 mb-2 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sindoor-700" />
            {groupName}
            <span className="text-xs text-ink-600 font-normal">
              · {rows.length} invite{rows.length === 1 ? "" : "s"}
            </span>
          </h2>
          <ul className="grid gap-4">
            {rows.map((b) => (
              <BotBhandaraCard key={b.id} b={b} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BotBhandaraCard({ b }: { b: BotBhandara }) {
  const rowState: "PENDING" | "UNVERIFIED" | "VERIFIED" | "REJECTED" =
    b.status === "PENDING"
      ? "PENDING"
      : b.status === "REJECTED"
        ? "REJECTED"
        : b.isVerified
          ? "VERIFIED"
          : "UNVERIFIED";
  // Same smart IST timestamp as BotSpotCard. Helps the admin spot
  // bhandara invites that have been sitting in the queue too long.
  const submittedAt = formatSubmissionTime(b.createdAt);
  return (
    <li
      id={b.id}
      className="rounded-2xl border border-sindoor-700/35 bg-saffron-50/30 p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        {b.photoUrl ? (
          <a
            href={b.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 group block focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600 rounded-xl"
            title="Open full image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.photoUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover border border-gold-500/40 bg-cream-50 group-hover:border-saffron-500"
            />
          </a>
        ) : null}
        <div className="min-w-0 flex-1">
          {/* Provenance line, sender · group · "Needs call" pill */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
            <span className="font-medium text-sindoor-700">
              {b._bot.sender || "Unknown sender"}
            </span>
            {b._bot.group ? (
              <span className="rounded-full px-2 py-0.5 bg-cream-50 border border-sindoor-700/35">
                {b._bot.group}
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 border ${
                rowState === "PENDING"
                  ? "bg-saffron-50 border-saffron-500/55 text-saffron-600"
                  : rowState === "REJECTED"
                    ? "bg-alert-500/10 border-alert-500/55 text-alert-500"
                    : rowState === "VERIFIED"
                      ? "bg-leaf-600/12 border-leaf-600/55 text-leaf-600"
                      : "bg-cream-50 border-gold-500/40 text-ink-600"
              }`}
            >
              {rowState === "PENDING"
                ? "Needs review"
                : rowState === "REJECTED"
                  ? "Rejected"
                  : rowState === "VERIFIED"
                    ? "Verified"
                    : "Live · unverified"}
            </span>
            <span
              className="text-ink-600"
              title={new Date(b.createdAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata" })}
            >
              🕐 {submittedAt}
            </span>
          </div>
          <h3 className="font-tiro text-xl text-sindoor-700 mt-2">
            {b.nameHi || "-"}
          </h3>
          <p className="font-fraunces text-lg text-ink-900">{b.name}</p>
          <p className="mt-1 text-sm text-ink-600">
            {b.area ? `${b.area} · ` : ""}
            {format12h(b.timeStart)}
            {b.timeEnd ? `–${format12h(b.timeEnd)}` : ""}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
        <Row label="Address" value={b.address || "-"} />
        <Row
          label="Tuesdays"
          value={b.tuesdayDates.length ? b.tuesdayDates.join(", ") : "-"}
        />
        <Row label="Menu" value={b.menu.length ? b.menu.join(", ") : "-"} />
        <Row
          label="Organizer"
          value={
            b.organizerName || b.organizerPhone
              ? `${b.organizerName || "-"} · ${b.organizerPhone || "-"}`
              : "-"
          }
        />
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        {rowState === "PENDING" ? (
          <>
            <Link
              href={`/admin/edit/${b.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm"
            >
              ✎ Edit &amp; publish
            </Link>
            <form action={publishVerifiedAction.bind(null, b.id)}>
              <SubmitButton variant="outline-leaf" pendingLabel="Publishing…">
                ✓ Publish as-is
              </SubmitButton>
            </form>
            <form action={rejectAction.bind(null, b.id)}>
              <SubmitButton
                variant="outline-alert"
                pendingLabel="Rejecting…"
                confirm="Reject this bot-ingested invite?"
              >
                Reject
              </SubmitButton>
            </form>
          </>
        ) : rowState === "REJECTED" ? (
          <form action={approveAction.bind(null, b.id)}>
            <SubmitButton variant="primary-green" pendingLabel="Republishing…">
              Re-publish
            </SubmitButton>
          </form>
        ) : (
          <>
            <a
              href={`/bhandara/${b.slug}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-4 py-2 text-sm"
            >
              View public ↗
            </a>
            <form action={rejectAction.bind(null, b.id)}>
              <SubmitButton
                variant="outline-alert"
                pendingLabel="Delisting…"
                confirm="Delist this listing?"
              >
                Delist
              </SubmitButton>
            </form>
          </>
        )}
      </div>
    </li>
  );
}

function BotSpotList({
  groups,
  q,
}: {
  groups: Map<string, BotSpot[]>;
  q: string;
}) {
  if (groups.size === 0) {
    return (
      <p className="mt-12 text-center text-ink-600">
        {q
          ? `No bot-ingested spots match “${q}”.`
          : "No live-photo forwards yet. Photos of pandals / food / crowds will appear here."}
      </p>
    );
  }
  return (
    <div className="mt-6 space-y-8">
      {[...groups.entries()].map(([groupName, rows]) => (
        <section key={groupName}>
          <h2 className="text-sm font-medium text-sindoor-700 mb-2 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sindoor-700" />
            {groupName}
            <span className="text-xs text-ink-600 font-normal">
              · {rows.length} photo{rows.length === 1 ? "" : "s"}
            </span>
          </h2>
          <ul className="grid gap-4">
            {rows.map((s) => (
              <BotSpotCard key={s.id} s={s} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BotSpotCard({ s }: { s: BotSpot }) {
  const isLive = s.status === "APPROVED" && s.expiresAt > new Date();
  const isExpired = s.status === "APPROVED" && s.expiresAt <= new Date();
  // IST-formatted ingestion timestamp, surfaced inline in the
  // metadata row so the admin can spot stale rows ("why is a
  // 4-day-old spot still in pending?") at a glance + prioritise
  // freshly-arrived ones. Smart formatting: relative for <24h,
  // absolute for older.
  const submittedAt = formatSubmissionTime(s.createdAt);
  return (
    <li
      id={s.id}
      className="rounded-2xl border border-sindoor-700/35 bg-saffron-50/30 p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        {s.photoUrl ? (
          <a
            href={s.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 group block focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600 rounded-xl"
            title="Open full image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.photoUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover border border-gold-500/40 bg-cream-50 group-hover:border-saffron-500"
            />
          </a>
        ) : (
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl border border-dashed border-gold-500/40 bg-saffron-50 grid place-items-center text-2xl text-saffron-600 shrink-0">
            📷
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
            <span className="font-medium text-sindoor-700">
              {s._bot.sender || "Unknown sender"}
            </span>
            {s._bot.group ? (
              <span className="rounded-full px-2 py-0.5 bg-cream-50 border border-sindoor-700/35">
                {s._bot.group}
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 border ${
                s.status === "REJECTED"
                  ? "bg-alert-500/10 border-alert-500/55 text-alert-500"
                  : isLive
                    ? "bg-leaf-600/12 border-leaf-600/55 text-leaf-600"
                    : isExpired
                      ? "bg-cream-50 border-gold-500/40 text-ink-600"
                      : "bg-saffron-50 border-saffron-500/55 text-saffron-600"
              }`}
            >
              {s.status === "REJECTED"
                ? "Rejected"
                : isLive
                  ? "Live"
                  : isExpired
                    ? "Expired"
                    : "Pending"}
            </span>
            <span
              className="text-ink-600"
              title={new Date(s.createdAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata" })}
            >
              🕐 {submittedAt}
            </span>
          </div>
          <p className="font-fraunces text-lg text-ink-900 mt-2">
            {s.caption?.split("\n\n")[0] || "(no caption)"}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            {s.area ? `${s.area}` : ""}
            {s.address ? `${s.area ? " · " : ""}${s.address}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {/* Edit & approve is always available, bot-ingested spots
            often have a wrong caption / 0,0 coords / blank area that
            the admin needs to fix before going live. We surface it
            first for non-rejected rows so the muscle memory matches
            the bhandara queue. */}
        {s.status !== "REJECTED" ? (
          <Link
            href={`/admin/edit-spot/${s.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm"
          >
            ✎ Edit &amp; approve
          </Link>
        ) : null}
        {s.status === "REJECTED" ? (
          <>
            <Link
              href={`/admin/edit-spot/${s.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-leaf-600 text-leaf-600 hover:bg-leaf-600 hover:text-cream-50 font-medium px-4 py-2 text-sm"
            >
              ✎ Edit &amp; re-approve
            </Link>
            <form action={approveSpotAction.bind(null, s.id)}>
              <SubmitButton variant="primary-green" pendingLabel="Approving…">
                Approve as-is
              </SubmitButton>
            </form>
          </>
        ) : isLive ? (
          <>
            <form action={extendSpotAction.bind(null, s.id)}>
              <SubmitButton variant="outline-saffron" pendingLabel="Extending…">
                +2h
              </SubmitButton>
            </form>
            <form action={delistSpotAction.bind(null, s.id)}>
              <SubmitButton
                variant="outline-alert"
                pendingLabel="Delisting…"
                confirm="Delist this spot from the map?"
              >
                Delist
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <form action={approveSpotAction.bind(null, s.id)}>
              <SubmitButton variant="outline-leaf" pendingLabel="Approving…">
                ✓ Approve as-is
              </SubmitButton>
            </form>
            <form action={delistSpotAction.bind(null, s.id)}>
              <SubmitButton
                variant="outline-alert"
                pendingLabel="Rejecting…"
                confirm="Reject this spot?"
              >
                Reject
              </SubmitButton>
            </form>
          </>
        )}
      </div>
    </li>
  );
}

function Row({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[11px] uppercase tracking-wider text-ink-600">
        {label}
      </dt>
      <dd className="mt-0.5 text-ink-900 break-words">{value}</dd>
    </div>
  );
}

function LoginScreen({ error }: { error: boolean }) {
  // The form fields (with show/hide password + submission spinner)
  // live in <AdminLoginForm />, a client component using
  // useFormStatus() to render a "Signing in…" state while
  // loginAction does its server-side work.
  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div className="rounded-3xl border border-gold-500/40 bg-cream-50 p-8 text-center">
        <p className="font-cormorant text-sm uppercase tracking-[0.25em] text-gold-500">
          Admin
        </p>
        <h1 className="mt-2 font-fraunces text-2xl text-sindoor-700">
          Sign in to moderate
        </h1>
        <AdminLoginForm error={error} />
      </div>
    </div>
  );
}
