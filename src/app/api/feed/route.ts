import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public-shape projection — strips moderation/identity fields.
// Naming kept (`PublicPost`, `posts:` envelope) so the existing client
// components (LiveFeedMarquee, LiveFeedTimeline) don't need any change
// even though the only record-type now is Spots.
type PublicPost = {
  id: string;
  bhandaraId: string | null;
  bhandaraSlug?: string | null;
  bhandaraName?: string | null;
  bhandaraLat?: number | null;
  bhandaraLng?: number | null;
  authorName: string;
  text: string | null;
  photoUrl: string | null;
  language: string;
  createdAt: string;
  approvedAt: string | null;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const bhandaraId = url.searchParams.get("bhandaraId") ?? undefined;
  const bhandaraSlug = url.searchParams.get("bhandara") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(60, Number(limitParam ?? "12") || 12));

  const sinceDate = sinceParam ? new Date(sinceParam) : null;
  const sinceFilter =
    sinceDate && !Number.isNaN(sinceDate.getTime())
      ? { createdAt: { gt: sinceDate } }
      : {};

  const spotRecords = await prisma.spot.findMany({
    where: {
      status: "APPROVED",
      expiresAt: { gt: new Date() },
      ...(bhandaraId ? { bhandaraId } : {}),
      ...(bhandaraSlug ? { bhandara: { slug: bhandaraSlug } } : {}),
      ...sinceFilter,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      bhandara: {
        select: { slug: true, name: true, lat: true, lng: true },
      },
    },
  });

  const posts: PublicPost[] = spotRecords.map((s) => ({
    id: `spot:${s.id}`,
    bhandaraId: s.bhandaraId,
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: s.bhandara?.name ?? null,
    // Spots always have their own coords — fall back to those when there's
    // no linked bhandara so the "Get directions" CTA still works.
    bhandaraLat: s.bhandara?.lat ?? s.lat,
    bhandaraLng: s.bhandara?.lng ?? s.lng,
    authorName: s.reporterName?.trim() || "Spotter",
    text: s.caption,
    photoUrl: s.photoUrl,
    language: s.language,
    createdAt: s.createdAt.toISOString(),
    approvedAt: s.createdAt.toISOString(),
  }));

  return NextResponse.json(
    { count: posts.length, posts },
    {
      headers: {
        "Cache-Control": "public, s-maxage=2, stale-while-revalidate=8",
      },
    },
  );
}
