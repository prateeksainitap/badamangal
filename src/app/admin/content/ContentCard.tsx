import {
  archiveContentAction,
  restoreContentAction,
  deleteContentAction,
} from "./actions";
import SubmitButton from "@/components/admin/SubmitButton";
import ContentEditor from "./ContentEditor";
import CopyButtonClient from "./CopyButtonClient";
import { renderMarkdown } from "@/lib/markdown";
import {
  AudienceIcon,
  ChannelIcon,
  KindIcon,
  audienceLabel,
  audienceTone,
  channelLabel,
} from "./visuals";

/**
 * Card for a single Content row.
 *
 * The previous design rendered every row as an identical dark
 * rectangle with three "Edit / Copy / Archive" buttons buried at
 * the bottom, unscannable, actions invisible while scrolling,
 * no visual variation between a sponsor pitch and a press release.
 *
 * New layout:
 *
 *   ┌──┬──────────────────────────────────────────────┬──────────┐
 *   │S │ [icon] PITCH · SPONSOR · EMAIL · bilingual   │ ✎  ⧉  ⋯  │   <- meta + actions
 *   │  │ Pitch title, large serif heading             │          │
 *   │T │ One-line summary in lighter tone              │          │
 *   │R │ Body excerpt, 3 lines, readable sans          │          │
 *   │I │ #tags · 4,348 chars · updated 2026-05-24      │          │
 *   │P │                                                │          │
 *   │E │ ▸ Read full document                          │          │
 *   └──┴──────────────────────────────────────────────┴──────────┘
 *
 *   • Left STRIPE is audience-coloured (sponsor=saffron,
 *     influencer=violet, press=sindoor, etc.) so the operator can
 *     scan a mixed list by colour rather than reading every badge.
 *   • KIND icon sits in a coloured disc next to the meta row.
 *   • ACTIONS cluster (Edit / Copy / Archive) lives top-right
 *     ALWAYS visible while scrolling past a tall card body.
 *   • Body excerpt uses Mukta sans + line-clamp-3 so it reads like
 *     content, not like log output. Click "Read full document" to
 *     expand into the cream reading sheet (renderMarkdown).
 *   • Tags + char-count + updated date sit subtly at the bottom.
 */

type ContentRow = {
  id: string;
  title: string;
  body: string;
  summary: string | null;
  kind: string;
  audience: string;
  channel: string;
  language: string;
  tags: string[];
  source: string | null;
  lastEditor: string | null;
  status: string;
  updatedAt: Date;
};

export default function ContentCard({ row }: { row: ContentRow }) {
  const isArchived = row.status === "ARCHIVED";
  const tone = audienceTone(row.audience);
  // Plain-text preview: first 240 chars of body with markdown markers
  // softened, so the card excerpt reads like content rather than
  // raw source. Falls back to summary if body is empty.
  const previewText =
    row.summary?.trim() ||
    row.body
      .replace(/^#+\s+/gm, "") // strip leading hashes
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);

  return (
    <article
      className={[
        "group relative rounded-2xl border bg-[#0B0E16]/85 backdrop-blur-sm overflow-hidden transition-all",
        isArchived
          ? "border-cream-50/10 opacity-60"
          : `border-cyan-400/15 ${tone.hover} hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.55)]`,
      ].join(" ")}
    >
      {/* Audience colour stripe, runs the full height of the card on
          the left edge so a mixed-audience list reads as a bar chart
          of colour columns. ~5px wide, gradient top→bottom. */}
      <div
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${tone.stripe}`}
      />

      <div className="pl-5 sm:pl-6 pr-4 sm:pr-5 py-4 sm:py-5">
        {/* Row 1: kind icon + meta pills (left) + actions (right) */}
        <div className="flex items-start gap-3">
          {/* Kind icon disc */}
          <div
            className={[
              "shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border",
              tone.iconBg,
              tone.iconText,
            ].join(" ")}
            aria-hidden
          >
            <KindIcon kind={row.kind} />
          </div>

          {/* Meta pills */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-semibold uppercase tracking-[0.14em] font-mono">
              <span className="text-cream-50/70">{row.kind}</span>
              <span aria-hidden className="text-cream-50/25">·</span>
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
                  tone.pill,
                ].join(" ")}
              >
                <AudienceIcon audience={row.audience} />
                <span>{audienceLabel(row.audience)}</span>
              </span>
              {row.channel !== "OTHER" && row.channel !== "INTERNAL" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-cream-50/[0.05] border border-cream-50/12 text-cream-50/70 px-1.5 py-0.5">
                  <ChannelIcon channel={row.channel} />
                  <span>{channelLabel(row.channel)}</span>
                </span>
              ) : null}
              {row.language !== "en" ? (
                <span className="text-cream-50/45 font-normal lowercase tracking-normal">
                  · {row.language}
                </span>
              ) : null}
              {isArchived ? (
                <span className="text-cream-50/45 font-normal lowercase tracking-normal">
                  · archived
                </span>
              ) : null}
            </div>
          </div>

          {/* Actions cluster, top-right, always visible while scrolling */}
          <div className="shrink-0 flex items-center gap-1.5">
            <CopyButtonClient text={row.body} />
            {!isArchived ? (
              <details className="inline-block">
                <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.10] border border-cyan-400/30 text-cyan-100 hover:bg-cyan-400/[0.20] hover:border-cyan-400/55 px-3 py-1.5 text-xs font-medium font-mono transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11 4 H4 a2 2 0 0 0 -2 2 v14 a2 2 0 0 0 2 2 h14 a2 2 0 0 0 2 -2 v-7" />
                    <path d="M18.5 2.5 a2.121 2.121 0 0 1 3 3 L12 15 l-4 1 1 -4 z" />
                  </svg>
                  <span className="hidden sm:inline">Edit</span>
                </summary>
                <div className="mt-3 w-full -ml-12 sm:-ml-14">
                  <ContentEditor editing={row} />
                </div>
              </details>
            ) : (
              <form action={restoreContentAction.bind(null, row.id)}>
                <SubmitButton variant="primary-green" pendingLabel="Restoring…">
                  Restore
                </SubmitButton>
              </form>
            )}
            {/* Overflow menu, Archive / Delete tucked behind ⋯ so
                the row stays clean. Same <details>-popover pattern
                BhandaraRow's MoreMenu uses. */}
            <details className="relative inline-block">
              <summary className="cursor-pointer list-none inline-flex items-center justify-center w-8 h-[28px] rounded-lg bg-cream-50/[0.05] border border-cream-50/12 text-cream-50/70 hover:bg-cream-50/[0.10] hover:border-cream-50/30 hover:text-cream-50 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
                <span className="sr-only">More actions</span>
              </summary>
              <div className="absolute right-0 top-full mt-2 z-10 min-w-[9rem] rounded-xl border border-cream-50/15 bg-ink-900/95 backdrop-blur-md shadow-[0_12px_40px_-8px_rgba(0,0,0,0.7)] p-1.5 flex flex-col gap-1">
                {!isArchived ? (
                  <form action={archiveContentAction.bind(null, row.id)}>
                    <SubmitButton
                      variant="outline-ink"
                      pendingLabel="Archiving…"
                      confirm="Archive this content? You can restore it later."
                    >
                      Archive
                    </SubmitButton>
                  </form>
                ) : (
                  <form action={deleteContentAction.bind(null, row.id)}>
                    <SubmitButton
                      variant="outline-alert"
                      pendingLabel="Deleting…"
                      confirm="Permanently delete this content row? Cannot be undone."
                    >
                      Delete
                    </SubmitButton>
                  </form>
                )}
              </div>
            </details>
          </div>
        </div>

        {/* Row 2: Title, large serif lead */}
        <h3 className="font-fraunces text-[19px] sm:text-xl text-cream-50 leading-tight mt-3">
          {row.title}
        </h3>

        {/* Row 3: Body preview, readable sans, soft tone, line-clamped */}
        <p className="mt-2 text-sm text-cream-50/65 leading-relaxed font-mukta line-clamp-3">
          {previewText}
        </p>

        {/* Row 4: Tags + char count + updated. Subtle, secondary. */}
        <div className="mt-3 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-cream-50/40 font-mono">
          {row.tags.length > 0 ? (
            <div className="flex items-center gap-1 flex-wrap">
              {row.tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="text-cream-50/55 hover:text-cream-50/85 transition-colors"
                >
                  #{t}
                </span>
              ))}
              {row.tags.length > 4 ? (
                <span className="text-cream-50/35">
                  +{row.tags.length - 4}
                </span>
              ) : null}
            </div>
          ) : null}
          <span aria-hidden className="text-cream-50/20">·</span>
          <span>{row.body.length.toLocaleString("en-IN")} chars</span>
          <span aria-hidden className="text-cream-50/20">·</span>
          <span>updated {row.updatedAt.toISOString().slice(0, 10)}</span>
          {row.source ? (
            <>
              <span aria-hidden className="text-cream-50/20">·</span>
              <span className="text-cyan-300/70">{row.source}</span>
            </>
          ) : null}
        </div>

        {/* Row 5: "Read full document" disclosure, expands into the
            cream reading sheet. Keeps the closed state slim. */}
        <details className="group/read mt-3">
          <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-xs text-cyan-300/85 hover:text-cyan-200 font-mono transition-colors">
            <svg
              aria-hidden
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-open/read:rotate-90"
            >
              <polyline points="9 6 15 12 9 18" />
            </svg>
            <span>Read full document</span>
          </summary>
          <div className="mt-3 rounded-xl border border-cream-50/15 bg-cream-50 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.55)] overflow-hidden">
            <div
              className="bm-prose px-6 sm:px-8 py-6 sm:py-7 max-w-[68ch] mx-auto"
              /* Body is admin-authored markdown, not public input,
                 so dangerouslySetInnerHTML is acceptable here.
                 See trust-model note in src/lib/markdown.ts. */
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(row.body),
              }}
            />
          </div>
        </details>
      </div>
    </article>
  );
}
