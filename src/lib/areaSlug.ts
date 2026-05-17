/**
 * Area-name <-> URL-slug conversion for /area/[slug] routes.
 *
 * Source of truth: the `AREAS` list in lib/lucknow.ts. We don't
 * generate slugs from arbitrary user input, the route only
 * accepts slugs that resolve back to a canonical area name, which
 * keeps the route surface small (~36 pages) and SEO clean (no
 * duplicate-content variants for the same neighbourhood).
 */
import { AREAS, type Area } from "@/lib/lucknow";

/** "Bakshi Ka Talab" → "bakshi-ka-talab". */
export function areaToSlug(area: Area | string): string {
  return area
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** "bakshi-ka-talab" → "Bakshi Ka Talab" (canonical) or null. */
export function slugToArea(slug: string): Area | null {
  const want = slug.toLowerCase();
  for (const a of AREAS) {
    if (areaToSlug(a) === want) return a;
  }
  return null;
}

/** Pre-computed list of every valid area slug, used by Next's
 *  generateStaticParams to render every area page at build time. */
export const ALL_AREA_SLUGS = AREAS.map((a) => areaToSlug(a));
