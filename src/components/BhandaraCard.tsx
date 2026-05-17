import Link from "next/link";
import type { Bhandara } from "@/types/bhandara";
import type { Locale } from "@/content/strings";
import { strings } from "@/content/strings";
import { JaliCorner } from "@/components/ornaments";
// Single source-of-truth share builder. Card + detail page both call
// this so the message a recipient sees is identical regardless of
// where the sharer clicked from. See lib/share.ts for the rationale
// behind the new "🪔 Bada Mangal Bhandara, <name>" layout.
import { whatsappShareUrlForBhandara } from "@/lib/share";

type Props = {
  bhandara: Bhandara;
  locale: Locale;
  /**
   * Optional date override for the card's header chip. When set, the
   * card shows THIS date instead of running `nextServingDate()` over
   * the bhandara's full date list.
   *
   * Used by the per-date-expanded card grids (homepage + area page)
   * where a single bhandara serving on 8 Tuesdays renders as 8 cards,
   * each one pinned to its own Tuesday so the listing reads
   * chronologically. `null` means "show no date chip" (the bhandara
   * has no upcoming dates but we still want it in the grid).
   *
   * If undefined → fall back to next-upcoming autopick. That preserves
   * the original single-card-per-bhandara behaviour for any caller
   * that doesn't opt in to expansion.
   */
  pinnedDate?: string | null;
};

function format12h(time: string): string {
  if (!time) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(min).padStart(2, "0")} ${period}`;
}

const HINDI_MONTHS_SHORT = [
  "जन", "फ़र", "मार्च", "अप्रैल", "मई", "जून",
  "जुल", "अग", "सित", "अक्ट", "नव", "दिस",
];
const EN_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Today's date as YYYY-MM-DD in IST. */
function istTodayIso(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** Format an ISO date "12 May" / "12 मई", or "Today" / "आज" if it's today. */
function shortDate(iso: string, isHi: boolean): string {
  if (!iso) return "";
  if (iso === istTodayIso()) return isHi ? "आज" : "Today";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const month = (isHi ? HINDI_MONTHS_SHORT : EN_MONTHS_SHORT)[m - 1];
  return `${d} ${month}`;
}

/** Pick the bhandara's next-upcoming serving Tuesday (or today if it serves today). */
function nextServingDate(dates: string[]): string | null {
  if (!Array.isArray(dates) || dates.length === 0) return null;
  const today = istTodayIso();
  if (dates.includes(today)) return today;
  const upcoming = dates.filter((d) => d > today).sort();
  if (upcoming.length > 0) return upcoming[0];
  const past = [...dates].sort();
  return past[past.length - 1] ?? null;
}

// (whatsappShareUrl removed, replaced by lib/share's locale-aware
// `whatsappShareUrlForBhandara`. The card now passes the active
// locale so Hindi vs English shares get appropriate Devanagari name,
// menu, and date formatting plus a localised ?lang query on the URL.)

function googleDirectionsUrl(b: Bhandara): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
}

export default function BhandaraCard({ bhandara, locale, pinnedDate }: Props) {
  const t = strings[locale];
  const isHi = locale === "hi";
  const displayName = isHi ? bhandara.nameHi : bhandara.name;
  const displayAddress = isHi
    ? bhandara.addressHi ?? bhandara.address
    : bhandara.address;
  const areaLabel = t.areas[bhandara.area] ?? bhandara.area;
  const menuItems = isHi ? bhandara.menuHi : bhandara.menu;
  const langSuffix = locale === "en" ? "?lang=en" : "";

  // Resolve the serving date once at function-body scope so it can be
  // shared between the header chip render AND the GA click trackers
  // on the action links below. With per-date card expansion in the
  // listings, the same bhandara slug can produce many cards each with
  // a different `pinnedDate`, GA needs to know WHICH date drove a
  // directions/share click, otherwise we can't tell whether 19 May or
  // 26 May was the bigger driver of intent.
  //   pinnedDate undefined → caller didn't opt in; pick next-upcoming
  //   pinnedDate null      → caller said NO date chip (no upcoming)
  //   pinnedDate "YYYY-MM-DD" → show this specific date
  const serveOn =
    pinnedDate !== undefined
      ? pinnedDate
      : nextServingDate(bhandara.tuesdayDates ?? []);
  // Empty-string sentinel for the data-ga attribute so undefined
  // never reaches the DOM; the GAClickDelegate's attribute scan
  // then sends `date: ""` for date-less cards, which is harmless
  // and keeps the slice possible in GA reports.
  const gaDate = serveOn ?? "";

  return (
    <article className="bm-card group relative h-full w-full flex flex-col">
      {/* Photo / illustrated header strip */}
      <div className="bm-card-photo">
        {/* Jali corners */}
        <JaliCorner
          position="tl"
          className="absolute top-2 left-2 w-9 h-9 text-gold-500/70"
        />
        <JaliCorner
          position="tr"
          className="absolute top-2 right-2 w-9 h-9 text-gold-500/70"
        />

        {bhandara.photoUrl ? (
          // Same colour-aware backdrop pattern we use for the live-feed
          // cards: a blurred + scaled copy of the photo fills the well,
          // then the actual image renders on top with `object-contain`
          // so vertical posters and square photos both show their full
          // content without cropping.
          <>
            <span
              aria-hidden
              className="absolute inset-0 bg-center bg-cover scale-110"
              style={{
                backgroundImage: `url(${JSON.stringify(bhandara.photoUrl).slice(1, -1)})`,
                filter: "blur(28px) saturate(1.1)",
                opacity: 0.55,
              }}
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-cream-50/35"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bhandara.photoUrl}
              alt={`${displayName} bhandara in ${areaLabel}, Lucknow`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="relative w-full h-full object-contain"
            />
          </>
        ) : (
          // No-photo fallback: branded 4:3 share graphic served from
          // /public/illustrations/card-fallback.webp
          // (Share-Graphics/Final-4_3-Default-2.png, resized to
          // 1136×852 and re-encoded — ~215 KB on the wire instead
          // of the source 8.9 MB). Aspect matches .bm-card-photo's
          // own 4/3 ratio, so `object-cover` fills the well edge-to-
          // edge with no letterbox, no blurred backdrop scaffolding
          // needed. The browser fetches the asset once per page and
          // reuses the cached bitmap on every no-photo card, so a
          // page with 20 fallback cards costs the same as a page
          // with one. `loading="lazy"` keeps it out of the initial
          // critical request set; the JaliCorner ornaments + area
          // pill overlay above this <img> still stack correctly via
          // their `absolute` positioning.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/illustrations/card-fallback.webp"
            alt={`${displayName} bhandara in ${areaLabel}, Lucknow`}
            loading="lazy"
            decoding="async"
            className="relative w-full h-full object-cover"
          />
        )}

        {/* Area label as a foot-banner overlay */}
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-cream-50/95 text-ink-900 border border-gold-500/45 rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm">
          {areaLabel}
        </span>

      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-5 flex flex-col gap-3 flex-1">
        <header>
          {(() => {
            // serveOn is now resolved at function-body scope above so
            // both this header chip and the action-link GA trackers
            // below share the same date value.
            const dateLabel = serveOn ? shortDate(serveOn, isHi) : "";
            const isToday = dateLabel === "Today" || dateLabel === "आज";
            return (
              <p className="font-mukta uppercase tracking-[0.22em] text-[0.62rem] font-semibold flex items-center gap-1.5 flex-wrap">
                {dateLabel ? (
                  <span
                    className={
                      isToday ? "text-saffron-600" : "text-gold-500"
                    }
                  >
                    {dateLabel}
                  </span>
                ) : null}
                {dateLabel ? (
                  <span aria-hidden className="text-gold-500/60">·</span>
                ) : null}
                <span className="text-gold-500">
                  {format12h(bhandara.timeStart)}
                  {bhandara.timeEnd ? ` – ${format12h(bhandara.timeEnd)}` : ""}
                </span>
              </p>
            );
          })()}
          <h3
            className={`mt-1.5 leading-snug ${
              isHi
                ? "font-deva font-semibold text-sindoor-700 text-lg"
                : "font-fraunces font-semibold text-sindoor-700 text-xl"
            }`}
          >
            {/* Stretched link: click anywhere on the card (except the action
                buttons below, which sit above via z-10) opens the detail. */}
            <Link
              href={`/bhandara/${bhandara.slug}${langSuffix}`}
              data-ga="card_open_bhandara"
              data-ga-slug={bhandara.slug}
              data-ga-date={gaDate}
              className="inline-flex items-center gap-1.5 flex-wrap hover:underline decoration-saffron-500/70 underline-offset-4 before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:cursor-pointer focus-visible:outline-none focus-visible:before:ring-2 focus-visible:before:ring-saffron-600"
            >
              <span>{displayName}</span>
              {bhandara.isVerified ? <VerifiedBadge isHi={isHi} /> : null}
            </Link>
          </h3>
        </header>

        <p className="text-sm text-ink-600 leading-relaxed line-clamp-2">
          {displayAddress}
        </p>

        {/* Menu pills */}
        {menuItems.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {menuItems.slice(0, 5).map((item) => (
              <span
                key={item}
                className="text-xs bg-saffron-50 text-ink-900 border border-saffron-500/40 rounded-full px-2.5 py-0.5"
              >
                {item}
              </span>
            ))}
            {menuItems.length > 5 ? (
              <span className="text-xs text-ink-600/70 px-1 py-0.5">
                +{menuItems.length - 5}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Action row, relative + z-10 keeps these buttons clickable above
            the stretched title link that covers the whole card. */}
        <div className="relative z-10 mt-auto pt-2 flex flex-wrap gap-2">
          <a
            href={googleDirectionsUrl(bhandara)}
            target="_blank"
            rel="noreferrer noopener"
            data-ga="card_get_directions"
            data-ga-slug={bhandara.slug}
            data-ga-area={bhandara.area}
            data-ga-date={gaDate}
            className="btn btn-primary btn-sm"
          >
            <IconPin />
            {t.cta.getDirections}
          </a>
          <a
            href={whatsappShareUrlForBhandara(bhandara, locale)}
            target="_blank"
            rel="noreferrer noopener"
            data-ga="card_share_whatsapp"
            data-ga-slug={bhandara.slug}
            data-ga-area={bhandara.area}
            data-ga-date={gaDate}
            className="btn btn-leaf btn-sm"
            aria-label={t.cta.shareWhatsapp}
          >
            <IconWhatsapp />
            {t.cta.shareWhatsapp}
          </a>
        </div>
      </div>
    </article>
  );
}

function VerifiedBadge({ isHi }: { isHi: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-leaf-600/12 border border-leaf-600/45 px-2 py-0.5 text-[10px] font-mukta font-semibold uppercase tracking-[0.18em] text-leaf-600 align-middle"
      title={isHi ? "BadaMangal टीम द्वारा सत्यापित" : "Verified by the BadaMangal team"}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2 14.39 4.39 17.66 3.66 18.39 6.93 21.66 7.66 20.93 10.93 23.32 12 20.93 13.07 21.66 16.34 18.39 17.07 17.66 20.34 14.39 19.61 12 22 9.61 19.61 6.34 20.34 5.61 17.07 2.34 16.34 3.07 13.07 0.68 12 3.07 10.93 2.34 7.66 5.61 6.93 6.34 3.66 9.61 4.39z" />
        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {isHi ? "सत्यापित" : "Verified"}
    </span>
  );
}

function IconPin() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 -mt-px"
    >
      <path d="M12 21s-6.5-7-6.5-12a6.5 6.5 0 1 1 13 0c0 5-6.5 12-6.5 12z" />
      <circle cx="12" cy="9" r="2.25" />
    </svg>
  );
}

function IconWhatsapp() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden
      className="shrink-0 -mt-px"
    >
      <path d="M16 3C8.82 3 3 8.82 3 16c0 2.29.6 4.43 1.65 6.3L3 29l6.86-1.62A12.95 12.95 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 23.5c-1.93 0-3.74-.5-5.32-1.4l-.38-.22-4.07.96.97-3.96-.25-.4A10.5 10.5 0 1 1 16 26.5zm6.06-7.86c-.33-.17-1.96-.97-2.27-1.08-.3-.11-.52-.17-.74.17-.22.33-.85 1.07-1.04 1.29-.19.22-.38.25-.71.08-.33-.17-1.4-.52-2.66-1.65-.98-.88-1.65-1.96-1.84-2.29-.19-.33-.02-.51.15-.67.15-.15.33-.39.5-.58.16-.19.22-.33.33-.55.11-.22.06-.41-.03-.58-.08-.17-.74-1.79-1.01-2.45-.27-.66-.55-.57-.74-.58l-.63-.01a1.21 1.21 0 0 0-.88.41c-.3.33-1.15 1.13-1.15 2.75 0 1.62 1.18 3.19 1.34 3.41.16.22 2.32 3.55 5.62 4.97 2.61 1.13 3.14 1.06 3.71.99.57-.06 1.84-.75 2.1-1.48.26-.73.26-1.36.18-1.49-.08-.13-.3-.21-.63-.38z" />
    </svg>
  );
}
