// Stage 3, text LLM moderation via Google Gemini 2.5 Flash.
// Per spec §3 Stage 3.
//
// Behaviour:
//   - If GEMINI_API_KEY is unset, we return `ok: true` with `skipped: true`
//     (the chain still runs, the LLM stage just doesn't gatekeep). This
//     lets us ship without an API key and turn it on later.
//   - 7-day in-memory cache keyed by SHA-256 of the trimmed lowercased
//     input — Gemini's free tier is generous but we don't pay for cache
//     hits either, and the latency win on duplicates is real.
//   - Migrated from Claude Haiku → Gemini 2.5 Flash in May 2026 alongside
//     the vision pipeline. Same prompt, same JSON contract, same fail-
//     open behaviour on errors.

import { createHash } from "node:crypto";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a moderator for an inclusive Hindu festival website (Bada Mangal in Lucknow). The site is multi-faith, protect that. Reject content that contains:
- Hate, slurs, or harassment of any community (Hindu, Muslim, Sikh, Christian, caste, gender, region)
- Sexual content
- Threats or incitement
- Spam, promotion of unrelated services
- Instructions to break laws

Approve content that is devotional, joyful, kind, factual, or constructive, even if it expresses strong devotion.

Respond ONLY in JSON: {"action": "approve" | "reject", "category": "<short reason if reject, else null>"}.`;

type Decision = { action: "approve" | "reject"; category: string | null };

type CacheEntry = { decision: Decision; expiresAt: number };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashKey(text: string): string {
  return createHash("sha256")
    .update(text.trim().toLowerCase())
    .digest("hex");
}

function cacheGet(key: string): Decision | null {
  const e = CACHE.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    CACHE.delete(key);
    return null;
  }
  return e.decision;
}

function cacheSet(key: string, decision: Decision) {
  CACHE.set(key, { decision, expiresAt: Date.now() + CACHE_TTL_MS });
}

export type LlmResult =
  | { ok: true; skipped?: boolean; category?: string | null }
  | { ok: false; reason: string; category?: string | null };

export async function llmCheck(
  text: string | null | undefined,
): Promise<LlmResult> {
  if (!text || text.trim().length === 0) return { ok: true, skipped: true };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: true, skipped: true };

  const cacheKey = hashKey(text);
  const cached = cacheGet(cacheKey);
  if (cached) {
    return cached.action === "approve"
      ? { ok: true, category: cached.category }
      : { ok: false, reason: "llm_reject", category: cached.category };
  }

  const userMessage = `Comment:\n"""\n${text}\n"""`;

  let decision: Decision;
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        // System prompt rides on Gemini's `systemInstruction` field —
        // analogous to the `system:` argument we used on Claude.
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 200,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) {
      // On API error, fail open (approve). Spec doesn't mandate fail-
      // closed and we still have Stage 2 catching obvious bad content.
      return { ok: true, skipped: true };
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };
    // Gemini's safety filters may block the prompt entirely. When that
    // happens we get a `promptFeedback.blockReason` and no candidates.
    // Treat as a "reject" — Gemini already concluded the content is
    // unsafe, so respect that decision rather than fail-open.
    if (data.promptFeedback?.blockReason) {
      decision = {
        action: "reject",
        category: `gemini_safety:${data.promptFeedback.blockReason}`,
      };
    } else {
      const raw =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
        "";
      decision = parseDecision(raw);
    }
  } catch {
    return { ok: true, skipped: true };
  }

  cacheSet(cacheKey, decision);
  return decision.action === "approve"
    ? { ok: true, category: decision.category }
    : { ok: false, reason: "llm_reject", category: decision.category };
}

function parseDecision(raw: string): Decision {
  // Gemini's JSON mode rarely wraps in fences, but tolerate stray prose
  // around the JSON anyway — cheaper than a retry.
  const match = raw.match(/\{[^}]*\}/);
  if (!match) return { action: "approve", category: null };
  try {
    const obj = JSON.parse(match[0]) as {
      action?: string;
      category?: string | null;
    };
    return {
      action: obj.action === "reject" ? "reject" : "approve",
      category: obj.category ?? null,
    };
  } catch {
    return { action: "approve", category: null };
  }
}
