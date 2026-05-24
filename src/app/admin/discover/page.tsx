import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import AdminPageHero from "@/components/admin/AdminPageHero";
import DiscoverClient from "./DiscoverClient";

/**
 * Admin "discover bhandaras on the web" page.
 *
 * Server-side auth wrapper around the client-side discovery UI.
 * The heavy lifting (form state, fetch loop, results, per-card
 * Add action) lives in DiscoverClient so the URL doesn't have to
 * round-trip on every state change.
 */

export const metadata: Metadata = {
  title: "Discover · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DiscoverBhandarasPage() {
  if (!(await isAdmin())) redirect("/admin");

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        <AdminPageHero
          subject="discover"
          eyebrow="Discovery"
          title="Find bhandaras on the web"
          subtitle={
            <>
              <span className="text-cyan-300">$</span> Gemini searches the open
              web for Bada Mangal bhandaras this season. Candidates surface
              below; click{" "}
              <span className="text-cyan-300 font-medium">Add as PENDING</span>{" "}
              to push one into the moderation queue.
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

        <DiscoverClient />
      </div>
    </AdminShell>
  );
}
