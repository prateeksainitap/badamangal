import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ScanReview from "@/components/admin/ScanReview";
import { isAdmin } from "@/lib/admin-auth";
import { AREAS } from "@/lib/lucknow";
import { MENU_ITEMS } from "@/lib/menu";
import { ALL_TUESDAY_ISO, ALL_SATURDAY_ISO } from "@/lib/dates";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import AdminPageHero from "@/components/admin/AdminPageHero";

export const metadata: Metadata = {
  title: "Scan & publish · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminScanPage() {
  if (!(await isAdmin())) {
    redirect("/admin");
  }

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        <AdminPageHero
          subject="scan"
          eyebrow="Scan"
          title="Upload an invite,"
          titleAccent="publish in seconds"
          subtitle={
            <>
              <span className="text-cyan-300">$</span> Drop a WhatsApp invite
              image. Gemini reads the details, Ola Maps drops the pin, you
              review &amp; publish.
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

        {/* ScanReview client component lives inside a dark ops-console
            panel. Its inner form chrome has been re-skinned in
            ScanReview.tsx, see that file for the cyan/violet pass. */}
        <div className="rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm text-cream-50 p-5 sm:p-7 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.7)] admin-card-glow">
          <ScanReview
            areas={[...AREAS]}
            menuItems={[...MENU_ITEMS]}
            tuesdays={[...ALL_TUESDAY_ISO]}
            saturdays={[...ALL_SATURDAY_ISO]}
          />
        </div>
      </div>
    </AdminShell>
  );
}
