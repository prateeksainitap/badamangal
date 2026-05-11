import { NextResponse, type NextRequest } from "next/server";
import { prisma, toBhandara } from "@/lib/db";
import { menuHiFor } from "@/lib/menu";
import { ensureUniqueSlug, slugify } from "@/lib/slugify";
import { submitSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  // Public listings are APPROVED only. PENDING listings (just submitted,
  // awaiting team callback) are NOT exposed here — keeps junk and unconfirmed
  // listings off the city map until a human signs off.
  const records = await prisma.bhandara.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ isSponsored: "desc" }, { createdAt: "asc" }],
  });
  const bhandaras = records.map(toBhandara);
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
      // Option-4 launch model: every new submission lands as PENDING and
      // stays hidden from every public surface until the BadaMangal team
      // calls the organizer to confirm. The admin "Publish & verify"
      // action flips status → APPROVED and sets isVerified → true in one
      // step, which is when the listing first appears on the city map.
      status: "PENDING",
      isVerified: false,
    },
  });

  return NextResponse.json({ id: created.id, slug: created.slug }, { status: 201 });
}
