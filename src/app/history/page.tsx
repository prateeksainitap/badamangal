import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  HISTORY,
  type Block,
  type SectionBlock,
  type OpeningBlock,
  type ClosingBlock,
  type PullQuoteBlock,
  type BannerBlock,
  type TimelineBlock,
  pickText,
  pickParas,
} from "@/content/history";
import type { Locale } from "@/content/strings";
import { LANG_COOKIE, resolveLocale } from "@/lib/i18n";
import { strings } from "@/content/strings";
import { MarigoldDivider, SunburstSpark } from "@/components/ornaments";
import AnimatedHeading from "@/components/AnimatedHeading";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "The story of Bada Mangal · बड़ा मंगल का इतिहास",
  description:
    "A 400-year Lucknow tradition: from a Begum's vow at the Aliganj temple in 1798 to the rare 2026 cycle of eight Bada Mangals. The full story of the city's biggest meal.",
  alternates: {
    canonical: "/history",
    languages: {
      "hi-IN": "/history",
      "en-IN": "/history?lang=en",
    },
  },
  openGraph: {
    title: "The story of Bada Mangal · बड़ा मंगल का इतिहास",
    description:
      "A 400-year Lucknow tradition. From a Begum's vow at the Aliganj temple to the rare 2026 cycle of eight Bada Mangals.",
    url: `${SITE_URL}/history`,
    type: "article",
    siteName: "BadaMangal",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "The story of Bada Mangal · बड़ा मंगल का इतिहास",
    description: "A 400-year Lucknow tradition, in eight chapters.",
  },
};

type SearchParams = Promise<{ lang?: string }>;

export default async function HistoryPage({
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

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "The story of Bada Mangal",
    description: metadata.description,
    inLanguage: ["en-IN", "hi-IN"],
    publisher: {
      "@type": "Organization",
      name: "BadaMangal.com",
      url: SITE_URL,
    },
    mainEntityOfPage: `${SITE_URL}/history`,
    image: `${SITE_URL}/history/opengraph-image`,
    dateModified: new Date().toISOString().slice(0, 10),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <article className="pb-24">
        {/* HERO */}
        <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-14 sm:pt-20 pb-10 text-center">
          <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
            {pickText(HISTORY.hero.kicker, locale)}
          </p>
          <AnimatedHeading
            as="h1"
            text={HISTORY.hero.hindiHeadline}
            lang="hi"
            className="mt-5 font-deva font-extrabold text-[1.85rem] sm:text-[2.65rem] leading-[1.2] text-sindoor-700 [text-wrap:balance] [word-break:keep-all]"
          />
          <p
            lang={isHi ? "hi" : "en"}
            className={[
              "mt-5 max-w-2xl mx-auto leading-snug text-xl sm:text-2xl",
              isHi
                ? "font-mukta text-ink-900"
                : "font-fraunces optical-display italic text-ink-900",
            ].join(" ")}
          >
            {pickText(HISTORY.hero.englishSubline, locale)}
          </p>
          <div className="mt-7 flex justify-center">
            <SunburstSpark size={48} className="text-gold-500" />
          </div>
        </header>

        {/* BLOCKS */}
        <div className="mx-auto px-4 sm:px-6">
          {HISTORY.blocks.map((block, idx) => {
            const next = HISTORY.blocks[idx + 1];
            const showDivider =
              block.kind === "section" &&
              next !== undefined &&
              next.kind !== "banner" &&
              next.kind !== "pull-quote" &&
              next.kind !== "timeline";

            return (
              <div key={idx}>
                {renderBlock(block, locale)}
                {showDivider ? (
                  <div className="mx-auto max-w-[68ch] flex justify-center my-12">
                    <MarigoldDivider size={300} className="text-gold-500" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* OUTRO CTAs */}
        <section className="mx-auto max-w-[68ch] px-4 sm:px-6 mt-14 grid gap-3 sm:grid-cols-2">
          <Link
            href={isHi ? "/#map" : "/?lang=en#map"}
            className="rounded-2xl border border-gold-500/40 bg-white shadow-warm px-6 py-5 hover:border-saffron-500 transition-colors block"
          >
            <p className="font-fraunces text-lg text-sindoor-700">
              {t.cta.findBhandara}
            </p>
            <p className="text-sm text-ink-600 mt-1">
              {pickText(HISTORY.outroCard.findBody, locale)}
            </p>
          </Link>
          <Link
            href={isHi ? "/list-bhandara" : "/list-bhandara?lang=en"}
            className="rounded-2xl border border-gold-500/40 bg-white shadow-warm px-6 py-5 hover:border-saffron-500 transition-colors block"
          >
            <p className="font-fraunces text-lg text-sindoor-700">
              {t.cta.listBhandara}
            </p>
            <p className="text-sm text-ink-600 mt-1">
              {pickText(HISTORY.outroCard.listBody, locale)}
            </p>
          </Link>
        </section>
      </article>
    </>
  );
}

// ── Renderers ────────────────────────────────────────────────────────────

function renderBlock(block: Block, locale: Locale): React.ReactNode {
  switch (block.kind) {
    case "opening":
      return <Opening block={block} locale={locale} />;
    case "section":
      return <Section block={block} locale={locale} />;
    case "pull-quote":
      return <PullQuote block={block} locale={locale} />;
    case "banner":
      return <Banner block={block} locale={locale} />;
    case "timeline":
      return <Timeline block={block} locale={locale} />;
    case "closing":
      return <Closing block={block} locale={locale} />;
  }
}

function proseClass(locale: Locale): string {
  // English prose runs in Fraunces (editorial); Hindi runs in Mukta which
  // is body-friendly for Devanagari at long-form sizes.
  return locale === "hi"
    ? "font-mukta text-[1.18rem] sm:text-[1.22rem] leading-[1.85] text-ink-900"
    : "font-fraunces text-[1.125rem] sm:text-[1.18rem] leading-[1.75] text-ink-900";
}

function Opening({ block, locale }: { block: OpeningBlock; locale: Locale }) {
  const isHi = locale === "hi";
  return (
    <section className="mx-auto max-w-[68ch] mt-6" lang={isHi ? "hi" : "en"}>
      {pickParas(block.paragraphs, locale).map((p, i) => (
        <p
          key={i}
          className={[
            isHi
              ? "font-mukta text-[1.18rem] sm:text-[1.22rem] leading-[1.85] text-ink-900"
              : "font-fraunces text-[1.18rem] sm:text-[1.22rem] leading-[1.7] text-ink-900",
            // Drop cap only renders cleanly on Latin scripts; skip for Hindi.
            i === 0 && !isHi ? "drop-cap" : "mt-5",
            i === 0 && isHi ? "" : "",
          ].join(" ")}
        >
          {p}
        </p>
      ))}
    </section>
  );
}

function Section({ block, locale }: { block: SectionBlock; locale: Locale }) {
  const isHi = locale === "hi";
  return (
    <section
      id={block.id}
      className="mx-auto max-w-[68ch] scroll-mt-24"
      lang={isHi ? "hi" : "en"}
    >
      <header className="mb-6 mt-8">
        <p className="font-mukta uppercase tracking-[0.3em] text-gold-500 text-[0.7rem]">
          {pickText(HISTORY.chapterLabel, locale)}{" "}
          {String(block.number).padStart(2, "0")}
        </p>
        <h2
          className={[
            "mt-2 font-semibold leading-[1.2] text-sindoor-700 text-[1.85rem] sm:text-[2.25rem] [text-wrap:balance]",
            isHi ? "font-deva [word-break:keep-all]" : "font-fraunces",
          ].join(" ")}
        >
          {pickText(block.heading, locale)}
        </h2>
      </header>
      <div className="space-y-5">
        {pickParas(block.paragraphs, locale).map((p, i) => (
          <p key={i} className={proseClass(locale)}>
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

function PullQuote({ block, locale }: { block: PullQuoteBlock; locale: Locale }) {
  const isHi = locale === "hi";
  return (
    <section className="my-16">
      <div className="mx-auto max-w-4xl px-2">
        <blockquote className="border-l-4 border-gold-500 pl-6 sm:pl-10">
          <p
            lang={isHi ? "hi" : "en"}
            className={[
              "text-[1.75rem] sm:text-[2rem] leading-[1.4] text-ink-900 [text-wrap:balance]",
              isHi
                ? "font-deva font-medium"
                : "font-cormorant italic font-medium",
            ].join(" ")}
          >
            “{pickText(block.text, locale)}”
          </p>
        </blockquote>
      </div>
    </section>
  );
}

function Banner({ block, locale }: { block: BannerBlock; locale: Locale }) {
  return (
    <figure className="my-14 -mx-4 sm:-mx-6 lg:mx-0 lg:max-w-5xl lg:mx-auto">
      <div className="relative w-full aspect-[16/9] bg-saffron-50 border-y lg:border lg:rounded-3xl border-gold-500/40 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.src}
          alt={pickText(block.alt, locale)}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      {block.caption ? (
        <figcaption className="mt-3 text-center font-mukta text-xs uppercase tracking-[0.3em] text-ink-600">
          {pickText(block.caption, locale)}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Timeline({ block, locale }: { block: TimelineBlock; locale: Locale }) {
  return (
    <section className="my-16">
      <div className="mx-auto max-w-5xl px-2">
        <p className="text-center font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs mb-8">
          {pickText(block.kicker, locale)}
        </p>

        {/* Desktop: horizontal row */}
        <ol className="hidden md:grid grid-cols-5 gap-4 relative">
          <div
            aria-hidden
            className="absolute left-[10%] right-[10%] top-7 h-px bg-gold-500/40"
          />
          {block.markers.map((m) => (
            <li
              key={m.year}
              className="relative flex flex-col items-center text-center"
            >
              <TimelineNode highlight={m.highlight} />
              <p className="mt-4 font-numerals font-bold text-xl text-sindoor-700 tabular-nums">
                {m.year}
              </p>
              <p className="mt-2 text-sm text-ink-900/85 leading-snug">
                {pickText(m.body, locale)}
              </p>
            </li>
          ))}
        </ol>

        {/* Mobile: vertical chain */}
        <ol className="md:hidden relative pl-12">
          <div
            aria-hidden
            className="absolute left-5 top-2 bottom-2 w-px bg-gold-500/40"
          />
          {block.markers.map((m) => (
            <li key={m.year} className="relative pb-8 last:pb-0">
              <div className="absolute -left-12 top-0">
                <TimelineNode highlight={m.highlight} small />
              </div>
              <p className="font-numerals font-bold text-lg text-sindoor-700 tabular-nums">
                {m.year}
              </p>
              <p className="mt-1 text-sm text-ink-900/85 leading-snug">
                {pickText(m.body, locale)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function TimelineNode({
  highlight = false,
  small = false,
}: {
  highlight?: boolean;
  small?: boolean;
}) {
  const dim = small ? 40 : 56;
  return (
    <div
      className={[
        "relative inline-flex items-center justify-center rounded-full border-2 shadow-warm",
        highlight
          ? "bg-saffron-50 border-saffron-600"
          : "bg-cream-50 border-gold-500",
      ].join(" ")}
      style={{ width: dim, height: dim }}
    >
      <SunburstSpark
        size={small ? 26 : 36}
        className={highlight ? "text-saffron-600" : "text-gold-500"}
      />
      {highlight ? (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full ring-4 ring-saffron-500/25"
        />
      ) : null}
    </div>
  );
}

function Closing({ block, locale }: { block: ClosingBlock; locale: Locale }) {
  const isHi = locale === "hi";
  return (
    <section className="mx-auto max-w-[68ch] mt-12" lang={isHi ? "hi" : "en"}>
      <div className="space-y-5">
        {pickParas(block.paragraphs, locale).map((p, i) => (
          <p key={i} className={proseClass(locale)}>
            {p}
          </p>
        ))}
      </div>
      <div className="mt-12 flex flex-col items-center gap-4">
        <MarigoldDivider size={280} className="text-gold-500" />
        <p className="font-tiro text-xl sm:text-2xl text-sindoor-700 text-center">
          {block.benediction}
        </p>
      </div>
    </section>
  );
}
