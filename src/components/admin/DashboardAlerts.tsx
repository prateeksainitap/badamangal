import Link from "next/link";
import { IconEnvelope, IconCheck } from "@/components/admin/AdminIcons";

/**
 * Critical-alerts notification bar for /admin/home.
 *
 * Reads the data the dashboard already fetches (pending counts,
 * today-is-Tuesday, env flags) and surfaces actionable cards at the
 * very top of the page. Each card is severity-coloured + carries an
 * optional CTA link straight to where the action lives.
 *
 * Design principles:
 *   • No empty chrome. When there's nothing to alert about, this
 *     component renders `null` — the dashboard stays clean instead
 *     of showing an "all clear" placeholder.
 *   • Non-dismissible. Operators can't accidentally hide something
 *     important; alerts auto-resolve when the underlying data
 *     condition clears (e.g. once you approve the volunteers, the
 *     "volunteers waiting" card disappears on next render).
 *   • Pure server component. No client state — just props + render.
 *
 * Severity ladder, in display order (highest urgency first):
 *   critical  — someone is blocked / something is broken
 *   warning   — queue / inbox is building up
 *   info      — context that helps interpret the day
 *
 * Adding a new alert: push to the `alerts` array below the same way.
 * Each alert sorts by severity then by insertion order. Keep
 * `severity: "critical"` rare — overuse desensitises the operator
 * to actual fires.
 */

type Severity = "critical" | "warning" | "info";

type AlertItem = {
  id: string;
  severity: Severity;
  /** Glyph or SVG shown left of the title. Strings are fine for
   *  emoji (📋, 🕉, 💤, 🔑) which have system emoji-font fallback,
   *  but Unicode dingbats (✉ U+2709, ✓ U+2713) render as tofu in
   *  fonts that don't carry them — for those, pass a ReactNode
   *  using the AdminIcons SVG set instead. */
  icon: React.ReactNode;
  title: string;
  description?: string;
  cta?: { href: string; label: string };
};

type Props = {
  pendingBhandaras: number;
  pendingVolunteers: number;
  newEmailsCount: number;
  mentions24hCount: number;
  isTuesday: boolean;
};

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const TONE: Record<
  Severity,
  {
    container: string;
    icon: string;
    title: string;
    description: string;
    cta: string;
    eyebrow: string;
    eyebrowLabel: string;
  }
> = {
  critical: {
    container:
      "border-alert-500/35 bg-alert-500/[0.08] hover:bg-alert-500/[0.10]",
    icon: "bg-alert-500/[0.16] border-alert-500/40 text-alert-300",
    title: "text-alert-300",
    description: "text-cream-50/75",
    cta: "bg-alert-500/[0.14] border-alert-500/40 text-alert-300 hover:bg-alert-500/[0.22] hover:border-alert-500/60 hover:text-alert-200",
    eyebrow: "bg-alert-500/[0.16] border-alert-500/40 text-alert-300",
    eyebrowLabel: "Critical",
  },
  warning: {
    container:
      "border-saffron-500/30 bg-saffron-500/[0.06] hover:bg-saffron-500/[0.10]",
    icon: "bg-saffron-500/[0.16] border-saffron-500/40 text-saffron-300",
    title: "text-saffron-300",
    description: "text-cream-50/75",
    cta: "bg-saffron-500/[0.12] border-saffron-500/35 text-saffron-300 hover:bg-saffron-500/[0.20] hover:border-saffron-500/55 hover:text-saffron-200",
    eyebrow: "bg-saffron-500/[0.14] border-saffron-500/35 text-saffron-300",
    eyebrowLabel: "Attention",
  },
  info: {
    container:
      "border-cyan-400/20 bg-cyan-400/[0.04] hover:bg-cyan-400/[0.08]",
    icon: "bg-cyan-400/[0.12] border-cyan-400/30 text-cyan-200",
    title: "text-cyan-200",
    description: "text-cream-50/70",
    cta: "bg-cyan-400/[0.10] border-cyan-400/30 text-cyan-200 hover:bg-cyan-400/[0.18] hover:border-cyan-400/55 hover:text-cyan-100",
    eyebrow: "bg-cyan-400/[0.12] border-cyan-400/30 text-cyan-200",
    eyebrowLabel: "Info",
  },
};

/** Pure logic — compute the ordered alert list from the current
 *  dashboard data snapshot. Shared by the inline `<DashboardAlerts/>`
 *  surface (now unused — kept for back-compat) and the new
 *  `<NotificationBell/>` header popover. */
export function computeAlerts(props: Props): AlertItem[] {
  const alerts: AlertItem[] = [];

  // ── CRITICAL ────────────────────────────────────────────────────
  // Volunteers stuck in PENDING are literally blocked from
  // submitting until the admin issues their code. Treat as the
  // hottest signal on the page.
  if (props.pendingVolunteers > 0) {
    alerts.push({
      id: "pending-volunteers",
      severity: "critical",
      icon: "⏱",
      title: `${props.pendingVolunteers} volunteer${
        props.pendingVolunteers === 1 ? " is" : "s are"
      } waiting for a code`,
      description:
        "Each one is blocked from submitting until you approve + send their WhatsApp code.",
      cta: { href: "/admin/volunteers", label: "Review →" },
    });
  }

  // ── WARNING ─────────────────────────────────────────────────────
  // Listings queue building up — not blocking anyone, but bigger
  // the queue, less context the operator has when each row is
  // finally reviewed. Threshold of 5 chosen so 1-2 stragglers don't
  // raise an alarm.
  if (props.pendingBhandaras >= 5) {
    alerts.push({
      id: "pending-bhandaras",
      severity: "warning",
      icon: "📋",
      title: `${props.pendingBhandaras} listings pending review`,
      description:
        "The queue is building up. Skim and approve / reject before more land.",
      cta: { href: "/admin/bhandaras?status=PENDING", label: "Open queue →" },
    });
  }

  // Unread inbox — public-facing first impression risk. Surfaces
  // for any count > 0 because contact-form messages tend to expect
  // a reply within a day or two.
  if (props.newEmailsCount > 0) {
    alerts.push({
      id: "new-emails",
      severity: "warning",
      icon: <IconEnvelope size={18} />,
      title: `${props.newEmailsCount} unread email${
        props.newEmailsCount === 1 ? "" : "s"
      } in the inbox`,
      description: "From the public contact form. Open + reply via mailto.",
      cta: { href: "/admin/emails", label: "Open inbox →" },
    });
  }

  // ── INFO ────────────────────────────────────────────────────────
  // Tuesday is the busy day — the bot fires constantly, mention
  // volume spikes, spot reports come in faster than usual. Surface
  // it as context so the operator knows why the dashboard feels
  // alive vs. a slow off-day.
  if (props.isTuesday) {
    alerts.push({
      id: "tuesday",
      severity: "info",
      icon: "🕉",
      title: "It's Tuesday — Bada Mangal day",
      description:
        "Expect mention volume + spot reports to spike. Keep the queue thin.",
    });
  }

  // No mentions in the last 24h is unusual when the bot is healthy.
  // Surface as info (not critical) because slow days do happen —
  // just nudges the operator to glance at /admin/mentions.
  if (props.mentions24hCount === 0) {
    alerts.push({
      id: "no-mentions",
      severity: "info",
      icon: "💤",
      title: "No new mentions in the last 24h",
      description:
        "Either today is genuinely quiet, or the WhatsApp bot stopped forwarding. Worth a glance.",
      cta: { href: "/admin/mentions", label: "Check mentions →" },
    });
  }

  // OpenAI key missing — the Content Hub Prompts tab Run buttons
  // won't fire without it. Info severity because nothing breaks;
  // it just disables a feature.
  if (!process.env.OPENAI_API_KEY) {
    alerts.push({
      id: "openai-key",
      severity: "info",
      icon: "🔑",
      title: "OpenAI key not configured",
      description:
        "Content Hub prompts can't run until OPENAI_API_KEY is in .env.local. CRUD still works.",
      cta: { href: "/admin/content?tab=prompts", label: "View prompts →" },
    });
  }

  // Sort by severity (critical first), preserving insertion order
  // for ties so the array literal above stays the source of truth
  // for display order within a severity tier.
  alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return alerts;
}

export default function DashboardAlerts(props: Props) {
  const alerts = computeAlerts(props);

  // No alerts → render nothing. Beats showing an "all clear" pill
  // every page load (which would just become visual noise).
  if (alerts.length === 0) return null;

  return (
    <div
      aria-label="Dashboard alerts"
      role="region"
      className="mb-6 grid gap-2"
    >
      {alerts.map((a) => (
        <AlertCard key={a.id} alert={a} />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   NotificationBell — header popover variant
   ──────────────────────────────────────────────────────────────────
   Replaces the inline alerts strip on /admin/home. Lives in the
   AdminShell top bar's right side. Implemented as native
   <details>/<summary> so the popover is pure CSS — no client hook,
   no useState, no portal. The bell renders as the <summary>; the
   alert cards live inside the <details>'s expanded panel.

   Critical-tier alerts force a saffron pulse on the bell so the
   operator notices them even before opening the panel. Counts are
   shown as a small badge over the icon.

   `details` doesn't auto-close on outside click. The popover stays
   open until the operator either clicks the bell again, navigates
   away (the shell remounts per route), or clicks a CTA inside
   (which navigates + remounts). That matches the affordance pattern
   admin moderation rows already use (MoreMenu in BhandaraRow).
   ────────────────────────────────────────────────────────────── */
export function NotificationBell(props: Props) {
  const alerts = computeAlerts(props);
  const total = alerts.length;
  const critical = alerts.some((a) => a.severity === "critical");
  const warning = alerts.some((a) => a.severity === "warning");

  // Badge tone follows the highest-severity alert in the list.
  const badgeTone = critical
    ? "bg-alert-500 text-cream-50"
    : warning
      ? "bg-saffron-500 text-cream-50"
      : "bg-cyan-400 text-ink-900";

  return (
    <details className="relative inline-block group">
      <summary
        className={[
          "list-none cursor-pointer relative inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors",
          "bg-cyan-400/[0.08] border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100",
          critical ? "ring-2 ring-alert-500/45 ring-offset-2 ring-offset-[#080A10]" : "",
        ].join(" ")}
        aria-label={
          total === 0
            ? "Notifications — all clear"
            : `Notifications — ${total} active`
        }
        title={
          total === 0
            ? "All clear"
            : `${total} alert${total === 1 ? "" : "s"}`
        }
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {total > 0 ? (
          <span
            aria-hidden
            className={[
              "absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[1.05rem] h-[1.05rem] rounded-full px-1 text-[9px] font-bold font-mono tabular-nums leading-none border border-[#080A10]",
              badgeTone,
              critical ? "motion-safe:animate-pulse" : "",
            ].join(" ")}
          >
            {total > 9 ? "9+" : total}
          </span>
        ) : null}
      </summary>

      {/* Popover panel — absolutely positioned to the right of the
          bell. Wider than a row card so each alert can breathe. */}
      <div className="absolute right-0 top-full mt-2 z-30 w-[22rem] sm:w-[26rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-cyan-400/25 bg-[#0B0E16]/95 backdrop-blur-md shadow-[0_24px_50px_-12px_rgba(0,0,0,0.7)] overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-cyan-400/15">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/85">
              Notifications
            </div>
            <div className="text-sm text-cream-50 font-medium mt-0.5">
              {total === 0
                ? "All clear"
                : `${total} active alert${total === 1 ? "" : "s"}`}
            </div>
          </div>
          {total > 0 ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cream-50/45">
              {critical ? "critical present" : warning ? "needs attention" : "info"}
            </span>
          ) : null}
        </div>

        {total === 0 ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-leaf-500/[0.10] border border-leaf-400/30 text-leaf-300 mb-2">
              <IconCheck size={20} />
            </div>
            <div className="text-sm text-cream-50 font-medium">
              No alerts to surface
            </div>
            <div className="text-[12px] text-cream-50/55 mt-1 font-mono">
              Pending queues are clear, inbox is empty, env is wired.
            </div>
          </div>
        ) : (
          <ul
            role="list"
            className="max-h-[28rem] overflow-y-auto p-2 space-y-2"
          >
            {alerts.map((a) => (
              <li key={a.id}>
                <AlertCard alert={a} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const t = TONE[alert.severity];
  return (
    <article
      className={[
        "relative rounded-2xl border backdrop-blur-sm bg-[#0B0E16]/85 transition-colors",
        t.container,
      ].join(" ")}
    >
      <div className="p-3.5 sm:p-4 flex items-start gap-3">
        <span
          aria-hidden
          className={[
            "shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border text-base leading-none",
            t.icon,
          ].join(" ")}
        >
          {alert.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span
              className={[
                "inline-flex items-center rounded-full border text-[10px] font-semibold uppercase tracking-[0.16em] px-2 py-0.5 font-mono",
                t.eyebrow,
              ].join(" ")}
            >
              {t.eyebrowLabel}
            </span>
          </div>
          <h3 className={["text-sm font-medium leading-tight", t.title].join(" ")}>
            {alert.title}
          </h3>
          {alert.description ? (
            <p className={["text-[12.5px] mt-1 font-mono leading-relaxed", t.description].join(" ")}>
              {alert.description}
            </p>
          ) : null}
        </div>
        {alert.cta ? (
          <Link
            href={alert.cta.href}
            prefetch={false}
            className={[
              "shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium font-mono whitespace-nowrap transition-colors",
              t.cta,
            ].join(" ")}
          >
            {alert.cta.label}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
