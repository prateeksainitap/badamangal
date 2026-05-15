import type { Metadata } from "next";
import { cookies } from "next/headers";
import { prisma, toBhandara } from "@/lib/db";
import {
  approveAction,
  approveSpotAction,
  delistSpotAction,
  extendSpotAction,
  loginAction,
  logoutAction,
  publishVerifiedAction,
  rejectAction,
  verifyAction,
  unverifyAction,
} from "@/app/admin/actions";
import AdminSearchBox from "@/components/admin/AdminSearchBox";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
// NOTE: hard-delete (deleteBhandaraAction / deleteSpotAction) and its
// ConfirmSubmit prompt are intentionally NOT wired into the UI here —
// admin policy is delist-only so historical data is preserved across
// seasons. The server actions remain in `actions.ts` as a defensive
// hatch, but there is no path to trigger them from the dashboard.

export const metadata: Metadata = {
  title: "Admin · BadaMangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const COOKIE = "admin";

type SearchParams = Promise<{
  error?: string;
  status?: string;
  q?: string;
  /** "bhandara" (default) — moderate listed bhandaras.
   *  "spot"  — moderate spotted-live pins (the saffron pulse markers). */
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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const c = await cookies();
  const expected = process.env.ADMIN_PASSWORD;
  const isAuthed = Boolean(expected) && c.get(COOKIE)?.value === expected;

  if (!isAuthed) {
    return <LoginScreen error={Boolean(sp.error)} />;
  }

  // Top-level mode toggle: bhandara (default) vs spot. Each mode has
  // its own status tabs + counts; the search bar adapts to query
  // fields that make sense for the active mode.
  const mode: "bhandara" | "spot" = sp.type === "spot" ? "spot" : "bhandara";
  const q = (sp.q ?? "").trim();

  if (mode === "spot") {
    // Await the spot view's async body so the page returns its
    // resolved JSX, not a Promise — Next.js can handle either, but
    // awaiting keeps types straight.
    return await SpotsView({ sp, q });
  }

  // Tab routing. `?status=` accepts:
  //   ALL        → every row in the DB regardless of status (default
  //                landing tab — the source-of-truth view).
  //   PENDING    → new submissions awaiting the team's confirmation call
  //   UNVERIFIED → live on the map but no verified badge yet
  //   VERIFIED   → live + team-confirmed
  //   REJECTED   → unpublished / delisted
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

  const records = await prisma.bhandara.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  // Pair each public-shape Bhandara with the raw DB record so the
  // admin view can still read `status` (which is intentionally
  // stripped from the public Bhandara type — moderation state isn't
  // part of the public contract).
  const bhandaras = records.map((r) => ({
    ...toBhandara(r),
    status: r.status,
  }));

  const [pendingCount, unverifiedCount, verifiedCount, rejectedCount, allCount] =
    await Promise.all([
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
      {/* Sticky header strip — title row + search bar + tab pills all
          travel together. `position: sticky` pins it to the top of the
          viewport as the bhandara list scrolls under it. The slight
          translucent background + backdrop blur (cream tinted so it
          matches the page) keeps text legible as cards pass behind. */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-8 pb-4 bg-cream-50/92 backdrop-blur-md border-b border-gold-500/30">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div>
          <p className="font-cormorant text-sm uppercase tracking-[0.25em] text-gold-500">
            Admin · Bhandaras
          </p>
          <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
            Moderation queue
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Bot ingest liveness — renders only after the MacBook has
              pinged at least once. Green pulsing dot when fresh,
              gold when stale, red when offline. */}
          <BotHeartbeat />
          {/* Mode toggle: jump to the Spots moderation view. */}
          <ModeToggle current="bhandara" />
          {/* Quick path to the AI-assisted ingest flow. The orange pill
              colour-codes it as a primary action, distinct from the
              quieter "Sign out" link to its right. */}
          <a
            href="/admin/scan"
            className="inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-warm"
          >
            ✨ Scan &amp; publish
          </a>
          <form action={logoutAction}>
            <button className="text-sm text-ink-600 hover:text-sindoor-700">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Instant search: AdminSearchBox is a tiny client component
          that debounces keystrokes and `router.replace`s the URL with
          a fresh `?q=…`. The page itself stays a server component, so
          Prisma still runs the filter — the only thing that changed
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

      {/* Filter tabs */}
      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        {(
          ["ALL", "PENDING", "UNVERIFIED", "VERIFIED", "REJECTED"] as const
        ).map((s) => {
          const active = s === tab;
          // Preserve the active search across tab changes — admins
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
            // Compute the row's *actual* state — used for both the
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
            return (
            <li
              key={b.id}
              className="rounded-2xl border border-gold-500/40 bg-cream-50 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
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
                {b.photoUrl ? (
                  <Row label="Photo" value={b.photoUrl} />
                ) : null}
                {b.description ? (
                  <Row label="Description" value={b.description} wide />
                ) : null}
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                {rowState === "PENDING" ? (
                  <>
                    <form action={publishVerifiedAction.bind(null, b.id)}>
                      <button className="inline-flex items-center gap-1.5 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm">
                        ✓ Called &amp; confirmed, publish
                      </button>
                    </form>
                    <form action={approveAction.bind(null, b.id)}>
                      <button className="inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-4 py-2 text-sm">
                        Publish without badge
                      </button>
                    </form>
                    <form action={rejectAction.bind(null, b.id)}>
                      <button className="inline-flex items-center rounded-full border-2 border-alert-500 text-alert-500 hover:bg-alert-500 hover:text-cream-50 font-medium px-4 py-2 text-sm">
                        Reject
                      </button>
                    </form>
                  </>
                ) : rowState === "UNVERIFIED" ? (
                  <>
                    <form action={verifyAction.bind(null, b.id)}>
                      <button className="inline-flex items-center gap-1.5 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm">
                        ✓ Mark as Verified
                      </button>
                    </form>
                    <a
                      href={`/bhandara/${b.slug}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-4 py-2 text-sm"
                    >
                      View public page ↗
                    </a>
                    <form action={rejectAction.bind(null, b.id)}>
                      <button className="inline-flex items-center rounded-full border-2 border-alert-500 text-alert-500 hover:bg-alert-500 hover:text-cream-50 font-medium px-4 py-2 text-sm">
                        Delist
                      </button>
                    </form>
                  </>
                ) : rowState === "VERIFIED" ? (
                  <>
                    <a
                      href={`/bhandara/${b.slug}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-4 py-2 text-sm"
                    >
                      View public page ↗
                    </a>
                    <form action={unverifyAction.bind(null, b.id)}>
                      <button className="inline-flex items-center rounded-full border-2 border-gold-500 text-gold-500 hover:bg-gold-500 hover:text-cream-50 font-medium px-4 py-2 text-sm">
                        Remove verification
                      </button>
                    </form>
                    <form action={rejectAction.bind(null, b.id)}>
                      <button className="inline-flex items-center rounded-full border-2 border-alert-500 text-alert-500 hover:bg-alert-500 hover:text-cream-50 font-medium px-4 py-2 text-sm">
                        Delist
                      </button>
                    </form>
                  </>
                ) : (
                  // REJECTED row — only re-publish makes sense.
                  <form action={approveAction.bind(null, b.id)}>
                    <button className="inline-flex items-center rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm">
                      Re-publish
                    </button>
                  </form>
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
function ModeToggle({ current }: { current: "bhandara" | "spot" }) {
  return (
    <div className="inline-flex rounded-full border border-gold-500/40 bg-cream-50 p-1 text-sm">
      <a
        href="/admin"
        className={`px-3 py-1 rounded-full transition-colors ${
          current === "bhandara"
            ? "bg-saffron-600 text-cream-50 shadow-warm"
            : "text-ink-600 hover:text-sindoor-700"
        }`}
      >
        Bhandaras
      </a>
      <a
        href="/admin?type=spot"
        className={`px-3 py-1 rounded-full transition-colors ${
          current === "spot"
            ? "bg-saffron-600 text-cream-50 shadow-warm"
            : "text-ink-600 hover:text-sindoor-700"
        }`}
      >
        Spotted
      </a>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Spots moderation view
// ────────────────────────────────────────────────────────────────────
//
// Spots are simpler than bhandaras:
//   • Status: APPROVED or REJECTED only (no PENDING / VERIFIED).
//   • Auto-expire 8 h after createdAt — once past `expiresAt`, they
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
  // awaited up in AdminPage — passing the resolved value avoids a
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
  // skip it — there's nothing useful to type-search there.
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

  const spots = await prisma.spot.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      bhandara: { select: { slug: true, name: true, nameHi: true } },
    },
  });

  const [liveCount, expiredCount, rejectedCount, allCount] = await Promise.all([
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
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-8 pb-4 bg-cream-50/92 backdrop-blur-md border-b border-gold-500/30">
        <header className="flex flex-wrap items-end justify-between gap-4 pb-4">
          <div>
            <p className="font-cormorant text-sm uppercase tracking-[0.25em] text-gold-500">
              Admin · Spotted
            </p>
            <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
              Live spots queue
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <BotHeartbeat />
            <ModeToggle current="spot" />
            <a
              href="/admin/scan"
              className="inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-warm"
            >
              ✨ Scan &amp; publish
            </a>
            <form action={logoutAction}>
              <button className="text-sm text-ink-600 hover:text-sindoor-700">
                Sign out
              </button>
            </form>
          </div>
        </header>

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
                  {!isRejected ? (
                    <form action={delistSpotAction.bind(null, s.id)}>
                      <button className="inline-flex items-center rounded-full border-2 border-alert-500 text-alert-500 hover:bg-alert-500 hover:text-cream-50 font-medium px-4 py-2 text-sm">
                        Delist
                      </button>
                    </form>
                  ) : (
                    <form action={approveSpotAction.bind(null, s.id)}>
                      <button className="inline-flex items-center rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm">
                        Re-approve
                      </button>
                    </form>
                  )}
                  {(isExpired || isRejected) ? (
                    <form action={extendSpotAction.bind(null, s.id)}>
                      <button className="inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-4 py-2 text-sm">
                        + 8 h &amp; approve
                      </button>
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
  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div className="rounded-3xl border border-gold-500/40 bg-cream-50 p-8 text-center">
        <p className="font-cormorant text-sm uppercase tracking-[0.25em] text-gold-500">
          Admin
        </p>
        <h1 className="mt-2 font-fraunces text-2xl text-sindoor-700">
          Sign in to moderate
        </h1>
        <form action={loginAction} className="mt-6 grid gap-3 text-left">
          <label className="grid gap-1.5">
            <span className="text-sm text-ink-600">Password</span>
            <input
              required
              type="password"
              name="password"
              autoFocus
              className="w-full rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
            />
          </label>
          {error ? (
            <p className="text-xs text-alert-500">
              Wrong password. Try again.
            </p>
          ) : null}
          <button
            type="submit"
            className="mt-2 inline-flex justify-center items-center rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 shadow-sm"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
