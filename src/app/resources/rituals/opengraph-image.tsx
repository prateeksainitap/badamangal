import { renderResourceOG, RESOURCE_OG_SIZE } from "@/lib/og-resource";

export const runtime = "nodejs";
export const alt = "Tuesday vrat guide · BadaMangal";
export const size = RESOURCE_OG_SIZE;
export const contentType = "image/png";

export default function OG() {
  return renderResourceOG({
    kicker: "Resources · Rituals",
    titleEn: "Tuesday vrat guide",
    subtitle: "What to do on a Bada Mangal, vrat, mantra, prasad, etiquette.",
    accent: "saffron",
  });
}
