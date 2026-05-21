"use client";

import { useId, useState } from "react";

/**
 * Shared Indian mobile-number input.
 *
 * Visual: a single rounded-xl bordered control with a non-editable
 * "+91" chip on the left and a 10-digit number field on the right.
 * Mirrors the style of every other text input on the site (same
 * gold border, saffron focus ring), so it slots into any form
 * without bespoke CSS.
 *
 * Contract:
 *   • `value` is ALWAYS the 10-digit canonical form (no +91, no
 *     spaces). If a legacy value comes in with a +91/91/0 prefix or
 *     formatting, the component derives the trailing 10 digits for
 *     display via `displayDigits`, the parent state doesn't change.
 *   • `onChange` always emits 10 digits (or "" while still typing).
 *   • Server-side validation lives in `isValidIndianMobile` (which
 *     already strips prefixes), so the canonical 10-digit form
 *     round-trips end-to-end without surprises.
 *
 * Why a custom control instead of just `<input type="tel">`:
 *   The +91 chip makes the country code explicit (zero ambiguity for
 *   users who paste an international number from a contact card),
 *   the 10-digit cap prevents the "I typed 12 digits including
 *   country code" failure mode we saw in admin testing, and the
 *   numeric inputMode keeps mobile keyboards friendly.
 */

type Props = {
  /** Controlled value (10-digit canonical). Pair with onChange.
   *  If omitted, the component manages its own state via
   *  defaultValue (uncontrolled mode, for server-rendered forms). */
  value?: string;
  onChange?: (digits: string) => void;
  /** Initial value for uncontrolled mode. Stripped to 10 digits
   *  on first render so a legacy "+91..." DB value displays clean. */
  defaultValue?: string;
  /** Add the `required` attribute on the underlying input. */
  required?: boolean;
  /** Placeholder for the 10-digit slot. Defaults to "98765 43210". */
  placeholder?: string;
  /** Inline error message (red text below the field). */
  error?: string;
  /** Inline hint text (gray text below the field), shown when no error. */
  hint?: string;
  /** Optional id for the input (used for label `for=`). Auto-generated if omitted. */
  id?: string;
  /** Optional name for form submission. */
  name?: string;
  /** Disabled appearance + cannot type. */
  disabled?: boolean;
  /** Pass through autoComplete (default "tel-national"). */
  autoComplete?: string;
};

/** Normalize an incoming raw string to the 10-digit canonical form.
 *
 * The hard part: telling the country-code "91" apart from a user's
 * mobile number that genuinely starts with "9". Real-life examples:
 *   • "+919876543210"  → 13 chars, has `+` → strip "+91" → "9876543210"
 *   • "919876543210"   → 12 digits, starts "91" → strip "91" → "9876543210"
 *   • "09876543210"    → 11 digits, starts "0"  → strip "0"  → "9876543210"
 *   • "9151019102"     → 10 digits, starts "91" → DO NOT STRIP, it IS the number
 *
 * Previous logic was `replace(/^(\+?91|0)/, "")` which unconditionally
 * stripped any leading "91", silently eating the first two digits of
 * any valid Indian mobile beginning with 91 (e.g. 9151xxxxxx). Bug
 * surfaced in the admin organiser-phone field, typing "9151019102"
 * showed "51019102" on screen.
 *
 * New rule: only strip a "91" / "+91" / "0" prefix when the resulting
 * length is still consistent with a 10-digit Indian mobile (i.e. the
 * input had to have BEEN a 10-digit number with a country code or
 * leading zero attached). Otherwise leave the digits alone so a
 * real-life "9xxxxxxxxx" number types through correctly.
 */
function toDigits(raw: string): string {
  const trimmed = raw.trim();
  // Explicit "+" makes the country code unambiguous regardless of
  // the digit count behind it.
  const hasPlusPrefix = trimmed.startsWith("+");
  // Pure digits only, drops spaces, dashes, parens, "+", any letters.
  let digits = trimmed.replace(/\D/g, "");

  if (hasPlusPrefix && digits.startsWith("91")) {
    // "+91 98765 43210" → strip the "91" we just normalised the "+" off
    digits = digits.slice(2);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    // Bare "919876543210", 12 digits beginning with "91" can only
    // be country-code + 10-digit mobile. Strip.
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    // "09876543210", old-style leading-zero national format. Strip.
    digits = digits.slice(1);
  }
  // Else: leave it as the user typed it. A 10-digit number that
  // happens to start with "91" (e.g. 9151019102) survives intact.

  return digits.slice(0, 10);
}

export default function PhoneInput({
  value,
  onChange,
  defaultValue,
  required,
  placeholder = "98765 43210",
  error,
  hint,
  id,
  name = "phone",
  disabled,
  autoComplete = "tel-national",
}: Props) {
  const autoId = useId();
  const inputId = id ?? `phone-${autoId}`;
  // Controlled vs uncontrolled. If the caller passes `value` they own
  // state. Otherwise we manage internal state seeded from defaultValue
  //, this is what server-rendered <form action={...}> usages need
  // (the admin edit page renders this inside a plain HTML form whose
  // server action reads FormData, no React state involved).
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => toDigits(defaultValue ?? ""));
  const current = isControlled ? value : internal;
  const display = toDigits(current);

  const handleChange = (digits: string) => {
    if (!isControlled) setInternal(digits);
    onChange?.(digits);
  };
  const focusRing = error
    ? "ring-2 ring-alert-500/40 border-alert-500"
    : "focus-within:ring-2 focus-within:ring-saffron-600 focus-within:border-saffron-600";

  return (
    <div className="grid gap-1.5">
      <div
        className={`flex items-stretch rounded-xl border border-gold-500/50 bg-white overflow-hidden transition-colors ${focusRing} ${
          disabled ? "opacity-60" : ""
        }`}
      >
        {/* Non-editable +91 chip. Selectable so power-users can copy
            the full number with country code via triple-click + Cmd-C
            (which selects the whole row including this prefix). */}
        <span
          aria-hidden
          className="shrink-0 inline-flex items-center px-3 bg-saffron-50 text-sindoor-700 font-numerals font-semibold border-r border-gold-500/40 select-text"
        >
          +91
        </span>
        <input
          id={inputId}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          maxLength={10}
          // The pattern is a soft-validation hint for browsers that
          // honor it (Safari shows the inline "please match" prompt
          // for partial entries). Real validation happens server-side
          // via isValidIndianMobile.
          pattern="[6-9][0-9]{9}"
          value={display}
          placeholder={placeholder}
          onChange={(e) => handleChange(toDigits(e.target.value))}
          // Prevent paste of long international numbers from landing
          // junk in state, same normalize on paste as on typing.
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (!pasted) return;
            e.preventDefault();
            handleChange(toDigits(pasted));
          }}
          className="flex-1 min-w-0 px-3 py-2 bg-transparent text-ink-900 placeholder:text-ink-600/55 focus:outline-none font-numerals tabular-nums"
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error ? (
        <span className="text-xs text-alert-500">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-600">{hint}</span>
      ) : null}
    </div>
  );
}
