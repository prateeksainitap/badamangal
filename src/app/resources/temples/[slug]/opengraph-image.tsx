import { renderResourceOG, RESOURCE_OG_SIZE } from "@/lib/og-resource";
import { TEMPLE_BY_SLUG, TEMPLES } from "@/content/temples";

export const runtime = "nodejs";
export const alt = "Hanuman temple · BadaMangal";
export const size = RESOURCE_OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return TEMPLES.map((t) => ({ slug: t.slug }));
}

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const temple = TEMPLE_BY_SLUG[slug];
  if (!temple) {
    return renderResourceOG({
      kicker: "Resources · Temple",
      titleEn: "Hanuman temple of Lucknow",
      accent: "gold",
    });
  }
  return renderResourceOG({
    kicker: `Temple · ${temple.area}`,
    titleHi: temple.name.hi,
    titleEn: temple.name.en,
    subtitle: temple.altName,
    accent: "saffron",
  });
}
