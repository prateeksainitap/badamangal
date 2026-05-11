import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/og-fonts";

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
  const [tiro, fraunces500, fraunces700, cormorant600] = await Promise.all([
    loadGoogleFont("Tiro Devanagari Hindi"),
    loadGoogleFont("Fraunces", 500),
    loadGoogleFont("Fraunces", 700),
    loadGoogleFont("Cormorant Garamond", 600),
  ]);

  const fonts: {
    name: string;
    data: ArrayBuffer;
    weight?: 500 | 600 | 700;
    style?: "normal";
  }[] = [];
  if (tiro) fonts.push({ name: "Tiro", data: tiro, weight: 500, style: "normal" });
  if (fraunces500) fonts.push({ name: "Fraunces", data: fraunces500, weight: 500, style: "normal" });
  if (fraunces700) fonts.push({ name: "Fraunces", data: fraunces700, weight: 700, style: "normal" });
  if (cormorant600) fonts.push({ name: "Cormorant", data: cormorant600, weight: 600, style: "normal" });

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
          fontFamily: "Fraunces, serif",
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
              <div style={{ fontSize: 24, fontWeight: 700, color: INK_900 }}>
                BadaMangal.com
              </div>
              <div style={{ fontSize: 16, color: INK_600, letterSpacing: 3, textTransform: "uppercase" }}>
                The story
              </div>
            </div>
          </div>
          <div
            style={{
              background: GOLD_100,
              border: `1px solid ${GOLD_500}`,
              borderRadius: 999,
              padding: "8px 18px",
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
              fontSize: 18,
              color: GOLD_500,
              letterSpacing: 6,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Bada Mangal · Lucknow · 1798–2026
          </div>
          {tiro ? (
            <div
              style={{
                fontFamily: "Tiro, serif",
                fontSize: 78,
                color: SINDOOR_700,
                lineHeight: 1.15,
                letterSpacing: -0.5,
                marginBottom: 18,
              }}
            >
              बड़ा मंगल का इतिहास
            </div>
          ) : null}
          <div
            style={{
              fontFamily: "Fraunces, serif",
              fontSize: 56,
              fontWeight: 700,
              color: INK_900,
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            The story of Lucknow's biggest meal.
          </div>
          {cormorant600 ? (
            <div
              style={{
                fontFamily: "Cormorant, serif",
                fontStyle: "italic",
                fontSize: 30,
                color: INK_900,
                marginTop: 18,
                lineHeight: 1.3,
                fontWeight: 600,
              }}
            >
              From a Begum's vow to today's twenty thousand bhandaras.
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 36, color: INK_600, fontSize: 20 }}>
          <div style={{ height: 1, width: 60, background: SAFFRON_600 }} />
          <span>Read the full story · BadaMangal.com/history</span>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
