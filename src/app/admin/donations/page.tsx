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
 * Admin donation audit, split into tabs:
 *   • platform  - "Donations to BadaMangal" (support-the-platform taps,
 *                 recipientType=platform, no bhandara)
 *   • bhandara  - "Donations to Bhandaras" (organiser sponsorship taps)
 *   • qr        - "Bhandara QR codes": every listed bhandara that
 *                 uploaded a UPI QR / VPA during listing, so the operator
 *                 can see which listings can receive donations.
 *
 * Honest about what a donation row is: the INTENT to pay, not proof of
 * payment. UPI is device-to-device, so the actual money only shows in the
 * recipient's bank / PhonePe; QR scans aren't captured here at all.
 */
type Tab = "platform" | "bhandara" | "qr";
const TAB_ORDER: Tab[] = ["platform", "bhandara", "qr"];
const TAB_META: Record<Tab, string> = {
  platform: "To BadaMangal",
  bhandara: "To Bhandaras",
  qr: "Bhandara QR codes",
};

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");

  const sp = await searchParams;
  const tab: Tab = TAB_ORDER.includes(sp.tab as Tab)
    ? (sp.tab as Tab)
    : "platform";

  const navCounts = await getAdminNavCounts();

  // Counts for all three tab badges (cheap count queries).
  const [platformCount, bhandaraCount, qrCount] = await Promise.all([
    prisma.donationIntent.count({ where: { recipientType: "platform" } }),
    prisma.donationIntent.count({ where: { recipientType: { not: "platform" } } }),
    prisma.bhandara.count({
      where: { OR: [{ upiId: { not: null } }, { upiQrUrl: { not: null } }] },
    }),
  ]);
  const counts: Record<Tab, number> = {
    platform: platformCount,
    bhandara: bhandaraCount,
    qr: qrCount,
  };

  // Active-tab data only.
  const platformRows =
    tab === "platform"
      ? await prisma.donationIntent.findMany({
          where: { recipientType: "platform" },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];
  const bhandaraRows =
    tab === "bhandara"
      ? await prisma.donationIntent.findMany({
          where: { recipientType: { not: "platform" } },
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            bhandara: { select: { id: true, name: true, area: true } },
          },
        })
      : [];
  const qrRows =
    tab === "qr"
      ? await prisma.bhandara.findMany({
          where: { OR: [{ upiId: { not: null } }, { upiQrUrl: { not: null } }] },
          orderBy: { createdAt: "desc" },
          take: 300,
          select: {
            id: true,
            name: true,
            area: true,
            status: true,
            upiId: true,
            upiQrUrl: true,
            organizerName: true,
            organizerPhone: true,
            createdAt: true,
          },
        })
      : [];

  return (
    <AdminShell navCounts={navCounts}>
      <AdminPageHero
        subject="dashboard"
        eyebrow="Donations"
        title="Donation audit"
        subtitle="Donate taps captured before the UPI app opens, plus the listed bhandaras that uploaded a donation QR. Intent-tracking, not payment proof: UPI is device-to-device, so actual money only shows in the recipient's bank / PhonePe, and QR scans aren't captured here."
      />

      {/* Tabs */}
      <nav
        role="tablist"
        aria-label="Donation sections"
        className="mt-6 mb-5 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-1 font-mono"
      >
        {TAB_ORDER.map((tt) => {
          const active = tab === tt;
          return (
            <Link
              key={tt}
              href={`/admin/donations?tab=${tt}`}
              role="tab"
              aria-selected={active}
              prefetch={false}
              scroll={false}
              className={[
                "relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition-colors",
                active
                  ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-cream-50 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)]"
                  : "text-cream-50/65 hover:text-cream-50 hover:bg-cyan-400/[0.06]",
              ].join(" ")}
            >
              <span>{TAB_META[tt]}</span>
              {counts[tt] > 0 ? (
                <span
                  className={[
                    "rounded-full tabular-nums px-1.5 min-w-[1.25rem] text-center text-[10px] leading-[1.1rem]",
                    active
                      ? "bg-cream-50/25 text-cream-50"
                      : "bg-cream-50/[0.08] text-cream-50/70",
                  ].join(" ")}
                >
                  {counts[tt]}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <section className="rounded-xl border border-cyan-400/20 bg-[#0B0E16]/85 overflow-hidden">
        {/* ── To BadaMangal ── */}
        {tab === "platform" ? (
          platformRows.length === 0 ? (
            <Empty>
              No platform donations yet. A row lands here the moment someone
              taps Donate (or Copy UPI) in the &quot;Help keep BadaMangal
              running&quot; section.
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <Head cols={["When", "Donor", "Recipient UPI", "Status", "IP hash"]} />
                <tbody>
                  {platformRows.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-900/60 hover:bg-cyan-400/[0.04]">
                      <Td mono>{formatTime(r.createdAt)}</Td>
                      <Td>
                        {r.donorName ?? <Anon />}
                        {r.donorMessage ? (
                          <div className="text-xs text-cream-50/55 italic mt-0.5">
                            “{r.donorMessage.slice(0, 60)}
                            {r.donorMessage.length > 60 ? "…" : ""}”
                          </div>
                        ) : null}
                      </Td>
                      <Td mono className="text-cream-50/85">{r.recipientUpiId}</Td>
                      <Td><StatusPill status={r.status} /></Td>
                      <Td className="text-cream-50/45 font-mono text-[10px]">
                        {r.ipHash?.slice(0, 10) ?? "-"}…
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {/* ── To Bhandaras ── */}
        {tab === "bhandara" ? (
          bhandaraRows.length === 0 ? (
            <Empty>
              No bhandara sponsorships yet. A row lands here when a visitor taps
              Sponsor on a bhandara detail page.
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <Head cols={["When", "Bhandara", "Donor", "Amount", "Recipient UPI", "Status", "IP hash"]} />
                <tbody>
                  {bhandaraRows.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-900/60 hover:bg-cyan-400/[0.04]">
                      <Td mono>{formatTime(r.createdAt)}</Td>
                      <Td>
                        {r.bhandara ? (
                          <>
                            <Link
                              href={`/admin/edit/${r.bhandara.id}`}
                              prefetch={false}
                              className="text-cyan-200 hover:text-cyan-100 hover:underline"
                            >
                              {r.bhandara.name}
                            </Link>
                            <div className="text-xs text-cream-50/45">{r.bhandara.area}</div>
                          </>
                        ) : (
                          <span className="text-cream-50/40 italic">deleted</span>
                        )}
                      </Td>
                      <Td className="text-cream-50/85">
                        {r.donorName ?? <Anon />}
                        {r.donorPhone ? (
                          <div className="text-xs text-cream-50/55 font-mono">{r.donorPhone}</div>
                        ) : null}
                      </Td>
                      <Td className="text-right tabular-nums font-medium text-amber-300">
                        ₹{r.amount.toLocaleString("en-IN")}
                      </Td>
                      <Td mono className="text-cream-50/85 text-xs">
                        {r.recipientUpiId}
                        <div className="text-cream-50/45">
                          {r.recipientName ?? "-"} · {r.recipientType}
                        </div>
                      </Td>
                      <Td><StatusPill status={r.status} /></Td>
                      <Td className="text-cream-50/45 font-mono text-[10px]">
                        {r.ipHash?.slice(0, 10) ?? "-"}…
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {/* ── Bhandara QR codes ── */}
        {tab === "qr" ? (
          qrRows.length === 0 ? (
            <Empty>
              No bhandaras have uploaded a donation UPI / QR yet. Organisers add
              these on the listing form (UPI ID + optional QR image).
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <Head cols={["Bhandara", "QR", "UPI ID", "Organiser", "Status", "Listed"]} />
                <tbody>
                  {qrRows.map((b) => (
                    <tr key={b.id} className="border-b border-zinc-900/60 hover:bg-cyan-400/[0.04]">
                      <Td>
                        <Link
                          href={`/admin/edit/${b.id}`}
                          prefetch={false}
                          className="text-cyan-200 hover:text-cyan-100 hover:underline"
                        >
                          {b.name}
                        </Link>
                        <div className="text-xs text-cream-50/45">{b.area || "-"}</div>
                      </Td>
                      <Td>
                        {b.upiQrUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a href={b.upiQrUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={b.upiQrUrl}
                              alt={`UPI QR for ${b.name}`}
                              width="44"
                              height="44"
                              className="rounded border border-cyan-400/20 bg-white object-contain"
                            />
                          </a>
                        ) : (
                          <span className="text-[10px] text-cream-50/45 font-mono">
                            auto (from UPI ID)
                          </span>
                        )}
                      </Td>
                      <Td mono className="text-cream-50/85 text-xs">
                        {b.upiId ?? <span className="text-cream-50/40">-</span>}
                      </Td>
                      <Td className="text-cream-50/85">
                        {b.organizerName}
                        {b.organizerPhone ? (
                          <div className="text-xs text-cream-50/55 font-mono">{b.organizerPhone}</div>
                        ) : null}
                      </Td>
                      <Td>
                        <StatusPill status={b.status} />
                      </Td>
                      <Td mono className="text-cream-50/55 text-xs whitespace-nowrap">
                        {formatTime(b.createdAt)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </section>

      {tab !== "qr" ? (
        <p className="mt-4 text-xs text-cream-50/45 max-w-3xl leading-relaxed">
          <strong className="text-cream-50/65">Status legend.</strong>{" "}
          <code className="font-mono">CLICKED</code> = donor opened the UPI app
          via our link; we have no way to know if the bank transfer completed.{" "}
          <code className="font-mono">DONOR_CONFIRMED</code> = donor returned and
          self-reported &quot;I paid&quot;.{" "}
          <code className="font-mono">ORGANISER_CONFIRMED</code> = organiser
          separately confirmed receipt.{" "}
          <code className="font-mono">PG_CONFIRMED</code> = payment-gateway
          webhook (Phase 2).{" "}
          <code className="font-mono">DISPUTED</code> = donor reported a failure.
        </p>
      ) : null}
    </AdminShell>
  );
}

/* ────────────────────── helpers ────────────────────── */

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-cream-50/55">
      {children}
    </div>
  );
}

function Head({ cols }: { cols: string[] }) {
  return (
    <thead className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/70 font-mono">
      <tr className="border-b border-cyan-400/15 bg-cyan-400/[0.03]">
        {cols.map((c) => (
          <th key={c} className="text-left px-3 py-2.5">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Td({
  children,
  mono = false,
  className = "",
}: {
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={[
        "px-3 py-2.5 align-top",
        mono ? "font-mono text-xs text-cream-50/75 tabular-nums whitespace-nowrap" : "text-cream-50/85",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

function Anon() {
  return <span className="text-cream-50/40 italic">anon</span>;
}

function formatTime(d: Date): string {
  // "26 May, 02:14 PM", operator-readable, Indian convention. Pinned to
  // Asia/Kolkata so it always shows IST: this renders on the server
  // (Vercel runs in UTC), so without an explicit timeZone the times came
  // out in UTC, ~5h30m behind IST.
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "DONOR_CONFIRMED" ||
    status === "ORGANISER_CONFIRMED" ||
    status === "PG_CONFIRMED" ||
    status === "APPROVED"
      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
      : status === "DISPUTED" || status === "REJECTED"
        ? "bg-rose-500/15 text-rose-200 border-rose-500/30"
        : status === "PENDING"
          ? "bg-amber-500/15 text-amber-200 border-amber-500/30"
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
