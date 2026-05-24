import Link from "next/link";
import { prisma } from "@/lib/db";
import { setGalleryTagsAction } from "./actions";
import SubmitButton from "@/components/admin/SubmitButton";
import CopyButtonClient from "./CopyButtonClient";
import { EmptyState } from "./PitchesTab";

/**
 * Images tab — surfaces GalleryPhoto rows with non-empty `tags`.
 *
 * Re-uses the same R2 bucket the homepage gallery uses. Tagging an
 * existing photo from /admin/gallery (with "ig" / "wa" / "pamphlet" /
 * "brand" / "ai-generated") makes it appear here as well. New AI-
 * generated images get uploaded through /admin/gallery and tagged
 * with the appropriate channel so they show up under the right chip.
 */

const TAG_OPTIONS = [
  { key: "", label: "All", tone: "cyan" as const },
  { key: "ig", label: "Instagram", tone: "violet" as const },
  { key: "wa", label: "WhatsApp", tone: "leaf" as const },
  { key: "reddit", label: "Reddit", tone: "saffron" as const },
  { key: "press", label: "Press", tone: "saffron" as const },
  { key: "pamphlet", label: "Pamphlet", tone: "cyan" as const },
  { key: "brand", label: "Brand", tone: "violet" as const },
  { key: "community", label: "Community", tone: "leaf" as const },
  { key: "ai-generated", label: "AI-generated", tone: "cyan" as const },
];
const TAG_TONE: Record<string, string> = {
  cyan: "bg-cyan-400/[0.16] border-cyan-400/45 text-cyan-100",
  violet: "bg-violet-400/[0.16] border-violet-400/45 text-violet-100",
  leaf: "bg-leaf-500/[0.16] border-leaf-400/45 text-leaf-200",
  saffron: "bg-saffron-500/[0.16] border-saffron-500/45 text-saffron-200",
};
const TAG_TONE_DIM: Record<string, string> = {
  cyan: "bg-cyan-400/[0.04] border-cyan-400/15 text-cream-50/70 hover:bg-cyan-400/[0.10] hover:text-cream-50",
  violet: "bg-violet-400/[0.04] border-violet-400/15 text-cream-50/70 hover:bg-violet-400/[0.10] hover:text-cream-50",
  leaf: "bg-leaf-500/[0.04] border-leaf-400/15 text-cream-50/70 hover:bg-leaf-500/[0.10] hover:text-cream-50",
  saffron: "bg-saffron-500/[0.04] border-saffron-500/15 text-cream-50/70 hover:bg-saffron-500/[0.10] hover:text-cream-50",
};

export default async function ImagesTab({ filterTag }: { filterTag?: string }) {
  // We use the existing GalleryPhoto table. Filter by tag if set,
  // else show every row with at least one tag. Empty-tag rows are
  // the legacy homepage-gallery photos and don't belong here.
  const validTag = TAG_OPTIONS.some((t) => t.key === filterTag) ? filterTag : "";

  const photos = await prisma.galleryPhoto.findMany({
    where: validTag
      ? { tags: { has: validTag } }
      : { tags: { isEmpty: false } },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    take: 60,
  });

  return (
    <div className="space-y-4">
      {/* Tag chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-cream-50/45 mr-1">
          Use case
        </span>
        {TAG_OPTIONS.map((o) => {
          const active = (validTag || "") === o.key;
          const params = new URLSearchParams({ tab: "images" });
          if (o.key) params.set("channel", o.key);
          return (
            <Link
              key={o.key || "all"}
              href={`/admin/content?${params.toString()}`}
              prefetch={false}
              scroll={false}
              className={[
                "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-mono transition-colors",
                active ? TAG_TONE[o.tone] : TAG_TONE_DIM[o.tone],
              ].join(" ")}
            >
              {o.label}
            </Link>
          );
        })}
      </div>

      {/* Upload pointer — uploading new images flows through the
          gallery page (which already has compression + R2 + a polished
          UI). The hub just *surfaces* tagged images. */}
      <div className="rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 text-lg">
          ↗
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-cream-50 font-medium">
            Upload new AI / curated images via the Gallery
          </div>
          <div className="text-xs text-cream-50/55 font-mono">
            Add the photo there, then tag it{" "}
            <span className="text-cyan-300">ig</span> /{" "}
            <span className="text-cyan-300">wa</span> /{" "}
            <span className="text-cyan-300">pamphlet</span> / etc. to surface here.
          </div>
        </div>
        <Link
          href="/admin/gallery"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 font-semibold border border-cyan-300/40 px-4 py-2 text-sm shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] transition-all"
        >
          Open Gallery →
        </Link>
      </div>

      {photos.length === 0 ? (
        <EmptyState
          title={
            validTag
              ? `No images tagged "${validTag}" yet`
              : "No tagged images yet"
          }
          hint="Tag a photo from /admin/gallery with ig / wa / pamphlet / brand to make it discoverable from this hub."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl}
                alt={p.caption ?? ""}
                className="block w-full h-44 object-cover"
              />
              <div className="px-3 py-3">
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-md bg-cyan-400/[0.10] border border-cyan-400/30 px-1.5 py-0.5 text-[10px] text-cyan-200 font-mono"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
                {p.caption ? (
                  <p className="text-sm text-cream-50/85 line-clamp-2">
                    {p.caption}
                  </p>
                ) : (
                  <p className="text-[12px] text-cream-50/40 italic font-mono">
                    no caption
                  </p>
                )}
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <CopyButtonClient text={p.imageUrl} />
                  <details className="inline-block">
                    <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 rounded-lg bg-cream-50/[0.05] border border-cream-50/15 text-cream-50/80 hover:bg-cream-50/[0.10] hover:border-cream-50/30 hover:text-cream-50 px-3 py-1.5 text-xs font-medium font-mono transition-colors">
                      ✎ Tags
                    </summary>
                    <form
                      action={setGalleryTagsAction.bind(null, p.id)}
                      className="mt-2 flex items-center gap-2"
                    >
                      <input
                        name="tags"
                        type="text"
                        defaultValue={p.tags.join(" ")}
                        placeholder="ig wa pamphlet"
                        maxLength={500}
                        className="flex-1 rounded-lg bg-[#080A10]/70 border border-cyan-400/20 px-2.5 py-1.5 text-xs text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45"
                      />
                      <SubmitButton variant="outline-saffron" pendingLabel="Saving…">
                        Save
                      </SubmitButton>
                    </form>
                  </details>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
