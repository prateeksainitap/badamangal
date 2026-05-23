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

/** Forward the request pathname as an `x-pathname` header so server
 *  components (specifically the root layout) can decide whether to
 *  render the public Header/Footer chrome or treat the request as
 *  an admin route that owns its full viewport. `next/headers` reads
 *  request headers, which middleware can rewrite via the
 *  `NextResponse.next({ request: { headers } })` form. */
function withPathHeader(req: NextRequest, base?: NextResponse): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  const resp =
    base ?? NextResponse.next({ request: { headers: requestHeaders } });
  // Also expose on the response so any downstream layer (Vercel
  // edge cache rules, future analytics) can key on it.
  resp.headers.set("x-pathname", req.nextUrl.pathname);
  return resp;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // The actual bug: when the URL is e.g. "/spot?lang=en?lang=en",
  // standard URL parsing treats the whole tail as the query and
  // gives us `lang === "en?lang=en"`. We detect by looking for a
  // literal `?` *inside* the query string.
  const search = url.search; // includes the leading "?"
  if (search.length < 2) return withPathHeader(req);
  // The query starts with "?", count any additional "?" past
  // position 0.
  if (search.indexOf("?", 1) === -1) return withPathHeader(req);

  // Found a stray `?`. Preserve every NON-lang query parameter and
  // rebuild the URL with a single cleaned `lang` value (if found).
  //
  // Previously we wiped `cleanedUrl.search = ""` and only re-added
  // `lang`, which silently dropped marketing/share params like
  // `?utm_source`, `?ref`, `?from=` on any indexed malformed URL.
  // Indexed deep links from Twitter/WhatsApp/email campaigns lost
  // their attribution on the redirect.
  const cleanedUrl = url.clone();
  const params = url.searchParams;
  let langValue: string | null = null;
  // Collect every non-lang key first; deduplicate by last-wins to
  // match standard URL behaviour. We can't mutate while iterating,
  // so snapshot into an array.
  const carryover: Array<[string, string]> = [];
  for (const [k, v] of params.entries()) {
    if (k === "lang") {
      // URLSearchParams will hand us the malformed value
      // "en?lang=en", strip from the first `?` onward to recover
      // just "en".
      const cleaned = v.split("?")[0]?.trim();
      if (cleaned === "en" || cleaned === "hi") {
        langValue = cleaned;
      }
    } else {
      // Same .split("?")[0] cleaning for non-lang params caught
      // by the stray-`?` parse (e.g. ?utm_source=fb?lang=en would
      // give us utm_source="fb?lang=en"; we want just "fb").
      const cleaned = v.split("?")[0] ?? "";
      carryover.push([k, cleaned]);
    }
  }
  cleanedUrl.search = ""; // wipe the malformed query, then rebuild
  for (const [k, v] of carryover) {
    cleanedUrl.searchParams.set(k, v);
  }
  // Hindi is the default; only add ?lang=en explicitly.
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
