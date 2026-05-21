/**
 * /admin/volunteer-submissions, moderation queue for the volunteer
 * programme.
 *
 * One row per VolunteerSubmission. Shows: volunteer code + name,
 * bhandara fields, photo+video preview grid, GPS pin (with distance
 * from address if both present), and 5 action buttons:
 *   APPROVE (₹50 + creates Bhandara+Spot)
 *   PARTIAL (₹25 + creates Bhandara+Spot)
 *   REJECT  (₹0)
 *   DUPE    (₹0, flagged)
 *   REOPEN  (flip back to NEW from any terminal status)
 *
 * Tabs: NEW (default) · APPROVED · PARTIAL · REJECTED · DUPLICATE · ALL
 *
 * Server-rendered with `dynamic = "force-dynamic"` so admins always
 * see the latest queue (no ISR staleness, submissions are bursty
 * around Bada Mangal mornings).
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  approveVolunteerSubmissionAction,
  partialVolunteerSubmissionAction,
  rejectVolunteerSubmissionAction,
  markVolunteerSubmissionDuplicateAction,
  reopenVolunteerSubmissionAction,
  markAllVolunteerSubmissionsPaidAction,
} from "@/app/admin/actions";
import { submissionStatusLabel } from "@/lib/volunteer";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
// Admin auth check moved to @/lib/admin-auth, see import above.
// Was a local reimplementation (one of 12 in the codebase); the
// single source means future auth changes (session expiry,
// HMAC signing, IP allowlist) are a one-file edit.

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

export default async function VolunteerSubmissionsPage({ searchParams }: PageProps) {
  if (!(await isAdmin())) redirect("/admin");
  const sp = await searchParams;
  const tab = (sp.status ?? "NEW").toUpperCase();
  const allowedTabs = ["NEW", "APPROVED", "PARTIAL", "REJECTED", "DUPLICATE", "ALL"] as const;
  if (!(allowedTabs as readonly string[]).includes(tab)) notFound();

  const where = tab === "ALL" ? {} : { status: tab };

  const [rows, counts, unpaidTotal] = await Promise.all([
    prisma.volunteerSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        volunteer: {
          select: { name: true, code: true, status: true, phone: true, upi: true },
        },
      },
    }),
    prisma.volunteerSubmission.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.volunteerSubmission.aggregate({
      where: {
        status: { in: ["APPROVED", "PARTIAL"] },
        paidAt: null,
      },
      _sum: { payoutAmount: true },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all]),
  ) as Record<string, number>;
  const totalUnpaid = unpaidTotal._sum.payoutAmount ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
      <header className="pt-8 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-600">Moderation</p>
          <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
            Volunteer submissions
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Review what volunteers submitted, approve to create a Bhandara + Spot
            and unlock the ₹50 payout, or partial / reject as needed.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm rounded-full px-3 py-1.5 border border-gold-500/50 text-ink-900 hover:bg-cream-50"
        >
          ← Back to admin
        </Link>
      </header>

      {/* Status tabs */}
      <nav className="flex flex-wrap gap-2 mt-4">
        {(["NEW", "APPROVED", "PARTIAL", "DUPLICATE", "REJECTED", "ALL"] as const).map(
          (s) => {
            const active = tab === s;
            const n = s === "ALL" ? Object.values(countByStatus).reduce((a, b) => a + b, 0) : (countByStatus[s] ?? 0);
            return (
              <Link
                key={s}
                href={`?status=${s}`}
                className={`text-sm rounded-full px-3 py-1.5 border transition-colors ${
                  active
                    ? "bg-saffron-600 border-saffron-600 text-cream-50"
                    : "bg-white border-gold-500/50 text-ink-900 hover:bg-cream-50"
                }`}
              >
                {s} {n > 0 ? <span className="ml-1 opacity-80">({n})</span> : null}
              </Link>
            );
          },
        )}
      </nav>

      {/* Payout summary + bulk-mark-paid */}
      {totalUnpaid > 0 ? (
        <div className="mt-4 rounded-2xl border border-saffron-600/40 bg-saffron-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-ink-900">
              <strong>₹{totalUnpaid}</strong> owed to volunteers across all approved + partial submissions.
            </p>
            <p className="text-xs text-ink-600">
              After you've bulk-paid via UPI in your banking app, click below to mark all as paid.
            </p>
          </div>
          <form action={markAllVolunteerSubmissionsPaidAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors"
            >
              ✓ Mark all paid
            </button>
          </form>
        </div>
      ) : null}

      {/* Rows */}
      <ul className="mt-6 grid gap-4">
        {rows.length === 0 ? (
          <li className="rounded-2xl border border-gold-500/40 bg-cream-50 p-8 text-center text-sm text-ink-600">
            No submissions in this view.
          </li>
        ) : (
          rows.map((r) => (
            <SubmissionRow key={r.id} sub={r} />
          ))
        )}
      </ul>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────

type SubmissionRowProps = {
  sub: Awaited<ReturnType<typeof prisma.volunteerSubmission.findMany>>[number] & {
    volunteer: { name: string; code: string | null; status: string; phone: string; upi: string };
  };
};

function SubmissionRow({ sub }: SubmissionRowProps) {
  const photoUrls = safeUrls(sub.photoUrls);
  const videoUrls = safeUrls(sub.videoUrls);
  const photoBundleOk = photoUrls.length >= 10;
  const videoBundleOk = videoUrls.length >= 2;
  const spotOk = Boolean(sub.spotPhotoUrl);
  const fullBundle = photoBundleOk && videoBundleOk && spotOk;

  const lbl = submissionStatusLabel(sub.status);
  const created = new Date(sub.createdAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Approve/partial actions bound to id
  const approve = approveVolunteerSubmissionAction.bind(null, sub.id);
  const partial = partialVolunteerSubmissionAction.bind(null, sub.id);
  const reject = rejectVolunteerSubmissionAction.bind(null, sub.id);
  const dupe = markVolunteerSubmissionDuplicateAction.bind(null, sub.id);
  const reopen = reopenVolunteerSubmissionAction.bind(null, sub.id);

  const isTerminal = sub.status !== "NEW";

  return (
    <li className="rounded-2xl border border-gold-500/40 bg-cream-50 p-4 sm:p-5">
      {/* Header row: volunteer + status + payout */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-ink-600">
            <span className="font-fraunces text-base text-sindoor-700">{sub.bhandaraName}</span>
            <span className="ml-2 text-ink-600">· {sub.area}</span>
          </p>
          <p className="text-xs text-ink-600 mt-0.5">
            by{" "}
            <Link
              href={`/admin/volunteers#${sub.volunteer.code}`}
              className="font-medium text-saffron-600 hover:underline"
            >
              {sub.volunteer.name}
            </Link>{" "}
            ({sub.volunteer.code}) · {created}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">{lbl.emoji} {lbl.en}</span>
          {sub.payoutAmount > 0 ? (
            <span className="text-sm font-medium text-leaf-600">
              ₹{sub.payoutAmount}
              {sub.paidAt ? " · paid" : " · unpaid"}
            </span>
          ) : null}
        </div>
      </div>

      {/* Bundle status pills */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Pill ok={photoBundleOk} label={`📸 ${photoUrls.length}/10 photos`} />
        <Pill ok={videoBundleOk} label={`🎥 ${videoUrls.length}/2 videos`} />
        <Pill ok={spotOk} label="📍 spot photo" />
        <Pill ok={Boolean(sub.gpsLat && sub.gpsLng)} label="🧭 GPS" />
        {!fullBundle && sub.status === "NEW" ? (
          <span className="px-2 py-0.5 rounded-full bg-saffron-50 text-ink-600">
            partial bundle
          </span>
        ) : null}
      </div>

      {/* Details grid */}
      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
        <Detail label="Address" value={sub.address} />
        <Detail
          label="Organizer"
          value={
            sub.organizerName
              ? `${sub.organizerName}${sub.organizerPhone ? ` · ${sub.organizerPhone}` : ""}`
              : "-"
          }
        />
        <Detail label="Start time" value={sub.startTime ?? "-"} />
        <Detail label="Menu" value={sub.menu ?? "-"} />
        {sub.gpsLat && sub.gpsLng ? (
          <Detail
            label="GPS"
            value={
              <a
                href={`https://www.google.com/maps?q=${sub.gpsLat},${sub.gpsLng}&z=18`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-saffron-600 hover:underline"
              >
                {sub.gpsLat.toFixed(5)}, {sub.gpsLng.toFixed(5)} ↗
              </a>
            }
          />
        ) : (
          <Detail label="GPS" value="missing" />
        )}
        {sub.mapsUrl ? (
          <Detail
            label="Maps link"
            value={
              <a href={sub.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-saffron-600 hover:underline">
                Open ↗
              </a>
            }
          />
        ) : null}
        {sub.volunteerNotes ? (
          <Detail label="Volunteer notes" value={sub.volunteerNotes} />
        ) : null}
        {sub.resultingBhandaraId ? (
          <Detail
            label="Created Bhandara"
            value={
              <Link
                href={`/admin/edit/${sub.resultingBhandaraId}`}
                className="text-saffron-600 hover:underline"
              >
                Edit & publish →
              </Link>
            }
          />
        ) : null}
      </div>

      {/* Photo strip */}
      {photoUrls.length > 0 ? (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm text-ink-600 hover:text-saffron-600">
            📸 Show {photoUrls.length} photos
          </summary>
          <ul className="mt-2 grid grid-cols-5 sm:grid-cols-10 gap-1">
            {photoUrls.map((url) => (
              <li key={url} className="aspect-square rounded border border-gold-500/40 overflow-hidden bg-cream-50">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Spot + videos */}
      {(sub.spotPhotoUrl || videoUrls.length > 0) ? (
        <div className="mt-3 grid sm:grid-cols-3 gap-2">
          {sub.spotPhotoUrl ? (
            <a
              href={sub.spotPhotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded border border-gold-500/40 overflow-hidden bg-cream-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sub.spotPhotoUrl} alt="spot" className="w-full h-24 object-cover" />
              <p className="text-xs text-ink-600 text-center py-1">📍 spot photo</p>
            </a>
          ) : null}
          {videoUrls.map((url) => (
            <video
              key={url}
              src={url}
              controls
              preload="metadata"
              className="w-full h-24 rounded border border-gold-500/40 bg-cream-50 object-contain"
            />
          ))}
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {!isTerminal ? (
          <>
            <form action={approve}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors"
              >
                ✅ Approve · ₹50
              </button>
            </form>
            <form action={partial}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors"
              >
                🟡 Partial · ₹25
              </button>
            </form>
            <form action={dupe}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/60 bg-white hover:bg-cream-50 text-ink-900 font-medium px-4 py-2 text-sm transition-colors"
              >
                ♻️ Duplicate
              </button>
            </form>
            <form action={reject}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-alert-500/40 text-alert-500 hover:bg-alert-500/10 font-medium px-4 py-2 text-sm transition-colors"
              >
                ❌ Reject
              </button>
            </form>
          </>
        ) : (
          <form action={reopen}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/60 bg-white hover:bg-cream-50 text-ink-900 font-medium px-3 py-1.5 text-sm transition-colors"
            >
              ↺ Reopen for review
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full ${
        ok
          ? "bg-leaf-600/10 text-leaf-600"
          : "bg-alert-500/10 text-alert-500"
      }`}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-ink-600">{label}</p>
      <p className="text-sm text-ink-900 mt-0.5">{value}</p>
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
