import { prisma } from "@/lib/db";
import DbHealth from "./DbHealth";

/**
 * Status-pill cluster for the AdminShell header.
 *
 * Historical note: this file used to render only the bot heartbeat
 * pill, hence the name. After Bada Mangal #4 we wanted a DB-health
 * pill in the same slot. Rather than plumb a new prop through 17
 * admin pages, the default export now renders BOTH pills (DB first,
 * bot second) wrapped in a single flex container - every page that
 * already passes `<BotHeartbeat />` into AdminShell's `botHeartbeat`
 * slot automatically picks up the DB pill too.
 *
 * Same trick for the stale-bot ALERT BANNER (added after the 5th
 * Bada Mangal, when the bot died at 12:53 and we only noticed via a
 * missing spot ~15 min later): the default export also emits a loud
 * fixed banner across the top of every admin page when the heartbeat
 * crosses STALE_ALERT_MIN. Because the banner is `position: fixed`,
 * it escapes the header's layout and spans the viewport regardless of
 * where in the DOM it renders, so the existing header slot is enough -
 * no new prop, no per-page wiring. It auto-clears the moment the bot
 * pings again (the 5-min cron refreshes `updatedAt`).
 *
 * If you add a third pill (R2 health, Gemini status, …) the same
 * convention applies - add it here and every admin page gets it.
 */

// The heartbeat cron POSTs every 5 minutes, so a healthy gap is 0-6
// min. We raise the banner at 10 min: that is two missed beats, well
// past jitter, and means WhatsApp ingestion has very likely stalled.
const STALE_ALERT_MIN = 10;

export default async function BotHeartbeat() {
  // Single DB read, shared by the pill and the banner. Try/catch so a
  // transient EMAXCONN on peak traffic doesn't take down the whole
  // admin tree (this sits in the AdminShell header, wrapping every
  // /admin/* route). Silently degrading to "no pill, no banner" is the
  // right call: it is non-critical chrome.
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

  const ageMin = row
    ? Math.floor((Date.now() - row.updatedAt.getTime()) / 60_000)
    : null;

  return (
    <>
      <span className="inline-flex items-center gap-2 flex-wrap">
        <DbHealth />
        <BotPill row={row} ageMin={ageMin} />
      </span>
      {row && ageMin !== null && ageMin >= STALE_ALERT_MIN ? (
        <BotStaleBanner ageMin={ageMin} lastSeen={row.updatedAt} />
      ) : null}
    </>
  );
}

/**
 * Bot-heartbeat pill, shows when the OpenClaw ingestion agent
 * (on the spare MacBook) last pinged the heartbeat endpoint.
 *
 * Renders nothing if the row doesn't exist yet (i.e. the bot has
 * never pinged). We don't want a noisy red badge on first load,
 * before the user has set up the cron.
 */
function BotPill({
  row,
  ageMin,
}: {
  row: { count: number; updatedAt: Date } | null;
  ageMin: number | null;
}) {
  if (!row || ageMin === null) return null;

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

/**
 * Loud, hard-to-miss banner pinned across the top of every admin page
 * when the bot heartbeat is stale (>= STALE_ALERT_MIN). The header is
 * `sticky top-0 z-20 h-14`, so we sit at `top-14` directly beneath it,
 * full-width, z-30. Amber for the 10–30 min window (likely stalled),
 * red past 30 (definitely down). Non-dismissible by design: it should
 * keep nagging until the operator restarts the gateway and the next
 * heartbeat clears it.
 */
function BotStaleBanner({
  ageMin,
  lastSeen,
}: {
  ageMin: number;
  lastSeen: Date;
}) {
  const dead = ageMin >= 30;
  const palette = dead
    ? "bg-alert-500/[0.16] border-alert-500/50 text-white"
    : "bg-saffron-500/[0.16] border-saffron-500/50 text-white";
  const dot = dead ? "bg-alert-500" : "bg-gold-500";

  return (
    <div
      role="alert"
      className={`fixed top-14 left-0 right-0 z-30 border-b ${palette} backdrop-blur-md px-4 sm:px-6 py-2 flex items-center gap-2.5 text-[0.78rem] font-mukta`}
    >
      <span
        aria-hidden
        className={`shrink-0 block w-2 h-2 rounded-full motion-safe:animate-pulse ${dot}`}
      />
      <span className="flex-1 leading-snug">
        <strong className="font-bold uppercase tracking-[0.12em]">
          {dead ? "Bot offline" : "Bot quiet"}
        </strong>{" "}
        — last heartbeat {formatAge(ageMin)}. WhatsApp ingestion is paused;
        photos and locations dropped now are NOT being captured. Restart the
        OpenClaw gateway on the bhandara Mac (`openclaw gateway restart`).
      </span>
      <a
        href="/admin/bot-log"
        className="shrink-0 rounded-full border border-white/30 px-3 py-1 font-semibold uppercase tracking-[0.14em] text-[0.68rem] hover:bg-white/5 transition-colors"
      >
        Bot log
      </a>
      <span className="hidden sm:block shrink-0 text-[0.62rem] opacity-60 tabular-nums">
        {lastSeen.toISOString().slice(11, 16)} UTC
      </span>
    </div>
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
