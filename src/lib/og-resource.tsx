/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/og-fonts";

export const RESOURCE_OG_SIZE = { width: 1200, height: 630 } as const;

const SAFFRON_50 = "#FFF6EE";
const SAFFRON_500 = "#F2944C";
const SAFFRON_600 = "#E07A1F";
const SINDOOR_700 = "#9C2A2A";
const GOLD_500 = "#C9A24A";
const GOLD_100 = "#F5EAC9";
const INK_900 = "#1A1410";
const INK_600 = "#5A4F46";
const CREAM_50 = "#FBF7F0";

export type ResourceOGAccent = "saffron" | "sindoor" | "gold";

type Args = {
  /** Devanagari title shown big (e.g. "हनुमान चालीसा"). */
  titleHi?: string;
  /** Latin title (e.g. "Hanuman Chalisa"). */
  titleEn: string;
  /** Subtitle line (one editorial sentence). */
  subtitle?: string;
  /** Small kicker on top (e.g. "RESOURCES · CHALISA"). */
  kicker?: string;
  /** Accent color band on the left. */
  accent?: ResourceOGAccent;
};

/**
 * Shared OG renderer for resource pages. Each `opengraph-image.tsx` calls
 * this helper with its own copy and exports the image.
 */
export async function renderResourceOG(args: Args): Promise<ImageResponse> {
  const accent =
    args.accent === "sindoor"
      ? SINDOOR_700
      : args.accent === "gold"
        ? GOLD_500
        : SAFFRON_600;

  const [tiro, fraunces500, fraunces700] = await Promise.all([
    loadGoogleFont("Tiro Devanagari Hindi"),
    loadGoogleFont("Fraunces", 500),
    loadGoogleFont("Fraunces", 700),
  ]);
  const fonts: {
    name: string;
    data: ArrayBuffer;
    weight?: 500 | 700;
    style?: "normal";
  }[] = [];
  if (tiro) fonts.push({ name: "Tiro", data: tiro, weight: 500, style: "normal" });
  if (fraunces500) fonts.push({ name: "Fraunces", data: fraunces500, weight: 500, style: "normal" });
  if (fraunces700) fonts.push({ name: "Fraunces", data: fraunces700, weight: 700, style: "normal" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          fontFamily: "Fraunces, serif",
          background: `linear-gradient(180deg, ${SAFFRON_50} 0%, ${CREAM_50} 100%)`,
        }}
      >
        {/* Left accent band */}
        <div
          style={{
            width: 24,
            background: accent,
          }}
        />

        {/* Body */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: 64,
          }}
        >
          {/* Top brand row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <svg width="56" height="56" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="14" fill={SAFFRON_600} />
                <circle cx="32" cy="20" r="9" fill={CREAM_50} />
                <rect x="29.5" y="26" width="5" height="22" rx="2" fill={CREAM_50} />
                <ellipse cx="32" cy="50" rx="6.5" ry="2.2" fill={CREAM_50} />
              </svg>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: INK_900 }}>
                  BadaMangal.com
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: INK_600,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                  }}
                >
                  Lucknow
                </div>
              </div>
            </div>
            {args.kicker ? (
              <div
                style={{
                  background: GOLD_100,
                  border: `1px solid ${GOLD_500}`,
                  borderRadius: 999,
                  padding: "8px 18px",
                  fontSize: 14,
                  color: SINDOOR_700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                {args.kicker}
              </div>
            ) : null}
          </div>

          {/* Body */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "auto",
              maxWidth: 1024,
            }}
          >
            <div
              style={{
                fontSize: 16,
                color: GOLD_500,
                letterSpacing: 6,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Read · Listen · Watch
            </div>
            {args.titleHi && tiro ? (
              <div
                style={{
                  fontFamily: "Tiro, Fraunces, serif",
                  fontSize: 96,
                  color: SINDOOR_700,
                  lineHeight: 1.1,
                  letterSpacing: -1,
                }}
              >
                {args.titleHi}
              </div>
            ) : null}
            <div
              style={{
                fontSize: args.titleHi ? 36 : 80,
                fontWeight: args.titleHi ? 500 : 700,
                color: args.titleHi ? INK_900 : SINDOOR_700,
                marginTop: args.titleHi ? 14 : 0,
                letterSpacing: -0.5,
              }}
            >
              {args.titleEn}
            </div>
            {args.subtitle ? (
              <div
                style={{
                  fontSize: 24,
                  color: INK_600,
                  marginTop: 12,
                  fontWeight: 500,
                  fontStyle: "italic",
                }}
              >
                {args.subtitle}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 32,
              color: INK_600,
              fontSize: 18,
            }}
          >
            <div style={{ height: 1, width: 60, background: SAFFRON_500 }} />
            <span>BadaMangal.com · The companion to Lucknow's biggest meal</span>
          </div>
        </div>
      </div>
    ),
    { ...RESOURCE_OG_SIZE, fonts: fonts.length ? fonts : undefined },
  );
}
