"use server";

/**
 * Inline dismiss action for the dashboard Live-chat activity feed.
 *
 * Each row in ActivityStream carries a prefixed id of the form
 * `{kind}:{realId}` (e.g. `spot:cmxyz123`, `bhandara:cmabc`,
 * `mention:cm456`). The single `dismissActivityEventAction` here
 * parses that prefix and dispatches to the right per-kind cleanup:
 *
 *   spot      → hard delete + R2 photo evict (same as deleteSpotAction)
 *   bhandara  → hard delete + R2 photo evict (same as deleteBhandaraAction)
 *   mention   → soft hide (status = REJECTED), preserves the row
 *               for audit so the bot doesn't keep re-forwarding
 *   volunteer → no-op (volunteers shouldn't be deleted from a feed;
 *               removed from the row list at the UI layer)
 *   system    → no-op (system events are informational)
 *
 * The UI ONLY surfaces the dismiss button on deletable kinds, so
 * the no-op branches here are belt-and-braces, protecting against
 * a hand-rolled POST that bypasses the button visibility check.
 *
 * Revalidates `/admin` (layout-level) so every dashboard tile, KPI,
 * activity stream, and downstream queue picks up the new state.
 */

import { revalidatePath } from "next/cache";
import { prisma, invalidateBhandaraQueryCache } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteFromR2 } from "@/lib/r2";

/** Parse "{kind}:{id}" → { kind, id }. Null on malformed input. */
function parseActivityId(s: string): { kind: string; id: string } | null {
  if (typeof s !== "string") return null;
  const idx = s.indexOf(":");
  if (idx <= 0 || idx === s.length - 1) return null;
  return { kind: s.slice(0, idx), id: s.slice(idx + 1) };
}

export async function dismissActivityEventAction(
  prefixedId: string,
): Promise<void> {
  await requireAdmin();
  const parsed = parseActivityId(prefixedId);
  if (!parsed) return;
  const { kind, id } = parsed;

  if (kind === "spot") {
    // Mirror deleteSpotAction: capture URLs, delete row, best-effort
    // R2 evict for main + extra photos so storage doesn't pile up.
    const row = await prisma.spot.findUnique({
      where: { id },
      select: { photoUrl: true, extraPhotoUrls: true },
    });
    await prisma.spot.delete({ where: { id } });
    if (row?.photoUrl) {
      await deleteFromR2(row.photoUrl).catch((err) =>
        console.warn("[dismissActivityEvent] R2 evict (spot)", err),
      );
    }
    if (row?.extraPhotoUrls && row.extraPhotoUrls !== "[]") {
      try {
        const arr = JSON.parse(row.extraPhotoUrls);
        if (Array.isArray(arr)) {
          for (const u of arr) {
            if (typeof u !== "string") continue;
            await deleteFromR2(u).catch(() => {});
          }
        }
      } catch {
        /* ignore JSON parse failure */
      }
    }
  } else if (kind === "bhandara") {
    // Mirror deleteBhandaraAction. Null out spot links first so the
    // FK doesn't bite, then delete, then evict.
    const row = await prisma.bhandara.findUnique({
      where: { id },
      select: { photoUrl: true },
    });
    try {
      await prisma.spot.updateMany({
        where: { bhandaraId: id },
        data: { bhandaraId: null },
      });
    } catch {
      /* ignore, cascade handles it */
    }
    await prisma.bhandara.delete({ where: { id } });
    invalidateBhandaraQueryCache();
    if (row?.photoUrl) {
      await deleteFromR2(row.photoUrl).catch((err) =>
        console.warn("[dismissActivityEvent] R2 evict (bhandara)", err),
      );
    }
  } else if (kind === "mention") {
    // Mention deletes are soft-hides: set status REJECTED. The row
    // stays in the DB (so the bot can de-dup against msgId and not
    // keep re-forwarding the same message); it just stops appearing
    // on the public feed + admin streams.
    await prisma.bhandaraMention.update({
      where: { id },
      data: { status: "REJECTED" },
    });
  } else {
    // volunteer / system / unknown, nothing to do.
    return;
  }

  // Layout-level revalidate so dashboard KPI + Live chat + the
  // downstream queue all pick up the change without a hard refresh.
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}
