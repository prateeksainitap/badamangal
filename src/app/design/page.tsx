import type { Metadata } from "next";
import PamphletBuilder from "@/components/PamphletBuilder";
import { ALL_TUESDAY_ISO, ALL_SATURDAY_ISO } from "@/lib/dates";
import { PAMPHLET_THEMES } from "@/lib/pamphlet-themes";

/**
 * Public "Design your own bhandara pamphlet" tool. Anyone can land
 * here, fill in their bhandara details, pick a colour / theme, see
 * a live preview, and download the print-ready A4 PNG.
 *
 * The actual rendering still goes through the existing
 * /api/pamphlet POST endpoint (Satori + AI background composer).
 * This page is just a friendlier, no-login UI on top of that API.
 */
export const metadata: Metadata = {
  title: "Design your bhandara pamphlet · Bada Mangal",
  description:
    "Pick a theme, fill in the details, download a print-ready A4 pamphlet for your bhandara. Free, no signup.",
  openGraph: {
    title: "Design your bhandara pamphlet",
    description:
      "A free Bada Mangal pamphlet maker. Pick a theme, fill in the details, download print-ready in seconds.",
  },
};

export default function DesignYourPamphletPage() {
  return (
    <PamphletBuilder
      themes={[...PAMPHLET_THEMES]}
      tuesdayDates={[...ALL_TUESDAY_ISO]}
      saturdayDates={[...ALL_SATURDAY_ISO]}
    />
  );
}
