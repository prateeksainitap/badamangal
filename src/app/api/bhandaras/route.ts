import { NextResponse, type NextRequest } from "next/server";
import { prisma, toBhandara } from "@/lib/db";
import { hasUpcomingDate } from "@/lib/dates";
import { menuHiFor } from "@/lib/menu";
import { ensureUniqueSlug, slugify } from "@/lib/slugify";
import { submitSchema } from "@/lib/validation";
import { geocodeLucknow } from "@/lib/geocodeServer";

export const dynamic = "force-dynamic";

export async function GET() {
  // Public listings are APPROVED AND have at least one upcoming
  // service date (IST). PENDING / REJECTED listings stay hidden, AND
  // rows whose every date has passed auto-fall off this list as the
  // calendar advances. Past rows stay in the DB for /admin +
  // historical permalinks; on the public side they only show up via
  // /archive, which filters with the inverse predicate.
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

  // Smart defaults to reduce form friction (see notes in validation.ts):
  //   • If nameHi was left blank, mirror the English name. Most
  //     organisers submitting Hindi-mode forms will still type Hindi;
  //     this fallback covers the case where they typed only English.
  //     Admin can promote the proper Devanagari later from /admin/edit.
  //   • If menu came in empty, default to a single "prasad" entry so
  //     the row passes the downstream JSON.stringify + render assumptions
  //     about a non-empty array. Real menu detail can be added later.
  //   • If lat/lng aren't present, geocode the address via Ola Maps.
  //     When geocoding hits inside the Lucknow bbox, the row goes live
  //     with usable coords. When it misses (rural address, typo), the
  //     row still saves with lat=0/lng=0 → admin fixes via /admin/edit's
  //     MapLocationInput. This removes the map-pin-drop friction that
  //     was the biggest single drop-off in the form per GA4.
  const nameHi = data.nameHi && data.nameHi.length >= 2 ? data.nameHi : data.name;

  const menuArr =
    data.menu.length > 0 || (data.menuOther ?? []).length > 0
      ? data.menu
      : ["prasad"];

  let lat = data.lat ?? 0;
  let lng = data.lng ?? 0;
  if (
    (lat === 0 || lng === 0 || !Number.isFinite(lat) || !Number.isFinite(lng)) &&
    data.address &&
    data.address.length >= 5
  ) {
    try {
      const hit = await geocodeLucknow(data.address);
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
      }
    } catch (err) {
      console.error("[POST /api/bhandaras] geocode error", err);
    }
  }

  const baseSlug = slugify(data.name);
  const slug = await ensureUniqueSlug(baseSlug);
  // Merge curated menu (English keys) with free-form items the organizer
  // typed; dedupe (case-insensitive) so a typed "puri" doesn't double up
  // with the chip "puri".
  const lowerCurated = new Set(menuArr.map((k) => k.toLowerCase()));
  const others = (data.menuOther ?? []).filter(
    (s) => s && !lowerCurated.has(s.toLowerCase()),
  );
  const finalMenu = [...menuArr, ...others];
  const finalMenuHi = [...menuHiFor(menuArr), ...others];
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=18`;

  const created = await prisma.bhandara.create({
    data: {
      slug,
      name: data.name,
      nameHi,
      description: data.description ?? null,
      descriptionHi: data.descriptionHi ?? null,
      address: data.address,
      addressHi: data.addressHi ?? null,
      area: data.area,
      landmark: data.landmark ?? null,
      lat,
      lng,
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
      //
      // EXCEPTION: if the geocode failed (lat or lng is 0), we hold
      // the row in PENDING. A bhandara at lat=0,lng=0 renders off
      // the African coast on the public map — pollutes the
      // homepage city map until admin notices. Holding it in
      // PENDING surfaces the row in /admin's queue where
      // MapLocationInput can rescue the coordinates manually
      // before it ever goes public.
      status: lat === 0 || lng === 0 ? "PENDING" : "APPROVED",
      approvedAt: lat === 0 || lng === 0 ? null : new Date(),
      isVerified: false,
    },
  });

  return NextResponse.json({ id: created.id, slug: created.slug }, { status: 201 });
}
