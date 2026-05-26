import { geocodeLucknow, type ServerGeocodeHit } from "@/lib/geocodeServer";

/**
 * Shared "geocode this bhandara with a prioritised fallback chain"
 * helper.
 *
 * Originally lived inline in /api/bot/ingest. Now lifted out so the
 * /admin/edit/[id] page can use the same chain to auto-fill the
 * lat/lng inputs when a bot-ingested row landed at 0,0 (either because
 * it was created before this fallback existed, or because every
 * candidate query missed at ingestion time).
 *
 * Candidate order matters, earlier candidates get checked first and
 * the first hit wins. The list is the same one the ingest pipeline
 * uses so the admin's resolved point matches what the bot would have
 * found if it ran today.
 *
 *   1. address (full)                           , `address`
 *   2. organizerName + " Lucknow"               , `organizer`
 *   3. organizerName + " " + area + " Lucknow"  , `organizer+area`
 *   4. landmark + " Lucknow"                    , `landmark`
 *   5. bhandara name (stripped of Shri/Bhandara), `venue`
 *
 * Returns the first successful hit (with the candidate tag baked
 * into `source`, e.g. "geocode/landmark") or null if every candidate
 * missed.
 */

export type GeocodeFallbackInput = {
  /** Free-text address column. Skipped if shorter than 5 chars. */
  address?: string | null;
  /** Curated area tag (Aliganj, Hazratganj, …). Combined with the
   *  organizer when building the org+area candidate. */
  area?: string | null;
  /** Optional landmark string (often "Near X temple / Y road"). */
  landmark?: string | null;
  /** Organizer / venue host name. */
  organizerName?: string | null;
  /** Bhandara listing name itself. Stripped of "Shri" / "Bhandara"
   *  before being used as a venue query because those keywords don't
   *  appear in Maps' place index. */
  name?: string | null;
};

export type GeocodeFallbackHit = ServerGeocodeHit & {
  /** Which candidate matched, baked into a "geocode:<api>/<tag>"
   *  string for logging / display. */
  candidateTag: string;
};

/** Build the prioritised candidate list. Exported so callers that
 *  want to surface "we tried X queries" in the UI can introspect. */
export function buildGeocodeCandidates(
  b: GeocodeFallbackInput,
): { query: string; tag: string }[] {
  const candidates: { query: string; tag: string }[] = [];

  const address = (b.address ?? "").trim();
  if (address.length >= 5) {
    candidates.push({ query: address, tag: "address" });
  }

  const org = (b.organizerName ?? "").trim();
  const area = (b.area ?? "").trim();
  if (org.length >= 3) {
    candidates.push({ query: `${org} Lucknow`, tag: "organizer" });
    if (area.length >= 2) {
      candidates.push({
        query: `${org} ${area} Lucknow`,
        tag: "organizer+area",
      });
    }
  }

  const landmark = (b.landmark ?? "").trim();
  if (landmark.length >= 3) {
    candidates.push({ query: `${landmark} Lucknow`, tag: "landmark" });
  }

  const rawName = (b.name ?? "").trim();
  if (rawName.length >= 3) {
    // Strip "Shri/Sri" prefix + "Bhandara"/Devanagari variants suffix
    //, those words don't appear in Maps' place index and tank the
    // venue lookup. e.g. "World Iron Champ Gym Bhandara" → "World
    // Iron Champ Gym" which is the actual gym on the map.
    const venue = rawName
      .replace(/^(shri|sri|श्री)\s+/i, "")
      .replace(/\s+(bhandara|bhandare|भंडारा|भंडारे)\s*$/i, "")
      .trim();
    if (
      venue.length >= 3 &&
      venue.toLowerCase() !== rawName.toLowerCase()
    ) {
      candidates.push({ query: `${venue} Lucknow`, tag: "venue" });
    }
  }

  return candidates;
}

/**
 * Walk the candidate chain and return the first geocode hit. If every
 * candidate misses or there are no usable signals at all, returns null
 *, the caller decides what to do (the ingest pipeline falls back to
 * the Lucknow centre; the edit page leaves lat/lng at 0/0 so the
 * admin's manual paste workflow stays the source of truth).
 */
export async function resolveBhandaraCoords(
  b: GeocodeFallbackInput,
): Promise<GeocodeFallbackHit | null> {
  const candidates = buildGeocodeCandidates(b);
  for (const c of candidates) {
    try {
      const hit = await geocodeLucknow(c.query);
      if (hit) {
        return { ...hit, candidateTag: c.tag };
      }
    } catch (err) {
      // One bad candidate shouldn't tank the whole chain, log and
      // try the next.
      console.warn(
        `[geocodeFallback] candidate "${c.tag}" threw:`,
        err,
      );
    }
  }
  return null;
}
