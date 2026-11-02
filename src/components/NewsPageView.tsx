"use client";

import { useEffect, useRef, useState } from "react";
import { strings } from "@/content/strings";
import { NEWS, type NewsEntry } from "@/content/news";
import { HOME_ART } from "@/content/home-art";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  Breadcrumb,
  EmptyState,
  Heading,
  InnerShell,
  Kicker,
  ListRow,
  PageHero,
  RowList,
  Section,
  Tile,
  TileList,
} from "@/components/v2";

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

  // Merged feed: ALL news on BOTH locales, newest first. The source
  // label tells a reader which language an article is in.
  const liveItems = [...liveHi, ...liveEn].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  // Promote-with-image: the newest live item with an OG image takes the
  // featured slot; otherwise the hand-curated featured story.
  const liveWithImage = liveItems.find((it) => Boolean(it.imageUrl));
  const effectiveFeatured: FeaturedSlot | null = liveWithImage
    ? { kind: "live", item: liveWithImage }
    : staticFeatured
      ? { kind: "static", entry: staticFeatured }
      : null;
  const liveRest = liveWithImage ? liveItems.filter((it) => it.id !== liveWithImage.id) : liveItems;

  // Beside the featured story: ALL items (text rows). Below: only items
  // with an image (picture tiles), never repeating the rows.
  const liveSidebar = liveRest.slice(0, 8);
  const sidebarIds = new Set(liveSidebar.map((it) => it.id));
  const liveTertiary = liveRest
    .filter((it) => !sidebarIds.has(it.id) && Boolean(it.imageUrl))
    .slice(0, 12);

  // Editor's picks: the hand-curated stories with our own excerpts.
  const editorsPicks = effectiveFeatured?.kind === "static"
    ? staticRest
    : staticFeatured
      ? [staticFeatured, ...staticRest]
      : staticRest;

  const sorted = staticFeatured ? [staticFeatured, ...staticRest] : staticRest;
  const external = { target: "_blank", rel: "noopener noreferrer" };

  // A publisher's image can vanish. Swap any picture that failed (even
  // before hydration) for the painted old Lucknow street, never a broken box.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const swap = (img: HTMLImageElement) => {
      if (img.dataset.fb) return;
      img.dataset.fb = "1";
      img.src = HOME_ART.oldLucknowBand.src;
    };
    const onErr = (e: Event) => {
      if (e.target instanceof HTMLImageElement) swap(e.target);
    };
    root.querySelectorAll<HTMLImageElement>(".bmi-tile-art img").forEach((img) => {
      if (img.complete && img.naturalWidth === 0) swap(img);
    });
    root.addEventListener("error", onErr, true);
    return () => root.removeEventListener("error", onErr, true);
  }, []);

  return (
    <InnerShell>
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: `/${langSuffix}` },
              { label: isHi ? "संसाधन" : "Resources", href: `/resources${langSuffix}` },
              { label: t.resources.news.heading },
            ]}
          />
        }
        kicker={<Kicker>{isHi ? "लखनऊ संवाद" : "Lucknow dispatch"}</Kicker>}
        title={{ en: strings.en.resources.news.heading, hi: strings.hi.resources.news.heading }}
        lede={t.resources.news.body}
      />

      {sorted.length === 0 ? (
        <Section tight id="empty">
          <EmptyState lede={t.resources.news.empty} />
        </Section>
      ) : (
        <div ref={listRef} className="bmi-news">
          {effectiveFeatured ? (
            <Section tight id="featured">
              <div className="bmi-split bmi-news-top">
                {effectiveFeatured.kind === "static" ? (
                  <FeaturedCard entry={effectiveFeatured.entry} t={t} isHi={isHi} />
                ) : (
                  <LiveFeaturedCard item={effectiveFeatured.item} t={t} isHi={isHi} />
                )}
                <aside aria-label={isHi ? "अख़बारों से" : "From the papers"}>
                  <Kicker live>{isHi ? "अख़बारों से · लाइव" : "From the papers · live"}</Kicker>
                  {liveSidebar.length === 0 ? (
                    <p className="bmi-fine">
                      {isHi
                        ? "अभी कोई ताज़ा ख़बर नहीं। कुछ ही घंटों में वापस आइए।"
                        : "No fresh wire yet. Check back in a couple of hours."}
                    </p>
                  ) : (
                    <RowList>
                      {liveSidebar.map((item) => (
                        <ListRow
                          key={item.id}
                          href={item.url}
                          external
                          kicker={`${item.source} · ${formatDate(item.publishedAt.slice(0, 10), isHi)}`}
                          title={item.title}
                        />
                      ))}
                    </RowList>
                  )}
                </aside>
              </div>
            </Section>
          ) : null}

          {liveTertiary.length > 0 ? (
            <Section
              id="latest-from-papers"
              labelledBy="latest-from-papers-h"
              heading={
                <Heading as="h2" id="latest-from-papers-h" en="Latest from the papers" hi="अख़बारों से ताज़ा" />
              }
            >
              <TileList grid cols={3}>
                {liveTertiary.map((item) => (
                  <Tile
                    key={item.id}
                    href={item.url}
                    titleAs="h3"
                    lang={/[\u0900-\u097F]/.test(item.title) ? "hi" : undefined}
                    kicker={`${item.source} · ${formatDate(item.publishedAt.slice(0, 10), isHi)}`}
                    title={item.title}
                    art={item.imageUrl ? { src: proxiedImageUrl(item.imageUrl, 800), alt: "" } : undefined}
                    linkProps={external}
                  />
                ))}
              </TileList>
            </Section>
          ) : null}

          {editorsPicks.length > 0 ? (
            <Section
              id="editors-picks"
              labelledBy="editors-picks-h"
              heading={<Heading as="h2" id="editors-picks-h" en="Editor's picks" hi="हमारी पसंद" />}
              lede={
                isHi
                  ? "हाथ से चुनी गई कहानियाँ, द्विभाषी सार के साथ।"
                  : "Hand-picked stories with our own bilingual excerpts."
              }
            >
              <TileList grid cols={3}>
                {editorsPicks.map((n) => (
                  <Tile
                    key={n.id}
                    href={n.url}
                    titleAs="h3"
                    lang={isHi && n.headlineHi ? "hi" : undefined}
                    kicker={`${n.source} · ${formatDate(n.date, isHi)}`}
                    title={isHi && n.headlineHi ? n.headlineHi : n.headline}
                    line={isHi && n.excerptHi ? n.excerptHi : n.excerpt}
                    art={n.image ? { src: proxiedImageUrl(n.image, 800), alt: "" } : undefined}
                    linkProps={external}
                  />
                ))}
              </TileList>
            </Section>
          ) : null}
        </div>
      )}
    </InnerShell>
  );
}

// ── Featured ─────────────────────────────────────────────────────────────

type CardProps = {
  entry: NewsEntry;
  t: typeof strings.en;
  isHi: boolean;
};

/** The hand-curated featured story: photo, kicker, the headline (h2),
 *  our excerpt, source and date. */
function FeaturedCard({ entry, t, isHi }: CardProps) {
  const headline = isHi && entry.headlineHi ? entry.headlineHi : entry.headline;
  const excerpt = isHi && entry.excerptHi ? entry.excerptHi : entry.excerpt;
  return (
    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="bmi-res-feat" data-rv>
      <FeatImage src={entry.image} width={1200} />
      <span className="bmi-row-kick">
        {t.resources.news.featuredKicker}
        {entry.tag ? ` · ${entry.tag}` : ""}
      </span>
      <h2 className="bmi-res-feat-t" lang={isHi && entry.headlineHi ? "hi" : undefined}>
        {headline}
      </h2>
      <p className="bmi-res-feat-x">{excerpt}</p>
      <span className="bmi-fine">
        {t.resources.news.sourcePrefix}: {entry.source} · <time dateTime={entry.date}>{formatDate(entry.date, isHi)}</time>
      </span>
      <span className="bmi-tl inline">{t.resources.news.readOnSource}</span>
    </a>
  );
}

/** An auto-fetched story in the featured slot (never its body text). */
function LiveFeaturedCard({ item, t, isHi }: { item: LiveNewsItem; t: typeof strings.en; isHi: boolean }) {
  const dateIso = item.publishedAt.slice(0, 10);
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="bmi-res-feat" data-rv>
      <FeatImage src={item.imageUrl ?? ""} width={1200} />
      <span className="bmi-row-kick">{isHi ? "लाइव · अख़बार से" : "Live · from the press"}</span>
      <h2 className="bmi-res-feat-t" lang={/[\u0900-\u097F]/.test(item.title) ? "hi" : undefined}>
        {item.title}
      </h2>
      <span className="bmi-fine">
        {t.resources.news.sourcePrefix}: {item.source} · <time dateTime={dateIso}>{formatDate(dateIso, isHi)}</time>
      </span>
      <span className="bmi-tl inline">{t.resources.news.readOnSource}</span>
    </a>
  );
}

/** The featured photo; a painted old Lucknow street stands in when a
 *  publisher's image is gone, never a broken box. */
function FeatImage({ src, width }: { src: string; width: number }) {
  const [failed, setFailed] = useState(!src);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  return (
    <span className="bmi-res-feat-img">
      {failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={HOME_ART.oldLucknowBand.src} alt="" decoding="async" className="fallback" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={proxiedImageUrl(src, width)}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </span>
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

function formatDate(iso: string, isHi: boolean): string {
  // Render in YYYY-MM-DD-safe local format without locale-specific quirks.
  const d = new Date(iso + "T00:00:00");
  const month = d.toLocaleString(isHi ? "hi-IN" : "en-IN", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}
