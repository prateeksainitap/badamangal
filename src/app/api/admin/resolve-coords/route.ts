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
import { checkRateLimit } from "@/lib/rate-limit";
import { ipHash, readClientIp } from "@/lib/crypto";
import { OpenLocationCode } from "open-location-code";

// Lucknow centroid; used as the reference point when recovering a
// short Plus Code (e.g. "VXR6+QP") to a full one. We're in a
// Lucknow-only admin context.
const LKO_CENTROID = { lat: 26.85, lng: 80.95 } as const;

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
 * Map-domain SSRF allowlist (H1).
 *
 * Both resolveShortUrl and resolvePlusCode below issue server-side
 * fetches against URLs that started life as admin input. Without
 * an allowlist, a malicious / mistakenly-pasted URL could be used
 * to probe internal endpoints (Vercel metadata, internal services
 * on the function's network). Admin auth gates blast radius, but
 * even a compromised admin session shouldn't be able to pivot to
 * arbitrary outbound hosts.
 *
 * Both helpers below check this list before fetching. Subdomains of
 * an allowed apex are accepted. HTTPS-only.
 */
const MAP_ALLOWED_HOSTS: ReadonlyArray<string> = [
  "maps.app.goo.gl",
  "goo.gl",
  "g.co",
  "plus.codes",
  "maps.google.com",
  "www.google.com",
];

function isAllowedMapHost(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return MAP_ALLOWED_HOSTS.some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
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
  // Belt-and-braces: even after the regex passes, run through the
  // allowlist so a future regex tweak can't accidentally open this
  // up to non-map hosts.
  if (!isAllowedMapHost(s)) return null;
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
 * Switched from scraping plus.codes HTML to the open-location-code
 * npm package (P1-13). The HTML approach was fragile: any change
 * to plus.codes' rendered markup would break the resolver
 * silently, with no alert. The library decodes locally, ~12 KB
 * runtime cost, no network call, no plus.codes dependency.
 *
 * Supports both:
 *   • Full codes (10+ chars before `+`, e.g. `7JGM3CV9+QG`)
 *   • Short codes with a city anchor (e.g. `VXR6+QP Lucknow`)
 *     recovered relative to LKO_CENTROID since the resolver only
 *     gets called from /admin in a Lucknow context.
 */
async function resolvePlusCode(
  input: string,
): Promise<{ lat: number; lng: number } | null> {
  const s = input.trim();
  // Grab the code portion (drops a " Lucknow" anchor suffix if any).
  const codePart = s.split(" ")[0] ?? "";
  // Plus Code grammar: 4-8 chars before `+`, optional 0-5 chars after.
  if (
    !/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,5}$/i.test(codePart)
  ) {
    return null;
  }
  try {
    const olc = new OpenLocationCode();
    // A "full" code is 10+ chars including the `+`. Short codes
    // are anything else; recover them against the Lucknow centroid.
    const isFull = codePart.length >= 10 && codePart.indexOf("+") >= 8;
    const fullCode = isFull
      ? codePart
      : olc.recoverNearest(codePart, LKO_CENTROID.lat, LKO_CENTROID.lng);
    const r = olc.decode(fullCode);
    const lat = r.latitudeCenter;
    const lng = r.longitudeCenter;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cost-amplification rate limit (M3). Each call may issue an
  // Ola Maps geocode plus outbound fetches to short-link / Plus
  // Code resolvers. A compromised admin session shouldn't be able
  // to burn the Ola free-tier quota in seconds.
  const limit = checkRateLimit({
    key: ipHash(readClientIp(req.headers)),
    max: 60,
    windowMs: 10 * 60 * 1000,
    bucket: "admin-resolve-coords",
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
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
