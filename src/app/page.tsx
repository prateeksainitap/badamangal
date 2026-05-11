import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  SITE_URL,
  eventSchemaBatch,
  faqSchema,
  localised,
  organizationSchema,
  websiteSchema,
} from "@/lib/seo";
import { ALL_TUESDAY_ISO } from "@/lib/dates";
import AnimatedHeading from "@/components/AnimatedHeading";
import BhandaraCardsSection from "@/components/BhandaraCardsSection";
import HappeningNow from "@/components/HappeningNow";
import MapBoard from "@/components/MapBoard";
import CountdownTimer from "@/components/CountdownTimer";
import LiveFeedMarquee from "@/components/LiveFeedMarquee";
import MaharajjiBlessing from "@/components/MaharajjiBlessing";
import SeasonTimeline from "@/components/SeasonTimeline";
import StatsSection from "@/components/StatsSection";
import FamousBhandaras from "@/components/FamousBhandaras";
import { MarigoldDivider } from "@/components/ornaments";
import { strings } from "@/content/strings";
import { prisma, toBhandara } from "@/lib/db";
import { LANG_COOKIE, resolveLocale } from "@/lib/i18n";
import { getHomepageStats } from "@/lib/stats";
import {
  BADA_MANGAL_DATES_2026,
  formatEnglishDate,
  formatHindiDate,
  hasUpcomingDate,
  nextBadaMangal,
} from "@/lib/dates";

type SearchParams = Promise<{ lang?: string }>;

export const dynamic = "force-dynamic";

// Homepage-specific metadata. Overrides the layout default with a
// keyword-rich title + description that targets the queries we want
// to win: "bada mangal lucknow", "bhandara lucknow", "hanuman bhandara
// 2026", "8 tuesdays jyeshtha", and the bilingual variants.
export const metadata: Metadata = {
  title: "Bada Mangal Lucknow 2026, every bhandara on one map",
  description:
    "The only directory of every Bada Mangal bhandara in Lucknow. 2026's rare 8-Tuesday Jyeshtha season, find a bhandara near you, list yours, sponsor a thali. लखनऊ के बड़े मंगल भंडारों का घर।",
  keywords: [
    "bada mangal",
    "bada mangal 2026",
    "bada mangal lucknow",
    "bhandara lucknow",
    "hanuman bhandara",
    "jyeshtha tuesdays",
    "8 bada mangal",
    "बड़ा मंगल",
    "बड़ा मंगल लखनऊ",
    "हनुमान भंडारा",
  ],
  alternates: localised("/"),
  openGraph: {
    title: "Bada Mangal Lucknow 2026, every bhandara on one map",
    description:
      "The directory of every Bada Mangal bhandara in Lucknow during the rare 8-Tuesday Jyeshtha season. Find, list, sponsor, spot.",
    url: SITE_URL,
    siteName: "BadaMangal",
    locale: "en_IN",
    alternateLocale: "hi_IN",
    type: "website",
  },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const c = await cookies();
  const locale = resolveLocale({
    urlLang: params.lang,
    cookieLang: c.get(LANG_COOKIE)?.value,
  });
  const t = strings[locale];
  const isHi = locale === "hi";

  const records = await prisma.bhandara.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ isSponsored: "desc" }, { createdAt: "asc" }],
  });
  // Auto-delist bhandaras whose every service date has passed (IST
  // calendar boundary). The DB row stays APPROVED so admins still
  // see it in /admin and historical /bhandara/[slug] links keep
  // working; only the public map + counters trim to what's still
  // upcoming. As the calendar advances, rows drop off this list
  // organically — no cron, no manual flips, no data loss.
  const listings = records.map(toBhandara).filter((b) => hasUpcomingDate(b));
  const stats = await getHomepageStats();

  // Pick the Tuesday this rule under the hero refers to.
  // - If today (IST) is itself a Bada Mangal Tuesday, surface it as "Today".
  // - Else show the next upcoming one.
  // - Once the season is over (no upcoming dates), fall back to a quiet
  //   season-complete line so we never show a stale 2026 date.
  const now = new Date();
  const istTodayIso = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const todayIsBadaMangal = BADA_MANGAL_DATES_2026.find(
    (d) => d.toISOString().slice(0, 10) === istTodayIso,
  );
  const upcomingBadaMangal = todayIsBadaMangal ?? nextBadaMangal(now);
  const seasonOver = !upcomingBadaMangal;
  const tuesdayKicker = todayIsBadaMangal
    ? isHi
      ? "आज"
      : "Today"
    : isHi
      ? "अगला मंगल"
      : "Next Tuesday";
  const tuesdayLine = seasonOver
    ? isHi
      ? "इस वर्ष के सभी आठ बड़े मंगल पूर्ण। जय हनुमान।"
      : "This year's eight Bada Mangals are complete. Jai Hanuman."
    : isHi
      ? `${formatHindiDate(upcomingBadaMangal)}, सुबह से शाम तक, शहर भर के द्वार खुले रहेंगे।`
      : `${formatEnglishDate(upcomingBadaMangal)}, gates open across the city, dawn to dusk.`;

  // Live "spots", crowd-sourced sightings of bhandaras happening right now
  // (auto-expire after 8 hours).
  const spotRecords = await prisma.spot.findMany({
    where: { status: "APPROVED", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 24,
    include: {
      bhandara: { select: { slug: true, name: true, nameHi: true } },
    },
  });
  const liveSpots = spotRecords.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    area: s.area,
    address: s.address,
    photoUrl: s.photoUrl,
    caption: s.caption,
    reporterName: s.reporterName,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: s.bhandara?.name ?? null,
    bhandaraNameHi: s.bhandara?.nameHi ?? null,
  }));

  // Live feed initial payload — active spots only. The Post model
  // (per-bhandara comments) was removed, so the marquee + /live feed
  // now mirror just the crowd-sourced spots stream.
  const feedInitial = spotRecords
    .map((s) => ({
      id: `spot:${s.id}`,
      bhandaraSlug: s.bhandara?.slug ?? null,
      bhandaraName: s.bhandara?.name ?? null,
      authorName: s.reporterName?.trim() || (isHi ? "स्पॉटर" : "Spotter"),
      text: s.caption,
      photoUrl: s.photoUrl,
      language: s.language,
      createdAt: s.createdAt.toISOString(),
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 18);

  // JSON-LD bundle for the homepage. WebSite + Organization anchor
  // the brand for Google's knowledge panel; the 8 Event entries seed
  // the events carousel for "bada mangal 2026" searches.
  const jsonLdBlocks = [
    websiteSchema(),
    organizationSchema(),
    // FAQPage targets "People also ask" SERP boxes for high-intent
    // Bada Mangal queries ("what is bada mangal", "why 8 tuesdays
    // 2026", "next bada mangal lucknow"). Pure top-of-search real
    // estate when Google decides to render it.
    faqSchema(),
    ...eventSchemaBatch(ALL_TUESDAY_ISO),
  ];

  return (
    <>
      {/* JSON-LD structured data — embedded inline so search-engine
          crawlers (which usually don't run client JS) see them on
          first paint. */}
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      {/* HERO, editorial cream layout with the commissioned Hanuman Ji
          illustration anchoring the right. Replaces the flat saffron band
          with a layered cream-paper composition. */}
      <section className="relative isolate overflow-hidden">
        {/* Soft saffron radial glow behind the right column */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(900px 600px at 78% 35%, rgba(242,148,76,0.22), transparent 60%), radial-gradient(720px 480px at 12% 110%, rgba(156,42,42,0.10), transparent 60%)",
          }}
        />
        {/* Faint gold rule at the very top of the band */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent"
        />

        {/* Soft fade at the bottom edge so the cut-off where the
            illustration ends doesn't read as abrupt — a thin band of
            warm shadow tapers into the cream paper of the next
            section. Sits on top of the background but below content. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24 sm:h-32 -z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(156,42,42,0.06) 60%, rgba(26,20,16,0.10) 100%)",
          }}
        />
        {/* And a faint gold rule mirroring the top, anchoring the
            bottom edge of the hero band visually. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent"
        />

        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-0 sm:pt-20 sm:pb-0">
          <div className="grid gap-10 lg:gap-14 lg:grid-cols-12 items-center">
            {/* Left 7/12: text, centred on mobile, left-aligned on desktop. */}
            <div className="lg:col-span-6 text-ink-900 text-center lg:text-left">
              {/* Devotional benediction, wraps cleanly on narrow screens. */}
              <div className="mb-5 flex items-center gap-2 sm:gap-3 max-w-md mx-auto lg:mx-0">
                <span className="h-px flex-1 bg-gold-500/45" />
                <p className="font-tiro text-base sm:text-xl text-sindoor-700 text-center">
                  ॥ जय श्री राम · जय हनुमान ॥
                </p>
                <span className="h-px flex-1 bg-gold-500/45" />
              </div>

              {/* Eyebrow with brand mark */}
              <div className="inline-flex items-center gap-2.5 sm:gap-3 rounded-full border border-gold-500/45 bg-cream-50/70 backdrop-blur px-3 py-1.5 shadow-warm">
                <span className="block w-2 h-2 rounded-full bg-saffron-600 motion-safe:animate-pulse" />
                <span className="font-mukta font-semibold uppercase tracking-[0.22em] text-[0.65rem] sm:text-[0.8rem] text-sindoor-700">
                  {isHi
                    ? "बड़ा मंगल · लखनऊ · 2026"
                    : "Bada Mangal · Lucknow · 2026"}
                </span>
              </div>

              <AnimatedHeading
                as="h1"
                text="जहाँ भक्ति, वहाँ भंडारा"
                lang="hi"
                className="mt-5 sm:mt-6 font-mukta font-extrabold text-[2rem] sm:text-[3rem] lg:text-[4rem] leading-[1.05] tracking-tight text-sindoor-700 [text-wrap:balance]"
              />

              <p className="mt-5 sm:mt-6 max-w-xl mx-auto lg:mx-0 text-ink-900/85 text-base sm:text-lg leading-relaxed">
                {isHi
                  ? "हर मंगलवार लखनऊ एक बड़ी रसोई बन जाता है। इस दुर्लभ 8-मंगल वर्ष में, हर भंडारा एक नक़्शे पर।"
                  : "Every Tuesday of Jyeshtha, Lucknow becomes one giant kitchen. In this rare 8-Tuesday year, every bhandara on one map."}
              </p>

              {/* Hero CTAs — both pinned to the same min-width so the
                  primary sindoor pill and the secondary ghost pill read
                  as a balanced pair. Each carries a leading glyph that
                  matches its action (magnifier for find, plus-circle
                  for add). On mobile the row stays centred and the
                  buttons keep equal width via `w-[240px]` so they
                  align in a single column when wrap kicks in. */}
              <div className="mt-7 sm:mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
                <Link
                  href="#map"
                  className="btn btn-sindoor btn-lg w-[240px] justify-center gap-2"
                  data-ga="cta_hero_find_bhandara"
                  data-ga-source="hero"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  {t.cta.findBhandara}
                </Link>
                <Link
                  href="/list-bhandara"
                  className="btn btn-ghost btn-lg w-[240px] justify-center gap-2"
                  data-ga="cta_hero_list_bhandara"
                  data-ga-source="hero"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v8" />
                    <path d="M8 12h8" />
                  </svg>
                  {t.cta.listBhandara}
                </Link>
              </div>

              {/* Marigold rule under the CTAs */}
              <div className="mt-8 flex items-center gap-3 max-w-md mx-auto lg:mx-0">
                <span className="h-px flex-1 bg-gold-500/40" />
                <span className="text-[0.62rem] sm:text-[0.65rem] uppercase tracking-[0.28em] sm:tracking-[0.32em] text-gold-500 font-medium">
                  {tuesdayKicker}
                </span>
                <span className="h-px flex-1 bg-gold-500/40" />
              </div>
              <p className="mt-3 text-sm text-ink-600 max-w-md mx-auto lg:mx-0">
                {tuesdayLine}
              </p>
            </div>

            {/* Right 5/12: real Hanuman Ji illustration */}
            <div className="lg:col-span-6">
              <HeroIllustrationFrame />
            </div>
          </div>
        </div>
      </section>

      {/* COUNTDOWN + 8-MANGAL TIMELINE
          Hierarchy rebuild: the previous version had a giant
          "8 Bada Mangals in 2026: the rarest cycle in 19 years"
          heading + body + two fact-pills competing for attention
          with the countdown, the "Today is" banner, the date pill,
          and the timeline. Seven focal points, all visually loud.
          The rare-cycle framing is *interesting context* but not
          *actionable info* — the actionable bits are "today is
          happening" (live days) and "countdown to next" (other days).
          So: rare-cycle is compressed into a single subtle kicker
          line above the date pill, and everything actionable
          (banner, date pill, timer, timeline) gets to breathe. */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="rounded-3xl border border-gold-500/40 bg-cream-50 px-6 py-10 sm:px-10 sm:py-12">
          {/* Countdown to the next Bada Mangal (or, on a Bada Mangal
              day itself, a big "Today is the Nth" headline + timer
              for the *next* one). The rare-cycle trivia line was
              pulled out of this band and folded into the SeasonTimeline
              kicker below — keeps the rarity context near the eight
              dots that illustrate it, instead of duplicating focal
              points at the top of the section. */}
          <CountdownTimer />

          {/* 8-Mangal timeline + the rare-cycle subtitle */}
          <SeasonTimeline locale={locale} />
        </div>
      </section>

      {/* MAP + side list — promoted up so primary discovery happens
          immediately after the season-context band. The MapBoard wraps
          the filter pills, Leaflet markers and side list so they always
          render off the same filtered slice. */}
      <MapBoard
        locale={locale}
        isHi={isHi}
        heading={t.map.sectionHeading}
        body={t.map.sectionBody}
        listBhandaraLabel={t.cta.listBhandara}
        listings={listings}
        liveSpots={liveSpots.map((s) => ({
          id: s.id,
          lat: s.lat,
          lng: s.lng,
          area: s.area,
          caption: s.caption,
          photoUrl: s.photoUrl,
          createdAt: s.createdAt,
          bhandaraSlug: s.bhandaraSlug,
          bhandaraName: s.bhandaraName,
          bhandaraNameHi: s.bhandaraNameHi,
        }))}
      />

      {/* HAPPENING NOW — crowd-sourced live spots, sits right under
          the map so the urgency layer reads as an overlay on top of
          the discovery surface. */}
      <HappeningNow initial={liveSpots} locale={locale} />

      {/* CARDS, equal-height grid with filters */}
      {listings.length > 0 ? (
        <BhandaraCardsSection
          listings={listings}
          locale={locale}
          heading={t.cards.sectionHeading}
          isHi={isHi}
        />
      ) : (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
          <h2
            className={`text-2xl sm:text-3xl ${
              isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
            }`}
          >
              {t.cards.sectionHeading}
          </h2>
          <div className="mt-8 rounded-3xl border border-gold-500/40 bg-saffron-50 px-6 py-10 sm:py-14 grid gap-6 sm:grid-cols-[200px_1fr] items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/illustrations/empty-state-plate.png"
              alt=""
              loading="lazy"
              decoding="async"
              className="mx-auto w-40 sm:w-48 aspect-square object-contain"
            />
            <div>
              <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
                {isHi ? "अभी कोई भंडारा नहीं" : "No bhandaras yet"}
              </p>
              <h3
                className={`mt-2 ${
                  isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
                } text-2xl`}
              >
                {isHi
                  ? "थाली तैयार है, बस सेवक की प्रतीक्षा है।"
                  : "The plate is set. We're waiting for the first sevak."}
              </h3>
              <p className="mt-2 text-ink-600 max-w-xl">
                {isHi
                  ? "अपना भंडारा सबसे पहले सूचीबद्ध करें, यह रसोई आप ही से शुरू होगी।"
                  : "List your bhandara first, this kitchen begins with you."}
              </p>
              <Link
                href={`/list-bhandara${isHi ? "" : "?lang=en"}`}
                data-ga="cta_empty_list_bhandara"
                data-ga-source="cards_empty"
                className="btn btn-primary btn-sm mt-5 inline-flex items-center gap-2"
              >
                {t.cta.listBhandara}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* FAMOUS BHANDARAS — curated landmark venues. Sits below the
          listed-bhandaras grid so visitors first see what organisers
          have actually submitted, then the city-wide landmark anchors. */}
      <FamousBhandaras locale={locale} isHi={isHi} />

      {/* RESOURCES TEASER — moved up the page so the strongest editorial
          surface is reachable without a marathon scroll. Now four cards
          (Chalisa, Aarti, Ashtak, Bajrang Baan), the four texts that
          have audio + dedicated pages today. */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-7 text-center">
          <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
            {t.resources.hubKicker}
          </p>
          <h2
            className={`mt-3 ${
              isHi
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-bold text-sindoor-700"
            } text-3xl sm:text-4xl`}
          >
            {t.resources.hubHeading}
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={`/resources/chalisa${isHi ? "" : "?lang=en"}`}
            className="group rounded-3xl bg-white border border-saffron-500/40 hover:border-saffron-500 shadow-warm px-6 py-7 transition-colors block"
          >
            <p className="font-mukta uppercase tracking-[0.28em] text-saffron-600 text-[0.65rem]">
              {isHi ? "पढ़ें · सुनें" : "Read · listen"}
            </p>
            <h3 className="mt-3 font-fraunces font-semibold text-xl text-sindoor-700">
              {t.resources.cards.chalisa.title}
            </h3>
            <p className="mt-2 text-sm text-ink-600">
              {t.resources.cards.chalisa.body}
            </p>
            <p className="mt-5 inline-flex items-center gap-1.5 text-saffron-600 font-medium text-sm">
              {t.resources.cards.chalisa.cta} <span aria-hidden>→</span>
            </p>
          </Link>
          <Link
            href={`/resources/aarti${isHi ? "" : "?lang=en"}`}
            className="group rounded-3xl bg-white border border-sindoor-700/30 hover:border-sindoor-700 shadow-warm px-6 py-7 transition-colors block"
          >
            <p className="font-mukta uppercase tracking-[0.28em] text-sindoor-700 text-[0.65rem]">
              {isHi ? "पढ़ें · सुनें" : "Read · listen"}
            </p>
            <h3 className="mt-3 font-fraunces font-semibold text-xl text-sindoor-700">
              {t.resources.cards.aarti.title}
            </h3>
            <p className="mt-2 text-sm text-ink-600">
              {t.resources.cards.aarti.body}
            </p>
            <p className="mt-5 inline-flex items-center gap-1.5 text-sindoor-700 font-medium text-sm">
              {t.resources.cards.aarti.cta} <span aria-hidden>→</span>
            </p>
          </Link>
          <Link
            href={`/resources/ashtak${isHi ? "" : "?lang=en"}`}
            className="group rounded-3xl bg-white border border-saffron-500/40 hover:border-saffron-500 shadow-warm px-6 py-7 transition-colors block"
          >
            <p className="font-mukta uppercase tracking-[0.28em] text-saffron-600 text-[0.65rem]">
              {isHi ? "पढ़ें · सुनें" : "Read · listen"}
            </p>
            <h3 className="mt-3 font-fraunces font-semibold text-xl text-sindoor-700">
              {t.resources.cards.ashtak.title}
            </h3>
            <p className="mt-2 text-sm text-ink-600">
              {t.resources.cards.ashtak.body}
            </p>
            <p className="mt-5 inline-flex items-center gap-1.5 text-saffron-600 font-medium text-sm">
              {t.resources.cards.ashtak.cta} <span aria-hidden>→</span>
            </p>
          </Link>
          <Link
            href={`/resources/bajrang-baan${isHi ? "" : "?lang=en"}`}
            className="group rounded-3xl bg-white border border-sindoor-700/30 hover:border-sindoor-700 shadow-warm px-6 py-7 transition-colors block"
          >
            <p className="font-mukta uppercase tracking-[0.28em] text-sindoor-700 text-[0.65rem]">
              {isHi ? "पढ़ें · सुनें" : "Read · listen"}
            </p>
            <h3 className="mt-3 font-fraunces font-semibold text-xl text-sindoor-700">
              {t.resources.cards.bajrangBaan.title}
            </h3>
            <p className="mt-2 text-sm text-ink-600">
              {t.resources.cards.bajrangBaan.body}
            </p>
            <p className="mt-5 inline-flex items-center gap-1.5 text-sindoor-700 font-medium text-sm">
              {t.resources.cards.bajrangBaan.cta} <span aria-hidden>→</span>
            </p>
          </Link>
        </div>
        <div className="mt-7 text-center">
          <Link
            href={`/resources${isHi ? "" : "?lang=en"}`}
            className="inline-flex items-center text-sm text-ink-600 hover:text-saffron-600 transition-colors"
          >
            {isHi ? "सभी संसाधन देखें" : "View all resources"} →
          </Link>
        </div>
      </section>

      {/* LIVE FEED MARQUEE — moved below resources; renders an empty
          state band when there are <3 entries instead of disappearing. */}
      <LiveFeedMarquee initial={feedInitial} />

      {/* STATS — demoted to here. Vanity numbers feel right after the
          editorial + live content rather than interrupting the discovery
          flow. Tiles with value 0 are hidden so the panel doesn't read
          as empty on a quiet day. */}
      <StatsSection stats={stats} locale={locale} />

      {/* MARIGOLD DIVIDER */}
      <div className="flex justify-center my-4">
        <MarigoldDivider size={320} className="text-gold-500" />
      </div>

      {/* HISTORY TEASER */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="rounded-3xl bg-saffron-50 border border-gold-500/40 px-6 py-10 sm:px-10 sm:py-14 text-center">
          <h2
            className={`text-3xl sm:text-4xl ${
              isHi
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-bold text-sindoor-700"
            }`}
          >
            {t.history.teaserHeading}
          </h2>
          <p className="mt-3 text-ink-600 max-w-2xl mx-auto">
            {t.history.teaserBody}
          </p>
          <Link
            href="/history"
            className="mt-6 inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-5 py-2 transition-colors"
          >
            {t.history.readMore} →
          </Link>
        </div>
      </section>

      {/* CLOSING BENEDICTION */}
      <section
        aria-label="Benediction"
        className="relative mx-auto max-w-3xl px-4 sm:px-6 pt-2 pb-16 sm:pb-20 text-center"
      >
        <div className="flex items-center justify-center gap-3 text-gold-500">
          <span className="block h-px w-16 sm:w-24 bg-gradient-to-r from-transparent to-gold-500/60" />
          <span aria-hidden className="text-xl">🪔</span>
          <span className="block h-px w-16 sm:w-24 bg-gradient-to-l from-transparent to-gold-500/60" />
        </div>
        <p className="mt-5 font-tiro text-2xl sm:text-4xl text-sindoor-700 leading-tight">
          ॥ जय श्री राम · जय हनुमान ॥
        </p>
        {/* English transliteration of the slogan above. Promoted from
            a muted italic caption to a bold sindoor headline so it
            matches the editorial "section heading" family used across
            the page — feels like a benediction, not a footnote. */}
        <p className="mt-3 font-fraunces font-bold text-3xl sm:text-4xl text-sindoor-700">
          Jai Shri Ram &middot; Jai Hanuman
        </p>
        <p className="mt-4 max-w-xl mx-auto text-sm text-ink-600 leading-relaxed">
          {isHi
            ? "बजरंगबली की कृपा से हर थाली शुभ हो, हर हाथ सेवा में लगे।"
            : "May Hanuman Ji bless every plate served and every hand that serves."}
        </p>

        {/* Maharajji medallion. Hover the portrait to wake the gold
            spirals and hear the Maharajji-Ram-Ram aarti chant. */}
        <MaharajjiBlessing />
      </section>
    </>
  );
}

function HeroIllustrationFrame() {
  // Two-layer composition:
  //   1. Ram-name halo SVG, slowly rotating behind the figure's head
  //   2. Hanuman Ji illustration on top (transparent PNG)
  // Both float directly on the page paper — no card, no border,
  // no vignette. The halo is sized + positioned so its centre sits
  // roughly behind the painted halo on the figure's head; the
  // illustration's transparent areas around the body let the rotating
  // ring show through as motion in the corners.
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none aspect-[4/5]">
      {/* Rotating Ram-name halo. Two nested divs so the outer one
          can position the halo's centre exactly behind the head
          while the inner one handles rotation independently —
          combining position translates with a rotation animation
          in a single transform would cancel one out. Position
          values fine-tuned visually to align with the standing
          figure's head. Slow 180s per turn so the motion reads as
          devotional, not animated noise. */}
      <div
        aria-hidden
        className="absolute left-[42%] top-[26%] -translate-x-[41%] -translate-y-[39%] w-[84%] aspect-square pointer-events-none opacity-50"
      >
        <div
          className="w-full h-full"
          style={{ animation: "bm-spiral-spin 180s linear infinite" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/ram-name-halo.svg"
            alt=""
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/illustrations/hanuman-standing.webp"
        alt="Hanuman Ji, illustrated for BadaMangal"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        className="relative w-full h-full object-contain"
      />
    </div>
  );
}
