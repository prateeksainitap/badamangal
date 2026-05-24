import Link from "next/link";
import {
  approveAction,
  publishVerifiedAction,
  verifyAction,
  unverifyAction,
  rejectAction,
  deleteBhandaraAction,
} from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { RowCheckbox } from "@/components/admin/QueueSelection";
import { IconCheck } from "@/components/admin/AdminIcons";
import { parseBotGroupName } from "@/lib/sanitize";

/**
 * Bhandara moderation row — dark-themed card consumed by the new
 * /admin/bhandaras queue. Replaces the legacy in-page renderer in
 * src/app/admin/page.tsx with a tighter, standardized layout:
 *
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │ [thumb]  Name (Hindi)               [status pill] [bot pill]  │
 *   │          English name · area · landmark · time                │
 *   │                                                               │
 *   │          Address · organizer · menu chips                     │
 *   │                                                               │
 *   │          [primary]  [secondary]  [tertiary]   [⋯ More]        │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * Standardized action vocabulary (3 inline buttons max, rest in ⋯):
 *
 *   PENDING:      Verify & publish · Publish · Edit         · ⋯(Reject · Delete)
 *   UNVERIFIED:   Verify · Edit · View public               · ⋯(Delist · Delete)
 *   VERIFIED:     View public · Edit · Remove verification  · ⋯(Delist · Delete)
 *   REJECTED:     Re-publish · Edit                         · ⋯(Delete)
 *
 * Bot-ingested rows get a small saffron border accent + a "from
 * WhatsApp bot" pill in the header. Sender + group are extracted
 * from the `[bot:…]` provenance tag the bot embeds in the
 * description (see lib/sanitize.ts for the regex).
 */

export type BhandaraQueueRow = {
  id: string;
  slug: string;
  name: string;
  nameHi: string | null;
  area: string | null;
  landmark: string | null;
  address: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  status: string;
  isVerified: boolean;
  organizerName: string | null;
  organizerPhone: string | null;
  photoUrl: string | null;
  /** Serialized JSON array of menu strings — Spot.extraPhotoUrls
   *  pattern. Parsed defensively. */
  menu: string | null;
  /** Description carries the `[bot:…]` tag for bot-ingested rows. */
  description: string | null;
  createdAt: Date;
};

type Props = {
  bhandara: BhandaraQueueRow;
  /** Index in the list — drives the .admin-row-in stagger
   *  animation (`--i` custom property in CSS). */
  index: number;
};

export default function BhandaraRow({ bhandara: b, index }: Props) {
  const fromBot = (b.description ?? "").includes("[bot:");
  // Group / channel name extracted from the [bot:…] provenance tag.
  // Null for older rows ingested before `groupName` was plumbed
  // through /api/bot/ingest — those still show just the BOT pill.
  const botGroupName = fromBot ? parseBotGroupName(b.description) : null;
  const isPending = b.status === "PENDING";
  const isApproved = b.status === "APPROVED";
  const isRejected = b.status === "REJECTED";
  const isVerified = isApproved && b.isVerified;
  const isUnverified = isApproved && !b.isVerified;

  // Menu — JSON-encoded array. Defensive parse; null/empty/garbage
  // all degrade to no chips.
  let menuItems: string[] = [];
  try {
    const parsed = JSON.parse(b.menu ?? "[]");
    if (Array.isArray(parsed)) {
      menuItems = parsed.filter(
        (m): m is string => typeof m === "string" && m.length > 0,
      );
    }
  } catch {
    menuItems = [];
  }

  const timeRange =
    b.timeStart && b.timeEnd
      ? `${formatTime(b.timeStart)}–${formatTime(b.timeEnd)}`
      : b.timeStart
        ? formatTime(b.timeStart)
        : null;

  return (
    <article
      // Clamp stagger index at 6 — see SpotRow for the same fix
      // rationale (uncapped 45ms × 141 rows = 6+ second tail).
      style={{ ["--i" as string]: Math.min(index, 6) }}
      className={[
        "admin-row-in relative rounded-2xl border bg-[#0B0E16]/85 backdrop-blur-sm p-4 sm:p-5 transition-all",
        fromBot
          ? "border-violet-400/30 hover:border-violet-400/55"
          : "border-cyan-400/15 hover:border-cyan-400/35",
      ].join(" ")}
    >
      <div className="flex gap-3 sm:gap-4">
        {/* Selection checkbox (client island, talks to
            QueueSelectionProvider). */}
        <RowCheckbox id={b.id} label={b.name} />

        {/* Thumbnail */}
        <Thumb url={b.photoUrl} alt={b.name} />

        {/* Body */}
        <div className="flex-1 min-w-0">
          {/* Header row: names on the left, pills on the right */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              {b.nameHi ? (
                <div className="font-tiro text-cream-50 text-lg leading-tight truncate">
                  {b.nameHi}
                </div>
              ) : null}
              <div className="font-fraunces text-cream-50 text-base sm:text-lg leading-tight truncate">
                {b.name}
              </div>
              <div className="text-xs text-cream-50/55 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {b.area ? <span>{b.area}</span> : null}
                {b.area && b.landmark ? (
                  <span aria-hidden className="text-cream-50/25">
                    ·
                  </span>
                ) : null}
                {b.landmark ? <span>{b.landmark}</span> : null}
                {timeRange ? (
                  <>
                    <span aria-hidden className="text-cream-50/25">
                      ·
                    </span>
                    <span className="text-cream-50/75">{timeRange}</span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              {fromBot ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-saffron-500/[0.14] border border-saffron-500/30 text-saffron-500 text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5">
                  <span aria-hidden>📱</span> Bot
                </span>
              ) : null}
              {botGroupName ? (
                // Clickable channel chip — pivots to /admin/bot-log
                // filtered by this group so the operator can see
                // every forward that's come in from the same source.
                // Violet tone matches the bot-ingested row border so
                // the chip reads as "bot lineage".
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
              <StatusPill
                status={
                  isPending
                    ? "pending"
                    : isVerified
                      ? "verified"
                      : isUnverified
                        ? "live"
                        : "rejected"
                }
              />
            </div>
          </div>

          {/* Compact details */}
          <div className="mt-3 text-xs text-cream-50/65 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {b.address ? (
              <div className="min-w-0 truncate">
                <span className="text-cream-50/45">Address: </span>
                {b.address}
              </div>
            ) : null}
            {b.organizerName || b.organizerPhone ? (
              <div className="min-w-0 truncate">
                <span className="text-cream-50/45">Organizer: </span>
                {b.organizerName ?? "—"}
                {b.organizerPhone ? (
                  <span className="text-cream-50/55"> · {b.organizerPhone}</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Menu chips */}
          {menuItems.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {menuItems.slice(0, 8).map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center rounded-full bg-cream-50/[0.05] border border-cream-50/10 text-cream-50/75 text-[10.5px] font-medium px-2 py-0.5"
                >
                  {m}
                </span>
              ))}
              {menuItems.length > 8 ? (
                <span className="inline-flex items-center text-[10.5px] text-cream-50/45 px-1">
                  +{menuItems.length - 8} more
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Action cluster */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {isPending ? (
              <>
                <form action={publishVerifiedAction.bind(null, b.id)}>
                  <SubmitButton variant="primary-green" pendingLabel="Publishing…">
                    <IconCheck size={14} />
                    <span>Verify &amp; publish</span>
                  </SubmitButton>
                </form>
                <form action={approveAction.bind(null, b.id)}>
                  <SubmitButton variant="outline-saffron" pendingLabel="Publishing…">
                    Publish (no badge)
                  </SubmitButton>
                </form>
                <EditLink id={b.id} />
                <MoreMenu>
                  <RejectForm id={b.id} />
                  <DeleteForm id={b.id} />
                </MoreMenu>
              </>
            ) : null}

            {isUnverified ? (
              <>
                <form action={verifyAction.bind(null, b.id)}>
                  <SubmitButton variant="primary-green" pendingLabel="Verifying…">
                    <IconCheck size={14} />
                    <span>Verify</span>
                  </SubmitButton>
                </form>
                <EditLink id={b.id} />
                <ViewPublicLink slug={b.slug} />
                <MoreMenu>
                  <DelistForm id={b.id} />
                  <DeleteForm id={b.id} />
                </MoreMenu>
              </>
            ) : null}

            {isVerified ? (
              <>
                <ViewPublicLink slug={b.slug} primary />
                <EditLink id={b.id} />
                <form action={unverifyAction.bind(null, b.id)}>
                  <SubmitButton variant="outline-saffron" pendingLabel="Removing…">
                    Remove verification
                  </SubmitButton>
                </form>
                <MoreMenu>
                  <DelistForm id={b.id} />
                  <DeleteForm id={b.id} />
                </MoreMenu>
              </>
            ) : null}

            {isRejected ? (
              <>
                <form action={approveAction.bind(null, b.id)}>
                  <SubmitButton variant="primary-green" pendingLabel="Re-publishing…">
                    Re-publish
                  </SubmitButton>
                </form>
                <EditLink id={b.id} />
                <MoreMenu>
                  <DeleteForm id={b.id} />
                </MoreMenu>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ────────────────────────── Subcomponents ─────────────────────── */

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <div
        className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-cream-50/[0.05] border border-cream-50/10 flex items-center justify-center text-cream-50/30 text-2xl"
        aria-hidden
      >
        🕉️
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 group relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-cream-50/10 hover:border-saffron-500/40 transition-colors"
      title="Open full image"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
    </a>
  );
}

function StatusPill({
  status,
}: {
  status: "pending" | "live" | "verified" | "rejected";
}) {
  // Live → leaf-green with a pulsing dot, reads as "active and healthy".
  // Verified → deeper green with check.
  // Pending → cyan (queue, awaiting human).
  // Rejected → sindoor red.
  const STYLES = {
    pending: {
      bg: "bg-cyan-400/[0.10] border-cyan-400/30",
      text: "text-cyan-300",
      label: "Pending",
      withDot: false,
    },
    live: {
      bg: "bg-leaf-400/[0.14] border-leaf-400/40",
      text: "text-leaf-400",
      label: "Live",
      withDot: true,
    },
    verified: {
      bg: "bg-leaf-400/[0.18] border-leaf-400/45",
      text: "text-leaf-400",
      // No dingbat — the leaf-green tint + the IconCheck rendered below
      // (when status === "verified") carries the "verified" affordance.
      label: "Verified",
      withDot: false,
    },
    rejected: {
      bg: "bg-sindoor-700/[0.22] border-sindoor-700/40",
      text: "text-sindoor-700",
      label: "Rejected",
      withDot: false,
    },
  } as const;
  const s = STYLES[status];
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
      {status === "verified" ? <IconCheck size={11} /> : null}
      {s.label}
    </span>
  );
}

/** EditLink / ViewPublicLink / MoreMenu — these are <Link>/<a>/<details>
 *  triggers, not <form> submits, so they can't use SubmitButton.
 *  They borrow SubmitButton's "outline-saffron" subtle-tint visual
 *  (and ViewPublicLink's primary variant borrows "primary-saffron"),
 *  re-spelled inline so the icons + hrefs can live on a Link/anchor.
 *  Keep the class strings in sync with SubmitButton.tsx if you tweak
 *  the design tokens there. */
function EditLink({ id }: { id: string }) {
  return (
    <Link
      href={`/admin/edit/${id}`}
      prefetch={false}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100"
    >
      Edit
    </Link>
  );
}

function ViewPublicLink({
  slug,
  primary = false,
}: {
  slug: string;
  primary?: boolean;
}) {
  return (
    <a
      href={`/bhandara/${slug}`}
      target="_blank"
      rel="noreferrer noopener"
      className={[
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        primary
          ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-cream-50 border border-cyan-300/40 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] hover:from-cyan-400 hover:to-violet-400"
          : "bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100",
      ].join(" ")}
    >
      View public ↗
    </a>
  );
}

function RejectForm({ id }: { id: string }) {
  return (
    <form action={rejectAction.bind(null, id)}>
      <SubmitButton
        variant="outline-alert"
        pendingLabel="Rejecting…"
        confirm="Reject this listing?"
      >
        Reject
      </SubmitButton>
    </form>
  );
}

function DelistForm({ id }: { id: string }) {
  return (
    <form action={rejectAction.bind(null, id)}>
      <SubmitButton
        variant="outline-alert"
        pendingLabel="Delisting…"
        confirm="Delist this listing from the public site?"
      >
        Delist
      </SubmitButton>
    </form>
  );
}

function DeleteForm({ id }: { id: string }) {
  return (
    <form action={deleteBhandaraAction.bind(null, id)}>
      <SubmitButton
        variant="outline-alert"
        pendingLabel="Deleting…"
        confirm="Permanently delete this bhandara and its photos?"
      >
        Delete
      </SubmitButton>
    </form>
  );
}

/** Collapsible "more actions" menu — shows a vertical-ellipsis
 *  trigger; children are revealed in a popover on click. Pure
 *  CSS via <details>/<summary> for SSR-friendly zero-JS. */
function MoreMenu({ children }: { children: React.ReactNode }) {
  return (
    // `open:z-30` lifts the WHOLE <details> above the next row when
    // the popover is open. Without it, the panel below (even with
    // its own z-10) is still beaten by the next row's content
    // because every row's <article> is `position: relative` with no
    // z-index, so all rows share the parent stacking context and
    // DOM order wins ties — the next row paints over the popover.
    // Lifting the parent `<details>` is what actually fixes the
    // stacking, the inner panel's z-index is secondary.
    <details className="relative inline-block group open:z-30">
      {/* Trigger height (h-[28px]) matches sm SubmitButton's
          py-1.5 + text-xs box so the cluster reads as a single row
          of equal-height pills. Visual = outline-ink subtle tint. */}
      <summary className="list-none cursor-pointer inline-flex items-center justify-center w-9 h-[28px] rounded-lg bg-cream-50/[0.05] border border-cream-50/15 text-cream-50/70 hover:bg-cream-50/[0.10] hover:border-cream-50/30 hover:text-cream-50 transition-colors">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
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

/** Hours formatter: "11:00" → "11:00 AM". Accepts the legacy
 *  HH:MM string the DB stores; falls back to verbatim if parse fails. */
function formatTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const mm = m[2];
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${period}`;
}
