import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import AdminPageHero from "@/components/admin/AdminPageHero";
import PushComposer from "./PushComposer";

export const metadata: Metadata = {
  title: "Push · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PushPage() {
  if (!(await isAdmin())) redirect("/admin");

  const navCounts = await getAdminNavCounts();
  const [deviceCount, byPlatform] = await Promise.all([
    prisma.pushToken.count(),
    prisma.pushToken.groupBy({ by: ["platform"], _count: { _all: true } }),
  ]);
  const android =
    byPlatform.find((r) => r.platform === "android")?._count._all ?? 0;
  const ios = byPlatform.find((r) => r.platform === "ios")?._count._all ?? 0;

  return (
    <AdminShell navCounts={navCounts}>
      <AdminPageHero
        subject="dashboard"
        eyebrow="Notifications"
        title="Push broadcast"
        subtitle="Send a notification to every device that opted in via the app. Built for the after-Bada-Mangal moment: a thank-you, or a 'next Bada Mangal is on <date>' reminder. Delivered through Expo's push service."
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Registered devices" value={deviceCount} tone="cyan" />
        <Stat label="Android" value={android} tone="green" />
        <Stat label="iOS" value={ios} tone="amber" />
      </section>

      <PushComposer deviceCount={deviceCount} />

      <p className="mt-4 text-xs text-cream-50/45 max-w-3xl leading-relaxed">
        Devices register when a user enables notifications in the app. A
        broadcast goes to all of them at once. Android delivery needs the
        project&apos;s FCM credentials configured in EAS; iOS needs APNs.
      </p>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cyan" | "green" | "amber";
}) {
  const color =
    tone === "cyan"
      ? "text-cyan-300"
      : tone === "green"
        ? "text-emerald-300"
        : "text-amber-300";
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>
        {value.toLocaleString("en-IN")}
      </div>
    </div>
  );
}
