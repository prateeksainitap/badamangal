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
 * AND stamps the verified badge in the same write — this is the normal
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
 * Edit a PENDING bhandara (typically a bot-ingested row from the
 * WhatsApp pipeline) and publish it in a single submit. All fields the
 * admin can fix in the edit form are written through to the database,
 * then status flips to APPROVED. If the "Verify" checkbox is on, the
 * verified badge stamps in the same write — matches the "called &
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

  // Tuesdays come in as one date per line — empty lines stripped.
  // Menu comes in comma-separated; we keep entries as-typed (the
  // public schema allows free-form strings here now).
  const tuesdayDates = str("tuesdayDates")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const menuArr = str("menu")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Build the menuHi by mirroring the English entries — without re-
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
//   • They auto-expire after 8 h via the public `expiresAt` field —
//     once `expiresAt < now()` the spot disappears from the city map
//     without admin intervention.
//   • Two statuses only: APPROVED (live) and REJECTED (delisted).
//     No PENDING / VERIFIED — spots are crowd-sourced and don't get a
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
 *  already passed, this won't make it visible again — use
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

/** Hard-delete a spot row. Use for spam — for normal hides, prefer
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
 * Hard-delete a bhandara row. Use sparingly — once gone, the row's
 * coords, organizer details, and photo URL are unrecoverable from
 * inside the app (Supabase Storage still has the photo file, just
 * disconnected from any record).
 *
 * Cascade behaviour: Spots that auto-linked to this bhandara have a
 * nullable `bhandaraId` foreign key (Prisma default `SetNull` for
 * optional relations), so they are NOT cascade-deleted — the spots
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
    /* ignore — the cascade will handle it */
  }
  await prisma.bhandara.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}
