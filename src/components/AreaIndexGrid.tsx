"use client";

import Link from "next/link";
import { useLocaleFromContext } from "@/lib/locale-context";
import { AREAS } from "@/lib/lucknow";
import { areaToSlug } from "@/lib/areaSlug";
import { strings } from "@/content/strings";

/**
 * "Bada Mangal by area" index, every Lucknow neighbourhood we
 * curate, surfaced as a tappable chip on the homepage. Each chip
 * is a direct internal link to the corresponding /area/[slug]
 * landing page.
 *
 * Why this matters (SEO):
 *   • 36 high-quality internal links from the homepage (a high-
 *     authority page in our own site graph) directly to each area
 *     landing page, distributes PageRank evenly across the area
 *     tier, accelerates Google's crawl + ranking cycle for
 *     "bada mangal <area>" queries.
 *   • Reciprocal links, each area page already links back to
 *     adjacent areas + the homepage. This component completes the
 *     link graph at the top level.
 *
 * Why this matters (UX):
 *   • Visitors who know their area can jump straight to the right
 *     page without scrolling through the map + filter dance.
 *   • Mobile-friendly: pill chips wrap into compact rows.
 *
 * Client component so the section heading + count text swap on
 * the Hindi toggle synchronously (the same pattern as
 * FeaturedBhandaras and PamphletPromo).
 */
type Props = {
  /** Optional count of areas with at least one APPROVED bhandara,
   *  computed server-side and passed down. Drives the "21 of 36
   *  areas have a listed bhandara" stat-style copy at the top. */
  activeAreaCount?: number;
  /**
   * Set of area slugs that have at least one APPROVED bhandara.
   * Used to highlight chips for areas that ARE live, so the eye
   * can scan and pick out the rows that have something to visit
   * vs the ones still waiting for the first listing. Slugs (not
   * area display names) because the chip's `href` already uses
   * the slug form, keeps the comparison straightforward.
   *
   * Inactive chips stay clickable, the area page itself shows a
   * "be the first" empty state which doubles as the listing CTA,
   * and the link still distributes PageRank from the homepage to
   * every /area/<slug> page (the original SEO motivation for this
   * grid stays intact).
   */
  activeAreaSlugs?: ReadonlySet<string>;
};

export default function AreaIndexGrid({
  activeAreaCount,
  activeAreaSlugs,
}: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = strings[locale];
  const langSuffix = isHi ? "" : "?lang=en";

  return (
    <section
      aria-labelledby="area-index-heading"
      className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16"
    >
      <div className="text-center mb-8">
        <p className="font-mukta uppercase tracking-[0.3em] text-saffron-600 text-[0.65rem] sm:text-xs font-semibold">
          {isHi ? "क्षेत्र अनुसार खोजें" : "Browse by Area"}
        </p>
        <h2
          id="area-index-heading"
          className={`mt-3 ${
            isHi
              ? "font-tiro text-sindoor-700"
              : "font-fraunces font-bold text-sindoor-700"
          } text-3xl sm:text-4xl`}
        >
          {isHi ? "लखनऊ के सभी क्षेत्र" : "Bada Mangal across Lucknow"}
        </h2>
        <p className="mt-3 text-sm sm:text-base text-ink-600 max-w-2xl mx-auto leading-relaxed">
          {isHi ? (
            <>
              अपने क्षेत्र के बड़े मंगल भंडारे एक टैप दूर
              {typeof activeAreaCount === "number" ? (
                <>
                  {" "}
                  ·{" "}
                  <strong>
                    {activeAreaCount} में से {AREAS.length} क्षेत्रों
                  </strong>{" "}
                  में सूचीबद्ध भंडारे
                </>
              ) : null}
            </>
          ) : (
            <>
              Find Bada Mangal bhandaras in your neighbourhood, one tap
              away
              {typeof activeAreaCount === "number" ? (
                <>
                  {" "}
                  ·{" "}
                  <strong>
                    {activeAreaCount} of {AREAS.length} areas
                  </strong>{" "}
                  have a listed bhandara
                </>
              ) : null}
            </>
          )}
        </p>
      </div>

      <ul className="flex flex-wrap gap-2 sm:gap-2.5 justify-center">
        {AREAS.map((area) => {
          const label = t.areas[area] ?? area;
          const slug = areaToSlug(area);
          // An area is "active" when it has at least one APPROVED
          // bhandara. Active chips wear a saffron tint + small dot so
          // the eye can pick out where things actually are; inactive
          // chips go quiet (muted text + lighter border) so they
          // don't compete for attention but stay clickable and SEO-
          // useful as direct internal links to each /area/[slug].
          //
          // If activeAreaSlugs is undefined (legacy caller), every
          // chip falls back to the original neutral styling so
          // nothing breaks visually.
          const isActive = activeAreaSlugs?.has(slug) ?? false;
          const hasActiveData = activeAreaSlugs !== undefined;
          const baseCls =
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors";
          const variantCls = !hasActiveData
            ? "border border-gold-500/50 bg-cream-50 hover:bg-saffron-50 hover:border-saffron-500 text-sindoor-700 hover:text-saffron-600"
            : isActive
              ? "border border-saffron-500/55 bg-saffron-50/70 text-sindoor-700 hover:bg-saffron-100 hover:border-saffron-500"
              : "border border-gold-500/35 bg-cream-50 text-ink-600/75 hover:bg-saffron-50 hover:border-saffron-500/50 hover:text-saffron-600";
          return (
            <li key={area}>
              <Link
                href={`/area/${slug}${langSuffix}`}
                data-ga="area_index_chip"
                data-ga-area={slug}
                data-ga-active={isActive ? "1" : "0"}
                className={`${baseCls} ${variantCls}`}
              >
                {/* Saffron dot for active chips, an at-a-glance
                    "this area has bhandaras" signal that survives
                    the colour-blind / low-contrast case where the
                    tint alone might not register. Hidden entirely
                    for inactive chips so the row reads cleanly. */}
                {hasActiveData && isActive ? (
                  <span
                    aria-hidden
                    className="inline-block w-1.5 h-1.5 rounded-full bg-saffron-600"
                  />
                ) : null}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
