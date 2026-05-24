"use client";

import { useFormStatus } from "react-dom";

/**
 * Tiny inline dismiss button for an ActivityStream row.
 *
 * Renders as a ~28×28 square with an `✕` glyph. Dim by default so it
 * doesn't dominate the row visually; on hover it tints red and the
 * parent <li>'s `group-hover:opacity-100` keyframe brings it to full
 * visibility (the default opacity-0 hides it until the row is
 * hovered/focused). Native `confirm()` guards against the accidental
 * click — once confirmed, the wrapping <form> POSTs to
 * `dismissActivityEventAction`.
 *
 * `useFormStatus()` is the React hook that lets the button disable
 * + spin during the in-flight server-action request — same pattern
 * the rest of /admin uses via SubmitButton. We can't reuse
 * SubmitButton here because that one renders a much chunkier button;
 * the Live-chat stream rows are dense, this needs to be an icon.
 */
export default function ActivityDismissButton({
  label,
}: {
  /** Accessible label + the noun shown in the confirm dialog. */
  label: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Dismiss: ${label}`}
      title={`Dismiss: ${label}`}
      onClick={(e) => {
        if (
          !window.confirm(
            `Remove this from the Live chat?\n\n${label.slice(0, 140)}`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#0B0E16]/85 border border-cream-50/15 text-cream-50/45 hover:bg-alert-500/[0.20] hover:border-alert-500/55 hover:text-alert-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_4px_10px_-4px_rgba(0,0,0,0.55)]"
    >
      {pending ? (
        <span
          aria-hidden
          className="inline-block h-3 w-3 motion-safe:animate-spin rounded-full border-2 border-current/40 border-t-current"
        />
      ) : (
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      )}
    </button>
  );
}
