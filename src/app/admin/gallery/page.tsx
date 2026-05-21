/**
 * Admin: manage the homepage gallery photos.
 *
 * Two roles:
 *   1. UPLOAD: a small form where the admin picks a file, it uploads
 *      to /api/uploads, and on success POSTs to addGalleryPhotoAction
 *      with the resulting URL + optional caption / credit.
 *   2. CURATE: lists every existing GalleryPhoto (VISIBLE first, then
 *      HIDDEN) with one-click hide / unhide actions.
 *
 * The actual homepage section is /src/components/HomepageGallery.tsx
 * which receives merged admin + spot-photo items from src/app/page.tsx.
 * This admin page only deals with the admin-uploaded subset.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  addGalleryPhotoAction,
  hideGalleryPhotoAction,
  unhideGalleryPhotoAction,
} from "@/app/admin/actions";
import GalleryUploadForm from "@/components/admin/GalleryUploadForm";

export const dynamic = "force-dynamic";

const COOKIE = "admin";

async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const c = await cookies();
  return c.get(COOKIE)?.value === expected;
}

export default async function AdminGalleryPage() {
  if (!(await isAdmin())) redirect("/admin");

  const photos = await prisma.galleryPhoto.findMany({
    orderBy: [
      // VISIBLE first, then by displayOrder asc, then newest
      { status: "asc" }, // "HIDDEN" > "VISIBLE" alphabetically, flip below if needed
      { displayOrder: "asc" },
      { createdAt: "desc" },
    ],
  });
  // Re-sort manually so VISIBLE comes first (alphabetical sort would
  // put HIDDEN before VISIBLE).
  photos.sort((a, b) => {
    if (a.status !== b.status) return a.status === "VISIBLE" ? -1 : 1;
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
      <header className="pt-8 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-600">Admin</p>
          <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
            Homepage gallery
          </h1>
          <p className="mt-2 text-sm text-ink-600 max-w-2xl">
            Photos here appear in the homepage gallery section, mixed
            with auto-pulled photos from spotted bhandaras. Hide an
            item to remove it from the public gallery without losing
            the row. Use "Display order" to pin a specific photo to
            the top (lower number = surfaces earlier).
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm rounded-full px-3 py-1.5 border border-gold-500/50 text-ink-900 hover:bg-cream-50"
        >
          ← Back to admin
        </Link>
      </header>

      <GalleryUploadForm action={addGalleryPhotoAction} />

      <section className="mt-10">
        <h2 className="font-fraunces text-xl text-sindoor-700">
          All photos ({photos.length})
        </h2>
        {photos.length === 0 ? (
          <p className="mt-3 text-sm text-ink-600 italic">
            No gallery photos yet. Use the form above to add the first one.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p) => (
              <li
                key={p.id}
                className={`relative rounded-2xl border overflow-hidden bg-white ${
                  p.status === "VISIBLE"
                    ? "border-gold-500/40"
                    : "border-ink-600/30 opacity-60"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt={p.caption ?? ""}
                  className="block w-full h-44 object-cover"
                />
                <div className="px-3 py-2.5">
                  <p className="text-xs text-ink-600">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider mr-1.5 ${
                        p.status === "VISIBLE"
                          ? "bg-leaf-600/15 text-leaf-600"
                          : "bg-ink-600/15 text-ink-600"
                      }`}
                    >
                      {p.status}
                    </span>
                    order {p.displayOrder} ·{" "}
                    {p.createdAt.toISOString().slice(0, 10)}
                  </p>
                  {p.caption ? (
                    <p className="mt-1.5 text-sm text-ink-900 line-clamp-2">
                      {p.caption}
                    </p>
                  ) : null}
                  {p.uploadedBy ? (
                    <p className="mt-0.5 text-[11px] text-ink-600 italic">
                      by {p.uploadedBy}
                    </p>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    {p.status === "VISIBLE" ? (
                      <form
                        action={hideGalleryPhotoAction.bind(null, p.id)}
                      >
                        <button
                          type="submit"
                          className="text-xs rounded-full px-3 py-1 border border-sindoor-700/40 text-sindoor-700 hover:bg-sindoor-700/10"
                        >
                          Hide
                        </button>
                      </form>
                    ) : (
                      <form
                        action={unhideGalleryPhotoAction.bind(null, p.id)}
                      >
                        <button
                          type="submit"
                          className="text-xs rounded-full px-3 py-1 border border-leaf-600/50 text-leaf-600 hover:bg-leaf-600/10"
                        >
                          Unhide
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
