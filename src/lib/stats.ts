import { prisma } from "@/lib/db";
import { ALL_TUESDAY_ISO } from "@/lib/dates";

export type SiteStats = {
  /** Visitor number for this request (1-indexed). */
  visitorNumber: number;
  /** Total APPROVED listings. */
  bhandarasListed: number;
  /** Distinct curated `area` values that have at least one approved listing. */
  areasCovered: number;
  /** Tuesdays in the 2026 season that are already in the past (IST). */
  tuesdaysSoFar: number;
};

/**
 * Compute homepage stats and atomically bump the visitor counter for this
 * request. Safe to call on every server-side render of the homepage.
 */
export async function getHomepageStats(): Promise<SiteStats> {
  // Bump + read visitor count atomically.
  const counter = await prisma.siteCounter.upsert({
    where: { id: "home" },
    update: { count: { increment: 1 } },
    create: { id: "home", count: 1 },
    select: { count: true },
  });

  const now = new Date();
  const todayIso = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const pastTuesdays = ALL_TUESDAY_ISO.filter((iso) => iso < todayIso);

  const records = await prisma.bhandara.findMany({
    where: { status: "APPROVED" },
    select: { area: true },
  });

  const areas = new Set<string>();
  for (const r of records) {
    if (r.area) areas.add(r.area);
  }

  return {
    visitorNumber: counter.count,
    bhandarasListed: records.length,
    areasCovered: areas.size,
    tuesdaysSoFar: pastTuesdays.length,
  };
}
