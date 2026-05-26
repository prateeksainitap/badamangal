import Link from "next/link";
import { dismissActivityEventAction } from "@/app/admin/home/activity-actions";
import ActivityDismissButton from "@/components/admin/ActivityDismissButton";

/** Kinds the inline dismiss button is offered for. Volunteers + system
 *  events are intentionally NOT deletable from the activity stream:
 *  volunteers carry foreign-key submissions and should be suspended via
 *  /admin/volunteers; system events are informational. */
const DISMISSIBLE_KINDS = new Set<ActivityEvent["kind"]>([
  "spot",
  "bhandara",
  "mention",
]);

/**
 * Activity stream, chronological "what just happened" feed shown
 * on the admin dashboard. Each row is a scan-card:
 *
 *   [colored avatar] Title in one line                 [status · time]
 *                    Subtitle: area · sender · source
 *
 * The stream is read-only, it's a "what's the system doing" lens,
 * not a moderation queue. Rows that point at a moderatable entity
 * (a bot-ingested PENDING bhandara, a new spot, a flagged volunteer)
 * link to the relevant edit/review page so the operator can act in
 * one click.
 *
 * Visual:
 *   Sender initials sit inside a colored disc whose hue is derived
 *   deterministically from the first letter, same approach the
 *   public LiveChatterBoard uses for chat-bubble avatars, ported
 *   here for visual continuity. A status pill on the right gives
 *   each row an at-a-glance "shape" (sindoor for needs-review,
 *   leaf for healthy, saffron for live).
 *
 *   Rows fade-in with a 45ms stagger on first render so the panel
 *   feels like it's "receiving" events, not rendering a static
 *   list.
 */

export type ActivityEvent = {
  /** Stable, unique within a page render. Used as React key. */
  id: string;
  /** Determines status pill + colored accent. */
  kind: "bhandara" | "spot" | "mention" | "volunteer" | "system";
  /** Required, ≤ 80 chars after callers trim. Renders as the row's
   *  main text on a single line (truncate-with-ellipsis). */
  title: string;
  /** Optional, ≤ 100 chars. Renders as a smaller second line. */
  subtitle?: string;
  /** ISO datetime; rendered as relative "Xm ago". */
  createdAt: string;
  /** Optional deep-link target, when set, the whole row becomes
   *  a Link. */
  href?: string;
  /** Optional sender name, used to derive avatar initials + hue.
   *  Falls back to the kind glyph when missing. */
  senderName?: string | null;
  /** Optional status pill text (e.g. "Pending", "Live", "Approved").
   *  When omitted, no pill renders. */
  status?: string;
};

type Props = {
  events: ActivityEvent[];
  /** Empty-state text shown when events.length === 0. */
  emptyLabel?: string;
  /** When the stream sits inside another bordered panel (e.g. the
   *  merged Live-chat hero on /admin/home) the outer ring would
   *  double up. `bare={true}` drops the wrapper border / background /
   *  rounding so the inner list renders flush against the parent
   *  card while keeping the row dividers + hover affordances. */
  bare?: boolean;
  /** When true, render an inline ✕ dismiss button on the right of
   *  every deletable row (spots / bhandaras / mentions). Click →
   *  confirm() → server action wipes the row. Used by the dashboard
   *  Live-chat stream so the operator can remove noise without
   *  context-switching to the source queue. */
  dismissable?: boolean;
};

/** Status colors per kind. Each kind has a default pill treatment;
 *  callers can override the visible text via `event.status`. */
const KIND_PILL: Record<
  ActivityEvent["kind"],
  { bg: string; text: string; label: string }
> = {
  bhandara: {
    bg: "bg-cyan-400/[0.12] border border-cyan-400/30",
    text: "text-cyan-300",
    label: "Bhandara",
  },
  spot: {
    bg: "bg-sindoor-700/[0.22] border border-sindoor-700/40",
    text: "text-sindoor-700",
    label: "Spot",
  },
  mention: {
    bg: "bg-violet-400/[0.14] border border-violet-400/30",
    text: "text-violet-300",
    label: "Chat",
  },
  volunteer: {
    bg: "bg-leaf-400/[0.14] border border-leaf-400/35",
    text: "text-leaf-400",
    label: "Volunteer",
  },
  system: {
    bg: "bg-cyan-400/[0.06] border border-cyan-400/15",
    text: "text-cyan-300/65",
    label: "System",
  },
};

/** Six avatar hues sampled from the brand palette. Used to colour
 *  the sender-initial disc deterministically. Same shape the public
 *  LiveChatterBoard uses for chat-bubble avatars so the admin reads
 *  as a denser version of the same product. */
const AVATAR_HUES = [
  "bg-cyan-400/25 text-cyan-300 ring-cyan-400/40",
  "bg-leaf-400/25 text-leaf-400 ring-leaf-400/40",
  "bg-violet-400/25 text-violet-300 ring-violet-400/40",
  "bg-sindoor-700/25 text-sindoor-700 ring-sindoor-700/40",
  "bg-saffron-500/22 text-saffron-400 ring-saffron-500/30",
  "bg-cyan-400/[0.18] text-cyan-300/85 ring-cyan-400/25",
];

function avatarHueFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const idx = ((h % AVATAR_HUES.length) + AVATAR_HUES.length) % AVATAR_HUES.length;
  return AVATAR_HUES[idx];
}

/** First-letter initial from a sender name, defaulting to the kind
 *  glyph when the name is missing. */
function initialFor(name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  if (!clean) return "•";
  // Devanagari: take the first character (it's already a complete
  // syllable visually). English: first letter, uppercased.
  const first = Array.from(clean)[0]!;
  return /[A-Za-z]/.test(first) ? first.toUpperCase() : first;
}

export default function ActivityStream({
  events,
  emptyLabel = "No recent activity yet.",
  bare = false,
  dismissable = false,
}: Props) {
  if (events.length === 0) {
    return (
      <div
        className={[
          "p-10 text-center text-sm text-cream-50/55",
          bare
            ? ""
            : "rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm",
        ].join(" ")}
      >
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-400/[0.08] border border-cyan-400/20 mb-3 text-cyan-300">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.6A8 8 0 0 1 21 12z" />
          </svg>
        </div>
        <div>{emptyLabel}</div>
        <div className="text-xs text-cream-50/40 mt-1">
          Activity from the bot, admin actions, and signups will appear here.
        </div>
      </div>
    );
  }

  return (
    <ul
      className={[
        "divide-y divide-cyan-400/[0.08]",
        bare
          ? "overflow-y-auto"
          : "rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm overflow-hidden",
      ].join(" ")}
    >
      {events.map((e, idx) => {
        const pill = KIND_PILL[e.kind];
        const seed = e.senderName?.trim() || e.id;
        const hue = avatarHueFor(seed);
        const initial = initialFor(e.senderName);
        const canDismiss = dismissable && DISMISSIBLE_KINDS.has(e.kind);
        // The link area pads less on the right when a dismiss
        // button overlays the corner, keeps the time / pill from
        // sitting under the ✕ on hover.
        const row = (
          <div
            className={[
              "admin-row-in py-3 pl-4 flex items-center gap-3 hover:bg-cyan-400/[0.05] transition-colors",
              canDismiss ? "pr-11" : "pr-4",
            ].join(" ")}
            style={{ ["--i" as string]: idx }}
          >
            <span
              className={[
                "shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full ring-1 text-[11px] font-bold leading-none",
                hue,
              ].join(" ")}
              aria-hidden
            >
              {initial}
            </span>
            <div className="flex-1 min-w-0 leading-snug">
              <div className="text-sm text-cream-50 truncate">{e.title}</div>
              {e.subtitle ? (
                <div className="text-xs text-cream-50/55 truncate mt-0.5">
                  {e.subtitle}
                </div>
              ) : null}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <span
                className={[
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                  pill.bg,
                  pill.text,
                ].join(" ")}
              >
                {e.status ?? pill.label}
              </span>
              <time
                dateTime={e.createdAt}
                className="text-[10.5px] text-cream-50/45 tabular-nums whitespace-nowrap"
              >
                {relativeTime(e.createdAt)}
              </time>
            </div>
          </div>
        );
        return (
          // `group` so the dismiss button's group-hover styles fire.
          // `relative` so the absolute-positioned dismiss form
          // anchors to this li, not the page.
          <li key={e.id} className="relative group">
            {e.href ? (
              <Link href={e.href} className="block">
                {row}
              </Link>
            ) : (
              row
            )}
            {canDismiss ? (
              // Floating ✕ in the top-right corner of the row.
              // Hidden by default (opacity-0); reveals on row hover
              // OR keyboard focus-within. Sits ABOVE the link so a
              // click on the button POSTs the form instead of
              // following the row link. native confirm() inside the
              // button guards the destructive submit.
              <form
                action={dismissActivityEventAction.bind(null, e.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10"
              >
                <ActivityDismissButton label={e.title} />
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Compact "Xm ago / Xh ago / yesterday" formatter. */
function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(diff / 3_600_000);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(diff / 86_400_000);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}
