import Link from "next/link";

/**
 * Compact list row for the /admin/emails two-pane inbox.
 *
 * Reads as one dense ~70px tall card — same density as Gmail's
 * desktop list or Apple Mail's message column. Each row carries:
 *   • Unread dot (cyan, only when status === "NEW")
 *   • Sender name (bold when unread)
 *   • Relative time on the right
 *   • Subject on a second line (or "(no subject)" placeholder)
 *   • Body preview on a third line, ~80 chars truncated
 *   • A small avatar disc on the left, coloured deterministically
 *     from the sender's email so the same person carries the same
 *     hue across visits (matches the LiveChatterBoard pattern).
 *
 * The row is a `<Link>` to `/admin/emails?id=<id>&status=<tab>`,
 * which is what the right-pane reader binds to. Active row gets a
 * cyan left border + tinted background so it's visually clear which
 * email the reader is showing.
 */

type ListItemRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  createdAt: Date;
};

function relTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  if (d < 30) return `${d}d`;
  return date.toISOString().slice(5, 10).replace("-", "/");
}

function avatarHueFor(seed: string): string {
  const hues = [
    "bg-cyan-400/[0.20] text-cyan-200 ring-cyan-400/35",
    "bg-violet-400/[0.22] text-violet-200 ring-violet-400/40",
    "bg-leaf-400/[0.22] text-leaf-300 ring-leaf-400/40",
    "bg-saffron-500/[0.22] text-saffron-300 ring-saffron-500/40",
    "bg-sindoor-700/[0.25] text-sindoor-700 ring-sindoor-700/45",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return hues[((h % hues.length) + hues.length) % hues.length];
}

export default function EmailListItem({
  row,
  isActive,
  tab,
}: {
  row: ListItemRow;
  isActive: boolean;
  /** Current status tab — preserved in the link so navigation
   *  doesn't jump back to NEW when the reader opens a row that's
   *  already READ / REPLIED. */
  tab: string;
}) {
  const isNew = row.status === "NEW";
  const initial = (row.name?.trim()?.[0] ?? row.email[0] ?? "•").toUpperCase();
  const hue = avatarHueFor(row.email || row.name || row.id);

  // Body preview — first line that has any visible content, plus
  // a continuation ellipsis. Stripped of leading "Namaste" / "Hi"
  // would be nice but the operator usually wants to see the
  // opening line verbatim, so leave as-is.
  const preview = row.message
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return (
    <Link
      href={`/admin/emails?status=${encodeURIComponent(tab)}&id=${encodeURIComponent(row.id)}`}
      prefetch={false}
      scroll={false}
      aria-current={isActive ? "true" : undefined}
      className={[
        "block border-l-2 transition-colors",
        isActive
          ? "bg-cyan-400/[0.10] border-l-cyan-400"
          : "border-l-transparent hover:bg-cream-50/[0.04]",
      ].join(" ")}
    >
      <div className="px-3.5 py-3 flex items-start gap-3">
        {/* Avatar disc */}
        <span
          className={[
            "shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full ring-1 text-[12px] font-bold leading-none",
            hue,
          ].join(" ")}
          aria-hidden
        >
          {initial}
        </span>

        {/* Content column */}
        <div className="min-w-0 flex-1">
          {/* Row 1: sender + time + unread dot */}
          <div className="flex items-center gap-2">
            {isNew ? (
              <span
                aria-label="Unread"
                className="shrink-0 inline-block w-1.5 h-1.5 rounded-full bg-cyan-300"
              />
            ) : null}
            <span
              className={[
                "text-sm truncate",
                isNew ? "font-semibold text-cream-50" : "text-cream-50/80",
              ].join(" ")}
            >
              {row.name}
            </span>
            <span className="ml-auto shrink-0 text-[10.5px] text-cream-50/45 tabular-nums font-mono">
              {relTime(row.createdAt)}
            </span>
          </div>

          {/* Row 2: subject */}
          <div
            className={[
              "text-[13px] truncate mt-0.5",
              isNew
                ? "text-cream-50/90 font-medium"
                : "text-cream-50/65",
            ].join(" ")}
          >
            {row.subject?.trim() || (
              <span className="italic text-cream-50/45">(no subject)</span>
            )}
          </div>

          {/* Row 3: body preview */}
          <div className="text-[12px] text-cream-50/45 truncate mt-0.5">
            {preview}
          </div>
        </div>
      </div>
    </Link>
  );
}
