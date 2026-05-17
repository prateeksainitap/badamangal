import type { Metadata } from "next";
import {
  SITE_URL,
  eventSchemaBatch,
  faqSchema,
  localised,
  organizationSchema,
  websiteSchema,
} from "@/lib/seo";
import { ALL_TUESDAY_ISO } from "@/lib/dates";
import { stripBotProvenance } from "@/lib/sanitize";
import AreaIndexGrid from "@/components/AreaIndexGrid";
import BhandaraCardsSection from "@/components/BhandaraCardsSection";
import FeaturedBhandaras from "@/components/FeaturedBhandaras";
import OrganisePromo from "@/components/OrganisePromo";
import HappeningNow from "@/components/HappeningNow";
import HomeCardsEmpty from "@/components/HomeCardsEmpty";
import HomeClosingBenediction from "@/components/HomeClosingBenediction";
import HomeHero from "@/components/HomeHero";
import HomeHistoryTeaser from "@/components/HomeHistoryTeaser";
// PamphletPromo intentionally not imported, the homepage section
// for it is commented out below during the soft-launch phase. See the
// matching comment near the FAMOUS BHANDARAS block.
// import PamphletPromo from "@/components/PamphletPromo";
import MapBoard from "@/components/MapBoard";
import CountdownTimer from "@/components/CountdownTimer";
import LiveFeedMarquee from "@/components/LiveFeedMarquee";
import SeasonTimeline from "@/components/SeasonTimeline";
import StatsSection from "@/components/StatsSection";
import FamousBhandaras from "@/components/FamousBhandaras";
import HomeResourcesTeaser from "@/components/HomeResourcesTeaser";
import VisitorBeacon from "@/components/VisitorBeacon";
import { MarigoldDivider } from "@/components/ornaments";
import { prisma, toBhandara } from "@/lib/db";
import { areaToSlug } from "@/lib/areaSlug";
import { hasUpcomingDate } from "@/lib/dates";
import { getHomepageStats } from "@/lib/stats";

// True ISR, the page no longer reads cookies() or searchParams, so
// Next can prerender it once and serve cached HTML from the edge.
// Revalidates every 60 seconds to surface new bhandaras / spots /
// counter ticks. Visitor-counter bump is fire-and-forget via the
// VisitorBeacon below.
export const revalidate = 60;

// Homepage metadata, tuned to the queries Search Console is ACTUALLY
// showing us impressions for, not the queries we wish we ranked for.
//
// GSC data (as of mid-May 2026 season-start):
//   • "bhandara near me today"          12 imp · position 6.1 · CTR 0%
//   • "bhandara near me"                 9 imp · position 6.9 · CTR 0%
//   • "bhandara near me today open now"  2 imp · position 9    · CTR 0%
//   • "bada mangal lucknow"              1 imp · position 11
//
// We were ranking page-1-bottom for "near me" queries but seeing
// zero clicks because the SERP snippet promised "2026 Jyeshtha
// season" and "directory", abstract / institutional. Searchers
// typing "bhandara near me today" want a concrete here-and-now
// answer ("open now", "live map", "free prasad").
//
// New title leads with "Bhandara Near Me" (matches the query
// verbatim), then anchors with the brand. New description leads
// with "happening today" + "free" + "every Tuesday", every word
// is an answer to something the searcher actually wants to know.
//
// Expected impact: CTR from 0% → 4-7% at position 6, which 3-5×
// our organic traffic from the same Google impressions we're
// already getting.
export const metadata: Metadata = {
  title: "Bhandara Near Me · Bada Mangal Lucknow 2026 · Live Map & Today's Bhandaras",
  description:
    "Find every Bada Mangal bhandara in Lucknow happening today and every Tuesday of the 8-Tuesday 2026 Jyeshtha season. Live map, timings, prasad menu, directions, free. लखनऊ के सभी बड़े मंगल भंडारे एक नक़्शे पर।",
  keywords: [
    // "near me" intent, matches the queries actually in GSC
    "bhandara near me",
    "bhandara near me today",
    "bhandara lucknow near me",
    "free bhandara lucknow",
    // brand + season
    "bada mangal",
    "bada mangal 2026",
    "bada mangal lucknow",
    "bhandara lucknow",
    "hanuman bhandara",
    "jyeshtha tuesdays",
    "8 bada mangal",
    // Hindi
    "बड़ा मंगल",
    "बड़ा मंगल लखनऊ",
    "हनुमान भंडारा",
    "भंडारा लखनऊ",
    "लखनऊ बड़ा मंगल 2026",
  ],
  alternates: localised("/"),
  openGraph: {
    // OG title kept slightly shorter for social cards (WhatsApp /
    // Twitter truncate aggressively at ~60-70 chars; the SERP title
    // above can run longer because Google word-wraps).
    title: "Bhandara Near Me · Bada Mangal Lucknow 2026",
    description:
      "Every Bada Mangal bhandara in Lucknow on one live map. Today's bhandaras, timings, prasad menu, free directions.",
    url: SITE_URL,
    siteName: "BadaMangal",
    locale: "en_IN",
    alternateLocale: "hi_IN",
    type: "website",
  },
};

export default async function HomePage() {
  // NB: The page itself is locale-AGNOSTIC. Every text-bearing
  // section is rendered by a client component that reads the
  // visitor's bm_lang cookie via LocaleProvider context, so the
  // Hindi toggle swaps every label instantly without re-fetching the
  // page. Reading cookies here would opt the homepage out of static
  // generation and reintroduce the 3-4 s Function cold-start lag.
  //
  // The previous version hardcoded `locale = "en"` and threaded that
  // into 6+ server-rendered headings (hero body, map heading,
  // history teaser, etc.). On the Hindi toggle, router.refresh()
  // re-rendered the page on the server with locale STILL pinned to
  // English, so visitors saw the toggle pill animate but the text
  // never changed. Hence this refactor.

  // Fire all three DB reads in parallel. Previously they were awaited
  // sequentially (bhandaras → stats → spots) which serialised three
  // round-trips through the Supabase pooler, ~600-900ms of pure wait
  // on cold-start cold-pool. Running them together cuts that to one
  // round-trip's worth of latency.
  const [records, statsRaw, spotRecords] = await Promise.all([
    prisma.bhandara.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ isSponsored: "desc" }, { createdAt: "asc" }],
    }),
    getHomepageStats(),
    prisma.spot.findMany({
      where: { status: "APPROVED", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 24,
      include: {
        bhandara: { select: { slug: true, name: true, nameHi: true } },
      },
    }),
  ]);

  // Auto-delist bhandaras whose every service date has already passed
  // (IST calendar). The DB row stays APPROVED so admins still see it
  // in /admin and historical /bhandara/[slug] permalinks keep
  // working; only the public main list trims to what's still
  // upcoming. Past-only rows surface on /archive instead, which is
  // the explicit "season history" view that filters with the
  // inverse predicate.
  //
  // This is the contract every public surface (map, card grid, area
  // chips, /api/bhandaras GET, stats panel) MUST share, otherwise
  // headline counts diverge from the cards / pins below them.
  const listings = records.map(toBhandara).filter((b) => hasUpcomingDate(b));
  const stats = statsRaw;

  // Live "spots", crowd-sourced sightings of bhandaras happening right
  // now (auto-expire after 8 hours). Already fetched above in the
  // Promise.all batch, just shape into the wire format here.
  const liveSpots = spotRecords.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    area: s.area,
    address: s.address,
    photoUrl: s.photoUrl,
    // Strip the internal [bot:whatsapp …] tag so it never reaches a
    // public surface. See lib/sanitize.ts for the regex source.
    caption: stripBotProvenance(s.caption) || null,
    reporterName: s.reporterName,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: s.bhandara?.name ?? null,
    bhandaraNameHi: s.bhandara?.nameHi ?? null,
  }));

  // Live feed initial payload, active spots only. The Post model
  // (per-bhandara comments) was removed, so the marquee + /live feed
  // now mirror just the crowd-sourced spots stream. authorName falls
  // back to a generic "Spotter" / "स्पॉटर" label on the client because
  // the page now renders without a server-side locale.
  const feedInitial = spotRecords
    .map((s) => ({
      id: `spot:${s.id}`,
      bhandaraSlug: s.bhandara?.slug ?? null,
      bhandaraName: s.bhandara?.name ?? null,
      authorName: s.reporterName?.trim() || "Spotter",
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
      {/* Fire-and-forget visitor counter bump, runs once per tab after
          first paint. Replaces the per-render DB write that used to
          force the homepage to be server-dynamic. */}
      <VisitorBeacon />
      {/* JSON-LD structured data, embedded inline so search-engine
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
            illustration ends doesn't read as abrupt, a thin band of
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
            {/* Left 7/12: bilingual hero text rendered by the
                HomeHero client component so the Hindi toggle flips
                eyebrow / body / Tuesday line synchronously. */}
            <HomeHero />

            {/* Right 5/12: real Hanuman Ji illustration */}
            <div className="lg:col-span-6">
              <HeroIllustrationFrame />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED BHANDARAS, concrete answer to "where can I go to a
          bhandara today?" up high, before the countdown/map. GA4
          data showed 20× more hero-CTA clicks than bhandara-card
          opens, meaning the cards were too deep in the page. This
          section pulls 3-4 photographed, verified, today-or-soonest
          bhandaras above the fold so visitors arriving from
          WhatsApp shares + organic search ("bhandara near me today")
          land on a specific answer without scrolling. */}
      {/* locale is read from React context inside FeaturedBhandaras
          so the Hindi toggle swaps the section heading + Today
          pills + area labels synchronously. */}
      <FeaturedBhandaras listings={listings} />

      {/* COUNTDOWN + 8-MANGAL TIMELINE
          Hierarchy rebuild: the previous version had a giant
          "8 Bada Mangals in 2026: the rarest cycle in 19 years"
          heading + body + two fact-pills competing for attention
          with the countdown, the "Today is" banner, the date pill,
          and the timeline. Seven focal points, all visually loud.
          The rare-cycle framing is *interesting context* but not
          *actionable info*, the actionable bits are "today is
          happening" (live days) and "countdown to next" (other days).
          So: rare-cycle is compressed into a single subtle kicker
          line above the date pill, and everything actionable
          (banner, date pill, timer, timeline) gets to breathe. */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="rounded-3xl border border-gold-500/40 bg-cream-50 px-6 py-10 sm:px-10 sm:py-12">
          {/* Countdown to the next Bada Mangal (or, on a Bada Mangal
              day itself, a big "Today is the Nth" headline + timer
              for the *next* one). Both Countdown + Timeline read locale
              from context so the Hindi toggle swaps every label here
              without a server-tree refresh. */}
          <CountdownTimer />

          {/* 8-Mangal timeline + the rare-cycle subtitle */}
          <SeasonTimeline />
        </div>
      </section>

      {/* MAP + side list, promoted up so primary discovery happens
          immediately after the season-context band. MapBoard now
          reads its heading + body + "List your bhandara" label from
          the LocaleProvider context, no locale props needed. */}
      <MapBoard
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

      {/* HAPPENING NOW, crowd-sourced live spots, sits right under
          the map so the urgency layer reads as an overlay on top of
          the discovery surface. Reads locale from context. */}
      <HappeningNow initial={liveSpots} />

      {/* CARDS, equal-height grid with filters. Locale reads from
          context inside the component. The saffron headline number
          is `listings.length`, ie. the upcoming-only filtered total
          (matches everything else on the page + the stats panel,
          past-only bhandaras live exclusively on /archive). */}
      {listings.length > 0 ? (
        <BhandaraCardsSection listings={listings} />
      ) : (
        <HomeCardsEmpty />
      )}

      {/* AREA INDEX, 36 pill chips, one per Lucknow neighbourhood,
          each a direct Link to /area/[slug]. Two wins:
          1. SEO: distributes PageRank from the homepage to every
             area landing page (the biggest SEO lever from the
             audit), accelerates ranking on "bada mangal <area>"
             queries.
          2. UX: visitors who know their area jump in one tap
             instead of scrolling through the cards.

          Both the count and the highlighted-chip set source from
          `listings` (upcoming-dates-only) rather than `records`
          (all APPROVED). A highlighted chip is a contract with the
          visitor: "yes, you can visit a bhandara in this area right
          now". A past-only bhandara doesn't honour that contract,
          its area is invisible in the listings below, so the chip
          must not highlight either. The stats panel keeps the
          cumulative "Areas covered" view because its frame is
          "what has the city ever done", a different lens. */}
      <AreaIndexGrid
        activeAreaCount={new Set(listings.map((l) => l.area)).size}
        activeAreaSlugs={
          new Set(listings.map((l) => areaToSlug(l.area)))
        }
      />

      {/* PAMPHLET PROMO is temporarily hidden, the /pamphlet feature
          ships but is not publicly promoted during the soft-launch
          phase. Re-enable by uncommenting <PamphletPromo /> below
          (and the import at the top of the file) once the design
          is finalised. Sitemap and footer link have also been
          stripped so the only way in is a direct URL.
          <PamphletPromo />
      */}

      {/* ORGANISE-BHANDARA promo, lead-capture banner for the
          full-service path. Sits right under AreaIndexGrid so a
          visitor who just scanned the area chips and didn't find
          their neighbourhood's bhandara (or wants to be the one
          adding it) is one tap from the request form. ?from=banner
          attributes the inbound channel on the lead's email. */}
      <OrganisePromo />

      {/* FAMOUS BHANDARAS, curated landmark venues. Sits below the
          listed-bhandaras grid so visitors first see what organisers
          have actually submitted, then the city-wide landmark anchors. */}
      <FamousBhandaras />

      {/* STATS, pulled up to lead the lower half of the page. The
          city's running tally (visitors, listings, spotted bhandaras,
          areas, Tuesdays served) sets the tone for the editorial /
          live content that follows. Tiles with value 0 are hidden so
          the panel doesn't read as empty on a quiet day. */}
      <StatsSection stats={stats} />

      {/* RESOURCES TEASER, extracted into a client component so the
          card titles + bodies localise from the LocaleProvider context
          after the static HTML lands (otherwise Hindi-cookie visitors
          would see this band in English). */}
      <HomeResourcesTeaser />

      {/* LIVE FEED MARQUEE, sits between resources and the editorial
          history teaser; renders an empty-state band when there are <3
          entries instead of disappearing. */}
      <LiveFeedMarquee initial={feedInitial} />

      {/* MARIGOLD DIVIDER */}
      <div className="flex justify-center my-4">
        <MarigoldDivider size={320} className="text-gold-500" />
      </div>

      {/* HISTORY TEASER, client component, locale from context. */}
      <HomeHistoryTeaser />

      {/* CLOSING BENEDICTION, bilingual blessing line + Maharajji
          medallion. Client component so the body line ("May Hanuman
          Ji bless..." / "बजरंगबली की कृपा...") swaps on toggle. */}
      <HomeClosingBenediction />
    </>
  );
}

function HeroIllustrationFrame() {
  // Two-layer composition:
  //   1. Ram-name halo SVG, slowly rotating behind the figure's head
  //   2. Hanuman Ji illustration on top (transparent PNG)
  // Both float directly on the page paper, no card, no border,
  // no vignette. The halo is sized + positioned so its centre sits
  // roughly behind the painted halo on the figure's head; the
  // illustration's transparent areas around the body let the rotating
  // ring show through as motion in the corners.
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none aspect-[4/5]">
      {/* Rotating Ram-name halo. Two nested divs so the outer one
          can position the halo's centre exactly behind the head
          while the inner one handles rotation independently,
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
