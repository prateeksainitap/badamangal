"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";
import { ALL_SEASON_TUESDAYS } from "@/lib/season";
import GalleryLightbox, {
  type GalleryItem,
  isFreshSpot,
} from "@/components/GalleryLightbox";
import {
  Actions,
  Band,
  Breadcrumb,
  Button,
  Chip,
  ChipList,
  EmptyState,
  Heading,
  InnerShell,
  Kicker,
  KickSep,
  PageHero,
  PhotoGrid,
  Print,
} from "@/components/v2";

/**
 * /gallery body (v2 inner page kit). Every photo on BadaMangal,
 * grouped by calendar day, newest day first, each day under its own
 * h2 ("23 Jun 2026", same strings as before the redesign). The
 * lightbox (portalled to <body>, full screen) flows across days.
 *
 * No captions are shown on the page: many are AI vision descriptions
 * (Founder's rule: never visible on a public photo), and none may name
 * the person who took or uploaded it. They stay as image alt text.
 */
type Props = {
  items: GalleryItem[];
};

const TUESDAYS = new Set(ALL_SEASON_TUESDAYS);

export default function GalleryFullView({ items }: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const langSuffix = locale === "en" ? "?lang=en" : "";

  // 60-second tick so the Live badges drop off as photos cross 8h
  // while the visitor is on the page.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Newest first (already so from the server, normalised again in
  // case both source streams interleave at the same second).
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
  }, [items]);

  // Group by calendar day, newest day first, "undated" last.
  const groups = useMemo(() => {
    const buckets = new Map<string, GalleryItem[]>();
    for (const it of sortedItems) {
      const date = it.createdAt ? it.createdAt.slice(0, 10) : "undated";
      const bucket = buckets.get(date);
      if (bucket) bucket.push(it);
      else buckets.set(date, [it]);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => {
        if (a[0] === "undated") return 1;
        if (b[0] === "undated") return -1;
        return b[0].localeCompare(a[0]);
      })
      .map(([date, list]) => ({ date, items: list }));
  }, [sortedItems]);

  // Flat index so the lightbox arrows cross day boundaries.
  const indexLookup = useMemo(() => {
    const m = new Map<string, number>();
    sortedItems.forEach((it, i) => m.set(it.id, i));
    return m;
  }, [sortedItems]);

  const openLightbox = useCallback(
    (id: string) => {
      const i = indexLookup.get(id);
      if (typeof i === "number") setLightboxIndex(i);
    },
    [indexLookup],
  );

  // The lightbox gets the photos without their captions (see above).
  const lightboxItems = useMemo(
    () => sortedItems.map((it) => ({ ...it, caption: undefined, captionHi: undefined, credit: undefined })),
    [sortedItems],
  );

  const altOf = (it: GalleryItem, dayLabel: string) => {
    const cap = (isHi && it.captionHi ? it.captionHi : it.caption) ?? "";
    return cap || (isHi ? `बड़ा मंगल की तस्वीर, ${dayLabel}` : `Bada Mangal photo, ${dayLabel}`);
  };

  // The hero print: the newest photo the team added from a Bada Mangal
  // Tuesday, else the newest daylight Tuesday photo, else any.
  const onTuesday = (it: GalleryItem) => !!it.createdAt && TUESDAYS.has(it.createdAt.slice(0, 10));
  // Daylight (9 AM to 4 PM IST) photos read bright and clear on a print.
  const inDaylight = (it: GalleryItem) => {
    if (!it.createdAt) return false;
    const h = new Date(Date.parse(it.createdAt) + 5.5 * 3600 * 1000).getUTCHours();
    return h >= 9 && h < 16;
  };
  const featured =
    sortedItems.find((it) => it.source === "admin" && onTuesday(it)) ??
    sortedItems.find((it) => onTuesday(it) && inDaylight(it)) ??
    sortedItems.find(onTuesday) ??
    sortedItems.find((it) => it.source === "admin") ??
    sortedItems[0];

  // Bada Mangal Tuesdays that have photos: quick jumps under the hero.
  const tuesdayDays = groups.filter((g) => TUESDAYS.has(g.date));

  // Busy days get their own block; runs of quiet days (one or two
  // photos) share a row.
  type Group = (typeof groups)[number];
  const runs: ({ kind: "day"; g: Group } | { kind: "row"; days: Group[] })[] = [];
  for (const g of groups) {
    const last = runs[runs.length - 1];
    if (g.items.length <= 2) {
      if (last && last.kind === "row") last.days.push(g);
      else runs.push({ kind: "row", days: [g] });
    } else runs.push({ kind: "day", g });
  }

  const dayHeading = (date: string) => {
    const label = formatDateHeading(date, isHi);
    return <Heading as="h2" size="sub" id={`day-${date}-h`} words={false} en={label} hi={label} />;
  };
  const dayFacts = (g: Group) => (
    <span className="bmi-gday-facts">
      {TUESDAYS.has(g.date) ? <span className="bmi-gday-tag">{isHi ? "बड़ा मंगल" : "Bada Mangal"}</span> : null}
      <span className="bmi-gday-count">
        {isHi
          ? `${g.items.length} ${g.items.length === 1 ? "तस्वीर" : "तस्वीरें"}`
          : `${g.items.length} photo${g.items.length === 1 ? "" : "s"}`}
      </span>
    </span>
  );
  const dayGrid = (g: Group) => {
    const label = formatDateHeading(g.date, isHi);
    return (
      <PhotoGrid
        dense
        label={label}
        onOpen={(i) => openLightbox(g.items[i].id)}
        items={g.items.map((it) => ({
          src: it.url,
          alt: altOf(it, label),
          badge: isFreshSpot(it) ? (isHi ? "लाइव" : "Live") : undefined,
        }))}
      />
    );
  };

  return (
    <>
      <InnerShell>
        <PageHero
          crumbs={
            <Breadcrumb
              items={[
                { label: isHi ? "होम" : "Home", href: `/${langSuffix}` },
                { label: isHi ? "गैलरी" : "Gallery" },
              ]}
            />
          }
          kicker={
            <Kicker>
              <span>{isHi ? "गैलरी" : "Gallery"}</span>
              <KickSep />
              <span>{isHi ? "बड़ा मंगल लखनऊ" : "Bada Mangal Lucknow"}</span>
            </Kicker>
          }
          title={{ en: "Snapshots from Lucknow", hi: "लखनऊ की झलकियाँ" }}
          lede={
            isHi
              ? `पूरी गैलरी, दिन के अनुसार सजी हुई। कुल ${sortedItems.length} तस्वीरें।`
              : `Every photo on BadaMangal, grouped by the day it landed. ${sortedItems.length} in total.`
          }
          meta={
            tuesdayDays.length > 0 ? (
              <>
              <span className="bmi-gal-jump">{isHi ? "सीधे देखें" : "Jump to"}</span>
              <ChipList label={isHi ? "बड़े मंगल के दिन" : "Bada Mangal Tuesdays"}>
                {tuesdayDays.map((g) => (
                  <Chip key={g.date} href={`#day-${g.date}`} tone="gold">
                    {formatDateHeading(g.date, isHi).replace(/ \d{4}$/, "")}
                  </Chip>
                ))}
              </ChipList>
              </>
            ) : undefined
          }
          art={
            featured ? (
              <div className="bmi-gal-hero">
              <Print
                src={featured.url}
                href={featured.url}
                alt={altOf(featured, featured.createdAt ? formatDateHeading(featured.createdAt.slice(0, 10), isHi) : "")}
                tilt={-2}
                priority
              />
              </div>
            ) : undefined
          }
        />

        {sortedItems.length === 0 ? (
          <section className="bmi-sec tight">
            <div className="bmi-wrap">
              <EmptyState
                lede={
                  isHi
                    ? "अभी कोई तस्वीर नहीं। पहली स्पॉट या अपलोड के बाद दिखेगी।"
                    : "No photos yet. The first spot or upload will land here."
                }
              />
            </div>
          </section>
        ) : null}

        {runs.map((run) =>
          run.kind === "day" ? (
            <section
              key={run.g.date}
              id={`day-${run.g.date}`}
              className="bmi-gday"
              aria-labelledby={`day-${run.g.date}-h`}
            >
              <div className="bmi-wrap">
                <div className="bmi-gday-head">
                  {dayHeading(run.g.date)}
                  {dayFacts(run.g)}
                </div>
                {dayGrid(run.g)}
              </div>
            </section>
          ) : (
            // Quiet days (one or two photos) sit side by side, each
            // still under its own h2, so a stray day never leaves a
            // lone thumbnail in an empty row.
            <div key={run.days[0].date} className="bmi-gday">
              <div className="bmi-wrap">
                <div className="bmi-grow">
                  {run.days.map((g) => (
                    <section
                      key={g.date}
                      id={`day-${g.date}`}
                      className="bmi-gcell"
                      style={{ ["--span" as string]: g.items.length }}
                      aria-labelledby={`day-${g.date}-h`}
                    >
                      <div className="bmi-gday-head">
                        {dayHeading(g.date)}
                        {dayFacts(g)}
                      </div>
                      {dayGrid(g)}
                    </section>
                  ))}
                </div>
              </div>
            </div>
          ),
        )}

        <Band
          lede={
            isHi
              ? "आज किसी भंडारे पर हैं? एक तस्वीर भेजें, वह यहाँ दिखेगी।"
              : "At a bhandara today? Send a photo and it lands here."
          }
          actions={
            <Actions>
              <Button href={`/spot${langSuffix}`} icon="camera">
                {isHi ? "भंडारा स्पॉट करें" : "Spot a bhandara"}
              </Button>
            </Actions>
          }
        />
      </InnerShell>

      {lightboxIndex !== null ? (
        <GalleryLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(i) => setLightboxIndex(i)}
          isHi={isHi}
        />
      ) : null}
    </>
  );
}

/** "2026-05-21" to "Today" / "Yesterday" / "21 May 2026" (or Hindi). */
function formatDateHeading(dateKey: string, isHi: boolean): string {
  if (dateKey === "undated") {
    return isHi ? "तारीख़ अज्ञात" : "Undated";
  }
  const now = new Date();
  const todayKey = isoLocalDate(now);
  const yKey = isoLocalDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (dateKey === todayKey) return isHi ? "आज" : "Today";
  if (dateKey === yKey) return isHi ? "कल" : "Yesterday";

  const [, mStr, dStr] = dateKey.split("-");
  const m = Number(mStr);
  const d = Number(dStr);
  if (!m || !d) return dateKey;
  const enMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const hiMonths = [
    "जन", "फ़र", "मार्च", "अप्रैल", "मई", "जून",
    "जुल", "अग", "सित", "अक्ट", "नव", "दिस",
  ];
  const year = dateKey.slice(0, 4);
  const month = (isHi ? hiMonths : enMonths)[m - 1] ?? "";
  return `${d} ${month} ${year}`;
}

/** YYYY-MM-DD in the local time zone (string only, no UTC drift). */
function isoLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
