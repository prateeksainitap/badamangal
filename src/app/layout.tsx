import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Cormorant_Garamond,
  Fraunces,
  Mukta,
  Noto_Sans_Devanagari,
  Tiro_Devanagari_Hindi,
} from "next/font/google";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import GAPageview from "@/components/GAPageview";
import GAScripts from "@/components/GAScripts";
import GAClickTracker from "@/components/GAClickTracker";
import GAClickDelegate from "@/components/GAClickDelegate";
import SpotFloatingCta from "@/components/SpotFloatingCta";
import FirstVisitGreeting from "@/components/FirstVisitGreeting";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import LiveActivityTicker from "@/components/LiveActivityTicker";
import { ToastProvider } from "@/components/Toast";
import { LocaleProvider } from "@/lib/locale-context";
// SITE_URL is the canonical site origin (https://badamangal.com).
// Sourced from src/lib/seo.ts so this file and the rest of the
// codebase share ONE constant with ONE safe fallback. metadataBase
// below depends on it being a real https URL, not localhost (see
// the long comment at the metadataBase assignment for the bug
// history).
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

const tiro = Tiro_Devanagari_Hindi({
  subsets: ["devanagari", "latin"],
  weight: "400",
  variable: "--font-tiro",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

const mukta = Mukta({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-mukta",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const notoDeva = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-deva",
  display: "swap",
});

// Display font for big numerals (admin counters, news page article
// numbering). Only used on a handful of low-traffic pages, so we load
// just the three weights actually referenced (semibold/bold/extrabold)
// instead of the original four. Previously also pulled a 500 weight
// that nothing on the site used, pure dead bytes on every page load.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-numerals",
  display: "swap",
});

export const metadata: Metadata = {
  // metadataBase is what Next.js prepends to every relative URL in
  // openGraph.images, twitter.images, alternates, etc. If it's
  // wrong, EVERY link-preview crawler (WhatsApp, Slack, iMessage,
  // Google, Twitter) gets a broken absolute URL and either renders
  // a missing-image placeholder or falls back to scraping whatever
  // decorative image happens to be in the page (commonly the
  // closing-benediction mandala chakra, which reads as nonsense to
  // a first-time viewer).
  //
  // SITE_URL imported from lib/seo.ts has a hardened fallback
  // (https://badamangal.com, not http://localhost). This file
  // previously had its own local const with a localhost fallback
  // and an operator-set NEXT_PUBLIC_SITE_URL of "http://localhost:3030"
  // on Vercel produced broken og:image URLs across the entire site.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BadaMangal · जहाँ भक्ति, वहाँ भंडारा",
    template: "%s · BadaMangal",
  },
  description:
    "लखनऊ के बड़े मंगल भंडारों का घर। 2026 में 8 मंगल, हर भंडारा एक नक़्शे पर। Find every Bada Mangal Bhandara in Lucknow.",
  applicationName: "BadaMangal",
  authors: [{ name: "BadaMangal" }],
  openGraph: {
    title: "BadaMangal · Lucknow's table is always set.",
    description:
      "The map, the mic, and the manch for Lucknow's Bada Mangal: find, host, sponsor.",
    url: SITE_URL,
    siteName: "BadaMangal",
    // Site-wide OG default; per-page metadata can override. Set to
    // en_IN to match the default locale rendered for first-time
    // visitors (resolveLocale → "en").
    locale: "en_IN",
    alternateLocale: "hi_IN",
    type: "website",
    // No explicit `images` here. Next.js auto-resolves OG images
    // from the file-based convention `src/app/opengraph-image.tsx`,
    // which renders the dynamic 'Jahan Bhakti, Vahan Bhandara' card
    // via Satori (1200x630, branded). Setting `images` here would
    // shadow that for routes that don't have their own
    // opengraph-image.tsx; we want the auto-generated card to be
    // the unified default. Routes that DO have their own
    // opengraph-image.tsx (every page in src/app/) already produce
    // a per-page card.
  },
  twitter: {
    card: "summary_large_image",
    title: "BadaMangal · Lucknow's table is always set.",
    description: "Find every Bada Mangal Bhandara in Lucknow.",
    // No explicit `images` either. Twitter falls back to og:image
    // when twitter:image is unset, so the same auto-generated
    // Jahan Bhakti card surfaces on Twitter / X shares.
  },
  formatDetection: {
    telephone: true,
  },
  // Favicon stack:
  //   • SVG first, modern browsers prefer it (scales perfectly at any DPR)
  //   • 192 / 48 / 32 / 16 PNG fallbacks. The 192 and 48 are critical
  //     for Google Search results, Google's docs (see
  //     developers.google.com/search/docs/appearance/favicon-in-search)
  //     require a favicon that is a multiple of 48 px square (48, 96,
  //     144, 192…) for the SERP icon to display. Below 48 → Google
  //     falls back to its generic "house" icon. We list both 192 (best
  //     quality if Google supports it) and 48 (the minimum Google
  //     accepts) so the indexer has a definitive choice.
  //   • Apple touch icon (180×180) for iOS home-screen installs
  //   • Manifest link supplies the 192/512 PNGs to Android PWA installs
  //   • /favicon.ico at root is also regenerated to a multi-size
  //     16/32/48/64/96 file so legacy + Google paths both get a
  //     ≥48 px variant.
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/brand/favicon-192.png",
    apple: [
      { url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  // Search engine verification. Both env vars are NEXT_PUBLIC so they
  // render server-side into the static <head>. Empty strings → meta
  // tag simply doesn't render, so dev / preview environments don't
  // accidentally claim ownership in someone's Search Console.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF7F0",
  width: "device-width",
  initialScale: 1,
};

// Render the layout as static HTML so every route below it can be
// served from the edge cache. Previously we awaited cookies() here to
// pick the visitor's locale and render `<html lang="hi-IN">` server-
// side. That single line forced Next to treat the entire app as
// per-request dynamic, every navigation cold-started a Netlify
// Function, producing the 3-4s click-to-paint lag.
//
// Locale now resolves entirely client-side: `<LocaleHtmlSync />` reads
// the bm_lang cookie on mount and flips the `lang` attribute + the
// LocaleProvider value if the visitor has chosen Hindi. The trade-off
// is one frame of English-default markup for Hindi-cookie visitors
// before the swap, acceptable for the speed gain (and English is
// already the new-visitor default).
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const initialLocale = "en" as const;
  const lang = "en-IN";

  // Admin routes own their viewport — they don't share the public
  // Header / Footer / floating CTAs / locale provider chrome. The
  // middleware (src/middleware.ts) injects `x-pathname` so we can
  // detect server-side which "world" the request belongs to.
  // Imported lazily inside the function so the static-prerender
  // analyser doesn't try to read headers at build time.
  const { headers } = await import("next/headers");
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith("/admin");

  return (
    <html
      lang={lang}
      className={`${tiro.variable} ${fraunces.variable} ${mukta.variable} ${cormorant.variable} ${notoDeva.variable} ${bricolage.variable}`}
    >
      <head>
        {/* next/font already preloads font files; preconnect speeds up the
            handshake on cold loads. dns-prefetch handles the long-tail
            origins we don't always hit (YouTube embeds, OSM fallback). */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Supabase Storage is the photo CDN, every bhandara card hits it.
            preconnect (not just dns-prefetch) opens the TLS socket eagerly
            so the first <img> already has a warm connection. Origin is
            read from SUPABASE_URL so it stays in sync with whichever
            project the deploy is pointed at (no hardcoded ref). */}
        {process.env.SUPABASE_URL ? (
          <link
            rel="preconnect"
            href={new URL(process.env.SUPABASE_URL).origin}
            crossOrigin=""
          />
        ) : null}
        {/* Ola Maps tiles + sprites for the homepage map. Even though we
            lazy-import the map, the network warm-up doesn't cost anything
            on the critical path and saves 100-300ms once the visitor
            scrolls down. */}
        <link rel="preconnect" href="https://api.olamaps.io" crossOrigin="" />
        <link rel="dns-prefetch" href="https://tile.openstreetmap.org" />
        <link rel="dns-prefetch" href="https://www.youtube-nocookie.com" />
      </head>
      <body
        // Keep `paper` even on admin routes so existing admin pages
        // (which were designed against the cream background) keep
        // working unchanged. Pages that opt into the new dark
        // dashboard wrap themselves with <AdminShell>, which paints
        // the dark surface on top of paper inside its own container.
        // We only strip the PUBLIC chrome (Header/Footer/floating
        // CTAs) on admin routes — the body skin stays the same.
        className="paper text-ink-900 font-mukta min-h-dvh flex flex-col"
      >
        <LocaleProvider value={initialLocale}>
        <ToastProvider>
          {isAdmin ? (
            // Admin world: no public Header/Footer, no Spot CTA, no
            // first-visit greeting, no scroll-to-top, no activity
            // ticker. The admin layout (src/app/admin/layout.tsx)
            // owns the entire viewport via <AdminShell>.
            children
          ) : (
            <>
              <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-saffron-600 focus:text-cream-50 focus:px-4 focus:py-2 focus:shadow-md"
              >
                Skip to content
              </a>
              <FirstVisitGreeting />
              {/* First-ever-visit audio chant was retired, autoplay surprised
                  users on the home page (especially on mobile data) and the
                  visual "जय श्री राम" greeting above already carries the
                  welcome moment. The <FirstVisitChant /> component is left
                  in the repo in case we want to re-enable it later behind
                  an explicit opt-in. */}
              <GAClickDelegate />
              <Header />
              <main id="main" className="flex-1">
                {children}
              </main>
              <SpotFloatingCta />
              <ScrollToTopButton />
              <LiveActivityTicker />
              <Footer />
            </>
          )}
        </ToastProvider>
        </LocaleProvider>

        {gaId ? (
          <>
            {/* GA loader + init snippet, wrapped in a client component
                so its onError function prop doesn't try to cross the
                server/client boundary (which Next.js app-router
                disallows). See components/GAScripts.tsx for the why. */}
            <GAScripts gaId={gaId} />
            <GAPageview id={gaId} />
            {/* Delegated click handler that turns every
                data-ga="..." attribute in the app into an actual
                GA4 event. Added 2026-05-26 after the audit found
                100+ data-ga attrs and zero listener reading them. */}
            <GAClickTracker />
          </>
        ) : null}
      </body>
    </html>
  );
}
