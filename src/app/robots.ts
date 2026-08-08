import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          // ── Added 2026-08 after Search Console started reporting
          // "Blocked due to other 4xx issue" (13 pages).
          //
          // /d/<id> is the printed-QR scan redirect. It is not a page:
          // it logs a DonationIntent then 302s to a `upi://pay?…` deep
          // link. Two reasons it must never be crawled:
          //   1. It rate-limits at 60 req/min/IP and returns 429, and
          //      429 is exactly what Search Console files under
          //      "Blocked due to other 4xx issue". This route is the
          //      ONLY crawlable 4xx in the whole app, verified by
          //      grepping every non-/api route for a 4xx status.
          //   2. Even when it succeeds it redirects to a non-HTTP
          //      scheme Googlebot cannot follow, and every scan
          //      Googlebot makes writes a junk row into the donation
          //      audit table.
          "/d/",
          // Internal tooling, real pages but zero search value. They
          // were crawlable purely because robots.txt never mentioned
          // them.
          "/design",
          "/design-system",
          "/preview",
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
