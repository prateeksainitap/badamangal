/**
 * Public /organise-bhandara request-intake endpoint.
 *
 * Sister to /api/contact: validates a service-quote inquiry, writes an
 * OrganiseRequest row, fires an admin notification email, returns 200.
 * IP-rate-limited so a bored visitor can't fill the team inbox in a
 * loop; honeypot field deters dumb bots.
 *
 * Wire format (JSON POST):
 *   name           string  (required, 2–80)
 *   phone          string  (required, 6–20, callbacks are the main
 *                           reply channel for this flow)
 *   email          string? optional
 *   area           string? Lucknow neighbourhood, free-form
 *   addressNotes   string? landmark / venue text
 *   eventDates     string[]? array of YYYY-MM-DD ISO dates inside the
 *                            2026 season window. Empty array is OK
 *                            (organisers sometimes ask before fixing
 *                            any date). Stored as JSON-encoded string
 *                            in DB for parity with Bhandara.tuesdayDates.
 *   eventTime      string? HH:MM 24h
 *   quantityType   "PLATES" | "WHEAT_KG"   (required)
 *   quantityValue  number  (required, 1..10000)
 *   packageTier    "SMALL" | "MEDIUM" | "LARGE" | "CUSTOM" (required)
 *   notes          string? free-form additional asks
 *   source         string? attribution: "page" | "banner" | "upsell" |
 *                          "footer" | other
 *   website        string  (HONEYPOT, must be empty)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ipHash, readClientIp } from "@/lib/crypto";
import { sendOrganiseRequestEmail } from "@/lib/email";

const MAX_REQUESTS_PER_HOUR = 3;

const ALLOWED_QTY_TYPES = new Set(["PLATES", "WHEAT_KG"]);
const ALLOWED_TIERS = new Set(["SMALL", "MEDIUM", "LARGE", "CUSTOM"]);

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isHHMM(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(s);
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const area = String(body.area ?? "").trim();
  const addressNotes = String(body.addressNotes ?? "").trim();
  // eventDates is an array on the wire (multi-pick form), filtered to
  // valid ISO YYYY-MM-DD strings, deduped, sorted. Empty array → null
  // column (organiser hasn't fixed dates yet). 12 chosen as a sane
  // upper bound, the full 2026 season is ~17 service days, an
  // organiser running more than that is almost certainly a typo /
  // abuse and the bot-friendly cap keeps payloads small.
  const eventDatesRaw = Array.isArray(body.eventDates) ? body.eventDates : [];
  const eventDates = Array.from(
    new Set(
      eventDatesRaw
        .filter((v): v is string => typeof v === "string")
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
    ),
  )
    .sort()
    .slice(0, 12);
  const eventTime = String(body.eventTime ?? "").trim();
  const quantityType = String(body.quantityType ?? "").trim().toUpperCase();
  const quantityValueRaw = Number(body.quantityValue);
  const packageTier = String(body.packageTier ?? "").trim().toUpperCase();
  const notes = String(body.notes ?? "").trim();
  const source = String(body.source ?? "").trim();
  const honeypot = String(body.website ?? "").trim();

  // Honeypot REMOVED as a hard-fail gate. Browser autofill / password
  // managers were filling the hidden `website` field on legitimate
  // visitors, causing their submissions to silently 200 without ever
  // being saved (form showed thank-you screen, DB stayed empty).
  // Rate-limiting + ipHash + strict field validation already deter
  // the cheap-bot class this guard was meant to stop, and a low-
  // volume lead-capture form like this is not a meaningful spam
  // target. We still LOG the trip for visibility, so if real
  // bot traffic does start showing up we have signal.
  if (honeypot.length > 0) {
    console.warn(
      "[organise-request] honeypot filled (likely browser autofill, not bot):",
      { honeypotLen: honeypot.length, name: name.slice(0, 40) },
    );
    // No early return, let the submission flow through.
  }

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Please enter your name.";
  if (name.length > 80) errors.name = "Name is too long.";
  if (phone.length < 6) errors.phone = "Please enter a phone number we can reach you on.";
  if (phone.length > 20) errors.phone = "Phone number is too long.";
  if (email && !isEmail(email)) errors.email = "Please enter a valid email.";
  if (email.length > 120) errors.email = "Email is too long.";
  if (area.length > 80) errors.area = "Area is too long.";
  if (addressNotes.length > 400) errors.addressNotes = "Venue / address note is too long.";
  // eventDates is already filter-validated above (only valid ISO
  // strings make it through), so no per-element error here. We just
  // ensure the array length is reasonable; the actual values are
  // trusted to be in season because the client picker is bounded.
  if (eventDatesRaw.length > 50) {
    errors.eventDates = "Too many dates. Pick fewer.";
  }
  if (eventTime && !isHHMM(eventTime)) errors.eventTime = "Use HH:MM.";
  if (!ALLOWED_QTY_TYPES.has(quantityType))
    errors.quantityType = "Pick either plates or wheat (kg).";
  if (
    !Number.isFinite(quantityValueRaw) ||
    quantityValueRaw < 1 ||
    quantityValueRaw > 100000
  ) {
    errors.quantityValue = "Enter a sensible number (1 to 100,000).";
  }
  if (!ALLOWED_TIERS.has(packageTier)) errors.packageTier = "Invalid package tier.";
  if (notes.length > 2000) errors.notes = "Notes are too long (max 2000 chars).";
  if (source.length > 60) errors.source = "Source label is too long.";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "validation", fields: errors },
      { status: 400 },
    );
  }

  const ip = ipHash(readClientIp(req.headers));

  // Per-IP rate limit, last 60 min. Tighter than /contact's 5/hour
  // because this is a higher-touch ask, three full inquiries from
  // the same IP in an hour is already enough; more is almost
  // certainly probing or abuse.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.organiseRequest.count({
    where: { ipHash: ip, createdAt: { gte: oneHourAgo } },
  });
  if (recent >= MAX_REQUESTS_PER_HOUR) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          "Too many requests from this connection. Please try again in an hour or call us directly.",
      },
      { status: 429 },
    );
  }

  const ua = req.headers.get("user-agent")?.slice(0, 240) ?? null;
  // Coerce to integer for the DB column (Int). The validator above
  // already ensured the value is finite and in range.
  const quantityValue = Math.round(quantityValueRaw);

  const saved = await prisma.organiseRequest.create({
    data: {
      name,
      phone,
      email: email || null,
      area: area || null,
      addressNotes: addressNotes || null,
      // Store as JSON-encoded string for parity with Bhandara.
      // tuesdayDates, the same safeJsonArray helper reads both. null
      // when the organiser hasn't picked any dates yet.
      eventDates: eventDates.length > 0 ? JSON.stringify(eventDates) : null,
      eventTime: eventTime || null,
      quantityType,
      quantityValue,
      packageTier,
      notes: notes || null,
      source: source || null,
      ipHash: ip,
      userAgent: ua,
    },
  });

  // Fire-and-forget admin notification. `await`ed so Netlify Functions
  // don't terminate the process mid-send; the helper swallows its
  // own errors so a downed Resend can never block the HTTP response.
  await sendOrganiseRequestEmail({
    name,
    phone,
    email: email || undefined,
    area: area || undefined,
    addressNotes: addressNotes || undefined,
    eventDates,
    eventTime: eventTime || undefined,
    quantityType,
    quantityValue,
    packageTier,
    notes: notes || undefined,
    source: source || undefined,
    requestId: saved.id,
    ipHash: ip,
  });

  return NextResponse.json({ ok: true, id: saved.id });
}
