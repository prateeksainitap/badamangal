/**
 * Profanity gate for the public LiveChatterBoard pipeline.
 *
 * Wraps @2toad/profanity (English defaults) with a curated list of
 * Romanised Hindi / Hinglish profanity transliterations. The library's
 * English wordlist on its own misses everything our WhatsApp groups
 * actually produce, Lucknow chats are bilingual and the offensive
 * stuff is almost entirely Romanised Hindi.
 *
 * Policy: STRICT. Bhandara is a religious / community gathering and
 * the homepage's "what Lucknow is saying" surface is family-facing.
 * False-positive cost (filtering a borderline word like "saala" that
 * some users use affectionately) is low, the mention just doesn't
 * appear publicly; admin can re-approve from /admin/mentions if needed.
 * False-negative cost (a slur leaking to the homepage) is high.
 * Better to over-filter and let admin override than to under-filter.
 *
 * Spelling variants matter: WhatsApp users romanise differently and
 * often add letters for emphasis ("bhenchooooooooood"). The library
 * matches whole words; we add the common variants explicitly and rely
 * on the library's substring-boundary handling for the rest.
 */

import { Profanity, CensorType } from "@2toad/profanity";

/** Romanised Hindi / Hinglish profanity. Each entry has its common
 *  spelling variants so the matcher catches "bahanchod" / "bhenchod" /
 *  "behenchod" without us having to enumerate every regex permutation.
 *
 *  Curated conservatively: kept to words that are unambiguously
 *  profanity in chat context, even when they're used "casually".
 *  Mild address words like "yaar", "bhai", "dost" are NOT here
 *  those are neutral. */
const HINGLISH_PROFANITY = [
  // Sister/mother-f variants
  "bahanchod", "behanchod", "bhenchod", "bhainchod", "behenchod", "bhsdk", "bsdk",
  "madarchod", "maderchod", "mc", "mc.", "ma chod",
  // Sex worker / female anatomy insults
  "randi", "rand", "rendi", "raand",
  "chut", "chutiya", "chutiye", "chutia", "chootiya",
  "bhosadi", "bhosdi", "bhosdike", "bhosadika", "bhosdiwala",
  // Male anatomy / penis insults
  "lund", "lawda", "lawde", "laude", "loda", "lode", "land",
  "gaand", "gand", "gandu", "gaandu",
  // Bestiality / animal insults used in profane context
  "suar", "suer", "suarwala", "kutta", "kuttiya", "kutte",
  // Composite "mother-of-X" / "sister-of-X" insults, substring-match
  // catches "maa ki", "behen ki", "teri maa" patterns once the user
  // types the full phrase. We list the head words; library handles
  // the boundary.
  "harami", "haraami", "haramzada", "haramzade",
  "saala", "saale", "saaley", "sala",
  // Generic vulgarities
  "fck", "fuk", "fuq",
];

/** Shared singleton, instantiating Profanity reloads + compiles the
 *  regex blacklist, which is non-trivial. Reuse one instance across
 *  every request. */
const profanity = new Profanity({
  // Word-boundary detection is what we want; the library's default.
  // English is on by default; we add Hinglish on top.
  wholeWord: true,
});
profanity.addWords(HINGLISH_PROFANITY);

/** True if the input contains any blacklisted English or Hinglish
 *  profanity. Whole-word match, "classic" doesn't trip on "ass". */
export function hasProfanity(text: string): boolean {
  return profanity.exists(text);
}

/** Replace profane words with asterisks. Used when we want to keep
 *  the surrounding context (e.g., admin-only view that needs to see
 *  what was filtered for tuning) instead of dropping the whole message.
 *  Public path uses hasProfanity → reject, not censor. */
export function censorProfanity(text: string): string {
  return profanity.censor(text, CensorType.Word);
}

/** Helper for callers that want a single boolean + a reason string.
 *  Returns { ok: true } on clean text, or { ok: false, reason }
 *  describing why it was rejected. Reasons are kept stable so the
 *  bot/log + admin queue can group + report on them later. */
export function checkProfanity(
  text: string,
): { ok: true } | { ok: false; reason: "profanity" } {
  return hasProfanity(text) ? { ok: false, reason: "profanity" } : { ok: true };
}
