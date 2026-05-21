"use client";

import Link from "next/link";
import { strings } from "@/content/strings";
import { NEWS, type NewsEntry } from "@/content/news";
import { MarigoldDivider } from "@/components/ornaments";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * /resources/news body, extracted out of the server-rendered page so
 * the Lucknow-dispatch kicker, heading + body, related-articles
 * column header, source labels and "Read on source" CTAs swap on the
 * Hindi toggle without waiting on a server-tree refresh.
 *
 * Editorial layout split:
 *   • Static NEWS array (hand-curated) → FEATURED + TERTIARY rows
 *     (top-left feature card + the grid below the fold). These are
 *     items we've written bilingual excerpts for, so they keep that
 *     full editorial treatment.
 *   • liveHi / liveEn (auto-fetched from Google News, passed in from
 *     the server page) → SIDEBAR ("More from this week"). Always
 *     fresh, refreshed by the cron at /api/news/refresh every couple
 *     of hours. Each language version of the sidebar is hydrated
 *     server-side; the client just picks the right list when the
 *     locale toggle flips.
 */
export type LiveNewsItem = {
  id: string;
  url: string;
  title: string;
  source: string;
  /** ISO string of publishedAt. */
  publishedAt: string;
  /** OG image scraped from the article (best-effort, often null). */
  imageUrl?: string | null;
};

type Props = {
  liveHi: LiveNewsItem[];
  liveEn: LiveNewsItem[];
};

/** Discriminated union for whichever story currently owns the LEFT
 *  featured slot. `live` wins when any auto-fetched item has an OG
 *  image; otherwise `static` falls back to the hand-curated featured. */
type FeaturedSlot =
  | { kind: "static"; entry: NewsEntry }
  | { kind: "live"; item: LiveNewsItem };

export default function NewsPageView({ liveHi, liveEn }: Props) {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  // Featured first, then sort the remainder by date desc.
  const all = [...NEWS];
  const staticFeatured = all.find((n) => n.featured) ?? all[0];
  const staticRest = all
    .filter((n) => n.id !== staticFeatured?.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // Locale-matched live feed (up to 24 items, sorted newest-first by
  // the server query).
  const liveItems = isHi ? liveHi : liveEn;

  // Promote-with-image: if any live item carries an OG image, the
  // most-recent of those takes the LEFT featured slot. When no live
  // item has an image, fall back to the static featured.
  const liveWithImage = liveItems.find((it) => Boolean(it.imageUrl));
  const effectiveFeatured: FeaturedSlot | null = liveWithImage
    ? { kind: "live", item: liveWithImage }
    : staticFeatured
      ? { kind: "static", entry: staticFeatured }
      : null;

  // Strip the promoted item from the rest of the live feed so it
  // doesn't appear twice on the page.
  const liveRest = liveWithImage
    ? liveItems.filter((it) => it.id !== liveWithImage.id)
    : liveItems;

  // Layout split with per-section image policy:
  //   • Sidebar ("From the papers · live") → ALL items, image or
  //     not. Sidebar uses text-only LiveCard so no-image items
  //     render fine; this keeps the column dense even on slow days.
  //   • Tertiary grid ("Latest from the papers") → image-bearing
  //     items only. Grid uses image-led LiveTertiaryCard, where a
  //     no-image card would have a visual hole.
  // Items promoted to the sidebar are excluded from the tertiary to
  // avoid double-rendering.
  const liveSidebar = liveRest.slice(0, 8);
  const sidebarIds = new Set(liveSidebar.map((it) => it.id));
  const liveTertiary = liveRest
    .filter((it) => !sidebarIds.has(it.id) && Boolean(it.imageUrl))
    .slice(0, 12);

  // Editor's picks band: the hand-curated static items (with their
  // full bilingual excerpts + hand-picked imagery) sit BELOW the live
  // tertiary as a smaller "Editor's picks" row. Two purposes:
  //   1. Keeps the editorial work visible (the bilingual excerpts
  //      you wrote are real value)
  //   2. Anchors the page with evergreen items even on a slow news
  //      day when the live feed thins out
  // If a static item was promoted to featured fallback (because no
  // live-with-image), we omit it from this band (already shown above).
  const editorsPicks = effectiveFeatured?.kind === "static"
    ? staticRest
    : staticFeatured
      ? [staticFeatured, ...staticRest]
      : staticRest;

  // JSON-LD: keep the static outline stable (it's what crawlers see
  // first, doesn't churn with every cron tick).
  const sorted = staticFeatured ? [staticFeatured, ...staticRest] : staticRest;

  return (
    <article className="pb-24">
      {/* HEADER */}
      <header className="mx-auto max-w-5xl px-4 sm:px-6 pt-12 sm:pt-16 pb-6">
        <Link
          href={`/resources${langSuffix}`}
          className="inline-block text-sm text-ink-600 hover:text-saffron-600 transition-colors"
        >
          {t.resources.common.backToResources}
        </Link>
        <p className="mt-4 font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
          {isHi ? "लखनऊ संवाद" : "Lucknow dispatch"}
        </p>
        <h1
          className={`mt-3 font-fraunces font-medium text-[2rem] sm:text-[2.5rem] leading-[1.15] text-sindoor-700`}
        >
          {t.resources.news.heading}
        </h1>
        <p className="mt-4 max-w-3xl text-ink-600 leading-relaxed">
          {t.resources.news.body}
        </p>
      </header>

      {sorted.length === 0 ? (
        <p className="mx-auto max-w-3xl px-4 sm:px-6 text-ink-600">
          {t.resources.news.empty}
        </p>
      ) : (
        <>
          {/* FEATURED + LIVE SIDEBAR
              Left column (3/5): the editorial featured story. By
              default this is the static hand-curated featured from
              NEWS; if any auto-fetched live item carries an OG image,
              the most-recent of those is promoted here instead
              (see effectiveFeatured below), and the static featured
              quietly drops into the tertiary grid as a supplementary
              card.
              Right column (2/5): the always-live auto-fetched
              feed, language-matched to the visitor's locale. The
              column header has a pulsing live dot to signal
              freshness, and the card list is height-matched to the
              featured card on the left + scrollable so the page
              doesn't grow to a wall of cards when the wire is
              flowing fast. Mobile keeps the natural stacked
              layout (no scroll cage), only desktop gets the
              constrained height. */}
          {effectiveFeatured ? (
            <section className="mx-auto max-w-6xl px-4 sm:px-6 mt-2 grid gap-6 lg:grid-cols-5 lg:items-stretch">
              <div className="lg:col-span-3">
                {effectiveFeatured.kind === "static" ? (
                  <FeaturedCard
                    entry={effectiveFeatured.entry}
                    t={t}
                    isHi={isHi}
                  />
                ) : (
                  <LiveFeaturedCard
                    item={effectiveFeatured.item}
                    t={t}
                    isHi={isHi}
                  />
                )}
              </div>
              {/* Sidebar capped at the typical featured-card height
                  so it never stretches the row. Internal scroll cage
                  below handles overflow when the live feed has more
                  than ~4-5 cards. Mobile sees the natural stacked
                  layout (no max-h, no scroll). */}
              <aside className="lg:col-span-2 flex flex-col gap-3 lg:max-h-[640px] lg:min-h-0">
                <p className="font-mukta uppercase tracking-[0.3em] text-gold-500 text-[0.65rem] inline-flex items-center gap-2 shrink-0">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-saffron-600 opacity-60 motion-safe:animate-ping" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-saffron-600" />
                  </span>
                  {isHi ? "अख़बारों से · लाइव" : "From the papers · live"}
                </p>
                {liveSidebar.length === 0 ? (
                  <p className="text-sm text-ink-600 italic">
                    {isHi
                      ? "अभी कोई ताज़ा ख़बर नहीं। कुछ ही घंटों में वापस आइए।"
                      : "No fresh wire yet. Check back in a couple of hours."}
                  </p>
                ) : (
                  <div className="relative flex-1 lg:min-h-0">
                    {/* Inner scroll container: only constrained on lg+,
                        mobile flows naturally. The negative right
                        margin + matching padding reserves space for
                        the scrollbar without clipping card borders. */}
                    <div className="lg:absolute lg:inset-0 lg:overflow-y-auto lg:pr-2 lg:-mr-2 grid content-start gap-3">
                      {liveSidebar.map((item) => (
                        <LiveCard key={item.id} item={item} t={t} isHi={isHi} />
                      ))}
                    </div>
                    {/* Soft fade at the bottom of the scroll cage so
                        scrollable-overflow reads as intentional
                        instead of awkward. Desktop only. */}
                    <div
                      aria-hidden
                      className="hidden lg:block pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-cream-50 to-transparent"
                    />
                  </div>
                )}
              </aside>
            </section>
          ) : null}

          {/* DIVIDER + LIVE TERTIARY GRID
              The bottom band now flows from the live feed too — same
              "latest from the press" content as the sidebar, just
              continuing in a 3-col grid format. Cards with images
              show the image; cards without fall back to a saffron
              placeholder bearing the source name, so the row never
              has visual holes. Below this, an "Editor's picks" band
              of the static hand-curated stories anchors the page
              even when the live feed thins out. */}
          {liveTertiary.length > 0 ? (
            <>
              <div className="flex justify-center my-12">
                <MarigoldDivider size={280} className="text-gold-500" />
              </div>
              <section
                aria-labelledby="latest-from-papers"
                className="mx-auto max-w-6xl px-4 sm:px-6"
              >
                <header className="mb-5 flex items-center justify-between gap-4">
                  <h2
                    id="latest-from-papers"
                    className="font-mukta uppercase tracking-[0.3em] text-gold-500 text-xs inline-flex items-center gap-2"
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inset-0 rounded-full bg-saffron-600 opacity-60 motion-safe:animate-ping" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-saffron-600" />
                    </span>
                    {isHi ? "अख़बारों से ताज़ा" : "Latest from the papers"}
                  </h2>
                </header>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {liveTertiary.map((item) => (
                    <LiveTertiaryCard
                      key={item.id}
                      item={item}
                      t={t}
                      isHi={isHi}
                    />
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {editorsPicks.length > 0 ? (
            <>
              <div className="flex justify-center my-12">
                <MarigoldDivider size={220} className="text-gold-500" />
              </div>
              <section
                aria-labelledby="editors-picks"
                className="mx-auto max-w-6xl px-4 sm:px-6"
              >
                <header className="mb-5">
                  <h2
                    id="editors-picks"
                    className="font-mukta uppercase tracking-[0.3em] text-gold-500 text-xs"
                  >
                    {isHi ? "हमारी पसंद" : "Editor's picks"}
                  </h2>
                  <p className="mt-1 text-xs text-ink-600 italic">
                    {isHi
                      ? "हाथ से चुनी गई कहानियाँ, द्विभाषी सार के साथ।"
                      : "Hand-picked stories with our own bilingual excerpts."}
                  </p>
                </header>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {editorsPicks.map((n) => (
                    <TertiaryCard key={n.id} entry={n} t={t} isHi={isHi} />
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </>
      )}
    </article>
  );
}

// ── Cards ─────────────────────────────────────────────────────────────────

type CardProps = {
  entry: NewsEntry;
  t: typeof strings.en;
  isHi: boolean;
};

function FeaturedCard({ entry, t, isHi }: CardProps) {
  const headline = isHi && entry.headlineHi ? entry.headlineHi : entry.headline;
  const excerpt = isHi && entry.excerptHi ? entry.excerptHi : entry.excerpt;
  return (
    <a
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-3xl border border-gold-500/40 bg-saffron-50 hover:border-saffron-500 shadow-warm overflow-hidden transition-colors"
    >
      <Thumbnail
        src={entry.image}
        alt={entry.imageAlt ?? entry.headline}
        ratio="aspect-[16/9]"
        size="featured"
        source={entry.source}
      />
      <div className="px-6 sm:px-8 py-7 sm:py-9">
        <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-[0.65rem]">
          {t.resources.news.featuredKicker}
          {entry.tag ? ` · ${entry.tag}` : ""}
        </p>
        <h2
          className={`mt-3 font-fraunces font-semibold text-2xl sm:text-3xl leading-[1.15] text-sindoor-700 group-hover:underline decoration-saffron-500/60 underline-offset-4`}
        >
          {headline}
        </h2>
        <p className="mt-4 text-ink-900/90 leading-relaxed">{excerpt}</p>
        <p className="mt-5 text-sm text-ink-600">
          {t.resources.news.sourcePrefix}:{" "}
          <span className="text-ink-900">{entry.source}</span> ·{" "}
          <time dateTime={entry.date}>{formatDate(entry.date, isHi)}</time>
        </p>
        <p className="mt-4 inline-flex items-center gap-1.5 text-saffron-600 font-medium text-sm">
          {t.resources.news.readOnSource} <span aria-hidden>↗</span>
        </p>
      </div>
    </a>
  );
}

/**
 * Auto-fetched live news as the LEFT featured story. Used when any
 * live item carries an OG image — the most-recent of those gets
 * promoted here instead of the static editorial featured. Same
 * visual rhythm as FeaturedCard (large image + headline + source +
 * date + read-on-source CTA), without the editorial excerpt block
 * (we never reproduce article body). A small "Live · from the
 * press" eyebrow signals the auto-fetched provenance so visitors
 * know this is an external wire, not our own editorial. */
function LiveFeaturedCard({
  item,
  t,
  isHi,
}: {
  item: LiveNewsItem;
  t: typeof strings.en;
  isHi: boolean;
}) {
  const dateIso = item.publishedAt.slice(0, 10);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-3xl border border-gold-500/40 bg-saffron-50 hover:border-saffron-500 shadow-warm overflow-hidden transition-colors"
    >
      <Thumbnail
        src={item.imageUrl ?? undefined}
        alt={item.title}
        ratio="aspect-[16/9]"
        size="featured"
        source={item.source}
      />
      <div className="px-6 sm:px-8 py-7 sm:py-9">
        <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-[0.65rem] inline-flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-saffron-600 opacity-60 motion-safe:animate-ping" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-saffron-600" />
          </span>
          {isHi ? "लाइव · अख़बार से" : "Live · from the press"}
        </p>
        <h2
          className={`mt-3 ${
            isHi
              ? "font-deva font-semibold text-2xl sm:text-3xl leading-snug"
              : "font-fraunces font-semibold text-2xl sm:text-3xl leading-[1.15]"
          } text-sindoor-700 group-hover:underline decoration-saffron-500/60 underline-offset-4`}
        >
          {item.title}
        </h2>
        <p className="mt-5 text-sm text-ink-600">
          {t.resources.news.sourcePrefix}:{" "}
          <span className="text-ink-900">{item.source}</span> ·{" "}
          <time dateTime={dateIso}>{formatDate(dateIso, isHi)}</time>
        </p>
        <p className="mt-4 inline-flex items-center gap-1.5 text-saffron-600 font-medium text-sm">
          {t.resources.news.readOnSource} <span aria-hidden>↗</span>
        </p>
      </div>
    </a>
  );
}

/**
 * Auto-fetched live news card for the BOTTOM 3-col grid. Same visual
 * rhythm as the static TertiaryCard (16:9 image + headline + source +
 * date + read-on-source CTA), but no excerpt (we never reproduce
 * article body for auto-fetched items). When `imageUrl` is null, the
 * Thumbnail component's saffron placeholder fills in with the source
 * name, so the row never has a visual hole. */
function LiveTertiaryCard({
  item,
  t,
  isHi,
}: {
  item: LiveNewsItem;
  t: typeof strings.en;
  isHi: boolean;
}) {
  const dateIso = item.publishedAt.slice(0, 10);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col rounded-2xl border border-gold-500/40 bg-white hover:border-saffron-500 overflow-hidden transition-colors"
    >
      <Thumbnail
        src={item.imageUrl ?? undefined}
        alt={item.title}
        ratio="aspect-[16/9]"
        size="tertiary"
        source={item.source}
      />
      <div className="px-5 py-5 flex flex-col flex-1">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-gold-500">
          {item.source} ·{" "}
          <time dateTime={dateIso}>{formatDate(dateIso, isHi)}</time>
        </p>
        <h3
          className={`mt-2 ${
            isHi
              ? "font-deva font-medium text-lg leading-snug"
              : "font-fraunces font-medium text-lg leading-snug"
          } text-ink-900`}
        >
          {item.title}
        </h3>
        <p className="mt-auto pt-3 text-saffron-600 text-xs font-medium">
          {t.resources.news.readOnSource} <span aria-hidden>↗</span>
        </p>
      </div>
    </a>
  );
}

/**
 * Auto-fetched live news card for the sidebar. No body excerpt (we
 * never reproduce article text). Source pill + relative date +
 * headline is enough to drive a click out to the publication.
 */
function LiveCard({
  item,
  t,
  isHi,
}: {
  item: LiveNewsItem;
  t: typeof strings.en;
  isHi: boolean;
}) {
  const dateIso = item.publishedAt.slice(0, 10);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-gold-500/40 bg-white hover:border-saffron-500 p-4 transition-colors"
    >
      <p className="text-[0.6rem] uppercase tracking-[0.24em] font-mukta font-semibold text-saffron-600">
        {item.source} ·{" "}
        <span className="text-ink-600 font-medium tracking-[0.16em]">
          <time dateTime={dateIso}>{formatDate(dateIso, isHi)}</time>
        </span>
      </p>
      <h3
        className={`mt-2 ${
          isHi
            ? "font-deva text-base leading-snug"
            : "font-fraunces font-medium text-base leading-snug"
        } text-ink-900 line-clamp-3`}
      >
        {item.title}
      </h3>
      <p className="mt-3 text-[0.7rem] text-saffron-600 font-medium">
        {t.resources.news.readOnSource} <span aria-hidden>↗</span>
      </p>
    </a>
  );
}

function TertiaryCard({ entry, t, isHi }: CardProps) {
  const headline = isHi && entry.headlineHi ? entry.headlineHi : entry.headline;
  const excerpt = isHi && entry.excerptHi ? entry.excerptHi : entry.excerpt;
  return (
    <a
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col rounded-2xl border border-gold-500/40 bg-white hover:border-saffron-500 overflow-hidden transition-colors"
    >
      <Thumbnail
        src={entry.image}
        alt={entry.imageAlt ?? entry.headline}
        ratio="aspect-[16/9]"
        size="tertiary"
        source={entry.source}
      />
      <div className="px-5 py-5 flex flex-col flex-1">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-gold-500">
          {entry.source} ·{" "}
          <time dateTime={entry.date}>{formatDate(entry.date, isHi)}</time>
        </p>
        <h3 className="mt-2 font-fraunces font-medium text-lg leading-snug text-ink-900">
          {headline}
        </h3>
        <p className="mt-2 text-sm text-ink-600 leading-relaxed line-clamp-2">
          {excerpt}
        </p>
        <p className="mt-auto pt-3 text-saffron-600 text-xs font-medium">
          {t.resources.news.readOnSource} <span aria-hidden>↗</span>
        </p>
      </div>
    </a>
  );
}

/**
 * Route every news thumbnail through the weserv.nl image proxy. weserv:
 *  - Strips the Referer header, bypassing hot-link protection on most CMSes
 *  - Re-encodes to WebP and resizes to a sensible width
 *  - Caches at edge so repeat loads are fast
 * Free, no auth, well-trusted (used by hundreds of sites). If the upstream
 * image 404s or is genuinely missing, we still render the styled saffron
 * placeholder underneath so the card never collapses.
 */
function proxiedImageUrl(src: string, width = 800): string {
  try {
    const u = new URL(src);
    // weserv expects the URL without protocol.
    const target = `${u.host}${u.pathname}${u.search}`;
    return `https://images.weserv.nl/?url=${encodeURIComponent(target)}&w=${width}&we&output=webp`;
  } catch {
    return src;
  }
}

/**
 * News thumbnail. Always paints the saffron placeholder first (so if the
 * upstream image 404s the card still has visual weight); the proxied image
 * sits on top and covers the placeholder once it loads.
 */
function Thumbnail({
  src,
  alt,
  ratio,
  size,
  source,
}: {
  src?: string;
  alt: string;
  ratio: string;
  size: "featured" | "tertiary" | "thumb";
  source: string;
}) {
  const initial = source.trim().charAt(0).toUpperCase() || "★";
  const proxyWidth = size === "thumb" ? 240 : size === "featured" ? 1200 : 800;
  return (
    <div
      className={`relative ${ratio} w-full overflow-hidden bg-gradient-to-br from-saffron-50 to-cream-50 border-b border-gold-500/30`}
    >
      {/* Placeholder behind the image, visible only if the image 404s. */}
      <div className="absolute inset-0 flex items-center justify-center text-center px-3 pointer-events-none">
        <div>
          <p className="font-numerals font-extrabold text-saffron-600/40 text-3xl sm:text-5xl leading-none">
            {initial}
          </p>
          {size !== "thumb" ? (
            <p className="mt-2 font-mukta uppercase tracking-[0.28em] text-ink-600/55 text-[0.6rem]">
              {source}
            </p>
          ) : null}
        </div>
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxiedImageUrl(src, proxyWidth)}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover bg-cream-50"
        />
      ) : null}
    </div>
  );
}

function formatDate(iso: string, isHi: boolean): string {
  // Render in YYYY-MM-DD-safe local format without locale-specific quirks.
  const d = new Date(iso + "T00:00:00");
  const month = d.toLocaleString(isHi ? "hi-IN" : "en-IN", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}
