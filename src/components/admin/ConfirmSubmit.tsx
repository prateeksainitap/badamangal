"use client";

/**
 * Tiny client component used to wrap an admin form's submit button
 * with a native browser `confirm()` prompt. Lives in /admin only —
 * we deliberately don't reach for a fancy modal here because admin
 * destructive actions are rare and the OS confirm is the most
 * scannable, unmissable UI for an irreversible operation.
 *
 * Usage:
 *   <form action={deleteBhandaraAction.bind(null, id)}>
 *     <ConfirmSubmit message="Delete this row permanently?">
 *       🗑 Delete
 *     </ConfirmSubmit>
 *   </form>
 *
 * If the user clicks Cancel in the confirm dialog, we call
 * `event.preventDefault()` so the form never submits. If they click
 * OK, we let the normal form submission proceed — which triggers the
 * server action bound to the parent form.
 */
import type { ReactNode } from "react";

type Props = {
  message: string;
  className?: string;
  children: ReactNode;
};

export default function ConfirmSubmit({
  message,
  className,
  children,
}: Props) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        // Native confirm runs synchronously, so by the time it
        // returns the form's submit hasn't yet propagated. If the
        // user cancels, prevent the submit; otherwise fall through.
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
