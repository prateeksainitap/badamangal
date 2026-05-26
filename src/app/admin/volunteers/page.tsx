import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import {
  setVolunteerStatusAction,
  rejectVolunteerSignupAction,
  markAllVolunteerSubmissionsPaidAction,
} from "@/app/admin/actions";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import ApproveVolunteerButton from "@/components/admin/ApproveVolunteerButton";
import SubmitButton from "@/components/admin/SubmitButton";
import KpiStrip from "@/components/admin/KpiStrip";
import AdminPageHero from "@/components/admin/AdminPageHero";
import {
  IconVolunteer,
  IconUserPlus,
  IconCheck,
  IconClock,
} from "@/components/admin/AdminIcons";
import { parseAreas, volunteerStatusLabel } from "@/lib/volunteer";

/**
 * Volunteers registry, dark-themed rewrite. Three logical sections:
 *
 *   1. Pending applications card (saffron border, top of page)
 *   2. Weekly payout panel (when there's unpaid money)
 *   3. Active volunteer list (everyone with a code)
 *
 * Top-bar CTA links to /admin/volunteer-submissions for the
 * per-submission moderation queue.
 */

export const metadata: Metadata = {
  title: "Volunteers · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminVolunteersPage() {
  if (!(await isAdmin())) redirect("/admin");

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

  const unpaidRows = await prisma.volunteerSubmission.groupBy({
    by: ["volunteerId"],
    where: { status: { in: ["APPROVED", "PARTIAL"] }, paidAt: null },
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

  const pendingVolunteers = volunteers.filter((v) => v.status === "PENDING");
  const activeVolunteers = volunteers.filter((v) => v.status !== "PENDING");

  const approvedCount = activeVolunteers.filter(
    (v) => v.status !== "REJECTED",
  ).length;

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        <AdminPageHero
          subject="volunteers"
          eyebrow="Programme"
          title="Volunteers"
          subtitle={
            <>
              <span className="text-cream-50/85 tabular-nums">
                {volunteers.length}
              </span>{" "}
              signed up ·{" "}
              <span className="text-cyan-300 tabular-nums">₹{totalUnpaid}</span>{" "}
              owed in unpaid approvals.
            </>
          }
          primaryAction={
            <>
              <Link
                href="/admin/volunteer-submissions"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
              >
                📥 Submissions →
              </Link>
              <Link
                href="/admin/home"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
              >
                ← Dashboard
              </Link>
            </>
          }
        />

        <KpiStrip
          items={[
            {
              label: "Total signups",
              value: volunteers.length.toLocaleString("en-IN"),
              accent: "cyan",
              icon: <IconVolunteer />,
            },
            {
              label: "Pending",
              value: pendingVolunteers.length.toLocaleString("en-IN"),
              accent: "violet",
              icon: <IconUserPlus />,
              delta:
                pendingVolunteers.length > 0
                  ? `${pendingVolunteers.length} waiting`
                  : "All processed",
            },
            {
              label: "Active",
              value: approvedCount.toLocaleString("en-IN"),
              accent: "leaf",
              icon: <IconCheck />,
            },
            {
              label: "Unpaid",
              value: `₹${totalUnpaid.toLocaleString("en-IN")}`,
              accent: totalUnpaid > 0 ? "violet" : "leaf",
              icon: <IconClock />,
              delta: totalUnpaid > 0 ? "Run a payout" : "All cleared",
            },
          ]}
        />

        {/* Pending applications */}
        {pendingVolunteers.length > 0 ? (
          <section className="mb-6 rounded-2xl border border-saffron-500/40 admin-kpi-breathe bg-saffron-500/[0.04] backdrop-blur-sm p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h2 className="font-fraunces text-lg text-cream-50">
                ⏳ Pending applications · {pendingVolunteers.length}
              </h2>
              <p className="text-xs text-cream-50/55">
                Approve to issue a code + WhatsApp it in one click.
              </p>
            </div>
            <ul className="grid gap-2">
              {pendingVolunteers.map((v) => (
                <PendingApplicationCard key={v.id} volunteer={v} />
              ))}
            </ul>
          </section>
        ) : null}

        {/* Weekly payout */}
        {totalUnpaid > 0 ? (
          <PayoutPanel
            rows={volunteers
              .filter((v) => (unpaidByVol.get(v.id) ?? 0) > 0 && v.code)
              .map((v) => ({
                code: v.code as string,
                name: v.name,
                upi: v.upi,
                amount: unpaidByVol.get(v.id) ?? 0,
              }))}
            total={totalUnpaid}
          />
        ) : null}

        {/* Active volunteers */}
        <h2 className="font-fraunces text-lg text-cream-50 mb-3 mt-2">
          Active registry
          <span className="ml-2 text-sm text-cream-50/45 font-mukta">
            · {activeVolunteers.length}
          </span>
        </h2>
        {activeVolunteers.length === 0 ? (
          <div className="rounded-2xl border border-cream-50/10 bg-cream-50/[0.03] p-12 text-center text-sm text-cream-50/55">
            {volunteers.length === 0
              ? "No volunteers signed up yet."
              : "No approved volunteers yet. Approve a PENDING application above to get started."}
          </div>
        ) : (
          <ul className="grid gap-3">
            {activeVolunteers.map((v, idx) => {
              const t = totalsByVol.get(v.id) ?? {
                submitted: 0,
                approved: 0,
                earned: 0,
              };
              const unpaid = unpaidByVol.get(v.id) ?? 0;
              const areas = parseAreas(v.areas);
              const lbl = volunteerStatusLabel(v.status);
              return (
                <li
                  key={v.id}
                  id={v.code ?? v.id}
                  style={{ ["--i" as string]: Math.min(idx, 6) }}
                  className="admin-row-in rounded-2xl border border-cream-50/10 bg-cream-50/[0.03] backdrop-blur-sm p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-fraunces text-lg text-cream-50">
                          {v.name}
                        </span>
                        {v.code ? (
                          <span className="text-xs font-mono text-cream-50/55 px-2 py-0.5 rounded-full bg-cream-50/[0.05] border border-cream-50/10">
                            {v.code}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-cream-50/65 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <a
                          href={`tel:+91${v.phone}`}
                          className="hover:text-saffron-500"
                        >
                          📞 {v.phone}
                        </a>
                        <span className="font-mono text-cream-50/55">
                          💳 {v.upi}
                        </span>
                        {areas.length > 0 ? (
                          <span className="text-cream-50/55 truncate max-w-[18rem]">
                            📍 {areas.join(", ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-xs shrink-0">
                      <div className="text-cream-50/85">
                        {lbl.emoji} {lbl.en}
                      </div>
                      <div className="text-cream-50/45 mt-0.5">
                        Joined{" "}
                        {new Date(v.createdAt).toLocaleDateString("en-IN", {
                          dateStyle: "medium",
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Stats strip */}
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <Stat label="Submitted" value={String(t.submitted)} />
                    <Stat label="Approved" value={String(t.approved)} />
                    <Stat label="Earned" value={`₹${t.earned}`} />
                    <Stat
                      label="Unpaid"
                      value={`₹${unpaid}`}
                      highlight={unpaid > 0}
                    />
                  </div>

                  {/* Status flip buttons */}
                  <form
                    action={setVolunteerStatusAction.bind(null, v.id)}
                    className="mt-3 flex flex-wrap gap-2 items-center"
                  >
                    <span className="text-xs text-cream-50/45 mr-1">
                      Set status:
                    </span>
                    {(["PROBATIONARY", "TRUSTED", "SUSPENDED"] as const).map((s) => {
                      const active = v.status === s;
                      return (
                        <button
                          key={s}
                          type="submit"
                          name="status"
                          value={s}
                          disabled={active}
                          className={[
                            "text-[11px] rounded-full px-3 py-1 border transition-colors font-mono",
                            active
                              ? "bg-gradient-to-r from-cyan-500 to-violet-500 border-transparent text-cream-50 cursor-default shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)]"
                              : "border-cyan-400/20 text-cream-50/75 hover:text-cream-50 hover:bg-cyan-400/[0.05]",
                          ].join(" ")}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

/* ───────── Pending application card ───────── */

function PendingApplicationCard({
  volunteer: v,
}: {
  volunteer: Awaited<ReturnType<typeof prisma.volunteer.findMany>>[number];
}) {
  const areas = parseAreas(v.areas);
  return (
    <li className="rounded-xl border border-saffron-500/30 bg-cream-50/[0.03] p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-fraunces text-cream-50">{v.name}</div>
          <div className="text-xs text-cream-50/65 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <a
              href={`tel:+91${v.phone}`}
              className="hover:text-saffron-500"
            >
              📞 {v.phone}
            </a>
            <span className="font-mono">💳 {v.upi}</span>
            {areas.length > 0 ? (
              <span className="truncate max-w-[16rem]">
                📍 {areas.join(", ")}
              </span>
            ) : null}
          </div>
          <div className="text-[10.5px] text-cream-50/45 mt-1">
            Applied{" "}
            {new Date(v.createdAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <ApproveVolunteerButton id={v.id} />
          <form action={rejectVolunteerSignupAction.bind(null, v.id)}>
            <SubmitButton
              variant="outline-alert"
              pendingLabel="Rejecting…"
              confirm="Reject this volunteer application?"
            >
              Reject
            </SubmitButton>
          </form>
        </div>
      </div>
    </li>
  );
}

/* ───────── Weekly payout panel ───────── */

function PayoutPanel({
  rows,
  total,
}: {
  rows: { code: string; name: string; upi: string; amount: number }[];
  total: number;
}) {
  const csv = [
    "name,upi,amount,note",
    ...rows.map(
      (r) =>
        `"${r.name.replace(/"/g, '""')}","${r.upi}",${r.amount},"BadaMangal ${r.code}"`,
    ),
  ].join("\n");

  return (
    <section className="mb-6 rounded-2xl border border-saffron-500/35 bg-saffron-500/[0.05] backdrop-blur-sm p-5">
      <header className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="font-fraunces text-lg text-cream-50">
            Weekly payout ·{" "}
            <span className="text-saffron-500">₹{total}</span>
          </h2>
          <p className="text-xs text-cream-50/55 mt-0.5">
            {rows.length} volunteer{rows.length === 1 ? "" : "s"} awaiting payment. Copy CSV → paste into your banking app or pay via UPI, then click "Mark all paid".
          </p>
        </div>
        <form action={markAllVolunteerSubmissionsPaidAction}>
          <SubmitButton
            variant="primary-green"
            pendingLabel="Marking…"
            confirm={`Mark all unpaid submissions as paid? (₹${total})`}
          >
            <IconCheck size={14} />
            <span>Mark all paid</span>
          </SubmitButton>
        </form>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-cream-50/45 border-b border-cream-50/10">
            <th className="py-2 font-semibold">Volunteer</th>
            <th className="py-2 font-semibold">UPI</th>
            <th className="py-2 font-semibold text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.code}
              className="border-b border-cream-50/[0.06] last:border-b-0"
            >
              <td className="py-2 text-cream-50/85">
                {r.name}{" "}
                <span className="text-[10px] text-cream-50/45 font-mono">
                  ({r.code})
                </span>
              </td>
              <td className="py-2 font-mono text-[11px] text-cream-50/65 break-all">
                {r.upi}
              </td>
              <td className="py-2 text-right font-medium text-saffron-500 font-numerals tabular-nums">
                ₹{r.amount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <details className="mt-3 group">
        <summary className="cursor-pointer list-none text-xs text-cream-50/65 hover:text-cream-50 inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block w-4 h-4 rounded-md bg-cream-50/[0.08] text-cream-50/75 text-center leading-4 group-open:rotate-90 transition-transform">
            ▸
          </span>
          Show CSV (copy → paste into banking app)
        </summary>
        <pre className="mt-2 p-3 rounded-lg bg-cream-50/[0.03] border border-cream-50/10 text-[11px] font-mono text-cream-50/85 whitespace-pre-wrap select-all overflow-x-auto">
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
    <div
      className={[
        "rounded-xl px-3 py-2 border",
        highlight
          ? "bg-saffron-500/[0.08] border-saffron-500/30"
          : "bg-cream-50/[0.03] border-cream-50/10",
      ].join(" ")}
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-cream-50/45 font-semibold">
        {label}
      </div>
      <div
        className={[
          "mt-0.5 font-numerals tabular-nums text-base font-semibold",
          highlight ? "text-saffron-500" : "text-cream-50/90",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
