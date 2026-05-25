import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import AdminPageHero from "@/components/admin/AdminPageHero";

export const metadata: Metadata = {
  title: "Donations · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Admin donation-intent audit table.
 *
 * Every "Sponsor this bhandara" tap that reaches /api/donations/intent
 * lands here, newest first. The page is honest about what each row
 * represents — it is the INTENT to pay, not proof of payment. UPI
 * organiser-direct flows don't expose merchant webhooks, so this
 * row says "a donor on this device, at this time, opened their UPI
 * app aimed at this organiser's VPA with this suggested amount." That's
 * enough to:
 *   • Resolve disputes ("I paid ₹501 to <organiser> on <date>")
 *   • Spot abuse (one ipHash firing 30 intents/min → 429 by route)
 *   • Cross-correlate with organiser-side reconciliation
 *
 * Real payment confirmation needs either:
 *   • Razorpay webhook (Phase 2) — flips status to PG_CONFIRMED with
 *     the bank reference in razorpayPaymentId
 *   • Donor self-confirmation via POST /api/donations/confirm
 *     (status DONOR_CONFIRMED)
 *   • Organiser-side confirmation — currently informal; could be
 *     added later as POST /api/donations/confirm with a magic-link
 *     gated by the bhandara's organiser-only token
 */
export default async function DonationsPage() {
  if (!(await isAdmin())) redirect("/admin");

  const navCounts = await getAdminNavCounts();

  // Most-recent 200 intents. Joined with the parent Bhandara so the
  // table can show the bhandara name + a tap-through to /admin/edit
  // without an extra round-trip.
  const intents = await prisma.donationIntent.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      bhandara: {
        select: { id: true, slug: true, name: true, area: true },
      },
    },
  });

  // Aggregate strip — "X taps · Y rupees attempted · Z confirmed".
  // Pure math over the loaded 200 so it always matches the rows the
  // operator can see in the table below; for an all-time aggregate
  // we'd need a separate count query, deliberately omitted for
  // simplicity.
  const totalCount = intents.length;
  const totalIntent = intents.reduce((sum, r) => sum + r.amount, 0);
  const confirmedCount = intents.filter((r) =>
    ["DONOR_CONFIRMED", "ORGANISER_CONFIRMED", "PG_CONFIRMED"].includes(
      r.status,
    ),
  ).length;
  const disputedCount = intents.filter((r) => r.status === "DISPUTED").length;

  return (
    <AdminShell navCounts={navCounts}>
      <AdminPageHero
        subject="dashboard"
        eyebrow="Donations"
        title="Sponsor-tap audit"
        subtitle="Every Sponsor click captured before the UPI deep-link opens. Intent-tracking, not payment proof — UPI direct-to-organiser flows have no server-side confirmation. See per-row status for evidence layers."
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="Taps (loaded)" value={totalCount.toLocaleString("en-IN")} tone="cyan" />
        <StatCard
          label="Intent total"
          value={`₹${totalIntent.toLocaleString("en-IN")}`}
          sub="suggested amounts only"
          tone="amber"
        />
        <StatCard
          label="Confirmed"
          value={confirmedCount.toLocaleString("en-IN")}
          sub="donor / organiser / PG"
          tone="green"
        />
        <StatCard
          label="Disputed"
          value={disputedCount.toLocaleString("en-IN")}
          tone="red"
        />
      </section>

      <section className="mt-6 rounded-xl border border-cyan-400/20 bg-[#0B0E16]/85 overflow-hidden">
        {intents.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-cream-50/55">
            No donation intents yet. The first row lands here the moment any
            visitor taps a Sponsor button on a bhandara detail page.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/70 font-mono">
                <tr className="border-b border-cyan-400/15 bg-cyan-400/[0.03]">
                  <th className="text-left px-3 py-2.5">When</th>
                  <th className="text-left px-3 py-2.5">Bhandara</th>
                  <th className="text-left px-3 py-2.5">Donor</th>
                  <th className="text-right px-3 py-2.5">Amount</th>
                  <th className="text-left px-3 py-2.5">Recipient UPI</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-left px-3 py-2.5">IP hash</th>
                </tr>
              </thead>
              <tbody>
                {intents.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-900/60 hover:bg-cyan-400/[0.04] transition-colors"
                  >
                    <td className="px-3 py-2.5 text-xs text-cream-50/75 tabular-nums font-mono whitespace-nowrap">
                      {formatTime(r.createdAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/edit/${r.bhandara.id}`}
                        prefetch={false}
                        className="text-cyan-200 hover:text-cyan-100 hover:underline"
                      >
                        {r.bhandara.name}
                      </Link>
                      <div className="text-xs text-cream-50/45">
                        {r.bhandara.area}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-cream-50/85">
                      {r.donorName ?? (
                        <span className="text-cream-50/40 italic">anon</span>
                      )}
                      {r.donorPhone ? (
                        <div className="text-xs text-cream-50/55 font-mono">
                          {r.donorPhone}
                        </div>
                      ) : null}
                      {r.donorMessage ? (
                        <div className="text-xs text-cream-50/55 italic mt-0.5">
                          “{r.donorMessage.slice(0, 60)}
                          {r.donorMessage.length > 60 ? "…" : ""}”
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-amber-300">
                      ₹{r.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2.5 text-cream-50/85 font-mono text-xs">
                      {r.recipientUpiId}
                      <div className="text-cream-50/45">
                        {r.recipientName ?? "-"} · {r.recipientType}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-3 py-2.5 text-cream-50/45 font-mono text-[10px]">
                      {r.ipHash?.slice(0, 10) ?? "-"}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-4 text-xs text-cream-50/45 max-w-3xl leading-relaxed">
        <strong className="text-cream-50/65">Status legend.</strong>{" "}
        <code className="font-mono">CLICKED</code> = donor opened the UPI app
        via our link; we have no way to know if the bank transfer completed.{" "}
        <code className="font-mono">DONOR_CONFIRMED</code> = donor returned
        and self-reported &quot;I paid&quot;.{" "}
        <code className="font-mono">ORGANISER_CONFIRMED</code> = organiser
        separately confirmed receipt (manual today).{" "}
        <code className="font-mono">PG_CONFIRMED</code> = Razorpay webhook fired
        with a bank reference (Phase 2, requires payment-gateway onboarding).{" "}
        <code className="font-mono">DISPUTED</code> = donor reported the deep
        link didn&apos;t open or the transfer failed.
      </p>
    </AdminShell>
  );
}

/* ────────────────────── helpers ────────────────────── */

function formatTime(d: Date): string {
  // "26 May, 02:14 PM" — operator-readable, Indian convention.
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "cyan" | "amber" | "green" | "red";
}) {
  const color =
    tone === "cyan"
      ? "text-cyan-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "green"
          ? "text-emerald-300"
          : "text-rose-300";
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>
        {value}
      </div>
      {sub ? (
        <div className="mt-1 text-xs text-zinc-500">{sub}</div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "DONOR_CONFIRMED" || status === "ORGANISER_CONFIRMED" || status === "PG_CONFIRMED"
      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
      : status === "DISPUTED"
        ? "bg-rose-500/15 text-rose-200 border-rose-500/30"
        : "bg-cyan-500/15 text-cyan-200 border-cyan-500/30";
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-mono uppercase tracking-[0.08em]",
        tone,
      ].join(" ")}
    >
      {status}
    </span>
  );
}
