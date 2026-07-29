/**
 * BACK-COMPAT SHIM. The real source of truth is `@/lib/cities`.
 *
 * This module used to BE the city model: a flat list of 36 Lucknow
 * neighbourhoods plus a hardcoded centre. Nineteen files import from
 * here, so rather than a big-bang rename it now re-exports from the
 * multi-city registry and keeps the old names working.
 *
 * WHAT CHANGED, and why it matters if you are reading this from a
 * call site:
 *
 *   • `AREAS` still means "Lucknow's areas" (unchanged behaviour). If
 *     you want the areas for whichever city the user is actually
 *     looking at, call `areasFor(citySlug)` from `@/lib/cities`
 *     instead. Anything rendering a city-scoped <select> or filter
 *     wants that one, not this.
 *   • `Area` is now the union across ALL cities, not Lucknow only.
 *     Widening it is what lets a Kanpur listing typecheck at all.
 *   • `DEFAULT_CENTER` / `DEFAULT_ZOOM` still point at Lucknow, which
 *     is correct as the app-wide fallback, but a city-aware map should
 *     read `getCity(slug).center` / `.zoom`.
 *
 * New code should import from `@/lib/cities` directly. This file is
 * kept so the migration could land without touching every call site in
 * one commit, not because the indirection is desirable.
 */

export {
  /** Union of every curated area name across all served cities. */
  type Area,
  /** All areas, every city, deduped + sorted. */
  ALL_AREAS,
} from "@/lib/cities";

import { CITIES } from "@/lib/cities";

/**
 * Lucknow's curated areas. Preserved under the original name + order
 * so existing importers (the listing form, the area index, admin
 * filters) behave exactly as before.
 */
export const AREAS = CITIES.lucknow.areas;

/** Lucknow's centre. App-wide map fallback when no city is resolved. */
export const DEFAULT_CENTER = CITIES.lucknow.center;

/** Lucknow's default zoom. */
export const DEFAULT_ZOOM = CITIES.lucknow.zoom;
