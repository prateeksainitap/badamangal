import Link from "next/link";
import { prisma } from "@/lib/db";

/**
 * Full-platform photo archive, server-rendered as a section of the
 * /admin/gallery page (sits below the curated homepage-gallery).
 *
 * Two modes selected via `?archive=live|stored` on the parent page:
 *   - LIVE   = photos that ARE on the public site right now
 *                · Bhandara photoUrl where status === APPROVED
 *                · Spot photoUrl + extraPhotoUrls where status ===
 *                  APPROVED and expiresAt > now (within the 8h TTL)
 *                · GalleryPhoto where status === VISIBLE
 *   - STORED = every photoUrl whose source row no longer surfaces
 *              publicly (PENDING / REJECTED bhandara, expired or
 *              rejected spot, HIDDEN gallery)
 *
 * Cost (the user's explicit gate on this feature):
 *   - 6 indexed count() queries (3 sources × 2 modes), ~30 ms each
 *   - 3 findMany() queries on the active mode (LIMIT 100 per source)
 *   - All run in parallel via Promise.allSettled, ~150-200 ms warm
 *   - Image bytes served from R2 / Supabase CDN, NOT from our DB
 *   - <img loading="lazy"> defers actual byte-fetch until scrolled
 *     into view
 *   - No polling, no client-side fetching, no real-time updates —
 *     a refresh-to-update page so admins can audit at will without
 *     adding background load
 *
 * The "live" set is approximated by status only, not by upcoming
 * Tuesday dates — an APPROVED bhandara whose tuesdayDates are all
 * in the past will show up under Live here even though it isn't
 * rendered on the public homepage. Acceptable simplification; the
 * exact "rendered on the public homepage right now" check requires
 * JSON-parsing every row's tuesdayDates which we'd rather not do
 * in this archive surface.
 */

const PER_SOURCE_LIMIT = 100;

type Mode = "live" | "stored";

type PhotoCard = {
  key: string;
  src: string;
  source: "bhandara" | "spot" | "gallery";
  label: string;
  href: string | null;
  date: Date;
};

export default async function PhotoArchive({ mode }: { mode: Mode }) {
  const now = new Date();

  // Six counts (both modes, every source) + three findManys (active
  // mode only). Parallel via allSettled so a transient EMAXCONN on
  // any single query yields zero rather than blanking the section.
  const settled = await Promise.allSettled([
    // 0..2 — counts for LIVE
    prisma.bhandara.count({
      where: { status: "APPROVED", photoUrl: { not: null } },
    }),
    prisma.spot.count({
      where: {
        status: "APPROVED",
        expiresAt: { gt: now },
        photoUrl: { not: null },
      },
    }),
    prisma.galleryPhoto.count({ where: { status: "VISIBLE" } }),

    // 3..5 — counts for STORED (the inverse predicates)
    prisma.bhandara.count({
      where: { status: { not: "APPROVED" }, photoUrl: { not: null } },
    }),
    prisma.spot.count({
      where: {
        OR: [
          { status: { not: "APPROVED" } },
          { expiresAt: { lte: now } },
        ],
        photoUrl: { not: null },
      },
    }),
    prisma.galleryPhoto.count({ where: { status: { not: "VISIBLE" } } }),

    // 6..8 — list rows for the ACTIVE mode only
    prisma.bhandara.findMany({
      where:
        mode === "live"
          ? { status: "APPROVED", photoUrl: { not: null } }
          : { status: { not: "APPROVED" }, photoUrl: { not: null } },
      select: {
        id: true,
        slug: true,
        name: true,
        nameHi: true,
        photoUrl: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: PER_SOURCE_LIMIT,
    }),
    prisma.spot.findMany({
      where:
        mode === "live"
          ? {
              status: "APPROVED",
              expiresAt: { gt: now },
              photoUrl: { not: null },
            }
          : {
              OR: [
                { status: { not: "APPROVED" } },
                { expiresAt: { lte: now } },
              ],
              photoUrl: { not: null },
            },
      select: {
        id: true,
        photoUrl: true,
        extraPhotoUrls: true,
        area: true,
        caption: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: PER_SOURCE_LIMIT,
    }),
    prisma.galleryPhoto.findMany({
      where:
        mode === "live"
          ? { status: "VISIBLE" }
          : { status: { not: "VISIBLE" } },
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        uploadedBy: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: PER_SOURCE_LIMIT,
    }),
  ]);

  const unwrapN = (r: PromiseSettledResult<number>): number =>
    r.status === "fulfilled" ? r.value : 0;
  const unwrapArr = <T,>(r: PromiseSettledResult<T[]>): T[] =>
    r.status === "fulfilled" ? r.value : [];

  const liveCount =
    unwrapN(settled[0]) + unwrapN(settled[1]) + unwrapN(settled[2]);
  const storedCount =
    unwrapN(settled[3]) + unwrapN(settled[4]) + unwrapN(settled[5]);

  const bhandaras = unwrapArr(
    settled[6] as PromiseSettledResult<
      Array<{
        id: string;
        slug: string;
        name: string;
        nameHi: string | null;
        photoUrl: string | null;
        createdAt: Date;
        status: string;
      }>
    >,
  );
  const spots = unwrapArr(
    settled[7] as PromiseSettledResult<
      Array<{
        id: string;
        photoUrl: string | null;
        extraPhotoUrls: string;
        area: string | null;
        caption: string | null;
        createdAt: Date;
        status: string;
      }>
    >,
  );
  const galleryRows = unwrapArr(
    settled[8] as PromiseSettledResult<
      Array<{
        id: string;
        imageUrl: string;
        caption: string | null;
        uploadedBy: string | null;
        createdAt: Date;
        status: string;
      }>
    >,
  );

  // Flatten into PhotoCard[]. Bhandara contributes 1 photo per row;
  // Spot contributes 1 primary + up to 5 extras; GalleryPhoto is
  // 1 per row. We merge then sort by createdAt desc so the grid
  // reads chronologically across all three sources.
  const cards: PhotoCard[] = [];

  for (const b of bhandaras) {
    if (!b.photoUrl) continue;
    cards.push({
      key: `b:${b.id}`,
      src: b.photoUrl,
      source: "bhandara",
      label: b.nameHi ?? b.name,
      href: `/admin/edit/${b.id}`,
      date: b.createdAt,
    });
  }

  for (const s of spots) {
    if (s.photoUrl) {
      cards.push({
        key: `s:${s.id}:0`,
        src: s.photoUrl,
        source: "spot",
        label: s.caption ?? s.area ?? "Spot",
        href: `/admin/edit-spot/${s.id}`,
        date: s.createdAt,
      });
    }
    // extraPhotoUrls is the JSON-encoded TEXT column. Defensive
    // parse, malformed JSON yields no extra cards rather than
    // throwing.
    try {
      const parsed = JSON.parse(s.extraPhotoUrls || "[]");
      if (Array.isArray(parsed)) {
        let i = 1;
        for (const raw of parsed) {
          if (typeof raw === "string" && raw.length > 0) {
            cards.push({
              key: `s:${s.id}:${i}`,
              src: raw,
              source: "spot",
              label: s.caption ?? s.area ?? "Spot",
              href: `/admin/edit-spot/${s.id}`,
              date: s.createdAt,
            });
            i += 1;
          }
        }
      }
    } catch {
      /* leave as-is, primary photo already pushed if present */
    }
  }

  for (const g of galleryRows) {
    cards.push({
      key: `g:${g.id}`,
      src: g.imageUrl,
      source: "gallery",
      label: g.caption ?? (g.uploadedBy ? `by ${g.uploadedBy}` : "Gallery"),
      href: "/admin/gallery",
      date: g.createdAt,
    });
  }

  // Chronological merge across sources so the visual order matches
  // "most recently uploaded across the whole platform".
  cards.sort((a, b) => b.date.getTime() - a.date.getTime());

  const SOURCE_PILL = {
    bhandara:
      "bg-saffron-500/[0.14] border-saffron-500/35 text-saffron-300",
    spot: "bg-cyan-400/[0.14] border-cyan-400/35 text-cyan-200",
    gallery:
      "bg-violet-400/[0.14] border-violet-400/35 text-violet-200",
  } as const;

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="font-fraunces text-cream-50 text-lg">
            All uploaded photos
            <span className="ml-2 text-sm text-cream-50/45 font-mukta">
              · {(liveCount + storedCount).toLocaleString("en-IN")} total
            </span>
          </h2>
          <p className="text-[12px] text-cream-50/55 mt-0.5 font-mukta">
            Every photo across bhandaras, spots, and the curated
            gallery. Browser lazy-loads thumbnails so this list
            doesn&apos;t hit the page-load budget.
          </p>
        </div>
        <div className="inline-flex items-center rounded-xl bg-cream-50/[0.04] border border-cream-50/10 p-1">
          {/* Tab triggers, plain links so the active mode survives
              full page navigation (and so the inactive tab's data
              is genuinely NOT fetched on render). */}
          {(["live", "stored"] as const).map((tabMode) => {
            const active = tabMode === mode;
            const count = tabMode === "live" ? liveCount : storedCount;
            return (
              <Link
                key={tabMode}
                href={tabMode === "live" ? "?" : `?archive=${tabMode}`}
                scroll={false}
                prefetch={false}
                className={[
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold tracking-tight transition-colors",
                  active
                    ? "bg-cyan-400/[0.18] border border-cyan-400/40 text-cyan-100"
                    : "text-cream-50/65 hover:text-cream-50 hover:bg-cream-50/[0.04] border border-transparent",
                ].join(" ")}
              >
                <span className="capitalize">{tabMode}</span>
                <span
                  className={[
                    "inline-flex items-center justify-center min-w-[1.5rem] h-[18px] px-1.5 rounded-full text-[10px] font-mono tabular-nums",
                    active
                      ? "bg-cyan-400/25 text-cyan-100"
                      : "bg-cream-50/[0.06] text-cream-50/65",
                  ].join(" ")}
                >
                  {count.toLocaleString("en-IN")}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-cyan-400/10 bg-[#0B0E16]/85 backdrop-blur-sm p-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-400/[0.06] border border-cyan-400/15 mb-3 text-2xl">
            🗂
          </div>
          <div className="font-fraunces text-cream-50 text-base">
            No {mode} photos
          </div>
          <div className="text-[11px] text-cream-50/55 mt-1 font-mono">
            {mode === "live"
              ? "Nothing approved + non-expired is currently in flight."
              : "Nothing archived yet — every photo is still live."}
          </div>
        </div>
      ) : (
        <>
          <ul className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {cards.map((c) => {
              // The href is internal admin URL, so use Link. Lazy
              // <img> defers byte-fetch until scrolled into view.
              const inner = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.src}
                    alt={c.label}
                    loading="lazy"
                    decoding="async"
                    className="block w-full aspect-[4/5] object-cover bg-cream-50/[0.04]"
                  />
                  <div className="absolute top-1.5 left-1.5">
                    <span
                      className={[
                        "inline-flex items-center rounded-full border text-[9px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 backdrop-blur-sm",
                        SOURCE_PILL[c.source],
                      ].join(" ")}
                    >
                      {c.source}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                    <div className="text-[11px] text-cream-50 line-clamp-1 font-medium">
                      {c.label}
                    </div>
                    <div className="text-[9.5px] text-cream-50/65 font-mono">
                      {c.date.toISOString().slice(0, 10)}
                    </div>
                  </div>
                </>
              );
              return (
                <li
                  key={c.key}
                  className="relative rounded-xl overflow-hidden border border-cream-50/10 hover:border-cyan-400/35 transition-colors"
                >
                  {c.href ? (
                    <Link
                      href={c.href}
                      prefetch={false}
                      title={`Open ${c.source}`}
                      className="block"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="block">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Cap-hit hint. We pull at most 100 rows per source so the
              grid can include up to ~600 photos (Spot's extras
              multiply); when the underlying totals exceed the cap
              we tell the operator the list is truncated so they
              don't mistake "first 100" for "everything". */}
          {liveCount + storedCount > cards.length ? (
            <p className="mt-3 text-[11px] text-cream-50/45 font-mono">
              Showing the most recent {cards.length.toLocaleString("en-IN")}
              {" "}photos in this view. Older photos beyond the per-source
              cap of {PER_SOURCE_LIMIT} are reachable from their
              individual queue pages.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
