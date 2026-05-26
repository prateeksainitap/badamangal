"use client";

import { useFormStatus } from "react-dom";
import {
  markEmailReadAction,
  markEmailRepliedAction,
  markEmailSpamAction,
  restoreEmailAction,
  deleteEmailAction,
} from "./actions";
import {
  IconEnvelope,
  IconArrowUpRight,
  IconCheck,
} from "@/components/admin/AdminIcons";

/**
 * Right-pane reader for the /admin/emails two-pane inbox.
 *
 * Fully committed to the cream "reading sheet", sender block,
 * subject, body, AND action footer are all on the same paper
 * surface. The previous design bolted a dark action footer onto
 * the bottom of a cream card, which produced an ugly light-on-dark
 * sandwich AND made the outline-style action buttons invisible
 * (their dark fills disappeared against the dark footer).
 *
 * Action set by status:
 *   NEW       → Reply ↗, Mark read, Mark replied, Spam
 *   READ      → Reply ↗, Mark replied, Spam
 *   REPLIED   → Reply ↗, Spam (re-opens conversation if needed)
 *   SPAM      → Restore, Delete (delete only allowed under SPAM)
 *
 * Reply uses a mailto: with a pre-filled subject (Re: …) and quoted
 * body so the operator's default mail client owns thread continuity.
 *
 * Client component because the action buttons use useFormStatus()
 * for pending-state spinners + native confirm() guards on destructive
 * actions. The previous shared SubmitButton was scoped to dark-admin
 * styling and would not have read on cream, these are purpose-built
 * cream-surface variants.
 */

type EmailReaderRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  status: string;
  createdAt: Date;
};

const STATUS_PILL: Record<
  string,
  { label: string; bg: string; border: string; text: string }
> = {
  NEW: {
    label: "New",
    bg: "bg-cyan-500/[0.10]",
    border: "border-cyan-500/40",
    text: "text-cyan-700",
  },
  READ: {
    label: "Read",
    bg: "bg-ink-900/[0.06]",
    border: "border-ink-900/15",
    text: "text-ink-900/70",
  },
  REPLIED: {
    label: "Replied",
    bg: "bg-leaf-600/[0.10]",
    border: "border-leaf-600/35",
    text: "text-leaf-600",
  },
  SPAM: {
    label: "Spam",
    bg: "bg-sindoor-700/[0.08]",
    border: "border-sindoor-700/35",
    text: "text-sindoor-700",
  },
};

function fmtDate(d: Date): string {
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function avatarHueFor(seed: string): string {
  // Tones tuned to read on cream (vs the dark-bg versions used in
  // ActivityStream / list items). Each is a soft brand-ish fill with
  // a deeper text colour so initials still read at small sizes.
  const hues = [
    "bg-cyan-500/15 text-cyan-700 ring-cyan-500/35",
    "bg-violet-500/15 text-violet-700 ring-violet-500/35",
    "bg-leaf-600/15 text-leaf-600 ring-leaf-600/35",
    "bg-saffron-500/18 text-saffron-600 ring-saffron-500/35",
    "bg-sindoor-700/12 text-sindoor-700 ring-sindoor-700/35",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return hues[((h % hues.length) + hues.length) % hues.length];
}

export default function EmailReader({
  row,
  tab,
}: {
  row: EmailReaderRow;
  /** Current inbox tab, used for the mobile back-link so we land
   *  on the same filter we came from. */
  tab: string;
}) {
  const isSpam = row.status === "SPAM";
  const pill = STATUS_PILL[row.status] ?? STATUS_PILL.NEW;
  const initial = (row.name?.trim()?.[0] ?? row.email[0] ?? "•").toUpperCase();
  const hue = avatarHueFor(row.email || row.name || row.id);

  // Pre-filled reply mailto. Quotes the original message so the
  // operator's compose window opens with context.
  const replyHref = (() => {
    const subj = row.subject?.trim()
      ? `Re: ${row.subject.trim()}`
      : "Re: your message to Bada Mangal";
    const quoted = row.message
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");
    const body =
      `Namaste ${row.name?.split(" ")[0] || ""},\n\n` +
      `Thanks for writing in.\n\n\n` +
      `, Prateek\n` +
      `Bada Mangal\n\n` +
      `On ${row.createdAt.toISOString().slice(0, 16).replace("T", " ")}, ${row.name} wrote:\n` +
      quoted;
    return `mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(
      subj,
    )}&body=${encodeURIComponent(body)}`;
  })();

  return (
    <article className="bg-cream-50 text-ink-900 rounded-2xl overflow-hidden border border-cyan-400/15 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.6)]">
      {/* Mobile back-link, only visible below lg where the list and
          reader can't co-exist. */}
      <div className="lg:hidden px-5 sm:px-6 pt-4">
        <a
          href={`/admin/emails?status=${encodeURIComponent(tab)}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-700 hover:text-cyan-600"
        >
          ← Back to inbox
        </a>
      </div>

      {/* Header, sender block + status pill */}
      <header className="px-5 sm:px-7 pt-6 pb-5">
        <div className="flex items-start gap-3.5">
          <span
            className={[
              "shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full ring-1 text-[14px] font-bold leading-none",
              hue,
            ].join(" ")}
            aria-hidden
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-semibold text-ink-900 text-[15px]">
                {row.name}
              </span>
              <a
                href={`mailto:${row.email}`}
                className="text-[12.5px] text-ink-900/55 hover:text-sindoor-700 truncate"
              >
                &lt;{row.email}&gt;
              </a>
            </div>
            <div className="text-[12px] text-ink-900/55 mt-1 font-mukta">
              {fmtDate(row.createdAt)}
              {row.phone ? (
                <>
                  {" · "}
                  <a
                    href={`tel:${row.phone}`}
                    className="text-ink-900/70 hover:text-sindoor-700"
                  >
                    {row.phone}
                  </a>
                </>
              ) : null}
            </div>
          </div>
          <span
            className={[
              "shrink-0 inline-flex items-center rounded-full border text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-0.5",
              pill.bg,
              pill.border,
              pill.text,
            ].join(" ")}
          >
            {pill.label}
          </span>
        </div>

        {/* Subject, large, real heading weight */}
        {row.subject ? (
          <h1 className="mt-5 text-xl sm:text-2xl font-fraunces text-ink-900 leading-tight">
            {row.subject}
          </h1>
        ) : (
          <h1 className="mt-5 text-xl sm:text-2xl font-fraunces text-ink-900/45 italic leading-tight">
            (no subject)
          </h1>
        )}
      </header>

      {/* Body, preserved line breaks, readable sans, comfortable
          reading column width */}
      <div className="px-5 sm:px-7 pb-6 border-t border-ink-900/10">
        <div className="max-w-[68ch] pt-5">
          <pre className="whitespace-pre-wrap text-[15px] leading-[1.7] text-ink-900/90 font-mukta">
            {row.message}
          </pre>

          {/* Attachment chip */}
          {row.attachmentUrl ? (
            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-ink-900/55 mb-2">
                Attachment
              </div>
              <a
                href={row.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-ink-900/[0.05] border border-ink-900/15 text-ink-900/85 hover:bg-ink-900/[0.10] hover:border-ink-900/30 hover:text-ink-900 px-3.5 py-2 text-sm font-medium transition-colors"
              >
                <span aria-hidden className="text-base">
                  {row.attachmentType === "pdf" ? "📄" : "🖼"}
                </span>
                <span className="font-mono">
                  {row.attachmentName ?? "Open attachment"}
                </span>
                <span aria-hidden className="text-ink-900/50">↗</span>
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {/* Action bar, STAYS ON CREAM. The previous design dropped to
          dark here, which broke contrast on every outline-style button.
          Now the buttons are solid brand-tone fills that read clearly
          on the cream paper. */}
      <footer className="px-5 sm:px-7 py-4 border-t border-ink-900/10 bg-cream-50">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={replyHref}
            className="inline-flex items-center gap-2 rounded-lg bg-sindoor-700 hover:bg-sindoor-700/90 text-cream-50 font-semibold px-4 py-2 text-sm shadow-[0_3px_10px_-4px_rgba(156,42,42,0.55)] transition-colors"
          >
            <IconEnvelope size={15} />
            <span>Reply via email</span>
            <IconArrowUpRight size={13} />
          </a>
          {!isSpam ? (
            <>
              {row.status !== "READ" && row.status !== "REPLIED" ? (
                <CreamButton
                  action={markEmailReadAction.bind(null, row.id)}
                  pendingLabel="Marking…"
                  tone="neutral"
                >
                  Mark read
                </CreamButton>
              ) : null}
              {row.status !== "REPLIED" ? (
                <CreamButton
                  action={markEmailRepliedAction.bind(null, row.id)}
                  pendingLabel="Saving…"
                  tone="positive"
                >
                  <IconCheck size={14} />
                  <span>Mark replied</span>
                </CreamButton>
              ) : null}
              <CreamButton
                action={markEmailSpamAction.bind(null, row.id)}
                pendingLabel="Flagging…"
                tone="alert"
                confirm="Mark this message as spam?"
              >
                Spam
              </CreamButton>
            </>
          ) : (
            <>
              <CreamButton
                action={restoreEmailAction.bind(null, row.id)}
                pendingLabel="Restoring…"
                tone="neutral"
              >
                Restore
              </CreamButton>
              <CreamButton
                action={deleteEmailAction.bind(null, row.id)}
                pendingLabel="Deleting…"
                tone="alert"
                confirm="Permanently delete this email? Cannot be undone."
              >
                Delete
              </CreamButton>
            </>
          )}
          <span className="ml-auto text-[10.5px] text-ink-900/40 font-mono">
            #{row.id.slice(0, 8)}
          </span>
        </div>
      </footer>
    </article>
  );
}

/* ────────────────────────── CreamButton ──────────────────────────
 *
 * Local button component scoped to the cream reading-sheet surface.
 * SubmitButton (in src/components/admin/SubmitButton.tsx) is tuned
 * for dark admin chrome and its outline-style variants disappear
 * against a light background, that was the bug in the previous
 * design. This component handles three tones that read clearly on
 * cream:
 *   • neutral , soft ink fill (Mark read / Restore)
 *   • positive, leaf-green soft fill (Mark replied)
 *   • alert   , sindoor-red outline (Spam / Delete)
 *
 * Each variant has a defined hover state + an active disabled state.
 * useFormStatus() drives the pending spinner so we don't double-submit
 * the action. */

type Tone = "neutral" | "positive" | "alert";

function CreamButton({
  action,
  children,
  pendingLabel,
  tone,
  confirm,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: any;
  children: React.ReactNode;
  pendingLabel: string;
  tone: Tone;
  confirm?: string;
}) {
  return (
    <form action={action}>
      <CreamButtonInner
        pendingLabel={pendingLabel}
        tone={tone}
        confirm={confirm}
      >
        {children}
      </CreamButtonInner>
    </form>
  );
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral:
    "bg-ink-900/[0.06] hover:bg-ink-900/[0.12] border border-ink-900/15 hover:border-ink-900/30 text-ink-900/80 hover:text-ink-900",
  positive:
    "bg-leaf-600/[0.10] hover:bg-leaf-600/[0.18] border border-leaf-600/35 hover:border-leaf-600/55 text-leaf-600 hover:text-leaf-600",
  alert:
    "bg-sindoor-700/[0.06] hover:bg-sindoor-700/[0.14] border border-sindoor-700/35 hover:border-sindoor-700/55 text-sindoor-700 hover:text-sindoor-700",
};

function CreamButtonInner({
  pendingLabel,
  tone,
  confirm,
  children,
}: {
  pendingLabel: string;
  tone: Tone;
  confirm?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={
        confirm
          ? (e) => {
              if (!window.confirm(confirm)) e.preventDefault();
            }
          : undefined
      }
      className={[
        "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap",
        TONE_CLASSES[tone],
      ].join(" ")}
    >
      {pending ? (
        <>
          <span
            aria-hidden
            className="inline-block h-3.5 w-3.5 motion-safe:animate-spin rounded-full border-2 border-current/40 border-t-current"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
