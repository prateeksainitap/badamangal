/**
 * Per-area landing page — the single largest SEO unlock in the
 * audit. GSC showed page-1-bottom rankings for "bhandara <area>" /
 * "bada mangal <area>" with no clicks because the only existing
 * answer was the generic homepage, which doesn't rank specifically
 * for the area term.
 *
 * Each page is statically pre-rendered for every neighbourhood in
 * `AREAS` (lib/lucknow.ts). Content includes:
 *   • SEO-tuned H1 + meta (matches "bada mangal <area>" intent
 *     verbatim)
 *   • Server-rendered list of every bhandara in the area
 *   • Area-specific FAQ schema (eligible for Google's FAQ
 *     rich-result blocks)
 *   • Breadcrumb + ItemList + LocalBusiness schemas
 *   • Internal links: back to homepage, to /list-bhandara, to
 *     adjacent areas (link-graph depth → ranking signal)
 *
 * Static generation: ISR with 5-minute revalidate so new
 * bhandaras flowing in via /list-bhandara or the WhatsApp bot
 * surface here automatically within minutes.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ALL_AREA_SLUGS, slugToArea, areaToSlug } from "@/lib/areaSlug";
import { prisma, toBhandara } from "@/lib/db";
import { hasUpcomingDate } from "@/lib/dates";
import BhandaraCard from "@/components/BhandaraCard";
import {
  breadcrumbSchema,
  faqPageSchema,
  localised,
  organizationSchema,
  SITE_URL,
} from "@/lib/seo";
import { AREAS } from "@/lib/lucknow";
import { strings, type Locale } from "@/content/strings";

export const revalidate = 300;
export const dynamicParams = false; // only the canonical 36 slugs render

type RouteParams = Promise<{ slug: string }>;

export function generateStaticParams(): { slug: string }[] {
  return ALL_AREA_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = slugToArea(slug);
  if (!area) return { title: "Area not found" };

  // Count bhandaras up front so the title + description can include
  // "5 bhandaras" etc. — concrete numbers in SERP snippets always
  // beat abstract ones for CTR.
  const count = await prisma.bhandara.count({
    where: { status: "APPROVED", area },
  });

  // SEO-tuned title: "Bada Mangal in <Area>, Lucknow 2026 — N bhandaras".
  // Area is position 3, "Bada Mangal" position 1 (the brand + intent
  // keyword), "Lucknow 2026" anchors local + season. Count gives the
  // snippet a concrete number.
  const title = count
    ? `Bada Mangal in ${area}, Lucknow 2026 — ${count} ${count === 1 ? "bhandara" : "bhandaras"}`
    : `Bada Mangal in ${area}, Lucknow 2026 — Find a Bhandara`;

  const description = count
    ? `Find every Bada Mangal bhandara in ${area}, Lucknow for the 2026 8-Tuesday Jyeshtha season. ${count} ${count === 1 ? "bhandara" : "bhandaras"} mapped with timings, prasad menu, organizer details. Free.`
    : `Looking for a Bada Mangal bhandara in ${area}, Lucknow? Browse the 2026 directory and list yours free.`;

  return {
    title,
    description,
    keywords: [
      `bada mangal ${area.toLowerCase()}`,
      `bhandara ${area.toLowerCase()}`,
      `${area.toLowerCase()} bada mangal`,
      `bhandara near me ${area.toLowerCase()}`,
      `बड़ा मंगल ${area}`,
      `${area} भंडारा`,
      "bada mangal lucknow 2026",
      "bhandara lucknow",
    ],
    alternates: localised(`/area/${slug}`),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/area/${slug}`,
      siteName: "BadaMangal",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function AreaPage({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const area = slugToArea(slug);
  if (!area) notFound();

  // Server renders English by default — matches the rest of the site's
  // static-cached pattern. Client components hydrate via LocaleProvider.
  const locale: Locale = "en";
  const t = strings[locale];

  const records = await prisma.bhandara.findMany({
    where: { status: "APPROVED", area },
    orderBy: [{ isSponsored: "desc" }, { isVerified: "desc" }, { createdAt: "asc" }],
  });
  const bhandaras = records.map(toBhandara).filter((b) => hasUpcomingDate(b));

  // Pick 2-3 adjacent areas for cross-linking. Trivial heuristic:
  // the 2 areas immediately before and after this one in the
  // alphabetic AREAS list. Good-enough for V1; can be replaced by
  // a real geographic-adjacency map later.
  const ix = AREAS.indexOf(area);
  const adjacent: typeof AREAS[number][] = [];
  if (ix > 0) adjacent.push(AREAS[ix - 1]!);
  if (ix < AREAS.length - 1) adjacent.push(AREAS[ix + 1]!);
  if (ix > 1 && adjacent.length < 3) adjacent.push(AREAS[ix - 2]!);

  const breadcrumbs = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Areas", path: "/area" },
    { name: area, path: `/area/${slug}` },
  ]);

  const faqSchema = faqPageSchema([
    {
      q: `How many Bada Mangal bhandaras are in ${area}, Lucknow?`,
      a: bhandaras.length
        ? `${bhandaras.length} ${bhandaras.length === 1 ? "bhandara is" : "bhandaras are"} currently listed in ${area} for the 2026 Bada Mangal season. The list is community-sourced and grows as the season progresses.`
        : `No bhandaras are listed in ${area} for the 2026 season yet — be the first to add one (free).`,
    },
    {
      q: `When does Bada Mangal happen in ${area}?`,
      a: `Bada Mangal in 2026 falls on the 8 Tuesdays of Jyeshtha — May 5, May 12, May 19, May 26, June 2, June 9, June 16, and June 23. ${area} bhandaras serve devotees through the day on each Tuesday; many also serve on Shani Jayanti (Saturday May 16) and the final Saturday rotations.`,
    },
    {
      q: `Are Bada Mangal bhandaras in ${area} free?`,
      a: `Yes — every Bada Mangal bhandara is a free community meal, offered as seva (selfless service) in honour of Lord Hanuman. Devotees and visitors are welcome regardless of background. Most bhandaras serve puri, sabzi, halwa, and prasad. Donations are accepted but never required.`,
    },
    {
      q: `How do I list my bhandara in ${area} on BadaMangal.com?`,
      a: `Use the free listing form at badamangal.com/list-bhandara — takes 60 seconds, no sign-up required. Your bhandara appears on the live map within seconds. You can also generate a free printable pamphlet at badamangal.com/pamphlet.`,
    },
  ]);

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Bada Mangal Bhandaras in ${area}, Lucknow 2026`,
    itemListElement: bhandaras.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/bhandara/${b.slug}`,
      name: b.name,
    })),
  };

  const jsonLdBlocks: object[] = [
    organizationSchema(),
    breadcrumbs,
    faqSchema,
    itemList,
  ];

  return (
    <>
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      <article className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 sm:pt-12 pb-24">
        {/* Breadcrumb trail — also human-readable, not just JSON-LD */}
        <nav
          aria-label="Breadcrumb"
          className="text-xs sm:text-sm text-ink-600 mb-4"
        >
          <Link href="/" className="hover:text-saffron-600">
            Home
          </Link>
          <span aria-hidden className="mx-2 text-gold-500">›</span>
          <Link href="/#map" className="hover:text-saffron-600">
            Areas
          </Link>
          <span aria-hidden className="mx-2 text-gold-500">›</span>
          <span className="text-sindoor-700 font-medium">{area}</span>
        </nav>

        <header>
          <p className="font-mukta uppercase tracking-[0.28em] text-saffron-600 text-[0.65rem] sm:text-xs font-semibold">
            2026 · Bada Mangal Lucknow
          </p>
          <h1 className="mt-2 font-fraunces font-bold text-3xl sm:text-[2.4rem] leading-tight text-sindoor-700">
            Bada Mangal Bhandaras in {area}, Lucknow 2026
          </h1>
          <p className="mt-3 text-base sm:text-lg text-ink-600 leading-relaxed max-w-3xl">
            {bhandaras.length === 0 ? (
              <>
                No bhandaras are listed in <strong>{area}</strong> for the
                2026 Bada Mangal season yet. If you're hosting one, take
                30 seconds to list it free — devotees searching for{" "}
                <em>bhandara in {area}</em> will find you immediately.
              </>
            ) : (
              <>
                <strong>{bhandaras.length}</strong>{" "}
                {bhandaras.length === 1 ? "bhandara is" : "bhandaras are"}{" "}
                serving the 2026 Bada Mangal season in {area}. Every
                listing is free seva — open to all devotees. Locations,
                timings, prasad menus, and one-tap directions below.
              </>
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/list-bhandara"
              data-ga="area_list_bhandara"
              data-ga-area={slug}
              className="inline-flex items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-semibold px-5 py-2.5 text-sm shadow-warm transition-transform hover:-translate-y-0.5"
            >
              List your {area} bhandara · Free
            </Link>
            <Link
              href="/#map"
              data-ga="area_view_full_map"
              data-ga-area={slug}
              className="inline-flex items-center gap-2 rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-50 font-semibold px-5 py-2.5 text-sm"
            >
              See all areas on map →
            </Link>
          </div>
        </header>

        {/* Bhandara grid */}
        {bhandaras.length > 0 ? (
          <section className="mt-10 sm:mt-12">
            <h2 className="sr-only">{area} bhandaras</h2>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {bhandaras.map((b) => (
                <BhandaraCard key={b.id} bhandara={b} locale={locale} />
              ))}
            </ul>
          </section>
        ) : (
          <section className="mt-12 rounded-2xl border border-saffron-500/45 bg-gradient-to-br from-saffron-50 to-cream-50 px-6 py-10 text-center">
            <p className="text-ink-600 mb-4">
              First bhandara in {area} this season? List it free and
              be the only result for devotees searching this area.
            </p>
            <Link
              href="/list-bhandara"
              className="inline-flex items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-semibold px-6 py-3 shadow-warm"
            >
              List a {area} bhandara →
            </Link>
          </section>
        )}

        {/* Adjacent areas — internal-link surface for PageRank flow */}
        {adjacent.length > 0 ? (
          <section className="mt-14 pt-10 border-t border-gold-500/30">
            <h2 className="font-fraunces font-semibold text-xl sm:text-2xl text-sindoor-700">
              Bhandaras in nearby areas
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              Devotees in {area} often visit bhandaras across the
              neighbouring areas — explore the directory by area.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {adjacent.map((a) => (
                <li key={a}>
                  <Link
                    href={`/area/${areaToSlug(a)}`}
                    data-ga="area_cross_link"
                    data-ga-from={slug}
                    data-ga-to={areaToSlug(a)}
                    className="inline-flex items-center rounded-full border border-gold-500/55 bg-cream-50 hover:bg-saffron-50 text-sindoor-700 hover:text-saffron-600 px-4 py-2 text-sm font-medium transition-colors"
                  >
                    Bada Mangal in {a} →
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/#map"
                  data-ga="area_see_all_areas"
                  className="inline-flex items-center rounded-full bg-saffron-600 text-cream-50 hover:bg-saffron-500 px-4 py-2 text-sm font-semibold"
                >
                  All Lucknow areas →
                </Link>
              </li>
            </ul>
          </section>
        ) : null}

        {/* Resources cross-sell — the 4 devotional pages */}
        <section className="mt-14 pt-10 border-t border-gold-500/30">
          <h2 className="font-fraunces font-semibold text-xl sm:text-2xl text-sindoor-700">
            Devotional resources for Bada Mangal
          </h2>
          <p className="mt-2 text-sm text-ink-600">
            The songs, chants, and rituals every {area} bhandara plays.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: "/resources/chalisa", label: "Hanuman Chalisa" },
              { href: "/resources/aarti", label: "Hanuman Aarti" },
              { href: "/resources/ashtak", label: "Hanuman Ashtak" },
              { href: "/resources/bajrang-baan", label: "Bajrang Baan" },
            ].map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className="block rounded-2xl border border-gold-500/40 bg-cream-50 hover:border-saffron-500 px-4 py-3 text-sm font-semibold text-sindoor-700 hover:text-saffron-600 transition-colors"
                >
                  {r.label} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>

      <noscript>{/* keeps t in scope */}{t.cards.sectionHeading}</noscript>
    </>
  );
}
