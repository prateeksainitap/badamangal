import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadGoogleFont } from "@/lib/og-fonts";

export const runtime = "nodejs";
export const alt = "BadaMangal · जहाँ भक्ति, वहाँ भंडारा";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Site-wide Open Graph / link-preview image.
 *
 * Layout: cream background, brand lockup top-left, season badge
 * top-right, Hindi headline + English subhead in the center, with
 * an optional Hanuman illustration on the right and the Ram/Hanuman
 * closer along the footer.
 *
 * IMPORTANT: this component is rendered by Satori (via next/og).
 * Satori has several strict rules that have bitten this file before:
 *   • Every `<div>` with multiple children needs explicit
 *     `display: "flex"` (or "none"). No `display: block`.
 *   • `<img>` tags need explicit numeric `width` AND `height` — no
 *     `width: "auto"`. The earlier crash ("u2 is not iterable")
 *     was Satori choking on the auto-width logo image.
 *   • Complex SVGs (hundreds of paths) can also fail to parse.
 *     We keep the brand glyph as a tiny inline `<svg>` and let the
 *     wordmark render as Fraunces text instead of loading the full
 *     /brand/logo-mark.svg (73 KB of paths).
 *   • Image dataURL loading via fs#readFile only works at build /
 *     server-rendering time, not edge — `runtime = "nodejs"` above
 *     keeps us on the right runtime.
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

/**
 * Read a static asset from /public into a data URL Satori can render.
 * Returns null if the file is missing or can't be read so the
 * renderer can degrade gracefully rather than 500-ing the OG endpoint.
 */
async function publicAssetDataUrl(
  relPath: string,
  mime: string,
): Promise<string | null> {
  try {
    const abs = path.join(process.cwd(), "public", relPath);
    const buf = await readFile(abs);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OG() {
  const [notoBold, fraunces500, fraunces700, hanumanWebp] = await Promise.all([
    loadGoogleFont("Noto Serif Devanagari", 700),
    loadGoogleFont("Fraunces", 500),
    loadGoogleFont("Fraunces", 700),
    publicAssetDataUrl(
      "illustrations/hanuman-standing.webp",
      "image/webp",
    ),
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
        {/* Hanuman illustration — positioned absolutely on the right
            so the copy column stays a clean rectangle on the left
            and the figure reads as a halo'd presence behind/beside
            the headline. Falls back silently when the file can't be
            read (Satori dataURL fail-paths) — the OG still ships,
            just without the figure. */}
        {hanumanWebp ? (
          <img
            src={hanumanWebp}
            alt=""
            width={360}
            height={510}
            style={{
              position: "absolute",
              right: 48,
              top: 60,
              width: 360,
              height: 510,
            }}
          />
        ) : null}

        {/* Top row: inline brand mark SVG + wordmark on the left,
            season badge on the right. We deliberately render the
            wordmark as text (not the full logo-mark.svg) because
            Satori chokes on the 73 KB path-heavy SVG and this gives
            us crisp scalable type for free. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 18 }}
          >
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
            <div
              style={{ display: "flex", flexDirection: "column" }}
            >
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

        {/* Main copy block. `maxWidth` keeps the headline from
            overlapping the Hanuman illustration on the right. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            maxWidth: 760,
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
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
