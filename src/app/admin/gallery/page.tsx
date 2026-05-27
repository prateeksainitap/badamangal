import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import {
  addGalleryPhotoAction,
  hideGalleryPhotoAction,
  unhideGalleryPhotoAction,
} from "@/app/admin/actions";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import GalleryUploadForm from "@/components/admin/GalleryUploadForm";
import AdminPageHero from "@/components/admin/AdminPageHero";
import SubmitButton from "@/components/admin/SubmitButton";
import PhotoArchive from "@/components/admin/PhotoArchive";

export const metadata: Metadata = {
  title: "Gallery · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage({
  searchParams,
}: {
  // ?archive=live|stored, optional. Drives the PhotoArchive tab
  // below the curated homepage gallery. Defaults to "live" when
  // absent / unrecognised so a fresh visit shows what's currently
  // surfaced on the public site.
  searchParams?: Promise<{ archive?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");
  const resolvedSearch = (await searchParams) ?? {};
  const archiveMode: "live" | "stored" =
    resolvedSearch.archive === "stored" ? "stored" : "live";

  const photos = await prisma.galleryPhoto.findMany({
    orderBy: [
      { status: "asc" },
      { displayOrder: "asc" },
      { createdAt: "desc" },
    ],
  });
  photos.sort((a, b) => {
    if (a.status !== b.status) return a.status === "VISIBLE" ? -1 : 1;
    if (a.displayOrder !== b.displayOrder)
      return a.displayOrder - b.displayOrder;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const visibleCount = photos.filter((p) => p.status === "VISIBLE").length;
  const hiddenCount = photos.length - visibleCount;

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        <AdminPageHero
          subject="gallery"
          eyebrow="Curation"
          title="Homepage gallery"
          subtitle={
            <>
              Curated photos mixed into the homepage gallery alongside
              auto-pulled spot photos.{" "}
              <span className="text-cyan-300/85">{visibleCount}</span>{" "}
              visible ·{" "}
              <span className="text-cream-50/70">{hiddenCount}</span> hidden.
            </>
          }
          primaryAction={
            <Link
              href="/admin/home"
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
            >
              ← Dashboard
            </Link>
          }
        />

        {/* Upload form, GalleryUploadForm carries its own dark card
            internally (re-skinned to AI palette). The outer wrapper
            here just adds the section header. */}
        <section className="mb-8">
          <GalleryUploadForm action={addGalleryPhotoAction} />
        </section>

        <h2 className="font-fraunces text-cream-50 text-lg mb-3">
          All photos
          <span className="ml-2 text-sm text-cream-50/45 font-mukta">
            · {photos.length}
          </span>
        </h2>
        {photos.length === 0 ? (
          <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-400/[0.08] border border-cyan-400/20 mb-4 text-3xl">
              🖼
            </div>
            <div className="font-fraunces text-cream-50 text-lg">
              No gallery photos yet
            </div>
            <div className="text-xs text-cream-50/55 mt-1 font-mono">
              Use the form above to add the first one.
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p, idx) => (
              <li
                key={p.id}
                style={{ ["--i" as string]: Math.min(idx, 6) }}
                className={[
                  "admin-row-in relative rounded-2xl border overflow-hidden bg-[#0B0E16]/85 backdrop-blur-sm transition-all",
                  p.status === "VISIBLE"
                    ? "border-cyan-400/15 hover:border-cyan-400/35"
                    : "border-cyan-400/[0.06] opacity-60",
                ].join(" ")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt={p.caption ?? ""}
                  className="block w-full h-44 object-cover"
                />
                <div className="px-3 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={[
                        "inline-flex items-center rounded-full border text-[9.5px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5",
                        p.status === "VISIBLE"
                          ? "bg-leaf-400/[0.14] border-leaf-400/30 text-leaf-400"
                          : "bg-cream-50/[0.06] border-cream-50/12 text-cream-50/55",
                      ].join(" ")}
                    >
                      {p.status}
                    </span>
                    <span className="text-[10.5px] text-cream-50/55">
                      order {p.displayOrder} ·{" "}
                      {p.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </div>
                  {p.caption ? (
                    <p className="mt-1.5 text-sm text-cream-50/90 line-clamp-2">
                      {p.caption}
                    </p>
                  ) : null}
                  {p.uploadedBy ? (
                    <p className="mt-0.5 text-[11px] text-cream-50/45 italic">
                      by {p.uploadedBy}
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex gap-2">
                    {p.status === "VISIBLE" ? (
                      <form
                        action={hideGalleryPhotoAction.bind(null, p.id)}
                      >
                        <SubmitButton variant="outline-alert" pendingLabel="Hiding…">
                          Hide
                        </SubmitButton>
                      </form>
                    ) : (
                      <form
                        action={unhideGalleryPhotoAction.bind(null, p.id)}
                      >
                        <SubmitButton variant="primary-green" pendingLabel="Unhiding…">
                          Unhide
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Full-platform photo archive, sits below the curated
            gallery. Shows every photoUrl across bhandaras + spots
            + gallery rows, split into Live (currently rendered on
            the public site) and Stored (everything else). Cost is
            ~150 ms warm — 6 indexed count queries + 3 findManys
            with LIMIT 100 per source, all in parallel — so this
            adds about one round-trip's worth of latency to the
            gallery page. Image bytes are CDN-served from R2 /
            Supabase, NOT from our DB, and <img loading="lazy">
            defers byte-fetch until each tile scrolls into view. */}
        <PhotoArchive mode={archiveMode} />
      </div>
    </AdminShell>
  );
}
