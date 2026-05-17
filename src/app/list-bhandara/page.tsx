import type { Metadata } from "next";
import AddBhandaraSwitcher from "@/components/AddBhandaraSwitcher";
import { prisma } from "@/lib/db";
import { localised } from "@/lib/seo";

// ISR: was force-dynamic for cookie-based locale + searchParams role.
// Locale is now resolved client-side via <LocaleProvider />, and the
// `?role=spotter` legacy deep link is handled inside AddBhandaraSwitcher
// (useEffect on mount). Server renders English defaults and a list of
// approved bhandaras; cache for 60s.
export const revalidate = 60;

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
  const listings = await prisma.bhandara.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      slug: true,
      name: true,
      nameHi: true,
      area: true,
      lat: true,
      lng: true,
    },
    orderBy: [{ area: "asc" }, { name: "asc" }],
    take: 200,
  });

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
