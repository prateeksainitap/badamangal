"use client";

import { strings } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";
import type { BhandaraListItem } from "@/types/bhandara";
import ListRow from "./ListRow";
import { dayMonth, istToday, servedSpan, timeRange } from "./format";

/**
 * A bhandara as a <ListRow>: date and time over the name (in the
 * visitor's language), area and address under it, the photo as the
 * thumbnail (the gada pin when there is none). Links to its page with
 * the same href the old cards used (`/bhandara/<slug>?lang=en` for
 * English). Takes the PUBLIC list shape, so no phone can leak.
 *
 *   <RowList cols>{list.map((b) => <BhandaraRow key={b.id} b={b} />)}</RowList>
 *
 * `date`: a pinned service date (per date lists), "next" (default,
 * the next upcoming or the last served), or "past" ("Served 5 May to
 * 23 Jun 2026", muted), or "none" (time only, for lists already
 * grouped under a date heading; pass `pinned` for the GA date).
 */
export default function BhandaraRow({
  b,
  date = "next",
  pinned,
  titleAs = "h3",
  gaEvent = "card_open_bhandara",
}: {
  b: BhandaraListItem;
  date?: "next" | "past" | "pinned" | "none";
  pinned?: string | null;
  titleAs?: "h2" | "h3" | "p";
  gaEvent?: string;
}) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = strings[locale];
  const today = istToday();
  const dates = [...(b.tuesdayDates ?? [])].sort();
  const iso =
    date === "pinned" || (date === "none" && pinned)
      ? (pinned ?? null)
      : dates.includes(today)
        ? today
        : (dates.find((d) => d > today) ?? dates[dates.length - 1] ?? null);
  const dateLabel =
    date === "none"
      ? ""
      : date === "past"
      ? servedSpan(dates, locale)
      : iso
        ? iso === today
          ? isHi
            ? "आज"
            : "Today"
          : dayMonth(iso, locale)
        : "";
  const time = timeRange(b.timeStart, b.timeEnd, locale);
  const kicker = [dateLabel, time].filter(Boolean).join(" · ");
  const area = t.areas[b.area] ?? b.area;
  const address = isHi ? (b.addressHi ?? b.address) : b.address;
  const name = isHi ? b.nameHi || b.name : b.name;
  const meta = [area, address && address !== area ? address : ""].filter(Boolean).join(" · ");
  return (
    <ListRow
      href={`/bhandara/${b.slug}${isHi ? "" : "?lang=en"}`}
      title={name}
      titleAs={titleAs}
      kicker={kicker || undefined}
      meta={meta}
      muted={date === "past"}
      thumb={b.photoUrl ? { src: b.photoUrl, alt: `${name} bhandara in ${area}, Lucknow` } : "gada"}
      linkProps={{ "data-ga": gaEvent, "data-ga-slug": b.slug, "data-ga-date": iso ?? "" }}
    />
  );
}
