import { renderResourceOG, RESOURCE_OG_SIZE } from "@/lib/og-resource";

export const runtime = "nodejs";
export const alt = "This week in Lucknow · BadaMangal";
export const size = RESOURCE_OG_SIZE;
export const contentType = "image/png";

export default function OG() {
  return renderResourceOG({
    kicker: "Resources · News",
    titleEn: "This week in Lucknow",
    subtitle: "Editor's-pick news from the city's biggest meal.",
    accent: "gold",
  });
}
