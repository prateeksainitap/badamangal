import {
  approveMentionAction,
  rejectMentionAction,
  extendMentionAction,
} from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { RowCheckbox } from "@/components/admin/QueueSelection";
import { IconCheck, IconX } from "@/components/admin/AdminIcons";

/**
 * WhatsApp mention moderation row, dark-themed card for the
 * /admin/mentions queue. Replaces the legacy light-paper rendering
 * with a row matching the rest of the new admin shell.
 *
 * Layout:
 *
 *   ┌─ Intent pill · Confidence · Sender · Group · Time ──────────┐
 *   │                                                             │
 *   │   The actual cleaned message text                           │
 *   │                                                             │
 *   │   📍 Location label · source · [preview ↗]                  │
 *   │                                                             │
 *   │   [Approve]  [Reject]   [+24h if approved]                  │
 *   └─────────────────────────────────────────────────────────────┘
 */

export type MentionQueueRow = {
  id: string;
  status: string;
  intent: string;
  confidence: number;
  cleanedText: string | null;
  originalText: string;
  senderName: string | null;
  groupName: string | null;
  locationLabel: string | null;
  locationSource: string;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
};

type Props = {
  mention: MentionQueueRow;
  /** Stagger index, clamped at 6 (see BhandaraRow / SpotRow for
   *  the rationale). */
  index: number;
};

export default function MentionRow({ mention: m, index }: Props) {
  const fromBits = [m.senderName, m.groupName].filter(Boolean);
  const fromLine =
    fromBits.length > 0 ? fromBits.join(" · ") : "Unknown sender";

  // Cleaned text takes priority; legacy rows without classifier
  // output fall back to originalText with the [bot:…] suffix stripped.
  const text = m.cleanedText ?? m.originalText.split("\n\n[bot:")[0] ?? "";

  const hasCoords = m.lat !== null && m.lng !== null && (m.lat !== 0 || m.lng !== 0);

  return (
    <article
      style={{ ["--i" as string]: Math.min(index, 6) }}
      className="admin-row-in relative rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4 sm:p-5 transition-all hover:border-cyan-400/35"
    >
      <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
        <RowCheckbox id={m.id} label={text.slice(0, 60)} />
      </div>
      <div className="pl-8">
      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] mb-2">
        <IntentPill intent={m.intent} />
        <ConfidencePill confidence={m.confidence} />
        <span className="text-cream-50/65">{fromLine}</span>
        <span aria-hidden className="text-cream-50/25">
          ·
        </span>
        <span className="text-cream-50/55">{timeAgo(m.createdAt)}</span>
        {m.status !== "PENDING" ? (
          <span
            className={[
              "ml-auto inline-flex items-center rounded-full border text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5",
              m.status === "APPROVED"
                ? "border-leaf-400/30 bg-leaf-400/[0.14] text-leaf-400"
                : "border-sindoor-700/35 bg-sindoor-700/[0.18] text-sindoor-700",
            ].join(" ")}
          >
            {m.status === "APPROVED" ? "Approved" : "Rejected"}
          </span>
        ) : null}
      </div>

      {/* Message text */}
      <p className="text-sm text-cream-50/90 leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </p>

      {/* Location strip */}
      {hasCoords ? (
        <div className="mt-3 text-xs flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cream-50/[0.05] text-leaf-400">
            <span aria-hidden>📍</span>
            <span>
              {m.locationLabel ??
                `${m.lat?.toFixed(4)}, ${m.lng?.toFixed(4)}`}
            </span>
          </span>
          <span className="text-cream-50/40">
            ({m.locationSource.replace(/_/g, " ")})
          </span>
          <a
            href={`https://www.google.com/maps?q=${m.lat},${m.lng}&z=17`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-saffron-500 hover:text-saffron-500/80 underline decoration-dotted underline-offset-2"
          >
            preview ↗
          </a>
        </div>
      ) : (
        <p className="mt-3 text-xs text-cream-50/45 italic">
          No location extracted, appears on the feed but not on the heatmap.
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {m.status !== "APPROVED" ? (
          <form action={approveMentionAction.bind(null, m.id)}>
            <SubmitButton variant="primary-green" pendingLabel="Approving…">
              <IconCheck size={14} />
              <span>Approve</span>
            </SubmitButton>
          </form>
        ) : null}
        {m.status !== "REJECTED" ? (
          <form action={rejectMentionAction.bind(null, m.id)}>
            <SubmitButton
              variant="outline-alert"
              pendingLabel="Rejecting…"
              confirm="Reject this mention?"
            >
              <IconX size={14} />
              <span>Reject</span>
            </SubmitButton>
          </form>
        ) : null}
        {m.status === "APPROVED" ? (
          <form action={extendMentionAction.bind(null, m.id)}>
            <SubmitButton variant="outline-saffron" pendingLabel="Extending…">
              +24h
            </SubmitButton>
          </form>
        ) : null}
      </div>
      </div>
    </article>
  );
}

/* ─────────────────────── Subcomponents ────────────────────────── */

function IntentPill({ intent }: { intent: string }) {
  const STYLES: Record<string, { bg: string; text: string }> = {
    ASKING: { bg: "bg-cream-50/[0.08] border-cream-50/15", text: "text-cream-50/85" },
    SHARING: { bg: "bg-leaf-400/[0.14] border-leaf-400/30", text: "text-leaf-400" },
    MENTIONING: { bg: "bg-saffron-500/[0.14] border-saffron-500/30", text: "text-saffron-500" },
    UNRELATED: { bg: "bg-sindoor-700/[0.18] border-sindoor-700/35", text: "text-sindoor-700" },
  };
  const s = STYLES[intent] ?? STYLES.MENTIONING;
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.12em] px-2 py-0.5 text-[10px]",
        s.bg,
        s.text,
      ].join(" ")}
    >
      {intent.toLowerCase()}
    </span>
  );
}

function ConfidencePill({ confidence }: { confidence: number }) {
  // Tint by confidence floor, high (≥ 0.8) cream, mid (0.5-0.8)
  // saffron, low (< 0.5) sindoor. Same triage signal the legacy
  // ink-100 chip carried but with brand-aligned coloring.
  const tint =
    confidence >= 0.8
      ? "text-cream-50/85 border-cream-50/15 bg-cream-50/[0.05]"
      : confidence >= 0.5
        ? "text-saffron-500 border-saffron-500/30 bg-saffron-500/[0.10]"
        : "text-sindoor-700 border-sindoor-700/35 bg-sindoor-700/[0.16]";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border font-numerals tabular-nums px-2 py-0.5 text-[10px]",
        tint,
      ].join(" ")}
    >
      conf {confidence.toFixed(2)}
    </span>
  );
}

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(diff / 3_600_000);
  if (h < 24) return `${h}h ago`;
  const day = Math.round(diff / 86_400_000);
  return day < 7
    ? `${day}d ago`
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
