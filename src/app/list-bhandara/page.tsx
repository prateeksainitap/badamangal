import type { Metadata } from "next";
import AddBhandaraSwitcher from "@/components/AddBhandaraSwitcher";
import { getAllApprovedBhandaras } from "@/lib/db";
import { localised } from "@/lib/seo";

// ISR. The page is heavy enough at first paint (multi-step form, GPS
// permissions, locale-aware copy) that the TTFB matters for the
// click-to-form latency people perceive when they tap "Add Bhandara".
// Two changes from the earlier 60s revalidate window:
//   1. Bumped to 300s. The list of approved bhandaras only changes
//      when an admin approves a new listing, and a few minutes of
//      staleness on the spotter dropdown is invisible.
//   2. Swapped the standalone findMany for the shared
//      `getAllApprovedBhandaras()` cache from lib/db, which is also
//      used by the homepage, every /bhandara/[slug] page, every
//      /area/[slug] page, and generateStaticParams. One module-scoped
//      Promise serves them all, so a warm-cache hit returns this
//      page in ~200ms instead of the 1.7–3.3s cold path through the
//      Supabase pooler we were seeing in production.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "List your Bada Mangal bhandara, free listing for Lucknow organisers",
  description:
    "Free public listing for Bada Mangal bhandara organisers in Lucknow. Add your venue, schedule, menu, and capacity to the city map. Reaches every devotee searching for bhandaras during the 2026 season.",
  alternates: localised("/list-bhandara"),
  openGraph: {
    title: "List your Bada Mangal bhandara · BadaMangal Lucknow",
    description:
      "Add your bhandara to the city map. Free, takes a few minutes, reaches every devotee in Lucknow.",
    type: "website",
    locale: "hi_IN",
    alternateLocale: "en_IN",
  },
};

export default async function ListBhandaraPage() {
  // No server-side locale, AddBhandaraSwitcher resolves it from the
  // LocaleProvider context so the Hindi toggle flips every label in
  // the multi-step form synchronously.

  // Approved listings, surfaced as the "Pick from list" option in the
  // spotter flow so they don't have to drop a pin from scratch.
  // Pulled from the shared cache (see comment on `revalidate`) and
  // sorted area-then-name here so the dropdown ordering matches what
  // the earlier standalone findMany returned. Slicing to 200 matches
  // the previous behavior and bounds the payload sent to the client.
  const allApproved = await getAllApprovedBhandaras();
  const listings = [...allApproved]
    .sort((a, b) => {
      const areaCmp = a.area.localeCompare(b.area);
      return areaCmp !== 0 ? areaCmp : a.name.localeCompare(b.name);
    })
    .slice(0, 200);

  return (
    <AddBhandaraSwitcher
      bhandaras={listings.map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        nameHi: b.nameHi ?? null,
        area: b.area,
        lat: b.lat,
        lng: b.lng,
      }))}
    />
  );
}
