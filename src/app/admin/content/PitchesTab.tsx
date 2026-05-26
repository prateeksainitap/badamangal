import Link from "next/link";
import { prisma } from "@/lib/db";
import ContentCard from "./ContentCard";
import ContentEditor from "./ContentEditor";

/**
 * Pitches tab, Content rows where kind = "PITCH".
 *
 * Filter chips along the top let the operator narrow by audience
 * (sponsor / influencer / press / etc) and channel (email / IG / press
 * release). Filters are URL-encoded so deep links work + the page is
 * crawl-friendly (server-rendered, no client JS for the filter).
 */

const AUDIENCE_OPTIONS = [
  { key: "", label: "All" },
  { key: "SPONSOR", label: "Sponsor" },
  { key: "INFLUENCER", label: "Influencer" },
  { key: "PRESS", label: "Press" },
  { key: "ORGANISER", label: "Organiser" },
  { key: "DONOR", label: "Donor" },
];

const CHANNEL_OPTIONS = [
  { key: "", label: "All channels" },
  { key: "EMAIL", label: "Email" },
  { key: "WHATSAPP", label: "WhatsApp" },
  { key: "INSTAGRAM", label: "Instagram" },
  { key: "PRESS", label: "Press" },
];

export default async function PitchesTab({
  audience,
  channel,
}: {
  audience?: string;
  channel?: string;
}) {
  const where: {
    kind: string;
    status: string;
    audience?: string;
    channel?: string;
  } = { kind: "PITCH", status: "ACTIVE" };
  if (audience && AUDIENCE_OPTIONS.some((a) => a.key === audience))
    where.audience = audience;
  if (channel && CHANNEL_OPTIONS.some((c) => c.key === channel))
    where.channel = channel;

  const rows = await prisma.content.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <FilterStrip
        audience={audience ?? ""}
        channel={channel ?? ""}
        kind="pitches"
      />
      <ContentEditor defaultKind="PITCH" defaultAudience="SPONSOR" defaultChannel="EMAIL" />
      {rows.length === 0 ? (
        <EmptyState
          title={
            audience || channel
              ? "No pitches match the current filters"
              : "No pitches yet"
          }
          hint={
            audience || channel
              ? "Clear the filters above or create a new pitch."
              : "Use “+ New content” above to draft your first pitch, or click the import banner up top to load /notes/ pitches."
          }
        />
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => (
            <ContentCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── FilterStrip ────────────────────────── */

/** Shared filter chip strip, pitches + templates both use this. */
export function FilterStrip({
  audience,
  channel,
  kind,
}: {
  audience: string;
  channel: string;
  kind: "pitches" | "templates";
}) {
  const audOpts = kind === "pitches" ? AUDIENCE_OPTIONS : TEMPLATE_AUDIENCE_OPTIONS;
  const chanOpts = CHANNEL_OPTIONS;

  function hrefFor(audKey: string, chKey: string): string {
    const params = new URLSearchParams();
    params.set("tab", kind);
    if (audKey) params.set("aud", audKey);
    if (chKey) params.set("channel", chKey);
    return `/admin/content?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-cream-50/45 mr-1">
          Audience
        </span>
        {audOpts.map((o) => {
          const active = (audience || "") === o.key;
          return (
            <Link
              key={o.key || "all"}
              href={hrefFor(o.key, channel)}
              prefetch={false}
              scroll={false}
              className={[
                "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-mono transition-colors",
                active
                  ? "bg-cyan-400/[0.16] border border-cyan-400/45 text-cyan-100"
                  : "bg-cyan-400/[0.04] border border-cyan-400/15 text-cream-50/70 hover:bg-cyan-400/[0.10] hover:text-cream-50",
              ].join(" ")}
            >
              {o.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-cream-50/45 mr-1">
          Channel
        </span>
        {chanOpts.map((o) => {
          const active = (channel || "") === o.key;
          return (
            <Link
              key={o.key || "all"}
              href={hrefFor(audience, o.key)}
              prefetch={false}
              scroll={false}
              className={[
                "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-mono transition-colors",
                active
                  ? "bg-violet-400/[0.16] border border-violet-400/45 text-violet-100"
                  : "bg-violet-400/[0.04] border border-violet-400/15 text-cream-50/70 hover:bg-violet-400/[0.10] hover:text-cream-50",
              ].join(" ")}
            >
              {o.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-10 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-400/[0.08] border border-cyan-400/20 mb-3 text-2xl">
        ✦
      </div>
      <div className="font-fraunces text-cream-50 text-lg">{title}</div>
      <div className="text-xs text-cream-50/55 mt-1 font-mono">{hint}</div>
    </div>
  );
}

// Templates use a slightly different audience set (organiser, volunteer,
// donor are the main ones, not sponsor/press). Exported so TemplatesTab
// can reuse the same FilterStrip with its own option list.
export const TEMPLATE_AUDIENCE_OPTIONS = [
  { key: "", label: "All" },
  { key: "ORGANISER", label: "Organiser" },
  { key: "VOLUNTEER", label: "Volunteer" },
  { key: "DONOR", label: "Donor" },
  { key: "SPONSOR", label: "Sponsor" },
  { key: "COMMUNITY", label: "Community" },
];
