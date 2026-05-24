import {
  markOrganiseRequestContactedAction,
  markOrganiseRequestConfirmedAction,
  markOrganiseRequestCompletedAction,
  markOrganiseRequestRejectedAction,
  markOrganiseRequestNewAction,
  deleteOrganiseRequestAction,
} from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { IconCheck, IconX } from "@/components/admin/AdminIcons";

/**
 * OrganiseRequest moderation row — dark-themed card for the
 * /admin/organise lead workflow. Shows lead's name + phone +
 * package + size + dates + notes, and a stage-aware button cluster
 * that walks the lead through:
 *
 *   NEW → CONTACTED → CONFIRMED → COMPLETED
 *                  ↓
 *              REJECTED (auditable)
 *
 * Delete is the destructive option for actual spam; Reject keeps
 * an audit trail.
 */

export type OrganiseQueueRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  area: string | null;
  addressNotes: string | null;
  eventDates: string | null;
  eventTime: string | null;
  quantityType: string;
  quantityValue: number;
  packageTier: string;
  notes: string | null;
  status: string;
  source: string | null;
  createdAt: Date;
};

type Props = {
  row: OrganiseQueueRow;
  index: number;
};

export default function OrganiseRow({ row: r, index }: Props) {
  const dates = parseDates(r.eventDates);
  const qtyLabel =
    r.quantityType === "WHEAT_KG"
      ? `${r.quantityValue} kg wheat`
      : `${r.quantityValue} plates`;
  const tierLabel =
    r.packageTier === "CUSTOM"
      ? "Custom"
      : `${r.packageTier.charAt(0)}${r.packageTier.slice(1).toLowerCase()}`;
  const phoneDisplay = formatPhoneE164(r.phone);
  const phoneTel = `+91${r.phone.replace(/\D/g, "").slice(-10)}`;
  const createdAtLocal = r.createdAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <article
      style={{ ["--i" as string]: Math.min(index, 6) }}
      className="admin-row-in relative rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4 sm:p-5 transition-all hover:border-cyan-400/35"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-fraunces text-cream-50 text-lg leading-tight truncate">
            {r.name}
          </div>
          <div className="mt-1 text-xs text-cream-50/65 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <a
              href={`tel:${phoneTel}`}
              className="text-saffron-500 hover:text-saffron-500/80 font-numerals tabular-nums"
            >
              {phoneDisplay}
            </a>
            {r.email ? (
              <>
                <span aria-hidden className="text-cream-50/25">
                  ·
                </span>
                <a
                  href={`mailto:${r.email}`}
                  className="text-saffron-500 hover:text-saffron-500/80 truncate max-w-[16rem]"
                >
                  {r.email}
                </a>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StagePill status={r.status} />
          <span className="text-[10px] uppercase tracking-[0.12em] text-cream-50/45">
            {createdAtLocal} IST
          </span>
        </div>
      </div>

      {/* Details grid */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
        <Field label="Package" value={tierLabel} />
        <Field label="Size" value={qtyLabel} />
        {r.area ? <Field label="Area" value={r.area} /> : null}
        {r.addressNotes ? (
          <Field label="Venue / landmark" value={r.addressNotes} />
        ) : null}
        {dates.length > 0 ? (
          <Field
            label={`Dates${r.eventTime ? ` · ${r.eventTime}` : ""}`}
            value={dates.map(formatDmy).join(" · ")}
            full
          />
        ) : r.eventTime ? (
          <Field label="Time" value={r.eventTime} />
        ) : null}
        {r.notes ? (
          <div className="sm:col-span-2 mt-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-cream-50/45 mb-1">
              Notes from requester
            </div>
            <blockquote className="rounded-xl border-l-2 border-saffron-500/55 bg-cream-50/[0.03] px-3 py-2 text-cream-50/85 italic">
              {r.notes}
            </blockquote>
          </div>
        ) : null}
        {r.source ? (
          <Field label="Source" value={r.source} mono />
        ) : null}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-cream-50/10 flex flex-wrap items-center gap-2">
        {r.status === "NEW" || r.status === "REJECTED" ? (
          <form action={markOrganiseRequestContactedAction.bind(null, r.id)}>
            <SubmitButton variant="primary-green" pendingLabel="Saving…">
              📞 Mark contacted
            </SubmitButton>
          </form>
        ) : null}
        {r.status === "CONTACTED" ? (
          <form action={markOrganiseRequestConfirmedAction.bind(null, r.id)}>
            <SubmitButton variant="primary-green" pendingLabel="Saving…">
              <IconCheck size={14} />
              <span>Mark confirmed</span>
            </SubmitButton>
          </form>
        ) : null}
        {r.status === "CONFIRMED" ? (
          <form action={markOrganiseRequestCompletedAction.bind(null, r.id)}>
            <SubmitButton variant="primary-green" pendingLabel="Saving…">
              🎉 Mark completed
            </SubmitButton>
          </form>
        ) : null}
        {r.status !== "REJECTED" && r.status !== "COMPLETED" ? (
          <form action={markOrganiseRequestRejectedAction.bind(null, r.id)}>
            <SubmitButton variant="outline-alert" pendingLabel="Saving…">
              <IconX size={14} />
              <span>Reject</span>
            </SubmitButton>
          </form>
        ) : null}
        {r.status === "COMPLETED" || r.status === "REJECTED" ? (
          <form action={markOrganiseRequestNewAction.bind(null, r.id)}>
            <SubmitButton variant="outline-saffron" pendingLabel="Saving…">
              ↩ Reopen
            </SubmitButton>
          </form>
        ) : null}
        <form
          action={deleteOrganiseRequestAction.bind(null, r.id)}
          className="ml-auto"
        >
          <SubmitButton
            variant="outline-alert"
            pendingLabel="Deleting…"
            confirm="Delete this request permanently? Use 'Reject' instead to keep an audit trail."
          >
            Delete
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}

/* ────────────────── Subcomponents + helpers ───────────────────── */

function Field({
  label,
  value,
  full,
  mono,
}: {
  label: string;
  value: string;
  full?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-cream-50/45">
        {label}
      </div>
      <div
        className={[
          "mt-0.5 text-cream-50/90",
          mono ? "font-mono text-[11px]" : "font-medium text-[13px]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function StagePill({ status }: { status: string }) {
  const STYLES: Record<string, { bg: string; text: string; label: string }> = {
    NEW: {
      bg: "bg-saffron-500/[0.14] border-saffron-500/35",
      text: "text-saffron-500",
      label: "New",
    },
    CONTACTED: {
      bg: "bg-gold-500/[0.16] border-gold-500/40",
      text: "text-gold-500",
      label: "Contacted",
    },
    CONFIRMED: {
      bg: "bg-leaf-400/[0.14] border-leaf-400/30",
      text: "text-leaf-400",
      label: "Confirmed",
    },
    COMPLETED: {
      bg: "bg-cream-50/[0.08] border-cream-50/20",
      text: "text-cream-50/85",
      label: "Completed",
    },
    REJECTED: {
      bg: "bg-sindoor-700/[0.18] border-sindoor-700/35",
      text: "text-sindoor-700",
      label: "Rejected",
    },
  };
  const s = STYLES[status] ?? STYLES.NEW;
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border text-[10px] font-semibold uppercase tracking-[0.14em] px-2.5 py-0.5",
        s.bg,
        s.text,
      ].join(" ")}
    >
      {s.label}
    </span>
  );
}

function parseDates(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (Array.isArray(v))
      return v.filter((s): s is string => typeof s === "string");
  } catch {
    /* malformed legacy row */
  }
  return [];
}

function formatDmy(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}

function formatPhoneE164(digits: string): string {
  const ten = digits.replace(/\D/g, "").slice(-10);
  if (ten.length === 10) return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
  return digits;
}
