/**
 * Picks the real community moments the homepage shows: the four phone
 * prints around Hanuman ji in the hero, and the WhatsApp thread in the
 * community section. Server only, pure functions over rows page.tsx
 * already fetched.
 *
 * Privacy matches LiveChatterBoard: first names only, emoji and the
 * WhatsApp "~" decorations stripped, "Private Number" never shown.
 */

export type SpotLike = {
  id: string;
  photoUrl: string | null;
  caption: string | null;
  reporterName: string | null;
  area: string | null;
  createdAt: string;
  bhandaraSlug: string | null;
};

export type HeroPrint = {
  id: string;
  photoUrl: string;
  name: string | null;
  caption: string;
  locality: string | null;
  href: string;
};

export type ThreadMessage = {
  id: string;
  name: string | null;
  text: string | null;
  photoUrl: string | null;
  locality: string | null;
  createdAt: string;
  href: string | null;
};

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

/**
 * Users' names are never shown in public (founder, 1 Nov 2026: "don't
 * show names of the users"). Every caller gets null and falls back to
 * a neutral label. The cleaning below is kept, unused, in case the
 * ruling changes; flip SHOW_USER_NAMES to bring names back.
 */
const SHOW_USER_NAMES = false;

/** First name, cleaned. Null when there is nothing human to show. */
export function publicFirstName(raw: string | null | undefined): string | null {
  if (!SHOW_USER_NAMES || !raw) return null;
  const cleaned = raw
    .replace(EMOJI, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
  if (!cleaned || /^private\s+number$/i.test(cleaned)) return null;
  const first = (cleaned.split(/\s+/)[0] ?? "").replace(/[^\p{L}\p{N}.]+$/u, "");
  if (!first || first.length > 22) return null;
  // Handles and initials ("verma.ji.18", "h2292001", "S.S") are not names.
  if (/[\p{N}._]/u.test(first) || first.length < 3) return null;
  return first;
}

/** Strip emoji and stray whitespace from a message line. */
function cleanLine(raw: string | null | undefined): string {
  return (raw ?? "").replace(EMOJI, "").replace(/\s+/g, " ").trim();
}

/** Captions written by the vision model when a photo arrived without
 *  words read like alt text ("A Bada Mangal bhandara serving food under
 *  an orange canopy"). Those are not the community's voice, so they are
 *  never presented as a person's message. */
function looksMachineWritten(text: string): boolean {
  if (/bada mangal bhandara/i.test(text) && text.length > 40) return true;
  if (/^(a|an|the|people|crowd|boondi|devotees|volunteers)\b/i.test(text) && text.length > 40) return true;
  return false;
}

function isHumanLine(text: string, min = 3, max = 90): boolean {
  if (text.length < min || text.length > max) return false;
  if (/https?:\/\//i.test(text) || text.includes("@") || /<phone>/i.test(text)) return false;
  if (/^shared a location/i.test(text)) return false;
  if (/^bhandara spotted$/i.test(text)) return false;
  return !looksMachineWritten(text);
}

/** A caption a person wrote (bot provenance already stripped), or null. */
export function humanCaption(raw: string | null | undefined): string | null {
  const t = cleanLine(raw);
  return isHumanLine(t) ? t : null;
}

/** Four real prints for the hero, newest first, one per spotter. */
export function pickHeroPrints(spots: SpotLike[], n = 4): HeroPrint[] {
  const out: HeroPrint[] = [];
  const seenNames = new Set<string>();
  const seenPhotos = new Set<string>();
  for (const s of spots) {
    if (!s.photoUrl || seenPhotos.has(s.photoUrl)) continue;
    const caption = cleanLine(s.caption);
    if (!isHumanLine(caption, 3, 70)) continue;
    let name = publicFirstName(s.reporterName);
    if (name && caption.toLowerCase().startsWith(name.toLowerCase()) && caption.split(" ").length > 2) {
      // The submitter typed the caption into the name field.
      name = null;
    }
    const nameKey = (name ?? "").toLowerCase();
    if (nameKey && seenNames.has(nameKey)) continue;
    if (nameKey) seenNames.add(nameKey);
    seenPhotos.add(s.photoUrl);
    const locality = cleanLine(s.area) || null;
    out.push({
      id: s.id,
      photoUrl: s.photoUrl,
      name,
      caption,
      // Locality only when the record has one, and never a repeat of the
      // caption itself.
      locality: locality && locality.toLowerCase() !== caption.toLowerCase() ? locality : null,
      href: s.bhandaraSlug ? `/bhandara/${s.bhandaraSlug}` : `/live#spot:${s.id}`,
    });
    if (out.length === n) break;
  }
  return out;
}

export type ChatterLike = {
  id: string;
  kind: "mention" | "spot";
  text: string;
  photoUrl: string | null;
  locationLabel: string | null;
  senderName: string | null;
  createdAt: string;
  bhandaraSlug: string | null;
  intent?: string | null;
};

/**
 * A short real thread that reads like the group on a Tuesday: up to
 * `maxPhotos` photo messages (a person's own words or a locality) and
 * `maxTexts` text lines (mostly people sharing where a bhandara is, one
 * person asking), each sender once, shown oldest first like a chat.
 */
export function buildThread(
  rows: ChatterLike[],
  opts: { maxPhotos?: number; maxTexts?: number; excludePhotos?: Set<string> } = {},
): ThreadMessage[] {
  const maxPhotos = opts.maxPhotos ?? 3;
  const maxTexts = opts.maxTexts ?? 4;
  const exclude = opts.excludePhotos ?? new Set<string>();
  const sorted = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const seenIds = new Set<string>();
  const senders = new Set<string>();
  const photos: ThreadMessage[] = [];
  const sharing: ThreadMessage[] = [];
  const asking: ThreadMessage[] = [];

  for (const r of sorted) {
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    const text = cleanLine(r.text);
    const name = publicFirstName(r.senderName);
    const key = (name ?? r.id).toLowerCase();
    const locality = cleanLine(r.locationLabel) || null;
    if (r.kind === "spot" && r.photoUrl) {
      if (photos.length >= maxPhotos || exclude.has(r.photoUrl) || senders.has(key)) continue;
      const hasText = isHumanLine(text, 2, 90);
      if (!hasText && !locality) continue;
      senders.add(key);
      photos.push({
        id: r.id,
        name,
        text: hasText && text.toLowerCase() !== (locality ?? "").toLowerCase() ? text : null,
        photoUrl: r.photoUrl,
        locality,
        createdAt: r.createdAt,
        href: r.bhandaraSlug ? `/bhandara/${r.bhandaraSlug}` : null,
      });
    } else if (r.kind === "mention") {
      if (!isHumanLine(text, 10, 64) || senders.has(key)) continue;
      const msg: ThreadMessage = {
        id: r.id,
        name,
        text,
        photoUrl: null,
        locality: null,
        createdAt: r.createdAt,
        href: null,
      };
      if (r.intent === "ASKING") {
        if (asking.length >= 1) continue;
        asking.push(msg);
      } else {
        if (sharing.length >= maxTexts - 1) continue;
        sharing.push(msg);
      }
      senders.add(key);
    }
  }
  return [...photos, ...sharing, ...asking].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}
