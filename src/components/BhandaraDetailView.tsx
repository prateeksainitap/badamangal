"use client";

import Link from "next/link";
import BackToHomeLink from "@/components/BackToHomeLink";
import BhandaraCard from "@/components/BhandaraCard";
import BhandaraMap from "@/components/BhandaraMap";
import CopyButton from "@/components/CopyButton";
import MobileStickyActions from "@/components/MobileStickyActions";
import OrganiserUpiBlock from "@/components/OrganiserUpiBlock";
import { JaliCorner } from "@/components/ornaments";
import { strings } from "@/content/strings";
import { formatEnglishDate, formatHindiDate, istTodayIso } from "@/lib/dates";
import type { Bhandara } from "@/types/bhandara";
import { areaToSlug } from "@/lib/areaSlug";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  bhandaraShareText,
  hasMapPin,
  whatsappShareUrlForBhandara as whatsappShareUrl,
} from "@/lib/share";

/**
 * /bhandara/[slug] body, extracted out of the server-rendered page so
 * every label (Back-home / status pill / verified badge / area chip /
 * "Get directions" / "Share on WhatsApp" / "Copy message" / "Photo /
 * pamphlet" / "On the thali" / "Serving on" / "Organized by" /
 * "Landmark" / "Hosting your own?" / "List your bhandara" / nearby
 * heading + CTA) swaps on the Hindi toggle without a server-tree
 * refresh.
 *
 * The server wrapper still owns: the Prisma queries (this bhandara +
 * other-in-area), JSON-LD scripts (FoodEvent + LocalBusiness +
 * BreadcrumbList + Organization), and the LCP <link rel="preload">.
 */
type Props = {
  b: Bhandara;
  others: Bhandara[];
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

function googleDirectionsUrl(b: Bhandara): string {
  const base = `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
  return b.googlePlaceId ? `${base}&destination_place_id=${b.googlePlaceId}` : base;
}

function upiUrl(b: Bhandara): string | null {
  if (!b.upiId) return null;
  const params = new URLSearchParams({
    pa: b.upiId,
    pn: b.organizerName,
    am: "251",
    cu: "INR",
    tn: `Bada Mangal seva for ${b.name}`,
  });
  return `upi://pay?${params.toString()}`;
}

function nextServingDate(b: Bhandara, now: Date): Date | null {
  // If end-time is missing, fall back to a generous late-evening cutoff so
  // the listing still shows up as "upcoming" through the day of service.
  const endHHMM = b.timeEnd && /^\d{2}:\d{2}$/.test(b.timeEnd) ? b.timeEnd : "21:00";
  const upcoming = b.tuesdayDates
    .map((iso) => new Date(`${iso}T${endHHMM}:00+05:30`))
    .filter((d) => d.getTime() >= now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0] ?? null;
}

function isServingNow(b: Bhandara, now: Date): boolean {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const isoToday = ist.toISOString().slice(0, 10);
  if (!b.tuesdayDates.includes(isoToday)) return false;
  const endHHMM = b.timeEnd && /^\d{2}:\d{2}$/.test(b.timeEnd) ? b.timeEnd : "21:00";
  const start = new Date(`${isoToday}T${b.timeStart}:00+05:30`).getTime();
  const end = new Date(`${isoToday}T${endHHMM}:00+05:30`).getTime();
  return now.getTime() >= start && now.getTime() <= end;
}

export default function BhandaraDetailView({ b, others }: Props) {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  const now = new Date();
  // YYYY-MM-DD calendar day in IST. Used for date-string comparisons
  // against b.tuesdayDates entries so a service day stays "today"
  // for the entire calendar day, not just until the event time hits.
  const todayIstStr = istTodayIso(now);
  const upi = upiUrl(b);
  const nextDate = nextServingDate(b, now);
  const servingNow = isServingNow(b, now);

  const displayName = isHi ? b.nameHi : b.name;
  const displayAddress = isHi ? (b.addressHi ?? b.address) : b.address;
  const displayDescription = isHi ? (b.descriptionHi ?? b.description) : b.description;
  const areaLabel = t.areas[b.area] ?? b.area;

  const statusPill = servingNow
    ? { text: t.detail.statusOpen, classes: "bg-leaf-600 text-cream-50" }
    : nextDate
      ? {
          text: `${t.detail.statusUpcoming} ${
            isHi ? formatHindiDate(nextDate) : formatEnglishDate(nextDate)
          }`,
          classes: "bg-saffron-50 text-sindoor-700 border border-saffron-500/60",
        }
      : { text: t.detail.seasonOver, classes: "bg-cream-50 text-ink-600 border border-gold-500/60" };

  return (
    <article className="pb-24 sm:pb-16">
      {/* HERO, editorial split: text on the cream paper background, photo
          framed cleanly on the right. The photo is no longer a full-bleed
          background, so loud pamphlets / banners stop fighting the text. */}
      <header className="relative isolate overflow-hidden">
        {/* Soft saffron radial wash behind the whole hero */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(900px 500px at 12% 18%, rgba(242,148,76,0.16), transparent 65%), radial-gradient(900px 500px at 90% 90%, rgba(156,42,42,0.10), transparent 65%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 sm:pt-12 pb-12 sm:pb-16">
          {/* Breadcrumb / back, uses history.back() when the user came
              from inside the site (so they land on the exact card or
              map pin they clicked from); falls back to /#map for deep
              links and social referrals. */}
          <BackToHomeLink
            fallbackHref={`/${langSuffix}#map`}
            label={t.cta.backHome}
            className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-sindoor-700"
          />

          <div className="mt-6 grid gap-8 lg:gap-12 lg:grid-cols-12 items-center">
            {/* Left 7/12: text */}
            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] px-3 py-1 rounded-full ${statusPill.classes}`}
                >
                  {servingNow ? (
                    <span className="block w-1.5 h-1.5 rounded-full bg-cream-50 motion-safe:animate-pulse" />
                  ) : null}
                  {statusPill.text}
                </span>
                <span className="inline-flex items-center text-[0.7rem] uppercase tracking-[0.28em] text-saffron-600 bg-saffron-50 border border-saffron-500/40 rounded-full px-3 py-1 font-semibold">
                  {areaLabel}
                </span>
                {b.isVerified ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.18em] text-leaf-600 bg-leaf-600/10 border border-leaf-600/45 rounded-full px-3 py-1 font-semibold"
                    title={isHi ? "BadaMangal टीम द्वारा सत्यापित" : "Verified by the BadaMangal team"}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 2 14.39 4.39 17.66 3.66 18.39 6.93 21.66 7.66 20.93 10.93 23.32 12 20.93 13.07 21.66 16.34 18.39 17.07 17.66 20.34 14.39 19.61 12 22 9.61 19.61 6.34 20.34 5.61 17.07 2.34 16.34 3.07 13.07 0.68 12 3.07 10.93 2.34 7.66 5.61 6.93 6.34 3.66 9.61 4.39z" />
                      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    {isHi ? "सत्यापित" : "Verified"}
                  </span>
                ) : null}
              </div>

              {/* Headline */}
              <h1
                className={`leading-tight text-balance text-sindoor-700 ${
                  isHi
                    ? "font-tiro text-3xl sm:text-5xl lg:text-6xl"
                    : "font-fraunces font-semibold text-3xl sm:text-5xl lg:text-6xl"
                }`}
              >
                {displayName}
              </h1>

              {/* Meta line, time + landmark only (kept short on a single
                  row so it reads as a compact subhead under the headline).
                  Address + map-link live in a separate block right below
                  so the address text can wrap to its natural width without
                  pushing the time off-screen on mobile. */}
              <p className="mt-5 text-ink-900 text-sm sm:text-base flex flex-wrap items-center gap-x-3 gap-y-1 font-numerals tabular-nums">
                <span className="inline-flex items-center gap-1.5 text-saffron-600">
                  <IconClock />
                  <span className="text-ink-900">
                    {format12h(b.timeStart)}
                    {b.timeEnd ? ` – ${format12h(b.timeEnd)}` : ""}
                  </span>
                </span>
                {b.landmark ? (
                  <>
                    <span aria-hidden className="text-gold-500/60">·</span>
                    <span className="inline-flex items-center gap-1.5 text-saffron-600">
                      <IconPin />
                      <span className="text-ink-900">{b.landmark}</span>
                    </span>
                  </>
                ) : null}
              </p>

              {/* Address + description, sits as a quiet block under
                  the time row. The Google Maps URL is no longer shown
                  inline; the Copy-link CTA in the action row below
                  copies it on demand instead. */}
              <div className="mt-4 grid gap-2 max-w-2xl">
                <p className="inline-flex items-start gap-2 text-ink-900 leading-relaxed text-sm sm:text-base">
                  <span className="mt-0.5 shrink-0 text-saffron-600">
                    <IconPin />
                  </span>
                  <span>{displayAddress}</span>
                </p>
                {displayDescription ? (
                  <p className="text-ink-600 leading-relaxed text-sm">
                    {displayDescription}
                  </p>
                ) : null}
              </div>

              {/* Primary action row, Get directions / Share / Copy
                  link. Copy link is a tertiary outlined pill, sized to
                  match the .btn-lg neighbours so the three CTAs read as
                  one row of decisions. */}
              <div className="mt-6 flex flex-wrap gap-2.5">
                {hasMapPin(b) ? (
                  <a
                    href={googleDirectionsUrl(b)}
                    target="_blank"
                    rel="noreferrer noopener"
                    data-ga="detail_get_directions"
                    data-ga-slug={b.slug}
                    className="btn btn-primary btn-lg"
                  >
                    <IconPinSolid />
                    {t.cta.getDirections}
                  </a>
                ) : null}
                <a
                  href={whatsappShareUrl(b, locale)}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-ga="detail_share_whatsapp"
                  data-ga-slug={b.slug}
                  className="btn btn-leaf btn-lg"
                >
                  <IconWhatsapp />
                  {t.cta.shareWhatsapp}
                </a>
                {/* Copy now copies the full warm bhandara share
                    message (intro + name + date + place + menu +
                    BadaMangal link + Google Maps link + closer), not
                    just the maps URL, consistent with every other
                    Copy button on the site. See lib/share.ts. */}
                <CopyButton
                  value={bhandaraShareText(b, locale)}
                  label={isHi ? "संदेश कॉपी करें" : "Copy message"}
                  copiedLabel={isHi ? "कॉपी हो गया" : "Copied!"}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-saffron-500/55 bg-cream-50 hover:bg-saffron-50 hover:border-saffron-500 text-saffron-600 hover:text-sindoor-700 text-base font-semibold px-5 py-3 transition-colors"
                />
              </div>
            </div>

            {/* Right 5/12: framed photo card.
                Hidden on mobile / tablet, since the dedicated
                "Photo / pamphlet" section below already shows the image at
                full size, no point doubling it up on small screens. */}
            <div className="hidden lg:block lg:col-span-5">
              <div className="relative mx-auto w-full max-w-md lg:max-w-none rounded-[2rem] overflow-hidden border-2 border-gold-500/55 bg-cream-50 shadow-warm">
                {b.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.photoUrl}
                    alt={`${b.name} bhandara in ${areaLabel}, Lucknow`}
                    /* `object-contain` + flexible height + max cap = the
                       container adapts to the image's natural aspect ratio,
                       so a vertical pamphlet shows uncropped and a square
                       photo doesn't get letterboxed unnecessarily.
                       LCP hint: this image is almost always the Largest
                       Contentful Paint element on desktop. `loading=
                       "eager"` + `fetchPriority="high"` makes the browser
                       request it before any lazy-loaded assets, dropping
                       LCP by 200-400ms on cold loads. */
                    className="block w-full max-h-[640px] h-auto object-contain bg-cream-50"
                    referrerPolicy="no-referrer"
                    loading="eager"
                    fetchPriority="high"
                  />
                ) : (
                  <div
                    className="aspect-[4/5] flex items-center justify-center text-center px-6"
                    style={{
                      background:
                        "radial-gradient(600px 400px at 50% 30%, rgba(242,148,76,0.30), transparent 65%), #FFF7EB",
                    }}
                  >
                    <div>
                      <p className="font-tiro text-4xl text-sindoor-700 leading-tight">
                        {b.nameHi}
                      </p>
                      <p className="mt-3 font-fraunces italic text-ink-600">
                        {t.detail.photoPlaceholder}
                      </p>
                    </div>
                  </div>
                )}
                {/* Jali corners frame the photo */}
                <JaliCorner position="tl" className="absolute top-3 left-3 w-10 h-10 text-gold-500/95" />
                <JaliCorner position="tr" className="absolute top-3 right-3 w-10 h-10 text-gold-500/95" />
                <JaliCorner position="bl" className="absolute bottom-3 left-3 w-10 h-10 text-gold-500/95" />
                <JaliCorner position="br" className="absolute bottom-3 right-3 w-10 h-10 text-gold-500/95" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile sticky bottom bar, Directions / WhatsApp / Sponsor.
          When the bhandara has no map pin (geocoding failed and
          admin hasn't fixed coords), pass null for the directions
          link so MobileStickyActions can hide that slot. */}
      <MobileStickyActions
        directionsHref={hasMapPin(b) ? googleDirectionsUrl(b) : null}
        whatsappHref={whatsappShareUrl(b, locale)}
        sponsorHref={upi ?? null}
        organizerPhone={b.organizerPhone}
        locale={locale}
        // Audit-trail props. When the bhandara has a UPI ID, tapping
        // Sponsor now fires a DonationIntent beacon to
        // /api/donations/intent before opening the UPI app. The
        // server-side row records bhandaraId + amount + recipient +
        // ipHash + UA so we have a "who tapped to pay whom" audit
        // trail. See model DonationIntent in prisma/schema.prisma.
        bhandaraId={b.id}
        recipientUpiId={b.upiId ?? undefined}
        recipientName={b.organizerName}
      />

      {/* PHOTO / PAMPHLET, full-quality view of whatever the organizer
          uploaded (a banner, pandal photo, or printed pamphlet image). */}
      {b.photoUrl ? (
        <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-10">
          <div className="rounded-3xl border border-gold-500/40 bg-cream-50 overflow-hidden">
            <header className="px-6 pt-5 flex items-center gap-2.5">
              <SectionIcon><IconImage /></SectionIcon>
              <h2 className="font-fraunces text-xl text-sindoor-700 font-semibold">
                {isHi ? "तस्वीर / पर्चा" : "Photo / pamphlet"}
              </h2>
            </header>
            <div className="mt-4 bg-saffron-50 flex items-center justify-center">
              {/* This is the LCP on mobile (the lg-only hero above is
                  hidden). Same eager + high-priority hints so cold
                  mobile loads paint the image without blocking on
                  lazy-loaded scripts. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.photoUrl}
                loading="eager"
                fetchPriority="high"
                alt={b.name}
                className="block max-h-[640px] w-auto max-w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* SPONSOR / DONATE, organiser-direct UPI block.
          Renders only when the bhandara has BOTH a UPI ID and an
          uploaded bank-issued QR (b.upiQrUrl). The mobile sticky bar
          continues to carry the secondary "Sponsor" tap; this block
          is the primary in-page surface.

          A second, fuller donate card (the parked SponsorBhandara
          component with self-generated QR + amount selector) is
          still on the bench pending the Razorpay onboarding +
          Section 8 / 80G registration decision. Until that ships,
          this block carries the donation surface end-to-end. */}
      {b.upiId && b.upiQrUrl ? (
        <OrganiserUpiBlock
          upiId={b.upiId}
          organizerName={b.organizerName}
          upiQrUrl={b.upiQrUrl}
        />
      ) : null}

      {/* DETAILS GRID */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-12 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl bg-cream-50 border border-gold-500/40 p-6">
          <h2 className="flex items-center gap-2.5 font-fraunces text-xl text-sindoor-700 font-semibold">
            <SectionIcon><IconThaliLg /></SectionIcon>
            {t.detail.menu}
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(isHi ? b.menuHi : b.menu).map((item) => (
              <span
                key={item}
                className="text-sm bg-saffron-50 text-ink-900 border border-saffron-500/40 rounded-full px-3 py-1"
              >
                {item}
              </span>
            ))}
          </div>

          <h2 className="mt-6 flex items-center gap-2.5 font-fraunces text-xl text-sindoor-700 font-semibold">
            <SectionIcon><IconCalendar /></SectionIcon>
            {t.detail.servingOn}
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {b.tuesdayDates.map((iso) => {
              const d = new Date(`${iso}T04:30:00Z`);
              const label = isHi ? formatHindiDate(d) : formatEnglishDate(d);
              // Calendar-day comparison, not timestamp. Previous code
              // used `d.getTime() < now.getTime()` which struck today's
              // date through as "past" the moment the 10:00 AM IST
              // event-time slot passed (e.g. visiting at 1 PM on
              // Tuesday May 19 struck Tuesday May 19). Now we compare
              // the ISO date string (YYYY-MM-DD) against today's IST
              // calendar day so a service date is only "past" once the
              // next calendar day starts.
              const past = iso < todayIstStr;
              return (
                <li
                  key={iso}
                  className={`rounded-full px-3 py-1 border text-center ${
                    past
                      ? "border-gold-500/30 text-ink-600/70 line-through"
                      : "border-saffron-500/60 text-ink-900 bg-saffron-50"
                  }`}
                >
                  {label}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl bg-cream-50 border border-gold-500/40 p-6">
          <h2 className="flex items-center gap-2.5 font-fraunces text-xl text-sindoor-700 font-semibold">
            <SectionIcon><IconUser /></SectionIcon>
            {t.detail.organizer}
          </h2>
          <p className="mt-2 text-ink-900 font-medium">{b.organizerName}</p>
          {/* Phone deliberately not shown, it's verification-only per the
              privacy promise on the listing form. */}

          {b.landmark ? (
            <>
              <h2 className="mt-6 flex items-center gap-2.5 font-fraunces text-xl text-sindoor-700 font-semibold">
                <SectionIcon><IconLandmark /></SectionIcon>
                {t.detail.landmark}
              </h2>
              <p className="mt-2 text-ink-600">{b.landmark}</p>
            </>
          ) : null}
        </div>
      </section>

      {/* MAP */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-10">
        <BhandaraMap
          listings={[b]}
          center={{ lat: b.lat, lng: b.lng }}
          focusZoom={15}
          className="h-[360px] w-full rounded-2xl overflow-hidden border border-gold-500/40 bg-saffron-50"
        />
      </section>

      {/* OTHERS IN AREA */}
      {others.length > 0 ? (
        <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-12">
          {/* Area name in the heading now LINKS to the /area/<slug>
              landing page, supplies a strong reciprocal internal
              link from bhandara detail back to the area hub. The
              area hub also links here, completing the loop and
              compounding PageRank on both surfaces. */}
          <h2
            className={`text-2xl ${
              isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
            }`}
          >
            {t.detail.nearbyHeading}{" "}
            <Link
              href={`/area/${areaToSlug(b.area)}${langSuffix}`}
              data-ga="detail_area_link"
              data-ga-area={b.area}
              className="underline decoration-dotted decoration-saffron-600 underline-offset-4 hover:text-saffron-600 transition-colors"
            >
              {areaLabel}
            </Link>
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((o) => (
              <BhandaraCard key={o.id} bhandara={o} locale={locale} />
            ))}
          </div>
          <div className="mt-5">
            <Link
              href={`/area/${areaToSlug(b.area)}${langSuffix}`}
              data-ga="detail_area_view_all"
              data-ga-area={b.area}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-saffron-600 hover:text-sindoor-700"
            >
              {isHi
                ? `${areaLabel} के सभी बड़े मंगल भंडारे देखें →`
                : `View all Bada Mangal bhandaras in ${areaLabel} →`}
            </Link>
          </div>
        </section>
      ) : null}

      {/* Host-pitch CTA, earlier the detail page had no "List your
          own bhandara" call-out. Visitors who arrived from a friend's
          WhatsApp share might themselves be organising a bhandara
          this season; catching them here (right where they're seeing
          what a polished listing looks like) is the most natural
          place to ask. Warm copy, low pressure, full-width banner so
          it's hard to miss without screaming. */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-12 sm:mt-16">
        <div className="rounded-3xl border border-saffron-500/45 bg-gradient-to-br from-saffron-50 to-cream-50 px-6 py-7 sm:px-10 sm:py-10 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8 shadow-warm">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-saffron-600 font-semibold">
              {isHi ? "खुद आयोजन कर रहे हैं?" : "Hosting your own?"}
            </p>
            <h2
              className={`mt-2 ${
                isHi
                  ? "font-deva text-sindoor-700"
                  : "font-fraunces text-sindoor-700"
              } text-2xl sm:text-3xl leading-snug [text-wrap:balance]`}
            >
              {isHi
                ? "अपना बड़ा मंगल भंडारा भी सूचीबद्ध करें।"
                : "List your Bada Mangal bhandara on BadaMangal.com."}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-ink-600 leading-relaxed">
              {isHi
                ? "पूरी तरह मुफ़्त। लखनऊ के भक्तगण आपके भंडारे तक नक़्शे पर पहुँच सकेंगे।"
                : "Free to list. Devotees across Lucknow can find your bhandara on the city map."}
            </p>
          </div>
          <Link
            href={`/list-bhandara${isHi ? "" : "?lang=en"}`}
            data-ga="detail_cta_list_bhandara"
            data-ga-slug={b.slug}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-semibold px-6 py-3 text-base shadow-warm transition-transform hover:-translate-y-0.5"
          >
            {isHi ? "अपना भंडारा लिस्ट करें" : "List your bhandara"}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </article>
  );
}

/* ── Hero icons ────────────────────────────────────────────────────── */

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6.5-7-6.5-12a6.5 6.5 0 1 1 13 0c0 5-6.5 12-6.5 12z" />
      <circle cx="12" cy="9" r="2.25" />
    </svg>
  );
}
function IconPinSolid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13zm0-10.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}
function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-saffron-50 text-saffron-600 border border-saffron-500/40 shrink-0">
      {children}
    </span>
  );
}

function IconImage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m3 18 5-5 4 4 3-3 6 6" />
    </svg>
  );
}

function IconThaliLg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="8" cy="14" r="1.3" fill="currentColor" />
      <circle cx="16" cy="14" r="1.3" fill="currentColor" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9h17" />
      <path d="M8 3v4M16 3v4" />
      <circle cx="12" cy="14" r="1.4" fill="currentColor" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function IconLandmark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 4 8h16L12 3z" />
      <path d="M5 21h14" />
      <path d="M6 21V10" />
      <path d="M10 21V10" />
      <path d="M14 21V10" />
      <path d="M18 21V10" />
    </svg>
  );
}


function IconWhatsapp() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" aria-hidden>
      <path d="M16 3C8.82 3 3 8.82 3 16c0 2.29.6 4.43 1.65 6.3L3 29l6.86-1.62A12.95 12.95 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 23.5c-1.93 0-3.74-.5-5.32-1.4l-.38-.22-4.07.96.97-3.96-.25-.4A10.5 10.5 0 1 1 16 26.5zm6.06-7.86c-.33-.17-1.96-.97-2.27-1.08-.3-.11-.52-.17-.74.17-.22.33-.85 1.07-1.04 1.29-.19.22-.38.25-.71.08-.33-.17-1.4-.52-2.66-1.65-.98-.88-1.65-1.96-1.84-2.29-.19-.33-.02-.51.15-.67.15-.15.33-.39.5-.58.16-.19.22-.33.33-.55.11-.22.06-.41-.03-.58-.08-.17-.74-1.79-1.01-2.45-.27-.66-.55-.57-.74-.58l-.63-.01a1.21 1.21 0 0 0-.88.41c-.3.33-1.15 1.13-1.15 2.75 0 1.62 1.18 3.19 1.34 3.41.16.22 2.32 3.55 5.62 4.97 2.61 1.13 3.14 1.06 3.71.99.57-.06 1.84-.75 2.1-1.48.26-.73.26-1.36.18-1.49-.08-.13-.3-.21-.63-.38z" />
    </svg>
  );
}
