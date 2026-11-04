/**
 * Sanitization helpers shared across public-facing data paths.
 *
 * Several internal pipelines append a small provenance tag to the
 * `description` of bhandaras and the `caption` of spots:
 *
 *   [bot:whatsapp · from:<Sender · Group> · msg:<wa-id> · …]
 *   [bot:merged-from-dup · id:<row-id> · status:APPROVED · created:…]
 *   [bot:scan · session:<id> · …]
 *
 * Admin moderation views parse and surface these tags (see
 * /admin?type=whatsapp's `parseBotTag`), but they're internal
 * metadata and should never leak into a public surface, detail pages,
 * cards, meta tags, JSON APIs, RSS, etc. all need to display the
 * human prose only.
 *
 * `stripBotProvenance` does exactly that, and is the single place
 * these regexes live. If a new tag kind shows up, it'll match here
 * automatically (any `[bot:<word>…]`).
 */

// Matches any `[bot:<kind> · … ]` block (whatsapp, merged-from-dup,
// scan, future variants) plus surrounding blank lines. The kind must
// start with an ASCII letter so the regex never accidentally catches
// admin-typed prose like "[bot: please review]".
const BOT_TAG_RE = /\s*\[bot:[a-zA-Z][^\]]*\]\s*/g;

/**
 * Remove every `[bot:whatsapp …]` provenance tag from a string and
 * tidy the resulting whitespace.
 *
 * Returns:
 *   - undefined when the input is null/undefined (callers can spread
 *     the result into an optional field cleanly)
 *   - the cleaned string otherwise (may be empty if the only content
 *     was the tag itself, common for spots where the model didn't
 *     extract a caption)
 *
 * Performance: this is called once per row during server render. The
 * regex is anchored + non-greedy so it scans linearly; even a 4 KB
 * description sanitises in well under 100 µs.
 */
export function stripBotProvenance(
  text: string | null | undefined,
): string | undefined {
  if (text === null || text === undefined) return undefined;
  const cleaned = text
    .replace(BOT_TAG_RE, "\n\n")
    .split(/\n\s*\n/)
    // Admin notes typed into the description while fixing bot rows, e.g.
    // "Source: Image 2 of <member>'s 9:09 AM forward in <group>. Originally
    // deduped against …". They name WhatsApp members, so never public.
    .filter((para) => !SOURCE_NOTE_RE.test(para.trim()))
    .join("\n\n")
    .trim();
  // Collapse the 3+ newlines we might have created by removing a tag
  // that was sandwiched between paragraphs.
  return cleaned.replace(/\n{3,}/g, "\n\n");
}

// Same Indian mobile shape as db.ts PHONE_IN_TEXT (10 digits starting
// 6 to 9, optional +91 or 0, spaces or hyphens allowed between digits).
const PHONE_RE = /(?<![\w+])(?:\+?91[\s-]?|0)?[6-9](?:[\s-]?\d){9}(?!\d)/g;
const hasPhone = (s: string) => new RegExp(PHONE_RE.source).test(s);

/** Remove phone numbers from a short field (name, address, menu item). */
export function redactPhones(text: string): string {
  if (!text || !hasPhone(text)) return text;
  return text
    .replace(PHONE_RE, "")
    .replace(/\s*[,;:]\s*(?=[,;:]|$)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Drop every sentence that carries a phone number from free prose, so
 *  "If anyone wants to donate, reach 98xxxxxxxx on WhatsApp" goes away
 *  whole instead of leaving a broken sentence behind. */
export function dropPhoneSentences(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  if (!hasPhone(text)) return text;
  const out = text
    .split(/\n/)
    .map((line) =>
      line
        .split(/(?<=[.!?।])\s+/)
        .filter((sentence) => !hasPhone(sentence))
        .join(" ")
        .trim(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out || null;
}

/**
 * Copy of a bhandara row with every typed-in phone number removed from the
 * text a visitor can read: name, address, landmark, organiser name, menu,
 * description. For the public bhandara page only (Founder, 4 Nov 2026: no
 * organiser phones in public, on the bhandara's own page too). Never use it
 * on admin reads: the edit form would save the stripped text back.
 */
export function withoutPublicPhones<
  T extends {
    name: string;
    nameHi?: string | null;
    description?: string | null;
    descriptionHi?: string | null;
    address: string;
    addressHi?: string | null;
    landmark?: string | null;
    organizerName: string;
    menu?: string | null;
    menuHi?: string | null;
  },
>(record: T): T {
  const menu = (raw: string | null | undefined) => {
    if (!raw || !hasPhone(raw)) return raw;
    try {
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) return raw;
      return JSON.stringify(
        items.map((i) => (typeof i === "string" ? redactPhones(i) : i)).filter((i) => i !== ""),
      );
    } catch {
      return redactPhones(raw);
    }
  };
  const opt = (s: string | null | undefined) => (s ? redactPhones(s) || null : s);
  return {
    ...record,
    name: redactPhones(record.name),
    nameHi: opt(record.nameHi),
    description: dropPhoneSentences(record.description),
    descriptionHi: dropPhoneSentences(record.descriptionHi),
    address: redactPhones(record.address),
    addressHi: opt(record.addressHi),
    landmark: opt(record.landmark),
    organizerName: redactPhones(record.organizerName),
    menu: menu(record.menu),
    menuHi: menu(record.menuHi),
  };
}

const SOURCE_NOTE_RE = /^source:\s[\s\S]*\b(forward|forwarded|dedup|deduped|image \d|bot)\b/i;

/**
 * Pull the `in:<groupName>` fragment out of a `[bot:…]` provenance
 * tag. Returns the WhatsApp group / channel name the bot saw on the
 * forwarded message, or null when the tag is missing the field
 * (older rows ingested before `groupName` was wired through, or
 * forwards from a personal DM where chat.name is empty).
 *
 * Used by BhandaraRow + SpotRow to surface the source channel on
 * each moderation card without re-querying BotIngestionLog. The
 * tag fragment looks like:
 *   [bot:whatsapp · from:Prateek · in:Jai Sri Ram · msg:… · …]
 * Group names can contain spaces; the `·` separator is the
 * non-overlapping boundary.
 */
export function parseBotGroupName(
  text: string | null | undefined,
): string | null {
  if (!text) return null;
  // Scope the search to inside the [bot:…] tag so we never pick up
  // an "in:" fragment that happens to live in admin-typed prose.
  const tagMatch = /\[bot:[^\]]*\]/.exec(text);
  if (!tagMatch) return null;
  // Within the tag, find ` · in:<groupName> · ` (or end-of-tag).
  // Group name continues until the next ` · ` or the closing `]`.
  const inMatch = / · in:([^·\]]+?)(?= · |\])/.exec(tagMatch[0]);
  if (!inMatch) return null;
  const name = inMatch[1].trim();
  return name.length > 0 ? name : null;
}
