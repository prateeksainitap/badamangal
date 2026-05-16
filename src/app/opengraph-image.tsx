import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/og-fonts";

export const runtime = "nodejs";
export const alt = "BadaMangal · जहाँ भक्ति, वहाँ भंडारा";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Site-wide Open Graph / link-preview image.
 *
 * Why no raster Hanuman image right now:
 *   We tried loading /illustrations/hanuman-standing.webp as a
 *   data-URL <img>. Satori (the renderer behind next/og) crashed
 *   during prerender with `[TypeError: u2 is not iterable]`.
 *   Satori's WebP support is documented as unreliable, and the
 *   smaller PNG variant we have (hanuman-standing) is missing from
 *   the bundle (only `.webp` exists). Rather than ship a build-
 *   breaking image, this version renders an inline SVG mandala
 *   composition that suggests the same warm devotional energy
 *   without depending on a raster asset Satori can't parse.
 *
 * Satori constraints we honour:
 *   • Every <div> with multiple children has explicit `display: "flex"`.
 *   • All <img>/<svg> dimensions are numeric (no `width: "auto"`).
 *   • SVGs are kept minimal — a handful of shapes, no complex paths.
 *   • Fonts loaded as TTF via @/lib/og-fonts (Satori can't parse WOFF2).
 *
 * When we want to add a real Hanuman illustration:
 *   1. Convert /illustrations/hanuman-standing.webp → PNG (sharp CLI)
 *      and commit it to public/illustrations/ at < 500 KB.
 *   2. readFile that PNG into a data-URL, render with explicit
 *      numeric width AND height (Satori has no flex-based image
 *      sizing).
 *   3. Test locally with `npm run build` before pushing — the OG
 *      route is pre-rendered at build time, so a Satori crash
 *      surfaces as a hard build failure, not a runtime 500.
 */

const SAFFRON_50 = "#FFF6EE";
const SAFFRON_500 = "#F2944C";
const SAFFRON_600 = "#E07A1F";
const SINDOOR_700 = "#9C2A2A";
const GOLD_500 = "#C9A24A";
const GOLD_100 = "#F5EAC9";
const INK_900 = "#1A1410";
const INK_600 = "#5A4F46";
const CREAM_50 = "#FBF7F0";

export default async function OG() {
  const [notoBold, fraunces500, fraunces700] = await Promise.all([
    loadGoogleFont("Noto Serif Devanagari", 700),
    loadGoogleFont("Fraunces", 500),
    loadGoogleFont("Fraunces", 700),
  ]);

  const fonts: {
    name: string;
    data: ArrayBuffer;
    weight?: 500 | 700;
    style?: "normal";
  }[] = [];
  if (notoBold)
    fonts.push({ name: "Noto", data: notoBold, weight: 700, style: "normal" });
  if (fraunces500)
    fonts.push({
      name: "Fraunces",
      data: fraunces500,
      weight: 500,
      style: "normal",
    });
  if (fraunces700)
    fonts.push({
      name: "Fraunces",
      data: fraunces700,
      weight: 700,
      style: "normal",
    });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          background: `linear-gradient(180deg, ${SAFFRON_50} 0%, ${CREAM_50} 100%)`,
          fontFamily: "Fraunces, serif",
          position: "relative",
        }}
      >
        {/* Decorative SVG composition on the right — a saffron sun
            with rays + a small ॐ glyph + a faint mandala ring. Reads
            as warm devotional iconography at thumbnail size and is
            cheap enough for Satori to parse without trouble. */}
        <svg
          width="380"
          height="380"
          viewBox="0 0 380 380"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: "absolute",
            right: 40,
            top: 80,
          }}
        >
          {/* Faint outer mandala ring */}
          <circle
            cx="190"
            cy="190"
            r="170"
            fill="none"
            stroke={GOLD_500}
            strokeWidth="1"
            strokeDasharray="2 6"
            opacity="0.45"
          />
          <circle
            cx="190"
            cy="190"
            r="150"
            fill="none"
            stroke={GOLD_500}
            strokeWidth="1"
            opacity="0.35"
          />

          {/* Sun rays */}
          <g stroke={SAFFRON_500} strokeWidth="3" strokeLinecap="round">
            <line x1="190" y1="30" x2="190" y2="65" />
            <line x1="190" y1="315" x2="190" y2="350" />
            <line x1="30" y1="190" x2="65" y2="190" />
            <line x1="315" y1="190" x2="350" y2="190" />
            <line x1="78" y1="78" x2="103" y2="103" />
            <line x1="277" y1="277" x2="302" y2="302" />
            <line x1="78" y1="302" x2="103" y2="277" />
            <line x1="277" y1="103" x2="302" y2="78" />
          </g>
          <g stroke={GOLD_500} strokeWidth="2" strokeLinecap="round" opacity="0.7">
            <line x1="135" y1="40" x2="148" y2="68" />
            <line x1="245" y1="40" x2="232" y2="68" />
            <line x1="135" y1="340" x2="148" y2="312" />
            <line x1="245" y1="340" x2="232" y2="312" />
            <line x1="40" y1="135" x2="68" y2="148" />
            <line x1="340" y1="135" x2="312" y2="148" />
            <line x1="40" y1="245" x2="68" y2="232" />
            <line x1="340" y1="245" x2="312" y2="232" />
          </g>

          {/* Sun disc */}
          <circle cx="190" cy="190" r="110" fill={SAFFRON_500} opacity="0.18" />
          <circle cx="190" cy="190" r="95" fill={SAFFRON_500} opacity="0.28" />
          <circle cx="190" cy="190" r="78" fill={SAFFRON_600} opacity="0.45" />
          <circle cx="190" cy="190" r="62" fill={SAFFRON_600} />

          {/* Inner ॐ-suggesting flame mark — abstract, not the literal
              glyph (which would need a font we don't have inline). */}
          <path
            d="M190 145 C170 165, 165 200, 190 230 C215 200, 210 165, 190 145 Z"
            fill={CREAM_50}
          />
          <circle cx="190" cy="135" r="8" fill={CREAM_50} />
        </svg>

        {/* Top row: inline brand mark SVG + wordmark on the left,
            season badge on the right. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="64" height="64" rx="14" fill={SAFFRON_600} />
              <circle cx="32" cy="20" r="9" fill={CREAM_50} />
              <rect
                x="29.5"
                y="26"
                width="5"
                height="22"
                rx="2"
                fill={CREAM_50}
              />
              <ellipse cx="32" cy="50" rx="6.5" ry="2.2" fill={CREAM_50} />
            </svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: INK_900,
                  display: "flex",
                }}
              >
                BadaMangal.com
              </div>
              <div
                style={{
                  fontSize: 16,
                  color: INK_600,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  display: "flex",
                }}
              >
                Lucknow
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
              display: "flex",
            }}
          >
            2026 · 8 Bada Mangals
          </div>
        </div>

        {/* Main copy block — bottom-anchored under the decorative
            composition. `maxWidth` keeps the headline clear of the
            absolutely-positioned mandala on the right. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            maxWidth: 740,
          }}
        >
          {notoBold ? (
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 92,
                color: SINDOOR_700,
                lineHeight: 1.12,
                letterSpacing: -1,
                display: "flex",
              }}
            >
              जहाँ भक्ति, वहाँ भंडारा
            </div>
          ) : (
            <div
              style={{
                fontSize: 84,
                fontWeight: 700,
                color: SINDOOR_700,
                lineHeight: 1.1,
                letterSpacing: -2,
                display: "flex",
              }}
            >
              Bada Mangal Lucknow
            </div>
          )}
          <div
            style={{
              fontSize: 32,
              fontWeight: 500,
              color: INK_900,
              marginTop: 14,
              letterSpacing: -0.3,
              display: "flex",
            }}
          >
            Lucknow's Bada Mangal bhandaras, every Tuesday — on one map.
          </div>
        </div>

        {/* Footer: subtitle on the left, bilingual closer on the
            right (matches the WhatsApp share message tone). */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            marginTop: 32,
            color: INK_600,
            fontSize: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                height: 1,
                width: 60,
                background: SAFFRON_500,
                display: "flex",
              }}
            />
            <span style={{ display: "flex" }}>
              Find · Host · Sponsor a Bada Mangal Bhandara
            </span>
          </div>
          {notoBold ? (
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 22,
                color: SINDOOR_700,
                display: "flex",
              }}
            >
              जय श्री राम · जय हनुमान
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
