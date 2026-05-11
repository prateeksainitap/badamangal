import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LANG_COOKIE, resolveLocale } from "@/lib/i18n";
import { strings } from "@/content/strings";
import {
  MarigoldDivider,
  GadaBullet,
  SunburstSpark,
} from "@/components/ornaments";
import AnimatedHeading from "@/components/AnimatedHeading";
import { NEWS, type NewsEntry } from "@/content/news";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Resources · Hanuman Chalisa, Aarti, news, temples · BadaMangal",
  description:
    "The Hanuman Chalisa, Hanuman Aarti, Tuesday vrat guide, the city's biggest temples, and this week's Lucknow news, one place to keep coming back to.",
  alternates: {
    canonical: "/resources",
    languages: {
      "hi-IN": "/resources",
      "en-IN": "/resources?lang=en",
    },
  },
  openGraph: {
    title: "Resources · BadaMangal",
    description:
      "Read, listen, watch, the canonical companion to Lucknow's Bada Mangal.",
    url: `${SITE_URL}/resources`,
    type: "website",
    siteName: "BadaMangal",
  },
};

type SearchParams = Promise<{ lang?: string }>;

export default async function ResourcesHubPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const c = await cookies();
  const locale = resolveLocale({
    urlLang: sp.lang,
    cookieLang: c.get(LANG_COOKIE)?.value,
  });
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "BadaMangal Resources",
    url: `${SITE_URL}/resources`,
    inLanguage: ["hi-IN", "en-IN"],
    isPartOf: {
      "@type": "WebSite",
      name: "BadaMangal",
      url: SITE_URL,
    },
    hasPart: [
      { "@type": "WebPage", name: t.resources.cards.news.title, url: `${SITE_URL}/resources/news` },
      { "@type": "WebPage", name: t.resources.cards.chalisa.title, url: `${SITE_URL}/resources/chalisa` },
      { "@type": "WebPage", name: t.resources.cards.aarti.title, url: `${SITE_URL}/resources/aarti` },
      { "@type": "WebPage", name: t.resources.cards.ashtak.title, url: `${SITE_URL}/resources/ashtak` },
      { "@type": "WebPage", name: t.resources.cards.bajrangBaan.title, url: `${SITE_URL}/resources/bajrang-baan` },
      { "@type": "WebPage", name: t.resources.cards.ramStuti.title, url: `${SITE_URL}/resources/ram-stuti` },
      { "@type": "WebPage", name: t.resources.cards.rituals.title, url: `${SITE_URL}/resources/rituals` },
      { "@type": "WebPage", name: t.resources.cards.temples.title, url: `${SITE_URL}/resources/temples` },
    ],
  };

  const cards: Array<{
    href: string;
    title: string;
    body: string;
    cta: string;
    accent: "saffron" | "sindoor" | "gold";
    /** Whether the destination page ships an audio recording. Drives
     *  the kicker label ("Read · Listen" vs "Read") and the corner
     *  play-icon chip. */
    hasAudio: boolean;
  }> = [
    {
      href: `/resources/chalisa${langSuffix}`,
      title: t.resources.cards.chalisa.title,
      body: t.resources.cards.chalisa.body,
      cta: t.resources.cards.chalisa.cta,
      accent: "saffron",
      hasAudio: true,
    },
    {
      href: `/resources/aarti${langSuffix}`,
      title: t.resources.cards.aarti.title,
      body: t.resources.cards.aarti.body,
      cta: t.resources.cards.aarti.cta,
      accent: "sindoor",
      hasAudio: true,
    },
    {
      href: `/resources/ashtak${langSuffix}`,
      title: t.resources.cards.ashtak.title,
      body: t.resources.cards.ashtak.body,
      cta: t.resources.cards.ashtak.cta,
      accent: "saffron",
      hasAudio: true,
    },
    {
      href: `/resources/bajrang-baan${langSuffix}`,
      title: t.resources.cards.bajrangBaan.title,
      body: t.resources.cards.bajrangBaan.body,
      cta: t.resources.cards.bajrangBaan.cta,
      accent: "sindoor",
      hasAudio: true,
    },
    {
      href: `/resources/ram-stuti${langSuffix}`,
      title: t.resources.cards.ramStuti.title,
      body: t.resources.cards.ramStuti.body,
      cta: t.resources.cards.ramStuti.cta,
      accent: "saffron",
      hasAudio: true,
    },
    // News intentionally omitted from the canonical-text card grid —
    // it gets its own section below with real article previews.
    {
      href: `/resources/rituals${langSuffix}`,
      title: t.resources.cards.rituals.title,
      body: t.resources.cards.rituals.body,
      cta: t.resources.cards.rituals.cta,
      accent: "gold",
      hasAudio: false,
    },
  ];

  // Pick the featured story (or fall back to the most recent) plus the
  // next three for the "This week in Lucknow" preview band.
  const sortedNews = [...NEWS].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
  const featuredNews: NewsEntry =
    sortedNews.find((n) => n.featured) ?? sortedNews[0];
  const secondaryNews = sortedNews
    .filter((n) => n.id !== featuredNews?.id)
    .slice(0, 3);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      <article className="pb-24">
        {/* HERO */}
        <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-14 sm:pt-20 pb-10 text-center">
          <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
            {t.resources.hubKicker}
          </p>
          <AnimatedHeading
            as="h1"
            text={t.resources.hubHeading}
            className={`mt-5 ${
              isHi ? "font-deva text-sindoor-700" : "font-fraunces text-sindoor-700"
            } font-medium text-[2rem] sm:text-[2.75rem] leading-[1.2]`}
          />
          <p className="mt-5 font-fraunces optical-display italic text-xl sm:text-2xl text-ink-900 max-w-2xl mx-auto leading-snug">
            {t.resources.hubBody}
          </p>
          <div className="mt-7 flex justify-center">
            <SunburstSpark size={48} className="text-gold-500" />
          </div>
        </header>

        {/* FEATURED 4 CARDS */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                data-ga="resource_card_open"
                data-ga-href={card.href}
                data-ga-title={card.title}
                data-ga-has-audio={card.hasAudio ? "1" : "0"}
                className={[
                  "group relative block rounded-3xl bg-white border shadow-warm overflow-hidden",
                  "transition-transform duration-200 hover:-translate-y-1",
                  card.accent === "saffron"
                    ? "border-saffron-500/40 hover:border-saffron-500"
                    : card.accent === "sindoor"
                      ? "border-sindoor-700/30 hover:border-sindoor-700"
                      : "border-gold-500/40 hover:border-gold-500",
                ].join(" ")}
              >
                {/* Audio chip — only on cards whose page ships an
                    `<audio>` recording. Pinned top-right so a quick
                    scan of the grid tells you which resources you can
                    listen to vs read-only. */}
                {card.hasAudio ? (
                  <span
                    aria-hidden
                    className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-saffron-500/45 bg-saffron-50 text-saffron-600 px-2 py-0.5 text-[0.55rem] font-mukta uppercase tracking-[0.22em] font-semibold"
                  >
                    <IconAudio /> Audio
                  </span>
                ) : null}

                <div className="px-6 pt-7 pb-6">
                  <p className="font-mukta uppercase tracking-[0.28em] text-gold-500 text-[0.65rem] inline-flex items-center gap-1.5">
                    {card.hasAudio
                      ? isHi
                        ? "पढ़ें · सुनें"
                        : "Read · Listen"
                      : isHi
                        ? "पढ़ें"
                        : "Read"}
                  </p>
                  <h2
                    className={`mt-3 font-fraunces font-semibold text-xl leading-tight ${
                      card.accent === "sindoor" ? "text-sindoor-700" : "text-ink-900"
                    }`}
                  >
                    {card.title}
                  </h2>
                  <p className="mt-2 text-sm text-ink-600 leading-relaxed">
                    {card.body}
                  </p>
                  <p
                    className={[
                      "mt-5 inline-flex items-center gap-1.5 font-medium text-sm",
                      card.accent === "saffron"
                        ? "text-saffron-600 group-hover:text-saffron-500"
                        : card.accent === "sindoor"
                          ? "text-sindoor-700"
                          : "text-gold-500",
                    ].join(" ")}
                  >
                    {card.hasAudio ? (
                      <span
                        aria-hidden
                        className="inline-flex items-center justify-center w-4 h-4"
                      >
                        <IconPlay />
                      </span>
                    ) : null}
                    {card.cta} <span aria-hidden>→</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* MARIGOLD DIVIDER */}
        <div className="flex justify-center my-12">
          <MarigoldDivider size={300} className="text-gold-500" />
        </div>

        {/* THIS WEEK IN LUCKNOW — dedicated news band with article
            previews. The featured story sits as a wide hero card on
            the left, the next three secondary stories stack on the
            right (or below on narrow viewports). Each card links out
            to its source publication. */}
        {featuredNews ? (
          <section className="mx-auto max-w-6xl px-4 sm:px-6">
            <header className="flex items-end justify-between gap-3 flex-wrap mb-6">
              <div>
                {/* Kicker reframed so it doesn't echo the headline ("This
                    week / This week in Lucknow"). "Editor's pick" reads
                    as the source of the curation, not a redundant date. */}
                <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
                  {isHi ? "संपादक चयन" : "Editor's pick"}
                </p>
                <h2
                  className={`mt-2 ${
                    isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
                  } text-2xl sm:text-3xl`}
                >
                  {t.resources.cards.news.title}
                </h2>
              </div>
              <Link
                href={`/resources/news${langSuffix}`}
                data-ga="resource_news_view_all"
                className="inline-flex items-center gap-1.5 text-sm text-saffron-600 hover:underline font-semibold"
              >
                {isHi ? "सभी ख़बरें देखें" : "View all news"}
                <span aria-hidden>→</span>
              </Link>
            </header>

            {/* `items-stretch` (grid default) + `h-full` on each child
                makes the featured column grow to match the total
                height of the secondary stack on the right. */}
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] items-stretch">
              {/* Featured story — hero card with image + headline + excerpt */}
              <a
                href={featuredNews.url}
                target="_blank"
                rel="noopener noreferrer"
                data-ga="resource_news_open"
                data-ga-id={featuredNews.id}
                data-ga-source={featuredNews.source}
                data-ga-featured="1"
                className="group flex h-full flex-col rounded-3xl bg-white border border-saffron-500/40 hover:border-saffron-500 shadow-warm overflow-hidden transition-colors"
              >
                {/* Image grows to fill the gap between the bottom of
                    the secondary stack and the natural height of the
                    headline + excerpt block. min-h-0 keeps the flex
                    item shrinkable on narrow viewports. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxiedNewsImage(featuredNews.image, 1200)}
                  alt={featuredNews.imageAlt ?? ""}
                  loading="lazy"
                  className="w-full flex-1 min-h-[200px] object-cover bg-saffron-50"
                />
                <div className="px-6 py-5">
                  <p className="font-mukta uppercase tracking-[0.22em] text-[0.62rem] text-saffron-600 font-semibold inline-flex items-center gap-2">
                    <span className="block w-1.5 h-1.5 rounded-full bg-saffron-600 motion-safe:animate-pulse" />
                    {isHi ? "प्रमुख ख़बर" : "Featured"}
                    <span aria-hidden className="text-gold-500/55">·</span>
                    <span className="text-ink-600 font-medium normal-case tracking-normal">
                      {featuredNews.source}
                    </span>
                  </p>
                  <h3 className="mt-2 font-fraunces font-semibold text-xl sm:text-2xl text-sindoor-700 leading-tight [text-wrap:balance]">
                    {isHi
                      ? (featuredNews.headlineHi ?? featuredNews.headline)
                      : featuredNews.headline}
                  </h3>
                  <p className="mt-2 text-sm text-ink-600 leading-relaxed line-clamp-3">
                    {isHi
                      ? (featuredNews.excerptHi ?? featuredNews.excerpt)
                      : featuredNews.excerpt}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-saffron-600 group-hover:gap-2 transition-all">
                    {isHi ? "स्रोत पर पढ़ें" : "Read on source"}
                    <span aria-hidden>→</span>
                  </p>
                </div>
              </a>

              {/* Three secondary stories, vertical stack. `h-full`
                  lets the column stretch alongside the featured card
                  in the grid; the equal `1fr` row split keeps each
                  thumbnail card the same height. */}
              <ol className="grid gap-3 h-full grid-rows-3">
                {secondaryNews.map((n) => (
                  <li key={n.id} className="min-h-0">
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-ga="resource_news_open"
                      data-ga-id={n.id}
                      data-ga-source={n.source}
                      className="group flex h-full gap-3 rounded-2xl bg-white border border-gold-500/40 hover:border-saffron-500 shadow-warm overflow-hidden transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proxiedNewsImage(n.image, 320)}
                        alt={n.imageAlt ?? ""}
                        loading="lazy"
                        className="shrink-0 w-24 sm:w-28 h-full min-h-[96px] object-cover bg-saffron-50"
                      />
                      <div className="min-w-0 flex-1 py-3 pr-3">
                        <p className="font-mukta uppercase tracking-[0.18em] text-[0.55rem] text-gold-500 font-semibold truncate">
                          {n.source}
                        </p>
                        <h3 className="mt-1 font-fraunces font-semibold text-sm sm:text-[15px] text-sindoor-700 leading-snug line-clamp-3 group-hover:underline decoration-saffron-500/70 underline-offset-2">
                          {isHi ? (n.headlineHi ?? n.headline) : n.headline}
                        </h3>
                      </div>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        {/* MARIGOLD DIVIDER */}
        <div className="flex justify-center my-12">
          <MarigoldDivider size={300} className="text-gold-500" />
        </div>

        {/* TEMPLES PROMO */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6">
          <Link
            href={`/resources/temples${langSuffix}`}
            className="block rounded-3xl bg-saffron-50 border border-gold-500/40 px-6 py-10 sm:px-10 sm:py-12 text-center hover:border-saffron-500 transition-colors"
          >
            {/* Temple icon — small saffron-tinted dome above the kicker
                so the section reads as "temples" before the text even
                resolves at a glance. */}
            <span
              aria-hidden
              className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cream-50 border border-saffron-500/45 text-saffron-600 mb-3"
            >
              <IconTemple />
            </span>
            <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
              {isHi ? "मंदिर निर्देशिका" : "Temples directory"}
            </p>
            <h2
              className={`mt-3 ${
                isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
              } text-2xl sm:text-3xl`}
            >
              {t.resources.cards.temples.title}
            </h2>
            <p className="mt-3 text-ink-600 max-w-2xl mx-auto">
              {t.resources.cards.temples.body}
            </p>
            <span className="mt-6 inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-5 py-2 transition-colors">
              {t.resources.cards.temples.cta} →
            </span>
          </Link>
        </section>

        {/* WHY THIS HUB EXISTS */}
        <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-16">
          <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
            {isHi ? "इस संग्रह के बारे में" : "About this hub"}
          </p>
          <h2
            className={`mt-3 ${
              isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
            } text-2xl sm:text-3xl`}
          >
            {isHi
              ? "श्रद्धेय पाठ; सत्यापित स्रोत।"
              : "Reverent text. Verified sources."}
          </h2>
          <ul className="mt-5 space-y-3 text-ink-900/90">
            <li className="flex items-start gap-3">
              <GadaBullet className="text-gold-500 mt-1 shrink-0" size={18} />
              <span>
                {isHi
                  ? "ऑडियो/वीडियो सत्यापित कलाकारों के आधिकारिक चैनलों से ही embed किए जाते हैं, हम कुछ भी पुनः-होस्ट नहीं करते।"
                  : "Audio and video are embedded from verified artists' official channels, we never re-host."}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <GadaBullet className="text-gold-500 mt-1 shrink-0" size={18} />
              <span>
                {isHi
                  ? "जो जानकारी अभी सत्यापन में है, उसे हम स्पष्ट रूप से ‘सत्यापन प्रतीक्षाधीन’ कहकर दिखाते हैं।"
                  : "Anything still being verified is clearly marked “Text being verified”. We won't paraphrase devotional text."}
              </span>
            </li>
          </ul>
        </section>
      </article>
    </>
  );
}

/**
 * Route every news thumbnail through the weserv.nl image proxy. Avoids
 * publisher hot-link blocks + Referer-policy CORS errors that would
 * otherwise leave broken-image icons on the hub. `weserv` expects the
 * URL without protocol, and `&we&output=webp` re-encodes for size.
 */
function proxiedNewsImage(src: string, width: number): string {
  if (!src) return "";
  const target = src.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(target)}&w=${width}&we&output=webp`;
}

/* ── Card icons (audio chip + inline play glyph) ───────────────────── */

function IconAudio() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M7 5v14l12-7z" />
    </svg>
  );
}

/** Temple — domed shrine with a flag on top, base steps below. Used
 *  on the Temples-directory promo card. */
function IconTemple() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Flag spire */}
      <path d="M12 2v3" />
      <path d="M12 2l2 1.5L12 5l-2-1.5L12 2z" fill="currentColor" />
      {/* Dome */}
      <path d="M5 12a7 7 0 0 1 14 0" />
      {/* Base + columns */}
      <path d="M3 12h18" />
      <path d="M5 12v8" />
      <path d="M19 12v8" />
      <path d="M3 20h18" />
      {/* Doorway */}
      <path d="M10 20v-4a2 2 0 1 1 4 0v4" />
    </svg>
  );
}
