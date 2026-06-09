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
import { slugify } from "@/lib/slugify";

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

// Coerce whatever Gemini puts in the date slot into a clean string[]
// of YYYY-MM-DD entries. Real Bada Mangal posters list ALL 8 Tuesdays
// of the Jyeshtha season on one banner (this is the norm, not the
// exception), so the field has to be an array. But we've seen Gemini
// shape it variously across runs:
//   • the requested array  →  ["2026-05-05", "2026-05-12", …]
//   • a comma-joined string →  "2026-05-05, 2026-05-12, 2026-05-19"
//   • a single string       →  "2026-05-05"   (single-Tuesday poster)
//   • a labelled string     →  "Dates: 2026-05-05 and 2026-05-12"
//   • undefined / null      →  the date wasn't on the banner
// Extract every YYYY-MM-DD substring anywhere in the input, dedupe, and
// return chronologically sorted. Anything that doesn't match the regex
// silently drops, so a stray "TBD" or a malformed "2026/5/5" can't
// poison the array (and the admin can fill the gap in the review UI).
function preprocessDateList(v: unknown): string[] {
  const matches = new Set<string>();
  const harvest = (s: string): void => {
    const found = s.match(/\d{4}-\d{2}-\d{2}/g);
    if (found) for (const d of found) matches.add(d);
  };
  if (typeof v === "string") harvest(v);
  else if (Array.isArray(v)) {
    for (const entry of v) if (typeof entry === "string") harvest(entry);
  }
  return Array.from(matches).sort();
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
  // Array of YYYY-MM-DD strings. Real posters list every Tuesday of
  // the 8-Tuesday Jyeshtha season; preprocessDateList tolerates
  // single-string + comma-string + array shapes from the model.
  dateIsoList: z.preprocess(
    preprocessDateList,
    z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  ),
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
  "dateIsoList":  Array of YYYY-MM-DD strings, one entry per serving date the banner shows. MOST Lucknow Bada Mangal posters list ALL 8 Tuesdays of the Jyeshtha season on a single banner, list every date you see, do not just pick the first. The 2026 Bada Mangal Tuesdays are 2026-05-05, 2026-05-12, 2026-05-19, 2026-05-26, 2026-06-02, 2026-06-09, 2026-06-16, 2026-06-23. Shani Jayanti is 2026-05-16 (Saturday) and is occasionally added too. Resolve Hindi/English date numerals to ISO. If only "मंगलवार" / "Tuesday" appears with no date numbers, return [].
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
const CLASSIFY_PROMPT = `You are looking at a photo forwarded into a Lucknow Bada Mangal bhandara WhatsApp group. Many forwards aren't actually about a bhandara at all, newspaper clippings, recipe screenshots, political posters, memes, generic festival graphics, religious wallpapers, ads, your FIRST job is to filter those out.
Classify the image as exactly ONE of these three categories. Output a single lowercase word, no punctuation, no prose:
- "bhandara": a designed invite/poster announcing a SPECIFIC bhandara event in Lucknow (date, address, organiser, menu, time). Mostly graphic + text, often a decorated banner. Must clearly announce a bhandara, not just any religious / festival poster.
- "spot": a live photograph from the venue, people serving / eating, a saffron pandal, a queue of devotees, a banner / sign AT the venue, cooked food being plated. A real-world snapshot of a bhandara happening.
- "other": ANYTHING ELSE. Newspaper clippings, recipe / cooking images, political party posters, advertisements, wedding cards, generic Hanuman / Ram wallpapers, religious greetings, memes, status images, food magazine shots, business banners, election material, social-cause infographics, "Vasudhaiva Kutumbakam" type articles, etc. When in doubt, pick "other", the cost of a wrong "other" is one missed bhandara; the cost of a wrong "bhandara" / "spot" is junk on the public feed.
Rule of thumb: a "bhandara" or "spot" image must SHOW a Lucknow bhandara, the event itself or its invitation poster. Anything that's just topically adjacent (devotional content, social-cause content, food in general) is "other".`;

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

  // Hard timeout + transient retry, matching the callGeminiText pattern
  // below. Without these two safeguards admin "Scan & publish" + the
  // /api/bot/ingest pipeline would 502 on every Gemini 503 overload,
  // and a hung Gemini connection would burn the Vercel function to
  // its full timeout before failing.
  //
  // 5xx retries: 3 attempts not 2, a single Gemini 503 overload spike
  // commonly lasts 5–10 seconds. Two attempts 1.5s apart fall entirely
  // inside that spike → photo lost. Three attempts with backoff (1.5s,
  // 4s) covers spikes up to ~7s wall clock.
  //
  // Timeouts: do NOT retry. Bumped 2026-05-25 after the admin scan UI
  // surfaced "The operation was aborted due to timeout" three attempts
  // in a row on a slow Gemini day. The previous behaviour retried
  // timeouts too, which meant 3 × 12s = 36s of the function budget
  // burned on the same hung connection, and "auto" mode actually
  // calls vision TWICE (classify + extract), so a hung Gemini could
  // chew through 72s before the function even noticed. Now a hard
  // throw on AbortError surfaces a clean 502 to the UI within one
  // VISION_TIMEOUT_MS window so the operator can retry the whole
  // flow with a fresh budget instead of waiting for cascading retries.
  //
  // Per-attempt timeout bumped 12s → 22s. The Vercel function now has
  // 60s (was 25s for Netlify), and a single vision call legitimately
  // takes 8–18s on a busy Gemini day; 12s was killing real responses.
  // 22s leaves room for both classify + extract within 60s even in
  // worst-case wall-clock (22 + 22 = 44s, plus image normalize / R2
  // upload / geocode / DB write < 10s).
  const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS_MS = [1500, 4000];
  const VISION_TIMEOUT_MS = 22_000;

  let resp: Response | null = null;
  let lastErrText = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      resp = await fetch(
        `${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  // Gemini accepts the inline base64 image as a
                  // `inline_data` part. Same convention as the
                  // Anthropic call we replaced.
                  {
                    inline_data: { mime_type: mediaType, data: imageBase64 },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              // 8192 (was 4096, was 1200). gemini-2.5-flash supports
              // up to 8192 output tokens by default and Devanagari
              // invites can run that long when they include both
              // English + Hindi field values, a chunky verbose
              // description block, AND a multi-line address with
              // landmarks. Bumped 2026-05-25 after the admin scan UI
              // surfaced "Gemini hit the maxOutputTokens cap" on a
              // text-heavy "Aamantran / Sri Madbhagavat Katha" invite
              //, the parser hit MAX_TOKENS finish-reason and threw
              // before the trailing JSON could close. JSON mode is
              // still enabled below, so the model only emits the
              // structured shape we ask for; the extra budget gives
              // Devanagari + descriptions enough room to finish.
              maxOutputTokens: 8192,
              // Native JSON mode, Gemini will (almost always) return a
              // clean JSON document without code fences. Still
              // defensive-parsed below.
              responseMimeType: "application/json",
            },
          }),
        },
      );
    } catch (err) {
      // AbortError = the 22s per-attempt timer fired. Used to retry;
      // now we throw immediately. A hung Gemini connection doesn't
      // get faster on retry, it's the same backend instance the load
      // balancer routed us to, and burning another 22s × 2 attempts
      // just chews through the Vercel function budget. The admin UI
      // catches the 502 we surface and prompts the operator to retry,
      // which gives them a fresh function invocation (different
      // load-balancer route → almost always different Gemini instance).
      lastErrText = err instanceof Error ? err.message : String(err);
      throw new Error(`Gemini vision fetch failed: ${lastErrText}`);
    }
    if (resp.ok) break;
    lastErrText = await resp.text();
    if (attempt < MAX_ATTEMPTS && TRANSIENT_STATUSES.has(resp.status)) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1] ?? 1500));
      continue;
    }
    break;
  }

  if (!resp || !resp.ok) {
    throw new Error(
      `Gemini API error ${resp?.status ?? "no-response"}: ${lastErrText.slice(0, 300)}`,
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
): Promise<"bhandara" | "spot" | "other"> {
  try {
    const raw = await callGeminiVision(imageBase64, mediaType, CLASSIFY_PROMPT);
    const cleaned = raw.toLowerCase().replace(/[^a-z]/g, "");
    // Check "other" first, both other words ("bhandara", "spot")
    // never appear as substrings of "other". Order matters because
    // we want "other" to win cleanly even if Gemini hedges with
    // "other (looks like a news article)".
    if (cleaned.includes("other")) return "other";
    if (cleaned.includes("spot")) return "spot";
    if (cleaned.includes("bhandara")) return "bhandara";
    // Unknown response, treat as "other" so junk doesn't leak
    // through. This is the conservative direction: a missed bhandara
    // is recoverable (admin can re-add), a wrong public spot isn't.
    return "other";
  } catch (err) {
    // Don't fail ingest on a classification hiccup, default to
    // "other" so the row never ships to a public surface, the
    // bot's notify already pings the admin so genuine bhandaras
    // can be re-classified manually if the cap fires.
    console.error("[vision.classifyImage] failed, defaulting to other:", err);
    return "other";
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

  // Retry once on transient Gemini errors (5xx, 429 "model overloaded").
  // Permanent failures (400 bad request, 403 auth, 404 model gone) bail
  // out immediately, retrying those would just waste tokens. Two
  // attempts is the right cap: Gemini Flash's overload spikes typically
  // clear within a second or two; longer outages should fail loudly so
  // the bot's `lastError` path fires its DM-the-owner alert instead of
  // swallowing the problem for minutes.
  //
  // Backoff is small (1.5s) because the bot's user-facing flow is "I
  // sent a WhatsApp message and want to see it on the heatmap", every
  // second added on the server side is felt by the operator. The
  // common case (no transient) costs zero extra latency.
  const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS_MS = [1500, 4000];

  let resp: Response | null = null;
  let lastErrText = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    resp = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          // Mirror callGeminiVision's bump: 4096 → 8192. Devanagari
          // tokens are ~2× English; text-heavy outputs hit the old cap
          // before closing the JSON document.
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });
    if (resp.ok) break;
    lastErrText = await resp.text();
    // Only retry transient errors. The 429 "spend cap exceeded" case
    // would also retry, that's fine; one extra request to confirm
    // the cap is a cheap diagnostic and the second 429 surfaces the
    // same error to the caller.
    if (attempt < MAX_ATTEMPTS && TRANSIENT_STATUSES.has(resp.status)) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1] ?? 1500));
      continue;
    }
    break;
  }

  if (!resp || !resp.ok) {
    throw new Error(
      `Gemini API error ${resp?.status ?? "no-response"}: ${lastErrText.slice(0, 300)}`,
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
  "dateIsoList":  Array of YYYY-MM-DD strings, one entry per serving date the user mentions. If they say "all 8 Tuesdays" / "हर मंगलवार" / "every Tuesday this Bada Mangal", expand to the full list. Resolve relative phrases like "this Tuesday" / "अगले मंगल" against today (${new Date().toISOString().slice(0, 10)} IST). The 2026 Bada Mangal Tuesdays are 2026-05-05, 2026-05-12, 2026-05-19, 2026-05-26, 2026-06-02, 2026-06-09, 2026-06-16, 2026-06-23. Shani Jayanti is 2026-05-16 (Saturday). If only a weekday name is given with no date hint, return [].
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

// ────────────────────────────────────────────────────────────────────
// WhatsApp text-message classifier (powers /api/bot/message)
// ────────────────────────────────────────────────────────────────────
//
// The image bot routes a forward through extractBhandaraFromImage /
// extractSpotFromImage based on a coarse classifier; the text bot does
// the same dance but for chat messages. Three things to figure out from
// a one-line WhatsApp message:
//
//   1. Is this even ABOUT a bhandara? (most group chatter isn't.)
//   2. If yes, is it ASKING (where/when), SHARING (here's one), or just
//      MENTIONING (post-event thank-you, photo caption, etc)?
//   3. Did the message embed a location hint we can extract? (Area name,
//      landmark, pasted Google Maps URL.)
//
// The classifier returns a single JSON object the endpoint can route on
// without a second Gemini round-trip.

/** Output shape of the text classifier. Kept tight so the endpoint can
 *  branch on `intent` + `confidence` and pull `extractedAddress` for
 *  forward-geocoding without ever re-parsing the raw response. */
export const classifiedTextSchema = z.object({
  /** ASKING / SHARING / MENTIONING / UNRELATED. UNRELATED short-circuits
   *  the endpoint, no DB row created. */
  intent: z
    .enum(["ASKING", "SHARING", "MENTIONING", "UNRELATED"])
    .default("UNRELATED"),
  /** Self-reported 0-1. Endpoint discards anything < 0.4 even when
   *  the intent isn't UNRELATED, Gemini sometimes guesses ASKING on a
   *  generic "kya ho raha hai" with no bhandara context. */
  confidence: z.number().min(0).max(1).default(0),
  /** Detected language of the original message; used to seed the
   *  BhandaraMention.language column for downstream rendering. */
  language: z.enum(["hi", "en", "mixed"]).default("mixed"),
  /** Best-effort extraction of an address / landmark mentioned in the
   *  text. Empty when the message has no location hint. Fed to
   *  geocodeLucknow at the endpoint when no direct lat/lng is available
   *  on the WhatsApp payload.
   *
   *  Kept alongside `extractedAddresses` for backward compatibility:
   *  this is always the first entry of that array (or empty). New
   *  callers should prefer `extractedAddresses` so multi-location
   *  messages don't get truncated. */
  extractedAddress: z.string().trim().max(200).default(""),
  /** All distinct locations the message refers to, in order of
   *  appearance. When a SHARING message lists multiple bhandaras
   *  ("Bhandara at Aliganj sector E AND Hazratganj GPO"), the
   *  endpoint geocodes each entry and creates one BhandaraMention
   *  per location so the heatmap shows separate cells. Capped at
   *  5 to keep the per-message fan-out bounded. */
  extractedAddresses: z
    .array(z.string().trim().min(1).max(200))
    .max(5)
    .default([]),
  /** Human-friendly area label for the UI ("Hazratganj", "near GPO").
   *  Paired with `extractedAddress`; for multi-location messages the
   *  per-location labels live in `locationLabels` below. */
  locationLabel: z.string().trim().max(80).default(""),
  /** Per-location labels paired 1:1 with `extractedAddresses`. Empty
   *  string at any index is allowed; the endpoint falls back to the
   *  reverse-geocoded area name in that case. */
  locationLabels: z
    .array(z.string().trim().max(80))
    .max(5)
    .default([]),
  /** Cleaned message: same content as input but with phone numbers,
   *  email addresses, and obvious PII redacted to `<phone>` / `<email>`.
   *  Public feed renders this version; admins see the original alongside
   *  in the moderation queue. */
  cleanedText: z.string().trim().max(2000).default(""),
});
export type ClassifiedText = z.infer<typeof classifiedTextSchema>;

/**
 * Classify + extract from a free-form WhatsApp message.
 *
 * Cost: one Gemini Flash text call (~free under quota). The endpoint
 * gates each invocation behind BOT_INGEST_SECRET + a per-IP rate
 * limit, so abuse of this function maps directly to those gates.
 *
 * Failure modes:
 *   • GEMINI_API_KEY missing  → throws; endpoint returns 500.
 *   • Gemini returns junk JSON → parseOrThrow throws; endpoint returns 502.
 *   • Empty / >2k message     → throws synchronously; endpoint returns 400.
 *
 * The classifier is deliberately conservative on UNRELATED, the cost of
 * a false ASKING is one extra row in the admin queue; the cost of a
 * false UNRELATED is a missed live mention. We'd rather over-admit and
 * let moderation filter.
 */
/** One prior message in the same group. Used to give the classifier
 *  conversational context so it can read short replies the way a
 *  human reader would. Phone numbers / long digit strings get
 *  redacted before we ship the context to Gemini so we don't leak
 *  contacts into the model. */
export type ClassifierContextMessage = {
  /** Sender display name (e.g. "~ Rohit"). May be truncated. */
  senderName: string;
  /** Plain text body. We strip > 9-digit runs to "<phone>" defensively. */
  text: string;
};

const MAX_CONTEXT_MESSAGES = 5;
const PHONE_REDACTION_RE = /\b\d{6,}\b/g;

function sanitizeContextText(text: string): string {
  return text
    .replace(PHONE_REDACTION_RE, "<phone>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export async function classifyBhandaraMessage(
  message: string,
  groupName?: string,
  recentContext?: ReadonlyArray<ClassifierContextMessage>,
): Promise<ClassifiedText> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error("message is empty");
  if (trimmed.length > 2000) {
    throw new Error("message is too long (max 2000 characters)");
  }

  // Whether the group itself is bhandara-themed. When it is, short
  // location-only queries ("polytechnic ke aas pss?") and reply
  // fragments ("batata hu abhi udher pahuch ke") are almost always
  // about a bhandara even though the message body never says
  // "bhandara", every active sender in the group has bhandara
  // context already loaded. We feed that signal to Gemini in the
  // prompt so it can interpret short messages charitably instead of
  // defaulting to UNRELATED.
  const isBhandaraGroup = !!groupName && /bhandara|bhandare|mangal/i.test(groupName);
  const groupBlock = groupName
    ? `\n\nGroup: "${groupName}"${isBhandaraGroup ? "  (this group is explicitly about Bada Mangal bhandaras, assume bhandara context for ambiguous messages)" : ""}\n`
    : "";

  // Conversation context, last few messages from the SAME group
  // (oldest first). Lets the classifier read short replies the way
  // a human would: "Golf city" right after someone asked "polytechnic
  // ke pass kuch h?" is the sender answering with a location, not a
  // random place name. Phone numbers are redacted before we ship the
  // context to Gemini so we don't leak group members' contacts.
  const ctx = (recentContext ?? [])
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((m) => ({
      senderName: (m.senderName || "?").slice(0, 40),
      text: sanitizeContextText(m.text || ""),
    }))
    .filter((m) => m.text.length > 0);
  const contextBlock =
    ctx.length > 0
      ? `\n\nRecent conversation in this group (oldest first):\n${ctx
          .map((m) => `  [${m.senderName}]: ${m.text}`)
          .join("\n")}\n\nUse the conversation above to interpret short replies. A bare 1-3 word message ("Golf city", "udhar nahi", "bta rha") right after someone asked "where?" is almost always the reply to that question, classify as SHARING with the named location, or as ASKING/MENTIONING based on the answer's tone. A bare acknowledgement ("ok", "ji", "acha") even in a hot conversation stays UNRELATED. If the current message clearly STARTS a new topic, ignore the prior conversation.\n`
      : "";

  const prompt = `You are reading a single WhatsApp chat message from a Lucknow community group during the Jyeshtha "Bada Mangal" season. The message may be in Hindi (Devanagari or Roman/Hinglish), English, or mixed. Many messages in the group are unrelated to bhandara at all, your first job is to filter those out.
${groupBlock}${contextBlock}
A "bhandara" is a free community meal traditionally served on Bada Mangal Tuesdays. Messages we care about include:
  • ASKING:     "kahan ho raha hai bada mangal bhandara aaj?", "any bhandara near Hazratganj today?", "भंडारा कहाँ है?", and, when the group is bhandara-themed, short location-only queries that don't contain the word "bhandara" but clearly ask about one ("polytechnic ke aas pss ho toh batao", "Alambagh me kahi h kya?", "any in Aashiyana??", "GPO ke around?", "Kamta, Chinhat ya amity ke taraf koi bhandara ho toh batao"). Clarifying questions in a chain ("Amity konsa wala?", "kaunsa Aliganj sector?") are also ASKING. In a bhandara group, asking "X ke pass kuch h?" essentially always means "is there a bhandara near X?"
  • SHARING:    "Aliganj sector E me bhandara ho raha hai 11 baje se", "bhandara at Ram Mandir, Indira Nagar, until 4pm", attaching a Google Maps URL. Also short location-led sharing when the group is bhandara-themed and the message names a place + time ("Kothari Bandhu park, Rajajipuram, 11 baje se", "Civil Hospital ke samne aaj").

                IMPORTANT: in a bhandara-themed group, BARE Lucknow place names sent as a single message, even one or two words, with no verb, no "bhandara" word, no other context, are SHARING. The sender is answering a previous "where?" question by naming the spot. Examples (each a complete one-line message, all SHARING):
                  - "Golf city"                              → extractedAddress: "Golf City, Lucknow",   locationLabel: "Golf City"
                  - "Atal chauk"                             → extractedAddress: "Atal Chauk, Lucknow",  locationLabel: "Atal Chauk"
                  - "Aliganj sector E"                       → extractedAddress: "Sector E, Aliganj, Lucknow", locationLabel: "Sector E, Aliganj"
                  - "Or shopping square pe hai"              → extractedAddress: "Shopping Square, Lucknow", locationLabel: "Shopping Square" ("Or" / "Aur" = "and also")
                  - "Bhandara near Durga khasta corner, abhi start nhi hua h" → extractedAddress: "Durga Khasta Corner, Lucknow", locationLabel: "Durga Khasta Corner"

                Replies that promise location data soon ("batata hu abhi udher pahuch ke", "wait, location bhejta hu") are SHARING with low confidence and an empty extractedAddress.

  • MENTIONING: PAST-TENSE praise or commentary about a bhandara that is already over, with no actionable live location, e.g. "puri-sabzi was amazing today, thanks Sharma ji", "बहुत अच्छा भंडारा था कल".

                IMPORTANT, do NOT use MENTIONING for present-tense reports that a bhandara IS happening at a named place. A plain statement of fact that names a place and says a bhandara is there right now, today, or "continue", even with no verb and even when it just gives a COUNT of bhandaras, is SHARING, not MENTIONING. The presence of a Lucknow place name + a live bhandara claim makes it SHARING so the location gets pinned on the map. These are all SHARING (each names a place, extract it):
                  - "Cyber tower ke pass h bhandara aaj"                         → extractedAddress: "Cyber Tower, Lucknow", locationLabel: "Cyber Tower"
                  - "Summit building ka bagal me 4 bhandare continue hai"        → extractedAddress: "Summit Building, Lucknow", locationLabel: "Summit Building"
                  - "Husariya pe ram aashrey ke pass 2 bhandare hai"            → extractedAddress: "Ram Aashrey, Husariya, Lucknow", locationLabel: "Ram Aashrey, Husariya"
                  - "Hight court se cyber tower ke beech 5 bhandare hai"        → extractedAddress: "Between High Court and Cyber Tower, Lucknow", locationLabel: "High Court to Cyber Tower"
                  - "India gandhi pratisthan ke pass mountain dew ka bhandara"  → extractedAddress: "Indira Gandhi Pratishthan, Lucknow", locationLabel: "near Indira Gandhi Pratishthan"
                  - "1 Bhandara Near SGPGI Charam Bhatta Road"                  → extractedAddress: "SGPGI Charam Bhatta Road, Lucknow", locationLabel: "near SGPGI, Charam Bhatta Road"
  • UNRELATED:  "good morning", "happy birthday", "next meeting on Sunday", anything off-topic. Bare acknowledgements ("ok", "ok brother", "thanks", "ji", "hn ji", "acha", "Bta rha", "👍"), one-word reaction replies, sticker reactions, and pure chitchat with no location/food cue stay UNRELATED even in a bhandara group. The give-away for UNRELATED is the absence of BOTH (a) any Lucknow place name AND (b) any bhandara/food/timing/contribution cue.

                ALSO UNRELATED, news-article / press-clipping text. If the message reads like a newspaper headline or article paraphrase ("News article about X and his social organization Y", "Adarsh Dwivedi runs a social initiative", "Vasudhaiva Kutumbakam organisation distributed meals", anything that describes a person, NGO, politician, or campaign in third-person reporter voice rather than telling you where a bhandara is happening), it is UNRELATED. The same applies to recipe instructions, motivational quotes, religious wallpapers transcribed, election material, and corporate / NGO press releases, even when they mention food, Lucknow, or seva. Bhandara mentions are short, local, and actionable ("here", "today", "11 baje"); news-article descriptions are biographical or summary.

Output ONE JSON object only, no markdown, no commentary, no code fence:
{
  "intent":             "ASKING" | "SHARING" | "MENTIONING" | "UNRELATED",
  "confidence":         0.0–1.0 (how sure you are about intent),
  "language":           "hi" | "en" | "mixed",
  "extractedAddress":   The MOST SPECIFIC address-or-landmark the message gives, suffixed with the locality + ", Lucknow" so the forward-geocoder can resolve it precisely. ALWAYS include the landmark/park/temple/shop name when the sender mentions one, that is the difference between a precise pin and a generic neighbourhood centroid. Empty string only if the message names NO place at all. Examples:
    • "Kothari Bandhu park ke hanuman mandir ke samne, Rajajipuram" → "Kothari Bandhu Park, Hanuman Mandir, Rajajipuram, Lucknow"
    • "ramnagar wale bhandara" → "Ramnagar, Lucknow"
    • "Sector E Aliganj, Civil Hospital ke paas"  → "Sector E, Civil Hospital, Aliganj, Lucknow"
    • "near GPO"                                  → "GPO, Hazratganj, Lucknow"
  When the message lists multiple locations, put the FIRST here and the full list in extractedAddresses below.
  "extractedAddresses": Array of distinct locations the message refers to, in order of appearance. Same precision rules as extractedAddress (always include the landmark phrase). For single-location messages this is a 1-element array matching extractedAddress. For SHARING messages that list multiple bhandaras ("Aliganj sector E AND Hazratganj GPO", "bhandara at Ram Mandir, also one at Civil Hospital"), include each as a separate entry. Maximum 5. Empty array if no location.
  "locationLabel":      Short human-friendly label for the public feed chip, ≤ 40 chars. PREFER the specific landmark/park/temple/shop the sender mentioned over the bare area name, "Rajajipuram" alone is much less useful than "Kothari Bandhu Park". Examples (acceptable → preferred):
    • "Rajajipuram"          → "Kothari Bandhu Park, Rajajipuram"
    • "Indira Nagar"         → "Ram Mandir, Indira Nagar"
    • "Aliganj"              → "Sector E, Aliganj"
    • "Hazratganj"           → "near GPO, Hazratganj"
  Only fall back to the bare area name when the sender gave NO landmark. Empty if no location at all. Pairs with extractedAddress.
  "locationLabels":     Per-location labels paired 1:1 with extractedAddresses (same length, same order). Same landmark-first rule as locationLabel. Each ≤ 40 chars. Pass empty string at an index if you can't derive a clean label for that one.
  "cleanedText":        The original message with phone numbers redacted to "<phone>" and email addresses redacted to "<email>". Otherwise verbatim. Preserve original language + script.
}

LOCATION EXTRACTION IS INTENT-INDEPENDENT. Whenever the message names a Lucknow place, landmark, park, temple, shop, road, or neighbourhood, you MUST fill extractedAddress / extractedAddresses / locationLabel / locationLabels, even when the intent is MENTIONING or ASKING, not only for SHARING. A named place is what lets us pin the bhandara on the map; never leave the location fields empty just because the intent is not SHARING. Only leave them empty when the message genuinely names no place.

Be conservative with intent: when the message could go either way, prefer UNRELATED. Never invent locations: only extract what the message literally states. If multiple locations are mentioned but they're really the same place described two ways ("Ram Mandir Sector E" and "Aliganj Sector E"), keep ONE entry, not two.

Message to classify:
"""
${trimmed}
"""`;

  const raw = await callGeminiText(prompt);
  return parseOrThrow(raw, classifiedTextSchema);
}

// ────────────────────────────────────────────────────────────────────
// Bhandara discovery via Gemini + Google Search grounding
// ────────────────────────────────────────────────────────────────────
//
// Powers /api/admin/discover-bhandaras (admin-only tool). Asks Gemini
// Flash to use its googleSearch tool to scour the web for Bada Mangal
// bhandaras happening in Lucknow for a given season, then return a
// structured list of candidates the admin can one-click into the
// PENDING queue.
//
// Why grounded search vs. Google Custom Search API directly:
//   • One round-trip returns ranked + deduplicated + summarised
//     candidates. CSE would return 10 blue links the admin has to
//     manually open, read, and stitch together.
//   • Gemini's grounding tool surfaces blog posts, organisation
//     websites, and community pages CSE wouldn't necessarily rank
//     for "bada mangal bhandara".
//   • Free under the Gemini Flash quota for our volume (admin
//     discovery runs maybe 10-20 times per season).
//   • Source URLs are returned alongside each candidate so the admin
//     can verify before approving (the grounding citations come back
//     in `groundingMetadata.groundingChunks`).
//
// Failure modes:
//   • GEMINI_API_KEY missing  → throws.
//   • Gemini returns no JSON  → parseOrThrow throws.
//   • Gemini returns empty `.candidates` → caller renders an empty
//     state ("no bhandaras found, try a different query").

// Discovery JSON arrives directly from Gemini, and Gemini's habit
// is to send `null` (not `undefined` or `""`) for fields it can't
// extract from a source page. Plain `z.string().default("")` only
// fires on undefined, so a null leaked through and made the whole
// candidate fail validation with "Expected string, received null".
//
// Each optional text/array/number field is wrapped in a preprocess
// that maps null → its "no data" default before the inner schema
// gets to validate. Required fields (here: `name`) stay strict
// a candidate without a name isn't actionable.
const optText = (max: number) =>
  z.preprocess(
    (v) => (v === null ? "" : v),
    z.string().trim().max(max).default(""),
  );
const optArrayStr = z.preprocess(
  (v) => (v === null ? [] : v),
  z.array(z.string()).default([]),
);
const optConfidence = z.preprocess(
  (v) => (v === null ? 0 : v),
  z.number().min(0).max(1).default(0),
);

export const discoveredBhandaraSchema = z.object({
  /** English name of the bhandara as it appears on whatever source
   *  Gemini found. ≤ 80 chars. Required (a candidate without a
   *  name isn't actionable). */
  name: z.string().trim().min(2).max(80),
  /** Hindi (Devanagari) name when the source provides one or it's
   *  easily transliterable. Empty string when unknown, empty signals
   *  to the admin form that they should fill it. */
  nameHi: optText(80),
  /** Lucknow neighbourhood / locality. Should be one of the curated
   *  areas when possible (AREA_LIST in this file), but free-form
   *  values are accepted since web sources rarely match our taxonomy
   *  exactly. ≤ 60 chars. */
  area: optText(60),
  /** Full street address as printed on the source. ≤ 300 chars.
   *  Empty when no address could be extracted (still actionable
   *  the admin can geocode from area + name in the edit form). */
  address: optText(300),
  /** One landmark phrase if explicitly mentioned. ≤ 120 chars. */
  landmark: optText(120),
  /** Tuesday serving dates as YYYY-MM-DD. Empty array when the
   *  source doesn't specify (admin fills in via the edit form). */
  tuesdayDates: optArrayStr,
  /** "HH:MM" 24h start time. Empty when unknown. */
  timeStart: optText(8),
  /** "HH:MM" 24h end time. Empty when unknown. */
  timeEnd: optText(8),
  /** Host / organiser name as it appears on the source. ≤ 80 chars. */
  organizerName: optText(80),
  /** Indian mobile number if mentioned on the source. ≤ 20 chars
   *  (allows formatting like "+91 98xxx xxxxx"). */
  organizerPhone: optText(20),
  /** Free-form descriptive blurb from the source. ≤ 400 chars. */
  description: optText(400),
  /** Source URLs grounding this candidate, max 3, in confidence order.
   *  Each is a https URL Gemini visited via the grounding tool. The
   *  admin sees these as small "via …" links under each card so they
   *  can verify the source before approving. */
  sources: z.preprocess(
    (v) => (v === null ? [] : v),
    z
      .array(
        z.object({
          url: z.string().url(),
          title: z.preprocess(
            (v) => (v === null ? "" : v),
            z.string().trim().max(200).default(""),
          ),
        }),
      )
      .max(3)
      .default([]),
  ),
  /** Self-reported 0-1. Below 0.5 the admin gets a "low confidence"
   *  pill on the card; below 0.3 we hide the candidate entirely. */
  confidence: optConfidence,
});
export type DiscoveredBhandara = z.infer<typeof discoveredBhandaraSchema>;

export const discoveryResultSchema = z.object({
  candidates: z.array(discoveredBhandaraSchema).default([]),
  /** Free-form summary of what Gemini learned about the search.
   *  Surfaces a single-sentence "found 4 bhandaras across 3 sources"
   *  hint above the cards. */
  summary: z.string().trim().max(300).default(""),
});
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;

/**
 * Run a bhandara-discovery search via Gemini with Google Search
 * grounding. The query is templated against a Lucknow + Bada Mangal
 * frame so admins can pass a plain area name ("Aliganj") or a year
 * ("2026") and get back structured candidates.
 *
 * Costs: one Gemini Flash call per invocation (free tier). Grounding
 * adds 1-2s of latency over an ungrounded text call because Gemini
 * fans out to Google Search internally.
 */
export async function discoverBhandarasViaSearch(
  rawQuery: string,
  opts?: {
    year?: number; // defaults to current calendar year
    /** Names of bhandaras already in the directory. We tell Gemini
     *  to skip them AND filter again server-side as a safety net so
     *  the admin only sees genuinely new candidates. */
    excludeNames?: ReadonlyArray<string>;
    /** YYYY-MM-DD cutoff (IST). Candidates whose `tuesdayDates` have
     *  no entry on/after this date are dropped, pamphlets for past
     *  events aren't actionable on a live moderation queue. */
    requireDateAtOrAfter?: string;
  },
): Promise<DiscoveryResult> {
  const trimmed = rawQuery.trim();
  if (!trimmed) throw new Error("query is empty");
  if (trimmed.length > 200) {
    throw new Error("query is too long (max 200 characters)");
  }
  const year = opts?.year ?? new Date().getFullYear();

  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  // Cap the exclude-list at 200 names, comfortably more than a
  // season's worth, keeps the prompt token count predictable when
  // a future season has accumulated thousands of past rows.
  const excludeList = (opts?.excludeNames ?? []).slice(0, 200);
  const excludeBlock =
    excludeList.length > 0
      ? `\n\nEXCLUDE, these bhandaras are ALREADY in our directory; do not list them again, even under slightly different spellings:\n${excludeList
          .map((n) => `  - ${n}`)
          .join("\n")}\n`
      : "";

  const dateBlock = opts?.requireDateAtOrAfter
    ? `\n\nDATE FILTER, focus on **pamphlets and invite cards announcing events on ${opts.requireDateAtOrAfter} (today, IST) or any later date**. SKIP:\n  - bhandaras whose dates have all already passed\n  - general news/feature articles about the Bada Mangal season (we want specific upcoming events)\n  - retrospective coverage of last week's bhandaras\nA candidate without a verifiable upcoming date is not actionable; drop it.\n`
    : "";

  // Prompt anchors the search to Lucknow + Bada Mangal so a stray
  // query like "bhandara" doesn't pull in cross-city results. Output
  // is strict JSON matching DiscoveredBhandara, same shape as the
  // existing ExtractedBhandara so the downstream form-fill code path
  // could be unified later.
  const prompt = `You are a research assistant helping moderate a directory of "Bada Mangal" bhandaras (free community meals) in Lucknow, India for the Jyeshtha ${year} season.

Use the googleSearch tool to find specific bhandaras matching this query:

QUERY: ${trimmed}
${excludeBlock}${dateBlock}

Cast a WIDE net across the open web so no bhandara is missed:
  • Organisation / temple / mandir websites and Bajrang Sena / Hanuman seva chapter pages
  • Hindi & English news (Hindustan Times, Amar Ujala, Dainik Jagran, Times of India, LallanTop, local Lucknow news blogs)
  • Personal blogs and community rollups
  • Facebook events and pages
  • **Instagram posts and reels**, try grounded queries like \`site:instagram.com "Bada Mangal" Lucknow\`, \`site:instagram.com bhandara Lucknow ${year}\`, hashtags like #badamangallucknow, #lucknowbhandara, #badamangal${year}; check organiser handles for invite cards / story screenshots
  • YouTube short titles & descriptions where organisers announce dates

For Instagram results, the URL pattern is usually \`https://www.instagram.com/p/<shortcode>/\` or \`https://www.instagram.com/reel/<shortcode>/\`, include those as sources verbatim.

Compile a list of distinct bhandara events (NOT just news articles about the season in general, we want the actual events the public can attend).

For each event, return:
{
  "name":           English name as it appears on the source (e.g. "Shrivastav Pariwar Bhandara")
  "nameHi":         Hindi name in Devanagari if available, or transliterate the English name
  "area":           Lucknow neighbourhood (Aliganj, Hazratganj, Indira Nagar, Gomti Nagar, etc.)
  "address":        Full street address if printed on the source
  "landmark":       One landmark phrase if mentioned ("Near Civil Hospital")
  "tuesdayDates":   Array of YYYY-MM-DD strings for the Tuesdays this bhandara serves. The 2026 Bada Mangal Tuesdays are 2026-05-05, 2026-05-12, 2026-05-19, 2026-05-26, 2026-06-02, 2026-06-09, 2026-06-16, 2026-06-23.
  "timeStart":      24h HH:MM start time if mentioned ("11:00")
  "timeEnd":        24h HH:MM end time if mentioned
  "organizerName":  Host name if mentioned
  "organizerPhone": Indian mobile number if mentioned
  "description":    Short description from the source (max 400 chars)
  "sources":        Array of 1-3 {url, title} objects you actually used as evidence
  "confidence":     0.0–1.0, how confident you are this bhandara actually exists at the stated location for ${year}
}

Output ONE JSON object only, no markdown, no commentary, no code fence:
{
  "candidates": [ ... up to 20 entries, sorted by confidence descending, over-fetch because the server filters out anything already in the directory or with no upcoming date ... ],
  "summary":    "One sentence summary of what you found"
}

Be conservative: if you can't verify a bhandara from a real source, omit it. NEVER invent addresses or phone numbers. Prefer fewer, well-grounded candidates over many speculative ones. Skip any "bhandara" mentions that are news articles about the season, we only want actual events someone can attend.`;

  const endpoint = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`;
  // googleSearch tool turns this into a grounded call. Some
  // gemini-2.5-flash builds require responseMimeType to be omitted
  // when tools are present (the grounding interleaves citation
  // chunks); we ask for plain text and parse the JSON out of the
  // fenced output below.
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.2,
        // 32768, bumped from 4096 → 16384 → 32768 across a few
        // iterations. Grounded responses interleave citation chunks
        // and Gemini Flash counts those toward the output budget, so
        // the JSON payload alone doesn't predict the real cost.
        // 32 K leaves room for ~10 rich candidates + every Instagram
        // / blog / news source we ask for in the prompt. Well below
        // Gemini Flash's per-response ceiling.
        maxOutputTokens: 32768,
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(
      `Gemini grounded search error ${resp.status}: ${errText.slice(0, 300)}`,
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
      `Gemini blocked the discovery request: ${data.promptFeedback.blockReason}`,
    );
  }

  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const text =
    candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) {
    throw new Error("Gemini returned an empty discovery response");
  }

  // Strip code fences if present, then parse + validate. Same dance
  // as callGeminiText, kept inline here because we needed the raw
  // response object to extract groundingMetadata (callGeminiText
  // discards it).
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Happy path: clean parse. Salvage path: MAX_TOKENS truncation
  // → seal the partial JSON to the last complete candidate. Either
  // way we end up with a parsed DiscoveryResult that still has to
  // go through the post-parse filters below.
  let parsed: DiscoveryResult;
  try {
    parsed = parseOrThrow(cleaned, discoveryResultSchema);
  } catch (parseErr) {
    if (finishReason === "MAX_TOKENS") {
      const salvaged = salvageTruncatedDiscoveryJson(cleaned);
      if (salvaged) {
        try {
          parsed = parseOrThrow(salvaged, discoveryResultSchema);
        } catch {
          throw new Error(
            "Gemini hit maxOutputTokens during discovery and the partial response could not be salvaged. Try a narrower query.",
          );
        }
      } else {
        throw new Error(
          "Gemini hit maxOutputTokens during discovery and the partial response could not be salvaged. Try a narrower query.",
        );
      }
    } else {
      throw parseErr;
    }
  }

  // ── Server-side filters (safety net beyond the prompt hints) ───
  // Gemini sometimes re-lists known bhandaras under a slightly
  // different spelling, or returns events whose dates have already
  // passed despite the prompt's date filter. Re-check both here so
  // the admin UI never sees them.
  let candidates = parsed.candidates;
  const droppedKnown: string[] = [];
  const droppedPastDate: string[] = [];

  if (excludeList.length > 0) {
    // Slug-based match catches "Pandey Pariwar Bhandara" ≡
    // "pandey pariwar bhandara" ≡ "Pandey  Pariwar, Bhandara!" since
    // slugify normalises punctuation, case, and whitespace.
    const knownSlugs = new Set(excludeList.map((n) => slugify(n)));
    candidates = candidates.filter((c) => {
      if (knownSlugs.has(slugify(c.name))) {
        droppedKnown.push(c.name);
        return false;
      }
      return true;
    });
  }

  if (opts?.requireDateAtOrAfter) {
    const cutoff = opts.requireDateAtOrAfter;
    candidates = candidates.filter((c) => {
      // Empty tuesdayDates → no actionable date → drop. A single
      // YYYY-MM-DD entry on/after the cutoff is enough to keep.
      // Lexicographic compare works because the format is fixed-
      // width ISO 8601.
      const hasFutureDate = c.tuesdayDates.some((d) => d >= cutoff);
      if (!hasFutureDate) {
        droppedPastDate.push(c.name);
        return false;
      }
      return true;
    });
  }

  if (droppedKnown.length > 0 || droppedPastDate.length > 0) {
    console.log(
      `[discoverBhandaras] post-filter dropped ${droppedKnown.length} known + ${droppedPastDate.length} past-date`,
    );
  }

  return { ...parsed, candidates };
}

/** Attempt to repair a discovery JSON payload that was cut off mid-
 *  response by Gemini's maxOutputTokens. Strategy: locate the last
 *  fully-closed `}` inside the `candidates` array, drop everything
 *  after it, then close the array + the outer object. Returns null
 *  if the input is too mangled to repair. */
function salvageTruncatedDiscoveryJson(raw: string): string | null {
  const candidatesStart = raw.indexOf('"candidates"');
  if (candidatesStart === -1) return null;
  const arrayStart = raw.indexOf("[", candidatesStart);
  if (arrayStart === -1) return null;

  // Walk forward tracking brace + bracket depth so we don't split
  // mid-string. Record the index after every top-level `}` so we
  // can later truncate at the LAST complete object.
  let depth = 0;
  let inString = false;
  let escape = false;
  let lastCompleteObjectEnd = -1;
  for (let i = arrayStart + 1; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) lastCompleteObjectEnd = i;
    } else if (ch === "]" && depth === 0) {
      // We somehow already have a complete array, nothing to fix.
      return null;
    }
  }

  if (lastCompleteObjectEnd === -1) return null;
  // Build a well-formed payload: original up to the last complete
  // candidate, close the array + object, drop any partial summary.
  return `${raw.slice(0, lastCompleteObjectEnd + 1)}]}`;
}

// ────────────────────────────────────────────────────────────────────
// WhatsApp screenshot extractor (testing path for /api/admin/ingest-screenshot)
// ────────────────────────────────────────────────────────────────────
//
// Powers the admin's "upload a screenshot to test the mention pipeline"
// flow. The user has WhatsApp chat screenshots they want to feed into
// the BhandaraMention pipeline WITHOUT waiting for the OpenClaw agent
// to be wired into live groups. This function reads a WhatsApp
// conversation screenshot and returns the individual messages so the
// endpoint can run each one through classifyBhandaraMessage and create
// real BhandaraMention rows (which then populate the homepage
// LiveChatterBoard + heatmap).
//
// WhatsApp UI conventions Gemini Vision needs to handle:
//   • Multiple chat bubbles per screenshot, left-aligned (incoming) and
//     right-aligned (outgoing)
//   • Sender names above bubbles in group chats (incoming only
//     outgoing bubbles don't have a name)
//   • Timestamps inside the bubble bottom-right ("11:32 AM")
//   • Group header at top showing group name
//   • "Location" share cards (map thumbnail + address text inside the
//     bubble), distinguishable from plain text bubbles
//   • Reply quotes inside bubbles (a small quoted block at the top
//     of a reply)
//   • Forwarded labels
//
// We ask Gemini to return the raw conversation text plus best-effort
// structured per-message metadata. The endpoint then runs each
// message through classifyBhandaraMessage separately so the existing
// text-classification path is unchanged.

export const extractedWhatsAppMessageSchema = z.object({
  /** Display name of the sender as shown above the bubble. Empty
   *  string for outgoing messages (no sender name shown) or when
   *  Gemini can't read it. */
  sender: z.string().trim().max(80).default(""),
  /** The verbatim message text. PII NOT redacted here, the
   *  downstream classifyBhandaraMessage redacts before insert. */
  text: z.string().trim().max(2000).default(""),
  /** Bubble timestamp as shown in the UI ("11:32 AM", "Yesterday",
   *  "10/05/2026 16:08"). Free-form because WA's relative timestamps
   *  defy parsing without the screenshot's capture timestamp. */
  timestamp: z.string().trim().max(40).default(""),
  /** True when the bubble was a WhatsApp Location share (map
   *  thumbnail + address). The endpoint can then ask the admin
   *  for explicit lat/lng for these (the screenshot itself doesn't
   *  carry the coordinates, only the rendered map tile does). */
  isLocationShare: z.boolean().default(false),
});

export const extractedWhatsAppConversationSchema = z.object({
  /** Group name from the screenshot's chat header, if visible. */
  groupName: z.string().trim().max(80).default(""),
  /** Ordered list of messages as they appear top-to-bottom in the
   *  screenshot. May span the user's own messages and others'. */
  messages: z.array(extractedWhatsAppMessageSchema).default([]),
});
export type ExtractedWhatsAppConversation = z.infer<
  typeof extractedWhatsAppConversationSchema
>;

/**
 * Extract individual WhatsApp messages from a chat screenshot.
 *
 * Returns a structured list the screenshot-ingest endpoint can iterate
 * over. Empty `messages` array is a valid result (e.g. screenshot of a
 * call screen, contact list, settings page), the endpoint surfaces it
 * as "no messages found" rather than an error.
 *
 * Failure modes:
 *   • GEMINI_API_KEY missing  → throws.
 *   • Image too large / unreadable → throws (caller wraps in 422).
 *   • Gemini returns junk JSON → parseOrThrow throws.
 */
export async function extractWhatsAppConversationFromImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<ExtractedWhatsAppConversation> {
  const prompt = `You are reading a screenshot of a WhatsApp chat, typically a Lucknow community group during the Bada Mangal season. Extract every visible chat message from the conversation.

For each message bubble in the screenshot, capture:
  - sender:          The display name shown above the bubble (incoming messages only, outgoing messages have no name; emit "" for those). ≤ 80 chars.
  - text:            The verbatim message text. Preserve language (Hindi Devanagari, English, Roman/Hinglish, whatever's in the bubble). Skip emoji-only or status-update bubbles. Include reply-quoted parts only when they're the bubble's primary content. ≤ 2000 chars.
  - timestamp:       The bubble's own timestamp as shown in the UI ("11:32 AM", "Yesterday", "10/05/2026"). ≤ 40 chars. Empty if not visible.
  - isLocationShare: true ONLY when the bubble shows a WhatsApp Location share (map thumbnail + an address line inside the bubble). For those, put the visible address text in the "text" field.

Also capture the group/chat name from the screen header in "groupName" if visible. ≤ 80 chars.

Output ONE JSON object only, no markdown, no commentary, no code fence:
{
  "groupName": "…",
  "messages": [
    { "sender": "…", "text": "…", "timestamp": "…", "isLocationShare": false },
    …
  ]
}

Order messages top-to-bottom as they appear in the screenshot. Skip system messages ("Messages and calls are end-to-end encrypted", date dividers, "X joined", "X left", call notifications). Skip empty bubbles. If the screenshot contains no chat bubbles (settings page, contact list, call screen), return {"groupName": "", "messages": []}.`;

  const raw = await callGeminiVision(imageBase64, mediaType, prompt);
  return parseOrThrow(raw, extractedWhatsAppConversationSchema);
}
