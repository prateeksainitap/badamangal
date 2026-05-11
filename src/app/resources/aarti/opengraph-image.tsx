import { renderResourceOG, RESOURCE_OG_SIZE } from "@/lib/og-resource";

export const runtime = "nodejs";
export const alt = "Hanuman Aarti · BadaMangal";
export const size = RESOURCE_OG_SIZE;
export const contentType = "image/png";

export default function OG() {
  return renderResourceOG({
    kicker: "Resources · Aarti",
    titleHi: "हनुमान आरती",
    titleEn: "Hanuman Aarti",
    subtitle: "Aarti Kije Hanuman Lala Ki, with verified audio and bilingual text.",
    accent: "sindoor",
  });
}
