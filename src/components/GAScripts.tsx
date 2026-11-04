"use client";

/**
 * Client-side wrapper for the Google Analytics gtag.js loader + the
 * tiny inline init snippet. Lives in its own client component so the
 * `onError` function prop (used to silence harmless ad-blocker /
 * DNT-extension load failures) stays inside the client boundary,
 * Next.js's app-router won't let server components pass function
 * props to client components, which is exactly the error we hit
 * when these <Script> tags were rendered directly from
 * `app/layout.tsx` (a server component).
 *
 * The `onError` silencing is intentional: googletagmanager.com is
 * blocked by uBlock, Brave Shields, Pi-Hole, corporate firewalls,
 * and many privacy extensions. The script-load failure that produces
 * is harmless to the visitor, the page still works, analytics just
 * doesn't fire, but without the handler Next.js dev overlay would
 * surface a noisy `[object Event]` runtime error.
 */
import Script from "next/script";
import { useEffect } from "react";
import { ensureGtag } from "@/lib/ga";

// gtag.js loads with `lazyOnload` (after window load) so it never delays
// first paint. The queue it reads (dataLayer + js + config) is built by
// ensureGtag() in lib/ga.ts, the first time a page_view or event needs it,
// so nothing fired before gtag.js arrives is lost. The old inline init
// snippet also ran lazily, which is why landing page_views were dropped.
export default function GAScripts({ gaId }: { gaId: string }) {
  useEffect(() => {
    ensureGtag();
  }, []);
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      strategy="lazyOnload"
      onError={() => {
        /* analytics blocked, page works fine without it */
      }}
    />
  );
}
