"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, invalidateBhandaraQueryCache } from "@/lib/db";
import { slugify, ensureUniqueSlug } from "@/lib/slugify";
import { generateVolunteerCode } from "@/lib/volunteer-server";
import { deleteFromR2 } from "@/lib/r2";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  isAdmin,
  issueAdminCookie,
  requireAdmin,
  verifyAdminPassword,
} from "@/lib/admin-auth";

// Re-export so existing imports from this module keep working
// without churn (e.g. `import { isAdmin } from "@/app/admin/actions"`).
export { isAdmin, requireAdmin };

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  if (!verifyAdminPassword(password)) {
    redirect("/admin?error=1");
  }
  const c = await cookies();
  c.set(ADMIN_COOKIE, issueAdminCookie(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
  redirect("/admin");
}

/**
 * Admin-triggered manual news refresh.
 *
 * Same underlying aggregator as:
 *   • the daily Vercel Cron at 06:00 IST (see vercel.json)
 *   • the legacy X-News-Refresh-Token external cron
 * Just behind an admin cookie instead of a Bearer token. Use the
 * "Refresh news" button on /admin when you want fresh items NOW
 * instead of waiting for the next scheduled tick.
 *
 * Why dynamic import: news-aggregator pulls in an inline RSS parser
 * + four feed fetchers + an OG-image scraper. Importing it at the
 * top of actions.ts would bundle that weight into every chunk that
 * uses any admin action (approval, rejection, verification, etc).
 * The import-inside-action pattern keeps the aggregator code out
 * of those chunks and only loads it when refresh is actually run.
 *
 * Redirect happens AFTER the try/catch so we never accidentally
 * catch redirect()'s thrown control-flow error. Query param tells
 * the admin page which banner to show on the next render.
 */
export async function refreshNewsAction(_formData?: FormData): Promise<void> {
  await requireAdmin();
  let success = true;
  try {
    const { refreshNews } = await import("@/lib/news-aggregator");
    await refreshNews();
    revalidatePath("/resources/news");
    revalidatePath("/resources");
  } catch (err) {
    success = false;
    console.error("admin news refresh failed", err);
  }
  redirect(success ? "/admin?news=refreshed" : "/admin?news=failed");
}

export async function approveAction(id: string, _formData?: FormData): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  // Drop the in-process Bhandara cache so the next /bhandara/[slug]
  // regeneration reads fresh. See lib/db.ts MUTATION CONTRACT.
  invalidateBhandaraQueryCache();
  revalidatePath("/admin", "layout");
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
  invalidateBhandaraQueryCache();
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}

export async function rejectAction(id: string, _formData?: FormData): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  // Previously only revalidated /admin, which left a previously-
  // APPROVED bhandara lingering on the homepage map and its own
  // /bhandara/[slug] detail page until the next 5-min ISR window
  // expired. Reject is a real public-state change → revalidate the
  // public surfaces too + drop the in-process cache.
  invalidateBhandaraQueryCache();
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
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
  invalidateBhandaraQueryCache();
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}

export async function unverifyAction(id: string, _formData?: FormData): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: { isVerified: false },
  });
  invalidateBhandaraQueryCache();
  revalidatePath("/admin", "layout");
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
  // Admin "feature on homepage" toggle. Lands the bhandara in the
  // highest-priority bucket of FeaturedBhandaras' pickFeatured (see
  // src/components/FeaturedBhandaras.tsx), beating today's-bhandara
  // + verified-with-photo etc.
  const featured = formData.get("isFeatured") === "on";

  // Photo handling — three states, same contract as the spot edit
  // action: leave alone, replace, or remove. `removePhoto=1` is set
  // by AdminPhotoField's "Remove photo" button and is the only way
  // to explicitly null the column from the UI.
  const wantsPhotoRemoval = str("removePhoto") === "1";
  let photoForUpdate: string | null = str("photoUrl");
  if (wantsPhotoRemoval) {
    const existing = await prisma.bhandara.findUnique({
      where: { id },
      select: { photoUrl: true },
    });
    if (existing?.photoUrl) {
      await deleteFromR2(existing.photoUrl).catch((err) =>
        console.warn(
          "[editAndPublishAction] R2 evict on remove failed",
          err,
        ),
      );
    }
    photoForUpdate = null;
  }

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
      photoUrl: photoForUpdate,
      googleMapsUrl: `https://www.google.com/maps?q=${num("lat")},${num("lng")}&z=18`,
      status: "APPROVED",
      approvedAt: new Date(),
      isVerified: verify,
      isFeatured: featured,
    },
  });

  // CRITICAL: invalidate the in-process Bhandara cache before
  // revalidating Next's HTML cache. Without this, the next
  // /bhandara/[slug] regeneration reads the cached stale Promise
  // and re-renders the OLD photoUrl / fields, see lib/db.ts
  // MUTATION CONTRACT for the full story. This was the bug behind
  // "I uploaded a new photo but the detail page won't update."
  invalidateBhandaraQueryCache();
  revalidatePath("/admin", "layout");
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
  // photoUrl is fed by AdminPhotoField via a hidden form input. If the
  // admin never replaced the image it round-trips as the original DB
  // value; if they uploaded a new one, the field carries the new
  // Supabase URL. Three states the form can submit:
  //   1. unchanged    → photoUrl === DB value, leave it alone
  //   2. replaced     → photoUrl is a new URL, overwrite
  //   3. removed      → removePhoto === "1", drop the column to null +
  //                     evict the file from R2
  // The legacy "empty string means leave it alone" path is preserved
  // for back-compat with any caller that submits photoUrl="" without
  // also flipping removePhoto.
  const newPhotoUrl = str("photoUrl");
  const wantsRemoval = str("removePhoto") === "1";
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
  if (wantsRemoval) {
    // Snapshot the existing photo URL before we null it so we can
    // evict the R2 object. If R2 eviction fails we still null the DB
    // — the orphaned file is a much smaller problem than a column
    // pointing at a deleted bucket key.
    const existing = await prisma.spot.findUnique({
      where: { id },
      select: { photoUrl: true },
    });
    data.photoUrl = null;
    if (existing?.photoUrl) {
      await deleteFromR2(existing.photoUrl).catch((err) =>
        console.warn(
          "[editAndApproveSpotAction] R2 evict on remove failed",
          err,
        ),
      );
    }
  } else if (newPhotoUrl) {
    data.photoUrl = newPhotoUrl;
  }
  if (ttlChoice === "reset") {
    data.expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  }

  await prisma.spot.update({ where: { id }, data });

  revalidatePath("/admin", "layout");
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
  // Drop the in-process Bhandara cache + revalidate detail pages
  // too. Even though the bot rows are usually PENDING (so they
  // never made it to the public site), defensive consistency: if
  // ANY of them ever got promoted to APPROVED before the admin
  // hit this button, the detail page would 404 on next visit
  // unless we kick off a regeneration.
  invalidateBhandaraQueryCache();
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
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
  revalidatePath("/admin", "layout");
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
  revalidatePath("/admin", "layout");
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
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** Hard-delete a spot row. Use for spam, for normal hides, prefer
 *  `delistSpotAction` (status flip) which is reversible.
 *
 *  Also drops the spot's primary photo + every extra photo from R2.
 *  Best-effort, R2 delete failure doesn't fail the action (the DB
 *  row is what visitors see; an orphan R2 object eats storage but
 *  is invisible). Was previously silent orphan accumulation. */
export async function deleteSpotAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  // Fetch URLs BEFORE the delete so we know which keys to evict.
  const row = await prisma.spot.findUnique({
    where: { id },
    select: { photoUrl: true, extraPhotoUrls: true },
  });
  await prisma.spot.delete({ where: { id } });
  // Now best-effort evict from R2 (only the URLs that actually
  // point at our R2 public domain are touched; deleteFromR2 itself
  // ignores Supabase-era URLs that legacy spots may still carry).
  if (row?.photoUrl) {
    await deleteFromR2(row.photoUrl).catch((err) =>
      console.warn("[deleteSpotAction] R2 evict failed (photoUrl)", err),
    );
  }
  if (row?.extraPhotoUrls && row.extraPhotoUrls !== "[]") {
    try {
      const arr = JSON.parse(row.extraPhotoUrls);
      if (Array.isArray(arr)) {
        for (const u of arr) {
          if (typeof u !== "string") continue;
          await deleteFromR2(u).catch((err) =>
            console.warn("[deleteSpotAction] R2 evict failed (extra)", err),
          );
        }
      }
    } catch {
      /* malformed JSON, nothing to evict */
    }
  }
  revalidatePath("/admin", "layout");
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
  // Capture photoUrl before delete so we can evict from R2 below.
  const row = await prisma.bhandara.findUnique({
    where: { id },
    select: { photoUrl: true },
  });
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
  invalidateBhandaraQueryCache();
  // Best-effort R2 evict so deleted bhandara photos don't pile up
  // forever (R2 free tier is 10 GB; over a few seasons of bot
  // ingest churn the orphan accumulation matters). deleteFromR2
  // returns false silently for non-R2 URLs (Supabase-era photos).
  if (row?.photoUrl) {
    await deleteFromR2(row.photoUrl).catch((err) =>
      console.warn("[deleteBhandaraAction] R2 evict failed", err),
    );
  }
  revalidatePath("/admin", "layout");
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
  revalidatePath("/admin", "layout");
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

// ────────────────────────────────────────────────────────────────────
// Volunteer-programme moderation actions
// ────────────────────────────────────────────────────────────────────
//
// Lifecycle of a VolunteerSubmission:
//   NEW       → fresh from the volunteer, awaiting admin review
//   APPROVED  → admin approved → ₹50 owed + auto-created Bhandara
//               + Spot rows (linked back via resultingBhandara/SpotId)
//   PARTIAL   → admin gave partial credit (₹25) → still creates
//               Bhandara + Spot if photos were enough
//   REJECTED  → fraud / unusable / no payout. Does NOT create
//               Bhandara/Spot. Reversible (admin can flip back to
//               NEW for re-review).
//   DUPLICATE → admin flagged this as a re-submission of an already-
//               listed bhandara. ₹0 payout.
//
// approve / partial both auto-create a Bhandara row (status=PENDING)
// from the submission data, so the listing is in the admin queue
// for editing/polish before going public. We don't auto-publish
// because the volunteer's text fields can be sparse/typo'd, and
// /admin/edit/[id] already exists for the polish step.
//
// The spot auto-creates as APPROVED (volunteer was physically there,
// 8h TTL starts now, fits the spot model's "right now" semantics).

const VOLUNTEER_PAYOUT_FULL = 50;
const VOLUNTEER_PAYOUT_PARTIAL = 25;

/**
 * Shared write: flip a VolunteerSubmission to a new status +
 * payout amount, and optionally create the linked Bhandara + Spot
 * rows. Idempotent for the Bhandara/Spot creation, if the
 * submission already has resultingBhandaraId / resultingSpotId set,
 * we skip the create to avoid duplicate listings on a double-click.
 */
async function setVolunteerSubmissionStatus(
  id: string,
  newStatus: "APPROVED" | "PARTIAL" | "REJECTED" | "DUPLICATE" | "NEW",
  payoutAmount: number,
  shouldCreateBhandaraAndSpot: boolean,
): Promise<void> {
  const sub = await prisma.volunteerSubmission.findUnique({
    where: { id },
    include: { volunteer: { select: { name: true, phone: true } } },
  });
  if (!sub) return;

  let resultingBhandaraId = sub.resultingBhandaraId;
  let resultingSpotId = sub.resultingSpotId;

  if (shouldCreateBhandaraAndSpot) {
    // Bhandara: create if we don't already have one for this
    // submission. Status PENDING so admin can edit/polish via the
    // existing /admin/edit/[id] flow before flipping to APPROVED.
    if (!resultingBhandaraId) {
      const photoUrls = safeParseUrls(sub.photoUrls);
      const heroPhoto = photoUrls[0] ?? sub.spotPhotoUrl ?? null;
      const baseSlug = slugify(sub.bhandaraName || "bhandara");
      const slug = await ensureUniqueSlug(baseSlug);
      const today = new Date().toISOString().slice(0, 10);
      const newBhandara = await prisma.bhandara.create({
        data: {
          slug,
          name: sub.bhandaraName,
          nameHi: null,
          description: `Submitted by volunteer ${sub.volunteerCode} on ${today}. ${sub.volunteerNotes ?? ""}`.trim(),
          descriptionHi: null,
          area: sub.area,
          address: sub.address,
          addressHi: null,
          landmark: null,
          lat: sub.gpsLat ?? 0,
          lng: sub.gpsLng ?? 0,
          tuesdayDates: JSON.stringify([today]),
          timeStart: sub.startTime ?? "09:00",
          timeEnd: "", // non-nullable in schema; admin can fill via /admin/edit/[id]
          menu: JSON.stringify(
            (sub.menu ?? "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
          menuHi: JSON.stringify([]),
          organizerName: sub.organizerName ?? sub.volunteer.name,
          organizerPhone: sub.organizerPhone ?? "",
          organizerWhatsapp: null,
          upiId: null,
          photoUrl: heroPhoto,
          googleMapsUrl:
            sub.mapsUrl ||
            (sub.gpsLat && sub.gpsLng
              ? `https://www.google.com/maps?q=${sub.gpsLat},${sub.gpsLng}&z=18`
              : null),
          status: "PENDING", // admin can flip to APPROVED via /admin/edit/[id]
          isVerified: false,
        },
        select: { id: true },
      });
      resultingBhandaraId = newBhandara.id;
    }

    // Spot: create only if we have a spot photo AND none exists yet.
    if (sub.spotPhotoUrl && !resultingSpotId) {
      const eightHours = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const newSpot = await prisma.spot.create({
        data: {
          caption: `Live at ${sub.bhandaraName} · ${sub.area}`,
          area: sub.area,
          address: sub.address,
          language: "mixed",
          lat: sub.gpsLat ?? 0,
          lng: sub.gpsLng ?? 0,
          photoUrl: sub.spotPhotoUrl,
          reporterName: sub.volunteer.name,
          bhandaraId: resultingBhandaraId,
          status: "APPROVED",
          expiresAt: eightHours,
          ipHash: `volunteer:${sub.volunteerCode}`,
          userAgent: sub.userAgent,
        },
        select: { id: true },
      });
      resultingSpotId = newSpot.id;
    }
  }

  await prisma.volunteerSubmission.update({
    where: { id },
    data: {
      status: newStatus,
      payoutAmount,
      reviewedAt: new Date(),
      resultingBhandaraId,
      resultingSpotId,
    },
  });

  // Bhandara + Spot creation touches the public site, so invalidate
  // the relevant caches even if we only created one of them.
  if (shouldCreateBhandaraAndSpot && (resultingBhandaraId || resultingSpotId)) {
    invalidateBhandaraQueryCache();
    revalidatePath("/");
    revalidatePath(`/bhandara/[slug]`, "page");
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/volunteer-submissions");
}

/** Approve = full ₹50 + create Bhandara/Spot. */
export async function approveVolunteerSubmissionAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await setVolunteerSubmissionStatus(id, "APPROVED", VOLUNTEER_PAYOUT_FULL, true);
}

/** Partial = ₹25 + still create Bhandara/Spot (data was useful). */
export async function partialVolunteerSubmissionAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await setVolunteerSubmissionStatus(id, "PARTIAL", VOLUNTEER_PAYOUT_PARTIAL, true);
}

/** Reject = ₹0, no Bhandara, no Spot. Reversible. */
export async function rejectVolunteerSubmissionAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await setVolunteerSubmissionStatus(id, "REJECTED", 0, false);
}

/** Mark as duplicate of an existing listing. ₹0 payout. */
export async function markVolunteerSubmissionDuplicateAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await setVolunteerSubmissionStatus(id, "DUPLICATE", 0, false);
}

/** Re-open a previously-reviewed submission for another look. */
export async function reopenVolunteerSubmissionAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await setVolunteerSubmissionStatus(id, "NEW", 0, false);
}

/**
 * Mark a single submission as paid. Sets `paidAt = now` and stores
 * the UPI transaction ref if provided. The CSV export at
 * /admin/volunteers handles the bulk path; this exists for one-off
 * manual reconciliation (e.g. you paid a volunteer outside the
 * weekly batch).
 */
export async function markVolunteerSubmissionPaidAction(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const ref = String(formData.get("paymentRef") ?? "").trim().slice(0, 80);
  await prisma.volunteerSubmission.update({
    where: { id },
    data: {
      paidAt: new Date(),
      paymentRef: ref || null,
    },
  });
  revalidatePath("/admin/volunteer-submissions");
  revalidatePath("/admin/volunteers");
}

/**
 * Bulk mark every APPROVED/PARTIAL submission with paidAt=NULL as
 * paid. Use after running a weekly UPI batch, saves the admin from
 * clicking through each row. Takes no formData (no per-row UPI ref).
 */
export async function markAllVolunteerSubmissionsPaidAction(
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  const now = new Date();
  await prisma.volunteerSubmission.updateMany({
    where: {
      status: { in: ["APPROVED", "PARTIAL"] },
      paidAt: null,
    },
    data: { paidAt: now },
  });
  revalidatePath("/admin/volunteer-submissions");
  revalidatePath("/admin/volunteers");
}

/** Flip a volunteer between PROBATIONARY / TRUSTED / SUSPENDED. */
export async function setVolunteerStatusAction(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const status = String(formData.get("status") ?? "");
  const allowed = ["PROBATIONARY", "TRUSTED", "SUSPENDED"] as const;
  if (!(allowed as readonly string[]).includes(status)) return;
  await prisma.volunteer.update({
    where: { id },
    data: { status: status as (typeof allowed)[number] },
  });
  revalidatePath("/admin/volunteers");
}

/**
 * The PENDING → PROBATIONARY transition. Called from the admin
 * registry's "Approve & send code on WhatsApp" button.
 *
 * Does three things atomically (one DB write, one URL build):
 *   1. Generates a unique volunteer code (retries on the rare
 *      collision against the @@unique constraint).
 *   2. Flips status PENDING → PROBATIONARY + persists the code.
 *   3. Returns a pre-filled wa.me URL the client opens in a new
 *      tab. The admin hits "Send" in WhatsApp and the code lands
 *      on the volunteer's phone.
 *
 * Idempotent: if the volunteer already has a code (admin clicked
 * twice, or already approved earlier), we reuse the existing code
 * and rebuild the wa.me URL, same message, same outcome, no
 * duplicate codes generated.
 *
 * Why it's a server action returning data (vs a redirect): a
 * redirect to wa.me would navigate the admin AWAY from the admin
 * page. Returning the URL lets the client component open it in a
 * NEW tab and keep the admin on the registry so they can keep
 * approving the next pending volunteer without losing their place.
 */
export async function approveAndIssueVolunteerCodeAction(
  id: string,
): Promise<
  | { ok: true; code: string; waUrl: string; alreadyIssued: boolean }
  | { ok: false; error: string }
> {
  await requireAdmin();

  const volunteer = await prisma.volunteer.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, name: true, phone: true },
  });
  if (!volunteer) return { ok: false, error: "not_found" };
  if (volunteer.status === "SUSPENDED") {
    return { ok: false, error: "suspended" };
  }

  // Idempotent path: code already issued → reuse it.
  if (volunteer.code) {
    return {
      ok: true,
      code: volunteer.code,
      waUrl: buildVolunteerCodeWhatsappUrl({
        name: volunteer.name,
        phone: volunteer.phone,
        code: volunteer.code,
      }),
      alreadyIssued: true,
    };
  }

  // Generate + persist a new code. Up to 5 retries on the
  // astronomically rare unique-constraint collision (~1 in 729M).
  let issuedCode: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateVolunteerCode();
    try {
      await prisma.volunteer.update({
        where: { id },
        data: { code: candidate, status: "PROBATIONARY" },
      });
      issuedCode = candidate;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("P2002") && !msg.includes("Unique constraint")) {
        console.error("approveAndIssueVolunteerCode failed", err);
        return { ok: false, error: "db_error" };
      }
      // else: code collision, retry
    }
  }
  if (!issuedCode) {
    return { ok: false, error: "code_collision_exhausted" };
  }

  revalidatePath("/admin/volunteers");

  return {
    ok: true,
    code: issuedCode,
    waUrl: buildVolunteerCodeWhatsappUrl({
      name: volunteer.name,
      phone: volunteer.phone,
      code: issuedCode,
    }),
    alreadyIssued: false,
  };
}

/**
 * Mark a PENDING signup as SUSPENDED, for fake / spammy / clearly-
 * not-a-volunteer applications. Keeps the row in the DB (audit
 * trail) but ensures no code can ever be issued for it. The admin
 * can flip back to PENDING via setVolunteerStatusAction if rejection
 * was a mistake.
 */
export async function rejectVolunteerSignupAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await prisma.volunteer.update({
    where: { id },
    data: { status: "SUSPENDED" },
  });
  revalidatePath("/admin/volunteers");
}

/**
 * Build the wa.me deep-link the admin opens in a new tab to send
 * a fresh volunteer their code + first submission link.
 *
 * Plain text only, no emojis. WhatsApp Web's preview pane uses a
 * font without emoji support and renders them as `�` replacement
 * glyphs (the actual delivered message would be fine, but the
 * preview looks broken, better to ship text that's bulletproof
 * across every WA client + version). Bilingual: Hindi block first,
 * English block second, separated by a simple text divider.
 *
 * No em dashes either (site-wide style rule).
 */
function buildVolunteerCodeWhatsappUrl(args: {
  name: string;
  phone: string; // 10 digits, no +91
  code: string;
}): string {
  const submitUrl = `https://badamangal.com/volunteer/submit?code=${args.code}`;
  const message =
    `*जय बजरंगबली*\n\n` +
    `नमस्कार ${args.name} जी,\n\n` +
    `BadaMangal volunteer programme में आपका स्वागत है। आपका आवेदन स्वीकृत हो गया है।\n\n` +
    `*आपका volunteer code:*\n*${args.code}*\n\n` +
    `*पहला भण्डारा submit करें:*\n${submitUrl}\n\n` +
    `यह code save कर लीजिए। हर submission में इसकी ज़रूरत होगी।\n\n` +
    `==========\n\n` +
    `Welcome to the BadaMangal volunteer programme. Your application is approved.\n\n` +
    `*Your volunteer code:* *${args.code}*\n` +
    `*Submit your first bhandara:* ${submitUrl}\n\n` +
    `Save this code. You will need it for every submission.\n\n` +
    `धन्यवाद · Dhanyavaad\nBadaMangal Team`;
  return `https://wa.me/91${args.phone}?text=${encodeURIComponent(message)}`;
}

/** Helper: parse a JSON-encoded URL list, tolerant of legacy/empty. */
function safeParseUrls(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/**
 * Admin-only: add a photo to the homepage GalleryPhoto table.
 * Called from /admin/gallery's upload form.
 *
 * Required FormData fields:
 *   - imageUrl: a Supabase storage URL (typically just-uploaded via
 *     /api/uploads, the admin gallery page uploads first, then
 *     submits this action with the resulting URL)
 *
 * Optional FormData fields:
 *   - caption / captionHi: 0-140 chars
 *   - uploadedBy: free-form (Prateek, Akanksha, etc.)
 *   - displayOrder: lower = surfaces earlier. Defaults to 100.
 */
export async function addGalleryPhotoAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  if (!imageUrl) return;
  const caption = String(formData.get("caption") ?? "").trim().slice(0, 140) || null;
  const captionHi = String(formData.get("captionHi") ?? "").trim().slice(0, 140) || null;
  const uploadedBy = String(formData.get("uploadedBy") ?? "").trim().slice(0, 60) || null;
  const orderRaw = Number(formData.get("displayOrder") ?? "100");
  const displayOrder = Number.isFinite(orderRaw) ? Math.max(0, Math.min(9999, orderRaw)) : 100;

  await prisma.galleryPhoto.create({
    data: { imageUrl, caption, captionHi, uploadedBy, displayOrder, status: "VISIBLE" },
  });
  revalidatePath("/admin/gallery");
  revalidatePath("/");
}

/** Admin-only: flip a GalleryPhoto to HIDDEN (soft delete; row stays
 *  for forensic / audit reasons but never renders publicly). */
export async function hideGalleryPhotoAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.galleryPhoto.update({
    where: { id },
    data: { status: "HIDDEN" },
  });
  revalidatePath("/admin/gallery");
  revalidatePath("/");
}

/** Admin-only: flip a HIDDEN GalleryPhoto back to VISIBLE. */
export async function unhideGalleryPhotoAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.galleryPhoto.update({
    where: { id },
    data: { status: "VISIBLE" },
  });
  revalidatePath("/admin/gallery");
  revalidatePath("/");
}

// ────────────────────────────────────────────────────────────────────
// BhandaraMention (WhatsApp text-message ingest) moderation actions
// ────────────────────────────────────────────────────────────────────
//
// Mentions land in PENDING state from /api/bot/message. Admins flip
// them to APPROVED (visible on public LiveChatterBoard + heatmap) or
// REJECTED (hidden but kept for audit + classifier-tuning feedback).
// All three actions revalidate both /admin and / so the homepage feed
// + heatmap pick up the change on next render.

/** Promote a PENDING mention to APPROVED so it surfaces on the public
 *  homepage feed + heatmap until `expiresAt`. Idempotent — re-running
 *  on an already-APPROVED mention is a no-op besides bumping
 *  approvedAt. */
export async function approveMentionAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await prisma.bhandaraMention.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** Hide a mention from the public surfaces. Reversible via
 *  approveMentionAction. We keep the row (not delete) because the
 *  classifier-feedback loop wants to see what got rejected and why. */
export async function rejectMentionAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await prisma.bhandaraMention.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** Push a mention's `expiresAt` 24 hours into the future from *now*.
 *  Useful when a particularly good location-share deserves a longer
 *  lifespan on the heatmap (e.g. a multi-Tuesday recurring bhandara
 *  that someone shared once on the first Tuesday). Resets the public
 *  window without re-approving — the mention must already be APPROVED
 *  for this to surface visibly. */
export async function extendMentionAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await prisma.bhandaraMention.update({
    where: { id },
    data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** One-shot maintenance action: hard-delete every PENDING mention older
 *  than 7 days. Mirrors clearBotQueueAction's "wipe the queue" workflow
 *  for the rare case where the classifier mis-tunes and the queue fills
 *  with garbage before the admin can triage. APPROVED + REJECTED rows
 *  are preserved (they're either live or part of the audit trail). */
export async function purgeStaleMentionsAction(): Promise<void> {
  await requireAdmin();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.bhandaraMention.deleteMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
  });
  revalidatePath("/admin", "layout");
}

// ────────────────────────────────────────────────────────────────────
// Bhandara discovery (admin /admin/discover → PENDING bhandara)
// ────────────────────────────────────────────────────────────────────
//
// Adds a single discovered candidate (one card from the /admin/discover
// results) as a PENDING Bhandara row. The admin lands on the edit page
// immediately after, where MapLocationInput + the rest of the bhandara
// form let them fill in the missing pieces (coords, menu, exact
// timings) before clicking Save & publish.
//
// Status is PENDING — discovered rows MUST be reviewed before going
// public, even when Gemini reports high confidence. The grounding
// source could be a stale 2024 blog post or a misattributed event.
// The same review gate as bot/ingest rows.

/** Server-action variant: receives the discovered fields via FormData
 *  (admin-discover client form serialises the candidate as hidden
 *  inputs). Creates a PENDING Bhandara, embeds a provenance tag in
 *  description so the admin can spot discovery-sourced rows in the
 *  main queue, and redirects to /admin/edit/[id]. */
export async function addDiscoveredBhandaraAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const str = (k: string): string => String(formData.get(k) ?? "").trim();
  const name = str("name");
  if (!name) redirect("/admin/discover?error=missing_name");

  const nameHi = str("nameHi") || null;
  const area = str("area");
  const address = str("address") || "Address pending admin review";
  const addressHi = str("addressHi") || null;
  const landmark = str("landmark") || null;
  const organizerName = str("organizerName");
  const organizerPhone = str("organizerPhone");
  const description = str("description");
  const timeStart = str("timeStart") || "11:00";
  const timeEnd = str("timeEnd") || "";

  // tuesdayDates + sources arrive as JSON-encoded strings from the
  // hidden inputs (FormData can't carry arrays directly). Parse
  // defensively; treat malformed JSON as empty arrays rather than
  // erroring out (loses the dates but creates the row).
  let tuesdayDates: string[] = [];
  try {
    const raw = str("tuesdayDates");
    tuesdayDates = raw ? (JSON.parse(raw) as string[]) : [];
    if (!Array.isArray(tuesdayDates)) tuesdayDates = [];
  } catch {
    tuesdayDates = [];
  }

  let sources: { url: string; title?: string }[] = [];
  try {
    const raw = str("sources");
    sources = raw ? (JSON.parse(raw) as typeof sources) : [];
    if (!Array.isArray(sources)) sources = [];
  } catch {
    sources = [];
  }

  // Provenance tag mirrors the [bot:whatsapp …] grammar so the same
  // stripBotProvenance regex catches it on every public surface
  // without any regex changes. The "src:discovery" prefix
  // distinguishes admin-discovered rows from WhatsApp-ingested ones
  // in the admin queue (parseBotTag in /admin/page.tsx can be
  // extended to surface this differently).
  const timestamp = new Date().toISOString().slice(0, 19) + "Z";
  const sourceList = sources
    .slice(0, 3)
    .map((s) => s.url)
    .join(", ");
  const provenanceTag = `[bot:whatsapp · from:admin-discover · src:google-search · ${timestamp}${sourceList ? ` · sources:${sourceList.slice(0, 200)}` : ""}]`;
  const fullDescription = [description, provenanceTag]
    .filter(Boolean)
    .join("\n\n");

  // Slug generation mirrors the bhandara create path: slugify the
  // name, ensure unique. Discovery flow can legitimately produce two
  // candidates with the same name (e.g. one bhandara in two areas);
  // ensureUniqueSlug appends a -2 / -3 suffix as needed.
  const baseSlug = slugify(name);
  const slug = await ensureUniqueSlug(baseSlug);

  const row = await prisma.bhandara.create({
    data: {
      slug,
      name,
      nameHi,
      description: fullDescription,
      descriptionHi: null,
      area: area || "",
      address,
      addressHi,
      landmark,
      // 0,0 forces the admin to set real coords on the edit page via
      // MapLocationInput. Discovery results almost never include
      // accurate lat/lng — extracting "26.876, 80.929" out of a blog
      // post URL is fragile, so we don't try.
      lat: 0,
      lng: 0,
      tuesdayDates: JSON.stringify(tuesdayDates),
      timeStart,
      timeEnd,
      menu: JSON.stringify([]),
      menuHi: JSON.stringify([]),
      organizerName,
      organizerPhone,
      photoUrl: null,
      status: "PENDING",
    },
  });

  revalidatePath("/admin", "layout");
  // Drop the admin straight onto the edit page so they can fix
  // coords + menu + confirm the import landed correctly.
  redirect(`/admin/edit/${row.id}`);
}

/* ──────────────────────────────────────────────────────────────────
 *  BULK ACTIONS — multi-row operations from the moderation queue's
 *  selection bar. Each one takes a FormData with multiple `ids`
 *  values, fans the per-id mutation in a single Prisma updateMany
 *  (faster + atomic-ish via Postgres) where possible, falling back
 *  to a loop for actions that need per-row logic.
 *
 *  All bulk actions revalidate the admin layout so every queue + the
 *  dashboard refresh after the bulk write.
 * ────────────────────────────────────────────────────────────── */

/** Parse a `name="ids"` multi-value FormData entry into a clean
 *  string[]. Trims whitespace, drops empties, caps at 200 to keep
 *  any future "select all" from accidentally issuing a giant
 *  query. */
function parseIds(formData: FormData): string[] {
  const raw = formData.getAll("ids");
  const ids = raw
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((s) => s.length > 0 && s.length < 64);
  return Array.from(new Set(ids)).slice(0, 200);
}

/** Bulk publish PENDING bhandaras as VERIFIED. Same effect as
 *  hitting "Verify & publish" on every selected row. Idempotent —
 *  rows already APPROVED+verified are skipped by the where clause. */
export async function bulkVerifyBhandarasAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const ids = parseIds(formData);
  if (ids.length === 0) return;
  await prisma.bhandara.updateMany({
    where: { id: { in: ids } },
    data: { status: "APPROVED", isVerified: true, approvedAt: new Date() },
  });
  invalidateBhandaraQueryCache();
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** Bulk publish without verified badge (status=APPROVED, leaves
 *  isVerified at its current value, false by default for PENDING
 *  rows). Same effect as hitting "Publish (no badge)" on every
 *  selected row. */
export async function bulkApproveBhandarasAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const ids = parseIds(formData);
  if (ids.length === 0) return;
  await prisma.bhandara.updateMany({
    where: { id: { in: ids } },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  invalidateBhandaraQueryCache();
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** Bulk reject (status=REJECTED). Mirrors per-row rejectAction. */
export async function bulkRejectBhandarasAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const ids = parseIds(formData);
  if (ids.length === 0) return;
  await prisma.bhandara.updateMany({
    where: { id: { in: ids } },
    data: { status: "REJECTED" },
  });
  invalidateBhandaraQueryCache();
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** Bulk hard-delete bhandaras + their photos. Same effect as
 *  hitting "Delete" on every selected row. The per-row delete also
 *  evicts the R2 photo; for the bulk path we collect every photoUrl
 *  first, delete in DB, then fire R2 deletes in parallel. */
export async function bulkDeleteBhandarasAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const ids = parseIds(formData);
  if (ids.length === 0) return;
  const rows = await prisma.bhandara.findMany({
    where: { id: { in: ids } },
    select: { id: true, photoUrl: true },
  });
  await prisma.bhandara.deleteMany({ where: { id: { in: ids } } });
  // R2 cleanup is best-effort; never let a network error fail the
  // bulk action after the DB rows are already gone.
  await Promise.allSettled(
    rows
      .filter((r): r is { id: string; photoUrl: string } => Boolean(r.photoUrl))
      .map((r) => deleteFromR2(r.photoUrl)),
  );
  invalidateBhandaraQueryCache();
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** Bulk delist (= reject) spots. Mirrors per-row delistSpotAction. */
export async function bulkDelistSpotsAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const ids = parseIds(formData);
  if (ids.length === 0) return;
  await prisma.spot.updateMany({
    where: { id: { in: ids } },
    data: { status: "REJECTED" },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** Bulk approve mentions. Mirrors per-row approveMentionAction. */
export async function bulkApproveMentionsAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const ids = parseIds(formData);
  if (ids.length === 0) return;
  await prisma.bhandaraMention.updateMany({
    where: { id: { in: ids } },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

/** Bulk reject mentions. Mirrors per-row rejectMentionAction. */
export async function bulkRejectMentionsAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const ids = parseIds(formData);
  if (ids.length === 0) return;
  await prisma.bhandaraMention.updateMany({
    where: { id: { in: ids } },
    data: { status: "REJECTED" },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}
