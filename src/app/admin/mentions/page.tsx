/**
 * Admin moderation queue for BhandaraMention rows (WhatsApp text-message
 * ingest). Sister page to /admin (which moderates Bhandara + Spot rows
 * from the image ingest pipeline).
 *
 * Layout: three column grid per row —
 *   1. The verbatim cleanedText (what the public would see) + provenance
 *      pill (sender, group, intent, confidence, time).
 *   2. Location: either a small "here's the pin" hint with locationLabel
 *      + a Google-Maps preview link, or a "no location" indicator if the
 *      classifier couldn't extract coords.
 *   3. Action cluster: Approve (saffron primary), Reject (outline-alert),
 *      Extend (outline-ink, only on already-APPROVED rows).
 *
 * Filters at the top: status tabs (Pending / Approved / Rejected),
 * intent dropdown (All / ASKING / SHARING / MENTIONING), and a
 * confidence-floor slider so admins can triage low-confidence rows
 * separately. Defaults to status=Pending so the queue lands on the
 * "needs your attention" view.
 *
 * No client JS for the moderation actions themselves, every Approve/
 * Reject/Extend button is inside its own <form action={…}> bound to a
 * server action. SubmitButton handles the pending spinner.
 *
 * Auth: same admin cookie as /admin. Redirects to /admin (which shows
 * the login form) on auth miss.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import {
  approveMentionAction,
  rejectMentionAction,
  extendMentionAction,
  purgeStaleMentionsAction,
} from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import ScreenshotIngestPanel from "@/components/admin/ScreenshotIngestPanel";
import AdminLiveRefresh from "@/components/admin/AdminLiveRefresh";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    intent?: string;
    minConf?: string;
  }>;
};

/** Parse + clamp the confidence-floor query param. Defaults to 0 (no
 *  filter); admin can override to 0.6 / 0.8 to triage low-confidence
 *  rows separately. */
function parseMinConf(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Map intent → display label + pill colour. Kept here (not in a
 *  shared constants file) because the mention moderation UI is the
 *  only surface that renders the full intent vocabulary; the public
 *  feed only differentiates ASKING vs SHARING. */
function intentMeta(intent: string): { label: string; className: string } {
  switch (intent) {
    case "ASKING":
      return {
        label: "Asking",
        className: "bg-saffron-100 text-saffron-700 border-saffron-300",
      };
    case "SHARING":
      return {
        label: "Sharing",
        className: "bg-leaf-100 text-leaf-700 border-leaf-300",
      };
    case "MENTIONING":
      return {
        label: "Mentioning",
        className: "bg-gold-100 text-gold-700 border-gold-300",
      };
    default:
      return {
        label: intent,
        className: "bg-ink-100 text-ink-700 border-ink-300",
      };
  }
}

function timeAgo(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  return `${day}d ago`;
}

export default async function MentionsModerationPage({
  searchParams,
}: PageProps) {
  if (!(await isAdmin())) redirect("/admin");
  const sp = await searchParams;

  const status = sp.status ?? "PENDING";
  const intent = sp.intent ?? "ALL";
  const minConf = parseMinConf(sp.minConf);

  // Pull rows for the current filter view. Limit at 200 to keep the
  // page snappy; the purge button at the bottom keeps the PENDING
  // tab from growing unboundedly.
  const rows = await prisma.bhandaraMention.findMany({
    where: {
      ...(status === "ALL" ? {} : { status }),
      ...(intent === "ALL" ? {} : { intent }),
      ...(minConf > 0 ? { confidence: { gte: minConf } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Counts for the filter pills (visible without clicking).
  const [countPending, countApproved, countRejected] = await Promise.all([
    prisma.bhandaraMention.count({ where: { status: "PENDING" } }),
    prisma.bhandaraMention.count({ where: { status: "APPROVED" } }),
    prisma.bhandaraMention.count({ where: { status: "REJECTED" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
      {/* Auto-refresh the server-rendered queue every 10s so newly-
          ingested PENDING mentions appear without operator F5. Pure
          client-side effect; renders nothing. */}
      <AdminLiveRefresh intervalMs={10_000} />

      <header className="pt-8 pb-4">
        <p className="text-xs uppercase tracking-wider text-ink-600">
          Moderation
        </p>
        <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
          WhatsApp mentions
        </h1>
        <p className="mt-2 text-sm text-ink-600 max-w-2xl">
          Text messages forwarded by the OpenClaw agent from allowlisted
          bhandara WhatsApp groups, classified by Gemini and held for
          your review. Approved mentions appear on the homepage&apos;s
          live chatter section and seed the bhandara-density heatmap
          for 24 hours.
        </p>
        <div className="mt-3">
          <Link
            href="/admin"
            className="text-sm text-saffron-600 hover:text-saffron-700 underline decoration-dotted underline-offset-4"
          >
            ← Back to main admin
          </Link>
        </div>
      </header>

      {/* Screenshot-ingest test panel — collapsed by default. Lets
          the admin upload a WhatsApp chat screenshot, run it through
          Gemini Vision + classifier, and seed APPROVED BhandaraMention
          rows so the homepage heatmap populates without waiting for
          the OpenClaw agent. See src/components/admin/ScreenshotIngestPanel.tsx
          for the full flow + rationale. */}
      <ScreenshotIngestPanel />

      {/* Status tabs — three pills with live counts. Clicking sets
          ?status=… on the URL so refreshes preserve the view. */}
      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        <StatusPill
          label={`Pending (${countPending})`}
          target="PENDING"
          active={status === "PENDING"}
          intent={intent}
          minConf={minConf}
        />
        <StatusPill
          label={`Approved (${countApproved})`}
          target="APPROVED"
          active={status === "APPROVED"}
          intent={intent}
          minConf={minConf}
        />
        <StatusPill
          label={`Rejected (${countRejected})`}
          target="REJECTED"
          active={status === "REJECTED"}
          intent={intent}
          minConf={minConf}
        />
        <StatusPill
          label="All"
          target="ALL"
          active={status === "ALL"}
          intent={intent}
          minConf={minConf}
        />
      </nav>

      {/* Secondary filters: intent dropdown + confidence floor. Both
          submit on change via GET (no client JS needed — the form's
          method=get + name=… inputs round-trip through searchParams). */}
      <form
        method="get"
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] items-end"
      >
        <input type="hidden" name="status" value={status} />
        <label className="grid gap-1 text-xs text-ink-600">
          Intent
          <select
            name="intent"
            defaultValue={intent}
            className="rounded-lg border border-gold-500/50 bg-white px-3 py-1.5 text-sm text-ink-900"
          >
            <option value="ALL">All intents</option>
            <option value="ASKING">Asking</option>
            <option value="SHARING">Sharing</option>
            <option value="MENTIONING">Mentioning</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-ink-600">
          Min confidence
          <select
            name="minConf"
            defaultValue={String(minConf)}
            className="rounded-lg border border-gold-500/50 bg-white px-3 py-1.5 text-sm text-ink-900"
          >
            <option value="0">Any</option>
            <option value="0.4">0.4+</option>
            <option value="0.6">0.6+</option>
            <option value="0.8">0.8+</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full px-4 py-1.5 border border-gold-500/50 text-ink-900 text-sm hover:bg-cream-50"
        >
          Apply
        </button>
      </form>

      {/* Empty state — different copy per status so the admin knows
          whether "nothing here" means "all caught up" or "no rejected
          rows yet". */}
      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-ink-600 italic">
          {status === "PENDING"
            ? "Nothing waiting for review. The OpenClaw agent will surface new mentions here as they arrive."
            : status === "APPROVED"
              ? "No approved mentions match this filter."
              : status === "REJECTED"
                ? "No rejected mentions match this filter."
                : "No mentions match this filter."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {rows.map((m) => {
            const meta = intentMeta(m.intent);
            // Friendly group + sender display. Both are optional on
            // the payload, fall back to "—" so the row never renders
            // with awkward dangling "from: ·".
            const fromBits = [m.senderName, m.groupName].filter(Boolean);
            const fromLine =
              fromBits.length > 0 ? fromBits.join(" · ") : "Unknown sender";
            return (
              <li
                id={m.id}
                key={m.id}
                className="rounded-2xl border border-gold-500/40 bg-white p-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start"
              >
                <div className="grid gap-2 min-w-0">
                  {/* Provenance + intent pill */}
                  <div className="flex flex-wrap gap-2 items-center text-xs text-ink-600">
                    <span
                      className={`px-2 py-0.5 rounded-full border ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 border border-ink-300">
                      conf {m.confidence.toFixed(2)}
                    </span>
                    <span className="text-ink-600">{fromLine}</span>
                    <span className="text-ink-600">·</span>
                    <span className="text-ink-600">{timeAgo(m.createdAt)}</span>
                  </div>

                  {/* The cleaned message itself — the public surface
                      renders this verbatim. */}
                  <p className="text-sm text-ink-900 leading-relaxed whitespace-pre-wrap break-words">
                    {m.cleanedText ?? m.originalText.split("\n\n[bot:")[0]}
                  </p>

                  {/* Location strip: pin + label + maps link, or a
                      "no location" indicator. The heatmap can only
                      render mentions with non-null lat/lng, so this
                      is the admin's signal that approving this row
                      adds heat to the map. */}
                  {m.lat !== null && m.lng !== null ? (
                    <div className="text-xs text-leaf-700 flex flex-wrap items-center gap-2">
                      <span>
                        📍 {m.locationLabel ?? `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}`}
                      </span>
                      <span className="text-ink-600">
                        ({m.locationSource.replace(/_/g, " ")})
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${m.lat},${m.lng}&z=17`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-dotted underline-offset-4 text-saffron-600 hover:text-saffron-700"
                      >
                        preview ↗
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-600 italic">
                      No location extracted — mention will appear on the
                      feed but not on the heatmap.
                    </p>
                  )}
                </div>

                {/* Action cluster. Each button is its own form so the
                    SubmitButton can use useFormStatus to disable + show
                    a spinner during the round-trip. */}
                <div className="flex flex-wrap gap-2 justify-end sm:flex-col sm:items-stretch sm:min-w-[10rem]">
                  {m.status !== "APPROVED" ? (
                    <form action={approveMentionAction.bind(null, m.id)}>
                      <SubmitButton
                        variant="primary-saffron"
                        size="sm"
                        pendingLabel="…"
                      >
                        ✓ Approve
                      </SubmitButton>
                    </form>
                  ) : null}
                  {m.status !== "REJECTED" ? (
                    <form action={rejectMentionAction.bind(null, m.id)}>
                      <SubmitButton
                        variant="outline-alert"
                        size="sm"
                        pendingLabel="…"
                      >
                        ✕ Reject
                      </SubmitButton>
                    </form>
                  ) : null}
                  {m.status === "APPROVED" ? (
                    <form action={extendMentionAction.bind(null, m.id)}>
                      <SubmitButton
                        variant="outline-ink"
                        size="sm"
                        pendingLabel="…"
                      >
                        +24h
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Maintenance: purge PENDING rows older than 7 days. Kept
          out of the per-row action cluster (it's a queue-wide
          operation) and styled as a quiet outlined button at the
          bottom so it doesn't draw eye away from per-row triage. */}
      {countPending > 0 ? (
        <form
          action={purgeStaleMentionsAction}
          className="mt-10 pt-6 border-t border-gold-500/30"
        >
          <p className="text-xs text-ink-600 mb-2">
            Maintenance: hard-delete every PENDING mention older than 7
            days. Approved + rejected rows are preserved.
          </p>
          <SubmitButton variant="outline-alert" size="sm" pendingLabel="Purging…">
            Purge stale pending mentions
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

/** Status filter pill. Preserves the other filter params (intent +
 *  minConf) when navigating between status tabs so the admin doesn't
 *  lose their drill-down on tab switch. */
function StatusPill({
  label,
  target,
  active,
  intent,
  minConf,
}: {
  label: string;
  target: string;
  active: boolean;
  intent: string;
  minConf: number;
}) {
  const qs = new URLSearchParams();
  qs.set("status", target);
  if (intent !== "ALL") qs.set("intent", intent);
  if (minConf > 0) qs.set("minConf", String(minConf));
  return (
    <Link
      href={`/admin/mentions?${qs.toString()}`}
      className={
        active
          ? "rounded-full px-4 py-1.5 bg-sindoor-700 text-cream-50 font-medium"
          : "rounded-full px-4 py-1.5 border border-gold-500/50 text-ink-900 hover:bg-cream-50"
      }
    >
      {label}
    </Link>
  );
}
