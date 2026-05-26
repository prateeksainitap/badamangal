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

/**
 * /admin/new, manual-create flow.
 *
 * Reuses ScanReview's review-phase form but with `initialBlank` set,
 * which:
 *   • Skips the upload + Gemini-scan UI entirely
 *   • Opens straight on the editable review form with every field empty
 *   • Lets the operator pick bhandara vs spot via the toggle at the top
 *
 * POSTs to /api/admin/publish, exact same endpoint the Gemini-scan
 * flow uses, so the server-side validation, slug-uniqueness retry,
 * APPROVED-at-creation behavior, etc. all apply unchanged.
 *
 * When to use this vs /admin/scan:
 *   • /admin/scan      → you have a WhatsApp poster image to extract
 *                        from. Gemini reads it, you review & publish.
 *   • /admin/new       → an organizer phoned in the details, you found
 *                        a bhandara from a news article (or via the
 *                        Discover tool's "Add as PENDING"), or you're
 *                        creating a one-off spot pin. Type everything.
 */

export const metadata: Metadata = {
  title: "Add manually · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ kind?: string }>;

export default async function AdminNewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await isAdmin())) redirect("/admin");
  const sp = await searchParams;
  const requested = (sp.kind ?? "").toLowerCase();
  // Default to bhandara when ?kind is missing or invalid. The kind
  // toggle inside ScanReview lets the operator flip between the two
  // without leaving the page.
  const initialKind: "bhandara" | "spot" =
    requested === "spot" ? "spot" : "bhandara";

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        <AdminPageHero
          // Reuses the "scan" illustration, same family of work
          // (creating a listing), no new SVG required.
          subject="scan"
          eyebrow="Add manually"
          title={
            initialKind === "bhandara"
              ? "Type a new bhandara"
              : "Type a new spot"
          }
          titleAccent="and publish"
          subtitle={
            <>
              <span className="text-cyan-300">$</span> No poster to scan? Drop
              in the details an organizer gave you, a spot you saw on the
              field, or anything you need to seed by hand. Same publish
              flow as scan, just typed instead of extracted.
            </>
          }
          primaryAction={
            <>
              <Link
                href="/admin/scan"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
              >
                Scan a poster instead →
              </Link>
              <Link
                href={initialKind === "bhandara" ? "/admin/bhandaras" : "/admin/spots"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
              >
                ← Back to queue
              </Link>
            </>
          }
        />

        <div className="rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm text-cream-50 p-5 sm:p-7 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.7)] admin-card-glow">
          <ScanReview
            areas={[...AREAS]}
            menuItems={[...MENU_ITEMS]}
            tuesdays={[...ALL_TUESDAY_ISO]}
            saturdays={[...ALL_SATURDAY_ISO]}
            initialBlank={initialKind}
          />
        </div>
      </div>
    </AdminShell>
  );
}
