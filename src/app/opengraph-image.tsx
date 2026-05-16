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
 * Rendered at 1200×630 (the canonical WhatsApp / Twitter / Facebook
 * share-card size) and served from /opengraph-image.
 *
 * Design philosophy:
 *   • Use the actual site brand assets — the same logo SVG the
 *     header renders (/brand/logo-mark.svg) and the same Hanuman
 *     illustration (/illustrations/hanuman-standing.webp) the
 *     landing page uses. Earlier versions of this file mocked up
 *     a simplified diya logo + procedural type which looked
 *     "off" because it diverged from every other surface on the
 *     site.
 *   • One Devanagari font (Noto Serif Devanagari) + one Latin
 *     font (Fraunces). Tiro Devanagari Hindi was previously
 *     loaded but its conjunct support is incomplete in Satori
 *     (next/og's renderer), and the `ि` matra in "भक्ति" was
 *     getting dropped — see commit before this for the fix.
 *   • Cream-50 background + sindoor-700 accent — same palette
 *     the rest of the site uses.
 *   • Hanuman illustration as the dominant visual anchor on the
 *     left, copy stacked on the right. Mirrors how the homepage
 *     hero arranges itself on desktop.
 *
 * Assets are read from disk at request time via `readFile`. Next
 * builds the OG handler as a server route and the public/
 * directory is bundled into the deploy, so the paths below resolve
 * at runtime on Netlify Functions.
 */

const SAFFRON_50 = "#FFF6EE";
const SAFFRON_500 = "#F2944C";
const SINDOOR_700 = "#9C2A2A";
const GOLD_500 = "#C9A24A";
const GOLD_100 = "#F5EAC9";
const INK_900 = "#1A1410";
const INK_600 = "#5A4F46";
const CREAM_50 = "#FBF7F0";

/**
 * Read a static asset from /public into a data URL Satori can render.
 * `readFile` paths are relative to the working directory; on Netlify
 * Functions the project root is the cwd at runtime so `public/<path>`
 * resolves cleanly. Returns null if the file is missing so the
 * renderer can degrade gracefully without 500-ing the OG endpoint.
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
  // Load fonts + brand assets in parallel — the OG handler runs at
  // build time on Next's static generation pass, and also at request
  // time on the rare cache miss. Fanning these out keeps cold-start
  // generation well under a second.
  const [notoBold, fraunces500, fraunces700, logoSvg, hanumanWebp] =
    await Promise.all([
      loadGoogleFont("Noto Serif Devanagari", 700),
      loadGoogleFont("Fraunces", 500),
      loadGoogleFont("Fraunces", 700),
      publicAssetDataUrl("brand/logo-mark.svg", "image/svg+xml"),
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
          background: `radial-gradient(900px 600px at 20% 80%, ${SAFFRON_50} 0%, ${CREAM_50} 65%)`,
          fontFamily: "Fraunces, serif",
          position: "relative",
        }}
      >
        {/* Soft saffron wash, mirroring the homepage hero ambience. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(380px 240px at 88% 16%, rgba(201,162,74,0.18), transparent 70%)",
            display: "flex",
          }}
        />

        {/* Left column — Hanuman illustration as the dominant anchor.
            Rendered with a subtle radial glow behind it (same trick
            the homepage hero uses) so the figure reads as warm and
            illuminated rather than pasted-on. */}
        <div
          style={{
            width: 460,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 70,
              left: 60,
              width: 360,
              height: 480,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(242,148,76,0.30) 0%, rgba(242,148,76,0) 70%)",
              display: "flex",
            }}
          />
          {hanumanWebp ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hanumanWebp}
              alt=""
              width={430}
              height={560}
              style={{
                width: 430,
                height: "auto",
                maxHeight: 560,
                objectFit: "contain",
                position: "relative",
              }}
            />
          ) : (
            // Fallback if illustration fails to load — keep the OG
            // shipping with a tasteful glyph rather than empty space.
            <div
              style={{
                fontSize: 240,
                color: SINDOOR_700,
                lineHeight: 1,
                display: "flex",
              }}
            >
              🕉
            </div>
          )}
        </div>

        {/* Right column — header-style logo lockup + season badge,
            big Hindi headline, English subhead, footer with closer. */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "60px 64px 56px 12px",
            position: "relative",
          }}
        >
          {/* Top row: logo (left) + season badge (right). Matches the
              header's brand-on-left, action-on-right rhythm. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            {logoSvg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSvg}
                alt="BadaMangal.com"
                height={64}
                style={{ height: 64, width: "auto" }}
              />
            ) : (
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: INK_900,
                  display: "flex",
                }}
              >
                BadaMangal.com
              </div>
            )}
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

          {/* Main copy block — uses `marginTop: auto` so the headline
              sits in the lower half of the panel, balanced against
              the Hanuman figure on the left. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "auto",
            }}
          >
            {notoBold ? (
              <div
                style={{
                  fontFamily: "Noto, Fraunces, serif",
                  fontWeight: 700,
                  fontSize: 84,
                  color: SINDOOR_700,
                  lineHeight: 1.12,
                  letterSpacing: -0.5,
                  display: "flex",
                }}
              >
                जहाँ भक्ति, वहाँ भंडारा
              </div>
            ) : (
              <div
                style={{
                  fontSize: 76,
                  fontWeight: 700,
                  color: SINDOOR_700,
                  lineHeight: 1.12,
                  letterSpacing: -1,
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
                marginTop: 16,
                letterSpacing: -0.3,
                maxWidth: 600,
                display: "flex",
              }}
            >
              Lucknow's Bada Mangal bhandaras, every Tuesday — on one map.
            </div>
          </div>

          {/* Footer row: a quiet "what you can do here" line on the
              left, balanced by the bilingual closer on the right —
              the same "जय श्री राम · जय हनुमान" the WhatsApp share
              messages end with, so the brand voice carries through. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              marginTop: 36,
              color: INK_600,
              fontSize: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ height: 1, width: 48, background: SAFFRON_500 }} />
              <span>Find · Host · Sponsor</span>
            </div>
            {notoBold ? (
              <div
                style={{
                  fontFamily: "Noto, Fraunces, serif",
                  fontWeight: 700,
                  fontSize: 22,
                  color: SINDOOR_700,
                  letterSpacing: 0,
                  display: "flex",
                }}
              >
                जय श्री राम · जय हनुमान
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
