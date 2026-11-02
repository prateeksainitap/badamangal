/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { loadOgFonts, ogHindiWordmark, OG_BODY_FONT, OG_HEADING_FONT } from "@/lib/og-hindi";

export const runtime = "nodejs";
export const alt = "The story of Bada Mangal · A 400-year Lucknow tradition";
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

export default async function OG() {
  const fonts = await loadOgFonts();
  // Pre-shaped wordmark: next/og cannot shape Devanagari (src/lib/og-hindi.ts).
  const hindi = ogHindiWordmark("बड़ा मंगल का इतिहास");

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
        {/* Top row */}
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
                The story
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              background: GOLD_100,
              border: `1px solid ${GOLD_500}`,
              borderRadius: 999,
              padding: "8px 18px 6px",
              fontFamily: OG_HEADING_FONT,
              fontSize: 16,
              color: SINDOOR_700,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            400-year tradition
          </div>
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
              marginBottom: hindi ? 4 : 14,
            }}
          >
            Bada Mangal · Lucknow · 1798 to 2026
          </div>
          {hindi ? (
            <img
              src={hindi.src}
              alt=""
              width={hindi.width}
              height={hindi.height}
              style={{ width: hindi.width, height: hindi.height, marginBottom: 14 }}
            />
          ) : null}
          <div
            style={{
              fontFamily: OG_HEADING_FONT,
              fontSize: 62,
              fontWeight: 700,
              color: INK_900,
              lineHeight: 1.05,
              letterSpacing: -1,
            }}
          >
            The story of Lucknow&apos;s biggest meal.
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: INK_600,
              marginTop: 16,
              lineHeight: 1.3,
            }}
          >
            From a Begum&apos;s vow to today&apos;s twenty thousand bhandaras.
          </div>
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
          <span>Read the full story · BadaMangal.com/history</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
