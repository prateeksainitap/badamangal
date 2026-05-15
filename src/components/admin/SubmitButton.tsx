"use client";

import { useFormStatus } from "react-dom";

/**
 * Generic admin action submit button with a built-in pending state.
 *
 * Why this exists:
 *   Every action button on /admin posts a server action that touches
 *   Prisma (and sometimes revalidates several paths). On a cold Netlify
 *   Function the round-trip is 1-2s, during which the row looks frozen
 *   and the admin tends to double-click — which fires the action twice
 *   and occasionally races (e.g. publish + reject in quick succession).
 *
 *   `useFormStatus()` reads the same pending flag Next is already
 *   tracking for the parent <form action={…}>, so we get:
 *     • the button disabled (no double-submit)
 *     • a spinner + label swap that *feels* responsive
 *
 * It MUST be a child of an actual <form> (the react-dom hook is form-
 * scoped). Otherwise `pending` is always false. The same pattern is
 * used by AdminLoginForm — see the long comment block there for the
 * "why useFormStatus and not local state" reasoning.
 *
 * The visual variants mirror the existing button styles in /admin
 * (saffron primary, outlined secondary, etc.) so callers swap the
 * old <button> tag for <SubmitButton variant="…"> with no other
 * changes.
 */
type Variant =
  | "primary-green" // ✓ Called & confirmed, publish (leaf-600 filled)
  | "primary-saffron" // Default fill (saffron-600 filled)
  | "outline-leaf"
  | "outline-saffron"
  | "outline-alert"
  | "outline-ink";

const styleByVariant: Record<Variant, string> = {
  "primary-green":
    "bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium shadow-sm",
  "primary-saffron":
    "bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium shadow-sm",
  "outline-leaf":
    "border-2 border-leaf-600 text-leaf-600 hover:bg-leaf-600 hover:text-cream-50 font-medium",
  "outline-saffron":
    "border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium",
  "outline-alert":
    "border-2 border-alert-500 text-alert-500 hover:bg-alert-500 hover:text-cream-50 font-medium",
  "outline-ink":
    "border-2 border-ink-600/45 text-ink-900 hover:bg-cream-50 font-medium",
};

export default function SubmitButton({
  children,
  pendingLabel,
  variant = "primary-saffron",
  size = "sm",
  className = "",
  confirm,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  size?: "sm" | "md";
  className?: string;
  /**
   * Optional confirmation prompt — when set, clicking the button first
   * shows a native confirm() dialog. If the admin cancels, the submit
   * is prevented and no pending state appears. Used for destructive
   * actions like "Clear queue" / "Reject".
   */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const sizing = size === "md" ? "px-5 py-2.5 text-sm" : "px-4 py-2 text-sm";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={
        confirm
          ? (e) => {
              if (!window.confirm(confirm)) e.preventDefault();
            }
          : undefined
      }
      className={`inline-flex items-center justify-center gap-1.5 rounded-full transition-colors ${
        styleByVariant[variant]
      } ${sizing} disabled:opacity-70 disabled:cursor-not-allowed ${className}`}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel ?? "Working…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 motion-safe:animate-spin rounded-full border-2 border-current/40 border-t-current"
    />
  );
}
