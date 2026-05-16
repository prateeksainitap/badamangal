/**
 * Pamphlet PNG generator.
 *
 * Takes a POST'd form body with the bhandara details an organiser
 * would put on a physical pamphlet and renders an A4-portrait PNG
 * (2480 × 3508 at 300 DPI) via the same next/og + Satori pipeline
 * that powers the OG share card. Returns the PNG with a
 * Content-Disposition that triggers a download in the browser.
 *
 * Why this exists: organisers in Lucknow distribute physical
 * pamphlets in their neighbourhoods (taped to temple walls,
 * handed out at the mandir, photocopied at the corner press
 * shop). They currently pay ₹50-200 for someone to "design"
 * one — a poorly-aligned MS Word file, often. Offering a free,
 * tradition-accurate template via the website:
 *   • saves them money + effort,
 *   • captures their bhandara details (we ingest the same fields
 *     /list-bhandara needs, with a clear "also list" cross-sell),
 *   • puts a "Listed on BadaMangal.com" + QR code on every
 *     physically-distributed pamphlet — every print becomes a
 *     real-world discovery vector for the directory.
 *
 * V1 scope: one template ("Traditional" — saffron + gold, marigold
 * borders, Hanuman ji icon, Devanagari headline, big QR). PDF
 * output deferred to V2; PNG covers the most common use case
 * (organisers walk into the press shop with a PNG on WhatsApp).
 */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { loadGoogleFont } from "@/lib/og-fonts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A4 portrait at 300 DPI. Some print shops want even higher, but
// 300 is the print-industry standard and Satori starts to struggle
// past ~4000px wide.
const A4 = { width: 2480, height: 3508 };

// Brand palette (matches src/lib/seo + opengraph-image).
const SAFFRON_50 = "#FFF6EE";
const SAFFRON_500 = "#F2944C";
const SAFFRON_600 = "#E07A1F";
const SINDOOR_700 = "#9C2A2A";
const SINDOOR_800 = "#7A1F1F";
const GOLD_500 = "#C9A24A";
const GOLD_100 = "#F5EAC9";
const INK_900 = "#1A1410";
const INK_600 = "#5A4F46";
const CREAM_50 = "#FBF7F0";

type PamphletInput = {
  name?: string;
  nameHi?: string;
  organizerName?: string;
  area?: string;
  address?: string;
  date?: string; // human-formatted, e.g. "Tuesday, 19 May 2026"
  timeStart?: string; // "11:00"
  timeEnd?: string; // "16:00"
  menu?: string; // free-form, comma-separated
  organizerPhone?: string;
  /** URL to encode in the QR. Caller decides — usually the
   *  bhandara's detail page if it's listed, else the homepage. */
  qrUrl?: string;
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
  // Black on transparent so we can sit the QR on the cream pamphlet
  // background without a hard white box around it. Margin 2 modules
  // for scanner reliability.
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 720, // big — print clarity matters more than file size
    color: { dark: INK_900, light: "#0000" },
  });
}

export async function POST(req: Request) {
  let body: PamphletInput;
  try {
    body = (await req.json()) as PamphletInput;
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  // Required-ish fields: name + date + time + address. Without
  // these the pamphlet is meaningless, so 400 early rather than
  // render a blank.
  const name = (body.name ?? "").trim() || (body.nameHi ?? "").trim();
  if (!name) {
    return new Response("name_required", { status: 400 });
  }

  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";
  const qrUrl =
    (body.qrUrl && /^https?:\/\//.test(body.qrUrl) ? body.qrUrl : null) ??
    SITE;

  const [notoBold, fraunces700, fraunces500, hanumanPng, qrDataUrl] =
    await Promise.all([
      loadGoogleFont("Noto Serif Devanagari", 700),
      loadGoogleFont("Fraunces", 700),
      loadGoogleFont("Fraunces", 500),
      publicAssetDataUrl("illustrations/hanuman-standing-og.png", "image/png"),
      buildQrDataUrl(qrUrl),
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

  const timeRange = body.timeStart
    ? body.timeEnd
      ? `${body.timeStart} – ${body.timeEnd}`
      : `${body.timeStart}`
    : "";

  const displayName = body.nameHi || body.name || name;
  const displaySubName =
    body.nameHi && body.name && body.nameHi !== body.name
      ? body.name
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(180deg, ${SAFFRON_50} 0%, ${CREAM_50} 50%, ${SAFFRON_50} 100%)`,
          fontFamily: "Fraunces, serif",
          position: "relative",
          padding: 160,
          color: INK_900,
        }}
      >
        {/* Decorative corner ornaments — faux marigold dots, tiny
            calligraphic touch in the four corners. Drawn as plain
            CSS background-radial-gradients so Satori doesn't have to
            parse any SVG path. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 80,
            border: `4px solid ${GOLD_500}`,
            borderRadius: 56,
            display: "flex",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 96,
            border: `1px solid ${GOLD_500}`,
            borderRadius: 44,
            opacity: 0.55,
            display: "flex",
          }}
        />

        {/* Top kicker — devotional Sanskrit invocation, sets tone */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 40,
          }}
        >
          {notoBold ? (
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 64,
                color: SINDOOR_700,
                letterSpacing: -1,
              }}
            >
              ॥ श्री हनुमते नमः ॥
            </div>
          ) : (
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: SINDOOR_700,
                letterSpacing: 1,
              }}
            >
              Shri Hanumate Namah
            </div>
          )}
        </div>

        {/* Decorative divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            marginTop: 32,
          }}
        >
          <div
            style={{
              height: 2,
              width: 200,
              background: `linear-gradient(to right, transparent, ${SAFFRON_500}, transparent)`,
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 36,
              color: SAFFRON_600,
              display: "flex",
            }}
          >
            ✦
          </div>
          <div
            style={{
              height: 2,
              width: 200,
              background: `linear-gradient(to right, transparent, ${SAFFRON_500}, transparent)`,
              display: "flex",
            }}
          />
        </div>

        {/* Main headline — "Bada Mangal Bhandara" in big Devanagari */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 48,
          }}
        >
          {notoBold ? (
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 140,
                color: SINDOOR_800,
                letterSpacing: -2,
                lineHeight: 1.1,
              }}
            >
              बड़ा मंगल भंडारा
            </div>
          ) : (
            <div
              style={{
                fontSize: 140,
                fontWeight: 700,
                color: SINDOOR_800,
                letterSpacing: -3,
                lineHeight: 1.1,
              }}
            >
              BADA MANGAL BHANDARA
            </div>
          )}
        </div>

        {/* "Aap sabhi sapariwar amantrit hain" warm invitation line */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 24,
          }}
        >
          {notoBold ? (
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 44,
                color: INK_900,
              }}
            >
              आप सभी सपरिवार सादर आमंत्रित हैं
            </div>
          ) : (
            <div
              style={{
                fontSize: 40,
                fontWeight: 500,
                color: INK_900,
              }}
            >
              You and your family are warmly invited
            </div>
          )}
        </div>

        {/* Bhandara name card — the actual event */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 72,
            padding: "48px 64px",
            background: GOLD_100,
            border: `3px solid ${GOLD_500}`,
            borderRadius: 32,
            marginLeft: 80,
            marginRight: 80,
          }}
        >
          <div
            style={{
              fontFamily: notoBold ? "Noto, Fraunces, serif" : "Fraunces, serif",
              fontWeight: 700,
              fontSize: 88,
              color: SINDOOR_700,
              textAlign: "center",
              lineHeight: 1.15,
              display: "flex",
            }}
          >
            {displayName}
          </div>
          {displaySubName ? (
            <div
              style={{
                fontFamily: "Fraunces, serif",
                fontWeight: 500,
                fontSize: 48,
                color: INK_600,
                marginTop: 16,
                display: "flex",
              }}
            >
              {displaySubName}
            </div>
          ) : null}
        </div>

        {/* Details block — date, time, place, prasad, organizer */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 64,
            paddingLeft: 80,
            paddingRight: 80,
            gap: 28,
          }}
        >
          {body.date ? (
            <DetailRow
              label={notoBold ? "तिथि" : "Date"}
              value={body.date}
              fontFamily={notoBold ? "Noto, Fraunces, serif" : "Fraunces, serif"}
            />
          ) : null}
          {timeRange ? (
            <DetailRow
              label={notoBold ? "समय" : "Time"}
              value={timeRange}
              fontFamily={notoBold ? "Noto, Fraunces, serif" : "Fraunces, serif"}
            />
          ) : null}
          {body.area || body.address ? (
            <DetailRow
              label={notoBold ? "स्थान" : "Place"}
              value={[body.area, body.address].filter(Boolean).join(", ")}
              fontFamily={notoBold ? "Noto, Fraunces, serif" : "Fraunces, serif"}
            />
          ) : null}
          {body.menu ? (
            <DetailRow
              label={notoBold ? "प्रसाद" : "Prasad"}
              value={body.menu}
              fontFamily={notoBold ? "Noto, Fraunces, serif" : "Fraunces, serif"}
            />
          ) : null}
          {body.organizerName ? (
            <DetailRow
              label={notoBold ? "आयोजक" : "Organizer"}
              value={
                body.organizerPhone
                  ? `${body.organizerName} · ${body.organizerPhone}`
                  : body.organizerName
              }
              fontFamily={notoBold ? "Noto, Fraunces, serif" : "Fraunces, serif"}
            />
          ) : null}
        </div>

        {/* Bottom band: Hanuman illustration + QR + brand footer */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            paddingLeft: 80,
            paddingRight: 80,
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 64,
          }}
        >
          {hanumanPng ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hanumanPng}
              alt=""
              width={360}
              height={480}
              style={{ width: 360, height: 480 }}
            />
          ) : (
            <div
              style={{
                width: 360,
                height: 480,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 280,
                color: SAFFRON_600,
              }}
            >
              🪔
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt=""
              width={360}
              height={360}
              style={{ width: 360, height: 360 }}
            />
            <div
              style={{
                fontSize: 28,
                color: INK_600,
                letterSpacing: 1,
                display: "flex",
              }}
            >
              Scan to see on map
            </div>
            {notoBold ? (
              <div
                style={{
                  fontFamily: "Noto, Fraunces, serif",
                  fontWeight: 700,
                  fontSize: 28,
                  color: INK_600,
                  display: "flex",
                }}
              >
                नक्शे पर देखें
              </div>
            ) : null}
          </div>
        </div>

        {/* Closer + brand mark */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 64,
            gap: 12,
          }}
        >
          {notoBold ? (
            <div
              style={{
                fontFamily: "Noto, Fraunces, serif",
                fontWeight: 700,
                fontSize: 56,
                color: SINDOOR_700,
                letterSpacing: 0,
                display: "flex",
              }}
            >
              जय श्री राम · जय हनुमान
            </div>
          ) : (
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: SINDOOR_700,
                letterSpacing: 1,
                display: "flex",
              }}
            >
              Jai Shri Ram · Jai Hanuman
            </div>
          )}
          <div
            style={{
              fontSize: 22,
              color: INK_600,
              letterSpacing: 6,
              textTransform: "uppercase",
              fontWeight: 500,
              display: "flex",
            }}
          >
            Listed on BadaMangal.com — Lucknow's free Bada Mangal directory
          </div>
        </div>
      </div>
    ),
    {
      ...A4,
      fonts: fonts.length ? fonts : undefined,
      headers: {
        // Suggest filename. Browsers honour this on download via
        // the file-save flow we trigger client-side.
        "content-disposition": `attachment; filename="bada-mangal-pamphlet-${slugify(name)}.png"`,
      },
    },
  );
}

/**
 * Single label/value row in the details block. Two flex columns so
 * the labels right-align into a tidy gutter regardless of length.
 */
function DetailRow({
  label,
  value,
  fontFamily,
}: {
  label: string;
  value: string;
  fontFamily: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 32 }}>
      <div
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 44,
          color: SAFFRON_600,
          width: 220,
          flexShrink: 0,
          textAlign: "right",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily,
          fontWeight: 500,
          fontSize: 44,
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
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "pamphlet";
}
