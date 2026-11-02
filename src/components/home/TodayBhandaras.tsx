import { T } from "@/components/T";
import type { BhandaraListItem } from "@/types/bhandara";
import { formatTimeRange } from "@/lib/time";
import { badaMangalToday, currentSeason, istIso } from "@/lib/season";
import LocaleLink from "./LocaleLink";
import Head from "./Head";

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_HI = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
const WEEK_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_HI = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];
const MAX_ROWS = 8;

/** Start time for ordering; unknown times ("" or the bot's "00:00") last. */
const sortKey = (b: BhandaraListItem) => (!b.timeStart || (b.timeStart === "00:00" && !b.timeEnd) ? "99" : b.timeStart);

const directions = (b: BhandaraListItem) =>
  `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;

/**
 * In season only: the bhandaras listed for today (IST), right under the
 * hero. Time, name, area, the bhandara page and a directions link, from
 * the listings the homepage already loads. Hidden off season and on
 * season days with nothing listed, except a Bada Mangal Tuesday, which
 * gets one short line pointing at the map and the listing form.
 */
export default function TodayBhandaras({ listings, now }: { listings: BhandaraListItem[]; now?: Date }) {
  const at = now ?? new Date();
  if (!currentSeason(at)) return null;
  const today = istIso(at);
  const tuesday = badaMangalToday(at);
  const rows = listings
    .filter((b) => b.tuesdayDates.includes(today))
    .sort((a, z) => sortKey(a).localeCompare(sortKey(z)) || a.name.localeCompare(z.name));
  if (!rows.length && !tuesday) return null;

  const [y, m, d] = today.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <section className="sec tdy" id="today" aria-labelledby="tdy-h">
      <div className="wrap">
        <div className="sec-head">
          <p className="kick" data-rv>
            <span className="tdy-dot" aria-hidden />
            <T
              en={`Today · ${WEEK_EN[wd]}, ${d} ${MONTHS_EN[m - 1]}`}
              hi={<span className="hi">{`आज · ${WEEK_HI[wd]}, ${d} ${MONTHS_HI[m - 1]}`}</span>}
            />
          </p>
          <Head
            as="h2"
            id="tdy-h"
            className="h2 words tdy-h"
            en={tuesday ? "Bhandaras on today's Bada Mangal" : "Bhandaras today"}
            hi={tuesday ? "आज बड़े मंगल के भंडारे" : "आज के भंडारे"}
          />
        </div>

        {shown.length ? (
          <ol className="tdy-list">
            {shown.map((b) => {
              // "00:00" with no end is the bot's "time unknown" fallback.
              const unknown = b.timeStart === "00:00" && !b.timeEnd;
              const time = unknown ? "" : formatTimeRange(b.timeStart, b.timeEnd, "en");
              const timeHi = unknown ? "" : formatTimeRange(b.timeStart, b.timeEnd, "hi");
              const area = (b.area || "").trim();
              const hasPin = b.lat !== 0 && b.lng !== 0;
              return (
                <li key={b.id}>
                  <span className="tdy-time">
                    <T en={time || "Time not given"} hi={timeHi || "समय नहीं दिया"} />
                  </span>
                  <LocaleLink href={`/bhandara/${b.slug}`} className="tdy-name" data-ga="today_open_bhandara">
                    <T en={b.name} hi={b.nameHi || b.name} />
                  </LocaleLink>
                  {area ? <span className="tdy-area">{area}</span> : <span className="tdy-area" />}
                  {hasPin ? (
                    <a
                      className="tdy-go"
                      href={directions(b)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-ga="today_directions"
                    >
                      <T en="Directions" hi="रास्ता" />
                      <svg viewBox="0 0 24 24" className="ic" aria-hidden>
                        <path d="M7 17L17 7M9 7h8v8" />
                      </svg>
                    </a>
                  ) : (
                    <span className="tdy-go" />
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="lede">
            <T
              en="Nothing listed for today yet. Spotted one? Add it for the city."
              hi="आज के लिए अभी कोई भंडारा नहीं जुड़ा। आपने देखा? शहर के लिए जोड़ें।"
            />
          </p>
        )}

        <div className="tdy-foot">
          <a className="tlink" href="#map" data-ga="today_to_map">
            {rows.length > MAX_ROWS ? (
              <T en={`See all ${rows.length} on the map`} hi={`सभी ${rows.length} नक़्शे पर देखें`} />
            ) : rows.length === 0 ? (
              <T en="Open the map" hi="नक़्शा खोलें" />
            ) : (
              <T en="See them on the map" hi="नक़्शे पर देखें" />
            )}
            <svg viewBox="0 0 24 24" className="ic" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </a>
          <LocaleLink href="/list-bhandara" className="tlink" data-ga="today_add_bhandara">
            <T en="Add a bhandara" hi="भंडारा जोड़ें" />
            <svg viewBox="0 0 24 24" className="ic" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </LocaleLink>
        </div>
      </div>
    </section>
  );
}
