import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { stripBotProvenance } from "@/lib/sanitize";
import { checkRateLimit } from "@/lib/rate-limit";
import { ipHash, readClientIp } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cap the `?since=` lookback window. The legitimate client polls
// every 15s with `since=<last fetch>`, so it would never need more
// than the recent past. A scraper passing `?since=2020-01-01` should
// NOT pull our whole spot history in one call. 7 days is safe
// margin; older requested values clamp up to this boundary.
const MAX_SINCE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

// Public-shape projection, strips moderation/identity fields.
// Naming kept (`PublicPost`, `posts:` envelope) so the existing client
// components (LiveFeedMarquee, LiveFeedTimeline) don't need any change
// even though the only record-type now is Spots.
type PublicPost = {
  id: string;
  bhandaraId: string | null;
  bhandaraSlug?: string | null;
  bhandaraName?: string | null;
  bhandaraLat?: number | null;
  bhandaraLng?: number | null;
  authorName: string;
  text: string | null;
  photoUrl: string | null;
  language: string;
  createdAt: string;
  approvedAt: string | null;
};

export async function GET(req: NextRequest) {
  // Per-IP rate limit. Normal client polls this every 15s (one per
  // open tab), so 80 / minute (= 5 min of normal polling + room
  // for multiple tabs) is plenty for legitimate use and tight
  // enough to make a slug-iterating scraper expensive.
  const limitResult = checkRateLimit({
    key: ipHash(readClientIp(req.headers)),
    max: 80,
    windowMs: 60 * 1000,
    bucket: "feed-get",
  });
  if (!limitResult.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: limitResult.retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(limitResult.retryAfterSec) },
      },
    );
  }

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const bhandaraId = url.searchParams.get("bhandaraId") ?? undefined;
  const bhandaraSlug = url.searchParams.get("bhandara") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(60, Number(limitParam ?? "12") || 12));

  // Parse `since`, clamp to the MAX_SINCE_LOOKBACK_MS boundary so
  // a scraper passing `?since=2020-01-01` only gets the last 7d.
  let sinceDate: Date | null = sinceParam ? new Date(sinceParam) : null;
  if (sinceDate && Number.isNaN(sinceDate.getTime())) sinceDate = null;
  if (sinceDate) {
    const oldest = new Date(Date.now() - MAX_SINCE_LOOKBACK_MS);
    if (sinceDate < oldest) sinceDate = oldest;
  }
  const sinceFilter = sinceDate
    ? { createdAt: { gt: sinceDate } }
    : {};

  const spotRecords = await prisma.spot.findMany({
    where: {
      status: "APPROVED",
      expiresAt: { gt: new Date() },
      ...(bhandaraId ? { bhandaraId } : {}),
      ...(bhandaraSlug ? { bhandara: { slug: bhandaraSlug } } : {}),
      ...sinceFilter,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      bhandara: {
        select: { slug: true, name: true, lat: true, lng: true },
      },
    },
  });

  const posts: PublicPost[] = spotRecords.map((s) => ({
    id: `spot:${s.id}`,
    bhandaraId: s.bhandaraId,
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: s.bhandara?.name ?? null,
    // Spots always have their own coords, fall back to those when there's
    // no linked bhandara so the "Get directions" CTA still works.
    bhandaraLat: s.bhandara?.lat ?? s.lat,
    bhandaraLng: s.bhandara?.lng ?? s.lng,
    authorName: s.reporterName?.trim() || "Spotter",
    // Public feed, strip the [bot:whatsapp …] provenance tag so it
    // never surfaces in the activity ticker, RSS, or third-party API
    // consumers. See lib/sanitize.ts.
    // `|| null` (not `??`) collapses an empty post-strip result down
    // to null, happens when the original caption was nothing but the
    // bot tag (e.g. an image-only forward where Gemini emitted no
    // caption text). Empty strings would render as awkward gaps in
    // the activity ticker.
    text: stripBotProvenance(s.caption) || null,
    photoUrl: s.photoUrl,
    language: s.language,
    createdAt: s.createdAt.toISOString(),
    approvedAt: s.createdAt.toISOString(),
  }));

  return NextResponse.json(
    { count: posts.length, posts },
    {
      headers: {
        "Cache-Control": "public, s-maxage=2, stale-while-revalidate=8",
      },
    },
  );
}
