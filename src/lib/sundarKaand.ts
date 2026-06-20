/**
 * Launch gate for the Sundar Kaand / Hanuman puja intake.
 *
 * The feature ships now (table + API + page + form all ready) but must
 * not accept public submissions until AFTER 23 Jun 2026. Both the
 * public page (/organise/sundar-kaand) and the API
 * (POST /api/organise/sundar-kaand) call isSundarKaandLive() and 404
 * before the launch moment, so the code can deploy safely and the
 * feature switches on by itself, no second deploy needed.
 *
 * To preview before launch, set SUNDAR_KAAND_FORCE_LIVE=1 in the
 * environment (e.g. a Vercel Preview env var). To change the date,
 * edit LAUNCH_MS below.
 */

// 24 Jun 2026, 00:00 IST  ==  23 Jun 2026, 18:30 UTC.
// ("Live after 23 June" -> the first instant of 24 June, India time.)
const LAUNCH_MS = Date.UTC(2026, 5, 23, 18, 30, 0);

export function isSundarKaandLive(now: number = Date.now()): boolean {
  if (process.env.SUNDAR_KAAND_FORCE_LIVE === "1") return true;
  return now >= LAUNCH_MS;
}
