import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { getCity } from "@/lib/cities";
import { cleanName } from "@/lib/display-name";
import { hasDevanagari, loadOgFonts, OG_BODY_FONT, OG_HEADING_FONT } from "@/lib/og-hindi";

export const runtime = "nodejs";
export const alt = "Bada Mangal Bhandara";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SAFFRON_50 = "#FFF6EE";
const SAFFRON_600 = "#E07A1F";
const SINDOOR_700 = "#9C2A2A";
const GOLD_500 = "#C9A24A";
const GOLD_100 = "#F5EAC9";
const INK_900 = "#1A1410";
const INK_600 = "#5A4F46";
const CREAM_50 = "#FBF7F0";

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

/** "Tuesday 12 May 2026", or "Tue 12 May · Tue 19 May + 3 more, 2026". */
function formatDates(json: string | null | undefined): string {
  let iso: string[] = [];
  try {
    const parsed: unknown = JSON.parse(json || "[]");
    if (Array.isArray(parsed)) iso = parsed.filter((d): d is string => typeof d === "string");
  } catch {
    return "";
  }
  const dates = iso
    .map((d) => new Date(`${d.slice(0, 10)}T12:00:00+05:30`))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return "";
  if (dates.length === 1) {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    })
      .format(dates[0])
      .replace(",", "");
  }
  const fmt = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  const shown = dates.slice(0, 3).map((d) => fmt.format(d).replace(",", ""));
  const more = dates.length - shown.length;
  const year = dates[0].getUTCFullYear();
  return `${shown.join(" · ")}${more > 0 ? ` + ${more} more` : ""}, ${year}`;
}

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = await prisma.bhandara.findUnique({ where: { slug } });

  const fonts = await loadOgFonts();

  // English only: next/og cannot shape Devanagari (it prints "मंदरि" for
  // "मंदिर"), and bhandara names are organiser data, so they cannot be
  // pre-shaped like the fixed wordmarks in src/lib/og-hindi.ts. The few
  // organisers who typed the name only in Hindi get a clean English title.
  const city = getCity(record?.city);
  const name = record && !hasDevanagari(record.name) ? cleanName(record.name) : "";
  const area = record && !hasDevanagari(record.area) ? record.area : "";
  const heading = name || "Bada Mangal Bhandara";
  const headingSize = heading.length <= 26 ? 88 : heading.length <= 42 ? 72 : 60;
  // "00:00" with no end time is how unknown times were stored; skip it
  // rather than print a midnight start.
  const timeKnown = !!record && !(record.timeStart.trim() === "00:00" && !record.timeEnd);
  const time = record && timeKnown
    ? record.timeEnd
      ? `${format12h(record.timeStart)} to ${format12h(record.timeEnd)}`
      : format12h(record.timeStart)
    : "";
  const meta = [[area, city.name].filter(Boolean).join(", "), time].filter(Boolean).join(" · ");
  const subhead = formatDates(record?.tuesdayDates);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 72,
          background: `linear-gradient(180deg, ${SAFFRON_50} 0%, ${CREAM_50} 100%)`,
          fontFamily: `${OG_BODY_FONT}, sans-serif`,
        }}
      >
        {/* Top brand row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="14" fill={SAFFRON_600} />
              <circle cx="32" cy="20" r="9" fill={CREAM_50} />
              <rect x="29.5" y="26" width="5" height="22" rx="2" fill={CREAM_50} />
              <ellipse cx="32" cy="50" rx="6.5" ry="2.2" fill={CREAM_50} />
            </svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontFamily: OG_HEADING_FONT,
                  fontSize: 28,
                  fontWeight: 700,
                  color: INK_900,
                  lineHeight: 1.1,
                }}
              >
                BadaMangal.com
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: INK_600,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                {`${city.name} Bhandara`}
              </div>
            </div>
          </div>
          {record?.isSponsored ? (
            <div
              style={{
                background: GOLD_100,
                border: `1px solid ${GOLD_500}`,
                borderRadius: 999,
                display: "flex",
                padding: "8px 18px 6px",
                fontFamily: OG_HEADING_FONT,
                fontSize: 16,
                color: INK_900,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Sponsored
            </div>
          ) : null}
        </div>

        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", maxWidth: 1056 }}>
          <div
            style={{
              fontFamily: OG_HEADING_FONT,
              fontSize: 18,
              fontWeight: 600,
              color: GOLD_500,
              letterSpacing: 6,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {meta}
          </div>
          <div
            style={{
              fontFamily: OG_HEADING_FONT,
              fontSize: headingSize,
              fontWeight: 700,
              color: SINDOOR_700,
              lineHeight: 1.04,
              letterSpacing: -1.5,
            }}
          >
            {heading}
          </div>
          {subhead ? (
            <div
              style={{
                fontSize: 32,
                fontWeight: 500,
                color: INK_900,
                marginTop: 16,
              }}
            >
              {subhead}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 36,
            color: INK_600,
            fontSize: 20,
            fontWeight: 500,
          }}
        >
          <div style={{ height: 1, width: 60, background: SAFFRON_600 }} />
          <span>Bada Mangal · 2026 · Eight Tuesdays</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
