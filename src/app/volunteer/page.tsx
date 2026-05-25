/**
 * /volunteer, public marketing + recruitment page for the volunteer
 * programme.
 *
 * Thin server shell. Owns the `metadata` export (SEO snippet + OG
 * card) and delegates every visible body element to
 * `VolunteerLandingView`, a client component that reads the
 * LangToggle locale from React context and renders the page in ONE
 * language end-to-end.
 *
 * Rewrite 2026-05-26:
 *   • Earlier the page interleaved Hindi + English in every section.
 *     With the global LangToggle, the bilingual duplication was
 *     visual noise; both readers had to scan past the language they
 *     didn't read. Single-language render now.
 *   • Signup form moved IN-PAGE (used to be a 2-click hop via
 *     /volunteer/signup). The form sits sticky on the right column
 *     on desktop, scroll-into-view on mobile.
 *   • Sections compressed from 6 → 2 (hero+form+steps as one block,
 *     then FAQ). "How your seva flows" steps live right under the
 *     hero stats so visitors see the flow without scrolling past
 *     the FAQ.
 *
 * /volunteer/signup still exists as a thin standalone host for the
 * same form, so any WhatsApp / external link pointing at it keeps
 * working without a redirect.
 *
 * PURE SEVA: this page is the volunteer surface for the 2026 Adhik
 * Mas season. No money, no payout, no honorarium copy anywhere. The
 * DB still tracks payoutAmount + the admin payout-CSV export is
 * intact for when we bring paid mode back; keep the public copy
 * free of ₹ symbols.
 */
import type { Metadata } from "next";
import VolunteerLandingView from "@/components/VolunteerLandingView";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Volunteer with BadaMangal · Lucknow",
  description:
    "Help us list every Bada Mangal bhandara in Lucknow. Delivery riders, cab drivers, students, anyone with a phone. Pure seva, no fee. 30-second signup.",
  alternates: { canonical: `${SITE_URL}/volunteer` },
  openGraph: {
    title: "Volunteer with BadaMangal",
    description:
      "Document a bhandara during the Bada Mangal season. Pure seva, help fellow devotees find every bhandara in Lucknow. 30-second signup.",
    url: `${SITE_URL}/volunteer`,
    type: "website",
  },
};

export default function VolunteerLandingPage() {
  return <VolunteerLandingView />;
}
