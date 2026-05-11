import { renderResourceOG, RESOURCE_OG_SIZE } from "@/lib/og-resource";

export const runtime = "nodejs";
export const alt = "Hanuman temples of Lucknow · BadaMangal";
export const size = RESOURCE_OG_SIZE;
export const contentType = "image/png";

export default function OG() {
  return renderResourceOG({
    kicker: "Resources · Temples",
    titleEn: "Hanuman temples of Lucknow",
    subtitle: "Aliganj, Hanuman Setu, Sankat Mochan, addresses, timings, history.",
    accent: "gold",
  });
}
