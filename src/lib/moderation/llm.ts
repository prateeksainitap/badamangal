// Stage 3, text LLM moderation via Anthropic Haiku.
// Per spec §3 Stage 3.
//
// Behaviour:
//   - If ANTHROPIC_API_KEY is unset, we return `ok: true` with `skipped: true`
//     (the chain still runs, the LLM stage just doesn't gatekeep). This lets
//     us ship without an API key and turn it on later.
//   - 7-day in-memory cache keyed by SHA-256 of the trimmed lowercased input.

import { createHash } from "node:crypto";

const MODEL = "claude-haiku-4-5-20251001";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

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

export async function llmCheck(text: string | null | undefined): Promise<LlmResult> {
  if (!text || text.trim().length === 0) return { ok: true, skipped: true };
  const key = process.env.ANTHROPIC_API_KEY;
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
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) {
      // On API error, fail open (approve). Spec doesn't mandate fail-closed,
      // and we still have Stage 2 catching obvious bad content.
      return { ok: true, skipped: true };
    }
    const data = await res.json() as {
      content?: { type: string; text?: string }[];
    };
    const block = data.content?.find((c) => c.type === "text");
    const raw = block?.text ?? "";
    decision = parseDecision(raw);
  } catch {
    return { ok: true, skipped: true };
  }

  cacheSet(cacheKey, decision);
  return decision.action === "approve"
    ? { ok: true, category: decision.category }
    : { ok: false, reason: "llm_reject", category: decision.category };
}

function parseDecision(raw: string): Decision {
  // Tolerate stray prose around the JSON.
  const match = raw.match(/\{[^}]*\}/);
  if (!match) return { action: "approve", category: null };
  try {
    const obj = JSON.parse(match[0]) as { action?: string; category?: string | null };
    return {
      action: obj.action === "reject" ? "reject" : "approve",
      category: obj.category ?? null,
    };
  } catch {
    return { action: "approve", category: null };
  }
}
