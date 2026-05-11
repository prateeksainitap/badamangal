import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
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
import GAClickDelegate from "@/components/GAClickDelegate";
import SpotFloatingCta from "@/components/SpotFloatingCta";
import FirstVisitGreeting from "@/components/FirstVisitGreeting";
import LiveActivityTicker from "@/components/LiveActivityTicker";
import { ToastProvider } from "@/components/Toast";
import { LANG_COOKIE, resolveLocale } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/locale-context";
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

// Display font for big numerals (countdown digits, visitor counter, stats).
// Variable opsz/wdth/wght, confident readable numbers up to 800 weight.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-numerals",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
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
    locale: "hi_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BadaMangal · Lucknow's table is always set.",
    description: "Find every Bada Mangal Bhandara in Lucknow.",
  },
  formatDetection: {
    telephone: true,
  },
  // Favicon stack:
  //   • SVG first — modern browsers prefer it (scales perfectly at any DPR)
  //   • 32 / 16 PNG fallbacks for older browsers + Android Chrome's
  //     limited SVG support
  //   • Apple touch icon (180×180) for iOS home-screen installs
  //   • Manifest link supplies the 192/512 PNGs to Android PWA installs
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/brand/favicon-32.png",
    apple: [
      { url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#FBF7F0",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const c = await cookies();
  const cookieLang = c.get(LANG_COOKIE)?.value;
  const initialLocale = resolveLocale({ cookieLang });
  const lang = initialLocale === "en" ? "en-IN" : "hi-IN";

  return (
    <html
      lang={lang}
      className={`${tiro.variable} ${fraunces.variable} ${mukta.variable} ${cormorant.variable} ${notoDeva.variable} ${bricolage.variable}`}
    >
      <head>
        {/* next/font already preloads font files; preconnect speeds up the
            handshake on cold loads. dns-prefetch helps the OSM tile CDN. */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://tile.openstreetmap.org" />
        <link rel="dns-prefetch" href="https://www.youtube-nocookie.com" />
      </head>
      <body className="paper text-ink-900 font-mukta min-h-dvh flex flex-col">
        <LocaleProvider value={initialLocale}>
        <ToastProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-saffron-600 focus:text-cream-50 focus:px-4 focus:py-2 focus:shadow-md"
          >
            Skip to content
          </a>
          <FirstVisitGreeting />
          <GAClickDelegate />
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SpotFloatingCta />
          <LiveActivityTicker />
          <Footer />
        </ToastProvider>
        </LocaleProvider>

        {gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
              // Silent-ignore the script-load error that ad-blockers,
              // DNT extensions, and corporate proxies fire when they
              // block googletagmanager.com. Without this handler,
              // Next.js dev overlay surfaces the raw Event as
              // `[object Event]` even though the failure is harmless.
              onError={() => {
                /* analytics blocked — page works fine without it */
              }}
            />
            <Script
              id="ga-init"
              strategy="afterInteractive"
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
            <GAPageview id={gaId} />
          </>
        ) : null}
      </body>
    </html>
  );
}
