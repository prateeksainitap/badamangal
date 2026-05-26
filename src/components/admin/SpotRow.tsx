import Link from "next/link";
import {
  approveSpotAction,
  delistSpotAction,
  extendSpotAction,
  deleteSpotAction,
} from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { stripBotProvenance, parseBotGroupName } from "@/lib/sanitize";
import { RowCheckbox } from "@/components/admin/QueueSelection";

/**
 * Spot moderation row — dark-themed card for the new /admin/spots
 * queue. Replaces SpotsView's in-page renderer with a tighter
 * standardized layout matching BhandaraRow:
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ [photo+badge]  Caption                  [state pill]       │
 *   │                area · linked bhandara · 4.2h left          │
 *   │                Reporter · language · IP slice              │
 *   │                                                            │
 *   │                [primary]  [secondary]  [⋯ More]            │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Action vocabulary:
 *
 *   LIVE:     Edit · Delist · (link to public bhandara if linked)   ⋯(Delete)
 *   EXPIRED:  Edit · Extend +8h · Delist                             ⋯(Delete)
 *   REJECTED: Re-approve · Extend +8h · Edit                         ⋯(Delete)
 *
 * Photo handling preserves the legacy "+N" extras badge — bot
 * spots usually have just the primary; user-submitted forms can
 * carry up to 4 extras (Spot.extraPhotoUrls JSON column). The
 * primary thumb is clickable to open the full-res image; the edit
 * page shows the full gallery.
 */

export type SpotQueueRow = {
  id: string;
  caption: string | null;
  area: string | null;
  address: string | null;
  lat: number;
  lng: number;
  status: string;
  language: string;
  photoUrl: string | null;
  /** JSON-encoded array of extra photo URLs. Parsed defensively. */
  extraPhotoUrls: string;
  reporterName: string | null;
  /** SHA-256 hex; we slice to 18 chars for display. */
  ipHash: string;
  createdAt: Date;
  expiresAt: Date;
  bhandara: { slug: string; name: string; nameHi: string | null } | null;
};

type Props = {
  spot: SpotQueueRow;
  /** Server-snapshot "now" — passed in so every row in a list
   *  uses the SAME clock for expiry math, avoiding the case where
   *  the first row says "3h left" and the last says "2.99h left"
   *  just because rendering took 10ms. */
  now: Date;
  /** Stagger index for .admin-row-in entry animation. */
  index: number;
};

export default function SpotRow({ spot: s, now, index }: Props) {
  const isExpired = s.expiresAt.getTime() <= now.getTime();
  const isRejected = s.status === "REJECTED";
  const isLive = !isRejected && !isExpired;

  // Extra-photo count — defensive JSON parse on the
  // string-encoded column. Bot rows almost always [0]; user
  // submissions occasionally 1–4.
  let extraCount = 0;
  try {
    const parsed = JSON.parse(s.extraPhotoUrls || "[]");
    if (Array.isArray(parsed)) {
      extraCount = parsed.filter(
        (u): u is string => typeof u === "string" && u.length > 0,
      ).length;
    }
  } catch {
    extraCount = 0;
  }

  // Hours until expiry / since expiry — used for the "Live · 4.2h
  // left" or "Expired 1.3h ago" sublabel.
  const hoursDelta =
    (s.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  const expiryLabel = isExpired
    ? `Expired ${Math.abs(hoursDelta).toFixed(1)}h ago`
    : `${hoursDelta.toFixed(1)}h left`;

  // Strip the [bot:…] provenance tag from the caption before
  // display — same hygiene as the public live-chat panel.
  const cleanCaption = stripBotProvenance(s.caption) || null;
  // Bot-ingested spots carry the [bot:…] tag in the raw caption.
  // We surface a small "BOT · in <group>" chip pair in the header
  // so the operator can trace the source channel without opening
  // /admin/bot-log. Older bot-ingested spots (pre-groupName plumbing)
  // still show the BOT pill alone.
  const fromBot = (s.caption ?? "").includes("[bot:");
  const botGroupName = fromBot ? parseBotGroupName(s.caption) : null;

  return (
    <article
      // Clamp stagger index at 6 — with hundreds of rows in a busy
      // queue, an uncapped 45ms-per-row delay leaves the last row
      // invisible for 6+ seconds. Capping keeps the "receiving"
      // feel for the visible block above the fold without leaving
      // a long tail of empty space.
      style={{ ["--i" as string]: Math.min(index, 6) }}
      // `has-[details[open]]:z-30` lifts this row's stacking context
      // above the next one when the kebab-menu is open. backdrop-blur
      // below creates a stacking context per row, which the inner
      // <details open:z-30> can't escape; without this the popover
      // gets clipped by the next row painting over it.
      className="admin-row-in relative has-[details[open]]:z-30 rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4 sm:p-5 transition-all hover:border-cyan-400/35"
    >
      <div className="flex gap-3 sm:gap-4">
        <RowCheckbox id={s.id} label={cleanCaption ?? "Spot"} />
        {/* Thumbnail — primary photo with an optional "+N" badge for
            extras. Clickable to open the full-res in a new tab. */}
        <Thumb url={s.photoUrl} extraCount={extraCount} alt={cleanCaption ?? "Spot"} />

        <div className="flex-1 min-w-0">
          {/* Header row — caption + state pill */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-fraunces text-cream-50 text-base sm:text-lg leading-tight">
                {cleanCaption ?? (
                  <span className="italic text-cream-50/55">No caption</span>
                )}
              </div>
              <div className="text-xs text-cream-50/55 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>{s.area ?? "Unknown area"}</span>
                {s.bhandara?.name ? (
                  <>
                    <span aria-hidden className="text-cream-50/25">
                      ·
                    </span>
                    <span>
                      linked to{" "}
                      <Link
                        href={`/bhandara/${s.bhandara.slug}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-saffron-500 hover:text-saffron-500/85 underline decoration-dotted underline-offset-2"
                      >
                        {s.bhandara.name}
                      </Link>
                    </span>
                  </>
                ) : null}
                <span aria-hidden className="text-cream-50/25">
                  ·
                </span>
                <span
                  className={
                    isLive
                      ? "text-leaf-400"
                      : isExpired
                        ? "text-cream-50/55"
                        : "text-sindoor-700"
                  }
                >
                  {expiryLabel}
                </span>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
              {fromBot ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-saffron-500/[0.14] border border-saffron-500/30 text-saffron-500 text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5">
                  <span aria-hidden>📱</span> Bot
                </span>
              ) : null}
              {botGroupName ? (
                <Link
                  href={`/admin/bot-log?outcome=ALL&group=${encodeURIComponent(
                    botGroupName,
                  )}`}
                  prefetch={false}
                  title={`Show every forward from ${botGroupName}`}
                  className="inline-flex items-center gap-1 rounded-full bg-violet-400/[0.10] border border-violet-400/35 text-violet-200 hover:bg-violet-400/[0.18] hover:border-violet-400/60 hover:text-violet-100 text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 max-w-[12rem] transition-colors"
                >
                  <span aria-hidden>#</span>
                  <span className="truncate">{botGroupName}</span>
                </Link>
              ) : null}
              <StatePill state={isRejected ? "rejected" : isExpired ? "expired" : "live"} />
            </div>
          </div>

          {/* Meta row — reporter, coords, IP */}
          <div className="mt-3 text-xs text-cream-50/55 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              <span className="text-cream-50/40">Reporter:</span>{" "}
              <span className="text-cream-50/85">
                {s.reporterName?.split(" ")[0] ?? "anon"}
              </span>{" "}
              <span className="text-cream-50/40">· {s.language}</span>
            </span>
            <span className="font-numerals tabular-nums">
              {s.lat !== 0 || s.lng !== 0
                ? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`
                : "no coords"}
            </span>
            <span className="text-cream-50/35 font-mono">
              {s.ipHash.slice(0, 12)}…
            </span>
          </div>

          {/* Address — separate line because it's often long */}
          {s.address ? (
            <div className="mt-2 text-xs text-cream-50/65 truncate">
              <span className="text-cream-50/40">Address:</span> {s.address}
            </div>
          ) : null}

          {/* Actions */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {isLive ? (
              <>
                <EditLink id={s.id} />
                <DelistForm id={s.id} />
                <MoreMenu>
                  <DeleteForm id={s.id} />
                </MoreMenu>
              </>
            ) : null}

            {isExpired ? (
              <>
                <form action={extendSpotAction.bind(null, s.id)}>
                  <SubmitButton variant="primary-green" pendingLabel="Extending…">
                    +8h
                  </SubmitButton>
                </form>
                <EditLink id={s.id} />
                <DelistForm id={s.id} />
                <MoreMenu>
                  <DeleteForm id={s.id} />
                </MoreMenu>
              </>
            ) : null}

            {isRejected ? (
              <>
                <form action={approveSpotAction.bind(null, s.id)}>
                  <SubmitButton variant="primary-green" pendingLabel="Re-approving…">
                    Re-approve
                  </SubmitButton>
                </form>
                <form action={extendSpotAction.bind(null, s.id)}>
                  <SubmitButton variant="outline-saffron" pendingLabel="Extending…">
                    +8h
                  </SubmitButton>
                </form>
                <EditLink id={s.id} />
                <MoreMenu>
                  <DeleteForm id={s.id} />
                </MoreMenu>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ────────────────────── Subcomponents ─────────────────────────── */

function Thumb({
  url,
  extraCount,
  alt,
}: {
  url: string | null;
  extraCount: number;
  alt: string;
}) {
  if (!url) {
    return (
      <div
        className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-saffron-500/[0.08] border border-dashed border-cream-50/15 flex items-center justify-center text-saffron-500/80 text-2xl"
        aria-hidden
      >
        🪔
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 group relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-cream-50/10 hover:border-saffron-500/40 transition-colors"
      title={
        extraCount > 0
          ? `Open full image — ${extraCount} extra photo${extraCount === 1 ? "" : "s"} on edit page`
          : "Open full image"
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
      {extraCount > 0 ? (
        <span
          aria-hidden
          className="absolute bottom-1 right-1 inline-flex items-center justify-center rounded-full bg-ink-900/85 text-cream-50 text-[10px] font-semibold leading-none px-1.5 py-0.5 ring-1 ring-cream-50/30"
        >
          +{extraCount}
        </span>
      ) : null}
    </a>
  );
}

function StatePill({ state }: { state: "live" | "expired" | "rejected" }) {
  const STYLES = {
    live: {
      bg: "bg-leaf-400/[0.14] border-leaf-400/40",
      text: "text-leaf-400",
      label: "Live",
      withDot: true,
    },
    expired: {
      bg: "bg-cream-50/[0.06] border-cream-50/15",
      text: "text-cream-50/55",
      label: "Expired",
      withDot: false,
    },
    rejected: {
      bg: "bg-sindoor-700/[0.22] border-sindoor-700/40",
      text: "text-sindoor-700",
      label: "Rejected",
      withDot: false,
    },
  } as const;
  const s = STYLES[state];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5",
        s.bg,
        s.text,
      ].join(" ")}
    >
      {s.withDot ? (
        <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-leaf-400/70 motion-safe:animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-leaf-400" />
        </span>
      ) : null}
      {s.label}
    </span>
  );
}

/** Edit link — matches SubmitButton's outline-saffron subtle tint
 *  so the action cluster reads as a single row of sibling pills. */
function EditLink({ id }: { id: string }) {
  return (
    <Link
      href={`/admin/edit-spot/${id}`}
      prefetch={false}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100"
    >
      ✎ Edit
    </Link>
  );
}

function DelistForm({ id }: { id: string }) {
  return (
    <form action={delistSpotAction.bind(null, id)}>
      <SubmitButton
        variant="outline-alert"
        pendingLabel="Delisting…"
        confirm="Delist this spot from the public map?"
      >
        Delist
      </SubmitButton>
    </form>
  );
}

function DeleteForm({ id }: { id: string }) {
  return (
    <form action={deleteSpotAction.bind(null, id)}>
      <SubmitButton
        variant="outline-alert"
        pendingLabel="Deleting…"
        confirm="Permanently delete this spot and its photos?"
      >
        Delete
      </SubmitButton>
    </form>
  );
}

function MoreMenu({ children }: { children: React.ReactNode }) {
  return (
    // `open:z-30` lifts the WHOLE <details> above the next row when
    // open — see the matching note in BhandaraRow's MoreMenu for the
    // stacking-context rationale.
    <details className="relative inline-block group open:z-30">
      {/* Trigger height matches sm SubmitButton (h-[28px]) so the
          action cluster reads as a row of equal-height pills.
          Visual = outline-ink subtle tint. */}
      <summary className="list-none cursor-pointer inline-flex items-center justify-center w-9 h-[28px] rounded-lg bg-cream-50/[0.05] border border-cream-50/15 text-cream-50/70 hover:bg-cream-50/[0.10] hover:border-cream-50/30 hover:text-cream-50 transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
        <span className="sr-only">More actions</span>
      </summary>
      <div className="absolute right-0 top-full mt-2 z-30 min-w-[10rem] rounded-xl border border-cream-50/15 bg-ink-900/95 backdrop-blur-md shadow-[0_12px_40px_-8px_rgba(0,0,0,0.7)] p-2 flex flex-col gap-1.5">
        {children}
      </div>
    </details>
  );
}
