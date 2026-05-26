/**
 * Admin-only "find new bhandaras on the web" endpoint.
 *
 * Powers /admin/discover. The admin pastes a search query (default:
 * "Bada Mangal bhandara Lucknow 2026") + optionally a year, and we
 * hand it to Gemini Flash with the googleSearch tool to fan out
 * across blog posts, news articles, organisation websites, and
 * community pages. Gemini synthesises the results into structured
 * candidate rows the admin can one-click into the PENDING bhandara
 * queue.
 *
 * Why this exists:
 *   Bhandaras get listed on a long tail of sources we can't
 *   exhaustively crawl: small organisation websites, Facebook events,
 *   community blog posts, news rollups in Hindustan Times / Amar
 *   Ujala. The moderation team would otherwise have to manually
 *   Google + scroll + transcribe each one. This endpoint trades a
 *   few seconds of Gemini latency for that whole workflow, and the
 *   admin still reviews + approves each row before it goes public.
 *
 * Auth: admin cookie (same as every other /admin/* endpoint).
 *
 * Rate limit: 6 calls per 10 minutes per IP. Each call costs one
 * Gemini Flash + grounded-search round-trip; even a curious admin
 * shouldn't be able to burn the free-tier quota by accident.
 *
 * Caching: deliberately none. The point of running discovery is to
 * see the LATEST state of the web; a cached result from an hour ago
 * defeats the purpose. Discovery is rare enough (manual, admin-only)
 * that the lack of cache doesn't matter for cost.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ipHash, readClientIp } from "@/lib/crypto";
import {
  discoverBhandarasViaSearch,
  type DiscoveryResult,
} from "@/lib/vision";
import { prisma } from "@/lib/db";
import { istTodayIso } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReqBody = {
  query?: string;
  year?: number;
};

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cost-amplification rate limit. Each call burns a Gemini grounded
  // search call, which is cheap individually but adds up if an admin
  // hammers "Run discovery" out of frustration with the results. 6 in
  // 10min gives plenty of headroom for legitimate triage without
  // letting a compromised admin session DoS the quota.
  const limit = checkRateLimit({
    key: ipHash(readClientIp(req.headers)),
    max: 6,
    windowMs: 10 * 60 * 1000,
    bucket: "admin-discover-bhandaras",
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "empty_query" }, { status: 400 });
  }
  if (query.length > 200) {
    return NextResponse.json(
      { error: "query_too_long", detail: "Max 200 characters" },
      { status: 413 },
    );
  }
  const year =
    typeof body.year === "number" && body.year >= 2024 && body.year <= 2099
      ? body.year
      : undefined;

  // Pull the names of every bhandara already in the system (APPROVED
  // is live + PENDING is in the admin queue + ARCHIVED is the
  // historical archive). We exclude REJECTED so a deliberately-
  // killed row can be re-discovered if it shows up again.
  // Names, not slugs, go to Gemini so it can match by phrasing in
  // the source pages. The vision helper re-derives slugs server-side
  // for an exact match check.
  const existing = await prisma.bhandara.findMany({
    where: { status: { not: "REJECTED" } },
    select: { name: true },
    take: 500,
  });
  const excludeNames = existing.map((b) => b.name);
  const today = istTodayIso();

  let result: DiscoveryResult;
  try {
    result = await discoverBhandarasViaSearch(query, {
      year,
      excludeNames,
      requireDateAtOrAfter: today,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[admin/discover-bhandaras] failed:", detail);
    return NextResponse.json(
      { error: "discovery_failed", detail },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    query,
    year: year ?? new Date().getFullYear(),
    summary: result.summary,
    candidates: result.candidates,
    excludedKnownCount: excludeNames.length,
    requireDateAtOrAfter: today,
  });
}
