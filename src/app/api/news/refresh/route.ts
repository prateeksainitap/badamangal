/**
 * POST /api/news/refresh
 *
 * Triggers one cycle of the Google News aggregator (see
 * src/lib/news-aggregator.ts). Two callers in production:
 *
 *   • the admin "Refresh news" button on /admin (manual trigger
 *     when you want fresh items NOW)
 *   • a scheduled cron — either Netlify Scheduled Functions or an
 *     external cron-job.org hitting this endpoint every 2-3 hours
 *     with the X-News-Refresh-Token header set to NEWS_REFRESH_TOKEN
 *
 * Auth: two independent paths so both callers can authenticate.
 *   1. Admin cookie (already used everywhere else in /admin) —
 *      lets the admin click "Refresh news" in the UI without any
 *      extra token plumbing.
 *   2. X-News-Refresh-Token header matching env NEWS_REFRESH_TOKEN —
 *      lets a cron service trigger this without admin cookies. If
 *      the env var is unset, this auth path is disabled (so we
 *      never accidentally open the endpoint world-wide).
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { refreshNews } from "@/lib/news-aggregator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30; // network calls + DB writes, 30s headroom

const ADMIN_COOKIE = "admin";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // Path 1: admin cookie
  const expectedAdmin = process.env.ADMIN_PASSWORD;
  if (expectedAdmin) {
    const c = await cookies();
    if (c.get(ADMIN_COOKIE)?.value === expectedAdmin) return true;
  }
  // Path 2: cron token header
  const expectedToken = process.env.NEWS_REFRESH_TOKEN;
  if (expectedToken) {
    const provided = req.headers.get("x-news-refresh-token");
    if (provided && provided === expectedToken) return true;
  }
  return false;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const report = await refreshNews();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("news refresh failed", err);
    return NextResponse.json(
      { ok: false, error: "aggregator_failed", detail: message },
      { status: 500 },
    );
  }
}
