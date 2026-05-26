import { prisma } from "@/lib/db";

/**
 * Small server-rendered pill that shows when the OpenClaw ingestion
 * agent (on the spare MacBook) last pinged the heartbeat endpoint.
 *
 * Reads the `bot_heartbeat_mbp` row from SiteCounter. The MacBook's
 * cron POSTs to `/api/bot/heartbeat?source=mbp` every 5 minutes, so a
 * healthy gap should sit between 0 and ~6 minutes. Anything beyond
 * that surfaces red, either the MacBook is asleep / unplugged or the
 * OpenClaw daemon has died.
 *
 * Renders nothing if the row doesn't exist yet (i.e. the bot has
 * never pinged). We don't want a noisy red badge on first load,
 * before the user has set up the cron.
 */
export default async function BotHeartbeat() {
  // Try/catch around the single DB read so a transient EMAXCONN on
  // peak traffic doesn't take down the entire admin tree. This
  // component sits in the AdminShell header, which wraps every
  // /admin/* route — an uncaught reject here bubbles to admin/error.tsx
  // and surfaces as "Something tripped while rendering this page"
  // on EVERY admin surface (dashboard, queues, edit pages, all of it).
  // Silently rendering null on failure is the right degradation: the
  // pill is non-critical UI and the user can still operate the admin.
  let row: { count: number; updatedAt: Date } | null = null;
  try {
    row = await prisma.siteCounter.findUnique({
      where: { id: "bot_heartbeat_mbp" },
      select: { count: true, updatedAt: true },
    });
  } catch (err) {
    console.error(
      "[BotHeartbeat] heartbeat lookup failed:",
      err instanceof Error ? err.message : err,
    );
  }
  if (!row) return null;

  const ageMs = Date.now() - row.updatedAt.getTime();
  const ageMin = Math.floor(ageMs / 60_000);

  // Three states: fresh (< 7 min, green), stale (7–30 min, gold),
  // dead (> 30 min, red). The ping is supposed to happen every 5 min;
  // we give one missed beat as a soft buffer.
  const tone: "fresh" | "stale" | "dead" =
    ageMin < 7 ? "fresh" : ageMin < 30 ? "stale" : "dead";

  const COLOURS = {
    fresh: "bg-leaf-600/10 border-leaf-600/40 text-leaf-600",
    stale: "bg-saffron-500/[0.14] border-saffron-500/40 text-saffron-300",
    dead: "bg-alert-500/10 border-alert-500/45 text-alert-500",
  } as const;
  const DOT = {
    fresh: "bg-leaf-600",
    stale: "bg-gold-500",
    dead: "bg-alert-500",
  } as const;
  const LABEL =
    tone === "fresh"
      ? `Bot online · last ping ${formatAge(ageMin)}`
      : tone === "stale"
        ? `Bot quiet · last ping ${formatAge(ageMin)}`
        : `Bot offline · last ping ${formatAge(ageMin)}`;

  return (
    <span
      title={`Total pings: ${row.count.toLocaleString("en-IN")}\nLast: ${row.updatedAt.toISOString()}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-mukta uppercase tracking-[0.18em] font-semibold ${COLOURS[tone]}`}
    >
      <span
        aria-hidden
        className={`block w-1.5 h-1.5 rounded-full ${tone === "fresh" ? "motion-safe:animate-pulse " : ""}${DOT[tone]}`}
      />
      {LABEL}
    </span>
  );
}

function formatAge(min: number): string {
  if (min < 1) return "just now";
  if (min === 1) return "1 min ago";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs === 1) return "1 hr ago";
  if (hrs < 24) return `${hrs} hrs ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
