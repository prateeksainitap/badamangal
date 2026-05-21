import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { stripBotProvenance } from "@/lib/sanitize";
import GalleryFullView from "@/components/GalleryFullView";
import type { GalleryItem } from "@/components/GalleryLightbox";

// 5-min ISR keeps the page cheap (one big read per refresh window)
// while still feeling reasonably fresh during a live Tuesday. The
// in-page lightbox is client-only so no per-photo SSR cost.
export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Gallery · BadaMangal Lucknow",
  description:
    "Every Bada Mangal photo on BadaMangal.com, grouped by day. Crowd shots, kadhais, pandals, and faces from across Lucknow this season.",
  alternates: {
    canonical: "/gallery",
    languages: {
      "hi-IN": "/gallery",
      "en-IN": "/gallery?lang=en",
    },
  },
  openGraph: {
    title: "Gallery · BadaMangal Lucknow",
    description:
      "Every Bada Mangal photo on BadaMangal.com, grouped by day.",
    url: `${SITE_URL}/gallery`,
    type: "website",
    siteName: "BadaMangal",
  },
};

export default async function GalleryPage() {
  // Full-pull caps to keep the wire payload sane. 200 admin + 300
  // spot rows = ~500 max items, generous enough for the season and
  // cheap enough that the page stays under ~400 KB SSR.
  const [galleryAdmin, gallerySpotPhotos] = await Promise.all([
    prisma.galleryPhoto.findMany({
      where: { status: "VISIBLE" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        captionHi: true,
        uploadedBy: true,
        createdAt: true,
      },
    }),
    prisma.spot.findMany({
      where: { status: "APPROVED", photoUrl: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        photoUrl: true,
        extraPhotoUrls: true,
        caption: true,
        reporterName: true,
        createdAt: true,
      },
    }),
  ]);

  // Normalise both sources into a single GalleryItem[] (defined in
  // GalleryLightbox.tsx so all gallery surfaces speak the same
  // shape). Spot rows can emit multiple items (primary + each extra
  // photo) so a 5-photo spot upload shows as 5 tiles, all sharing
  // the spot's createdAt for grouping/freshness.
  const items: GalleryItem[] = [
    ...galleryAdmin.map((g) => ({
      id: `admin:${g.id}`,
      url: g.imageUrl,
      source: "admin" as const,
      caption: g.caption ?? undefined,
      captionHi: g.captionHi ?? undefined,
      credit: g.uploadedBy ?? undefined,
      createdAt: g.createdAt.toISOString(),
    })),
    ...gallerySpotPhotos.flatMap((s) => {
      let extras: string[] = [];
      try {
        const parsed = JSON.parse(s.extraPhotoUrls || "[]");
        if (Array.isArray(parsed)) {
          extras = parsed.filter(
            (x): x is string => typeof x === "string" && x.length > 0,
          );
        }
      } catch {
        /* keep extras = [] */
      }
      const urls = [s.photoUrl, ...extras].filter(
        (u): u is string => Boolean(u),
      );
      const cleanCaption = stripBotProvenance(s.caption) || undefined;
      const createdAtIso = s.createdAt.toISOString();
      return urls.map((url, i) => ({
        id: `spot:${s.id}:${i}`,
        url,
        source: "spot" as const,
        caption: cleanCaption,
        createdAt: createdAtIso,
      }));
    }),
  ];

  return <GalleryFullView items={items} />;
}
