import Link from "next/link";
import {
  approveVolunteerSubmissionAction,
  partialVolunteerSubmissionAction,
  rejectVolunteerSubmissionAction,
  markVolunteerSubmissionDuplicateAction,
  reopenVolunteerSubmissionAction,
} from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { submissionStatusLabel } from "@/lib/volunteer";
import { IconCheck, IconX } from "@/components/admin/AdminIcons";

/**
 * Volunteer submission row — dark-themed card for
 * /admin/volunteers/submissions. Renders the bundle quality
 * (photos / videos / spot / GPS) at a glance + a 4-action
 * cluster (Approve · Partial · Duplicate · Reject) on NEW
 * submissions; Reopen on terminal ones.
 */

export type SubmissionRow = {
  id: string;
  status: string;
  bhandaraName: string;
  area: string;
  address: string;
  organizerName: string | null;
  organizerPhone: string | null;
  startTime: string | null;
  menu: string | null;
  photoUrls: string;
  videoUrls: string;
  spotPhotoUrl: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  mapsUrl: string | null;
  volunteerNotes: string | null;
  resultingBhandaraId: string | null;
  payoutAmount: number;
  paidAt: Date | null;
  createdAt: Date;
  volunteer: {
    name: string;
    code: string | null;
    status: string;
    phone: string;
    upi: string;
  };
};

export default function VolunteerSubmissionRow({
  sub,
  index,
}: {
  sub: SubmissionRow;
  index: number;
}) {
  const photoUrls = safeUrls(sub.photoUrls);
  const videoUrls = safeUrls(sub.videoUrls);
  const photoBundleOk = photoUrls.length >= 10;
  const videoBundleOk = videoUrls.length >= 2;
  const spotOk = Boolean(sub.spotPhotoUrl);
  const lbl = submissionStatusLabel(sub.status);
  const created = new Date(sub.createdAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const isTerminal = sub.status !== "NEW";

  return (
    <article
      style={{ ["--i" as string]: Math.min(index, 6) }}
      className="admin-row-in relative rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4 sm:p-5 transition-all hover:border-cyan-400/35"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-fraunces text-cream-50 text-lg leading-tight">
            {sub.bhandaraName}
          </div>
          <div className="mt-1 text-xs text-cream-50/65 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{sub.area}</span>
            <span aria-hidden className="text-cream-50/25">
              ·
            </span>
            <span>
              by{" "}
              <Link
                href={`/admin/volunteers#${sub.volunteer.code ?? sub.volunteer.name}`}
                prefetch={false}
                className="text-cyan-300 hover:text-cyan-200"
              >
                {sub.volunteer.name}
              </Link>{" "}
              {sub.volunteer.code ? `(${sub.volunteer.code})` : null}
            </span>
            <span aria-hidden className="text-cream-50/25">
              ·
            </span>
            <span className="text-cream-50/55">{created}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <SubmissionStatusPill status={sub.status} label={`${lbl.emoji} ${lbl.en}`} />
          {sub.payoutAmount > 0 ? (
            <span
              className={[
                "inline-flex items-center rounded-full border text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5",
                sub.paidAt
                  ? "border-leaf-400/30 bg-leaf-400/[0.14] text-leaf-400"
                  : "border-cyan-400/35 bg-cyan-400/[0.14] text-cyan-300",
              ].join(" ")}
            >
              ₹{sub.payoutAmount} {sub.paidAt ? "paid" : "unpaid"}
            </span>
          ) : null}
        </div>
      </div>

      {/* Bundle quality pills */}
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        <BundlePill ok={photoBundleOk} label={`📸 ${photoUrls.length}/10`} />
        <BundlePill ok={videoBundleOk} label={`🎥 ${videoUrls.length}/2`} />
        <BundlePill ok={spotOk} label="📍 spot" />
        <BundlePill ok={Boolean(sub.gpsLat && sub.gpsLng)} label="🧭 GPS" />
      </div>

      {/* Details */}
      <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs">
        <Field label="Address" value={sub.address || "—"} />
        <Field
          label="Organizer"
          value={
            sub.organizerName
              ? `${sub.organizerName}${sub.organizerPhone ? ` · ${sub.organizerPhone}` : ""}`
              : "—"
          }
        />
        <Field label="Start time" value={sub.startTime ?? "—"} />
        <Field label="Menu" value={sub.menu ?? "—"} />
        {sub.gpsLat && sub.gpsLng ? (
          <Field
            label="GPS"
            value={
              <a
                href={`https://www.google.com/maps?q=${sub.gpsLat},${sub.gpsLng}&z=18`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 hover:text-cyan-200"
              >
                {sub.gpsLat.toFixed(5)}, {sub.gpsLng.toFixed(5)} ↗
              </a>
            }
          />
        ) : null}
        {sub.volunteerNotes ? (
          <Field label="Notes" value={sub.volunteerNotes} full />
        ) : null}
        {sub.resultingBhandaraId ? (
          <Field
            label="Created Bhandara"
            value={
              <Link
                href={`/admin/edit/${sub.resultingBhandaraId}`}
                prefetch={false}
                className="text-cyan-300 hover:text-cyan-200"
              >
                Edit &amp; publish →
              </Link>
            }
          />
        ) : null}
      </div>

      {/* Photos collapsible */}
      {photoUrls.length > 0 ? (
        <details className="mt-3 group">
          <summary className="cursor-pointer list-none text-xs text-cream-50/65 hover:text-cream-50 inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block w-4 h-4 rounded-md bg-cream-50/[0.08] text-cream-50/75 text-center leading-4 group-open:rotate-90 transition-transform">
              ▸
            </span>
            Show {photoUrls.length} photos
          </summary>
          <ul className="mt-2 grid grid-cols-5 sm:grid-cols-10 gap-1">
            {photoUrls.map((url) => (
              <li
                key={url}
                className="aspect-square rounded-md border border-cream-50/10 overflow-hidden bg-cream-50/[0.02]"
              >
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Spot + videos */}
      {sub.spotPhotoUrl || videoUrls.length > 0 ? (
        <div className="mt-3 grid sm:grid-cols-3 gap-2">
          {sub.spotPhotoUrl ? (
            <a
              href={sub.spotPhotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-md border border-cream-50/10 overflow-hidden bg-cream-50/[0.02]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sub.spotPhotoUrl}
                alt="spot"
                className="w-full h-24 object-cover"
              />
              <p className="text-[10px] text-cream-50/55 text-center py-1">
                📍 spot photo
              </p>
            </a>
          ) : null}
          {videoUrls.map((url) => (
            <video
              key={url}
              src={url}
              controls
              preload="metadata"
              className="w-full h-24 rounded-md border border-cream-50/10 bg-cream-50/[0.02] object-contain"
            />
          ))}
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-cream-50/10 flex flex-wrap items-center gap-2">
        {!isTerminal ? (
          <>
            <form action={approveVolunteerSubmissionAction.bind(null, sub.id)}>
              <SubmitButton variant="primary-green" pendingLabel="Approving…">
                <IconCheck size={14} />
                <span>Approve · ₹50</span>
              </SubmitButton>
            </form>
            <form action={partialVolunteerSubmissionAction.bind(null, sub.id)}>
              <SubmitButton variant="outline-saffron" pendingLabel="Saving…">
                🟡 Partial · ₹25
              </SubmitButton>
            </form>
            <form action={markVolunteerSubmissionDuplicateAction.bind(null, sub.id)}>
              <SubmitButton variant="outline-ink" pendingLabel="Saving…">
                Duplicate
              </SubmitButton>
            </form>
            <form action={rejectVolunteerSubmissionAction.bind(null, sub.id)}>
              <SubmitButton
                variant="outline-alert"
                pendingLabel="Rejecting…"
                confirm="Reject this submission?"
              >
                Reject
              </SubmitButton>
            </form>
          </>
        ) : (
          <form action={reopenVolunteerSubmissionAction.bind(null, sub.id)}>
            <SubmitButton variant="outline-saffron" pendingLabel="Reopening…">
              ↺ Reopen for review
            </SubmitButton>
          </form>
        )}
      </div>
    </article>
  );
}

/* ───────────────────── Subcomponents ──────────────────────────── */

function BundlePill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium",
        ok
          ? "bg-leaf-400/[0.14] text-leaf-400 border border-leaf-400/30"
          : "bg-sindoor-700/[0.16] text-sindoor-700 border border-sindoor-700/30",
      ].join(" ")}
    >
      <span aria-hidden className="inline-flex">
        {ok ? <IconCheck size={11} /> : <IconX size={11} />}
      </span>
      {label}
    </span>
  );
}

function SubmissionStatusPill({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const STYLES: Record<string, string> = {
    NEW: "bg-cyan-400/[0.14] border-cyan-400/30 text-cyan-300",
    APPROVED: "bg-leaf-400/[0.14] border-leaf-400/30 text-leaf-400",
    PARTIAL: "bg-saffron-500/[0.10] border-saffron-500/25 text-saffron-500",
    DUPLICATE: "bg-cream-50/[0.08] border-cream-50/15 text-cream-50/85",
    REJECTED: "bg-sindoor-700/[0.18] border-sindoor-700/35 text-sindoor-700",
  };
  const cls = STYLES[status] ?? STYLES.NEW;
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5",
        cls,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-cream-50/45">
        {label}
      </div>
      <div className="mt-0.5 text-cream-50/90 text-[12.5px]">{value}</div>
    </div>
  );
}

function safeUrls(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}
