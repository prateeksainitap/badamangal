"use client";

import { useFormStatus } from "react-dom";

/**
 * Generic admin action submit button with a built-in pending state.
 *
 * Why this exists:
 *   Every action button on /admin posts a server action that touches
 *   Prisma (and sometimes revalidates several paths). On a cold Netlify
 *   Function the round-trip is 1-2s, during which the row looks frozen
 *   and the admin tends to double-click, which fires the action twice
 *   and occasionally races (e.g. publish + reject in quick succession).
 *
 *   `useFormStatus()` reads the same pending flag Next is already
 *   tracking for the parent <form action={…}>, so we get:
 *     • the button disabled (no double-submit)
 *     • a spinner + label swap that *feels* responsive
 *
 * It MUST be a child of an actual <form> (the react-dom hook is form-
 * scoped). Otherwise `pending` is always false. The same pattern is
 * used by AdminLoginForm, see the long comment block there for the
 * "why useFormStatus and not local state" reasoning.
 *
 *
 * VISUAL SYSTEM, "one bold + tinted siblings"
 * --------------------------------------------
 * Every action button across the admin app shares one shape and two
 * sizing tokens (sm for rows, md for forms). Variants only change
 * fill / border weight, never padding or radius. That gives the
 * operator a single visual language to scan:
 *
 *   • Tier 1, SOLID (one per row max)
 *     primary-green     leaf-600 fill, soft green glow      → Verify, Approve, Confirm
 *     primary-saffron   cyan→violet gradient, soft glow     → Scan & publish, hero CTAs
 *
 *   • Tier 2, SUBTLE TINTED (multiple per row, calmer siblings)
 *     outline-leaf      leaf-tint bg + thin leaf border     → +8h, Re-approve, secondary positive
 *     outline-saffron   cyan-tint bg + thin cyan border     → Edit, Publish (no badge), neutral
 *     outline-alert     alert-tint bg + thin alert border   → Reject, Delist, Delete
 *     outline-ink       ink-tint bg + thin neutral border   → Sign out, Refresh, overflow text
 *
 * Variant names are preserved so the dozens of existing call sites
 * keep working with no edits, only the underlying classes change.
 */
type Variant =
  | "primary-green" // solid leaf, the row's ONE main positive action
  | "primary-saffron" // solid cyan→violet gradient, page-hero CTAs
  | "outline-leaf" // subtle leaf-tint, secondary positive
  | "outline-saffron" // subtle cyan-tint, neutral / edit / view
  | "outline-alert" // subtle alert-tint, destructive
  | "outline-ink"; // subtle ink-tint, neutral text actions

const styleByVariant: Record<Variant, string> = {
  // SOLID, bold fills + a soft drop-glow in the matching hue so the
  // tile reads as "click me first". A thin matching border keeps the
  // edge crisp on top of the dark ops-console background.
  "primary-green":
    "bg-leaf-600 hover:bg-leaf-500 text-cream-50 border border-leaf-400/40 shadow-[0_4px_14px_-4px_rgba(93,174,93,0.55)]",
  "primary-saffron":
    "bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 border border-cyan-300/40 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)]",

  // SUBTLE TINTED, soft tinted fill (~8% alpha) + 1px border at the
  // matching tone. Reads as a quiet sibling of the solid primary,
  // not as a competing CTA. Hover bumps the fill to ~14% so the
  // hit-feedback is unmistakable without screaming.
  "outline-leaf":
    "bg-leaf-500/[0.08] border border-leaf-400/30 text-leaf-300 hover:bg-leaf-500/[0.16] hover:border-leaf-400/55 hover:text-leaf-200",
  "outline-saffron":
    "bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100",
  "outline-alert":
    "bg-alert-500/[0.08] border border-alert-500/30 text-alert-400 hover:bg-alert-500/[0.18] hover:border-alert-500/55 hover:text-alert-300",
  "outline-ink":
    "bg-cream-50/[0.05] border border-cream-50/15 text-cream-50/80 hover:bg-cream-50/[0.10] hover:border-cream-50/30 hover:text-cream-50",
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
   * Optional confirmation prompt, when set, clicking the button first
   * shows a native confirm() dialog. If the admin cancels, the submit
   * is prevented and no pending state appears. Used for destructive
   * actions like "Clear queue" / "Reject".
   */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  // sm, row actions (alongside Edit links + overflow menus)
  // md, form-bottom CTAs ("Save changes", "Approve volunteer")
  const sizing =
    size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs";
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
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
