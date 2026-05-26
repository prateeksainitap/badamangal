/**
 * GET / POST /api/news/refresh
 *
 * Triggers one cycle of the Google News aggregator (see
 * src/lib/news-aggregator.ts). Three callers in production:
 *
 *   1. The admin "Refresh news" button on /admin (manual trigger
 *      when you want fresh items NOW). Uses POST + admin cookie.
 *   2. Vercel Cron (vercel.json, runs once daily at 06:00 IST).
 *      Uses GET + Authorization: Bearer ${CRON_SECRET} header that
 *      Vercel injects automatically.
 *   3. Any external cron service (cron-job.org, legacy Netlify
 *      Scheduled Function, etc.). Uses POST + X-News-Refresh-Token
 *      header matching NEWS_REFRESH_TOKEN env var.
 *
 * Auth: three independent paths so any caller can authenticate.
 *   1. Admin cookie matching ADMIN_PASSWORD.
 *   2. X-News-Refresh-Token header matching NEWS_REFRESH_TOKEN env.
 *   3. Authorization: Bearer header matching CRON_SECRET env (the
 *      Vercel Cron pattern) OR matching NEWS_REFRESH_TOKEN as a
 *      fallback so operators don't have to manage two secrets.
 *
 * Every auth path is GATED on its corresponding env var being set,
 * so if you don't define a secret, that path is disabled. The
 * endpoint never accidentally goes world-readable.
 *
 * Both GET and POST verbs run the same handler, Vercel Cron always
 * sends GET, the admin button always sends POST, and external crons
 * can use either.
 */
import { NextResponse, type NextRequest } from "next/server";
import { refreshNews } from "@/lib/news-aggregator";
import { isAdmin } from "@/lib/admin-auth";

// If CRON_SECRET is unset, the Vercel-Cron auth path silently
// fails, the daily cron at vercel.json:5 will 401 every day with
// no visible alarm. Surface that in the build/runtime logs so the
// operator catches the missing config in seconds rather than
// noticing weeks later that news stopped refreshing.
if (!process.env.CRON_SECRET && !process.env.NEWS_REFRESH_TOKEN) {
  console.warn(
    "[/api/news/refresh] Neither CRON_SECRET nor NEWS_REFRESH_TOKEN is set. " +
      "Bearer-token auth path is disabled; Vercel Cron will receive 401.",
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // network calls + DB writes; bumped to Vercel Hobby max

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // Path 1: admin cookie (via @/lib/admin-auth, HMAC-signed, see
  // src/lib/admin-auth.ts for the format)
  if (await isAdmin()) return true;
  // Path 2: X-News-Refresh-Token header (legacy / external cron)
  const expectedToken = process.env.NEWS_REFRESH_TOKEN;
  if (expectedToken) {
    const provided = req.headers.get("x-news-refresh-token");
    if (provided && provided === expectedToken) return true;
  }
  // Path 3: Authorization: Bearer (Vercel Cron pattern). Vercel
  // injects this header automatically when a Vercel Cron job hits
  // an internal route, with the value drawn from the CRON_SECRET
  // env var. We also accept it matching NEWS_REFRESH_TOKEN as a
  // convenience so operators can use a single secret for both
  // scheduled and manual triggers.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice("Bearer ".length).trim();
    if (cronSecret && bearer === cronSecret) return true;
    if (expectedToken && bearer === expectedToken) return true;
  }
  return false;
}

async function handle(req: NextRequest): Promise<NextResponse> {
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

// Same handler for both verbs, see file-level docstring for which
// caller uses which.
export const GET = handle;
export const POST = handle;
