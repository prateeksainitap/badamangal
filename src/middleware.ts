/**
 * Edge middleware, runs before every request. Currently used only
 * to clean up malformed `?lang=en?lang=en` query strings that Google
 * has indexed (visible in GSC's "Landing page + query string"
 * report). Likely the result of an older LangToggle version that
 * string-concatenated the suffix; LangToggle now uses URLSearchParams
 * so it can't happen client-side anymore, but Google's index
 * already contains the malformed URLs. 301-redirecting them here
 * collapses the duplicate-URL link-equity dilution within one
 * Google re-crawl.
 *
 * The middleware MUST be cheap, it runs on every request, including
 * static asset hits. We early-return for asset paths and only do
 * the regex check for HTML routes.
 */
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // The actual bug: when the URL is e.g. "/spot?lang=en?lang=en",
  // standard URL parsing treats the whole tail as the query and
  // gives us `lang === "en?lang=en"`. We detect by looking for a
  // literal `?` *inside* the query string.
  const search = url.search; // includes the leading "?"
  if (search.length < 2) return NextResponse.next();
  // The query starts with "?", count any additional "?" past
  // position 0.
  if (search.indexOf("?", 1) === -1) return NextResponse.next();

  // Found a stray `?`. Trim the URL after the first valid query
  // segment that contains `lang=...`, keep at most one valid lang
  // value, drop the rest. Falls back to the bare pathname if we
  // can't extract a usable lang.
  const cleanedUrl = url.clone();
  const params = url.searchParams;
  let langValue: string | null = null;
  for (const [k, v] of params.entries()) {
    if (k === "lang") {
      // URLSearchParams will hand us the malformed value
      // "en?lang=en", strip from the first `?` onward to recover
      // just "en".
      const cleaned = v.split("?")[0]?.trim();
      if (cleaned === "en" || cleaned === "hi") {
        langValue = cleaned;
        break;
      }
    }
  }
  cleanedUrl.search = ""; // wipe the malformed query
  if (langValue && langValue !== "hi") {
    cleanedUrl.searchParams.set("lang", langValue);
  }
  return NextResponse.redirect(cleanedUrl, 301);
}

// Skip the middleware on static asset paths so we never add
// latency to image/CSS/JS requests.
export const config = {
  matcher: [
    // Match every route EXCEPT _next/static, _next/image, favicon,
    // public assets (anything with a file extension at the end).
    "/((?!_next/static|_next/image|favicon|api|.*\\.[^/]+$).*)",
  ],
};
