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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const records = await prisma.bhandara.findMany({
    where: { status: "APPROVED" },
    select: { slug: true, approvedAt: true, createdAt: true },
  });

  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE}/history`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE}/list-bhandara`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE}/resources`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE}/resources/chalisa`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/resources/aarti`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/resources/ashtak`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/resources/bajrang-baan`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/resources/ram-stuti`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/resources/rituals`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE}/resources/temples`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE}/disclaimers`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const bhandaraEntries: MetadataRoute.Sitemap = records.map((b) => ({
    url: `${SITE}/bhandara/${b.slug}`,
    lastModified: b.approvedAt ?? b.createdAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...bhandaraEntries];
}
