// Moderation pipeline used by /api/spots (and previously /api/posts,
// now removed). Composes the four content-quality stages into a single
// entry point. Stage 5 (phone-keyed rate-limit + dedup) was specific
// to Posts and has been removed along with the Post model.

import { structuralCheck } from "./structural";
import { profanityCheck } from "./profanity";
import { llmCheck } from "./llm";
import { imageCheck } from "./image";

export type ModerationDecision = {
  approved: boolean;
  reason?: string;
  signals: Record<string, unknown>;
};

export async function runModeration(input: {
  text: string | null | undefined;
  photoUrl: string | null | undefined;
  phoneHash: string;
  ipHash: string;
}): Promise<ModerationDecision> {
  const signals: Record<string, unknown> = {};

  // Stage 1, structural
  const s1 = structuralCheck(input.text);
  signals.structural = s1;
  if (!s1.ok) {
    return { approved: false, reason: `s1:${s1.reason}`, signals };
  }

  // Stage 2, profanity / slur dictionary
  const s2 = profanityCheck(input.text);
  signals.profanity = s2;
  if (!s2.ok) {
    return { approved: false, reason: `s2:${s2.reason}`, signals };
  }

  // Stage 3, LLM moderation (Gemini 2.5 Flash)
  const s3 = await llmCheck(input.text);
  signals.llm = s3;
  if (!s3.ok) {
    return { approved: false, reason: `s3:${s3.reason}`, signals };
  }

  // Stage 4, image classifier
  const s4 = await imageCheck(input.photoUrl);
  signals.image = s4;
  if (!s4.ok) {
    return { approved: false, reason: `s4:${s4.reason}`, signals };
  }

  return { approved: true, signals };
}
