import { T } from "@/components/T";
import { GADA_PIN } from "@/content/home-art";
import { featuredSeason, istIso } from "@/lib/season";
import LocaleLink from "./LocaleLink";
import NextMangalCountdown from "./NextMangalCountdown";
import Head from "./Head";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_HI = ["जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुला", "अग", "सित", "अक्टू", "नव", "दिस"];
const MONTHS_EN_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_HI_FULL = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
const COUNT_EN: Record<number, string> = { 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight" };
const COUNT_HI: Record<number, string> = { 4: "चार", 5: "पाँच", 6: "छह", 7: "सात", 8: "आठ" };

type Bead = { iso: string; day: number; month: number; state: "past" | "today" | "future" };

/** "25 May, 1, 8 and 15 June" / "25 मई, 1, 8 और 15 जून". */
function dateList(beads: Bead[], hi: boolean): string {
  const tokens = beads.map((b, i) => {
    const lastOfMonth = i === beads.length - 1 || beads[i + 1].month !== b.month;
    return lastOfMonth ? `${b.day} ${(hi ? MONTHS_HI_FULL : MONTHS_EN_FULL)[b.month]}` : String(b.day);
  });
  if (tokens.length < 2) return tokens.join("");
  return `${tokens.slice(0, -1).join(", ")} ${hi ? "और" : "and"} ${tokens[tokens.length - 1]}`;
}

/** Strand label: "May 2026", or "May and June 2027" when it spans two. */
function strandLabel(strand: Bead[], year: number, hi: boolean): string {
  const months = [...new Set(strand.map((b) => b.month))];
  const names = months.map((m) => (hi ? MONTHS_HI_FULL : MONTHS_EN_FULL)[m]);
  return `${names.join(hi ? " और " : " and ")} ${year}`;
}

/** Bead positions along each swag: (t along the string, k down the sag). */
const POS = [
  { t: 0.125, k: 0.4375 },
  { t: 0.375, k: 0.9375 },
  { t: 0.625, k: 0.9375 },
  { t: 0.875, k: 0.4375 },
];

/**
 * 2 · The season's Tuesdays (comp A): gada-bead swags, four beads each.
 * Past Tuesdays light up one by one as the swag scrolls in; a Tuesday
 * that is today glows; future ones stay unlit. Server computed from the
 * featured season (lib/season.ts: the running season, else the last
 * completed one) in IST, so the state is honest every day of the year.
 * Off season that is 2026 (eight Tuesdays, two swags, unchanged copy)
 * plus the countdown; in the 2027 season it is 2027's four Tuesdays on
 * one swag. "Season complete" only shows once the season's window has
 * closed, never while it runs.
 */
export default function SeasonMala({ now }: { now?: Date }) {
  const at = now ?? new Date();
  const today = istIso(at);
  const season = featuredSeason(at);
  const is2026 = season.year === 2026;
  const beads: Bead[] = season.tuesdays.map((iso) => ({
    iso,
    day: Number(iso.slice(8, 10)),
    month: Number(iso.slice(5, 7)) - 1,
    state: iso < today ? "past" : iso === today ? "today" : "future",
  }));
  const seasonOver = today > season.endISO;
  const next = beads.find((b) => b.state !== "past");
  const strands: Bead[][] = [];
  for (let i = 0; i < beads.length; i += POS.length) strands.push(beads.slice(i, i + POS.length));
  const n = beads.length;

  return (
    <section className="sec season" id="season" aria-labelledby="season-h">
      {/* Kalava thread gradient for the lit part of each swag. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          <linearGradient id="bmh-kalava" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#B8332A" />
            <stop offset=".25" stopColor="#E07A1F" />
            <stop offset=".5" stopColor="#B8332A" />
            <stop offset=".75" stopColor="#E9A93C" />
            <stop offset="1" stopColor="#B8332A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="wrap">
        <div className="sec-head c">
          <p className="kick" data-rv>
            {seasonOver ? (
              <>
                <span className="done-tick" aria-hidden>
                  <svg viewBox="0 0 20 20" className="ic">
                    <path d="M5.5 10.4l3 3 6-6.6" />
                  </svg>
                </span>
                <T en="Season complete" hi={<span className="hi">सीज़न पूरा हुआ</span>} />
              </>
            ) : (
              is2026 ? (
                <T en="Adhik Maas 2026" hi={<span className="hi">अधिक मास 2026</span>} />
              ) : (
                <T en={`Bada Mangal ${season.year}`} hi={<span className="hi">{`बड़ा मंगल ${season.year}`}</span>} />
              )
            )}
          </p>
          {is2026 ? (
            <>
              <Head en="Eight Tuesdays. A rare year." hi="आठ बड़े मंगल, एक दुर्लभ साल" />
              <h2 className="h2-en" id="season-h" data-rv>
                <T
                  en="2026 was a rare Adhik Maas year with eight Tuesdays."
                  hi="2026 अधिक मास का दुर्लभ साल था, आठ मंगलवारों वाला।"
                />
              </h2>
              <p className="lede" data-rv>
                <T en="Last seen in 2007. Next in 2045." hi="पिछली बार 2007 में, अगली बार 2045 में।" />
              </p>
            </>
          ) : (
            <>
              <Head
                en={`${COUNT_EN[n] ?? n} Tuesdays of Jyeshtha.`}
                hi={`ज्येष्ठ के ${COUNT_HI[n] ?? n} बड़े मंगल`}
              />
              <h2 className="h2-en" id="season-h" data-rv>
                <T
                  en={`Bada Mangal ${season.year}: ${dateList(beads, false)}.`}
                  hi={`बड़ा मंगल ${season.year}: ${dateList(beads, true)}।`}
                />
              </h2>
              <p className="lede" data-rv>
                <T
                  en="Bhandaras open across Lucknow from morning to evening."
                  hi="सुबह से शाम तक, पूरे लखनऊ में भंडारे।"
                />
              </p>
            </>
          )}
        </div>

        <div className={`mala${strands.length === 1 ? " one" : ""}`} data-mala>
          {strands.map((strand, si) => (
            <div className="strand" key={si} data-strand>
              <span className="strand-label">
                {is2026 ? (
                  <T en={si === 0 ? "May 2026" : "June 2026"} hi={si === 0 ? "मई 2026" : "जून 2026"} />
                ) : (
                  <T en={strandLabel(strand, season.year, false)} hi={strandLabel(strand, season.year, true)} />
                )}
              </span>
              <svg className="thread" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <path className="base" d="M0 0 Q50 200 100 0" />
                <path className="lit" pathLength={1} d="M0 0 Q50 200 100 0" />
              </svg>
              <span className="knot l" aria-hidden />
              <span className="knot r" aria-hidden />
              <ol className="beads">
                {strand.map((b, i) => (
                  <li
                    key={b.iso}
                    className={`bead ${b.state === "future" ? "future" : ""} ${b.state === "today" ? "today" : ""}`}
                    data-bead={b.state}
                    style={{ ["--t" as string]: POS[i].t, ["--k" as string]: POS[i].k }}
                  >
                    <div className="g">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={GADA_PIN} alt="" width={92} height={92} />
                    </div>
                    <span className="d">{b.day}</span>
                    <span className="m">
                      <T en={MONTHS_EN[b.month]} hi={<span className="hi">{MONTHS_HI[b.month]}</span>} />
                    </span>
                    <span className="sr">
                      {b.state === "past" ? <T en=", served" hi=", हो चुका" /> : b.state === "today" ? <T en=", today" hi=", आज" /> : <T en=", coming up" hi=", आने वाला" />}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="season-foot" data-rv>
          {seasonOver ? (
            <>
              <p className="big">
                <T en="Next Jyeshtha, Lucknow cooks again." hi="अगले ज्येष्ठ, लखनऊ फिर से पकाएगा।" />
              </p>
              <NextMangalCountdown serverNow={at.getTime()} />
              <p className="sm">
                <T
                  en={`Every pin, plate and photo from ${season.year} stays here till then.`}
                  hi={`${season.year} का हर पिन, हर थाली, हर तस्वीर तब तक यहीं रहेगी।`}
                />
              </p>
              {is2026 ? (
                <LocaleLink href="/recap" className="tlink" data-ga="season_recap">
                  <T en="See how the 2026 season went" hi="2026 का पूरा सीज़न देखें" />
                  <svg viewBox="0 0 24 24" className="ic" aria-hidden>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </LocaleLink>
              ) : null}
            </>
          ) : next ? (
            <p className="big">
              <T
                en={`${next.state === "today" ? "Today" : "Next"}: ${next.day} ${MONTHS_EN[next.month]}, gates open across the city.`}
                hi={`${next.state === "today" ? "आज" : "अगला मंगल"}: ${next.day} ${MONTHS_HI[next.month]}, शहर भर में भंडारे।`}
              />
            </p>
          ) : (
            <p className="big">
              <T
                en={`Every Bada Mangal of ${season.year} has been served. Jai Hanuman.`}
                hi={`${season.year} के सारे बड़े मंगल पूरे हुए। जय हनुमान।`}
              />
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
