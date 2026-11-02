"use client";

import { useMemo, useState } from "react";
import { HOME_ART } from "@/content/home-art";
import { strings } from "@/content/strings";
import { areaToSlug } from "@/lib/areaSlug";
import { trackEvent } from "@/lib/ga";
import { useLocaleFromContext } from "@/lib/locale-context";
import { SEASONS } from "@/lib/season";
import type { BhandaraListItem } from "@/types/bhandara";
import {
  Actions,
  BhandaraRow,
  Breadcrumb,
  Button,
  Chip,
  ChipList,
  EmptyState,
  Heading,
  Icon,
  InnerShell,
  Kicker,
  KickSep,
  ListRow,
  PageHero,
  Plate,
  RowList,
  longDate,
  dayMonth,
} from "@/components/v2";

/**
 * /archive (v2 inner page kit): the public record of bhandaras whose
 * moment has passed.
 *   Listed: organiser listed bhandaras whose every date is over, grouped
 *           under each day they served (newest day first).
 *   Spotted: crowd sourced spots whose 8 hour live window expired,
 *           grouped by the day they were posted.
 * No phones (the public list shape), no spotter names, no AI vision
 * captions. Tab and search state live on the client so the page stays
 * statically prerendered.
 */

type SpottedItem = {
  id: string;
  photoUrl: string | null;
  caption: string | null;
  area: string | null;
  address: string | null;
  reporterName: string | null;
  createdAt: string;
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  bhandaraNameHi: string | null;
};

type Tab = "listed" | "spotted";

const EN_ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
const HI_ORD = ["पहला", "दूसरा", "तीसरा", "चौथा", "पाँचवाँ", "छठा", "सातवाँ", "आठवाँ"];

/** "8th Bada Mangal" when the day is a season Tuesday, else null. */
function badaMangalLabel(iso: string, isHi: boolean): string | null {
  for (const s of SEASONS) {
    const i = s.tuesdays.indexOf(iso);
    if (i >= 0) return isHi ? `${HI_ORD[i] ?? i + 1} बड़ा मंगल` : `${EN_ORD[i] ?? `${i + 1}th`} Bada Mangal`;
  }
  return null;
}

/** IST calendar day of an ISO timestamp. */
const istDay = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/** "11:25 PM" in IST. */
function istClock(iso: string): string {
  const d = new Date(Date.parse(iso) + 5.5 * 3600 * 1000);
  const h = d.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const timeKey = (t: string | null | undefined) => (!t || t === "00:00" ? "99:99" : t.padStart(5, "0"));

function normalise(s: string | null | undefined): string {
  return (s ?? "").toLocaleLowerCase().trim();
}

export default function ArchiveTabs({
  listed,
  spotted,
}: {
  listed: BhandaraListItem[];
  spotted: SpottedItem[];
}) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = strings[locale];
  const langSuffix = isHi ? "" : "?lang=en";
  const [tab, setTab] = useState<Tab>("listed");
  const [query, setQuery] = useState("");

  const switchTo = (next: Tab) => {
    if (next === tab) return;
    setTab(next);
    trackEvent("archive_tab_switch", { tab: next });
  };

  // Substring search across the fields a visitor would plausibly type:
  // bhandara name (both scripts), area, organiser, address, caption.
  const q = normalise(query);
  const filteredListed = useMemo(() => {
    if (!q) return listed;
    return listed.filter((b) =>
      [b.name, b.nameHi, b.area, t.areas[b.area], b.organizerName, b.address]
        .map(normalise)
        .some((field) => field.includes(q)),
    );
  }, [listed, q, t]);
  const filteredSpotted = useMemo(() => {
    if (!q) return spotted;
    return spotted.filter((s) =>
      [s.caption, s.area, s.address, s.bhandaraName, s.bhandaraNameHi]
        .map(normalise)
        .some((field) => field.includes(q)),
    );
  }, [spotted, q]);

  // Listed: one row per bhandara per Bada Mangal Tuesday it served,
  // under that Tuesday (newest first). Bhandaras that served only on
  // other days (a Saturday, a week long langar) sit once, at the end.
  const listedDays = useMemo(() => {
    const tuesdays = new Set(SEASONS.flatMap((s) => s.tuesdays));
    const byDay = new Map<string, BhandaraListItem[]>();
    const undated: BhandaraListItem[] = [];
    for (const b of filteredListed) {
      const tues = [...new Set(b.tuesdayDates ?? [])].filter((d) => tuesdays.has(d));
      if (tues.length === 0) undated.push(b);
      for (const d of tues) {
        const list = byDay.get(d);
        if (list) list.push(b);
        else byDay.set(d, [b]);
      }
    }
    const days = [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        // By start time; rows without a time ("00:00") go last.
        items: items.sort((x, y) => timeKey(x.timeStart).localeCompare(timeKey(y.timeStart))),
      }));
    undated.sort((x, y) => {
      const lx = [...(x.tuesdayDates ?? [])].sort().pop() ?? "";
      const ly = [...(y.tuesdayDates ?? [])].sort().pop() ?? "";
      return ly.localeCompare(lx);
    });
    return { days, undated };
  }, [filteredListed]);

  // Spotted: by the IST day they were posted, newest first.
  const spottedDays = useMemo(() => {
    const byDay = new Map<string, SpottedItem[]>();
    for (const s of filteredSpotted) {
      const d = istDay(s.createdAt);
      const list = byDay.get(d);
      if (list) list.push(s);
      else byDay.set(d, [s]);
    }
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => ({ date, items }));
  }, [filteredSpotted]);

  const counts = { listed: filteredListed.length, spotted: filteredSpotted.length };

  const onSearchChange = (next: string) => {
    setQuery(next);
    if (next.trim().length >= 3) {
      trackEvent("archive_search", { length: next.trim().length });
    }
  };

  const tuesdayJumps = tab === "listed" ? listedDays.days : [];

  const dayHead = (date: string, n: number, idPrefix: string) => {
    const bm = badaMangalLabel(date, isHi);
    return (
      <div className="bmi-gday-head">
        <Heading
          as="h2"
          size="sub"
          id={`${idPrefix}-${date}-h`}
          words={false}
          en={longDate(date, "en", true)}
          hi={longDate(date, "hi", true)}
        />
        <span className="bmi-gday-facts">
          {bm ? <span className="bmi-gday-tag">{bm}</span> : null}
          <span className="bmi-gday-count">
            {isHi ? `${n} भंडारे` : `${n} ${n === 1 ? "bhandara" : "bhandaras"}`}
          </span>
        </span>
      </div>
    );
  };

  return (
    <InnerShell>
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: `/${langSuffix}` },
              { label: isHi ? "बीते भंडारे" : "Past Bhandaras" },
            ]}
          />
        }
        kicker={
          <Kicker>
            <span>{isHi ? "बीते भंडारे" : "Past Bhandaras"}</span>
            <KickSep />
            <span>{isHi ? "बड़ा मंगल लखनऊ" : "Bada Mangal Lucknow"}</span>
          </Kicker>
        }
        title={{ en: "Bhandaras of past Tuesdays", hi: "बीते मंगलों के भंडारे" }}
        lede={
          isHi
            ? "हर मंगल जिसका वक़्त बीत गया, यहाँ दर्ज है। ऑर्गनाइज़र के सूचीबद्ध भंडारे और राहगीरों के स्पॉट किए हुए, दोनों एक जगह।"
            : "Every Tuesday whose moment has passed, kept here on the record. Both organiser-listed bhandaras and passer-by spotted sightings, side by side."
        }
        art={<Plate {...HOME_ART.bhandaraLine} alt="" fade="edges" priority />}
      />

      {/* Controls: the two records and a search across both. */}
      <section className="bmi-sec tight" aria-label={isHi ? "बीते भंडारे खोजें" : "Search past bhandaras"}>
        <div className="bmi-wrap">
          <div className="bmi-arch-bar">
            <div role="tablist" aria-label={isHi ? "अभिलेख फ़िल्टर" : "Archive filter"} className="bmi-arch-tabs">
              {(
                [
                  { key: "listed" as const, label: isHi ? "सूचीबद्ध" : "Listed", count: counts.listed },
                  { key: "spotted" as const, label: isHi ? "स्पॉट किए" : "Spotted", count: counts.spotted },
                ]
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  id={`arch-tab-${item.key}`}
                  aria-selected={tab === item.key}
                  aria-controls="arch-panel"
                  onClick={() => switchTo(item.key)}
                  className="bmi-choice"
                >
                  <span>{item.label}</span>
                  <span className="n">{item.count}</span>
                </button>
              ))}
            </div>
            <label className="bmi-field bmi-arch-search">
              <span className="bmi-sr">{isHi ? "खोजें" : "Search past bhandaras"}</span>
              <Icon name="search" className="ic" />
              <input
                type="search"
                value={query}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={isHi ? "नाम, क्षेत्र, ऑर्गनाइज़र से खोजें" : "Search by name, area or organiser"}
                aria-label={isHi ? "बीते भंडारे खोजें" : "Search past bhandaras"}
              />
              {query.length > 0 ? (
                <button
                  type="button"
                  className="clr"
                  onClick={() => onSearchChange("")}
                  aria-label={isHi ? "खोज साफ़ करें" : "Clear search"}
                >
                  <Icon name="plus" />
                </button>
              ) : null}
            </label>
          </div>
          {q ? (
            <p className="bmi-fine bmi-arch-n" aria-live="polite">
              {isHi
                ? `${counts.listed + counts.spotted} परिणाम`
                : `${counts.listed + counts.spotted} result${counts.listed + counts.spotted === 1 ? "" : "s"}`}
            </p>
          ) : null}
          {tuesdayJumps.length > 0 ? (
            <div className="bmi-arch-jump">
              <span className="bmi-gal-jump">{isHi ? "सीधे देखें" : "Jump to"}</span>
              <ChipList label={isHi ? "बड़े मंगल" : "Bada Mangal Tuesdays"}>
                {tuesdayJumps.map((d) => (
                  <Chip key={d.date} href={`#tue-${d.date}`} tone="gold">
                    {dayMonth(d.date, locale)}
                  </Chip>
                ))}
              </ChipList>
            </div>
          ) : null}
        </div>
      </section>

      <div id="arch-panel" role="tabpanel" aria-labelledby={`arch-tab-${tab}`}>
        {tab === "listed" ? (
          filteredListed.length === 0 ? (
            q ? (
              <NoMatches isHi={isHi} onClear={() => onSearchChange("")} />
            ) : (
              <ArchiveEmpty isHi={isHi} variant="listed" />
            )
          ) : (
            <>
              {listedDays.days.map(({ date, items }) => (
                <section key={date} id={`tue-${date}`} className="bmi-gday" aria-labelledby={`tue-${date}-h`}>
                  <div className="bmi-wrap">
                    {dayHead(date, items.length, "tue")}
                    <RowList cols>
                      {items.map((b) => (
                        <BhandaraRow key={`${b.id}-${date}`} b={b} date="none" pinned={date} gaEvent="archive_listed_open" />
                      ))}
                    </RowList>
                  </div>
                </section>
              ))}
              {listedDays.undated.length > 0 ? (
                <section className="bmi-gday" aria-labelledby="tue-undated-h">
                  <div className="bmi-wrap">
                    <div className="bmi-gday-head">
                      <Heading as="h2" size="sub" id="tue-undated-h" words={false} en="On other days" hi="दूसरे दिनों पर" />
                      <span className="bmi-gday-facts">
                        <span className="bmi-gday-count">
                          {isHi
                            ? `${listedDays.undated.length} भंडारे`
                            : `${listedDays.undated.length} ${listedDays.undated.length === 1 ? "bhandara" : "bhandaras"}`}
                        </span>
                      </span>
                    </div>
                    <RowList cols>
                      {listedDays.undated.map((b) => (
                        <BhandaraRow key={b.id} b={b} date="past" gaEvent="archive_listed_open" />
                      ))}
                    </RowList>
                  </div>
                </section>
              ) : null}
            </>
          )
        ) : filteredSpotted.length === 0 ? (
          q ? (
            <NoMatches isHi={isHi} onClear={() => onSearchChange("")} />
          ) : (
            <ArchiveEmpty isHi={isHi} variant="spotted" />
          )
        ) : (
          spottedDays.map(({ date, items }) => (
            <section key={date} id={`spot-${date}`} className="bmi-gday" aria-labelledby={`spot-${date}-h`}>
              <div className="bmi-wrap">
                <div className="bmi-gday-head">
                  <Heading
                    as="h2"
                    size="sub"
                    id={`spot-${date}-h`}
                    words={false}
                    en={longDate(date, "en", true)}
                    hi={longDate(date, "hi", true)}
                  />
                  <span className="bmi-gday-facts">
                    {badaMangalLabel(date, isHi) ? <span className="bmi-gday-tag">{badaMangalLabel(date, isHi)}</span> : null}
                    <span className="bmi-gday-count">
                      {isHi ? `${items.length} स्पॉट` : `${items.length} ${items.length === 1 ? "spot" : "spots"}`}
                    </span>
                  </span>
                </div>
                <RowList cols>
                  {items.map((s) => {
                    const linkedName = isHi ? (s.bhandaraNameHi ?? s.bhandaraName) : s.bhandaraName;
                    const areaLabel = s.area ? (t.areas[s.area] ?? s.area) : null;
                    const knownArea = s.area && t.areas[s.area] ? s.area : null;
                    const title = linkedName || areaLabel || (isHi ? "स्पॉट किया भंडारा" : "Spotted bhandara");
                    const meta = [linkedName ? areaLabel : null, s.caption].filter(Boolean).join(" · ");
                    const href = s.bhandaraSlug
                      ? `/bhandara/${s.bhandaraSlug}${langSuffix}`
                      : knownArea
                        ? `/area/${areaToSlug(knownArea)}${langSuffix}`
                        : (s.photoUrl ?? `/live${langSuffix}`);
                    return (
                      <ListRow
                        key={s.id}
                        href={href}
                        external={!s.bhandaraSlug && !knownArea && !!s.photoUrl}
                        title={title}
                        kicker={istClock(s.createdAt)}
                        meta={meta || (isHi ? "लखनऊ" : "Lucknow")}
                        muted
                        thumb={s.photoUrl ? { src: s.photoUrl, alt: `${title}, ${dayMonth(date, locale)}` } : "gada"}
                        linkProps={s.bhandaraSlug ? { "data-ga": "archive_spotted_open_bhandara", "data-ga-slug": s.bhandaraSlug } : undefined}
                      />
                    );
                  })}
                </RowList>
              </div>
            </section>
          ))
        )}
      </div>
      <div className="bmi-sec" aria-hidden />
    </InnerShell>
  );
}

function NoMatches({ isHi, onClear }: { isHi: boolean; onClear: () => void }) {
  return (
    <section className="bmi-sec tight">
      <div className="bmi-wrap">
        <EmptyState
          art={null}
          headingAs="p"
          title={{ en: "No matches.", hi: "कोई मिलान नहीं मिला।" }}
          lede={isHi ? "अलग शब्दों से कोशिश करें, या खोज साफ़ करें।" : "Try a different term, or clear the search to see everything."}
          actions={
            <Actions>
              <Button variant="secondary" onClick={onClear}>
                {isHi ? "खोज साफ़ करें" : "Clear search"}
              </Button>
            </Actions>
          }
        />
      </div>
    </section>
  );
}

function ArchiveEmpty({ isHi, variant }: { isHi: boolean; variant: "listed" | "spotted" }) {
  const copy =
    variant === "listed"
      ? {
          en: "No bhandaras have wrapped up yet.",
          hi: "अभी कोई भंडारा बीता नहीं।",
          body: isHi
            ? "जैसे ही पहला मंगलवार पूरा होगा, उस दिन के भंडारे यहाँ अपने-आप सहेज लिए जाएँगे।"
            : "As soon as the first Tuesday completes, that day's bhandaras will be quietly archived here.",
        }
      : {
          en: "No spots have expired yet.",
          hi: "अभी कोई स्पॉट एक्सपायर नहीं हुआ।",
          body: isHi
            ? "हर स्पॉट 8 घंटे तक लाइव फ़ीड में रहता है, फिर यहाँ आ जाता है।"
            : "Every spot stays on the live feed for 8 hours, then settles here for the long-term record.",
        };
  return (
    <section className="bmi-sec tight">
      <div className="bmi-wrap">
        <EmptyState title={{ en: copy.en, hi: copy.hi }} lede={copy.body} />
      </div>
    </section>
  );
}
