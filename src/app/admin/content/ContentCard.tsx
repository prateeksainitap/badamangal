import {
  archiveContentAction,
  restoreContentAction,
  deleteContentAction,
  markSentAction,
  markRepliedAction,
  unmarkSentAction,
  toggleDraftAction,
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
  // Send-tracking fields, added 2026-05-27. Nullable so legacy rows
  // (created before the migration) render cleanly as "never sent".
  lastSentAt?: Date | null;
  lastSentTo?: string | null;
  awaitingReply?: boolean;
};

export default function ContentCard({ row }: { row: ContentRow }) {
  const isArchived = row.status === "ARCHIVED";
  const isDraft = row.status === "DRAFT";
  const tone = audienceTone(row.audience);

  // Send-tracking derivations. All three are tolerant of missing
  // fields so legacy rows pre-migration still render.
  const lastSentAt = row.lastSentAt ?? null;
  const awaitingReply = row.awaitingReply ?? false;
  const sentDaysAgo = lastSentAt
    ? Math.floor((Date.now() - lastSentAt.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const sentRecently = sentDaysAgo !== null && sentDaysAgo <= 7;
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
          : awaitingReply
            ? // Awaiting-reply rows get a saffron edge so they pull
              // the eye when the operator is scanning a long list
              // and triaging which need follow-up first.
              "border-saffron-500/35 hover:border-saffron-500/55 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.55)]"
            : isDraft
              ? // Drafts stay quieter, they're WIP, not eyes-on.
                "border-violet-400/20 hover:border-violet-400/45 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.55)]"
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
              {/* Status pills: DRAFT, SENT, AWAITING. Mirrors the
                  Mission Strip tones for consistency. Stacked
                  inline with the kind/audience meta so the
                  operator reads "PITCH · SPONSOR · EMAIL · sent
                  3d ago · awaiting" in one sweep. */}
              {isDraft ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-violet-400/[0.18] border border-violet-400/40 text-violet-200 px-1.5 py-0.5 tracking-normal lowercase">
                  draft
                </span>
              ) : null}
              {lastSentAt ? (
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 tracking-normal lowercase",
                    sentRecently
                      ? "bg-leaf-400/[0.12] border-leaf-400/40 text-leaf-300"
                      : "bg-cream-50/[0.06] border-cream-50/15 text-cream-50/65",
                  ].join(" ")}
                  title={`Last sent: ${lastSentAt.toISOString().slice(0, 10)}${row.lastSentTo ? ` · ${row.lastSentTo}` : ""}`}
                >
                  {sentDaysAgo === 0
                    ? "sent today"
                    : sentDaysAgo === 1
                      ? "sent 1d ago"
                      : `sent ${sentDaysAgo}d ago`}
                </span>
              ) : null}
              {awaitingReply ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-saffron-500/[0.18] border border-saffron-500/45 text-saffron-200 px-1.5 py-0.5 tracking-normal lowercase">
                  <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-saffron-500/70 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-saffron-500" />
                  </span>
                  awaiting reply
                </span>
              ) : null}
            </div>
            {/* "Last sent to" detail line - shown when the row was
                marked sent with a recipient note. Gives the
                operator the context they need to write a
                follow-up without reopening the editor. */}
            {row.lastSentTo ? (
              <div className="mt-1 text-[11px] text-cream-50/55 font-mono truncate">
                → {row.lastSentTo}
              </div>
            ) : null}
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

        {/* Row 4.5: Send-tracking actions. Hidden for ARCHIVED rows
            (no point tracking sends on a hidden row) and for
            TEMPLATE rows (templates are pasted many times, not
            sent once to a journalist; the model doesn't fit).
            Renders as a small action strip with the "Mark sent" /
            "Mark replied" affordances. */}
        {!isArchived && row.kind === "PITCH" ? (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {/* Mark Sent. Inline <details> popover lets the
                operator add an optional "sent to" recipient note
                without leaving the card. Clicking the summary
                opens the form; submitting fires markSentAction
                and revalidates. */}
            {!awaitingReply ? (
              <details className="relative inline-block">
                <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 rounded-lg bg-leaf-400/[0.10] border border-leaf-400/35 text-leaf-300 hover:bg-leaf-400/[0.20] hover:border-leaf-400/55 hover:text-leaf-200 px-2.5 py-1 text-[11px] font-mono font-medium transition-colors">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="22 2 11 13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  <span>{lastSentAt ? "Send again" : "Mark sent"}</span>
                </summary>
                <div className="absolute left-0 top-full mt-2 z-10 min-w-[18rem] rounded-xl border border-cream-50/15 bg-ink-900/95 backdrop-blur-md shadow-[0_12px_40px_-8px_rgba(0,0,0,0.7)] p-3">
                  <form
                    action={markSentAction.bind(null, row.id)}
                    className="space-y-2"
                  >
                    <label className="block">
                      <span className="block text-[10px] uppercase tracking-[0.16em] font-mono text-cream-50/55 mb-1">
                        Sent to (optional)
                      </span>
                      <input
                        type="text"
                        name="lastSentTo"
                        placeholder="Times of India · Ashish Kumar"
                        maxLength={200}
                        className="block w-full rounded-md border border-cream-50/15 bg-cream-50/[0.04] focus:border-cyan-400/55 focus:bg-cream-50/[0.08] outline-none px-2.5 py-1.5 text-[12px] text-cream-50 placeholder:text-cream-50/35 font-mono"
                      />
                    </label>
                    <div className="text-[10.5px] text-cream-50/55 font-mono leading-relaxed">
                      Marks this pitch as sent now and flags it as
                      awaiting reply. Powers the Mission Strip
                      tiles.
                    </div>
                    <SubmitButton variant="primary-green" pendingLabel="Marking…">
                      ✓ Confirm sent
                    </SubmitButton>
                  </form>
                </div>
              </details>
            ) : null}

            {/* Mark Replied - only shown when this row is awaiting
                a reply. Toggles awaitingReply=false, leaves
                lastSentAt intact so history is preserved. */}
            {awaitingReply ? (
              <form action={markRepliedAction.bind(null, row.id)}>
                <SubmitButton variant="primary-green" pendingLabel="Marking…">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Mark replied</span>
                </SubmitButton>
              </form>
            ) : null}

            {/* Toggle DRAFT / ACTIVE. Lets the operator move a row
                in and out of "still writing" without going through
                the editor + save. Label flips based on current
                state. */}
            <form action={toggleDraftAction.bind(null, row.id)}>
              <SubmitButton variant="outline-ink" pendingLabel="Flipping…">
                {isDraft ? "Promote to ready" : "Move to drafts"}
              </SubmitButton>
            </form>

            {/* Undo (clear send history). Tucked behind a small
                "Reset" chip so it's available but doesn't compete
                with the primary Mark-sent CTA. Only relevant
                after the row has been marked sent at least once. */}
            {lastSentAt ? (
              <form action={unmarkSentAction.bind(null, row.id)}>
                <SubmitButton
                  variant="outline-ink"
                  pendingLabel="Resetting…"
                  confirm="Clear the send history on this row?"
                >
                  ↺ Reset history
                </SubmitButton>
              </form>
            ) : null}
          </div>
        ) : null}

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
