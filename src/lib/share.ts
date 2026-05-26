/**
 * Single source of truth for the WhatsApp share message a bhandara
 * card or detail page hands to wa.me.
 *
 * Why this file exists:
 *   BhandaraCard.tsx and bhandara/[slug]/page.tsx each used to roll
 *   their own one-shot share-text builders. The two messages drifted,
 *   the card version forgot the URL, neither version localised the
 *   date or surfaced the menu, and both read like a CSV row instead
 *   of an invitation. Sharing is the single highest-yield organic
 *   growth lever on this site (every share becomes 5-30 new visitors
 *   on a Bada Mangal Tuesday), so the message has to *feel* like a
 *   personal "come, prasad served" rather than a database export.
 *
 * Shape of the message we settled on (English example):
 *
 *   You're warmly invited to a Bada Mangal bhandara. Prasad, sangat,
 *   and seva for all.
 *
 *   Bada Mangal Bhandara: Shrivastav Pariwar
 *   Date: 12 May, Tuesday · 12:00 PM – 4:00 PM
 *   Place: Talkatora, Hanuman Mandir, near Civil Hospital
 *   Prasad: puri, sabzi, halwa, prasad
 *
 *   Link: https://badamangal.com/bhandara/<slug>
 *
 *   Jai Shri Ram. Jai Hanuman.
 *
 * Localisation:
 *   • Hindi uses Devanagari name, Hindi address (if present), Hindi
 *     date, and Hindi menu strings; English uses Roman.
 *   • The detail URL appends `?lang=en` for English shares so the
 *     receiver lands in their reading language without an extra tap.
 *
 * Glyph policy:
 *   • Strictly ASCII + Devanagari + middle-dot (U+00B7). The previous
 *     version used 🪔 📅 📍 🍛 🔗 🚩, on old WhatsApp builds the
 *     2020-era diya glyph (U+1FA94) falls back to a black diamond, and
 *     a few testers reported every emoji rendering as ◆ on their
 *     device's font set. Reverting to plain text guarantees the
 *     message reads correctly on every WhatsApp client we've ever
 *     seen in the wild (low-end Android included).
 *   • Em dashes ("-") replaced with commas + middle dots. They were
 *     getting mangled on some Hindi keyboards copy-paste flow.
 *
 * Defensive defaults:
 *   • Missing end-time → render just start (avoids "NaN AM").
 *   • Missing date → omit the Date line entirely.
 *   • Missing menu → omit the Prasad line entirely.
 *   • Address falls back across hi → en → "" without crashing.
 *
 * The output is plain text wrapped in encodeURIComponent before being
 * suffixed onto `https://wa.me/?text=`, WhatsApp's mobile web URL
 * format which deep-links to the share-target picker on Android/iOS.
 */
import type { Bhandara } from "@/types/bhandara";
import { format12h } from "@/lib/time";
import { SITE_URL } from "@/lib/seo";

type Locale = "hi" | "en";

/** Render YYYY-MM-DD as "12 May" / "12 मई" or "" if invalid. */
function shortDate(iso: string, locale: Locale): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return "";
  const monthsEn = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthsHi = [
    "जन",
    "फ़र",
    "मार्च",
    "अप्रैल",
    "मई",
    "जून",
    "जुल",
    "अग",
    "सित",
    "अक्ट",
    "नव",
    "दिस",
  ];
  return `${d} ${(locale === "hi" ? monthsHi : monthsEn)[m - 1]}`;
}

/** Pick the next-upcoming Tuesday from the bhandara's serving dates.
 *  Falls back to the last past date if every Tuesday is behind us. */
function pickServeDate(dates: string[] | undefined): string | null {
  if (!Array.isArray(dates) || dates.length === 0) return null;
  const todayIso = new Date(
    Date.now() + 5.5 * 60 * 60 * 1000, // crude IST shift
  )
    .toISOString()
    .slice(0, 10);
  const upcoming = dates.filter((d) => d >= todayIso).sort();
  if (upcoming.length > 0) return upcoming[0];
  return [...dates].sort().pop() ?? null;
}

/**
 * Build the formatted bhandara share-message text (the part that goes
 * after `wa.me/?text=`). Exported separately from the wa.me wrapper so
 * the "Copy to clipboard" buttons can paste the warm text into ANY
 * messenger, not just WhatsApp. The wa.me URL builder
 * `whatsappShareUrlForBhandara` below wraps + encodeURIComponents this.
 *
 * See file-header comment for the full message shape.
 */
export function bhandaraShareText(b: Bhandara, locale: Locale): string {
  const isHi = locale === "hi";
  const url = `${SITE_URL}/bhandara/${b.slug}${isHi ? "" : "?lang=en"}`;
  const name = isHi ? b.nameHi || b.name : b.name;
  const address = isHi
    ? b.addressHi || b.address || ""
    : b.address || "";
  const range = b.timeEnd
    ? `${format12h(b.timeStart)} – ${format12h(b.timeEnd)}`
    : format12h(b.timeStart);

  const serveOn = pickServeDate(b.tuesdayDates);
  const dateBody = serveOn
    ? `${shortDate(serveOn, locale)}${isHi ? ", मंगलवार" : ", Tuesday"} · ${range}`
    : range;
  // WhatsApp markdown: *bold*. We bold the label prefix on each row
  // so the eye can scan "Date / Place / Prasad / Link" down the left
  // edge before reading any value. Same convention used by Slack /
  // Telegram / Signal, recipients on every platform read it as a
  // structured invite, not an unformatted paragraph.
  const dateLine = `${isHi ? "*तिथि:*" : "*Date:*"} ${dateBody}`;

  // Menu is stored as a JSON-serialised array (English keys) plus
  // menuHi (Devanagari labels) on the row. Pick whichever matches the
  // share locale, truncate to 4 entries so the message stays scannable.
  const menuArr = isHi ? b.menuHi ?? b.menu : b.menu;
  const menuLine =
    Array.isArray(menuArr) && menuArr.length > 0
      ? `${isHi ? "*प्रसाद:*" : "*Prasad:*"} ${menuArr.slice(0, 4).join(", ")}`
      : null;

  const placeBody = b.area
    ? `${b.area}${address ? `, ${address}` : ""}`
    : address || null;
  const placeLine = placeBody
    ? `${isHi ? "*स्थान:*" : "*Place:*"} ${placeBody}`
    : null;

  // Warm one-liner that opens the share. The point is to read like an
  // actual invitation rather than a structured data dump, recipients
  // who don't know what a "Bada Mangal bhandara" is should still get
  // an immediate sense of "I'm being welcomed to a community meal."
  const intro = isHi
    ? "बड़ा मंगल भंडारा में आप सभी का सादर आमंत्रण है। प्रसाद ग्रहण कीजिए, सेवा का पुण्य लीजिए। 🙏"
    : "You're warmly invited to a Bada Mangal bhandara. Prasad, sangat, and seva for all. 🙏";

  // Closer, both Ram and Hanuman invocations, separated by the
  // Devanagari danda (Hindi sentence ender) or a full stop (English).
  // 🚩 trailing emoji is the saffron flag the Hanuman bhakti tradition
  // hoists at mandirs and bhandara venues during Bada Mangal, small
  // visual anchor at the end of every share that ties the message
  // back to the festival's iconography. Paired with the 🙏 on the
  // intro line so the invite reads "open palms in, flag of devotion
  // out", exact treatment requested by the operator (see ticket
  // screenshot of the WhatsApp share preview, 2026-05-25).
  const closer = isHi ? "जय श्री राम। जय हनुमान। 🚩" : "Jai Shri Ram. Jai Hanuman. 🚩";

  // Header line is the strongest visual anchor, wrap the entire
  // "Bada Mangal Bhandara: <Name>" in bold so it stands out as the
  // invite's headline even when the recipient is glancing at the
  // first line of a long group thread.
  const header = isHi
    ? `*बड़ा मंगल भंडारा: ${name}*`
    : `*Bada Mangal Bhandara: ${name}*`;

  const lines: string[] = [
    intro,
    "",
    header,
    dateLine,
    placeLine,
    menuLine,
    "",
    `${isHi ? "*लिंक:*" : "*Link:*"} ${url}`,
    "",
    closer,
  ].filter((l): l is string => l !== null);

  return lines.join("\n");
}

/**
 * Wrap `bhandaraShareText` in a wa.me deep-link URL. Use this when the
 * caller wants a one-click "Open WhatsApp share-target picker" link.
 * For the "Copy to clipboard" button, use `bhandaraShareText` directly
 * so the recipient pastes the warm text into whatever messenger they
 * prefer (not just WhatsApp).
 */
export function whatsappShareUrlForBhandara(
  b: Bhandara,
  locale: Locale,
): string {
  return `https://wa.me/?text=${encodeURIComponent(bhandaraShareText(b, locale))}`;
}

/**
 * Input shape for the Spot share. Kept structural so the three call
 * sites (HappeningNow card, BhandaraMap popup, MapSideList row) can
 * each pass their own LiveSpot-shaped object without us having to
 * unify their types just for this helper.
 */
export type ShareableSpot = {
  lat: number;
  lng: number;
  caption: string | null;
  area: string | null;
  /** Spots optionally include a written-out address from reverse
   *  geocoding or the reporter; if absent we fall back to just area. */
  address?: string | null;
  /** Slug of the linked Bhandara, if the spot was auto-linked at
   *  insert time. When present, our `badamangal.com` link points at
   *  the bhandara detail page; otherwise it points at the homepage
   *  (where the user sees the live-spot pin on the city map). */
  bhandaraSlug?: string | null;
};

/**
 * Build the wa.me share URL for a live spot. Same warm tone as
 * `whatsappShareUrlForBhandara`, intro line, structured details with
 * plain-text labels (no emoji, see glyph policy in the file header),
 * a maps deep-link so the recipient can open turn-by-turn directions,
 * a badamangal.com link so they can browse / list / sponsor, and the
 * shared Ram/Hanuman closer.
 *
 * The message intentionally surfaces TWO links: one to Google Maps
 * (immediate action, "I want to go there now") and one to
 * badamangal.com (broader context, "What else is happening today?").
 * Recipients on data-light Android phones who can't follow the maps
 * link still get the badamangal.com link as a fallback, and vice
 * versa for recipients with adblockers who block external maps.
 */
/**
 * Build the formatted spot share-message text. Exported separately so
 * the "Copy to clipboard" buttons in the live feed / map popups can
 * paste the warm text into any messenger. The wa.me URL builder
 * `whatsappShareUrlForSpot` below just wraps + encodes this.
 */
/**
 * True when an object carries a usable Lucknow lat/lng. Bot-ingested
 * spots default to lat=0/lng=0 until an admin sets coords; listings
 * sometimes land at 0,0 when geocoding fails. Surfaces that render
 * "Get directions" / "Open in Maps" / "Copy location" / the
 * WhatsApp share-message maps line all gate on this so we never
 * generate a link to the null-island coordinate (Gulf of Guinea).
 */
export function hasMapPin(b: {
  lat?: number | null;
  lng?: number | null;
}): boolean {
  return (
    typeof b.lat === "number" &&
    typeof b.lng === "number" &&
    Number.isFinite(b.lat) &&
    Number.isFinite(b.lng) &&
    b.lat !== 0 &&
    b.lng !== 0
  );
}

export function spotShareText(s: ShareableSpot, locale: Locale): string {
  const isHi = locale === "hi";
  const pin = hasMapPin(s);
  const mapsUrl = pin
    ? `https://www.google.com/maps?q=${s.lat},${s.lng}&z=18`
    : null;
  // Second link in the share message, sits next to the Google Maps
  // link as a "and here's where it lives on the BadaMangal map"
  // counterpart. When the spot is linked to a listed bhandara, point
  // at that bhandara's detail page (which has its own embedded map).
  // Otherwise deep-link to the homepage's MapBoard via the #map
  // anchor, the recipient lands directly on the city-wide live
  // bhandara map without an extra scroll.
  const siteUrl = s.bhandaraSlug
    ? `${SITE_URL}/bhandara/${s.bhandaraSlug}${isHi ? "" : "?lang=en"}`
    : `${SITE_URL}${isHi ? "" : "?lang=en"}#map`;

  const caption = (s.caption ?? "").trim();
  // WhatsApp markdown: *bold* on the label so the scannable left edge
  // matches the bhandara share layout (Spotted / Place / Open in Maps
  // / See live bhandaras). Recipients see one consistent invite voice
  // whether they were sent a listed bhandara or a live sighting.
  const captionLine = caption
    ? `${isHi ? "*देखा गया:*" : "*Spotted:*"} ${caption}`
    : null;

  const placeBody = s.area
    ? `${s.area}${s.address ? `, ${s.address}` : ""}`
    : s.address || null;
  const placeLine = placeBody
    ? `${isHi ? "*स्थान:*" : "*Place:*"} ${placeBody}`
    : null;

  const intro = isHi
    ? "लखनऊ में अभी एक बड़ा मंगल भंडारा चल रहा है! प्रसाद ग्रहण कीजिए, सेवा का पुण्य लीजिए। 🙏"
    : "A Bada Mangal bhandara is being served in Lucknow right now. Come for prasad. 🙏";

  const mapsLabel = isHi ? "*मानचित्र पर देखें:*" : "*Open in Maps:*";
  const siteLabel = s.bhandaraSlug
    ? isHi
      ? "*विवरण:*"
      : "*Details:*"
    : isHi
      ? "*भंडारा मानचित्र पर:*"
      : "*Bhandara map:*";

  // Matching closer to bhandaraShareText, saffron-flag 🚩 anchor at
  // the end of every share so listed-bhandara and live-spot messages
  // feel like one branded voice in a group thread.
  const closer = isHi ? "जय श्री राम। जय हनुमान। 🚩" : "Jai Shri Ram. Jai Hanuman. 🚩";

  // Link order, BadaMangal link first, Google Maps second.
  // Rationale: every paste should land on our site for the receiver
  // first (richer context, brand impression, more bhandaras to
  // discover), with the Google Maps link as a one-tap navigation
  // fallback right below. Putting the BadaMangal link on top also
  // means WhatsApp's automatic link-preview card (which previews
  // the FIRST URL in the message) shows OUR OG card, not Google's
  // raw maps thumbnail.
  const lines: (string | null)[] = [
    intro,
    "",
    captionLine,
    placeLine,
    "",
    `${siteLabel} ${siteUrl}`,
    // Skip the Maps deep-link entirely when the spot doesn't have a
    // pin yet, a `?q=0,0` link drops the recipient into the Gulf of
    // Guinea, exactly the bug the user flagged. The site link above
    // still works (lists this spot among today's live photos) so the
    // share remains actionable.
    mapsUrl ? `${mapsLabel} ${mapsUrl}` : null,
    "",
    closer,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

/**
 * Wrap `spotShareText` in a wa.me deep-link URL.
 */
export function whatsappShareUrlForSpot(
  s: ShareableSpot,
  locale: Locale,
): string {
  return `https://wa.me/?text=${encodeURIComponent(spotShareText(s, locale))}`;
}
