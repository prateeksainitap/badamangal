"use client";

import { useState } from "react";

type Props = {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  /**
   * Show a copy / check glyph before the label. Defaults to true so most
   * usages get the icon "for free"; pass false for tightly-spaced contexts
   * where the icon would feel busy.
   */
  icon?: boolean;
};

export default function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied!",
  className,
  icon = true,
}: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable; ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-live="polite"
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-saffron-500/45 bg-cream-50 hover:border-saffron-500 text-saffron-600 text-xs font-semibold px-3 py-1.5 transition-colors"
      }
    >
      {icon ? (copied ? <CheckGlyph /> : <CopyGlyph />) : null}
      {copied ? copiedLabel : label}
    </button>
  );
}

function CopyGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
