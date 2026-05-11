import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AddBhandaraSwitcher from "@/components/AddBhandaraSwitcher";
import { prisma } from "@/lib/db";
import { LANG_COOKIE, resolveLocale } from "@/lib/i18n";
import { localised } from "@/lib/seo";

export const dynamic = "force-dynamic";

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

type SearchParams = Promise<{ lang?: string; role?: string }>;

export default async function ListBhandaraPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const c = await cookies();
  const locale = resolveLocale({
    urlLang: sp.lang,
    cookieLang: c.get(LANG_COOKIE)?.value,
  });

  // Spot has its own canonical URL (/spot) with the simplified V2
  // design. If the user lands here with ?role=spotter, hop them
  // straight to /spot so the city only ever sees one Spot page.
  if (sp.role === "spotter") {
    redirect(locale === "en" ? "/spot?lang=en" : "/spot");
  }

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
      locale={locale}
      initialRole={
        sp.role === "organizer" || sp.role === "spotter" ? sp.role : null
      }
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
