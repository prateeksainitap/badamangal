"use client";

import Link from "next/link";
import { strings } from "@/content/strings";
import {
  MarigoldDivider,
  GadaBullet,
  SunburstSpark,
} from "@/components/ornaments";
import AnimatedHeading from "@/components/AnimatedHeading";
import { FAQ_ITEMS } from "@/content/faq";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * /resources hub body, extracted out of the server-rendered page so
 * every label (hub kicker / heading / body, six resource cards' titles
 * + bodies + CTAs + "Read · Listen" pills, news section heading +
 * "Editor's pick" + "View all news" CTA, temples promo, "About this hub"
 * + verified-sources bullets) swaps on the Hindi toggle.
 *
 * Page-level JSON-LD stays in the server wrapper because it doesn't
 * need to swap with locale.
 */
export default function ResourcesHubView() {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

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
    // News intentionally omitted from the canonical-text card grid;
    // the dedicated news section that used to live further down was
    // removed (sources unreliable enough to keep on a primary nav).
    // The /resources/news page still exists for direct-URL access
    // but is no longer linked from the hub or the footer.
    {
      href: `/resources/rituals${langSuffix}`,
      title: t.resources.cards.rituals.title,
      body: t.resources.cards.rituals.body,
      cta: t.resources.cards.rituals.cta,
      accent: "gold",
      hasAudio: false,
    },
  ];

  // Top 3 FAQ items used as a teaser band that links out to the
  // full /faq page. Read from the shared bilingual source so the
  // hub teaser and the dedicated FAQ surface stay in sync.
  const teaserFaqs = FAQ_ITEMS.slice(0, 3);

  return (
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
              {/* Audio chip, only on cards whose page ships an
                  `<audio>` recording. Pinned top-right so a quick
                  scan of the grid tells you which resources you can
                  listen to vs read-only. */}
              {card.hasAudio ? (
                <span
                  aria-hidden
                  className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-saffron-500/45 bg-saffron-50 text-saffron-600 px-2 py-0.5 text-[0.55rem] font-mukta uppercase tracking-[0.22em] font-semibold"
                >
                  <IconAudio /> {isHi ? "ऑडियो" : "Audio"}
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

      {/* FAQ TEASER — the dedicated news band that used to live here
          was removed; this band replaces it with a 3-question preview
          of the FAQ page (full bilingual accordion + JSON-LD live
          at /faq). Same editorial registration as the news header
          before it. */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6">
        <header className="flex items-end justify-between gap-3 flex-wrap mb-6">
          <div>
            <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
              {isHi ? "पूछे जाने वाले प्रश्न" : "Frequently asked"}
            </p>
            <h2
              className={`mt-2 ${
                isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
              } text-2xl sm:text-3xl`}
            >
              {isHi
                ? "बड़े मंगल के बारे में आम सवाल"
                : "Common questions about Bada Mangal"}
            </h2>
          </div>
          <Link
            href={langSuffix === "" ? "/faq" : `/faq${langSuffix}`}
            className="inline-flex items-center gap-1.5 text-sm text-saffron-600 hover:underline font-semibold"
          >
            {isHi ? "सभी FAQ देखें" : "View all FAQs"}
            <span aria-hidden>→</span>
          </Link>
        </header>

        <ul className="grid gap-3">
          {teaserFaqs.map((item, i) => (
            <li key={item.id}>
              <details
                className="group rounded-2xl border border-gold-500/40 bg-white hover:border-saffron-500/60 overflow-hidden transition-colors"
                {...(i === 0 ? { open: true } : {})}
              >
                <summary className="cursor-pointer list-none flex items-start justify-between gap-3 px-5 py-4 text-left">
                  <span
                    className={`flex-1 ${
                      isHi
                        ? "font-deva font-semibold text-base sm:text-lg"
                        : "font-fraunces font-semibold text-base sm:text-lg"
                    } text-sindoor-700 leading-snug`}
                  >
                    {isHi ? item.questionHi : item.questionEn}
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-saffron-50 border border-saffron-500/45 text-saffron-600 text-sm font-bold mt-0.5 group-open:rotate-45 transition-transform"
                  >
                    +
                  </span>
                </summary>
                <div className="px-5 pb-5 pt-1 text-ink-900/85 text-sm sm:text-base leading-relaxed [text-wrap:pretty]">
                  {isHi ? item.answerHi : item.answerEn}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

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
          {/* Temple icon, small saffron-tinted dome above the kicker
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
  );
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

/** Temple, domed shrine with a flag on top, base steps below. Used
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
