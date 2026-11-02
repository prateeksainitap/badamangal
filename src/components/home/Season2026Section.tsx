import { T } from "@/components/T";
import { RECAP } from "@/content/recap";
import { getSeason2026, type SeasonDay } from "@/lib/home-season";
import type { SiteStats } from "@/lib/stats";
import LocaleLink from "./LocaleLink";
import SeasonTuesdays from "./SeasonTuesdays";
import Head from "./Head";

const fmt = (n: number) => n.toLocaleString("en-IN");

/**
 * Season 1 · Bada Mangal 2026: what the city did, in numbers and photos.
 * Season totals are live from the database (the same SiteStats the old
 * homepage panel used); page and reel views are the dated June snapshot
 * in src/content/recap.ts. Below them, a Tuesday picker: tap a day to
 * see that Tuesday's counts and its hand picked photos.
 */
export default async function Season2026Section({ stats }: { stats: SiteStats }) {
  let days: SeasonDay[] = [];
  try {
    days = await getSeason2026();
  } catch (err) {
    console.error("[home] season 2026 load failed", err);
  }

  const small = [
    { n: stats.areasCovered, en: "neighbourhoods", hi: "मोहल्ले", live: true },
    { n: stats.communityMembers, en: "on WhatsApp", hi: "व्हाट्सऐप पर", live: true },
    { n: RECAP.growth.totalPageViews, en: "page views", hi: "पेज व्यूज़", live: false },
    { text: RECAP.social.igTotalViews, en: "reel views", hi: "रील व्यूज़", live: false },
  ];
  const listedShare = stats.bhandarasTotal ? stats.bhandarasListed / stats.bhandarasTotal : 0.34;

  return (
    <section className="sec s26" id="season-2026" aria-labelledby="s26-h">
      <div className="wrap">
        <div className="sec-head c">
          <p className="kick" data-rv>
            <T en="Season 1 · 2026" hi={<span className="hi">सीज़न 1 · 2026</span>} />
          </p>
          <Head as="h2" id="s26-h" en="Bada Mangal 2026, in numbers and photos" hi="बड़ा मंगल 2026 की झलक" />
          <p className="lede" data-rv>
            <T
              en="Eight Tuesdays, 5 May to 23 June. Here is what Lucknow did."
              hi="आठ मंगलवार, 5 मई से 23 जून। देखिए लखनऊ ने क्या किया।"
            />
          </p>
        </div>

        <div className="tally" data-rv>
          <div className="tally-big">
            <p className="tb-n">
              <span data-count={stats.bhandarasTotal}>{fmt(stats.bhandarasTotal)}</span>
            </p>
            <p className="tb-l">
              <T en="bhandaras tracked" hi="भंडारे दर्ज हुए" />
            </p>
            <div className="split" style={{ ["--a" as string]: listedShare }}>
              <span className="split-bar" aria-hidden>
                <i className="sl" />
                <i className="ss" />
              </span>
              <p className="split-leg">
                <span>
                  <i className="dot dl" aria-hidden />
                  <b>{fmt(stats.bhandarasListed)}</b>{" "}
                  <T en="listed by organisers" hi="आयोजकों ने जोड़े" />
                </span>
                <span>
                  <i className="dot ds" aria-hidden />
                  <b>{fmt(stats.bhandarasSpotted)}</b>{" "}
                  <T en="spotted by neighbours" hi="पड़ोसियों ने खोजे" />
                </span>
              </p>
            </div>
          </div>
          <ul className="tally-row">
            {small.map((s) => (
              <li key={s.en}>
                <span className="ts-n">
                  {"text" in s ? (
                    s.text
                  ) : (
                    <span data-count={s.n}>{fmt(s.n ?? 0)}</span>
                  )}
                </span>
                <span className="ts-l">
                  <T en={s.en} hi={s.hi} />
                </span>
              </li>
            ))}
          </ul>
        </div>

        {days.length ? <SeasonTuesdays days={days} /> : null}

        <div className="s26-foot" data-rv>
          <p className="s26-note">
            <T
              en="Bhandara, neighbourhood and WhatsApp counts are live. Each Tuesday counts the bhandaras listed for that day and those spotted on it. The season total also counts Saturday spots and bhandaras counted from printed pamphlets, so the Tuesdays add up to less than the total. Page and reel views as of 24 June 2026."
              hi="भंडारे, मोहल्ले और व्हाट्सऐप के आँकड़े लाइव हैं। हर मंगल में उस दिन के लिए जोड़े गए और उस दिन खोजे गए भंडारे गिने गए हैं। कुल संख्या में शनिवार को खोजे गए और छपे पर्चों से गिने गए भंडारे भी हैं, इसलिए सारे मंगल मिलाकर कुल से कम होते हैं। पेज और रील व्यूज़ 24 जून 2026 तक के।"
            />
          </p>
          <div className="s26-links">
            <LocaleLink href="/gallery" className="b b-s" data-ga="season_gallery">
              <T en="See every photo" hi="सारी तस्वीरें देखें" />
            </LocaleLink>
            <LocaleLink href="/recap" className="tlink" data-ga="season_recap_full">
              <T en="Read the full season story" hi="पूरे सीज़न की कहानी पढ़ें" />
              <svg viewBox="0 0 24 24" className="ic" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </LocaleLink>
          </div>
        </div>
      </div>
    </section>
  );
}
