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
};

export default function AreaIndexGrid({ activeAreaCount }: Props) {
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
          return (
            <li key={area}>
              <Link
                href={`/area/${areaToSlug(area)}${langSuffix}`}
                data-ga="area_index_chip"
                data-ga-area={areaToSlug(area)}
                className="inline-flex items-center rounded-full border border-gold-500/50 bg-cream-50 hover:bg-saffron-50 hover:border-saffron-500 text-sindoor-700 hover:text-saffron-600 px-4 py-2 text-sm font-medium transition-colors"
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
