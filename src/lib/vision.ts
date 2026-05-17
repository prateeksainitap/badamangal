/**
 * Vision helper. Sends an image + prompt to Google's Gemini 2.5 Flash,
 * receives JSON back, validates with Zod, returns a typed object.
 *
 * Used by:
 *   • /api/admin/scan     , admin "Scan & publish" flow
 *   • /api/bot/ingest     , silent WhatsApp ingestion via OpenClaw
 *
 * Why Gemini, not Claude:
 *   The site previously used `claude-sonnet-4-5` (via the Anthropic
 *   SDK). Gemini 2.5 Flash matches Claude on Devanagari + English
 *   poster OCR for our specific task, single image in, structured
 *   JSON out, and Google's AI Studio free tier (1,500 requests/day)
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
  // Already 24h HH:MM, happy path.
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

// Same idea for `menu`, model might hand back a string when it should
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
//, the admin sees the rest of the data and can fill the gap from the
// photo themselves.
export const extractedBhandaraSchema = z.object({
  // Required-as-output, optional-as-input strings: `.default("")` covers
  // the case where the model omits the field entirely, while keeping
  // the inferred TS output type as `string` (not `string | undefined`).
  name: z.string().trim().default(""),
  nameHi: z.string().trim().default(""),
  description: z.string().trim().default(""),
  descriptionHi: z.string().trim().default(""),
  // Free-form neighbourhood name. We *used* to enforce z.enum(AREA_VALUES)
  // here, but the curated AREAS list doesn't cover every Lucknow
  // neighbourhood organisers actually write on banners (Indira Nagar,
  // Vrindavan Yojana, Vipul Khand, etc). When the model returned a real
  // neighbourhood that wasn't in the dictionary, the whole extraction
  // 502'd, losing the rest of the structured data. The admin publish
  // endpoint already accepts free strings for area; this matches that.
  // Admin can still re-categorise in the review UI.
  area: z.string().trim().max(50).optional(),
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
  /** Free-form notes the model wants to surface, anything it
   *  couldn't fit. */
  notes: z.string().trim().default(""),
});
export type ExtractedBhandara = z.infer<typeof extractedBhandaraSchema>;

export const extractedSpotSchema = z.object({
  caption: z.string().trim().max(200).default(""),
  captionHi: z.string().trim().max(200).default(""),
  // See note on bhandara schema above, free string, not the strict enum.
  area: z.string().trim().max(50).optional(),
  address: z.string().trim().max(200).default(""),
  language: z.enum(["hi", "en", "mixed"]).default("en"),
  notes: z.string().trim().default(""),
});
export type ExtractedSpot = z.infer<typeof extractedSpotSchema>;

const AREA_LIST = AREAS.join(", ");
const MENU_LIST = MENU_KEYS.join(", ");

const BHANDARA_PROMPT = `You are reading a Bada Mangal bhandara invite from Lucknow, India. It will usually be in Hindi (Devanagari), occasionally English/Hindi mixed. Output ONE JSON object only, no markdown, no commentary, no code fence.

Fields (all optional, emit "" or omit if unsure, never invent):
{
  "name":         English name of the bhandara (e.g. "Shrivastav Pariwar Bhandara"). Translate/transliterate the Hindi banner into a clean English title. Keep it under 60 chars.
  "nameHi":       Hindi name, Devanagari. Mirror the banner style (e.g. "श्रीवास्तव परिवार भंडारा").
  "description":  ONE short English sentence summarising the event (e.g. "Sundarkand Path from 9 AM, Vishal Bhandara from 12 PM at Hanuman Mandir, Talkatora").
  "descriptionHi":ONE short Hindi sentence summarising the event.
  "area":         Lucknow neighbourhood name. Prefer one of these curated names when it fits: ${AREA_LIST}. If none of them match the banner's address/landmark, write the actual neighbourhood as printed (e.g. "Indira Nagar", "Vrindavan Yojana"). Keep ≤ 50 chars. Omit if you can't infer at all.
  "address":      Full English address as written, including landmark + locality + Lucknow.
  "addressHi":    Same address in Hindi (Devanagari), translate proper nouns only when the banner shows them in Hindi.
  "landmark":     One landmark phrase if explicitly mentioned (e.g. "Near Civil Hospital"). Otherwise "".
  "dateIso":      YYYY-MM-DD. Resolve Hindi/English dates to ISO. The 2026 Bada Mangal Tuesdays are 2026-05-05, 2026-05-12, 2026-05-19, 2026-05-26, 2026-06-02, 2026-06-09, 2026-06-16, 2026-06-23. Shani Jayanti is 2026-05-16 (Saturday). If only "मंगलवार" / "Tuesday" is given without a date, leave this empty.
  "timeStart":    24h HH:MM (e.g. "09:00", "12:00", "18:30"). Convert "11 बजे से" → "11:00", "दोपहर 2 बजे" → "14:00".
  "timeEnd":      24h HH:MM if a clear end time is given. "प्रभु इच्छा तक" / "until Prabhu Iccha" → leave empty.
  "menu":         An array picked from EXACTLY these keys: ${MENU_LIST}. Use "prasad" as a generic catch-all if the banner only says "भंडारा" without specifying items. Keep array length ≤ 6.
  "menuOther":    Free-form items the banner mentions but aren't in the list above (e.g. "kheer", "kachori"). English, lowercase. Optional.
  "organizerName":Best guess at the host name. The Hindi word "आयोजक" / "द्वारा" precedes it. e.g. "Hind Nagar Vyapar Mandal", "Shrivastav Pariwar". If only "समस्त भक्तगण" / "all devotees" is given, emit "Samast Bhakta Gan".
  "organizerPhone":Phone number if printed on the banner. Indian mobile (10 digits, optional +91). Omit if absent.
  "notes":        Anything important the schema didn't capture, e.g. "Sundarkand at 9 AM separately", "Free parking near Gate 3". Keep under 200 chars.
}

Be conservative: when in doubt, leave the field empty. Do not paste the model's reasoning into "notes", only invite-relevant info that the admin should see.`;

// Tiny prompt for the auto-classification pre-pass. The WhatsApp bot
// pipeline sends every group photo here first so we know whether to run
// the bhandara extractor (designed for text-heavy invite posters) or
// the spot extractor (designed for live photos of pandals/food/crowds).
//
// We ask for a one-word answer so the call is small and fast, most
// images classify in well under a second of Gemini wall time.
const CLASSIFY_PROMPT = `You are looking at a photo from a Bada Mangal bhandara group in Lucknow.
Classify it as exactly ONE of these two categories, output a single lowercase word, nothing else, no punctuation:
- "bhandara": a designed invite/poster with significant Hindi or English text announcing a bhandara event (date, address, organiser, menu, etc). Mostly graphic + text, often a decorated banner.
- "spot": a live photograph of people, food, a serving pandal, a crowd, a sign at the venue, or any in-person scene that is NOT a designed invite poster.
If unsure, pick the one with more weight: heavy text/graphics → bhandara, real-world photo → spot.`;

const SPOT_PROMPT = `You are reading a photo someone snapped of a live Bada Mangal bhandara in Lucknow. The photo may show a banner, a serving counter, a crowd, or just food. Extract a brief caption and any visible location hints.

Output ONE JSON object, no markdown, no prose. Fields:
{
  "caption":    1 short English line describing what's happening (≤ 100 chars). e.g. "Puri-sabzi being served outside a saffron-draped pandal."
  "captionHi":  Same sentence in Hindi, ≤ 100 chars.
  "area":       Lucknow neighbourhood name. Prefer one of: ${AREA_LIST} when it fits, otherwise write the locality as it appears on a visible signboard / banner. ≤ 50 chars. Else omit.
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
        // truncated mid-string on banner-heavy invites, the parser
        // then threw "Model returned non-JSON". 4096 covers every
        // real-world invite we've tested. Cost diff is negligible
        // (output tokens are paid only at $0.0003/1k anyway, and we
        // rarely exceed ~800 even with the cap raised).
        maxOutputTokens: 4096,
        // Native JSON mode, Gemini will (almost always) return a clean
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
      "Gemini hit the maxOutputTokens cap before finishing, increase the cap in src/lib/vision.ts (callGeminiVision generationConfig).",
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

/**
 * Auto-classify a WhatsApp-forwarded photo as either an invite poster
 * ("bhandara") or a live in-person photo ("spot"). Used by /api/bot/ingest
 * so the user can forward anything into the group and we route to the
 * right extractor + the right row type (Bhandara vs Spot).
 *
 * Falls back to "bhandara" on any parse ambiguity, that path leaves
 * lat/lng=0 and status=PENDING, so the worst case is an admin reclassifies
 * during review. Never throws to the caller; we'd rather ingest the row
 * with one mis-classification than 502 the whole pipeline.
 */
export async function classifyImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<"bhandara" | "spot"> {
  try {
    const raw = await callGeminiVision(imageBase64, mediaType, CLASSIFY_PROMPT);
    const cleaned = raw.toLowerCase().replace(/[^a-z]/g, "");
    if (cleaned.includes("spot")) return "spot";
    return "bhandara";
  } catch (err) {
    // Don't fail ingest on a classification hiccup, default to
    // bhandara, which is what 90% of group forwards turn out to be.
    console.error("[vision.classifyImage] failed, defaulting to bhandara:", err);
    return "bhandara";
  }
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

/**
 * POST a plain prompt to Gemini (no image), return the trimmed JSON
 * string. Same defensive parsing as `callGeminiVision` so the AI
 * pamphlet-fill UI gets the same predictable failure surfaces. Used
 * for the public "describe your bhandara in one line" flow on
 * /pamphlet, visitors type a sentence ("23 मई को अलीगंज में सुबह
 * 11 बजे..."), Gemini structures it into the same
 * ExtractedBhandara shape the image extractor produces, and the form
 * pre-fills.
 */
async function callGeminiText(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const resp = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
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
  if (!text) throw new Error("Gemini returned an empty response");
  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "Gemini hit the maxOutputTokens cap before finishing, increase the cap in src/lib/vision.ts (callGeminiText generationConfig).",
    );
  }
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Generate the personalised Hindi invitation copy for a pamphlet.
 *
 * Why this exists:
 *   Real Lucknow bhandara pamphlets follow a very specific Devanagari
 *   grammar, "प्रभु सियाराम की कृपा से", "...परिवार द्वारा",
 *   "द्वितीय बड़े मंगल के पावन अवसर पर", "का भव्य आयोजन किया जा
 *   रहा है", "आप सभी की स्नेहमयी उपस्थिति अनिवार्य है". Hand-
 *   stitching these strings in code feels stiff because the right
 *   wording shifts with the host (family vs. organisation vs. mandir),
 *   the Mangal ordinal in the season (प्रथम / द्वितीय / तृतीय),
 *   the day-period ("प्रातः 9 बजे" vs. "सायं 5 बजे"), and the
 *   activity ("सुंदरकांड पाठ एवं विशाल भंडारे" vs. just "भंडारे").
 *
 *   So we hand the structured form data to Gemini Flash (free tier)
 *   and let it write the actual invitation prose. Returns a tight
 *   JSON object the Satori template renders verbatim.
 *
 * Cost: free under Gemini's text quota. We're well under the 1500
 * req/day cap on the free tier, even a busy season won't approach it.
 */
const invitationCopySchema = z.object({
  /** Top invocation line, short Sanskrit benediction. Usually
   *  "॥ श्री हनुमते नमः ॥" or "॥ जय श्री राम ॥". */
  invocation: z.string().trim().max(80).default("॥ श्री हनुमते नमः ॥"),
  /** Honourific opener that sits above the host name. */
  blessingPrefix: z.string().trim().max(120).default("प्रभु सियाराम की कृपा से"),
  /** Host display in Devanagari, "समस्त <family> परिवार" or
   *  "<organisation>". Should not exceed ~50 chars to fit the plaque. */
  hostLine: z.string().trim().max(80).default(""),
  /** "द्वारा" or equivalent attribution connector. */
  attribution: z.string().trim().max(40).default("द्वारा"),
  /** Occasion phrase, "द्वितीय बड़े मंगल के पावन अवसर पर". */
  occasion: z.string().trim().max(160).default("बड़े मंगल के पावन अवसर पर"),
  /** Venue lead-in, "अपने निवास" / "मंदिर परिसर" etc. */
  venueLead: z.string().trim().max(80).default("अपने निवास"),
  /** Activity headline, "सुंदरकांड पाठ एवं विशाल भंडारे" or
   *  shorter "विशाल भंडारे" when the user didn't specify activities. */
  activity: z.string().trim().max(120).default("विशाल भंडारे"),
  /** Closing sentence connecting activity to event, "का भव्य
   *  आयोजन किया जा रहा है।". */
  invitationBody: z
    .string()
    .trim()
    .max(160)
    .default("का भव्य आयोजन किया जा रहा है।"),
  /** Final framed closer, "आप सभी की स्नेहमयी उपस्थिति अनिवार्य है।". */
  closer: z
    .string()
    .trim()
    .max(180)
    .default("आप सभी की स्नेहमयी उपस्थिति अनिवार्य है।"),
});
export type InvitationCopy = z.infer<typeof invitationCopySchema>;

/** Input the invitation-copy generator needs. Mirrors what the
 *  pamphlet form collects, plus the Mangal-ordinal hint we compute
 *  upstream so Gemini doesn't have to figure it out from a raw date. */
export type InvitationCopyInput = {
  /** Best Hindi name for the host ("Shrivastav Pariwar", "अवध सेना", etc). */
  organizerName?: string;
  /** Optional Hindi spelling if provided. */
  organizerNameHi?: string;
  /** Free-form bhandara title, "Shrivastav Pariwar Bhandara". */
  bhandaraName?: string;
  /** Hindi spelling if provided. */
  bhandaraNameHi?: string;
  /** Human-readable date string ("Tuesday, 19 May 2026"). */
  date?: string;
  /** Pre-computed Mangal ordinal in the 2026 season, 1-8. Lets
   *  Gemini write "द्वितीय" instead of guessing from the date. */
  mangalOrdinal?: number | null;
  /** 24h start time ("11:00"), Gemini converts to "प्रातः 11 बजे". */
  timeStart?: string;
  /** Free-form menu list, comma-separated. */
  menu?: string;
  /** Address line. */
  address?: string;
  /** Area / neighbourhood. */
  area?: string;
};

export async function generateInvitationCopy(
  input: InvitationCopyInput,
): Promise<InvitationCopy> {
  // Map the ordinal to its Devanagari equivalent up-front so the
  // prompt doesn't have to teach Gemini the sequence. Indian
  // numerical adjectives don't map 1-to-1 to "first/second/third"
  //, model output is noticeably more reliable when we hand them
  // the exact word.
  const ORDINALS_HI = [
    "प्रथम",
    "द्वितीय",
    "तृतीय",
    "चतुर्थ",
    "पंचम",
    "षष्ठ",
    "सप्तम",
    "अष्टम",
  ];
  const ordinalHi =
    typeof input.mangalOrdinal === "number" &&
    input.mangalOrdinal >= 1 &&
    input.mangalOrdinal <= 8
      ? ORDINALS_HI[input.mangalOrdinal - 1]
      : null;

  const prompt = `You are writing the Devanagari invitation copy for a Lucknow Bada Mangal bhandara pamphlet. The voice is reverent, warm, and traditional, same grammar you'd find on a printed family invite at a Lucknow Hanuman mandir.

Output ONE JSON object only, no markdown, no commentary.

Fields (every value MUST be Devanagari, NOT Roman script):
{
  "invocation":       Short Sanskrit/Hindi benediction (≤ 60 chars). Pick from "॥ श्री हनुमते नमः ॥", "॥ जय श्री राम ॥", "॥ श्री राम जय राम जय जय राम ॥".
  "blessingPrefix":   Honourific opener (≤ 80 chars). Default "प्रभु सियाराम की कृपा से". Vary slightly only if the host name suggests a specific tradition.
  "hostLine":         The host display (≤ 60 chars). Format: "समस्त <family> परिवार" for family hosts. For organisations write the org name as-is. Keep Devanagari only.
  "attribution":      Connector that follows the host (≤ 20 chars). Default "द्वारा".
  "occasion":         Occasion phrase using the Mangal ordinal (≤ 100 chars). Format: "${
    ordinalHi
      ? `"${ordinalHi} बड़े मंगल" के पावन अवसर पर`
      : `"बड़े मंगल" के पावन अवसर पर`
  }". Always include the quotation marks around the ordinal+बड़े मंगल phrase.
  "venueLead":        Short venue lead-in (≤ 40 chars). Use "अपने निवास" when the address mentions a house/colony, "मंदिर परिसर" when it mentions a temple, otherwise "स्थान".
  "activity":         Activity headline (≤ 80 chars). If the menu suggests just food → "विशाल भंडारे". If user mentioned Sundarkand or recitation → "सुंदरकांड पाठ एवं विशाल भंडारे". Default to "विशाल भंडारे" when uncertain.
  "invitationBody":   Sentence connecting activity to invitation (≤ 100 chars). Default "का भव्य आयोजन किया जा रहा है।".
  "closer":           Closing call (≤ 120 chars). Default "आप सभी की स्नेहमयी उपस्थिति अनिवार्य है।". Stay reverent and warm.
}

Bhandara details:
- Host (English): ${input.organizerName || "(not provided)"}
- Host (Hindi):   ${input.organizerNameHi || "(not provided)"}
- Bhandara name:  ${input.bhandaraNameHi || input.bhandaraName || "(not provided)"}
- Date:           ${input.date || "(not provided)"}${
    ordinalHi ? ` (this is the ${ordinalHi} / #${input.mangalOrdinal} Bada Mangal of 2026)` : ""
  }
- Start time:     ${input.timeStart || "(not provided)"}
- Address:        ${input.address || "(not provided)"}
- Area:           ${input.area || "(not provided)"}
- Menu / prasad:  ${input.menu || "(not provided)"}

Be conservative: when in doubt, use the field's default. Never write Roman-script text in any field.`;

  try {
    const raw = await callGeminiText(prompt);
    return parseOrThrow(raw, invitationCopySchema);
  } catch (err) {
    // Soft-fail: if Gemini hiccups, return the hand-coded defaults so
    // the pamphlet still renders sensibly. Schema's `.default()` calls
    // cover every field.
    console.error("[invitation] Gemini text failed, using defaults:", err);
    return invitationCopySchema.parse({
      hostLine: input.organizerNameHi || input.organizerName || "",
      occasion: ordinalHi
        ? `"${ordinalHi} बड़े मंगल" के पावन अवसर पर`
        : `"बड़े मंगल" के पावन अवसर पर`,
    });
  }
}

/**
 * Pull structured bhandara details out of a single free-form
 * description (Hindi, English, or mixed). Designed for the public
 * pamphlet-builder's "describe in one line" surface. Reuses the
 * exact same ExtractedBhandara schema as the image extractor so the
 * downstream form-fill logic is one code path.
 */
export async function extractBhandaraFromText(
  description: string,
): Promise<ExtractedBhandara> {
  const trimmed = description.trim();
  if (!trimmed) throw new Error("description is empty");
  if (trimmed.length > 2000) {
    // Cap input length, anything beyond ~2k chars is either a paste
    // accident or an abuse attempt. Cuts Gemini cost + latency.
    throw new Error("description is too long (max 2000 characters)");
  }

  // Same field grammar as BHANDARA_PROMPT so the parsed JSON drops
  // straight into the existing form-fill code path. Prompt body is
  // tailored to a single-line free-text description rather than a
  // banner image, but the OUTPUT contract is identical.
  const prompt = `You are reading a free-form description of a Bada Mangal bhandara in Lucknow, India. The description may be in Hindi (Devanagari), English, or mixed. Output ONE JSON object only, no markdown, no commentary, no code fence.

Fields (all optional, emit "" or omit if unsure, never invent):
{
  "name":         English name of the bhandara (e.g. "Shrivastav Pariwar Bhandara"). Translate/transliterate Hindi names cleanly. ≤ 60 chars.
  "nameHi":       Hindi name in Devanagari (e.g. "श्रीवास्तव परिवार भंडारा"). If the user wrote only English, transliterate it to Devanagari.
  "description":  ONE short English sentence summarising the event. Skip if the user gave no extra context.
  "descriptionHi":ONE short Hindi sentence summarising the event. Skip if no extra context.
  "area":         Lucknow neighbourhood name. Prefer one of these curated names when it fits: ${AREA_LIST}. If none match what the user wrote, use the locality as-is. ≤ 50 chars.
  "address":      Full English address as the user wrote, including landmark + locality + Lucknow.
  "addressHi":    Same address in Hindi (Devanagari).
  "landmark":     One landmark phrase if explicitly mentioned (e.g. "Near Civil Hospital"). Otherwise "".
  "dateIso":      YYYY-MM-DD. Resolve relative phrases like "this Tuesday" / "अगले मंगल" against today (${new Date().toISOString().slice(0, 10)} IST). The 2026 Bada Mangal Tuesdays are 2026-05-05, 2026-05-12, 2026-05-19, 2026-05-26, 2026-06-02, 2026-06-09, 2026-06-16, 2026-06-23. Shani Jayanti is 2026-05-16 (Saturday). If only a weekday name is given with no date hint, leave empty.
  "timeStart":    24h HH:MM. Convert "11 बजे से" / "11 AM" → "11:00", "दोपहर 2 बजे" / "2 PM" → "14:00".
  "timeEnd":      24h HH:MM if a clear end time is given. Phrases like "प्रभु इच्छा तक" leave empty.
  "menu":         An array picked from EXACTLY these keys: ${MENU_LIST}. Use "prasad" as a catch-all if user just says "भंडारा". ≤ 6 items.
  "menuOther":    Free-form items the user mentions but aren't in the list above (e.g. "kheer", "kachori"). English, lowercase. Optional.
  "organizerName":Best guess at the host name. ≤ 80 chars. Default empty if the user didn't name anyone.
  "organizerPhone":Phone number if mentioned. Indian mobile (10 digits, optional +91). Else omit.
  "notes":        Anything important the schema didn't capture. ≤ 200 chars.
}

Be conservative: when in doubt, leave the field empty. Never paste your own reasoning into "notes".

Description to parse:
"""
${trimmed}
"""`;

  const raw = await callGeminiText(prompt);
  return parseOrThrow(raw, extractedBhandaraSchema);
}
