import Link from "next/link";

/**
 * Activity stream — chronological "what just happened" feed shown
 * on the admin dashboard. Each row is a quick-scan card:
 *
 *   [icon] Title in one line                 [time]
 *          Subtitle: area · sender · source
 *
 * The stream is read-only — it's a "what's the system doing" lens,
 * not a moderation queue. Rows that point at a moderatable entity
 * (a bot-ingested PENDING bhandara, a new spot, an admin-flagged
 * volunteer) link to the relevant edit/review page so the operator
 * can act in one click.
 *
 * Data shape is computed by the parent server component from a
 * union of recent BhandaraMention / Bhandara / Spot / OrganiseRequest
 * rows — we don't fetch here. Keeps the component dumb + easy to
 * extend with future event sources (CSP reports, news refresh,
 * volunteer signups, etc.) without touching the rendering code.
 */

export type ActivityEvent = {
  /** Stable, unique within a page render. Used as React key. */
  id: string;
  /** Determines icon + accent color. */
  kind: "bhandara" | "spot" | "mention" | "volunteer" | "system";
  /** Required, ≤ 80 chars after callers trim. Renders as the row's
   *  main text on a single line (truncate-with-ellipsis). */
  title: string;
  /** Optional, ≤ 100 chars. Renders as a smaller second line. */
  subtitle?: string;
  /** ISO datetime; rendered as relative "Xm ago". */
  createdAt: string;
  /** Optional deep-link target — when set, the whole row becomes
   *  a Link. */
  href?: string;
};

type Props = {
  events: ActivityEvent[];
  /** Empty-state text shown when events.length === 0. */
  emptyLabel?: string;
};

const KIND_STYLES: Record<
  ActivityEvent["kind"],
  { icon: React.ReactNode; iconBg: string; iconText: string }
> = {
  bhandara: {
    icon: <IconDiya />,
    iconBg: "bg-saffron-500/[0.12]",
    iconText: "text-saffron-500",
  },
  spot: {
    icon: <IconCamera />,
    iconBg: "bg-sindoor-700/[0.18]",
    iconText: "text-sindoor-700",
  },
  mention: {
    icon: <IconChat />,
    iconBg: "bg-cream-50/[0.08]",
    iconText: "text-cream-50/85",
  },
  volunteer: {
    icon: <IconUsers />,
    iconBg: "bg-leaf-400/[0.14]",
    iconText: "text-leaf-400",
  },
  system: {
    icon: <IconGear />,
    iconBg: "bg-cream-50/[0.06]",
    iconText: "text-cream-50/55",
  },
};

export default function ActivityStream({ events, emptyLabel = "No recent activity yet." }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-cream-50/10 bg-cream-50/[0.03] p-8 text-center text-sm text-cream-50/55">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul className="rounded-2xl border border-cream-50/10 bg-cream-50/[0.03] backdrop-blur-sm divide-y divide-cream-50/10 overflow-hidden">
      {events.map((e) => {
        const style = KIND_STYLES[e.kind];
        const row = (
          <div className="px-4 py-3 flex items-start gap-3 hover:bg-cream-50/[0.04] transition-colors">
            <span
              className={[
                "shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl",
                style.iconBg,
                style.iconText,
              ].join(" ")}
              aria-hidden
            >
              {style.icon}
            </span>
            <div className="flex-1 min-w-0 leading-snug">
              <div className="text-sm text-cream-50 truncate">{e.title}</div>
              {e.subtitle ? (
                <div className="text-xs text-cream-50/55 truncate mt-0.5">
                  {e.subtitle}
                </div>
              ) : null}
            </div>
            <time
              dateTime={e.createdAt}
              className="shrink-0 text-[11px] text-cream-50/45 tabular-nums whitespace-nowrap mt-1"
            >
              {relativeTime(e.createdAt)}
            </time>
          </div>
        );
        return (
          <li key={e.id}>
            {e.href ? (
              <Link href={e.href} prefetch={false} className="block">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Compact "Xm ago / Xh ago / yesterday" formatter. SSR-safe: no
 *  reliance on Date.now() outside the render window the parent
 *  server component already pinned. Falls back to absolute time
 *  when older than a day. */
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
  // Older than a week — show absolute date.
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

/* ──────────────────────── Icons (small set, scoped here) ──────── */
function IconDiya() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4 c1.6 1.5 2.5 3.2 0 5.5 c-2.5 -2.3 -1.6 -4 0 -5.5 z" fill="currentColor" />
      <path d="M4 14 q8 5 16 0 l-2 4 h-12 z" />
    </svg>
  );
}
function IconCamera() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M9 7 l1.5 -3 h3 l1.5 3" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.6A8 8 0 0 1 21 12z" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="9" r="3.5" />
      <path d="M2.5 20 c0 -4 3 -7 6.5 -7 s6.5 3 6.5 7" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M15 20 c0 -3 2 -5 4.5 -5 s2 1 2 5" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12 a7 7 0 0 0 -0.1 -1.2 l2 -1.6 l-2 -3.4 l-2.4 1 a7 7 0 0 0 -2 -1.2 l-0.4 -2.6 h-4 l-0.4 2.6 a7 7 0 0 0 -2 1.2 l-2.4 -1 l-2 3.4 l2 1.6 a7 7 0 0 0 -0.1 1.2 a7 7 0 0 0 0.1 1.2 l-2 1.6 l2 3.4 l2.4 -1 a7 7 0 0 0 2 1.2 l0.4 2.6 h4 l0.4 -2.6 a7 7 0 0 0 2 -1.2 l2.4 1 l2 -3.4 l-2 -1.6 a7 7 0 0 0 0.1 -1.2 z" />
    </svg>
  );
}
