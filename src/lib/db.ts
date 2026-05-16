import { PrismaClient, type Bhandara as DbBhandara } from "@prisma/client";
import type { Area } from "@/lib/lucknow";
import type { Bhandara } from "@/types/bhandara";
import { stripBotProvenance } from "@/lib/sanitize";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function safeJsonArray(input: string): string[] {
  try {
    const parsed: unknown = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function toBhandara(record: DbBhandara): Bhandara {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    nameHi: record.nameHi ?? record.name,
    // Strip the WhatsApp-bot provenance tag (e.g.
    //   "[bot:whatsapp · from:… · msg:… · 2026-…Z]")
    // that /api/bot/ingest embeds into description for the admin
    // moderation view. The admin view bypasses toBhandara and reads
    // the raw Prisma record so it still sees the tag (and parses it
    // via parseBotTag); every public surface goes through this
    // mapper and therefore gets the cleaned prose only.
    description: stripBotProvenance(record.description),
    descriptionHi: stripBotProvenance(record.descriptionHi),
    area: record.area as Area,
    address: record.address,
    addressHi: record.addressHi ?? undefined,
    landmark: record.landmark ?? undefined,
    lat: record.lat,
    lng: record.lng,
    tuesdayDates: safeJsonArray(record.tuesdayDates),
    timeStart: record.timeStart,
    timeEnd: record.timeEnd,
    menu: safeJsonArray(record.menu),
    menuHi: safeJsonArray(record.menuHi),
    organizerName: record.organizerName,
    organizerPhone: record.organizerPhone,
    organizerWhatsapp: record.organizerWhatsapp ?? undefined,
    upiId: record.upiId ?? undefined,
    photoUrl: record.photoUrl ?? undefined,
    isSponsored: record.isSponsored,
    isVerified: record.isVerified,
    geoNeighborhood: record.geoNeighborhood ?? undefined,
    geoDistrict: record.geoDistrict ?? undefined,
    geoState: record.geoState ?? undefined,
    googlePlaceId: record.googlePlaceId ?? undefined,
    googleMapsUrl: record.googleMapsUrl ?? undefined,
  };
}
