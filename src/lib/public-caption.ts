/**
 * Which photo captions may be shown as visible text on a public page.
 * Pure module (no server imports) so client components can use it.
 *
 * Founder's rules (1 Nov 2026):
 *  - AI vision captions (Gemini's one line description, used when a
 *    WhatsApp forward came without the sender's own words) are never
 *    shown on a public photo. They may stay as image alt text.
 *  - Political party names and politicians never appear in a curated
 *    selection.
 *
 * The stored caption does not say who wrote it, so AI captions are
 * recognised by their shape: one tidy English sentence in the third
 * person ("People serving puri and sabzi at a Bada Mangal bhandara in
 * Lucknow."). People typing on a phone rarely write like that.
 */

const POLITICAL_RE =
  /\b(bjp|congress|samajwadi|bsp|mla|mlc|mp|minister|mantri|vidhayak|saansad|sansad|parshad|corporator|councillor|party)\b|भाजपा|कांग्रेस|समाजवादी|पार्टी|विधायक|सांसद|मंत्री|पार्षद/i;

/** True when the text names a party or an office holder. */
export function isPoliticalText(s: string | null | undefined): boolean {
  return !!s && POLITICAL_RE.test(s);
}

const AI_START_RE =
  /^(a|an|the|people|devotees|volunteers|men|women|children|several|many|two|three|large|crowd|food|puri|boondi|halwa|a group)\b/i;

/** True when a (bot tag stripped) caption reads like an AI vision line. */
export function looksLikeAiCaption(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim();
  if (/[ऀ-ॿ]/.test(t)) return false;
  const words = t.split(/\s+/).length;
  return words >= 7 && /\.$/.test(t) && AI_START_RE.test(t);
}

/** The caption to show as visible text, or null to show none. */
export function publicCaption(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t || looksLikeAiCaption(t) || isPoliticalText(t)) return null;
  return t;
}

/**
 * Photos that never appear on a public surface (gallery, archive, the
 * live page's last season strip, the homepage season gallery and hero
 * prints). Founder's rule: no politician pamphlets in public galleries.
 * A code level list, so the database is never written; the admin keeps
 * every row. Key a whole spot by its id, or one photo by its URL when
 * the same spot also carries clean photos. Checked by eye on 2 Nov 2026
 * across the 368 photos on /gallery.
 */
export const HIDDEN_PUBLIC_SPOT_IDS: ReadonlySet<string> = new Set([
  "cmqqjhtai000kenbjczgqc6uf", // 23 Jun 2026: Shivpal Singh Yadav, Samajwadi Party
  "cmqqjhnmf000henbj0h6ojhy2", // 23 Jun 2026: Akhilesh Yadav and an SP MLA, party logo
  "cmqqjhmf1000genbjm2amatzo", // 23 Jun 2026: BJP logo, party leaders, an MLC
  "cmqqjhblu000cenbjplb9bb33", // 23 Jun 2026: politician's constituency office invite
  "cmq69jec700006sa1hybkjxzw", // 9 Jun 2026: BJP Yuva Morcha office bearer
  "cmq65tl3c0001m7bpawivwbog", // 9 Jun 2026: Akhilesh Yadav party poster on a pole
  // Not a bhandara (Founder, 2 Nov 2026: off-season photos stay only
  // when they show a bhandara):
  "cmtlxa4lj000153kavar68tn1", // 3 Sep 2026: a visitor posing at a Hanuman temple
  "cmu9iu91m0001r82gt9dnxtyr", // 20 Sep 2026: Ganesh pandal with children
]);

export const HIDDEN_PUBLIC_PHOTO_URLS: ReadonlySet<string> = new Set([
  // 23 Jun 2026: assembly candidate's pamphlet (third photo of a spot
  // whose other two photos are fine).
  "https://cdn.badamangal.com/bot-spot-71172e2a-de9b-4fd4-9ccb-5ed0ff38da0f.webp",
]);

/** True when this photo (or its whole spot) must stay off public pages. */
export function isHiddenPublicPhoto(spotId: string | null | undefined, url?: string | null): boolean {
  if (spotId && HIDDEN_PUBLIC_SPOT_IDS.has(spotId)) return true;
  return !!url && HIDDEN_PUBLIC_PHOTO_URLS.has(url);
}
