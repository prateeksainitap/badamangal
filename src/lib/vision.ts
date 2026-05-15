/**
 * Vision helper. Sends an image + prompt to Google's Gemini 2.5 Flash,
 * receives JSON back, validates with Zod, returns a typed object.
 *
 * Used by:
 *   • /api/admin/scan      — admin "Scan & publish" flow
 *   • /api/bot/ingest      — silent WhatsApp ingestion via OpenClaw
 *
 * Why Gemini, not Claude:
 *   The site previously used `claude-sonnet-4-5` (via the Anthropic
 *   SDK). Gemini 2.5 Flash matches Claude on Devanagari + English
 *   poster OCR for our specific task — single image in, structured
 *   JSON out — and Google's AI Studio free tier (1,500 requests/day)
 *   covers our entire season with several orders of magnitude of head-
 *   room. No paid API credits to keep topped up; one less ops surface.
 *
 * Key reliability win vs the Claude code path: Gemini's `responseMime-
 * Type: "application/json"` produces clean JSON ~99% of the time, so
 * we rarely fall back to the `code-fence-strip` defensive parse. The
 * Zod check still validates before we trust the result.
 */
import { z } from "zod";
import { AREAS } from "@/lib/lucknow";
import { MENU_KEYS } from "@/lib/menu";

const AREA_VALUES = [...AREAS] as [string, ...string[]];
const MENU_VALUES = [...MENU_KEYS] as [string, ...string[]];

// Coerce a model-returned time value into our strict HH:MM or undefined.
// Gemini occasionally emits "" / "प्रभु इच्छा तक" / "until evening" /
// "evening" / null when no clean end time is on the banner. Anything we
// can't normalize into 24h HH:MM gets dropped to undefined so the rest
// of the row still saves.
function preprocessTime(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  // Already 24h HH:MM — happy path.
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  // Handle 1-digit hours: "9:00" → "09:00".
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) {
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (h >= 0 && h < 24 && mm >= 0 && mm < 60) {
      return `${String(h).padStart(2, "0")}:${m[2]}`;
    }
  }
  // Anything else (prose, "evening", empty, null) → drop.
  return undefined;
}

// Coerce menuOther into a string[]. Gemini sometimes ignores the schema
// instruction and emits a comma-joined string ("kheer, kachori") or even
// a single bare string ("kheer"). Split on commas / semicolons / Hindi
// danda and trim each entry. Anything that isn't an array or a string
// falls through to [].
function preprocessMenuOther(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (typeof v === "string") {
    return v
      .split(/[,;।]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  return [];
}

// Same idea for `menu` — model might hand back a string when it should
// be an enum array. Split, trim, drop entries that aren't in the curated
// enum (those usually belong to menuOther anyway, but we don't want a
// stray to fail the schema).
function preprocessMenu(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string");
  }
  if (typeof v === "string") {
    return v
      .split(/[,;।]/)
      .map((s) => s.trim())
      .filter((s) => (MENU_VALUES as readonly string[]).includes(s));
  }
  return [];
}

// Loose schema (vs the public submitSchema): all fields optional so the
// admin can review and fill gaps. Phone is a free string so the model
// can emit `"unknown"` without breaking the response.
//
// We coerce a handful of "model returned the wrong shape" cases via
// z.preprocess so a single bad field doesn't tank the entire extraction
// — the admin sees the rest of the data and can fill the gap from the
// photo themselves.
export const extractedBhandaraSchema = z.object({
  // Required-as-output, optional-as-input strings: `.default("")` covers
  // the case where the model omits the field entirely, while keeping
  // the inferred TS output type as `string` (not `string | undefined`).
  name: z.string().trim().default(""),
  nameHi: z.string().trim().default(""),
  description: z.string().trim().default(""),
  descriptionHi: z.string().trim().default(""),
  area: z.enum(AREA_VALUES).optional(),
  address: z.string().trim().default(""),
  addressHi: z.string().trim().default(""),
  landmark: z.string().trim().default(""),
  dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeStart: z.preprocess(preprocessTime, z.string().regex(/^\d{2}:\d{2}$/).optional()),
  timeEnd: z.preprocess(preprocessTime, z.string().regex(/^\d{2}:\d{2}$/).optional()),
  menu: z.preprocess(preprocessMenu, z.array(z.enum(MENU_VALUES)).default([])),
  menuOther: z.preprocess(
    preprocessMenuOther,
    z.array(z.string().trim().min(1).max(40)).default([]),
  ),
  organizerName: z.string().trim().default(""),
  organizerPhone: z.string().trim().default(""),
  /** Free-form notes the model wants to surface — anything it
   *  couldn't fit. */
  notes: z.string().trim().default(""),
});
export type ExtractedBhandara = z.infer<typeof extractedBhandaraSchema>;

export const extractedSpotSchema = z.object({
  caption: z.string().trim().max(200).default(""),
  captionHi: z.string().trim().max(200).default(""),
  area: z.enum(AREA_VALUES).optional(),
  address: z.string().trim().max(200).default(""),
  language: z.enum(["hi", "en", "mixed"]).default("en"),
  notes: z.string().trim().default(""),
});
export type ExtractedSpot = z.infer<typeof extractedSpotSchema>;

const AREA_LIST = AREAS.join(", ");
const MENU_LIST = MENU_KEYS.join(", ");

const BHANDARA_PROMPT = `You are reading a Bada Mangal bhandara invite from Lucknow, India. It will usually be in Hindi (Devanagari), occasionally English/Hindi mixed. Output ONE JSON object only — no markdown, no commentary, no code fence.

Fields (all optional — emit "" or omit if unsure, never invent):
{
  "name":         English name of the bhandara (e.g. "Shrivastav Pariwar Bhandara"). Translate/transliterate the Hindi banner into a clean English title. Keep it under 60 chars.
  "nameHi":       Hindi name, Devanagari. Mirror the banner style (e.g. "श्रीवास्तव परिवार भंडारा").
  "description":  ONE short English sentence summarising the event (e.g. "Sundarkand Path from 9 AM, Vishal Bhandara from 12 PM at Hanuman Mandir, Talkatora").
  "descriptionHi":ONE short Hindi sentence summarising the event.
  "area":         Must be EXACTLY one of: ${AREA_LIST}. Pick the closest match from the banner's address/landmark. Omit if you can't infer confidently.
  "address":      Full English address as written, including landmark + locality + Lucknow.
  "addressHi":    Same address in Hindi (Devanagari) — translate proper nouns only when the banner shows them in Hindi.
  "landmark":     One landmark phrase if explicitly mentioned (e.g. "Near Civil Hospital"). Otherwise "".
  "dateIso":      YYYY-MM-DD. Resolve Hindi/English dates to ISO. The 2026 Bada Mangal Tuesdays are 2026-05-05, 2026-05-12, 2026-05-19, 2026-05-26, 2026-06-02, 2026-06-09, 2026-06-16, 2026-06-23. Shani Jayanti is 2026-05-16 (Saturday). If only "मंगलवार" / "Tuesday" is given without a date, leave this empty.
  "timeStart":    24h HH:MM (e.g. "09:00", "12:00", "18:30"). Convert "11 बजे से" → "11:00", "दोपहर 2 बजे" → "14:00".
  "timeEnd":      24h HH:MM if a clear end time is given. "प्रभु इच्छा तक" / "until Prabhu Iccha" → leave empty.
  "menu":         An array picked from EXACTLY these keys: ${MENU_LIST}. Use "prasad" as a generic catch-all if the banner only says "भंडारा" without specifying items. Keep array length ≤ 6.
  "menuOther":    Free-form items the banner mentions but aren't in the list above (e.g. "kheer", "kachori"). English, lowercase. Optional.
  "organizerName":Best guess at the host name. The Hindi word "आयोजक" / "द्वारा" precedes it. e.g. "Hind Nagar Vyapar Mandal", "Shrivastav Pariwar". If only "समस्त भक्तगण" / "all devotees" is given, emit "Samast Bhakta Gan".
  "organizerPhone":Phone number if printed on the banner. Indian mobile (10 digits, optional +91). Omit if absent.
  "notes":        Anything important the schema didn't capture — e.g. "Sundarkand at 9 AM separately", "Free parking near Gate 3". Keep under 200 chars.
}

Be conservative: when in doubt, leave the field empty. Do not paste the model's reasoning into "notes" — only invite-relevant info that the admin should see.`;

const SPOT_PROMPT = `You are reading a photo someone snapped of a live Bada Mangal bhandara in Lucknow. The photo may show a banner, a serving counter, a crowd, or just food. Extract a brief caption and any visible location hints.

Output ONE JSON object — no markdown, no prose. Fields:
{
  "caption":    1 short English line describing what's happening (≤ 100 chars). e.g. "Puri-sabzi being served outside a saffron-draped pandal."
  "captionHi":  Same sentence in Hindi, ≤ 100 chars.
  "area":       One of: ${AREA_LIST}. Only if the banner / signboard / shop in the photo names a specific Lucknow locality. Else omit.
  "address":    Any visible address text on banners or signs. ≤ 120 chars. Else "".
  "language":   "hi" if the photo's banner is primarily Hindi, "en" if primarily English, "mixed" otherwise. Default "en".
  "notes":      Anything else worth surfacing to the admin (organizer name on banner, etc). ≤ 120 chars.
}`;

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * POST the image + prompt to Gemini, return the trimmed JSON string.
 * Throws on any non-2xx, missing key, or empty response so callers can
 * surface a clean 502 to the admin UI.
 */
async function callGeminiVision(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  prompt: string,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const resp = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            // Gemini accepts the inline base64 image as a `inline_data`
            // part. Same convention as the Anthropic call we replaced.
            { inline_data: { mime_type: mediaType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        // 4096 not 1200: Gemini in JSON mode writes a touch more
        // whitespace than Claude did, plus Devanagari description
        // strings run ~2x the token count of their English glosses.
        // The previous 1200 cap (carried over from the Claude config)
        // truncated mid-string on banner-heavy invites — the parser
        // then threw "Model returned non-JSON". 4096 covers every
        // real-world invite we've tested. Cost diff is negligible
        // (output tokens are paid only at $0.0003/1k anyway, and we
        // rarely exceed ~800 even with the cap raised).
        maxOutputTokens: 4096,
        // Native JSON mode — Gemini will (almost always) return a clean
        // JSON document without code fences or commentary. Still
        // defensive-parsed below.
        responseMimeType: "application/json",
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(
      `Gemini API error ${resp.status}: ${errText.slice(0, 300)}`,
    );
  }

  const data = (await resp.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini blocked the request: ${data.promptFeedback.blockReason}`,
    );
  }

  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const text =
    candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  // `finishReason: "MAX_TOKENS"` means the model was cut off mid-output.
  // Bubble that up clearly so future "Model returned non-JSON" failures
  // tell us exactly what to fix (bump maxOutputTokens above).
  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "Gemini hit the maxOutputTokens cap before finishing — increase the cap in src/lib/vision.ts (callGeminiVision generationConfig).",
    );
  }

  // Belt-and-suspenders: the model occasionally wraps in ```json…``` even
  // with responseMimeType set. Strip a single fence pair if present.
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseOrThrow<S extends z.ZodTypeAny>(
  raw: string,
  schema: S,
): z.infer<S> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Model returned non-JSON: ${raw.slice(0, 200)}`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Model JSON failed validation: ${JSON.stringify(result.error.flatten())}`,
    );
  }
  return result.data;
}

export async function extractBhandaraFromImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<ExtractedBhandara> {
  const raw = await callGeminiVision(imageBase64, mediaType, BHANDARA_PROMPT);
  return parseOrThrow(raw, extractedBhandaraSchema);
}

export async function extractSpotFromImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<ExtractedSpot> {
  const raw = await callGeminiVision(imageBase64, mediaType, SPOT_PROMPT);
  return parseOrThrow(raw, extractedSpotSchema);
}
