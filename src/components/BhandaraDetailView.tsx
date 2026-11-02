"use client";

import Link from "next/link";
import BackToHomeLink from "@/components/BackToHomeLink";
import CopyButton from "@/components/CopyButton";
import { strings } from "@/content/strings";
import { HOME_ART } from "@/content/home-art";
import { stripBotProvenance } from "@/lib/sanitize";
import type { Bhandara, BhandaraListItem } from "@/types/bhandara";
import { ALL_AREA_SLUGS, areaToSlug } from "@/lib/areaSlug";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  bhandaraShareText,
  hasMapPin,
  whatsappShareUrlForBhandara as whatsappShareUrl,
} from "@/lib/share";
import {
  Actions,
  Band,
  BhandaraRow,
  Breadcrumb,
  Button,
  Chip,
  ChipList,
  Heading,
  InfoList,
  InfoRow,
  InnerShell,
  Kicker,
  KickSep,
  PageHero,
  PhotoGrid,
  Plate,
  PlateMap,
  Print,
  RowList,
  Section,
  StickyActions,
  dayMonth,
  istToday,
  longDate,
  timeRange,
} from "@/components/v2";

/**
 * /bhandara/[slug] body (v2 inner page kit). Client component so every
 * label swaps on the Hindi toggle; it is still server rendered, so all
 * text, headings and links are in the static HTML.
 *
 * The server route owns the Prisma reads (this bhandara, others in the
 * area, spots at this bhandara, its place on the painted plate), the
 * JSON-LD and the LCP preload.
 *
 * Contact: no organiser phone anywhere, not even a Call button (the
 * listing form promises the number is never shown publicly; Founder,
 * 2 Nov 2026). Organiser UPI and sponsor buttons are hidden for now
 * (Founder, 1 Nov 2026).
 */
type Props = {
  b: Bhandara;
  others: BhandaraListItem[];
  /** True when `others` are the area's last season (none upcoming). */
  othersPast?: boolean;
  spots?: { id: string; photoUrl: string; caption: string | null; createdAt: string }[];
  mapPin?: { x: number; y: number } | null;
  mapLabels?: { key: string; x: number; y: number; hi: string; en: string }[];
};

function googleDirectionsUrl(b: Bhandara): string {
  const base = `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
  return b.googlePlaceId ? `${base}&destination_place_id=${b.googlePlaceId}` : base;
}

function isServingNow(b: Bhandara, now: Date, today: string): boolean {
  if (!b.tuesdayDates.includes(today)) return false;
  const endHHMM = b.timeEnd && /^\d{2}:\d{2}$/.test(b.timeEnd) ? b.timeEnd : "21:00";
  const start = new Date(`${today}T${b.timeStart}:00+05:30`).getTime();
  const end = new Date(`${today}T${endHHMM}:00+05:30`).getTime();
  return now.getTime() >= start && now.getTime() <= end;
}

export default function BhandaraDetailView({
  b,
  others,
  othersPast = false,
  spots = [],
  mapPin = null,
  mapLabels = [],
}: Props) {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  const now = new Date();
  const today = istToday(now);
  const dates = [...b.tuesdayDates].sort();
  const upcoming = dates.filter((d) => d >= today);
  const servingNow = isServingNow(b, now, today);
  const next = upcoming[0] ?? null;

  const displayName = isHi ? b.nameHi || b.name : b.name;
  const displayAddress = isHi ? (b.addressHi ?? b.address) : b.address;
  const displayDescription = stripBotProvenance(isHi ? (b.descriptionHi ?? b.description) : b.description);
  const areaLabel = t.areas[b.area] ?? b.area;
  const areaSlug = areaToSlug(b.area, b.city);
  const areaHref = ALL_AREA_SLUGS.includes(areaSlug) ? `/area/${areaSlug}${langSuffix}` : null;
  const time = timeRange(b.timeStart, b.timeEnd, locale);
  const menu = isHi ? b.menuHi : b.menu;
  const pin = hasMapPin(b);
  const directions = pin ? googleDirectionsUrl(b) : null;
  const share = whatsappShareUrl(b, locale);

  // Status, in the kicker: open now, the next date, or a finished season.
  const status = servingNow
    ? t.detail.statusOpen
    : next
      ? `${t.detail.statusUpcoming} ${dayMonth(next, locale)}`
      : t.detail.seasonOver;

  // The one line under the name: when.
  const year = (dates.at(-1) ?? "").slice(0, 4);
  const when = (() => {
    if (servingNow) return [isHi ? "आज" : "Today", time].filter(Boolean).join(" · ");
    if (next) return [longDate(next, locale), time].filter(Boolean).join(" · ");
    if (dates.length === 1) return [longDate(dates[0]!, locale, true), time].filter(Boolean).join(" · ");
    if (dates.length > 1) {
      const span = isHi
        ? `${dayMonth(dates[0]!, locale)} से ${dayMonth(dates.at(-1)!, locale)} ${year}`
        : `${dayMonth(dates[0]!, locale)} to ${dayMonth(dates.at(-1)!, locale)} ${year}`;
      return [span, time].filter(Boolean).join(" · ");
    }
    return time;
  })();

  const photoAlt = `${b.name} bhandara in ${areaLabel}, Lucknow`;

  return (
    <InnerShell as="article">
      <PageHero
        crumbs={
          <Breadcrumb
            label={isHi ? "रास्ता" : "Breadcrumb"}
            items={[
              {
                label: t.cta.backHome,
                node: (
                  <BackToHomeLink fallbackHref={`/${langSuffix}#map`} label={t.cta.backHome} className="bmi-crumb-back" />
                ),
              },
              areaHref ? { label: areaLabel, href: areaHref } : { label: areaLabel },
            ]}
          />
        }
        kicker={
          <Kicker live={servingNow}>
            <span>{status}</span>
            {b.isVerified ? (
              <>
                <KickSep />
                <span>{isHi ? "सत्यापित" : "Verified"}</span>
              </>
            ) : null}
          </Kicker>
        }
        heading={<Heading as="h1" en={b.name} hi={displayName} />}
        lede={when || undefined}
        actions={
          <Actions split>
            {directions ? (
              <Button href={directions} external icon="pin" data-ga="detail_get_directions" data-ga-slug={b.slug}>
                {t.cta.getDirections}
              </Button>
            ) : null}
            <Button
              variant={directions ? "secondary" : "primary"}
              href={share}
              external
              icon="whatsapp"
              data-ga="detail_share_whatsapp"
              data-ga-slug={b.slug}
            >
              {t.cta.shareWhatsapp}
            </Button>
            <CopyButton
              value={bhandaraShareText(b, locale)}
              label={isHi ? "संदेश कॉपी करें" : "Copy message"}
              copiedLabel={isHi ? "कॉपी हो गया" : "Copied"}
              className="bmi-tl bmi-copy"
            />
          </Actions>
        }
        art={
          b.photoUrl ? (
            <Print
              src={b.photoUrl}
              alt={photoAlt}
              href={b.photoUrl}
              priority
              caption={<h2 className="bmi-print-h">{isHi ? "तस्वीर / पर्चा" : "Photo / pamphlet"}</h2>}
            />
          ) : (
            <Plate {...HOME_ART.sevaHands} alt="" fade="edges" priority />
          )
        }
      />

      {/* The facts on hairlines, and where it is on the painted city. */}
      <Section tight id="details">
        <div className={pin && mapPin ? "bmi-split" : undefined}>
          <InfoList>
            <InfoRow label={t.detail.servingOn} labelAs="h2" icon="calendar">
              {dates.length === 1 ? (
                <>
                  <span className="big">{longDate(dates[0]!, locale, true)}</span>
                  {time ? <span className="sub">{time}</span> : null}
                </>
              ) : dates.length > 1 ? (
                <>
                  <ChipList label={t.detail.servingOn}>
                    {dates.map((iso) => (
                      <Chip key={iso} tone={iso === today ? "leaf" : iso > today ? "saffron" : "default"}>
                        {dayMonth(iso, locale)}
                      </Chip>
                    ))}
                  </ChipList>
                  {time ? <span className="sub">{time}</span> : null}
                </>
              ) : (
                <span className="big">{time || (isHi ? "तिथि जल्द" : "Date to be announced")}</span>
              )}
            </InfoRow>

            <InfoRow label={isHi ? "पता" : "Address"} icon="pin">
              <span>{displayAddress}</span>
              {displayDescription ? <span className="sub">{displayDescription}</span> : null}
            </InfoRow>

            {b.landmark ? (
              <InfoRow label={t.detail.landmark} labelAs="h2" icon="landmark">
                {b.landmark}
              </InfoRow>
            ) : null}

            <InfoRow label={t.detail.menu} labelAs="h2" icon="thali">
              {menu.length ? (
                <ChipList label={t.detail.menu}>
                  {menu.map((item) => (
                    <Chip key={item}>{item}</Chip>
                  ))}
                </ChipList>
              ) : (
                <span className="sub">{isHi ? "प्रसाद" : "Prasad"}</span>
              )}
            </InfoRow>

            <InfoRow label={t.detail.organizer} labelAs="h2" icon="user">
              <span className="big">{b.organizerName}</span>
            </InfoRow>
          </InfoList>

          {pin && mapPin && directions ? (
            <PlateMap
              pin={mapPin}
              labels={mapLabels}
              locale={locale}
              href={directions}
              ariaLabel={isHi ? `${areaLabel} में, Google Maps पर रास्ता खोलें` : `In ${areaLabel}. Open directions in Google Maps`}
              footer={
                <>
                  <p>{areaLabel}, {isHi ? "लखनऊ" : "Lucknow"}</p>
                  <Button variant="text" href={directions} external iconEnd="arrowUpRight" data-ga="detail_map_directions" data-ga-slug={b.slug}>
                    {t.cta.getDirections}
                  </Button>
                </>
              }
            />
          ) : null}
        </div>
      </Section>

      {/* Photos neighbours posted from here. Never a name. */}
      {spots.length ? (
        <Section
          id="spots"
          title={{ en: "Spotted at this bhandara", hi: "इस भंडारे से तस्वीरें" }}
          lede={
            isHi
              ? "शहर के लोगों ने यहाँ से ये तस्वीरें भेजीं।"
              : "Photos neighbours shared from here on the day."
          }
        >
          <PhotoGrid
            items={spots.map((s) => ({
              src: s.photoUrl,
              alt: s.caption ? s.caption : `${b.name}, ${areaLabel}`,
              href: s.photoUrl,
              title: dayMonth(s.createdAt.slice(0, 10), locale),
              caption: s.caption ?? undefined,
            }))}
          />
        </Section>
      ) : null}

      {/* Others in the area: upcoming, or off season the area's last
          season. The area name links to its hub page (reciprocal link). */}
      {others.length > 0 ? (
        <Section
          id="nearby"
          heading={
            <Heading as="h2" lang={locale} id="nearby-h">
              {t.detail.nearbyHeading}{" "}
              {areaHref ? (
                <Link
                  href={areaHref}
                  prefetch={false}
                  data-ga="detail_area_link"
                  data-ga-area={b.area}
                >
                  {areaLabel}
                </Link>
              ) : (
                areaLabel
              )}
            </Heading>
          }
          lede={
            othersPast
              ? isHi
                ? `${year || "पिछले"} सत्र में ${areaLabel} के भंडारे।`
                : `${areaLabel} bhandaras from the ${year || "last"} season.`
              : undefined
          }
        >
          <RowList cols={others.length > 2}>
            {others.map((o) => (
              <BhandaraRow key={o.id} b={o} date={othersPast ? "past" : "next"} />
            ))}
          </RowList>
          {areaHref ? (
            <Actions className="bmi-after-list">
              <Button variant="text" href={areaHref} data-ga="detail_area_view_all" data-ga-area={b.area}>
                {isHi
                  ? `${areaLabel} के सभी बड़े मंगल भंडारे देखें`
                  : `View all Bada Mangal bhandaras in ${areaLabel}`}
              </Button>
            </Actions>
          ) : null}
        </Section>
      ) : null}

      {/* Host pitch: a closing band, not a card. */}
      <Band
        id="host"
        kicker={<Kicker>{isHi ? "खुद आयोजन कर रहे हैं?" : "Hosting your own?"}</Kicker>}
        title={{
          en: "List your Bada Mangal bhandara on BadaMangal.com.",
          hi: "अपना बड़ा मंगल भंडारा भी सूचीबद्ध करें।",
        }}
        lede={
          isHi
            ? "पूरी तरह मुफ़्त। लखनऊ के भक्तगण आपके भंडारे तक नक़्शे पर पहुँच सकेंगे।"
            : "Free to list. Devotees across Lucknow can find your bhandara on the city map."
        }
        art={<Plate {...HOME_ART.pattal} alt="" fade="none" />}
        actions={
          <Actions>
            <Button
              variant="secondary"
              href={`/list-bhandara${isHi ? "" : "?lang=en"}`}
              icon="plus"
              data-ga="detail_cta_list_bhandara"
              data-ga-slug={b.slug}
            >
              {isHi ? "अपना भंडारा लिस्ट करें" : "List your bhandara"}
            </Button>
          </Actions>
        }
      />

      <StickyActions
        label={isHi ? "जल्दी के काम" : "Quick actions"}
        items={[
          ...(directions
            ? [{ href: directions, label: isHi ? "रास्ता" : "Directions", icon: "pin" as const, primary: true, external: true, dataGa: "sticky_directions" }]
            : []),
          { href: share, label: isHi ? "भेजें" : "Share", icon: "whatsapp" as const, external: true, primary: !directions, dataGa: "sticky_whatsapp" },
        ]}
      />
    </InnerShell>
  );
}
