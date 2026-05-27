"use client";

/**
 * ContentEditor, client component used by Pitches / Templates /
 * Strategy tabs for "+ New" and inline edit.
 *
 * Renders as a <details> disclosure: closed by default, expands into
 * a multi-column form (title, summary, kind, audience, channel,
 * language, tags, body). Posts to either createContentAction or
 * updateContentAction depending on whether `editing` is set.
 *
 * Why a client component:
 *   The form itself can be plain HTML, but we want a copy-to-clipboard
 *   button on the body textarea + a small character counter that
 *   updates live as the admin types. Both need state, hence "use client".
 */

import { useState, useTransition } from "react";
import { createContentAction, updateContentAction } from "./actions";
import {
  CONTENT_KINDS,
  CONTENT_AUDIENCES,
  CONTENT_CHANNELS,
  CONTENT_LANGUAGES,
} from "./types";
import { IconCheck } from "@/components/admin/AdminIcons";

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
};

const FIELD =
  "w-full rounded-lg bg-[#080A10]/70 border border-cyan-400/20 px-3 py-2 text-sm text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55";
const LABEL =
  "text-[10px] uppercase tracking-[0.16em] text-cream-50/55 font-mono mb-1";

export default function ContentEditor({
  editing,
  defaultKind,
  defaultAudience,
  defaultChannel,
}: {
  /** When set, we render an Edit form pre-filled with this row's
   *  data + bind the action to updateContentAction. When null, the
   *  form is "+ New" and binds to createContentAction. */
  editing?: ContentRow;
  /** Default kind when creating a new row (set by the tab that
   *  opened the editor, e.g. "TEMPLATE" from the Templates tab). */
  defaultKind?: string;
  defaultAudience?: string;
  defaultChannel?: string;
}) {
  // Live char counter for the body textarea, gives the admin a
  // sense of "is this paste too long" without dropping outside the
  // 50k char DB cap.
  const [bodyLen, setBodyLen] = useState(editing?.body.length ?? 0);
  const [copied, setCopied] = useState(false);
  // Keep the pending flag — the submit button reads it to show a
  // spinner + the "Saving…" / "Creating…" label so clicks don't
  // feel frozen during the server action round-trip (300-800 ms
  // typical, longer on cold DB pool).
  const [isPending, startTransition] = useTransition();

  const action = editing
    ? updateContentAction.bind(null, editing.id)
    : createContentAction;

  const labelButton = editing ? "Save changes" : "+ New content";
  const labelPending = editing ? "Saving…" : "Creating…";

  // When the editor is for "+ New" (no editing prop) we render the
  // closed disclosure as a PRIMARY GRADIENT BUTTON so it reads as a
  // top-of-list call-to-action, not as another card in the feed.
  // When it's for editing an existing row, we keep the slim
  // disclosure card style.
  const isNewMode = !editing;

  return (
    <details
      className={
        isNewMode
          ? "group"
          : "rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm overflow-hidden"
      }
    >
      <summary
        className={
          isNewMode
            ? "cursor-pointer list-none inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 font-semibold border border-cyan-300/40 px-4 py-2 text-sm shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] transition-all group-open:shadow-none"
            : "cursor-pointer list-none px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-cyan-400/[0.04] transition-colors"
        }
      >
        {isNewMode ? (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden
              className="transition-transform group-open:rotate-45"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Draft new {defaultKind?.toLowerCase() ?? "content"}</span>
          </>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <span
              aria-hidden
              className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-cyan-400/40 text-cyan-200 transition-transform group-open:rotate-90"
            >
              ✎
            </span>
            <div className="min-w-0">
              <div className="font-medium text-cream-50 text-sm truncate">
                Edit · {editing!.title}
              </div>
              <div className="text-[11px] text-cream-50/45 font-mono mt-0.5">
                {editing!.kind} · {editing!.audience} · {editing!.channel}
              </div>
            </div>
          </div>
        )}
      </summary>

      <form
        action={(formData) => {
          startTransition(() => {
            void action(formData);
          });
        }}
        className={
          isNewMode
            ? "mt-3 p-4 sm:p-5 grid gap-3 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm"
            : "border-t border-cyan-400/15 p-4 sm:p-5 grid gap-3"
        }
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="grid">
            <span className={LABEL}>Title</span>
            <input
              name="title"
              type="text"
              required
              maxLength={200}
              defaultValue={editing?.title ?? ""}
              placeholder="e.g. Sponsor pitch, Pan-India FMCG"
              className={FIELD}
            />
          </label>
          <label className="grid">
            <span className={LABEL}>Summary (one line)</span>
            <input
              name="summary"
              type="text"
              maxLength={280}
              defaultValue={editing?.summary ?? ""}
              placeholder="Shown on the card preview"
              className={FIELD}
            />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="grid">
            <span className={LABEL}>Kind</span>
            <select
              name="kind"
              defaultValue={editing?.kind ?? defaultKind ?? "PITCH"}
              className={FIELD}
            >
              {CONTENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="grid">
            <span className={LABEL}>Audience</span>
            <select
              name="audience"
              defaultValue={editing?.audience ?? defaultAudience ?? "OTHER"}
              className={FIELD}
            >
              {CONTENT_AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="grid">
            <span className={LABEL}>Channel</span>
            <select
              name="channel"
              defaultValue={editing?.channel ?? defaultChannel ?? "OTHER"}
              className={FIELD}
            >
              {CONTENT_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="grid">
            <span className={LABEL}>Language</span>
            <select
              name="language"
              defaultValue={editing?.language ?? "en"}
              className={FIELD}
            >
              {CONTENT_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid">
          <span className={LABEL}>Tags (comma or space separated)</span>
          <input
            name="tags"
            type="text"
            maxLength={500}
            defaultValue={editing?.tags.join(" ") ?? ""}
            placeholder="e.g. sponsor outreach pan-india tier-1"
            className={FIELD}
          />
        </label>

        <label className="grid">
          <span className={LABEL}>
            Body · markdown{" "}
            <span className="text-cream-50/35 ml-1">
              ({bodyLen.toLocaleString("en-IN")} chars)
            </span>
          </span>
          <textarea
            name="body"
            required
            rows={14}
            maxLength={50000}
            defaultValue={editing?.body ?? ""}
            placeholder={
              "Draft your content here in markdown.\n\n## Section heading\n\n- bullet point\n- another"
            }
            onChange={(e) => setBodyLen(e.currentTarget.value.length)}
            className={FIELD + " font-mono text-[13px] leading-relaxed resize-y"}
          />
        </label>

        <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
          <div className="text-[11px] text-cream-50/45 font-mono">
            {editing?.source ? (
              <>imported from <span className="text-cyan-300">{editing.source}</span></>
            ) : (
              <>tip · use {`{{`}name{`}}`} placeholders in templates</>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {editing ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(editing.body);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* clipboard may be blocked in some contexts; no-op */
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-3 py-1.5 text-xs font-medium font-mono transition-colors"
              >
                {copied ? (
                  <>
                    <IconCheck size={12} />
                    <span>Copied</span>
                  </>
                ) : (
                  "Copy body"
                )}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className={[
                "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border transition-colors",
                isPending
                  ? "bg-gradient-to-r from-cyan-500/60 to-violet-500/60 text-cream-50/85 border-cyan-300/25 shadow-none cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 border-cyan-300/40 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)]",
              ].join(" ")}
            >
              {isPending ? (
                <Spinner />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {editing ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </>
                  )}
                </svg>
              )}
              <span>{isPending ? labelPending : labelButton}</span>
            </button>
          </div>
        </div>
      </form>
    </details>
  );
}

/** Tiny inline spinner for the submit button's pending state.
 *  Matches the visual weight of the +/check icons it replaces so
 *  the button doesn't reflow when the label flips to "Saving…". */
function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
      className="motion-safe:animate-spin"
    >
      <path d="M12 3 a9 9 0 1 1 -9 9" />
    </svg>
  );
}
