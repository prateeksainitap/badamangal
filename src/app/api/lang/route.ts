import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side cookie writer for the language toggle.
 *
 * Why this exists: writing `document.cookie` from the client and then
 * immediately calling `router.refresh()` race-conditions under Next 15
 *, the refresh sometimes fires the new server request before the
 * just-written cookie is visible to that request. Going through a
 * server endpoint that returns `Set-Cookie` guarantees the browser has
 * fully committed the cookie before the next render, so a follow-up
 * `router.refresh()` re-renders in the chosen locale on the first try.
 *
 * Trade-off: one extra network round-trip per toggle (~50ms on a good
 * connection) instead of a full page reload. Worth it.
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to");
  if (to !== "hi" && to !== "en") {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, locale: to });
  res.cookies.set(LANG_COOKIE, to, {
    path: "/",
    maxAge: LANG_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
