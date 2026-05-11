import { renderResourceOG, RESOURCE_OG_SIZE } from "@/lib/og-resource";

export const runtime = "nodejs";
export const alt = "Hanuman Chalisa · BadaMangal";
export const size = RESOURCE_OG_SIZE;
export const contentType = "image/png";

export default function OG() {
  return renderResourceOG({
    kicker: "Resources · Chalisa",
    titleHi: "हनुमान चालीसा",
    titleEn: "Hanuman Chalisa",
    subtitle: "Forty verses, two dohas, with verified audio.",
    accent: "saffron",
  });
}
