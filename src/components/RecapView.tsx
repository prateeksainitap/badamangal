"use client";

import "@/components/home/home-v2.css";
import { useLocaleFromContext } from "@/lib/locale-context";
import { RECAP } from "@/content/recap";
import { HOME_ART, GADA_PIN } from "@/content/home-art";
import { HOME_PRESS } from "@/content/testimonials";
import type { SiteStats } from "@/lib/stats";
import type { SeasonDay } from "@/lib/home-season";
import SeasonTuesdays from "@/components/home/SeasonTuesdays";
import {
  Actions,
  Band,
  BigFigure,
  Breadcrumb,
  Button,
  Chip,
  ChipList,
  Figures,
  InnerShell,
  Kicker,
  KickSep,
  Meters,
  PageHero,
  Plate,
  Section,
} from "@/components/v2";

/**
 * /recap, the 2026 season story, on the v2 inner page kit.
 *
 * Numbers: the season total is the homepage's one set (getHomepageStats:
 * tracked = listed + spotted), live from the database. Growth, press,
 * social and geography are the dated June snapshot in
 * src/content/recap.ts. The Tuesday picker is the homepage's own
 * component (SeasonTuesdays), rendered inside a .bmh island so it keeps
 * its homepage styling exactly.
 *
 * SEO: the h1 and the six h2 strings are the same as before, in the
 * same order; the closing map link keeps its href.
 */
type Props = {
  stats: SiteStats;
  days: SeasonDay[];
};

const fmt = (n: number) => n.toLocaleString("en-IN");

export default function RecapView({ stats, days }: Props) {
  const isHi = useLocaleFromContext() === "hi";
  const q = isHi ? "" : "?lang=en";
  const L = <T extends { hi: string; en: string }>(b: T) => (isHi ? b.hi : b.en);
  const r = RECAP;
  const listedShare = stats.bhandarasTotal ? stats.bhandarasListed / stats.bhandarasTotal : 0.34;

  return (
    <InnerShell>
      {/* 1. Hero */}
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: `/${q}` },
              { label: isHi ? "सीज़न रिकैप" : "Season recap" },
            ]}
          />
        }
        kicker={
          <Kicker>
            <span>{isHi ? "सीज़न रिकैप" : "Season recap"}</span>
            <KickSep />
            <span>2026</span>
          </Kicker>
        }
        title={r.hero.headline}
        lede={L(r.hero.sub)}
        meta={
          <ChipList>
            {[
              <Chip key="d" tone="gold" icon="calendar">
                {isHi ? "5 मई से 23 जून 2026" : "5 May to 23 June 2026"}
              </Chip>,
              <Chip key="b" tone="saffron">
                {L(r.hero.badge)}
              </Chip>,
            ]}
          </ChipList>
        }
        actions={
          <Actions>
            <Button href={`/gallery${q}`} icon="camera" data-ga="recap_gallery">
              {isHi ? "सारी तस्वीरें देखें" : "See every photo"}
            </Button>
            <Button variant="text" href="#this-season">
              {isHi ? "हर मंगल की कहानी" : "Tuesday by Tuesday"}
            </Button>
          </Actions>
        }
        art={<Plate {...HOME_ART.sevaHands} alt="" fade="edges" priority />}
      />

      {/* 2. The season total, the homepage tally, then the Tuesdays */}
      <Section
        id="this-season"
        center
        kicker={<Kicker>{L(r.headline.kicker)}</Kicker>}
        title={r.headline.heading}
        lede={L(r.headline.body)}
      >
        <div className="bmh bmi-s26host" data-fab="on">
          <div className="s26" style={{ background: "none" }}>
            <div className="tally" data-rv>
              <div className="tally-big">
                <p className="tb-n">{fmt(stats.bhandarasTotal)}</p>
                <p className="tb-l">{isHi ? "भंडारे दर्ज हुए" : "bhandaras tracked"}</p>
                <div className="split" style={{ ["--a" as string]: listedShare }}>
                  <span className="split-bar" aria-hidden>
                    <i className="sl" />
                    <i className="ss" />
                  </span>
                  <p className="split-leg">
                    <span>
                      <i className="dot dl" aria-hidden />
                      <b>{fmt(stats.bhandarasListed)}</b> {isHi ? "आयोजकों ने जोड़े" : "listed by organisers"}
                    </span>
                    <span>
                      <i className="dot ds" aria-hidden />
                      <b>{fmt(stats.bhandarasSpotted)}</b> {isHi ? "पड़ोसियों ने खोजे" : "spotted by neighbours"}
                    </span>
                  </p>
                </div>
              </div>
              <ul className="tally-row">
                {[
                  { n: fmt(stats.areasCovered), en: "neighbourhoods", hi: "मोहल्ले" },
                  { n: fmt(stats.communityMembers), en: "on WhatsApp", hi: "व्हाट्सऐप पर" },
                  { n: fmt(stats.visitorNumber), en: "site visitors", hi: "कुल विज़िटर" },
                  { n: "8", en: "Tuesdays, a rare year", hi: "मंगल, एक दुर्लभ वर्ष" },
                ].map((s) => (
                  <li key={s.en}>
                    <span className="ts-n">{s.n}</span>
                    <span className="ts-l">{isHi ? s.hi : s.en}</span>
                  </li>
                ))}
              </ul>
            </div>
            {days.length ? <SeasonTuesdays days={days} /> : null}
          </div>
        </div>
        <p className="bmi-recap-fine">
          {isHi
            ? "यह सीज़न का लाइव, डेटाबेस-सत्यापित योग है। हर मंगल में उस दिन के लिए जोड़े गए और उस दिन खोजे गए भंडारे गिने गए हैं; कुल में शनिवार को खोजे गए और छपे पर्चों से गिने गए भंडारे भी हैं, इसलिए सारे मंगल मिलाकर कुल से कम होते हैं।"
            : "This season's live, database-verified total. Each Tuesday counts the bhandaras listed for that day and those spotted on it; the total also counts Saturday spots and bhandaras counted from printed pamphlets, so the Tuesdays add up to less."}
        </p>
      </Section>

      {/* 3. Growth */}
      <Section
        id="reach"
        tone="paper"
        kicker={
          <Kicker>
            <span>{L(r.growth.kicker)}</span>
            <KickSep />
            <span>{L(r.growth.asOf)}</span>
          </Kicker>
        }
        title={r.growth.heading}
        lede={L(r.growth.body)}
      >
        <div className="bmi-growth">
          <div>
            <BigFigure
              value={`+${r.growth.momPercent}%`}
              label={isHi ? "मासिक वृद्धि, मई से जून" : "Month-over-month growth, May to June"}
            />
            <Meters
              label={isHi ? "हर महीने के यूज़र" : "Users each month"}
              items={[
                { label: isHi ? "मई" : "May", value: r.growth.mayUsers },
                { label: isHi ? "जून" : "June", value: r.growth.juneUsers, hot: true },
              ]}
            />
          </div>
          <Figures
            cols={2}
            items={[
              { value: fmt(r.growth.totalUsers), label: isHi ? "कुल यूज़र, मई से जून" : "Total users, May to June" },
              { value: fmt(r.growth.totalPageViews), label: isHi ? "कुल पेज व्यूज़" : "Total page views" },
              { value: fmt(r.growth.mapViews), label: isHi ? "नक़्शा देखा गया" : "Live map views" },
              { value: fmt(r.growth.searchClicks), label: isHi ? "गूगल सर्च क्लिक्स" : "Google search clicks" },
              { value: fmt(r.growth.searchImpressions), label: isHi ? "सर्च इंप्रेशन्स" : "Search impressions" },
              { value: `${r.growth.searchCtr}%`, label: isHi ? "सर्च CTR" : "Search CTR" },
            ]}
          />
        </div>
        <p className="bmi-quoteline" data-rv>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={GADA_PIN} alt="" width={30} height={30} />
          <span>{L(r.growth.brandNote)}</span>
        </p>
      </Section>

      {/* 4. Press: radio first (the h2), then print */}
      <Section
        id="press"
        kicker={<Kicker>{L(r.press.kicker)}</Kicker>}
        title={r.press.heading}
        lede={L(r.press.body)}
      >
        {/* No reveal on the logos: an animated parent isolates them and
            the multiply blend (white jpg grounds) stops working. */}
        <ul className="bmi-press">
          {r.press.items.map((p) => {
            const logo = HOME_PRESS.radio.find((x) => x.name === p.name);
            return (
              <li key={p.name}>
                <span className="bmi-press-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.logo} alt={`${p.name} logo`} width={logo?.width} height={logo?.height} loading="lazy" decoding="async" />
                </span>
                <div>
                  <p className="bmi-press-k">{p.freq}</p>
                  <p className="bmi-press-t" lang="en">
                    {p.name}
                  </p>
                  <p className="bmi-press-s">
                    {L(p.host)}, {L(p.dateLabel)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="bmi-print-row">
          <p className="bmi-press-k">{isHi ? "अख़बार में" : "In print"}</p>
          {HOME_PRESS.print.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.name} src={p.src} alt={p.name} width={p.width} height={p.height} loading="lazy" decoding="async" />
          ))}
        </div>
      </Section>

      {/* 5. Social */}
      <Section
        id="social"
        tone="paper"
        center
        kicker={<Kicker>{L(r.social.kicker)}</Kicker>}
        title={r.social.heading}
        lede={L(r.social.body)}
      >
        <BigFigure
          center
          value={r.social.igTotalViews}
          label={isHi ? "इंस्टाग्राम रील व्यूज़" : "Instagram reel views"}
          sub={
            isHi
              ? `${fmt(r.social.igReached)}+ अकाउंट्स तक पहुँच, सिर्फ़ ${r.social.igFollowersAtStart} फ़ॉलोअर्स से शुरू होकर`
              : `${fmt(r.social.igReached)}+ accounts reached, starting from just ${r.social.igFollowersAtStart} followers`
          }
        />
        <div className="bmi-social-figs">
          <Figures
            cols={2}
            items={r.social.topReels.map((reel, i) => ({
              value: fmt(reel.views),
              label: isHi ? `रील ${i + 1} के व्यूज़` : `Reel ${i + 1} views`,
              sub: isHi ? `${fmt(reel.reached)} तक पहुँच` : `${fmt(reel.reached)} accounts reached`,
            }))}
          />
        </div>
        <p className="bmi-quoteline center" data-rv>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={GADA_PIN} alt="" width={30} height={30} />
          <span>
            {isHi
              ? `Reddit पर ${r.social.redditViews} व्यूज़, ${r.social.redditNote.hi}`
              : `${r.social.redditViews} views on Reddit, ${r.social.redditNote.en}`}
          </span>
        </p>
      </Section>

      {/* 6. Geography */}
      <Section
        id="beyond-lucknow"
        kicker={<Kicker>{L(r.geography.kicker)}</Kicker>}
        title={r.geography.heading}
        lede={L(r.geography.body)}
      >
        <Meters
          cols
          label={isHi ? "लखनऊ के बाहर के शहर, विज़िट" : "Cities outside Lucknow, visits"}
          items={r.geography.cities.map((c, i) => ({ label: c.name, value: c.visits, hot: i === 0 }))}
        />
      </Section>

      {/* 7. Closing */}
      <Band
        id="recap-close"
        kicker={<Kicker>{L(r.closing.kicker)}</Kicker>}
        title={r.closing.heading}
        lede={L(r.closing.body)}
        art={<Plate {...HOME_ART.hanumanSitting} alt="" fade="bottom" />}
        actions={
          <>
            <Actions>
              <Button href={`/${q}#map`} icon="map" data-ga="recap_see_map">
                {L(r.closing.ctaMap)}
              </Button>
            </Actions>
            <p className="bmi-benediction" lang="hi">
              {r.closing.benediction}
            </p>
          </>
        }
      />
    </InnerShell>
  );
}
