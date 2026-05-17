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
 */
export default function NewsPageView() {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  // Featured first, then sort the remainder by date desc.
  const all = [...NEWS];
  const featured = all.find((n) => n.featured) ?? all[0];
  const rest = all
    .filter((n) => n.id !== featured?.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  // Right column: 5 secondary cards. Below: the rest in a tertiary grid.
  const secondary = rest.slice(0, 5);
  const tertiary = rest.slice(5);
  const sorted = [featured, ...rest];

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
          {/* FEATURED */}
          {featured ? (
            <section className="mx-auto max-w-6xl px-4 sm:px-6 mt-2 grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <FeaturedCard entry={featured} t={t} isHi={isHi} />
              </div>
              <aside className="lg:col-span-2 grid content-start gap-4">
                <p className="font-mukta uppercase tracking-[0.3em] text-gold-500 text-[0.65rem]">
                  {t.resources.news.relatedHeading}
                </p>
                {secondary.map((n) => (
                  <SecondaryCard key={n.id} entry={n} t={t} isHi={isHi} />
                ))}
              </aside>
            </section>
          ) : null}

          {/* DIVIDER */}
          {tertiary.length > 0 ? (
            <div className="flex justify-center my-12">
              <MarigoldDivider size={280} className="text-gold-500" />
            </div>
          ) : null}

          {/* TERTIARY GRID */}
          {tertiary.length > 0 ? (
            <section className="mx-auto max-w-6xl px-4 sm:px-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {tertiary.map((n) => (
                <TertiaryCard key={n.id} entry={n} t={t} isHi={isHi} />
              ))}
            </section>
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

function SecondaryCard({ entry, t: _t, isHi }: CardProps) {
  const headline = isHi && entry.headlineHi ? entry.headlineHi : entry.headline;
  return (
    <a
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[88px_1fr] gap-3 rounded-2xl border border-gold-500/40 bg-white hover:border-saffron-500 p-3 transition-colors"
    >
      <Thumbnail
        src={entry.image}
        alt={entry.imageAlt ?? entry.headline}
        ratio="aspect-square"
        size="thumb"
        source={entry.source}
      />
      <div>
        <p className="text-[0.6rem] uppercase tracking-[0.24em] text-gold-500">
          {entry.source} ·{" "}
          <time dateTime={entry.date}>{formatDate(entry.date, isHi)}</time>
        </p>
        <h3 className="mt-1.5 font-fraunces font-medium text-base leading-snug text-ink-900 line-clamp-3">
          {headline}
        </h3>
      </div>
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
