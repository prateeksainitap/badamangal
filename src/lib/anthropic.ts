/**
 * Claude (Anthropic) vision helper. Used by the admin scan endpoint to
 * turn a WhatsApp invite image into structured bhandara data, and to
 * pull caption + area out of a spot photo.
 *
 * We deliberately ask Claude to output ONLY a JSON object (no prose, no
 * markdown fence). The SDK's response is still validated with Zod
 * before we trust it — model outputs occasionally include a stray
 * field or wrong casing.
 *
 * Cost: vision call to claude-sonnet-4-5 lands at roughly 0.5-1¢ per
 * image at this resolution, negligible at admin volumes.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AREAS } from "@/lib/lucknow";
import { MENU_KEYS } from "@/lib/menu";

let cached: Anthropic | null | undefined;

function client(): Anthropic | null {
  if (cached !== undefined) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    cached = null;
    return null;
  }
  cached = new Anthropic({ apiKey: key });
  return cached;
}

const AREA_VALUES = [...AREAS] as [string, ...string[]];
const MENU_VALUES = [...MENU_KEYS] as [string, ...string[]];

// Loose schema (vs the public submitSchema): all fields optional so the
// admin can review and fill gaps. Phone is a free string so model can
// emit `"unknown"` without breaking the response.
export const extractedBhandaraSchema = z.object({
  // Required-as-output, optional-as-input strings: `.default("")` covers
  // the case where Claude omits the field entirely, while keeping the
  // inferred TS output type as `string` (not `string | undefined`).
  name: z.string().trim().default(""),
  nameHi: z.string().trim().default(""),
  description: z.string().trim().default(""),
  descriptionHi: z.string().trim().default(""),
  area: z.enum(AREA_VALUES).optional(),
  address: z.string().trim().default(""),
  addressHi: z.string().trim().default(""),
  landmark: z.string().trim().default(""),
  dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timeEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  menu: z.array(z.enum(MENU_VALUES)).default([]),
  menuOther: z.array(z.string().trim().min(1).max(40)).default([]),
  organizerName: z.string().trim().default(""),
  organizerPhone: z.string().trim().default(""),
  /** Free-form notes the model wants to surface — anything it couldn't fit. */
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

/**
 * Send an image to Claude vision and return the raw JSON text. We let
 * each caller parse + Zod-validate with the schema it owns — keeps the
 * type inference clean (generic over a `z.ZodSchema<T>` was getting
 * confused between the schema's input vs output types).
 *
 * Throws if the API key is missing or the call fails — callers should
 * map those to 4xx/5xx responses.
 */
async function callClaudeVision(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  prompt: string,
): Promise<string> {
  const c = client();
  if (!c) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const resp = await c.messages.create({
    // Sonnet-4-5 is the current vision-capable production model.
    // If it gets deprecated, the call site swap is one string.
    model: "claude-sonnet-4-5",
    max_tokens: 1200,
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // Be forgiving: the model occasionally wraps in ```json … ``` despite
  // the instruction. Strip a single fence pair if present.
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
  const raw = await callClaudeVision(imageBase64, mediaType, BHANDARA_PROMPT);
  return parseOrThrow(raw, extractedBhandaraSchema);
}

export async function extractSpotFromImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<ExtractedSpot> {
  const raw = await callClaudeVision(imageBase64, mediaType, SPOT_PROMPT);
  return parseOrThrow(raw, extractedSpotSchema);
}
