import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import ModerationQueue, {
  type QueueTab,
} from "@/components/admin/ModerationQueue";
import KpiStrip from "@/components/admin/KpiStrip";
import AdminPageHero from "@/components/admin/AdminPageHero";
import {
  IconOrganise,
  IconPending,
  IconCheck,
  IconClock,
} from "@/components/admin/AdminIcons";
import OrganiseRow, {
  type OrganiseQueueRow,
} from "@/components/admin/OrganiseRow";

/**
 * Organise-bhandara leads queue — dark-themed rewrite.
 *
 * Workflow: NEW → CONTACTED → CONFIRMED → COMPLETED (+ REJECTED).
 * Active states (NEW, CONTACTED) sort to the top so the team's
 * to-do list lands first on every page load.
 */

export const metadata: Metadata = {
  title: "Organise · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string }>;

const TAB_KEYS = ["ACTIVE", "NEW", "CONTACTED", "CONFIRMED", "COMPLETED", "REJECTED", "ALL"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function statusOrder(s: string): number {
  switch (s) {
    case "NEW":
      return 0;
    case "CONTACTED":
      return 1;
    case "CONFIRMED":
      return 2;
    case "COMPLETED":
      return 3;
    case "REJECTED":
      return 4;
    default:
      return 5;
  }
}

export default async function AdminOrganisePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await isAdmin())) redirect("/admin");

  const sp = await searchParams;
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(
    (sp.status ?? "ACTIVE").toUpperCase(),
  )
    ? ((sp.status ?? "ACTIVE").toUpperCase() as TabKey)
    : "ACTIVE";

  const rows = await prisma.organiseRequest.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Filter to the active tab.
  const filtered = rows.filter((r) => {
    switch (tab) {
      case "ALL":
        return true;
      case "ACTIVE":
        return r.status === "NEW" || r.status === "CONTACTED";
      default:
        return r.status === tab;
    }
  });

  // Sort active first, then most-recent-first within each bucket.
  const sorted = [...filtered].sort((a, b) => {
    const sd = statusOrder(a.status) - statusOrder(b.status);
    if (sd !== 0) return sd;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const counts = {
    ACTIVE: rows.filter((r) => r.status === "NEW" || r.status === "CONTACTED").length,
    NEW: rows.filter((r) => r.status === "NEW").length,
    CONTACTED: rows.filter((r) => r.status === "CONTACTED").length,
    CONFIRMED: rows.filter((r) => r.status === "CONFIRMED").length,
    COMPLETED: rows.filter((r) => r.status === "COMPLETED").length,
    REJECTED: rows.filter((r) => r.status === "REJECTED").length,
    ALL: rows.length,
  };

  const tabs: QueueTab[] = [
    { key: "ACTIVE", label: "Active", count: counts.ACTIVE },
    { key: "NEW", label: "New", count: counts.NEW },
    { key: "CONTACTED", label: "Contacted", count: counts.CONTACTED },
    { key: "CONFIRMED", label: "Confirmed", count: counts.CONFIRMED },
    { key: "COMPLETED", label: "Completed", count: counts.COMPLETED },
    { key: "REJECTED", label: "Rejected", count: counts.REJECTED },
    { key: "ALL", label: "All", count: counts.ALL },
  ];

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        <AdminPageHero
          subject="organise"
          eyebrow="Workflow"
          title="Organise-bhandara leads"
          subtitle={
            <>
              Move each through NEW → CONTACTED → CONFIRMED → COMPLETED. New
              requests come from the public form at{" "}
              <Link
                href="/organise-bhandara"
                className="text-cyan-300 hover:text-cyan-200"
              >
                /organise-bhandara
              </Link>
              .
            </>
          }
          primaryAction={
            <Link
              href="/admin/home"
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
            >
              ← Dashboard
            </Link>
          }
        />
        <KpiStrip
          items={[
            {
              label: "Active",
              value: counts.ACTIVE.toLocaleString("en-IN"),
              accent: "violet",
              icon: <IconPending />,
              href: "?status=ACTIVE",
              delta: "NEW + CONTACTED",
            },
            {
              label: "Confirmed",
              value: counts.CONFIRMED.toLocaleString("en-IN"),
              accent: "cyan",
              icon: <IconClock />,
              href: "?status=CONFIRMED",
            },
            {
              label: "Completed",
              value: counts.COMPLETED.toLocaleString("en-IN"),
              accent: "leaf",
              icon: <IconCheck />,
              href: "?status=COMPLETED",
            },
            {
              label: "All time",
              value: counts.ALL.toLocaleString("en-IN"),
              accent: "cyan",
              icon: <IconOrganise />,
              href: "?status=ALL",
            },
          ]}
        />
      </div>
      <ModerationQueue
        tabs={tabs}
        activeTab={tab}
        showSearch={false}
        shownCount={sorted.length}
        totalInTab={
          (tab === "ALL" && counts.ALL) ||
          (tab === "ACTIVE" && counts.ACTIVE) ||
          counts[tab as keyof typeof counts]
        }
      >
        {sorted.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="space-y-3">
            {sorted.map((row, idx) => (
              <OrganiseRow
                key={row.id}
                row={row as OrganiseQueueRow}
                index={idx}
              />
            ))}
          </div>
        )}
      </ModerationQueue>
    </AdminShell>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const messages: Record<TabKey, string> = {
    ACTIVE: "Nothing active right now. New leads will land here as soon as the form gets a submission.",
    NEW: "No new leads.",
    CONTACTED: "No contacted leads.",
    CONFIRMED: "No confirmed leads.",
    COMPLETED: "No completed leads yet.",
    REJECTED: "No rejected leads.",
    ALL: "No leads in the database yet.",
  };
  return (
    <div className="rounded-2xl border border-cream-50/10 bg-cream-50/[0.03] p-12 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cream-50/[0.05] mb-4 text-3xl">
        📋
      </div>
      <div className="font-fraunces text-cream-50 text-lg">{messages[tab]}</div>
    </div>
  );
}
