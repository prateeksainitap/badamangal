/**
 * One-off: inspect today's Spot rows and repair any sitting at lat=0,
 * lng=0 (bot ingests where WhatsApp stripped the photo's EXIF GPS, so
 * the spot never got real coordinates and can't plot on the Lucknow
 * map). For each orphan we forward-geocode its address / area via Ola
 * and write the coordinates back, so it appears on the live map.
 *
 *   npx tsx --env-file=.env scripts/fix-orphan-spots.ts          # dry run
 *   npx tsx --env-file=.env scripts/fix-orphan-spots.ts --write   # persist
 */
import { prisma } from "../src/lib/db";
import { geocodeLucknow } from "../src/lib/geocodeServer";

const WRITE = process.argv.includes("--write");

async function main() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const spots = await prisma.spot.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\nSpots created in the last 24h: ${spots.length}`);
  for (const s of spots) {
    console.log(
      `- ${s.id} | ${s.status} | area=${s.area ?? "—"} | lat=${s.lat} lng=${s.lng}\n    addr="${(s.address ?? "").slice(0, 60)}"\n    cap ="${(s.caption ?? "").slice(0, 70)}"`,
    );
  }

  const orphans = spots.filter((s) => s.lat === 0 && s.lng === 0);
  console.log(`\nOrphans at 0,0: ${orphans.length}  (mode: ${WRITE ? "WRITE" : "dry-run"})`);

  // Words that signal the caption actually names a place (so we only
  // feed location-bearing captions to the geocoder, never generic
  // "people enjoying prasad" descriptions that would resolve to a
  // random Lucknow point).
  const LOC_HINT =
    /(chauraha|chauk|chowk|tiraha|mandir|temple|road|marg|nagar|ganj|puram|colony|vihar|bagh|crossing|bazaar|market|khand|cinema|hospital|college|school|stadium|park|gate|pul|stand|adda|\bmod\b|morh|circle|square|chowraha|aliganj|indira|gomti|hazratganj|chinhat|aminabad|alambagh|rajajipuram|mahanagar|ashiyana|ashiana|kapoorthala|polytechnic)/i;

  for (const s of orphans) {
    // The caption frequently carries the only location info the sender
    // gave ("Ice cream bhandara / Ram Ram bank chauraha / Aliganj"),
    // even when area/address are blank. Strip the bot-provenance suffix,
    // flatten newlines, and only use it if it names a place.
    const cleanCaption = (s.caption ?? "")
      .split(/\[bot:/i)[0]
      .replace(/\s+/g, " ")
      .trim();
    const captionQuery =
      cleanCaption && LOC_HINT.test(cleanCaption)
        ? `${cleanCaption}, Lucknow`
        : null;

    // Strongest signal first, then caption landmark, then coarse area.
    const candidates = [
      s.address?.trim() || null,
      captionQuery,
      s.area ? `${s.area}, Lucknow` : null,
      s.area ? `${s.area}, Lucknow, Uttar Pradesh` : null,
    ].filter((q): q is string => !!q && q.length > 1);
    if (candidates.length === 0) {
      console.log(`  ${s.id}: no address/area to geocode, skipping`);
      continue;
    }
    let hit = null as Awaited<ReturnType<typeof geocodeLucknow>>;
    let used = "";
    for (const q of candidates) {
      hit = await geocodeLucknow(q);
      if (hit) {
        used = q;
        break;
      }
    }
    if (!hit) {
      console.log(`  ${s.id}: geocode MISS for [${candidates.join(" | ")}]`);
      continue;
    }
    console.log(
      `  ${s.id}: "${used}" -> ${hit.lat},${hit.lng} (${hit.source}, matched "${hit.matched}")${WRITE ? "" : "  [dry-run]"}`,
    );
    if (WRITE) {
      await prisma.spot.update({
        where: { id: s.id },
        data: { lat: hit.lat, lng: hit.lng },
      });
    }
  }

  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
