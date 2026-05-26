/**
 * Tiny server-side markdown → safe HTML renderer for the Content Hub.
 *
 * Used by /admin/content's pitch / template / strategy cards to turn
 * the operator's markdown bodies into properly typeset prose
 * (headings, lists, blockquotes, code) instead of the raw `# Heading`
 * dump the old `<pre>` view showed. Renders on the server (no client
 * JS cost) and the resulting HTML drops straight into a styled
 * container via dangerouslySetInnerHTML.
 *
 * Trust model:
 *   Markdown bodies are authored by the admin (single-operator tool).
 *   They're never user-generated content from the public site. So we
 *   ALLOW inline HTML in the source, the admin sometimes wants a
 *   styled span or anchor with target="_blank". If this ever opens up
 *   to multi-user authoring, gate behind a sanitizer (DOMPurify on
 *   the server, or marked's `mangle: false, breaks: true, gfm: true`
 *   with an HTML strip pre-pass).
 *
 * Configured for the GitHub-Flavoured Markdown subset operators
 * actually use: tables, task lists, autolinks. Headings get a
 * deterministic id from the slug so we can wire deep-links later.
 */

import { marked, type MarkedOptions } from "marked";

// One-time configuration. Marked's renderer is stateful, calling
// setOptions repeatedly is wasteful and can cause race-y output if
// multiple modules try to reconfigure. Set once at module load.
marked.setOptions({
  gfm: true,
  breaks: false, // require blank line for paragraph breaks, matches
  // how operators write markdown in the /notes/ files
  // (which is the seed corpus). With breaks:true, every
  // newline becomes a <br> which looks bad in pitch decks.
} satisfies MarkedOptions);

/** Render a markdown string into HTML. Synchronous because
 *  marked.parse() returns a string by default (the async variant is
 *  for custom async extensions which we don't use). Safe to call
 *  from server components. */
export function renderMarkdown(source: string): string {
  if (!source) return "";
  try {
    const out = marked.parse(source);
    // Defensive: in case a future marked version flips the default
    // to async, fall back to a string coercion.
    return typeof out === "string" ? out : String(out);
  } catch {
    // Marked rarely throws but if a malformed table or fence trips
    // it, fall back to the raw source wrapped in a <pre> so the
    // admin at least sees their content rather than an empty card.
    return `<pre class="bm-md-fallback">${escapeHtml(source)}</pre>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
