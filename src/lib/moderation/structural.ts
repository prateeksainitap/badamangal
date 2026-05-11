// Stage 1, instant structural checks. No network, no AI.
// Per spec §3 Stage 1.

const URL_RE = /https?:\/\/\S+|www\.\S+|t\.me\/\S+|wa\.me\/\S+|instagram\.com\/\S+|telegram\.me\/\S+/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /(?:\+?\d[\d\s\-]{6,15}\d)/;

// Whitelist for any URL we DO allow (none for now besides ourselves).
const URL_WHITELIST = [/badamangal\.com/i];

const EMOJI_RE =
  /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Component}/gu;

export type StructuralResult =
  | { ok: true }
  | { ok: false; reason: string };

export function structuralCheck(text: string | null | undefined): StructuralResult {
  if (!text || text.trim().length === 0) return { ok: true };
  const t = text.trim();

  if (t.length < 5) return { ok: false, reason: "too_short" };
  if (t.length > 500) return { ok: false, reason: "too_long" };

  // Strip allowed URLs first, then check for any leftover URLs.
  let stripped = t;
  for (const allow of URL_WHITELIST) {
    stripped = stripped.replace(allow, "");
  }
  if (URL_RE.test(stripped)) return { ok: false, reason: "contains_url" };

  if (EMAIL_RE.test(t)) return { ok: false, reason: "contains_email" };

  // A phone number embedded in chat is almost always promo/spam in this context.
  // Allow plain digit strings (e.g. "12,000 plates") by checking the regex.
  if (PHONE_RE.test(t.replace(/\d{1,3},\d{3,}/g, ""))) {
    return { ok: false, reason: "contains_phone" };
  }

  // Cap emoji count.
  const emojis = t.match(EMOJI_RE);
  if (emojis && emojis.length > 3) return { ok: false, reason: "too_many_emoji" };

  return { ok: true };
}
