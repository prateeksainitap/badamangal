import { NextResponse, type NextRequest } from "next/server";
import { prisma, toBhandara } from "@/lib/db";
import { hasUpcomingDate } from "@/lib/dates";
import { menuHiFor } from "@/lib/menu";
import { ensureUniqueSlug, slugify } from "@/lib/slugify";
import { submitSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  // Public listings are APPROVED AND have at least one upcoming
  // service date (IST). PENDING / REJECTED listings stay hidden, AND
  // rows whose every date has passed auto-fall off this list as the
  // calendar advances — same behaviour as the homepage. Past rows
  // stay in the DB for admin + historical permalinks.
  const records = await prisma.bhandara.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ isSponsored: "desc" }, { createdAt: "asc" }],
  });
  const bhandaras = records.map(toBhandara).filter((b) => hasUpcomingDate(b));
  return NextResponse.json(
    { count: bhandaras.length, bhandaras },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const baseSlug = slugify(data.name);
  const slug = await ensureUniqueSlug(baseSlug);
  // Merge curated menu (English keys) with free-form items the organizer
  // typed; dedupe (case-insensitive) so a typed "puri" doesn't double up
  // with the chip "puri".
  const lowerCurated = new Set(data.menu.map((k) => k.toLowerCase()));
  const others = (data.menuOther ?? []).filter(
    (s) => s && !lowerCurated.has(s.toLowerCase()),
  );
  const finalMenu = [...data.menu, ...others];
  const finalMenuHi = [...menuHiFor(data.menu), ...others];
  const googleMapsUrl = `https://www.google.com/maps?q=${data.lat},${data.lng}&z=18`;

  const created = await prisma.bhandara.create({
    data: {
      slug,
      name: data.name,
      nameHi: data.nameHi,
      description: data.description ?? null,
      descriptionHi: data.descriptionHi ?? null,
      address: data.address,
      addressHi: data.addressHi ?? null,
      area: data.area,
      landmark: data.landmark ?? null,
      lat: data.lat,
      lng: data.lng,
      tuesdayDates: JSON.stringify(data.tuesdayDates),
      timeStart: data.timeStart,
      timeEnd: data.timeEnd ?? "",
      menu: JSON.stringify(finalMenu),
      menuHi: JSON.stringify(finalMenuHi),
      organizerName: data.organizerName,
      organizerPhone: data.organizerPhone,
      organizerWhatsapp: data.organizerWhatsapp ?? null,
      upiId: data.upiId ?? null,
      photoUrl: data.photoUrl ?? null,
      googlePlaceId: data.googlePlaceId ?? null,
      geoNeighborhood: data.geoNeighborhood ?? null,
      geoDistrict: data.geoDistrict ?? null,
      geoState: data.geoState ?? null,
      googleMapsUrl,
      // New listings go LIVE immediately on submission so the organizer
      // sees their bhandara on the city map within seconds. The team
      // still calls the submitted phone within 24 h to confirm the
      // details and flip `isVerified` → true, which is what surfaces
      // the green "Verified" badge on the listing.
      status: "APPROVED",
      approvedAt: new Date(),
      isVerified: false,
    },
  });

  return NextResponse.json({ id: created.id, slug: created.slug }, { status: 201 });
}
