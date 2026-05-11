// Stage 2, text profanity / slur filter (instant, offline).
// Engine: `@2toad/profanity` for English coverage, plus our hand-curated
// Hindi + Hinglish + slur list from banned-terms.ts.

import { profanity } from "@2toad/profanity";
import { containsBannedTerm } from "./banned-terms";

export type ProfanityResult =
  | { ok: true }
  | { ok: false; reason: string; matched?: string };

export function profanityCheck(text: string | null | undefined): ProfanityResult {
  if (!text || text.trim().length === 0) return { ok: true };

  // 1) Hindi / slur list, single hit is enough.
  const local = containsBannedTerm(text);
  if (local.hit) {
    return { ok: false, reason: "banned_term", matched: local.term };
  }

  // 2) @2toad/profanity for English coverage.
  if (profanity.exists(text)) {
    return { ok: false, reason: "profanity" };
  }

  return { ok: true };
}
