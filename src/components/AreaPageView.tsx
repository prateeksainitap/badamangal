"use client";

import { areaToSlug } from "@/lib/areaSlug";
import { strings } from "@/content/strings";
import { HOME_ART } from "@/content/home-art";
import type { BhandaraListItem } from "@/types/bhandara";
import { useLocaleFromContext } from "@/lib/locale-context";
import { expandBhandarasByDate } from "@/lib/dates";
import {
  Actions,
  Band,
  BhandaraRow,
  Breadcrumb,
  Button,
  EmptyState,
  Heading,
  InnerShell,
  Kicker,
  KickSep,
  LinkRow,
  PageHero,
  Plate,
  PlateMap,
  RowList,
  Section,
} from "@/components/v2";

/**
 * /area/[slug] body (v2 inner page kit). Client component so every
 * label swaps on the Hindi toggle; still server rendered, so the h1,
 * the h2s, the copy and every link are in the static HTML.
 *
 * The server route owns the Prisma read, the JSON-LD (Organization,
 * breadcrumb, FAQ, ItemList), the metadata, and this area's places on
 * the painted plate (the hero art).
 *
 * SEO: the h1 and h2 strings, the hero paragraph's words and every
 * internal href are the same as before the redesign; the paragraph is
 * split so only one line sits under the h1 when the rest belongs to
 * the closing invitation.
 */
type Props = {
  area: string;
  slug: string;
  /** Upcoming bhandaras, shown first, one row per service date. */
  bhandaras: BhandaraListItem[];
  /** Latest season's bhandaras whose dates have all passed. */
  past: BhandaraListItem[];
  /** That season's year ("2026"), null when there are none. */
  pastYear: string | null;
  /** True while that season is still running ("Earlier this season"). */
  pastIsThisSeason: boolean;
  adjacent: string[];
  mapPins?: { id: string; x: number; y: number }[];
  mapLabels?: { key: string; x: number; y: number; hi: string; en: string }[];
};

export default function AreaPageView({
  area,
  slug,
  bhandaras,
  past,
  pastYear,
  pastIsThisSeason,
  adjacent,
  mapPins = [],
  mapLabels = [],
}: Props) {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";
  const areaLabel = t.areas[area as keyof typeof t.areas] ?? area;
  // Off season: nothing upcoming, but last season's bhandaras exist.
  const offSeasonWithPast = bhandaras.length === 0 && past.length > 0;
  const nothing = bhandaras.length === 0 && past.length === 0;

  const listHref = `/list-bhandara${langSuffix}`;
  const listLabel = isHi ? `अपना ${areaLabel} भंडारा लिस्ट करें · मुफ़्त` : `List your ${areaLabel} bhandara · Free`;
  const listButton = (variant: "primary" | "secondary") => (
    <Button variant={variant} href={listHref} icon="plus" data-ga="area_list_bhandara" data-ga-area={slug}>
      {listLabel}
    </Button>
  );
  const mapButton = (
    <Button variant="secondary" href={`/${langSuffix}#map`} icon="map" data-ga="area_view_full_map" data-ga-area={slug}>
      {isHi ? "नक़्शे पर सभी क्षेत्र देखें" : "See all areas on map"}
    </Button>
  );

  // The hero paragraph, same words as before. Off season the last
  // sentence (an invitation to list) moves to the closing band.
  const lede = offSeasonWithPast ? (
    isHi ? (
      <>
        बड़ा मंगल {pastYear} में {areaLabel} में <strong>{past.length}</strong>{" "}
        {past.length === 1 ? "भंडारा लगा" : "भंडारे लगे"}। उनकी तिथियाँ, समय और प्रसाद नीचे उस सत्र
        के रिकॉर्ड के रूप में हैं।
      </>
    ) : (
      <>
        <strong>{past.length}</strong> {past.length === 1 ? "bhandara" : "bhandaras"} served{" "}
        {areaLabel} in the {pastYear} Bada Mangal season. Their dates, timings and prasad are below
        as a record of that season.
      </>
    )
  ) : bhandaras.length === 0 ? (
    isHi ? (
      <>
        इस वर्ष <strong>{areaLabel}</strong> में अभी कोई भी 2026 बड़ा मंगल भंडारा सूचीबद्ध नहीं है।
        यदि आप यहाँ भंडारा आयोजित कर रहे हैं, तो 30 सेकंड में मुफ़्त सूचीबद्ध करें, {areaLabel}{" "}
        <em>में भंडारा</em> ढूँढ़ रहे भक्तगण आपको तुरंत पाएँगे।
      </>
    ) : (
      <>
        No bhandaras are listed in <strong>{areaLabel}</strong> for the 2026 Bada Mangal season yet.
        If you&apos;re hosting one, take 30 seconds to list it free, devotees searching for{" "}
        <em>bhandara in {areaLabel}</em> will find you immediately.
      </>
    )
  ) : isHi ? (
    <>
      {areaLabel} में <strong>{bhandaras.length}</strong> {bhandaras.length === 1 ? "भंडारा" : "भंडारे"}{" "}
      2026 बड़ा मंगल सत्र की सेवा कर रहे हैं। हर लिस्टिंग मुफ़्त सेवा है, सभी भक्तों के लिए खुली।
      नीचे स्थान, समय, प्रसाद मेन्यू और एक-क्लिक दिशा-निर्देश।
    </>
  ) : (
    <>
      <strong>{bhandaras.length}</strong> {bhandaras.length === 1 ? "bhandara is" : "bhandaras are"}{" "}
      serving the 2026 Bada Mangal season in {areaLabel}. Every listing is free seva, open to all
      devotees. Locations, timings, prasad menus, and one-tap directions below.
    </>
  );

  const pins = mapPins.map(({ x, y }) => ({ x, y }));
  const art =
    pins.length > 0 ? (
      <PlateMap
        others={pins}
        labels={mapLabels}
        locale={locale}
        ariaLabel={isHi ? `नक़्शे पर ${areaLabel} के भंडारे` : `${areaLabel} bhandaras on the painted map of Lucknow`}
      />
    ) : (
      <Plate {...HOME_ART.bhandaraLine} alt="" fade="edges" priority />
    );

  return (
    <InnerShell>
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: `/${langSuffix}` },
              { label: isHi ? "क्षेत्र" : "Areas", href: `/${langSuffix}#map` },
              { label: areaLabel },
            ]}
          />
        }
        kicker={
          <Kicker>
            <span>2026</span>
            <KickSep />
            <span>{isHi ? "बड़ा मंगल लखनऊ" : "Bada Mangal Lucknow"}</span>
          </Kicker>
        }
        title={{
          en: `Bada Mangal Bhandaras in ${areaLabel}, Lucknow 2026`,
          hi: `${areaLabel} में बड़े मंगल भंडारे, लखनऊ 2026`,
        }}
        lede={lede}
        actions={
          <Actions>
            {offSeasonWithPast ? mapButton : (
              <>
                {listButton("primary")}
                {mapButton}
              </>
            )}
          </Actions>
        }
        art={art}
      />

      {/* Upcoming: one row per service date, in date order. */}
      {bhandaras.length > 0 ? (
        <Section tight id="upcoming" labelledBy="area-upcoming-heading">
          <h2 className="bmi-sr" id="area-upcoming-heading">
            {isHi ? `${areaLabel} के भंडारे` : `${areaLabel} bhandaras`}
          </h2>
          <RowList cols>
            {expandBhandarasByDate(bhandaras).map(({ bhandara, pinnedDate }) => (
              <BhandaraRow
                key={`${bhandara.id}-${pinnedDate ?? "none"}`}
                b={bhandara}
                date="pinned"
                pinned={pinnedDate}
              />
            ))}
          </RowList>
        </Section>
      ) : nothing ? (
        <Section tight id="empty">
          <EmptyState
            lede={
              isHi
                ? `इस सत्र में ${areaLabel} का पहला भंडारा? इसे मुफ़्त सूचीबद्ध करें और इस क्षेत्र में खोज रहे भक्तों के लिए एकमात्र परिणाम बनें।`
                : `First bhandara in ${areaLabel} this season? List it free and be the only result for devotees searching this area.`
            }
            actions={
              <Actions>
                <Button variant="secondary" href={listHref}>
                  {isHi ? `${areaLabel} में भंडारा लिस्ट करें` : `List a ${areaLabel} bhandara`}
                </Button>
              </Actions>
            }
          />
        </Section>
      ) : null}

      {/* The latest season's bhandaras whose dates are over. Off season
          this is the page's main list. Rows read "Served 5 May 2026". */}
      {past.length > 0 ? (
        <Section
          id="past"
          tight={offSeasonWithPast}
          labelledBy="area-past-heading"
          heading={
            <Heading
              as="h2"
              id="area-past-heading"
              en={pastIsThisSeason ? "Earlier this season" : `From the ${pastYear} season`}
              hi={pastIsThisSeason ? "इस सत्र में पहले हुए भंडारे" : `${pastYear} सत्र से`}
            />
          }
          lede={
            pastIsThisSeason
              ? isHi
                ? `${areaLabel} के ये भंडारे इस सत्र में अपनी तिथियों पर लग चुके हैं।`
                : `These ${areaLabel} bhandaras have already served on their dates this season.`
              : isHi
                ? `बड़ा मंगल ${pastYear} में ${areaLabel} के भंडारे। ये तिथियाँ बीत चुकी हैं; अगले सत्र के भंडारे आयोजकों के जोड़ते ही ऊपर दिखेंगे।`
                : `${areaLabel} bhandaras from Bada Mangal ${pastYear}. These dates have passed; next season's bhandaras will appear here as organisers list them.`
          }
        >
          <RowList cols>
            {past.map((b) => (
              <BhandaraRow key={b.id} b={b} date="past" />
            ))}
          </RowList>
        </Section>
      ) : null}

      {/* Adjacent areas: the internal link surface between area hubs. */}
      {adjacent.length > 0 ? (
        <Section
          id="nearby-areas"
          title={{ en: "Bhandaras in nearby areas", hi: "पास के क्षेत्रों के भंडारे" }}
          lede={
            isHi
              ? `${areaLabel} के भक्तगण अक्सर पास के क्षेत्रों के भंडारे भी जाते हैं, क्षेत्र अनुसार निर्देशिका देखें।`
              : `Devotees in ${areaLabel} often visit bhandaras across the neighbouring areas, explore the directory by area.`
          }
        >
          <LinkRow
            items={[
              ...adjacent.map((a) => {
                const aLabel = t.areas[a as keyof typeof t.areas] ?? a;
                return {
                  href: `/area/${areaToSlug(a)}${langSuffix}`,
                  label: isHi ? `${aLabel} में बड़ा मंगल` : `Bada Mangal in ${aLabel}`,
                  linkProps: {
                    "data-ga": "area_cross_link",
                    "data-ga-from": slug,
                    "data-ga-to": areaToSlug(a),
                  },
                };
              }),
              {
                href: `/${langSuffix}#map`,
                label: isHi ? "लखनऊ के सभी क्षेत्र" : "All Lucknow areas",
                linkProps: { "data-ga": "area_see_all_areas" },
              },
            ]}
          />
        </Section>
      ) : null}

      {/* The devotional pages every bhandara plays. */}
      <Section
        id="resources"
        title={{ en: "Devotional resources for Bada Mangal", hi: "बड़ा मंगल के लिए भक्ति संसाधन" }}
        lede={
          isHi
            ? `हर ${areaLabel} भंडारे में बजने वाले गीत, चालीसा और रीति-रिवाज़।`
            : `The songs, chants, and rituals every ${areaLabel} bhandara plays.`
        }
      >
        <LinkRow
          items={[
            { href: `/resources/chalisa${langSuffix}`, label: isHi ? "हनुमान चालीसा" : "Hanuman Chalisa" },
            { href: `/resources/aarti${langSuffix}`, label: isHi ? "हनुमान आरती" : "Hanuman Aarti" },
            { href: `/resources/ashtak${langSuffix}`, label: isHi ? "हनुमान अष्टक" : "Hanuman Ashtak" },
            { href: `/resources/bajrang-baan${langSuffix}`, label: isHi ? "बजरंग बाण" : "Bajrang Baan" },
          ]}
        />
      </Section>

      {/* Off season: the invitation to list for next season closes the page. */}
      {offSeasonWithPast ? (
        <Band
          lede={
            isHi ? (
              <>
                अगले सत्र में भंडारा कर रहे हैं? उसे लिस्ट करें, ताकि {areaLabel} <em>में भंडारा</em> ढूँढ़
                रहे भक्तगण आपको पाएँ।
              </>
            ) : (
              <>
                Hosting one next season? List it so devotees searching for{" "}
                <em>bhandara in {areaLabel}</em> find you.
              </>
            )
          }
          art={<Plate {...HOME_ART.pattal} alt="" fade="none" />}
          actions={<Actions>{listButton("primary")}</Actions>}
        />
      ) : (
        <div className="bmi-sec" aria-hidden />
      )}
    </InnerShell>
  );
}
