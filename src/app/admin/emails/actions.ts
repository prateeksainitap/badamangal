"use server";

/**
 * Server actions for the /admin/emails inbox.
 *
 * The underlying table is `ContactMessage`, rows landed by the
 * public /contact form. The actions here just walk the row through
 * its lifecycle:
 *
 *   NEW ──► READ ──► REPLIED
 *       ╰─► SPAM  (terminal, but can be restored)
 *
 * Each action revalidates `/admin/emails` so the next page render
 * picks up the new state, and we also revalidate the dashboard so
 * the unread-count badge stays in sync.
 *
 * Co-located here (not in app/admin/actions.ts) for the same
 * reasons as Content Hub's actions: the surface is self-contained,
 * easier to delete later if the feature is dropped.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

/** Common revalidate set, both pages depend on email state. */
function bumpPaths() {
  revalidatePath("/admin/emails");
  revalidatePath("/admin/home");
}

export async function markEmailReadAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.contactMessage.update({
    where: { id },
    data: { status: "READ" },
  });
  bumpPaths();
}

export async function markEmailRepliedAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.contactMessage.update({
    where: { id },
    data: { status: "REPLIED" },
  });
  bumpPaths();
}

export async function markEmailSpamAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.contactMessage.update({
    where: { id },
    data: { status: "SPAM" },
  });
  bumpPaths();
}

/** Pull a SPAM (or REPLIED / READ) row back into the NEW state so
 *  it surfaces in the default tab again. Used by the "Restore"
 *  action under archived rows. */
export async function restoreEmailAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.contactMessage.update({
    where: { id },
    data: { status: "NEW" },
  });
  bumpPaths();
}

/** Hard-delete an email row. Only exposed under SPAM in the UI to
 *  avoid accidental deletes of legitimate inbox content. Cannot be
 *  undone, the row + any attachment URL go away. */
export async function deleteEmailAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.contactMessage.delete({ where: { id } });
  bumpPaths();
}
