"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

const COOKIE = "admin";

async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const c = await cookies();
  return c.get(COOKIE)?.value === expected;
}

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized");
  }
}

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) {
    redirect("/admin?error=1");
  }
  const c = await cookies();
  c.set(COOKIE, password, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
  redirect("/admin");
}

export async function approveAction(id: string, _formData?: FormData): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}

/**
 * One-click "we called the organizer and confirmed" action used from the
 * PENDING moderation queue. Flips the listing live (status → APPROVED)
 * AND stamps the verified badge in the same write, this is the normal
 * flow for the Option-4 model where every submission starts hidden and
 * publish == verify.
 */
export async function publishVerifiedAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: {
      status: "APPROVED",
      isVerified: true,
      approvedAt: new Date(),
    },
  });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}

export async function rejectAction(id: string, _formData?: FormData): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  revalidatePath("/admin");
}

/**
 * Flip the human-verification flag on an APPROVED listing. The bhandara is
 * already live; this just adds the green "Verified" badge once the
 * BadaMangal team has confirmed the details by phone.
 */
export async function verifyAction(id: string, _formData?: FormData): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: { isVerified: true },
  });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}

export async function unverifyAction(id: string, _formData?: FormData): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: { isVerified: false },
  });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}

/**
 * Coerce a date string from the admin edit form into the canonical
 * YYYY-MM-DD ISO format the DB row stores.
 *
 * Accepts:
 *   • DD-MM-YYYY → flipped to YYYY-MM-DD  (the admin form's display format)
 *   • YYYY-MM-DD → returned unchanged     (legacy rows + already-ISO pastes)
 * Anything else (typos, partial dates, day-month names) returns "" so
 * the caller can `.filter(Boolean)` it out. Dropping a malformed line
 * is safer than persisting garbage that would break the upcoming-date
 * filter in /bhandara/[slug] and emit invalid JSON-LD Event entries.
 */
function normalizeTuesdayDate(s: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return "";
}

/**
 * Edit a PENDING bhandara (typically a bot-ingested row from the
 * WhatsApp pipeline) and publish it in a single submit. All fields the
 * admin can fix in the edit form are written through to the database,
 * then status flips to APPROVED. If the "Verify" checkbox is on, the
 * verified badge stamps in the same write, matches the "called &
 * confirmed, publish" muscle memory from the row-level action cluster.
 *
 * Field-level validation is intentionally lenient: the bot row may have
 * lat/lng=0 and an empty area because Gemini couldn't read them off
 * the banner; we trust the admin to fill those in correctly. Numeric
 * parses default to 0 so a stray empty input doesn't crash the action.
 */
export async function editAndPublishAction(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const str = (k: string, fallback = ""): string =>
    String(formData.get(k) ?? fallback).trim();
  const num = (k: string, fallback = 0): number => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) ? v : fallback;
  };

  // Tuesdays come in as one date per line, empty lines stripped.
  // The admin edit form now displays + accepts DD-MM-YYYY, but the
  // DB has to keep YYYY-MM-DD ISO because /bhandara/[slug]'s
  // upcoming-Tuesday picker compares lexically (d >= todayIso).
  // normalizeTuesdayDate converts admin-friendly DD-MM-YYYY → ISO,
  // passes through ISO unchanged (legacy rows + admin pastes that
  // happen to already be ISO), and drops anything else so a malformed
  // line can't poison the JSON-LD Event schema downstream.
  // Menu comes in comma-separated; we keep entries as-typed (the
  // public schema allows free-form strings here now).
  const tuesdayDates = str("tuesdayDates")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeTuesdayDate)
    .filter(Boolean);
  const menuArr = str("menu")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Build the menuHi by mirroring the English entries, without re-
  // running Gemini we don't have Devanagari translations for the
  // admin-edited values. The public detail page renders nameHi where
  // available; menu strings tend to be short Latin transliterations
  // ("puri, sabzi, prasad") in practice. Future work: optionally
  // re-translate menu items via Gemini on save.
  const verify = formData.get("isVerified") === "on";

  await prisma.bhandara.update({
    where: { id },
    data: {
      name: str("name"),
      nameHi: str("nameHi") || null,
      description: str("description") || null,
      descriptionHi: str("descriptionHi") || null,
      area: str("area"),
      address: str("address"),
      addressHi: str("addressHi") || null,
      landmark: str("landmark") || null,
      lat: num("lat"),
      lng: num("lng"),
      tuesdayDates: JSON.stringify(tuesdayDates),
      timeStart: str("timeStart"),
      timeEnd: str("timeEnd"),
      menu: JSON.stringify(menuArr),
      menuHi: JSON.stringify(menuArr),
      organizerName: str("organizerName"),
      organizerPhone: str("organizerPhone"),
      organizerWhatsapp: str("organizerWhatsapp") || null,
      upiId: str("upiId") || null,
      photoUrl: str("photoUrl"),
      googleMapsUrl: `https://www.google.com/maps?q=${num("lat")},${num("lng")}&z=18`,
      status: "APPROVED",
      approvedAt: new Date(),
      isVerified: verify,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
  redirect("/admin");
}

/**
 * Edit a Spot's editable fields and approve it in a single submit.
 * Mirrors editAndPublishAction for bhandaras: lets the admin fix what
 * the model got wrong (caption text, area, address, coords) before
 * the photo goes live on the city map. Optionally extends or sets
 * `expiresAt` so the admin can give a freshly-reviewed spot the full
 * 8-hour TTL instead of inheriting whatever was left from upload time.
 *
 * Status flips to APPROVED on save, even from REJECTED, so the
 * "Edit" CTA on a previously-rejected spot doubles as a re-approve.
 */
export async function editAndApproveSpotAction(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const str = (k: string, fallback = ""): string =>
    String(formData.get(k) ?? fallback).trim();
  const num = (k: string, fallback = 0): number => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) ? v : fallback;
  };

  // Language is a 3-way enum; default to "mixed" so we never write an
  // invalid value if the form gets tampered with client-side.
  const rawLang = str("language").toLowerCase();
  const language: "hi" | "en" | "mixed" =
    rawLang === "hi" || rawLang === "en" ? rawLang : "mixed";

  // Optional TTL extension: "reset" rebases expiresAt to now + 8h so a
  // spot that's been sitting in PENDING for hours still gets its full
  // 8-hour window on the public map. "keep" preserves the existing
  // expiresAt, useful when you only edited a typo and want the
  // original TTL countdown intact.
  const ttlChoice = str("ttl");
  const data: Record<string, unknown> = {
    caption: str("caption") || null,
    area: str("area") || null,
    address: str("address") || null,
    language,
    lat: num("lat"),
    lng: num("lng"),
    reporterName: str("reporterName") || null,
    status: "APPROVED",
  };
  if (ttlChoice === "reset") {
    data.expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  }

  await prisma.spot.update({ where: { id }, data });

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin?type=whatsapp&status=spot");
}

/**
 * One-shot maintenance action: hard-delete every bot-ingested row
 * (bhandara + spot) so the admin can start the WhatsApp ingest queue
 * from a clean slate. Used initially to flush testing data, but kept
 * as a permanent feature for future "bot pumped junk during a power
 * outage" recoveries.
 *
 * Bhandara provenance is detected via the `[bot:` prefix that
 * /api/bot/ingest embeds into description. Spots are detected via
 * `ipHash = "bot:whatsapp"` (set at insert time by the same endpoint).
 * Hard-deleting is safe here because:
 *   • These rows have never been on the public map (status=PENDING,
 *     lat/lng=0). Even bot-classified spots are PENDING-by-default.
 *   • The original image still lives in Supabase storage; the admin
 *     can re-ingest by forwarding the WhatsApp message again.
 * Returns nothing; the redirect refreshes the WhatsApp-bot view.
 */
export async function clearBotQueueAction(): Promise<void> {
  await requireAdmin();
  await prisma.$transaction([
    prisma.bhandara.deleteMany({ where: { description: { contains: "[bot:" } } }),
    prisma.spot.deleteMany({ where: { ipHash: "bot:whatsapp" } }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin?type=whatsapp");
}

// ────────────────────────────────────────────────────────────────────
// Spot (live "spotted bhandara") moderation actions
// ────────────────────────────────────────────────────────────────────
//
// Spots are a lighter-weight cousin of Bhandara:
//   • They auto-expire after 8 h via the public `expiresAt` field,
//     once `expiresAt < now()` the spot disappears from the city map
//     without admin intervention.
//   • Two statuses only: APPROVED (live) and REJECTED (delisted).
//     No PENDING / VERIFIED, spots are crowd-sourced and don't get a
//     phone callback workflow.
// All four actions below mirror the bhandara verbs so the admin row
// card can use the same button cluster pattern for both kinds.

/** Hide a spot from the public map immediately. Reversible via approveSpotAction. */
export async function delistSpotAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await prisma.spot.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Flip a REJECTED spot back to APPROVED. Note: if its `expiresAt` has
 *  already passed, this won't make it visible again, use
 *  `extendSpotAction` first or in combination. */
export async function approveSpotAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await prisma.spot.update({
    where: { id },
    data: { status: "APPROVED" },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Push the spot's `expiresAt` 8 hours into the future from *now*
 *  (not from its current expiry). Lets the admin keep an interesting
 *  spot live for another window without recreating it. */
export async function extendSpotAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  const newExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await prisma.spot.update({
    where: { id },
    data: { expiresAt: newExpiry, status: "APPROVED" },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Hard-delete a spot row. Use for spam, for normal hides, prefer
 *  `delistSpotAction` (status flip) which is reversible. */
export async function deleteSpotAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await prisma.spot.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/");
}

/**
 * Hard-delete a bhandara row. Use sparingly, once gone, the row's
 * coords, organizer details, and photo URL are unrecoverable from
 * inside the app (Supabase Storage still has the photo file, just
 * disconnected from any record).
 *
 * Cascade behaviour: Spots that auto-linked to this bhandara have a
 * nullable `bhandaraId` foreign key (Prisma default `SetNull` for
 * optional relations), so they are NOT cascade-deleted, the spots
 * stay live but lose their "linked to Bhandara X" annotation.
 *
 * Most of the time the right move is `rejectAction` (delist) instead,
 * which keeps the row in the DB but hides it from the public map; this
 * action is for true duplicates / spam that should never have been in
 * the system at all.
 */
export async function deleteBhandaraAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  // Best-effort: null out any spot links first so the FK constraint
  // can't bite even if a future migration changes the default.
  try {
    await prisma.spot.updateMany({
      where: { bhandaraId: id },
      data: { bhandaraId: null },
    });
  } catch {
    /* ignore, the cascade will handle it */
  }
  await prisma.bhandara.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}

// ────────────────────────────────────────────────────────────────────
// Organise-Bhandara request moderation actions
// ────────────────────────────────────────────────────────────────────
//
// Lifecycle: NEW → CONTACTED (admin called the lead) →
// CONFIRMED (lead agreed to a quote/package) →
// COMPLETED (event happened, services delivered) → end.
// REJECTED at any point if the lead is junk / not a real request.
//
// Same shape as the bhandara row actions (id-bound, formData-second,
// requireAdmin, revalidate), so the admin queue can use the shared
// SubmitButton + form-action pattern for all moderation buttons.

const ORG_STATUSES = [
  "NEW",
  "CONTACTED",
  "CONFIRMED",
  "COMPLETED",
  "REJECTED",
] as const;
type OrganiseStatus = (typeof ORG_STATUSES)[number];

/** Generic status setter. Public-facing actions below bind specific
 *  statuses so the buttons in /admin/organise stay copy-pastable. */
async function setOrganiseRequestStatus(
  id: string,
  status: OrganiseStatus,
): Promise<void> {
  await requireAdmin();
  await prisma.organiseRequest.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/organise");
  revalidatePath("/admin");
}

export async function markOrganiseRequestContactedAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await setOrganiseRequestStatus(id, "CONTACTED");
}

export async function markOrganiseRequestConfirmedAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await setOrganiseRequestStatus(id, "CONFIRMED");
}

export async function markOrganiseRequestCompletedAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await setOrganiseRequestStatus(id, "COMPLETED");
}

export async function markOrganiseRequestRejectedAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await setOrganiseRequestStatus(id, "REJECTED");
}

export async function markOrganiseRequestNewAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  // Reopen a previously-closed request (e.g. lead called back after a
  // rejection). Useful when the team accidentally rejects the wrong row.
  await setOrganiseRequestStatus(id, "NEW");
}

/**
 * Hard-delete an OrganiseRequest. Use only for spam / duplicates;
 * for legitimate "lead didn't pan out" use markOrganiseRequestRejected
 * which keeps the audit trail.
 */
export async function deleteOrganiseRequestAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await prisma.organiseRequest.delete({ where: { id } });
  revalidatePath("/admin/organise");
}
