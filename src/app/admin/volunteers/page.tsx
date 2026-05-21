/**
 * /admin/volunteers, registry of every volunteer + per-volunteer
 * totals + the weekly UPI payout CSV + the PENDING approval queue.
 *
 * Three main jobs (in order of urgency):
 *   1. Approve PENDING signups, issue a code via WhatsApp by
 *      clicking "Approve & send code" on each fresh row.
 *   2. Generate the Sunday-evening payout list (CSV export for bulk
 *      UPI in your banking app).
 *   3. See who's signed up, their status, their per-volunteer stats.
 *
 * PENDING applicants get a dedicated section at the top (yellow
 * card so they're visible above the fold). Other statuses follow
 * in the main list.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  setVolunteerStatusAction,
  rejectVolunteerSignupAction,
  markAllVolunteerSubmissionsPaidAction,
} from "@/app/admin/actions";
import { parseAreas, volunteerStatusLabel } from "@/lib/volunteer";
import ApproveVolunteerButton from "@/components/admin/ApproveVolunteerButton";

export const dynamic = "force-dynamic";
const COOKIE = "admin";

async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const c = await cookies();
  return c.get(COOKIE)?.value === expected;
}

export default async function VolunteersRegistryPage() {
  if (!(await isAdmin())) redirect("/admin");

  // One query for volunteers, one aggregate query for per-volunteer
  // submission totals. We join in JS rather than via Prisma's nested
  // include because we need GROUP BY + SUM which Prisma doesn't
  // express idiomatically through the relation.
  const [volunteers, byVol] = await Promise.all([
    prisma.volunteer.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.volunteerSubmission.groupBy({
      by: ["volunteerId", "status"],
      _count: { _all: true },
      _sum: { payoutAmount: true },
    }),
  ]);

  // Per-volunteer totals: total submitted, total approved+partial,
  // total earned (₹ across approved+partial), and unpaid (subset
  // where paidAt is null, needs a separate query because groupBy
  // can't filter on a third condition cleanly).
  const totalsByVol = new Map<
    string,
    { submitted: number; approved: number; earned: number }
  >();
  for (const v of volunteers) {
    totalsByVol.set(v.id, { submitted: 0, approved: 0, earned: 0 });
  }
  for (const g of byVol) {
    const t = totalsByVol.get(g.volunteerId);
    if (!t) continue;
    t.submitted += g._count._all;
    if (g.status === "APPROVED" || g.status === "PARTIAL") {
      t.approved += g._count._all;
      t.earned += g._sum.payoutAmount ?? 0;
    }
  }

  // Unpaid amount per volunteer = approved+partial with paidAt=null.
  const unpaidRows = await prisma.volunteerSubmission.groupBy({
    by: ["volunteerId"],
    where: {
      status: { in: ["APPROVED", "PARTIAL"] },
      paidAt: null,
    },
    _sum: { payoutAmount: true },
  });
  const unpaidByVol = new Map<string, number>();
  for (const r of unpaidRows) {
    unpaidByVol.set(r.volunteerId, r._sum.payoutAmount ?? 0);
  }

  const totalUnpaid = Array.from(unpaidByVol.values()).reduce(
    (sum, n) => sum + n,
    0,
  );

  // Split the volunteer list into "awaiting approval" and
  // "everyone else" so the PENDING applications can render in
  // their own attention-grabbing section above the main registry.
  const pendingVolunteers = volunteers.filter((v) => v.status === "PENDING");
  const activeVolunteers = volunteers.filter((v) => v.status !== "PENDING");

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
      <header className="pt-8 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-600">Programme</p>
          <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">Volunteers</h1>
          <p className="mt-2 text-sm text-ink-600">
            {volunteers.length} signed up · ₹{totalUnpaid} owed in unpaid
            approvals. Flip status as needed to manage trust + access.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/volunteer-submissions"
            className="text-sm rounded-full px-3 py-1.5 border border-gold-500/50 text-ink-900 hover:bg-cream-50"
          >
            Submissions →
          </Link>
          <Link
            href="/admin"
            className="text-sm rounded-full px-3 py-1.5 border border-gold-500/50 text-ink-900 hover:bg-cream-50"
          >
            ← Admin
          </Link>
        </div>
      </header>

      {/* Pending applications, surfaced above the fold because they
          block the volunteer from doing any work. Yellow card signals
          "needs your attention now". */}
      {pendingVolunteers.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-saffron-600/45 bg-saffron-50 p-4 sm:p-5">
          <header className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-fraunces text-lg text-sindoor-700">
              ⏳ Pending applications · {pendingVolunteers.length}
            </h2>
            <p className="text-xs text-ink-600">
              Approve to issue a code + send via WhatsApp (one click).
            </p>
          </header>
          <ul className="grid gap-3">
            {pendingVolunteers.map((v) => (
              <PendingApplicationCard key={v.id} volunteer={v} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* Weekly payout panel, only renders when there's actually
          unpaid money. PENDING rows have no code + no submissions
          so they're naturally excluded from the payout calc. */}
      {totalUnpaid > 0 ? (
        <PayoutPanel
          rows={volunteers
            .filter((v) => (unpaidByVol.get(v.id) ?? 0) > 0 && v.code)
            .map((v) => ({
              // Filter above ensures v.code is non-null here.
              code: v.code as string,
              name: v.name,
              upi: v.upi,
              amount: unpaidByVol.get(v.id) ?? 0,
            }))}
          total={totalUnpaid}
        />
      ) : null}

      {/* Active volunteers, everyone who's been approved (has a
          code), plus suspended rows for auditability. PENDING rows
          are rendered above instead. */}
      <ul className="mt-6 grid gap-3">
        {activeVolunteers.length === 0 ? (
          <li className="rounded-2xl border border-gold-500/40 bg-cream-50 p-8 text-center text-sm text-ink-600">
            {volunteers.length === 0
              ? "No volunteers signed up yet."
              : "No approved volunteers yet. Approve a PENDING application above to get started."}
          </li>
        ) : (
          activeVolunteers.map((v) => {
            const t = totalsByVol.get(v.id) ?? { submitted: 0, approved: 0, earned: 0 };
            const unpaid = unpaidByVol.get(v.id) ?? 0;
            const areas = parseAreas(v.areas);
            const lbl = volunteerStatusLabel(v.status);
            const setStatus = setVolunteerStatusAction.bind(null, v.id);
            return (
              <li
                key={v.id}
                id={v.code ?? v.id}
                className="rounded-2xl border border-gold-500/40 bg-cream-50 p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p>
                      <span className="font-fraunces text-lg text-sindoor-700">
                        {v.name}
                      </span>
                      {v.code ? (
                        <span className="ml-2 text-sm font-mono text-ink-600">{v.code}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-ink-600 mt-0.5">
                      📞{" "}
                      <a href={`tel:+91${v.phone}`} className="hover:text-saffron-600">
                        {v.phone}
                      </a>{" "}
                      · 💳 <span className="font-mono">{v.upi}</span>
                    </p>
                    {areas.length > 0 ? (
                      <p className="text-xs text-ink-600 mt-1">
                        📍 {areas.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-sm">
                    <p>{lbl.emoji} {lbl.en}</p>
                    <p className="text-xs text-ink-600 mt-1">
                      Joined {new Date(v.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </p>
                  </div>
                </div>

                {/* Stats strip */}
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                  <Stat label="Submitted" value={String(t.submitted)} />
                  <Stat label="Approved" value={String(t.approved)} />
                  <Stat label="Earned" value={`₹${t.earned}`} />
                  <Stat label="Unpaid" value={`₹${unpaid}`} highlight={unpaid > 0} />
                </div>

                {/* Status flip buttons */}
                <form action={setStatus} className="mt-3 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-ink-600">Set status:</span>
                  {(["PROBATIONARY", "TRUSTED", "SUSPENDED"] as const).map((s) => {
                    const active = v.status === s;
                    return (
                      <button
                        key={s}
                        type="submit"
                        name="status"
                        value={s}
                        disabled={active}
                        className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                          active
                            ? "bg-saffron-600 border-saffron-600 text-cream-50 cursor-default"
                            : "bg-white border-gold-500/50 text-ink-900 hover:bg-cream-50"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </form>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/* ─── Pending application card ───────────────────────────── */
function PendingApplicationCard({
  volunteer: v,
}: {
  volunteer: Awaited<ReturnType<typeof prisma.volunteer.findMany>>[number];
}) {
  const areas = parseAreas(v.areas);
  const reject = rejectVolunteerSignupAction.bind(null, v.id);
  return (
    <li className="rounded-xl border border-gold-500/45 bg-white p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-fraunces text-base text-sindoor-700">{v.name}</p>
          <p className="text-xs text-ink-600 mt-0.5">
            📞{" "}
            <a href={`tel:+91${v.phone}`} className="hover:text-saffron-600">
              {v.phone}
            </a>{" "}
            · 💳 <span className="font-mono">{v.upi}</span>
          </p>
          {areas.length > 0 ? (
            <p className="text-xs text-ink-600 mt-1 truncate">
              📍 {areas.join(", ")}
            </p>
          ) : null}
          <p className="text-xs text-ink-600 mt-1">
            Applied {new Date(v.createdAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-stretch sm:items-center">
          <ApproveVolunteerButton id={v.id} />
          <form action={reject}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border border-alert-500/45 text-alert-500 hover:bg-alert-500/10 font-medium px-3 py-1.5 text-xs transition-colors"
            >
              ❌ Reject
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

// ────────────────────────────────────────────────────────────────────

function PayoutPanel({
  rows,
  total,
}: {
  rows: { code: string; name: string; upi: string; amount: number }[];
  total: number;
}) {
  // CSV string the admin can copy into their banking app's bulk
  // payout import (most banking apps accept "upi,amount,note" CSVs).
  // We keep the format simple + paste-friendly.
  const csv = [
    "name,upi,amount,note",
    ...rows.map(
      (r) =>
        `"${r.name.replace(/"/g, '""')}","${r.upi}",${r.amount},"BadaMangal ${r.code}"`,
    ),
  ].join("\n");

  return (
    <section className="mt-4 rounded-2xl border border-saffron-600/40 bg-saffron-50 p-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-fraunces text-lg text-sindoor-700">
            Weekly payout · ₹{total}
          </h2>
          <p className="text-xs text-ink-600 mt-0.5">
            {rows.length} volunteer{rows.length === 1 ? "" : "s"} awaiting payment.
            Copy CSV → paste into your banking app's bulk UPI import, OR pay each via UPI app, then click "Mark all paid".
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
      </header>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-ink-600">
            <th className="py-1">Volunteer</th>
            <th className="py-1">UPI</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-t border-gold-500/20">
              <td className="py-2">
                {r.name} <span className="text-xs text-ink-600">({r.code})</span>
              </td>
              <td className="py-2 font-mono text-xs break-all">{r.upi}</td>
              <td className="py-2 text-right font-medium">₹{r.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-ink-600 hover:text-saffron-600">
          📋 Show CSV (copy → paste into banking app)
        </summary>
        <pre className="mt-2 p-3 rounded-lg bg-white border border-gold-500/40 text-xs font-mono text-ink-900 whitespace-pre-wrap select-all overflow-x-auto">
          {csv}
        </pre>
      </details>
    </section>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg px-2 py-1 ${highlight ? "bg-saffron-50" : "bg-white"} border border-gold-500/40`}>
      <p className="text-xs uppercase tracking-wider text-ink-600">{label}</p>
      <p className={`text-sm font-medium ${highlight ? "text-saffron-600" : "text-ink-900"}`}>{value}</p>
    </div>
  );
}
