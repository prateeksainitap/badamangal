/**
 * Admin helper, turn a pasted "anything" into a {lat, lng} pair so
 * the moderation team doesn't have to hand-type coordinates.
 *
 * Inputs we handle:
 *   • `lat,lng` raw                              → split + parse
 *   • Full Google Maps URL (`/@LAT,LNG,…z` or
 *     `/place/…/@LAT,LNG,…z` or `!3dLAT!4dLNG`)  → regex extract
 *   • Short Google Maps URL (`maps.app.goo.gl/…`,
 *     `goo.gl/maps/…`, `g.co/kgs/…`)             → follow the 302
 *     redirect server-side and re-parse the final URL
 *   • Plus Code (`VXR6+QP Lucknow` / `7JCMVXR6+QP` etc.)
 *                                                → resolve through
 *     Google's Geocoding-via-Maps endpoint (no API key needed for
 *     the public Plus-Code lookup URL).
 *
 * Why server-side: short URLs can't be resolved from the browser
 * (CORS + opaque redirect responses). Plus-Code lookups also benefit
 * from a server fetch with proper UA headers.
 *
 * Auth: gated by the same admin cookie as every other /admin tool,
 * the endpoint is useful only to authenticated admins entering data
 * into the edit form, never called from a public surface.
 *
 * The endpoint never *writes* to the DB. It returns coordinates that
 * the client then drops into the edit form's lat/lng inputs. The
 * final Save is still an explicit admin action.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin auth check moved to @/lib/admin-auth, see import above.
// Was a local reimplementation (one of 12 in the codebase); the
// single source means future auth changes (session expiry,
// HMAC signing, IP allowlist) are a one-file edit.

// Lucknow bounding box (matches the public bhandara form + geocoder).
// We use it as a sanity filter, any extracted point outside the box
// is almost certainly wrong (typo, share of a different city's map).
const LKO_BBOX = {
  latMin: 26.6,
  latMax: 27.0,
  lngMin: 80.7,
  lngMax: 81.2,
};
function inLucknow(lat: number, lng: number): boolean {
  return (
    lat >= LKO_BBOX.latMin &&
    lat <= LKO_BBOX.latMax &&
    lng >= LKO_BBOX.lngMin &&
    lng <= LKO_BBOX.lngMax
  );
}

/**
 * Extract a `{lat, lng}` from a string using all the regex shapes
 * Google Maps URLs come in. Returns null if no pattern matched.
 *
 * Patterns (most specific first, earlier match wins):
 *   • `!3dLAT!4dLNG` , the canonical "place pin" coords in
 *     /place/… URLs. Most accurate for a specific venue.
 *   • `/@LAT,LNG,Zz` , viewport / map-center coords in maps URLs.
 *   • `?q=LAT,LNG`   , basic share URL.
 *   • `?ll=LAT,LNG`  , legacy.
 *   • `LAT,LNG`      , raw paste of `26.89,80.96`.
 */
function extractFromUrl(input: string): { lat: number; lng: number } | null {
  const s = input.trim();

  const place = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (place) {
    return { lat: Number(place[1]), lng: Number(place[2]) };
  }
  const at = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    return { lat: Number(at[1]), lng: Number(at[2]) };
  }
  const qParam = s.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?)[,%2C]+(-?\d+(?:\.\d+)?)/i);
  if (qParam) {
    return { lat: Number(qParam[1]), lng: Number(qParam[2]) };
  }
  // Raw "lat,lng", only accept when the WHOLE string is the pair, so
  // we don't accidentally swallow a longitude that looks like a comma
  // inside other text.
  const raw = s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (raw) {
    return { lat: Number(raw[1]), lng: Number(raw[2]) };
  }
  return null;
}

/**
 * Follow a short URL one hop (HEAD-style, but Google's short-link
 * service responds 302 to both GET and HEAD). Returns the resolved
 * `Location:` header URL, or null if the input wasn't a known short
 * domain / no redirect happened.
 */
async function resolveShortUrl(input: string): Promise<string | null> {
  const s = input.trim();
  const isShort =
    /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(s);
  if (!isShort) return null;
  try {
    const res = await fetch(s, {
      method: "GET",
      redirect: "manual",
      headers: {
        // Some short-link services 302 only when they see a browser
        // UA; servers (and headless fetchers) get a 200 HTML page.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    const location = res.headers.get("location");
    return location ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a Plus Code (Open Location Code) to {lat, lng}.
 *
 * We don't ship the open-location-code npm package, to keep the
 * deploy small and avoid a new dependency, we route the lookup
 * through Google's public Plus Codes resolver. The endpoint at
 * https://plus.codes/<code> returns an HTML page with the
 * coordinates in a `<meta name="geo.position">` tag and in a
 * canonical place URL. We grab whichever appears first.
 *
 * If you want offline / no-network decoding, swap this for the
 * `open-location-code` package, it's ~12KB and supports both full
 * and short codes (the latter needs a reference lat/lng, which we
 * have from Lucknow's centroid).
 */
async function resolvePlusCode(input: string): Promise<{ lat: number; lng: number } | null> {
  const s = input.trim();
  // Plus Code grammar: 4-8 chars before `+`, optional `+XX` after,
  // optional " <City>" anchor (which plus.codes accepts in the URL).
  if (!/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,5}/i.test(s.split(" ")[0])) {
    return null;
  }
  try {
    // The plus.codes web app understands the full text including the
    // anchor city, e.g. "VXR6+QP Lucknow". URL-encode the entire
    // input as the path segment.
    const url = `https://plus.codes/${encodeURIComponent(s)}`;
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Try geo.position meta first (most reliable).
    const geo = html.match(/geo\.position"\s*content="(-?\d+(?:\.\d+)?);(-?\d+(?:\.\d+)?)"/i);
    if (geo) {
      return { lat: Number(geo[1]), lng: Number(geo[2]) };
    }
    // Fallback: any "@LAT,LNG" pattern in the rendered HTML
    // (plus.codes embeds a Google Maps link with the resolved coords).
    const at = html.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at) {
      return { lat: Number(at[1]), lng: Number(at[2]) };
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { input?: string };
  try {
    body = (await req.json()) as { input?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const input = (body.input ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "empty_input" }, { status: 400 });
  }

  // 1) Direct extraction from the raw string (covers full URLs +
  //    raw `lat,lng` pastes, no network call needed).
  const direct = extractFromUrl(input);
  if (direct) {
    return NextResponse.json({
      ok: true,
      lat: direct.lat,
      lng: direct.lng,
      source: "direct",
      inLucknow: inLucknow(direct.lat, direct.lng),
    });
  }

  // 2) Short URL, follow the redirect, then re-parse.
  const resolved = await resolveShortUrl(input);
  if (resolved) {
    const fromShort = extractFromUrl(resolved);
    if (fromShort) {
      return NextResponse.json({
        ok: true,
        lat: fromShort.lat,
        lng: fromShort.lng,
        source: "short_url",
        resolvedUrl: resolved,
        inLucknow: inLucknow(fromShort.lat, fromShort.lng),
      });
    }
  }

  // 3) Plus Code, resolve via plus.codes.
  const plus = await resolvePlusCode(input);
  if (plus) {
    return NextResponse.json({
      ok: true,
      lat: plus.lat,
      lng: plus.lng,
      source: "plus_code",
      inLucknow: inLucknow(plus.lat, plus.lng),
    });
  }

  return NextResponse.json(
    {
      ok: false,
      error: "unrecognised_input",
      detail:
        "Paste a full Google Maps URL (https://www.google.com/maps/...), a short URL (https://maps.app.goo.gl/...), a Plus Code (VXR6+QP Lucknow), or raw 'lat,lng' coordinates.",
    },
    { status: 400 },
  );
}
