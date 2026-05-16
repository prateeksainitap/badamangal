import Link from "next/link";
import type { Bhandara } from "@/types/bhandara";
import type { Locale } from "@/content/strings";
import { strings } from "@/content/strings";

/**
 * "Featured" bhandara row — sits high on the homepage, above the
 * countdown and the map, so visitors who land via WhatsApp shares
 * or organic search see a concrete answer to "where can I go to a
 * bhandara today?" before they have to scroll, scan, or filter.
 *
 * The GA4 data showed only 12 bhandara-card clicks vs 246 hero-CTA
 * clicks (one bhandara open per 20+ landings) — cards were too far
 * down the page. This section is the fix: highest-intent visitors
 * get 3-4 specific bhandaras up top, photographed, dated, and a
 * one-tap WhatsApp share button.
 *
 * Selection algorithm (priority order):
 *   1. Bhandaras serving TODAY (IST) — maximum relevance
 *   2. Bhandaras serving in the next 7 days, with a photo, verified
 *   3. Any verified bhandara with a photo
 *   4. Any APPROVED bhandara with a photo
 *
 * Cap at 4 cards (the grid is 1col on mobile, 2col on tablet,
 * 4col on desktop). Cards link to the bhandara detail page.
 *
 * Important: this is a SERVER component. Selection runs on the
 * server during ISR revalidation — no client-side date arithmetic
 * means the "today" picks are accurate at render time (within the
 * 60s revalidation window) and don't flicker post-hydration.
 */
type Props = {
  listings: Bhandara[];
  locale: Locale;
};

/** "YYYY-MM-DD" of today's date in IST. */
function todayIst(): string {
  // toISOString returns UTC; shift forward by 5h30m to get IST.
  // crude but correct for the date string we need.
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function pickFeatured(listings: Bhandara[], today: string, max = 4): Bhandara[] {
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Helper: pull the soonest serving date for ordering within a
  // bucket. Returns "9999" for bhandaras without an upcoming date
  // so they sort to the bottom.
  const soonest = (b: Bhandara): string => {
    const upcoming = (b.tuesdayDates ?? [])
      .filter((d) => d >= today)
      .sort();
    return upcoming[0] ?? "9999";
  };

  const buckets = {
    today: [] as Bhandara[],
    weekVerifiedWithPhoto: [] as Bhandara[],
    verifiedWithPhoto: [] as Bhandara[],
    anyWithPhoto: [] as Bhandara[],
    rest: [] as Bhandara[],
  };

  for (const b of listings) {
    const dates = b.tuesdayDates ?? [];
    if (dates.includes(today)) {
      buckets.today.push(b);
      continue;
    }
    const servingThisWeek = dates.some((d) => d >= today && d <= inSevenDays);
    if (servingThisWeek && b.isVerified && b.photoUrl) {
      buckets.weekVerifiedWithPhoto.push(b);
      continue;
    }
    if (b.isVerified && b.photoUrl) {
      buckets.verifiedWithPhoto.push(b);
      continue;
    }
    if (b.photoUrl) {
      buckets.anyWithPhoto.push(b);
      continue;
    }
    buckets.rest.push(b);
  }

  // Sort each bucket by soonest serving date so the most urgent
  // surface first within a category.
  const sortBySoonest = (list: Bhandara[]) =>
    list.slice().sort((a, b) => soonest(a).localeCompare(soonest(b)));

  return [
    ...sortBySoonest(buckets.today),
    ...sortBySoonest(buckets.weekVerifiedWithPhoto),
    ...sortBySoonest(buckets.verifiedWithPhoto),
    ...sortBySoonest(buckets.anyWithPhoto),
    ...sortBySoonest(buckets.rest),
  ].slice(0, max);
}

function shortDate(iso: string, isHi: boolean): string {
  if (!iso || iso === "9999") return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return "";
  const en = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hi = ["जन", "फ़र", "मार्च", "अप्रैल", "मई", "जून", "जुल", "अग", "सित", "अक्ट", "नव", "दिस"];
  return `${d} ${(isHi ? hi : en)[m - 1]}`;
}

export default function FeaturedBhandaras({ listings, locale }: Props) {
  const isHi = locale === "hi";
  const t = strings[locale];
  const langSuffix = isHi ? "" : "?lang=en";

  const today = todayIst();
  const featured = pickFeatured(listings, today, 4);
  if (featured.length === 0) return null;

  const todayServing = featured.some((b) => b.tuesdayDates.includes(today));

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-2 sm:pt-10 sm:pb-4">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4 sm:mb-5">
        <div>
          <p className="font-mukta uppercase tracking-[0.28em] text-saffron-600 text-[0.65rem] sm:text-xs font-semibold">
            {todayServing
              ? isHi
                ? "आज सेवा हो रही है"
                : "Serving today"
              : isHi
                ? "इस सप्ताह"
                : "This week"}
          </p>
          <h2
            className={`mt-1 ${
              isHi
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-bold text-sindoor-700"
            } text-2xl sm:text-3xl`}
          >
            {isHi ? "प्रमुख भंडारे" : "Featured bhandaras"}
          </h2>
        </div>
        <Link
          href={`/#map`}
          data-ga="cta_featured_see_all"
          className="text-sm font-semibold text-saffron-600 hover:text-sindoor-700 transition-colors"
        >
          {isHi ? "सभी भंडारे देखें →" : "See all on map →"}
        </Link>
      </div>

      <ul
        className={`grid gap-3 sm:gap-4 ${
          featured.length === 1
            ? "sm:grid-cols-1"
            : featured.length === 2
              ? "sm:grid-cols-2"
              : featured.length === 3
                ? "sm:grid-cols-3"
                : "sm:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {featured.map((b) => {
          const name = isHi ? b.nameHi : b.name;
          const areaLabel = t.areas[b.area] ?? b.area;
          const nextDate = (b.tuesdayDates ?? [])
            .filter((d) => d >= today)
            .sort()[0];
          const isToday = nextDate === today;
          const dateLabel = isToday
            ? isHi
              ? "आज"
              : "Today"
            : shortDate(nextDate ?? "", isHi);

          return (
            <li
              key={b.id}
              className="group relative rounded-2xl overflow-hidden border border-gold-500/45 bg-cream-50 shadow-warm flex flex-col"
            >
              {/* Photo header, falls back to a saffron sunburst panel
                  when no photo is uploaded — matches the card-grid
                  treatment so the visual rhythm is consistent. */}
              {b.photoUrl ? (
                <div className="relative aspect-[4/3] sm:aspect-square w-full overflow-hidden bg-saffron-50">
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-center bg-cover scale-110"
                    style={{
                      backgroundImage: `url(${JSON.stringify(b.photoUrl).slice(1, -1)})`,
                      filter: "blur(24px) saturate(1.1)",
                      opacity: 0.55,
                    }}
                  />
                  <span aria-hidden className="absolute inset-0 bg-cream-50/30" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.photoUrl}
                    alt={`${name} bhandara in ${areaLabel}, Lucknow`}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="relative w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className="aspect-[4/3] sm:aspect-square w-full flex items-center justify-center text-saffron-600 text-3xl"
                  style={{
                    background:
                      "radial-gradient(360px 220px at 50% 40%, rgba(242,148,76,0.22), transparent 70%), #FFF7EB",
                  }}
                  aria-hidden
                >
                  🪔
                </div>
              )}

              {/* Today / Verified pill row, top-left over the photo */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                {isToday ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-saffron-600 text-cream-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] font-semibold">
                    <span className="block w-1.5 h-1.5 rounded-full bg-cream-50 motion-safe:animate-pulse" />
                    {isHi ? "आज" : "Today"}
                  </span>
                ) : dateLabel ? (
                  <span className="inline-flex items-center rounded-full bg-cream-50/95 backdrop-blur border border-saffron-500/55 px-2 py-0.5 text-[10px] font-semibold text-sindoor-700">
                    {dateLabel}
                  </span>
                ) : null}
                {b.isVerified ? (
                  <span
                    title={isHi ? "सत्यापित" : "Verified"}
                    aria-label={isHi ? "सत्यापित" : "Verified"}
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-leaf-600 text-cream-50 text-[10px]"
                  >
                    ✓
                  </span>
                ) : null}
              </div>

              {/* Info */}
              <div className="px-3 py-2.5 flex-1 flex flex-col gap-1">
                <p
                  className={`text-sm font-semibold leading-tight line-clamp-2 ${
                    isHi ? "font-deva text-sindoor-700" : "font-fraunces text-sindoor-700"
                  }`}
                >
                  {name}
                </p>
                <p className="text-[11px] text-ink-600 line-clamp-1">
                  {areaLabel}
                  {b.timeStart ? ` · ${b.timeStart}` : ""}
                </p>
              </div>

              {/* Stretched-link overlay — whole card is clickable. */}
              <Link
                href={`/bhandara/${b.slug}${langSuffix}`}
                data-ga="featured_open_bhandara"
                data-ga-slug={b.slug}
                aria-label={
                  isHi
                    ? `${name} खोलें`
                    : `Open ${name}`
                }
                className="absolute inset-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600/60"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
