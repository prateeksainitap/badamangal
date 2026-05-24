import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { markAllVolunteerSubmissionsPaidAction } from "@/app/admin/actions";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import ModerationQueue, {
  type QueueTab,
} from "@/components/admin/ModerationQueue";
import VolunteerSubmissionRow, {
  type SubmissionRow,
} from "@/components/admin/VolunteerSubmissionRow";
import SubmitButton from "@/components/admin/SubmitButton";
import { IconCheck } from "@/components/admin/AdminIcons";

export const metadata: Metadata = {
  title: "Volunteer submissions · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

const STATUS_KEYS = [
  "NEW",
  "APPROVED",
  "PARTIAL",
  "DUPLICATE",
  "REJECTED",
  "ALL",
] as const;
type StatusKey = (typeof STATUS_KEYS)[number];

export default async function AdminVolunteerSubmissionsPage({
  searchParams,
}: PageProps) {
  if (!(await isAdmin())) redirect("/admin");
  const sp = await searchParams;
  const tab = (sp.status ?? "NEW").toUpperCase();
  if (!(STATUS_KEYS as readonly string[]).includes(tab)) notFound();
  const activeTab = tab as StatusKey;

  const where = activeTab === "ALL" ? {} : { status: activeTab };

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
      where: { status: { in: ["APPROVED", "PARTIAL"] }, paidAt: null },
      _sum: { payoutAmount: true },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all]),
  ) as Record<string, number>;
  const totalAll = Object.values(countByStatus).reduce((a, b) => a + b, 0);
  const totalUnpaid = unpaidTotal._sum.payoutAmount ?? 0;

  const tabs: QueueTab[] = [
    { key: "NEW", label: "New", count: countByStatus.NEW ?? 0 },
    { key: "APPROVED", label: "Approved", count: countByStatus.APPROVED ?? 0 },
    { key: "PARTIAL", label: "Partial", count: countByStatus.PARTIAL ?? 0 },
    { key: "DUPLICATE", label: "Duplicate", count: countByStatus.DUPLICATE ?? 0 },
    { key: "REJECTED", label: "Rejected", count: countByStatus.REJECTED ?? 0 },
    { key: "ALL", label: "All", count: totalAll },
  ];

  const totalInTab =
    activeTab === "ALL"
      ? totalAll
      : (countByStatus[activeTab] ?? 0);

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <ModerationQueue
        eyebrow="Volunteers · Submissions"
        title="Volunteer submissions"
        subtitle="Review what volunteers submitted, approve to create a Bhandara + Spot and unlock the ₹50 payout."
        primaryAction={
          <>
            <Link
              href="/admin/volunteers"
              prefetch={false}
              className="inline-flex items-center gap-1.5 rounded-full border border-cream-50/15 hover:border-cream-50/30 hover:bg-cream-50/[0.05] px-3.5 py-2 text-sm text-cream-50/75 hover:text-cream-50 transition-colors"
            >
              Volunteers registry
            </Link>
            <Link
              href="/admin/home"
              prefetch={false}
              className="inline-flex items-center gap-1.5 rounded-full border border-cream-50/15 hover:border-cream-50/30 hover:bg-cream-50/[0.05] px-3.5 py-2 text-sm text-cream-50/75 hover:text-cream-50 transition-colors"
            >
              ← Dashboard
            </Link>
          </>
        }
        tabs={tabs}
        activeTab={activeTab}
        showSearch={false}
        shownCount={rows.length}
        totalInTab={totalInTab}
      >
        {/* Payout summary banner */}
        {totalUnpaid > 0 ? (
          <div className="mb-4 rounded-2xl border border-saffron-500/40 bg-saffron-500/[0.06] backdrop-blur-sm p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm text-cream-50">
                <span className="font-fraunces font-semibold text-saffron-500">
                  ₹{totalUnpaid}
                </span>{" "}
                owed to volunteers across approved + partial submissions.
              </p>
              <p className="text-xs text-cream-50/55 mt-0.5">
                After bulk-paying via UPI, click below to mark all as paid.
              </p>
            </div>
            <form action={markAllVolunteerSubmissionsPaidAction}>
              <SubmitButton
                variant="primary-green"
                pendingLabel="Marking…"
                confirm={`Mark all unpaid submissions as paid? (₹${totalUnpaid})`}
              >
                <IconCheck size={14} />
                <span>Mark all paid</span>
              </SubmitButton>
            </form>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div className="space-y-3">
            {rows.map((r, idx) => (
              <VolunteerSubmissionRow
                key={r.id}
                sub={r as SubmissionRow}
                index={idx}
              />
            ))}
          </div>
        )}
      </ModerationQueue>
    </AdminShell>
  );
}

function EmptyState({ tab }: { tab: StatusKey }) {
  const messages: Record<StatusKey, string> = {
    NEW: "No new submissions waiting for review.",
    APPROVED: "No approved submissions yet.",
    PARTIAL: "No partial-approval submissions.",
    DUPLICATE: "No duplicates flagged.",
    REJECTED: "No rejected submissions.",
    ALL: "No submissions in the database yet.",
  };
  return (
    <div className="rounded-2xl border border-cream-50/10 bg-cream-50/[0.03] p-12 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cream-50/[0.05] mb-4 text-3xl">
        📥
      </div>
      <div className="font-fraunces text-cream-50 text-lg">{messages[tab]}</div>
    </div>
  );
}
