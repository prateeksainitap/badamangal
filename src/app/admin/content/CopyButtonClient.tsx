"use client";

import { useState } from "react";
import { IconCheck } from "@/components/admin/AdminIcons";

/** Small client island — copies its `text` prop to the clipboard
 *  on click and flips its label to "Copied" (with check icon) for
 *  1.5s. Used inside ContentCard so the rest of the card can stay
 *  server-rendered. */
export default function CopyButtonClient({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard may be unavailable in some contexts */
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
  );
}
