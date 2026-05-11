import { renderResourceOG, RESOURCE_OG_SIZE } from "@/lib/og-resource";

export const runtime = "nodejs";
export const alt = "Resources · BadaMangal";
export const size = RESOURCE_OG_SIZE;
export const contentType = "image/png";

export default function OG() {
  return renderResourceOG({
    kicker: "Resources",
    titleEn: "The Bada Mangal companion",
    subtitle: "Read, listen, watch, the canonical companion to Lucknow's Bada Mangal.",
    accent: "saffron",
  });
}
