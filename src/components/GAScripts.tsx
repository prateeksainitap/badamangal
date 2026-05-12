"use client";

/**
 * Client-side wrapper for the Google Analytics gtag.js loader + the
 * tiny inline init snippet. Lives in its own client component so the
 * `onError` function prop (used to silence harmless ad-blocker /
 * DNT-extension load failures) stays inside the client boundary —
 * Next.js's app-router won't let server components pass function
 * props to client components, which is exactly the error we hit
 * when these <Script> tags were rendered directly from
 * `app/layout.tsx` (a server component).
 *
 * The `onError` silencing is intentional: googletagmanager.com is
 * blocked by uBlock, Brave Shields, Pi-Hole, corporate firewalls,
 * and many privacy extensions. The script-load failure that produces
 * is harmless to the visitor — the page still works, analytics just
 * doesn't fire — but without the handler Next.js dev overlay would
 * surface a noisy `[object Event]` runtime error.
 */
import Script from "next/script";

// `lazyOnload` (the strategy applied to both <Script> tags below) waits
// for the window 'load' event before fetching gtag.js. Analytics is never
// on the critical path: it costs ~70KB + a TLS handshake to load and
// must not delay the user's first paint or interaction. We still capture
// the first page_view event because GAPageview fires it on mount, the
// inline init snippet (also lazyOnload) pushes calls into dataLayer
// before gtag arrives, and gtag flushes the queue once it loads.
export default function GAScripts({ gaId }: { gaId: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="lazyOnload"
        onError={() => {
          /* analytics blocked — page works fine without it */
        }}
      />
      <Script
        id="ga-init"
        strategy="lazyOnload"
        onError={() => {
          /* see above */
        }}
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${gaId}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
