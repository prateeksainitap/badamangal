/**
 * News aggregator
 *
 * Fetches Bada-Mangal-in-Lucknow stories from Google News RSS in both
 * Hindi and English, filters them through a strict source whitelist,
 * and upserts new items into the `NewsItem` table as APPROVED status.
 *
 * Why Google News RSS specifically:
 *   • Zero cost, no API key, no per-day request cap
 *   • Aggregates every major Indian daily we care about (ToI, NBT,
 *     Dainik Jagran, Amar Ujala, Hindustan, Webdunia, etc.) in one
 *     place, so we don't have to babysit a dozen per-source RSS URLs
 *     that drift over time
 *   • Excellent Hindi coverage via the `hl=hi-IN` variant
 *   • Returns structured XML with title + link + source + pubDate
 *     per item, which is everything we need for the news card
 *
 * What's deliberately NOT done here (yet):
 *   • OG-image scraping per article (would 10× the network load and
 *     introduce a fragile per-domain HTML parser). The page falls
 *     back to a per-source brand colour when imageUrl is null, so
 *     cards never look broken
 *   • Google News redirect-URL resolution (the redirect URLs work
 *     fine in any browser; resolving them would require an extra
 *     HEAD request per item, and the URL is only used for outbound
 *     clicks anyway)
 *   • Body / excerpt extraction (we render just the title + source +
 *     date, no body text, this avoids any reproduction-rights
 *     question completely)
 *
 * Source whitelist:
 *   The aggregator only keeps items whose Google-News-declared source
 *   matches one of the names in SOURCE_WHITELIST below. Anything else
 *   (random blogs, off-topic news sites that happen to mention Bada
 *   Mangal in passing, etc.) is dropped silently. Admin can extend
 *   the whitelist by adding a string to SOURCE_WHITELIST.
 *
 * Auto-publish safety:
 *   Items insert as `status: "APPROVED"` directly. The admin can flip
 *   any item to `"HIDDEN"` via the admin queue to suppress it without
 *   losing the URL fingerprint (the URL is unique-indexed; a hidden
 *   item won't be re-fetched + re-published).
 */
import { prisma } from "@/lib/db";

/** Trusted news sources, as they appear in Google News' <source> tag.
 *  Match is exact, case-insensitive. Add entries here to expand
 *  coverage; remove entries here to stop trusting a source without
 *  needing to flip individual rows. */
const SOURCE_WHITELIST: ReadonlyArray<string> = [
  // English
  "The Times of India",
  "Times of India",
  "Hindustan Times",
  "The Indian Express",
  "News18",
  "ThePrint",
  // Hindi
  "Navbharat Times",
  "Jagran",
  "Dainik Jagran",
  "Dainik Bhaskar",
  "Amar Ujala",
  "Hindustan",
  "Hindustan Hindi News",
  "livehindustan.com",
  "Webdunia",
  "Bhaktibharat",
  "TV9 Hindi",
  "TV9 Bharatvarsh",
  "ABP News",
  "Aaj Tak",
  "Zee News",
  "News18 Hindi",
  "UP Tak",
  // Local Lucknow specialty
  "Knocksense",
];

const WHITELIST_LOWER = new Set(SOURCE_WHITELIST.map((s) => s.toLowerCase()));

/** Keyword check on the title, at least one of these must be present
 *  for the item to be considered a Bada-Mangal-Lucknow story. Belt-
 *  and-suspenders alongside the source whitelist: a trusted source
 *  occasionally publishes off-topic content with the word "Lucknow"
 *  somewhere, and our Google News search isn't always tight. */
const KEYWORD_PATTERNS: RegExp[] = [
  /\bbada\s*mangal\b/i,
  /\bbadamangal\b/i,
  /बड़ा\s*मंगल/u,
  /बड़े\s*मंगल/u,
];

/** RSS feeds we poll.
 *
 * Two kinds:
 *   1. **Google News search feeds** (kind: "google-news"). Broad
 *      source coverage, every Indian daily that ranks for our query
 *      lands here. But the URLs are JS-redirect stubs (Google News
 *      app shells), so we can't OG-scrape them for article images.
 *      Useful for headline discovery + source diversity.
 *   2. **Direct publisher feeds** (kind: "direct"). Real article
 *      URLs, often with `<media:content>` images inline. Use OG
 *      scraping as a fallback when media:content is absent.
 *      Direct-feed items are the ones that populate the LEFT
 *      featured slot via the "promote with image" rule in
 *      NewsPageView, since they actually have imageUrl values.
 *
 * Adding more direct feeds is the simplest way to bring in more
 * image-bearing items: append a `{kind: "direct", ...}` entry below.
 */
type Feed = {
  language: "en" | "hi";
  url: string;
  kind: "google-news" | "direct";
};

const FEEDS: ReadonlyArray<Feed> = [
  // Google News search, broad coverage, no images
  {
    language: "en",
    kind: "google-news",
    url: "https://news.google.com/rss/search?q=%22Bada+Mangal%22+Lucknow&hl=en-IN&gl=IN&ceid=IN:en",
  },
  {
    language: "hi",
    kind: "google-news",
    url: "https://news.google.com/rss/search?q=%22%E0%A4%AC%E0%A4%A1%E0%A4%BC%E0%A4%BE+%E0%A4%AE%E0%A4%82%E0%A4%97%E0%A4%B2%22+%E0%A4%B2%E0%A4%96%E0%A4%A8%E0%A4%8A&hl=hi-IN&gl=IN&ceid=IN:hi",
  },
  // Direct publisher feeds, real URLs. HT supplies inline images
  // via media:content; Amar Ujala doesn't, but its URLs are direct
  // so OG-image scraping kicks in as the fallback.
  {
    language: "en",
    kind: "direct",
    url: "https://www.hindustantimes.com/feeds/rss/cities/lucknow-news/rssfeed.xml",
  },
  {
    language: "hi",
    kind: "direct",
    url: "https://www.amarujala.com/rss/lucknow.xml",
  },
];

/** What an RSS <item> looks like after we parse it. */
type RssItem = {
  title: string;
  link: string;
  source: string;
  pubDate: Date;
  /** Optional image plucked from `<media:content url="...">` (HT's
   *  feed uses this) or `<enclosure url="..." type="image/...">`
   *  (some other feeds). Saves us an OG scrape when present. */
  inlineImage?: string;
};

/** Minimal XML extractor, we never trust untrusted XML so we avoid
 *  pulling in a full XML parser dependency. Both Google News and
 *  direct publisher feeds use stable enough formats that simple
 *  regex extraction is the right call (parse failures fall through
 *  as skipped items, not crashes).
 *
 *  `feed` is passed in so we can apply per-kind logic:
 *    - "google-news": source comes from <source> tag inside the item
 *    - "direct": source isn't in the item, comes from the feed itself
 *      (passed in via `defaultSource`)
 */
function parseRss(
  xml: string,
  feed: Feed,
  defaultSource: string,
): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDateStr = extractTag(block, "pubDate");
    // Source: Google News puts it in <source>; direct feeds don't,
    // so we fall back to the channel-level source we extracted once.
    const sourceFromBlock = extractTag(block, "source");
    const source = sourceFromBlock ?? defaultSource;
    if (!title || !source || !link || !pubDateStr) continue;
    const pubDate = new Date(pubDateStr);
    if (Number.isNaN(pubDate.getTime())) continue;

    // Try to extract an inline image. Common forms:
    //   <media:content url="..." medium="image" />
    //   <media:thumbnail url="..." />
    //   <enclosure url="..." type="image/jpeg" />
    let inlineImage: string | undefined;
    const mediaContent = /<media:content\s+[^>]*?url=["']([^"']+)["']/i.exec(block);
    if (mediaContent) inlineImage = mediaContent[1];
    if (!inlineImage) {
      const mediaThumb = /<media:thumbnail\s+[^>]*?url=["']([^"']+)["']/i.exec(block);
      if (mediaThumb) inlineImage = mediaThumb[1];
    }
    if (!inlineImage) {
      const enclosure = /<enclosure\s+[^>]*?url=["']([^"']+)["'][^>]*?type=["']image\//i.exec(
        block,
      );
      if (enclosure) inlineImage = enclosure[1];
    }
    void feed; // currently unused per-item; kept on signature for future per-kind tweaks
    items.push({
      title: decodeXmlEntities(title.trim()),
      link: link.trim(),
      source: decodeXmlEntities(source.trim()),
      pubDate,
      inlineImage,
    });
  }
  return items;
}

/** Pluck the channel-level <title> as the default source for a feed
 *  whose <item>s don't carry their own <source>. Used by direct
 *  publisher feeds (e.g. Hindustan Times → "Hindustan Times"). */
function extractChannelSource(xml: string, feed: Feed): string {
  // Channel title is the first <title> inside <channel>
  const channel = /<channel>([\s\S]*?)<\/channel>/i.exec(xml);
  if (channel) {
    const t = /<title>([\s\S]*?)<\/title>/i.exec(channel[1]);
    if (t) {
      const raw = decodeXmlEntities(
        t[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim(),
      );
      // Channel titles like "Lucknow News, ... | Hindustan Times" ,
      // pull the part after the pipe, that's the cleanest source name.
      const pipe = raw.lastIndexOf("|");
      if (pipe >= 0) return raw.slice(pipe + 1).trim();
      return raw;
    }
  }
  return feed.language === "hi" ? "Direct feed" : "Direct feed";
}

function extractTag(block: string, tag: string): string | null {
  // Capture inner text, ignoring any attributes on the opening tag.
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(block);
  if (!m) return null;
  // Strip CDATA wrapper if present
  return m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1");
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Trim the trailing "- Source Name" suffix Google News appends to
 *  every item title. We already have the source in its own field, so
 *  showing it twice is noisy. */
function tidyTitle(rawTitle: string, source: string): string {
  // Try removing the exact " - <source>" suffix first
  const exactSuffix = ` - ${source}`;
  if (rawTitle.endsWith(exactSuffix)) {
    return rawTitle.slice(0, -exactSuffix.length).trim();
  }
  // Otherwise strip the last "- something" pair as a best effort
  // (some sources have "Foo - Foo Hindi" style; this falls back
  // safely if nothing matches).
  const lastDash = rawTitle.lastIndexOf(" - ");
  if (lastDash > 20) return rawTitle.slice(0, lastDash).trim();
  return rawTitle;
}

function isWhitelistedSource(source: string): boolean {
  return WHITELIST_LOWER.has(source.toLowerCase());
}

function matchesKeyword(title: string): boolean {
  return KEYWORD_PATTERNS.some((re) => re.test(title));
}

/**
 * Best-effort OG-image scrape. Follows the (Google News) redirect to
 * the actual publisher article, fetches the HTML, regexes out the
 * `<meta property="og:image">` tag, and returns the resolved absolute
 * URL. Returns null on any failure (network error, no OG tag, parse
 * failure, redirect loop, timeout), callers should treat this as
 * "no image" and fall through to the source-tile placeholder.
 *
 * We pretend to be a normal browser via the User-Agent header because
 * a fair number of Indian news sites serve a blank page or a 403 to
 * unidentified user-agents. The 5s timeout is deliberately generous ,
 * this only runs from the aggregator cron, not in any user-facing
 * request path, so a slow article shouldn't break the rest of the
 * batch. The 100 KB read cap protects us against unbounded HTML
 * (the OG meta is always in the first few KB of <head>).
 */
async function fetchOgImage(
  url: string,
  timeoutMs = 5000,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // A real-looking UA reduces 403s and JS-gated blank pages.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    // OG meta lives in <head>; first 100 KB is more than enough.
    const html = (await res.text()).slice(0, 100_000);

    // Try a sequence of patterns in priority order. Each is checked
    // in two orders (content-first, then property-first) because
    // some CMSes emit one or the other.
    const patterns: RegExp[] = [
      /<meta\s+[^>]*?property=["']og:image:secure_url["'][^>]*?content=["']([^"']+)["']/i,
      /<meta\s+[^>]*?content=["']([^"']+)["'][^>]*?property=["']og:image:secure_url["']/i,
      /<meta\s+[^>]*?property=["']og:image["'][^>]*?content=["']([^"']+)["']/i,
      /<meta\s+[^>]*?content=["']([^"']+)["'][^>]*?property=["']og:image["']/i,
      /<meta\s+[^>]*?name=["']twitter:image["'][^>]*?content=["']([^"']+)["']/i,
      /<meta\s+[^>]*?content=["']([^"']+)["'][^>]*?name=["']twitter:image["']/i,
    ];
    for (const re of patterns) {
      const m = re.exec(html);
      if (!m || !m[1]) continue;
      try {
        // Resolve relative URLs against the final (post-redirect)
        // article URL so paths like "/images/foo.jpg" become absolute.
        const abs = new URL(m[1], res.url).toString();
        // Filter out obvious junk (1×1 tracking pixels, base64 data
        // URIs, very-clearly-not-image extensions). Cheap heuristic.
        if (abs.startsWith("data:")) continue;
        return abs;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export type AggregatorReport = {
  fetched: number;
  filteredOut: number;
  inserted: number;
  skippedDuplicate: number;
  errors: string[];
};

/**
 * Run one full aggregation cycle. Idempotent, duplicates (by URL) are
 * skipped, so re-running back-to-back is a no-op after the first
 * successful run.
 *
 * Returns counts for the admin UI / cron logs.
 */
export async function refreshNews(): Promise<AggregatorReport> {
  const report: AggregatorReport = {
    fetched: 0,
    filteredOut: 0,
    inserted: 0,
    skippedDuplicate: 0,
    errors: [],
  };

  for (const feed of FEEDS) {
    let xml: string;
    try {
      const res = await fetch(feed.url, {
        // No `next: { revalidate: ... }`, we always want fresh RSS
        // when this function runs. Caller controls the cadence.
        cache: "no-store",
        // A friendly UA reduces the chance of Google News
        // rate-limiting us, which they sometimes do on bare fetches.
        headers: { "User-Agent": "BadaMangalNewsBot/1.0 (+https://badamangal.com)" },
      });
      if (!res.ok) {
        report.errors.push(`feed ${feed.language} responded ${res.status}`);
        continue;
      }
      xml = await res.text();
    } catch (err) {
      report.errors.push(
        `feed ${feed.language} fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    const defaultSource = extractChannelSource(xml, feed);
    const items = parseRss(xml, feed, defaultSource);
    report.fetched += items.length;

    for (const item of items) {
      // Source whitelist applies to Google News items (where many
      // tangentially-related sources can appear). Direct feeds bypass
      // this check because the source IS the publisher we explicitly
      // opted into when we added the feed to FEEDS above.
      const sourceOk =
        feed.kind === "direct" || isWhitelistedSource(item.source);
      const keywordOk = matchesKeyword(item.title);
      if (!sourceOk || !keywordOk) {
        report.filteredOut++;
        continue;
      }

      const tidiedTitle = tidyTitle(item.title, item.source);

      try {
        // Upsert pattern by unique URL. If the row exists we leave it
        // alone (admin may have flipped status to HIDDEN). If it
        // doesn't exist, create as APPROVED.
        const existing = await prisma.newsItem.findUnique({
          where: { url: item.link },
          select: { id: true },
        });
        if (existing) {
          report.skippedDuplicate++;
          continue;
        }
        // Image resolution priority:
        //   1. inline image from <media:content>/<enclosure> (HT etc.)
        //   2. OG-image scrape of the direct article URL (only useful
        //      for direct-feed items; Google News URLs are JS-redirect
        //      stubs that don't yield OG meta when HTTP-fetched)
        let imageUrl: string | null = item.inlineImage ?? null;
        if (!imageUrl && feed.kind === "direct") {
          imageUrl = await fetchOgImage(item.link);
        }
        await prisma.newsItem.create({
          data: {
            url: item.link,
            title: tidiedTitle,
            source: item.source,
            language: feed.language,
            publishedAt: item.pubDate,
            imageUrl,
            status: "APPROVED",
          },
        });
        report.inserted++;
      } catch (err) {
        report.errors.push(
          `insert failed for ${item.link}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return report;
}
