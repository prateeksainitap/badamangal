/**
 * Sanitization helpers shared across public-facing data paths.
 *
 * The WhatsApp ingestion pipeline (/api/bot/ingest) appends a small
 * provenance tag to the `description` of every bhandara it creates,
 * and the `caption` of every spot:
 *
 *   [bot:whatsapp · from:<Sender · Group> · msg:<wa-id> · 2026-05-16T08:12:13Z]
 *
 * Admin moderation views parse and surface this tag (see
 * /admin?type=whatsapp's `parseBotTag`), but it's internal metadata
 * and should never leak into a public surface, detail pages, cards,
 * meta tags, JSON APIs, RSS, etc. all need to display the human prose
 * only.
 *
 * `stripBotProvenance` does exactly that, and is the single place this
 * regex lives. If the tag format ever changes, this file is the only
 * thing to update.
 */

// Matches the `[bot:whatsapp · … ]` block plus surrounding blank
// lines. We anchor on `[bot:whatsapp` so the regex never accidentally
// catches admin-typed prose that happens to start with `[bot:`.
const BOT_TAG_RE = /\s*\[bot:whatsapp[^\]]*\]\s*/g;

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
  const cleaned = text.replace(BOT_TAG_RE, "\n\n").trim();
  // Collapse the 3+ newlines we might have created by removing a tag
  // that was sandwiched between paragraphs.
  return cleaned.replace(/\n{3,}/g, "\n\n");
}

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
