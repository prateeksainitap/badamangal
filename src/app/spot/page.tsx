import type { Metadata } from "next";
import SpotHero from "@/components/SpotHero";
import SpotQuickForm from "@/components/SpotQuickForm";
import { localised } from "@/lib/seo";
import { prisma } from "@/lib/db";

// ISR. Was force-dynamic for cookies()-based locale. The hero + form
// are both client components reading locale from <LocaleProvider />,
// so the page can prerender statically and navigate instantly.
// `bhandaras` (used for nearest-area inference inside the form) is a
// pure DB read with no per-visitor data, so it caches happily.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Spot a bhandara, share a Bada Mangal sighting · BadaMangal",
  description:
    "Walked past a Bada Mangal bhandara in Lucknow? Add a photo and your location in 30 seconds, no login. Goes live on the city map for 8 hours.",
  alternates: localised("/spot"),
  openGraph: {
    title: "Spot a Bada Mangal bhandara · BadaMangal Lucknow",
    description:
      "One photo and your location is enough, share the bhandara you just walked past with the rest of Lucknow.",
    type: "website",
    locale: "hi_IN",
    alternateLocale: "en_IN",
  },
};

export default async function SpotPage() {
  // Approved listings still pulled so the form can infer the nearest
  // area from GPS coords (used internally; no list-pick UI in V2).
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
    <div className="mx-auto max-w-md sm:max-w-xl lg:max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
      <SpotHero />
      <SpotQuickForm
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
    </div>
  );
}
