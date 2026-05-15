"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/admin/actions";

/**
 * Admin sign-in form, lifted out of the server-component LoginScreen
 * so we can:
 *
 *   1. Add a show/hide-password toggle (eye icon). Plain `type="password"`
 *      meant the admin couldn't sanity-check typos on a long random
 *      ADMIN_PASSWORD value — common UX gap on every paste-style login.
 *
 *   2. Surface a loading spinner during form submission. The previous
 *      version submitted via a server action with no visible feedback —
 *      on a cold Netlify Function the click felt frozen for 1-2 seconds.
 *      `useFormStatus()` gives us the canonical `pending` flag from the
 *      same submission Next is already running, so no extra state.
 *
 * The form action is still the server-side `loginAction` from
 * /app/admin/actions.ts. Logic on the server didn't change at all —
 * cookie write, redirect, the works.
 */
export default function AdminLoginForm({ error }: { error: boolean }) {
  const [show, setShow] = useState(false);

  return (
    <form action={loginAction} className="mt-6 grid gap-3 text-left">
      <label className="grid gap-1.5">
        <span className="text-sm text-ink-600">Password</span>
        <div className="relative">
          <input
            required
            type={show ? "text" : "password"}
            name="password"
            autoFocus
            autoComplete="current-password"
            // Right-pad so the toggle button doesn't overlap the text.
            className="w-full rounded-xl border border-gold-500/50 bg-white pl-3 pr-11 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink-600 hover:text-sindoor-700 hover:bg-saffron-50 transition-colors"
          >
            {show ? <EyeOff /> : <Eye />}
          </button>
        </div>
      </label>

      {error ? (
        <p className="text-xs text-alert-500">Wrong password. Try again.</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

/**
 * Pulls the form's pending state from React-DOM's form-status context.
 * Must live inside <form>, can't be the parent.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="mt-2 inline-flex justify-center items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <Spinner />
          Signing in…
        </>
      ) : (
        "Sign in"
      )}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 motion-safe:animate-spin rounded-full border-2 border-cream-50/40 border-t-cream-50"
    />
  );
}

function Eye() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a16.27 16.27 0 0 1-2.16 3.19" />
      <path d="M6.61 6.61A16.41 16.41 0 0 0 2 12s3.5 7 10 7a10.92 10.92 0 0 0 5.39-1.39" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
