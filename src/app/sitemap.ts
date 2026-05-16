import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

// Skip prerender at build time. The sitemap queries Prisma → Supabase's
// transaction-mode pooler (`:6543`), which under load throws PG 42P09
// ("prepared statement already exists") during the static page pass and
// kills the build. Generating on-request is fine: the file is rarely
// requested (crawlers, ~once/day) and Next caches it for `revalidate`
// seconds anyway. Saves a build-time DB round-trip on every deploy too.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * Build a sitemap entry with `hi-IN` / `en-IN` / `x-default` alternates.
 *
 * Next 15's `MetadataRoute.Sitemap` shape supports `alternates.languages`,
 * which Next serialises as `<xhtml:link rel="alternate" hreflang="…">`
 * tags inside each `<url>` block. That's the mechanism Google uses to
 * understand "/page" and "/page?lang=en" are the same content in
 * different languages → no duplicate-content dilution, correct
 * SERP variant served per searcher locale.
 *
 * Convention: the bare URL (no query) is Hindi-first (matches the
 * site's primary audience + cookie default). `?lang=en` is English.
 * `x-default` points at Hindi too — Google falls back to it when no
 * other hreflang matches the searcher's locale.
 */
function urlWithAlternates(
  path: string,
  opts: {
    lastModified?: Date;
    changeFrequency?:
      | "always"
      | "hourly"
      | "daily"
      | "weekly"
      | "monthly"
      | "yearly"
      | "never";
    priority?: number;
  } = {},
): MetadataRoute.Sitemap[number] {
  // Path normalisation: ensure leading slash, no trailing slash except
  // for the root. Prevents drift like `/history/` vs `/history`.
  const clean = path === "/" ? "/" : path.replace(/\/$/, "");
  const isRoot = clean === "/";
  const baseUrl = `${SITE}${isRoot ? "/" : clean}`;
  const enUrl = `${baseUrl}${isRoot ? "?lang=en" : `${baseUrl.includes("?") ? "&" : "?"}lang=en`}`;
  return {
    url: baseUrl,
    lastModified: opts.lastModified ?? new Date(),
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: {
      languages: {
        "hi-IN": baseUrl,
        "en-IN": enUrl,
        "x-default": baseUrl,
      },
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const records = await prisma.bhandara.findMany({
    where: { status: "APPROVED" },
    select: { slug: true, approvedAt: true, createdAt: true },
  });

  const staticEntries: MetadataRoute.Sitemap = [
    urlWithAlternates("/", { changeFrequency: "daily", priority: 1.0 }),
    urlWithAlternates("/history", { changeFrequency: "monthly", priority: 0.9 }),
    urlWithAlternates("/live", { changeFrequency: "always", priority: 0.85 }),
    urlWithAlternates("/archive", { changeFrequency: "weekly", priority: 0.7 }),
    urlWithAlternates("/list-bhandara", { changeFrequency: "weekly", priority: 0.7 }),
    urlWithAlternates("/spot", { changeFrequency: "weekly", priority: 0.6 }),
    urlWithAlternates("/contact", { changeFrequency: "monthly", priority: 0.5 }),
    urlWithAlternates("/resources", { changeFrequency: "weekly", priority: 0.8 }),
    urlWithAlternates("/resources/chalisa", { changeFrequency: "monthly", priority: 0.7 }),
    urlWithAlternates("/resources/aarti", { changeFrequency: "monthly", priority: 0.7 }),
    urlWithAlternates("/resources/ashtak", { changeFrequency: "monthly", priority: 0.7 }),
    urlWithAlternates("/resources/bajrang-baan", { changeFrequency: "monthly", priority: 0.7 }),
    urlWithAlternates("/resources/ram-stuti", { changeFrequency: "monthly", priority: 0.7 }),
    urlWithAlternates("/resources/rituals", { changeFrequency: "monthly", priority: 0.6 }),
    urlWithAlternates("/resources/temples", { changeFrequency: "monthly", priority: 0.7 }),
    urlWithAlternates("/resources/news", { changeFrequency: "weekly", priority: 0.65 }),
    urlWithAlternates("/terms", { changeFrequency: "yearly", priority: 0.3 }),
    urlWithAlternates("/privacy", { changeFrequency: "yearly", priority: 0.3 }),
    urlWithAlternates("/disclaimers", { changeFrequency: "yearly", priority: 0.3 }),
  ];

  // Per-bhandara entries. lastModified prefers approvedAt (when the
  // admin published it) over createdAt (when the form-submission row
  // first landed). Bhandaras only change rarely between submissions,
  // so `weekly` change frequency is the realistic upper bound.
  const bhandaraEntries: MetadataRoute.Sitemap = records.map((b) =>
    urlWithAlternates(`/bhandara/${b.slug}`, {
      lastModified: b.approvedAt ?? b.createdAt,
      changeFrequency: "weekly",
      priority: 0.6,
    }),
  );

  return [...staticEntries, ...bhandaraEntries];
}
