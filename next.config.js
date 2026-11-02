/** @type {import('next').NextConfig} */

// Candidate Content-Security-Policy. Shipped in REPORT-ONLY mode,
// which means the browser checks the policy on every request and
// posts a JSON violation report to /api/csp-report when something
// would have been blocked — but nothing actually gets blocked. After
// a few days of real-traffic data we'll know exactly which origins
// to permit before flipping this to enforcement.
//
// Allowed third-parties:
//   • Supabase Storage (photo CDN) + Supabase Postgres REST
//   • Ola Maps tiles, sprites, glyphs (api.olamaps.io) + Places APIs
//   • YouTube nocookie (devotional embeds when audioUrl absent)
//   • Google Analytics + Tag Manager
const cspReportOnly = [
  "default-src 'self'",
  // Map tiles + marker sprites + WebGL textures come from api.olamaps.io.
  // cdn.badamangal.com is our R2-backed photo CDN where bot-ingested
  // spot images live; without it every WhatsApp-forwarded photo tripped
  // a CSP report on every page that renders a spot card.
  "img-src 'self' data: blob: https://*.supabase.co https://cdn.badamangal.com https://api.olamaps.io https://www.google-analytics.com",
  "media-src 'self' blob:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
  // 'unsafe-eval' is required by MapLibre GL for its WebGL shader compilation
  // path. Same trade-off Mapbox/Maplibre demand; without it the map fails
  // to render on browsers that enforce strict CSP.
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co https://api.olamaps.io https://www.google-analytics.com https://region1.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-src 'self' https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "report-uri /api/csp-report",
].join("; ");

// Security headers. CSP is in report-only mode (above). The rest are
// safe by-default and don't require per-route knowledge.
const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
  // Reporting API endpoint group — modern browsers prefer this over
  // the legacy `report-uri` directive. Both are harmless to ship.
  {
    key: "Report-To",
    value: JSON.stringify({
      group: "csp-endpoint",
      max_age: 10886400,
      endpoints: [{ url: "/api/csp-report" }],
    }),
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "geolocation=(self), camera=(self), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
  // HSTS only in production so localhost dev isn't permanently
  // upgraded to https in browsers that visit it.
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

// Long-cache headers for static brand assets that don't change between
// deploys. Filenames hashed by the bundler get this for free; these
// rules cover the unhashed `/public` assets.
const longCacheHeaders = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

// Crawlers that must get <title>, canonical and the other metadata tags
// inside <head> instead of streamed after the page body. Next.js 15.2+
// streams metadata to every user agent not matched here, and its default
// list leaves out Googlebot (it assumes Googlebot runs JavaScript), so on
// production Googlebot saw the title and canonical after the footer.
// Setting this option REPLACES the Next.js default list, so the default
// list (next/dist/shared/lib/router/utils/html-bots.js, Next 15.5) is
// repeated in full below, followed by Googlebot and the other search and
// answer engine crawlers. Matched case insensitively. Regular visitors
// still get streamed metadata, so page speed for people is unchanged.
const htmlLimitedBots = new RegExp(
  [
    // Next.js 15.5 default list
    "[\\w-]+-Google", "Google-[\\w-]+", "Chrome-Lighthouse", "Slurp", "DuckDuckBot",
    "baiduspider", "yandex", "sogou", "bitlybot", "tumblr", "vkShare",
    "quora link preview", "redditbot", "ia_archiver", "Bingbot", "BingPreview",
    "applebot", "facebookexternalhit", "facebookcatalog", "Twitterbot",
    "LinkedInBot", "Slackbot", "Discordbot", "WhatsApp", "SkypeUriPreview",
    "Yeti", "googleweblight",
    // Added for BadaMangal
    "Googlebot", "Storebot-Google", "msnbot", "adidxbot", "Applebot-Extended",
    "OAI-SearchBot", "ChatGPT-User", "GPTBot", "ClaudeBot", "Claude-SearchBot",
    "Claude-User", "PerplexityBot", "Perplexity-User", "Amazonbot", "CCBot",
    "Bytespider", "PetalBot", "SeznamBot", "Qwantify", "Ecosia", "MojeekBot",
    "TelegramBot", "Pinterestbot", "SemrushBot", "AhrefsBot", "MJ12bot",
  ].join("|"),
  "i",
);

const nextConfig = {
  reactStrictMode: true,
  htmlLimitedBots,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/audio/:path*", headers: longCacheHeaders },
      { source: "/illustrations/:path*", headers: longCacheHeaders },
      { source: "/brand/:path*", headers: longCacheHeaders },
    ];
  },
  async redirects() {
    // BadaMangalBhandara.com -> BadaMangal.com is handled at the DNS/Netlify
    // layer; this hook is reserved for any in-app redirects we may add later.
    return [
      // The Hazratganj temple page was renamed to the temple's real name
      // (29 Oct 2026). Keep the old URL and its search rank working.
      {
        source: "/resources/temples/sankat-mochan-hazratganj",
        destination: "/resources/temples/dakshinmukhi-hanuman-hazratganj",
        permanent: true,
      },
      // "Bada Hanuman Mandir, Khun Khun Ji Road" could not be verified and
      // was replaced by Hanuman Garhi, Aminabad (30 Oct 2026).
      {
        source: "/resources/temples/bada-hanuman-khun-khun-ji",
        destination: "/resources/temples/hanuman-garhi-aminabad",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
