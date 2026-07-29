/**
 * Area-name <-> URL-slug conversion for /area/[slug] routes.
 *
 * We don't generate slugs from arbitrary user input; the route only
 * accepts slugs that resolve back to a canonical (area, city) pair,
 * which keeps the route surface small and SEO clean (no duplicate
 * content variants for the same neighbourhood).
 *
 * MULTI-CITY (2026-07) and why Lucknow slugs are deliberately bare:
 *
 * Area names repeat across cities. Kalyanpur exists in both Lucknow
 * and Kanpur; Civil Lines exists in Kanpur, Hardoi AND Barabanki. So
 * a slug alone can no longer identify a place, and a naive "add every
 * city's areas to the list" would have three cities fighting over
 * /area/civil-lines.
 *
 * The obvious fix is /area/[city]/[slug], but that would break every
 * existing area URL. Those pages are real SEO assets (the Aliganj
 * page alone did ~1,300 views last season, and the site ranks #1 for
 * a spread of "bada mangal <area>" queries), so changing them is a
 * self-inflicted wound.
 *
 * Instead: Lucknow keeps bare slugs exactly as before, and every
 * other city gets a "-<city>" suffix.
 *
 *   Aliganj (Lucknow)       -> /area/aliganj          (unchanged)
 *   Civil Lines (Kanpur)    -> /area/civil-lines-kanpur
 *   Civil Lines (Hardoi)    -> /area/civil-lines-hardoi
 *
 * Zero existing URLs move, collisions are impossible, and the new
 * cities read fine to a human. Revisit only if Lucknow ever stops
 * being the flagship.
 */
import { CITIES, DEFAULT_CITY_SLUG, type Area, type CitySlug } from "@/lib/cities";

/** "Bakshi Ka Talab" -> "bakshi-ka-talab" (no city suffix). */
function baseSlug(area: string): string {
  return area
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Area (+ city) -> URL slug. Omitting `city` means Lucknow, which is
 * what every pre-existing call site wants, so they keep working and
 * keep producing the same URLs they always did.
 */
export function areaToSlug(
  area: Area | string,
  city: CitySlug = DEFAULT_CITY_SLUG,
): string {
  const base = baseSlug(area);
  return city === DEFAULT_CITY_SLUG ? base : `${base}-${city}`;
}

/** Resolved area page target. */
export type AreaTarget = { area: Area; city: CitySlug };

/**
 * URL slug -> canonical { area, city }, or null if it matches nothing.
 *
 * Checks suffixed (non-Lucknow) forms FIRST. Order matters: a bare
 * "civil-lines" must not greedily match Kanpur's area before we have
 * ruled out a genuine Lucknow area of the same name.
 */
export function slugToAreaCity(slug: string): AreaTarget | null {
  const want = slug.toLowerCase();

  for (const city of Object.values(CITIES)) {
    if (city.slug === DEFAULT_CITY_SLUG) continue;
    for (const a of city.areas) {
      if (areaToSlug(a, city.slug) === want) {
        return { area: a, city: city.slug };
      }
    }
  }
  for (const a of CITIES[DEFAULT_CITY_SLUG].areas) {
    if (areaToSlug(a) === want) {
      return { area: a, city: DEFAULT_CITY_SLUG };
    }
  }
  return null;
}

/**
 * Back-compat: area name only. Existing callers that just want "is
 * this a valid area page" keep working unchanged.
 */
export function slugToArea(slug: string): Area | null {
  return slugToAreaCity(slug)?.area ?? null;
}

/**
 * Every valid area slug across every city, for generateStaticParams
 * and the sitemap.
 *
 * Only LIVE cities are included. The 2027 cities are configured but
 * not launched, and publishing empty area pages for them would put
 * thin, zero-content URLs into the sitemap, which is an SEO liability
 * rather than a head start. They appear automatically the moment
 * `isLive` flips.
 */
export const ALL_AREA_SLUGS: string[] = Object.values(CITIES)
  .filter((c) => c.isLive)
  .flatMap((c) => c.areas.map((a) => areaToSlug(a, c.slug)));
