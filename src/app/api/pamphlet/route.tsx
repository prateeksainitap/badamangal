/**
 * Pamphlet PNG generator, v2 design.
 *
 * Renders an A4-portrait (2480 × 3508 @ 300 DPI) ready-to-print
 * bhandara pamphlet via next/og + Satori. Returns the PNG with a
 * Content-Disposition that triggers a download.
 *
 * The v1 was functional but too minimalist, real Lucknow bhandara
 * pamphlets (see the reference set at public/uploads/whatsapp/)
 * are richly decorative: marigold (genda) garlands on the top
 * corners, brass bells hanging from chains, a classical Hanuman
 * ji image with halo at the center, a "॥ श्री हनुमते नमः ॥"
 * Sanskrit header, dramatic gradient saffron background, and a
 * bordered "कार्यक्रम विवरण" (program details) box with
 * date/time/address in clear rows. We match that grammar exactly.
 *
 * Architectural notes for editing this template:
 *   • Every div with >1 child needs `display: "flex"`, Satori
 *     constraint.
 *   • <img> needs explicit numeric width + height, no `width:
 *     "auto"`. Both go on the JSX prop AND the style.
 *   • Devanagari headlines render via Noto Serif Devanagari 700
 *     (loaded via @/lib/og-fonts). Latin text uses Fraunces.
 *   • SVGs are inline + minimal. Marigolds, bells, and diyas are
 *     constructed from concentric divs + box-shadow rather than
 *     SVG paths, Satori's SVG parser chokes on path-heavy art.
 *   • Total file is ~700 lines. Keep edits surgical, adding a
 *     single new element often requires nudging four others'
 *     positions because Satori's flex behaviour around absolute
 *     children is finicky.
 */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { loadGoogleFont } from "@/lib/og-fonts";
import type { PamphletArtTheme } from "@/lib/pamphlet-themes";
import { generateInvitationCopy } from "@/lib/vision";
import { BADA_MANGAL_DATES_2026 } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Gemini image generation can take 8-15 seconds; reserve generous
// headroom under Netlify's 26s Function limit for the full pipeline
// (Gemini call + Satori composition).
export const maxDuration = 25;

// A4 portrait @ 300 DPI. Industry standard for print shops.
const A4 = { width: 2480, height: 3508 };

// Devotional palette tuned to match real Lucknow bhandara pamphlets.
// Heavy on saffrons, sindoor red, and gold, these dominate every
// reference pamphlet in the data set.
const SAFFRON_50 = "#FFF6EE";
const SAFFRON_200 = "#FFD9B8";
const SAFFRON_500 = "#F2944C";
const SAFFRON_600 = "#E07A1F";
const SINDOOR_700 = "#9C2A2A";
const SINDOOR_800 = "#7A1F1F";
const SINDOOR_900 = "#5B1717";
const GOLD_400 = "#D9B765";
const GOLD_500 = "#C9A24A";
const GOLD_700 = "#8B6B22";
const CREAM_50 = "#FBF7F0";
const CREAM_100 = "#F5EEDD";
const INK_900 = "#1A1410";
const INK_700 = "#3A2E22";

type PamphletInput = {
  name?: string;
  nameHi?: string;
  organizerName?: string;
  area?: string;
  address?: string;
  date?: string;
  timeStart?: string;
  timeEnd?: string;
  menu?: string;
  organizerPhone?: string;
  qrUrl?: string;
  /** When set to one of the AI themes, the route generates a unique
   *  decorative hero illustration via Gemini and uses the new clean
   *  template. Omitting it (or "classic") falls back to the all-CSS
   *  Satori template that was the original v2 design. */
  theme?: PamphletArtTheme | "classic";
};

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

async function buildQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 640,
    color: { dark: INK_900, light: "#FFFFFFFF" },
  });
}

export async function POST(req: Request) {
  let body: PamphletInput;
  try {
    body = (await req.json()) as PamphletInput;
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  const name = (body.nameHi ?? "").trim() || (body.name ?? "").trim();
  if (!name) {
    return new Response("name_required", { status: 400 });
  }

  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";
  const qrUrl =
    (body.qrUrl && /^https?:\/\//.test(body.qrUrl) ? body.qrUrl : null) ??
    SITE;

  // ── AI-themed pamphlet branch ────────────────────────────────
  // When the caller passes one of the AI themes, we layer a
  // pre-generated background illustration (Firefly/DALL-E output
  // committed to /public/pamphlet-bg/) as the full-bleed base and
  // overlay the personalised Devanagari invitation copy on top of
  // its empty right-half parchment zone. Everything from here down
  // the function is the legacy CSS-only template, kept as a fallback
  // for `theme === "classic"` or when the composer fails.
  const isAiTheme =
    body.theme && body.theme !== "classic"
      ? (body.theme as PamphletArtTheme)
      : null;

  const [notoBold, notoRegular, fraunces700, fraunces500, hanumanPng, qrDataUrl] =
    await Promise.all([
      loadGoogleFont("Noto Serif Devanagari", 700),
      loadGoogleFont("Noto Serif Devanagari", 500),
      loadGoogleFont("Fraunces", 700),
      loadGoogleFont("Fraunces", 500),
      publicAssetDataUrl("illustrations/hanuman-standing-og.png", "image/png"),
      buildQrDataUrl(qrUrl),
    ]);

  if (isAiTheme) {
    try {
      return await composeAiPamphlet({
        theme: isAiTheme,
        body,
        qrDataUrl,
        fonts: {
          notoBold,
          notoRegular,
          fraunces500,
          fraunces700,
        },
      });
    } catch (err) {
      // AI gen failed, log and fall through to the classic template
      // so the user still gets a pamphlet rather than a 500.
      console.error("[pamphlet] AI hero failed, falling back to classic:", err);
    }
  }
  // ── End AI branch ────────────────────────────────────────────

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

  const timeRange = body.timeStart
    ? body.timeEnd
      ? `${body.timeStart} – ${body.timeEnd}`
      : `${body.timeStart}`
    : "";

  const displayHi = body.nameHi || body.name || name;
  const displayEn =
    body.name && body.nameHi && body.name !== body.nameHi ? body.name : null;

  const place = [body.area, body.address].filter(Boolean).join(", ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          // Layered backgrounds: cream paper base + saffron radial
          // washes at top and bottom. Reference pamphlets all have
          // this gradient depth, flat backgrounds look amateur.
          //
          // Satori is stricter than browsers about the `background:`
          // shorthand, it accepts gradients in `background-image`
          // but rejects a trailing flat hex colour ("Invalid
          // background image: '#FBF7F0'"). Split the layers across
          // `backgroundColor` (the cream base) and `backgroundImage`
          // (the two radial washes) so the route doesn't 500.
          backgroundColor: CREAM_50,
          backgroundImage: `
            radial-gradient(ellipse 100% 40% at 50% 0%, ${SAFFRON_200} 0%, ${CREAM_50} 60%),
            radial-gradient(ellipse 100% 50% at 50% 100%, ${SAFFRON_50} 0%, ${CREAM_50} 70%)
          `,
          fontFamily: "Fraunces, serif",
          position: "relative",
          color: INK_900,
        }}
      >
        {/* ── OUTER ORNATE FRAME ── */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 60,
            border: `8px solid ${SINDOOR_700}`,
            borderRadius: 40,
            display: "flex",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 84,
            border: `3px solid ${GOLD_500}`,
            borderRadius: 28,
            display: "flex",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 100,
            border: `1px solid ${GOLD_400}`,
            borderRadius: 20,
            opacity: 0.5,
            display: "flex",
          }}
        />

        {/* ── TOP MARIGOLD GARLANDS ── */}
        <MarigoldGarland position="top-left" />
        <MarigoldGarland position="top-right" />

        {/* ── HANGING BRASS BELLS ── */}
        <BrassBell side="left" />
        <BrassBell side="right" />

        {/* ── HEADER: ॥ श्री हनुमते नमः ॥ ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 220,
            position: "relative",
          }}
        >
          {notoBold ? (
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 76,
                color: SINDOOR_800,
                letterSpacing: -1,
                lineHeight: 1,
                display: "flex",
              }}
            >
              ॥ श्री हनुमते नमः ॥
            </div>
          ) : (
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: SINDOOR_800,
                letterSpacing: 2,
                display: "flex",
              }}
            >
              ŚRĪ HANUMATE NAMAḤ
            </div>
          )}
        </div>

        {/* Sun-burst divider with central flame emblem */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            marginTop: 36,
          }}
        >
          <DividerLine />
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 44,
              background: SAFFRON_600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 0 6px ${SAFFRON_500}, 0 0 0 10px ${GOLD_500}`,
            }}
          >
            <div
              style={{
                width: 14,
                height: 22,
                borderRadius: "50% 50% 50% 50% / 70% 70% 30% 30%",
                background: CREAM_50,
                display: "flex",
              }}
            />
          </div>
          <DividerLine />
        </div>

        {/* ── HANUMAN JI, halo + figure + sun rays ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 36,
            position: "relative",
            height: 540,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              width: 540,
              height: 540,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${SAFFRON_500}55 0%, ${SAFFRON_500}33 30%, ${SAFFRON_500}11 55%, transparent 75%)`,
              display: "flex",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              width: 380,
              height: 380,
              borderRadius: "50%",
              border: `4px solid ${GOLD_500}`,
              opacity: 0.55,
              display: "flex",
            }}
          />
          <SunRays />
          {hanumanPng ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hanumanPng}
              alt=""
              width={360}
              height={480}
              style={{
                position: "relative",
                width: 360,
                height: 480,
              }}
            />
          ) : (
            <div
              style={{
                position: "relative",
                fontSize: 240,
                color: SINDOOR_700,
                display: "flex",
              }}
            >
              🕉
            </div>
          )}
        </div>

        {/* ── INVITATION LINE ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 32,
          }}
        >
          {notoBold ? (
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 56,
                color: INK_900,
                display: "flex",
              }}
            >
              आप सपरिवार सादर आमंत्रित हैं
            </div>
          ) : (
            <div
              style={{
                fontSize: 52,
                fontWeight: 500,
                color: INK_900,
                display: "flex",
              }}
            >
              You & your family are warmly invited
            </div>
          )}
        </div>

        {/* ── MAIN TITLE: बड़ा मंगल भंडारा ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 12,
          }}
        >
          {notoBold ? (
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 168,
                color: SINDOOR_800,
                lineHeight: 1,
                letterSpacing: -3,
                textShadow: `4px 4px 0 ${GOLD_500}33, 8px 8px 16px ${SINDOOR_900}22`,
                display: "flex",
              }}
            >
              बड़ा मंगल भंडारा
            </div>
          ) : (
            <div
              style={{
                fontSize: 160,
                fontWeight: 700,
                color: SINDOOR_800,
                lineHeight: 1,
                letterSpacing: -4,
                display: "flex",
              }}
            >
              BADA MANGAL BHANDARA
            </div>
          )}
        </div>

        {/* ── BHANDARA NAME PLAQUE ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 48,
            paddingLeft: 160,
            paddingRight: 160,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "32px 60px",
              background: `linear-gradient(180deg, ${CREAM_100} 0%, ${SAFFRON_50} 100%)`,
              border: `4px solid ${SINDOOR_700}`,
              borderRadius: 24,
              boxShadow: `inset 0 0 0 4px ${CREAM_50}, inset 0 0 0 6px ${GOLD_500}`,
              maxWidth: "100%",
            }}
          >
            <div
              style={{
                fontFamily: notoBold
                  ? "Noto, Fraunces, serif"
                  : "Fraunces, serif",
                fontWeight: 700,
                fontSize: 84,
                color: SINDOOR_900,
                textAlign: "center",
                lineHeight: 1.1,
                display: "flex",
              }}
            >
              {displayHi}
            </div>
            {displayEn ? (
              <div
                style={{
                  fontFamily: "Fraunces, serif",
                  fontWeight: 500,
                  fontSize: 44,
                  color: INK_700,
                  marginTop: 12,
                  fontStyle: "italic",
                  display: "flex",
                }}
              >
                {displayEn}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── कार्यक्रम विवरण BOX ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 48,
            marginLeft: 180,
            marginRight: 180,
            padding: "40px 56px",
            background: CREAM_50,
            border: `3px dashed ${SAFFRON_600}`,
            borderRadius: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: -64,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "12px 36px",
                background: SINDOOR_700,
                color: CREAM_50,
                borderRadius: 999,
                fontSize: 36,
                fontWeight: 700,
                fontFamily: notoBold
                  ? "Noto, Fraunces, serif"
                  : "Fraunces, serif",
                letterSpacing: 1,
                boxShadow: `0 6px 0 ${SINDOOR_900}`,
              }}
            >
              {notoBold ? "कार्यक्रम विवरण" : "PROGRAMME"}
            </div>
          </div>

          {body.date ? (
            <DetailRow
              labelHi="दिनांक"
              labelEn="Date"
              value={body.date}
              fontFamily={
                notoBold ? "Noto, Fraunces, serif" : "Fraunces, serif"
              }
              isHi={!!notoBold}
              accent={SINDOOR_700}
              valueSize={56}
            />
          ) : null}
          {timeRange ? (
            <DetailRow
              labelHi="समय"
              labelEn="Time"
              value={timeRange}
              fontFamily={
                notoBold ? "Noto, Fraunces, serif" : "Fraunces, serif"
              }
              isHi={!!notoBold}
              accent={SAFFRON_600}
            />
          ) : null}
          {place ? (
            <DetailRow
              labelHi="स्थान"
              labelEn="Place"
              value={place}
              fontFamily={
                notoBold ? "Noto, Fraunces, serif" : "Fraunces, serif"
              }
              isHi={!!notoBold}
              accent={SAFFRON_600}
            />
          ) : null}
          {body.menu ? (
            <DetailRow
              labelHi="प्रसाद"
              labelEn="Prasad"
              value={body.menu}
              fontFamily={
                notoBold ? "Noto, Fraunces, serif" : "Fraunces, serif"
              }
              isHi={!!notoBold}
              accent={SAFFRON_600}
            />
          ) : null}
          {body.organizerName ? (
            <DetailRow
              labelHi="आयोजक"
              labelEn="Organizer"
              value={
                body.organizerPhone
                  ? `${body.organizerName}  ·  ${body.organizerPhone}`
                  : body.organizerName
              }
              fontFamily={
                notoBold ? "Noto, Fraunces, serif" : "Fraunces, serif"
              }
              isHi={!!notoBold}
              accent={GOLD_700}
              isLast
            />
          ) : null}
        </div>

        {/* ── CLOSER + QR + DIYAS ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "auto",
            paddingBottom: 140,
            gap: 16,
          }}
        >
          {notoBold ? (
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 64,
                color: SINDOOR_700,
                letterSpacing: 1,
                display: "flex",
              }}
            >
              ॥ जय श्री राम  ·  जय हनुमान ॥
            </div>
          ) : (
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: SINDOOR_700,
                letterSpacing: 2,
                display: "flex",
              }}
            >
              JAI SHRI RAM  ·  JAI HANUMAN
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 80,
              marginTop: 24,
            }}
          >
            <Diya />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: 16,
                background: CREAM_50,
                border: `3px solid ${SINDOOR_700}`,
                borderRadius: 18,
                boxShadow: `0 4px 0 ${SINDOOR_900}55`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt=""
                width={280}
                height={280}
                style={{ width: 280, height: 280 }}
              />
              <div
                style={{
                  fontSize: 18,
                  color: INK_700,
                  letterSpacing: 1,
                  fontWeight: 700,
                  display: "flex",
                }}
              >
                BadaMangal.com
              </div>
            </div>

            <Diya />
          </div>

          <div
            style={{
              fontSize: 20,
              color: INK_700,
              letterSpacing: 4,
              textTransform: "uppercase",
              fontWeight: 500,
              marginTop: 20,
              display: "flex",
            }}
          >
            Listed on BadaMangal.com  ·  Lucknow's free Bada Mangal directory
          </div>
        </div>
      </div>
    ),
    {
      ...A4,
      fonts: fonts.length ? fonts : undefined,
      headers: {
        "content-disposition": `attachment; filename="bada-mangal-pamphlet-${slugify(name)}.png"`,
      },
    },
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Decorative primitives, every element here is built from divs
 * + box-shadow + simple gradients so Satori parses them quickly.
 * The reference pamphlets use real marigold photos; we approximate
 * the same vocabulary with primitives.
 * ──────────────────────────────────────────────────────────────── */

/** Marigold (genda) garland, 6 layered flowers along a top corner. */
function MarigoldGarland({
  position,
}: {
  position: "top-left" | "top-right";
}) {
  const isLeft = position === "top-left";
  const flowers = [
    { x: 80, y: 80, size: 100 },
    { x: 170, y: 130, size: 120 },
    { x: 280, y: 170, size: 110 },
    { x: 400, y: 200, size: 130 },
    { x: 530, y: 230, size: 105 },
    { x: 660, y: 270, size: 110 },
  ];
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        ...(isLeft ? { left: 0 } : { right: 0 }),
        width: 840,
        height: 420,
        display: "flex",
      }}
    >
      {flowers.map((f, i) => (
        <Marigold
          key={i}
          left={isLeft ? f.x : 840 - f.x - f.size}
          top={f.y}
          size={f.size}
          tone={i % 2 === 0 ? "deep" : "bright"}
        />
      ))}
    </div>
  );
}

/** Single marigold flower, three concentric circles. */
function Marigold({
  left,
  top,
  size,
  tone,
}: {
  left: number;
  top: number;
  size: number;
  tone: "deep" | "bright";
}) {
  const outer = tone === "deep" ? "#E07A1F" : "#F2944C";
  const mid = tone === "deep" ? "#F2944C" : "#FFB077";
  const center = "#FFD37A";
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: outer,
          boxShadow: `inset 0 0 0 4px ${mid}, inset 0 -4px 6px rgba(0,0,0,0.18)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: size * 0.6,
            height: size * 0.6,
            borderRadius: "50%",
            background: mid,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: "50%",
              background: center,
              display: "flex",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Brass bell hanging from chain dots. */
function BrassBell({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 280,
        ...(isLeft ? { left: 200 } : { right: 200 }),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 6,
            background: GOLD_700,
            display: "flex",
          }}
        />
      ))}
      <div
        style={{
          width: 110,
          height: 120,
          borderRadius: "50% 50% 38% 38% / 50% 50% 35% 35%",
          background: `linear-gradient(180deg, #D9B765 0%, #B88E33 50%, #8B6B22 100%)`,
          marginTop: 10,
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          boxShadow: `inset 4px 4px 0 #FFE1A0, inset -4px -8px 0 #6B4F18`,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: GOLD_700,
            marginBottom: -8,
            display: "flex",
          }}
        />
      </div>
    </div>
  );
}

/** Diya, clay lamp with flame. */
function Diya() {
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <div
        style={{
          width: 28,
          height: 56,
          borderRadius: "50% 50% 50% 50% / 70% 70% 30% 30%",
          background: `linear-gradient(180deg, #FFD37A 0%, ${SAFFRON_500} 60%, ${SAFFRON_600} 100%)`,
          boxShadow: `0 0 24px ${SAFFRON_500}AA`,
          display: "flex",
        }}
      />
      <div
        style={{
          width: 4,
          height: 14,
          background: "#3A2818",
          display: "flex",
        }}
      />
      <div
        style={{
          width: 96,
          height: 40,
          borderRadius: "0 0 60% 60% / 0 0 100% 100%",
          background: `linear-gradient(180deg, #B85F0F 0%, #8B3F08 100%)`,
          boxShadow: `inset 0 4px 0 #D17F2F, inset 0 -4px 0 #6B2F06`,
          display: "flex",
        }}
      />
    </div>
  );
}

/** 12 thin gold sun rays from the figure's halo. */
function SunRays() {
  const rays: { rotate: number }[] = Array.from({ length: 12 }).map((_, i) => ({
    rotate: i * 30,
  }));
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        width: 540,
        height: 540,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {rays.map(({ rotate }, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 3,
            height: 480,
            background: `linear-gradient(180deg, transparent 0%, ${GOLD_500}66 30%, ${GOLD_500}00 50%, ${GOLD_500}66 70%, transparent 100%)`,
            transform: `rotate(${rotate}deg)`,
            opacity: 0.6,
            display: "flex",
          }}
        />
      ))}
    </div>
  );
}

/** Gradient hairline divider used either side of the sun emblem. */
function DividerLine() {
  return (
    <div
      style={{
        height: 3,
        width: 320,
        background: `linear-gradient(to right, transparent, ${SINDOOR_700}, transparent)`,
        display: "flex",
      }}
    />
  );
}

/** Single row inside the कार्यक्रम विवरण box. */
function DetailRow({
  labelHi,
  labelEn,
  value,
  fontFamily,
  isHi,
  accent,
  isLast,
  valueSize = 48,
}: {
  labelHi: string;
  labelEn: string;
  value: string;
  fontFamily: string;
  isHi: boolean;
  accent: string;
  isLast?: boolean;
  valueSize?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 24,
        padding: "18px 0",
        borderBottom: isLast ? "none" : `1px dashed ${SAFFRON_500}55`,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 16,
          background: accent,
          marginTop: 14,
          flexShrink: 0,
          display: "flex",
        }}
      />
      <div
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 40,
          color: accent,
          width: 220,
          flexShrink: 0,
          display: "flex",
        }}
      >
        {isHi ? labelHi : labelEn}
      </div>
      <div
        style={{
          fontFamily,
          fontWeight: 500,
          fontSize: valueSize,
          color: INK_900,
          lineHeight: 1.3,
          flex: 1,
          display: "flex",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "pamphlet"
  );
}

/* ────────────────────────────────────────────────────────────────────
   AI-themed pamphlet composer (free version).

   Uses ONLY the free Gemini Flash text endpoint, no paid image
   generation. The aesthetic match the user wants (rich Lucknow
   bhandara invite, asymmetric layout, framed text blocks, classical
   Hanuman) is delivered by:

     1. A pre-existing static Hanuman illustration (public/illustrations/
        hanuman-sitting.webp, already shipping with the site) anchoring
        the left column.
     2. Gemini text-generated, personalised Devanagari invitation copy
        (host blessing, occasion phrase, venue lead-in, activity
        headline, closer) that follows the exact grammar real Lucknow
        family invites use.
     3. Multiple framed Satori text blocks on the right column
        (host name plaque, date+time cells, venue cartouche, body
        sentence) mirroring the reference image's composition.

   Cost: ~0 per pamphlet, Gemini Flash text fits comfortably inside
   the free tier (~1500 req/day). The previous paid image-gen path
   has been deleted; the `theme` param is kept for back-compat but
   maps to a single template variant for now.
   ──────────────────────────────────────────────────────────────── */

type ComposeArgs = {
  theme: PamphletArtTheme;
  body: PamphletInput;
  qrDataUrl: string;
  fonts: {
    notoBold: ArrayBuffer | null;
    notoRegular: ArrayBuffer | null;
    fraunces500: ArrayBuffer | null;
    fraunces700: ArrayBuffer | null;
  };
};

/** Map a date string (either "YYYY-MM-DD" or "Tuesday, 19 May 2026")
 *  to the 1..8 ordinal of the 2026 Bada Mangal season, or null if
 *  the date doesn't fall on one. Gemini uses this to write the
 *  correct Devanagari ordinal ("द्वितीय", "तृतीय", etc.). */
function mangalOrdinalFromDate(date: string | undefined): number | null {
  if (!date) return null;
  // Try ISO first
  let iso: string | null = null;
  const isoMatch = date.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  if (!iso) {
    // Try to parse "Tuesday, 19 May 2026" / "19 May 2026" etc.
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      iso = parsed.toISOString().slice(0, 10);
    }
  }
  if (!iso) return null;
  const idx = BADA_MANGAL_DATES_2026.findIndex(
    (d) => d.toISOString().slice(0, 10) === iso,
  );
  return idx >= 0 ? idx + 1 : null;
}

/** Split a "Tuesday, 19 May 2026" string into "19 May" + "2026" for
 *  the two-line date cell on the pamphlet. Falls back gracefully when
 *  parsing fails. Also produces a Devanagari variant for the top
 *  line via a tiny month-name lookup. */
function splitDateForCell(date: string | undefined): {
  hiLine1: string;
  hiLine2: string;
} {
  if (!date) return { hiLine1: "", hiLine2: "" };
  const HI_MONTHS = [
    "जनवरी",
    "फरवरी",
    "मार्च",
    "अप्रैल",
    "मई",
    "जून",
    "जुलाई",
    "अगस्त",
    "सितंबर",
    "अक्टूबर",
    "नवंबर",
    "दिसंबर",
  ];
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    // Couldn't parse, show the raw string on the first line, empty year
    return { hiLine1: date, hiLine2: "" };
  }
  const day = parsed.getDate();
  const month = HI_MONTHS[parsed.getMonth()] ?? "";
  const year = parsed.getFullYear();
  return { hiLine1: `${day} ${month}`, hiLine2: String(year) };
}

/** Convert "11:00" → "प्रातः 11 बजे से" / "14:30" → "दोपहर 2:30 बजे
 *  से". Picks period words (प्रातः / दोपहर / सायं / रात्रि) based on
 *  the hour. Returns the raw string back if input doesn't match HH:MM. */
function devanagariTime(time: string | undefined): string {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return time ?? "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const period =
    h < 12 ? "प्रातः" : h < 16 ? "दोपहर" : h < 19 ? "सायं" : "रात्रि";
  const hr12 = ((h + 11) % 12) + 1;
  const mm = m && m > 0 ? `:${String(m).padStart(2, "0")}` : "";
  return `${period} ${hr12}${mm} बजे से`;
}


async function composeAiPamphlet({
  theme,
  body,
  qrDataUrl,
  fonts,
}: ComposeArgs): Promise<Response> {
  // 1. Compute the Mangal ordinal up-front so Gemini can pick the
  //    right Devanagari adjective without guessing.
  const mangalOrdinal = mangalOrdinalFromDate(body.date);

  // 2. Load the LEFT-CROP variant of the chosen AI background. The
  //    original Firefly-generated PNG has Hanuman + ornate border
  //    on the left ~62% and a wasted empty right zone. We crop that
  //    away (pre-baked at <theme>-cropped.jpg) so the bg fills the
  //    LEFT HALF of A4 cleanly, leaving the entire RIGHT HALF as
  //    pristine cream paper for properly-sized Devanagari text, no
  //    overlap, no font-shrink hacks, no overflow.
  //
  //    Format: JPG. WebP causes Satori's image-stream parser to
  //    throw "u2 is not iterable" intermittently; JPG works
  //    reliably and files stay reasonable (500 KB - 1 MB at q=88).
  const bgUrl = await publicAssetDataUrl(
    `pamphlet-bg/${theme}-cropped.jpg`,
    "image/jpeg",
  );

  // 3. Ask Gemini Flash (free) to write the personalised invitation
  //    copy. Falls back to sensible defaults inside the helper if the
  //    call fails, so the pamphlet always renders.
  const copy = await generateInvitationCopy({
    organizerName: body.organizerName,
    bhandaraName: body.name,
    bhandaraNameHi: body.nameHi,
    date: body.date,
    mangalOrdinal,
    timeStart: body.timeStart,
    menu: body.menu,
    address: body.address,
    area: body.area,
  });

  // 4. Display strings, same as before, plus a venue-card splitter
  //    so the address gets a venue head / locality tail treatment.
  const dateCell = splitDateForCell(body.date);
  const timeHi = devanagariTime(body.timeStart);
  const phoneLine =
    body.organizerPhone && body.organizerPhone.length > 0
      ? body.organizerPhone
      : null;
  const addr = (body.address ?? "").trim();
  const commaIdx = addr.indexOf(",");
  const venueHead =
    commaIdx > 0 ? addr.slice(0, commaIdx).trim() : addr;
  const venueTail =
    commaIdx > 0
      ? [addr.slice(commaIdx + 1).trim(), body.area, "लखनऊ"]
          .filter(Boolean)
          .join(", ")
      : [body.area, "लखनऊ"].filter(Boolean).join(", ");

  // 5. Font registration, Devanagari is critical here, the entire
  //    invitation flow is in Hindi.
  const satoriFonts: {
    name: string;
    data: ArrayBuffer;
    weight?: 500 | 700;
    style?: "normal";
  }[] = [];
  if (fonts.notoRegular)
    satoriFonts.push({ name: "Noto", data: fonts.notoRegular, weight: 500, style: "normal" });
  if (fonts.notoBold)
    satoriFonts.push({ name: "Noto", data: fonts.notoBold, weight: 700, style: "normal" });
  if (fonts.fraunces500)
    satoriFonts.push({ name: "Fraunces", data: fonts.fraunces500, weight: 500, style: "normal" });
  if (fonts.fraunces700)
    satoriFonts.push({ name: "Fraunces", data: fonts.fraunces700, weight: 700, style: "normal" });

  // 6. Layout constants, bg fills LEFT 48% × TOP 73% of A4 at a
  //    fixed 1200 px width. Right column gets 1160 px of cream
  //    paper for cleanly-sized Devanagari (no overflow, no
  //    font-shrink hacks). Below-the-bg cream strip hosts the QR
  //    + footer slogan in the full-width band along the bottom.
  //
  //    Cropped bg is 673 × 1448 (source) → aspect 0.465. At width
  //    1200 the rendered height = 1200 / 0.465 = ~2581 px (≈73% of
  //    A4 height), Hanuman + ornate border occupy the visual
  //    left half cleanly with cream above and below the visual.
  const CROPPED_BG_ASPECT = 673 / 1448;
  const BG_RENDERED_WIDTH = 1200;
  const BG_RENDERED_HEIGHT = Math.round(BG_RENDERED_WIDTH / CROPPED_BG_ASPECT); // 2581
  const TEXT_LEFT = BG_RENDERED_WIDTH + 40; // gutter
  const TEXT_WIDTH = A4.width - TEXT_LEFT - 80; // 1160
  const TEXT_TOP = 180;
  const TEXT_BOTTOM_CUTOFF = A4.height - 280; // leave room for QR strip

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: CREAM_50,
          fontFamily: "Noto, Fraunces, serif",
          color: INK_900,
          position: "relative",
        }}
      >
        {/* ── AI BACKGROUND (cropped, anchored top-left) ─────────
              The cropped bg (Hanuman + ornate left border only,
              no wasted empty right zone) fills the LEFT 48% of A4
              at a fixed 1200 px width × 2581 px height. Cream
              paper surrounds it on the right and below, giving
              the text composition a wide, clean canvas. */}
        {bgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgUrl}
            width={BG_RENDERED_WIDTH}
            height={BG_RENDERED_HEIGHT}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: BG_RENDERED_WIDTH,
              height: BG_RENDERED_HEIGHT,
              display: "flex",
            }}
          />
        ) : (
          // Fallback: solid cream paper if the bg failed to load.
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: CREAM_50,
              display: "flex",
            }}
          />
        )}

        {/* ── RIGHT-COLUMN TEXT OVERLAY ─────────────────────────────
              All Devanagari invitation copy flows top-down in a
              single tight composition. No space-between, clusters
              hug each other with consistent vertical rhythm, the
              way a real printed invite reads. The closer banner +
              QR live in a separate full-width band at the bottom
              of the page (below this overlay). */}
        <div
          style={{
            position: "absolute",
            top: TEXT_TOP,
            left: TEXT_LEFT,
            width: TEXT_WIDTH,
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          {/* TOP CLUSTER, invocation + blessing prefix + host plaque.
              width:100% so children inherit the column width and
              long Devanagari headings wrap instead of overflowing
              left into the bg's Hanuman zone. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              alignItems: "center",
              width: "100%",
            }}
          >
            {/* Sanskrit invocation in sindoor, centered */}
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 40,
                color: SINDOOR_800,
                letterSpacing: 2,
                textShadow: `0 2px 0 ${CREAM_50}`,
                display: "flex",
              }}
            >
              {copy.invocation}
            </div>
            {/* Blessing prefix, "प्रभु सियाराम की कृपा से" */}
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 500,
                fontSize: 36,
                color: SINDOOR_700,
                marginTop: 6,
                display: "flex",
                textAlign: "center",
                width: "100%",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {copy.blessingPrefix}
            </div>
            {/* Host name, the anchor of the whole composition.
                Centered, biggest Devanagari weight. */}
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 64,
                color: SINDOOR_800,
                lineHeight: 1.1,
                marginTop: 8,
                textAlign: "center",
                width: "100%",
                flexWrap: "wrap",
                justifyContent: "center",
                                textShadow: `0 2px 0 ${CREAM_50}`,
              }}
            >
              {copy.hostLine || copy.blessingPrefix}
            </div>
            {/* "द्वारा" */}
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 500,
                fontSize: 28,
                color: INK_700,
                marginTop: 4,
                display: "flex",
              }}
            >
              {copy.attribution}
            </div>
            {/* Occasion phrase, '"द्वितीय बड़े मंगल" के पावन
                अवसर पर' */}
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 500,
                fontSize: 36,
                color: SINDOOR_700,
                marginTop: 6,
                lineHeight: 1.3,
                textAlign: "center",
                width: "100%",
                flexWrap: "wrap",
                justifyContent: "center",
                              }}
            >
              {copy.occasion}
            </div>
          </div>

          {/* MIDDLE CLUSTER, date + time cells, venue card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              width: "100%",
            }}
          >
            {/* Date + Time row */}
            <div style={{ display: "flex", flexDirection: "row", gap: 18 }}>
              <DateTimeCell
                kicker="दिनांक"
                topHi={dateCell.hiLine1}
                bottomHi={dateCell.hiLine2}
              />
              <DateTimeCell
                kicker="समय"
                topHi={timeHi || ""}
                bottomHi=""
              />
            </div>

            {/* Venue lead-in, small italic-feel line above the card */}
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 500,
                fontSize: 26,
                color: INK_700,
                textAlign: "center",
                width: "100%",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {copy.venueLead}
            </div>

            {/* Venue card, bordered cartouche */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "20px 28px",
                border: `3px solid ${GOLD_500}`,
                borderRadius: 14,
                backgroundColor: CREAM_50,
                boxShadow: `inset 0 0 0 4px ${CREAM_50}, inset 0 0 0 5px ${GOLD_400}`,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "Noto, Fraunces, serif",
                  fontWeight: 700,
                  fontSize: 44,
                  color: SINDOOR_800,
                  lineHeight: 1.1,
                  textAlign: "center",
                width: "100%",
                flexWrap: "wrap",
                justifyContent: "center",
                                  }}
              >
                {venueHead || body.nameHi || body.name || "स्थान"}
              </div>
              {venueTail ? (
                <div
                  style={{
                    fontFamily: "Noto, Fraunces, serif",
                    fontWeight: 500,
                    fontSize: 22,
                    color: INK_700,
                    marginTop: 6,
                    textAlign: "center",
                width: "100%",
                flexWrap: "wrap",
                justifyContent: "center",
                                      }}
                >
                  {venueTail}
                </div>
              ) : null}
            </div>
          </div>

          {/* BOTTOM CLUSTER, activity, invitation body, closer banner */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              alignItems: "center",
              width: "100%",
            }}
          >
            {/* "पर" connector */}
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 500,
                fontSize: 26,
                color: INK_700,
                display: "flex",
              }}
            >
              पर
            </div>

            {/* Activity headline, big call-out */}
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 54,
                color: SINDOOR_700,
                lineHeight: 1.1,
                textAlign: "center",
                width: "100%",
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 4,
                display: "flex",
              }}
            >
              {copy.activity}
            </div>

            {/* Invitation body */}
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 500,
                fontSize: 26,
                color: INK_900,
                lineHeight: 1.3,
                textAlign: "center",
                width: "100%",
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 4,
                display: "flex",
              }}
            >
              {copy.invitationBody}
            </div>

            {/* Closer banner removed from this cluster, it now
                lives in the full-width bottom band below. Keeping
                it here would push the bottom cluster into the bg's
                left-half decoration. */}
          </div>
        </div>

        {/* ── FULL-WIDTH BOTTOM BAND ─────────────────────────────────
              Spans the entire A4 width across the cream strip below
              the cropped bg. Hosts the framed closer + phone line
              centered, with the QR code anchored bottom-right. The
              band's width is 2480 minus the bg's right edge, so
              the visual reads as "everything below the Hanuman
              illustration", giving the closer the emphasis it
              deserves as the final invitation line. */}
        <div
          style={{
            position: "absolute",
            top: BG_RENDERED_HEIGHT + 30,
            left: 0,
            width: A4.width,
            display: "flex",
            justifyContent: "center",
            paddingLeft: 80,
            paddingRight: 80,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "30px 60px",
              border: `5px solid ${SINDOOR_700}`,
              borderRadius: 22,
              backgroundColor: CREAM_50,
              boxShadow: `inset 0 0 0 8px ${CREAM_50}, inset 0 0 0 10px ${GOLD_500}`,
              maxWidth: 1800,
            }}
          >
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 50,
                color: SINDOOR_800,
                lineHeight: 1.25,
                textAlign: "center",
                width: "100%",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {copy.closer}
            </div>
            {phoneLine ? (
              <div
                style={{
                  fontFamily: "Fraunces, Noto, serif",
                  fontWeight: 500,
                  fontSize: 32,
                  color: INK_700,
                  marginTop: 10,
                  display: "flex",
                }}
              >
                संपर्क · {phoneLine}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── BOTTOM RIGHT QR CODE ──────────────────────────────────
              Tucked into the bottom-right corner with a cream chip
              + gold border so it stays scannable. */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 80,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: 10,
            backgroundColor: CREAM_50,
            border: `2px solid ${GOLD_500}`,
            borderRadius: 12,
            boxShadow: `0 4px 12px rgba(0,0,0,0.15)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            width={130}
            height={130}
            style={{ width: 130, height: 130, display: "flex" }}
            alt=""
          />
          <div
            style={{
              fontFamily: "Fraunces, serif",
              fontWeight: 500,
              fontSize: 14,
              color: INK_700,
              marginTop: 4,
              display: "flex",
            }}
          >
            BadaMangal.com
          </div>
        </div>
      </div>
    ),
    {
      width: A4.width,
      height: A4.height,
      fonts: satoriFonts,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="bada-mangal-pamphlet-${slugify(body.nameHi || body.name || "bhandara")}.png"`,
        "Cache-Control": "no-store",
      },
    },
  );
}

/** Date / time cell, two-line bordered cartouche used in the right
 *  column. Matches the reference image's date+time chips. */
function DateTimeCell({
  kicker,
  topHi,
  bottomHi,
}: {
  kicker: string;
  topHi: string;
  bottomHi: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "16px 24px",
        border: `3px solid ${GOLD_500}`,
        borderRadius: 14,
        backgroundColor: CREAM_50,
        flex: 1,
        boxShadow: `inset 0 0 0 4px ${CREAM_50}, inset 0 0 0 5px ${GOLD_400}`,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: "Noto, Fraunces, serif",
          fontWeight: 500,
          fontSize: 36,
          color: SAFFRON_600,
          letterSpacing: 2,
          display: "flex",
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontFamily: "Noto, Fraunces, serif",
          fontWeight: 700,
          fontSize: 44,
          color: SINDOOR_800,
          lineHeight: 1.1,
          marginTop: 4,
          textAlign: "center",
          display: "flex",
        }}
      >
        {topHi}
      </div>
      {bottomHi ? (
        <div
          style={{
            fontFamily: "Noto, Fraunces, serif",
            fontWeight: 500,
            fontSize: 28,
            color: INK_700,
            marginTop: 2,
            display: "flex",
          }}
        >
          {bottomHi}
        </div>
      ) : null}
    </div>
  );
}
