import { prisma } from "@/lib/db";

/**
 * DB-health pill, sits in the AdminShell header alongside the
 * BotHeartbeat pill. Runs a single lightweight `bhandara.count`
 * with the same `status: "APPROVED"` filter the public homepage
 * uses, so the pill reads as a direct proxy for "would the
 * homepage render real data right now?"
 *
 * Why count(APPROVED) and not a generic `SELECT 1`? The failure
 * mode we actually got bitten by during Bada Mangal #4 wasn't
 * "the connection is dead" - it was "the connection is alive
 * but every query in flight starts rejecting / timing out, and
 * the homepage's catch fallback fires its empty stub, so the
 * banner says 'All 0'". A trivial `SELECT 1` would still report
 * "healthy" in that scenario because the connection is technically
 * up. Counting the rows the homepage actually needs is the only
 * probe that catches the "0 values during peak hours" failure.
 *
 * Three signals from one round-trip:
 *
 *   - reject              → "DB · offline" (red)
 *   - query > SLOW_MS     → "DB · slow Nms" (amber, pool pressure)
 *   - approvedCount === 0 → "DB · no data" (red, exactly the
 *                            failure mode we're trying to detect)
 *   - otherwise           → "DB · online" (green)
 *
 * The pill renders ~30-80 ms warm. Acceptable to run on every
 * admin page render - the operator stares at this pill exactly so
 * they catch the moment the homepage flips to empty BEFORE a
 * visitor reports it.
 */
const SLOW_MS = 1500;

export default async function DbHealth() {
  const started = Date.now();
  let approvedCount: number | null = null;
  let probeError: string | null = null;
  try {
    approvedCount = await prisma.bhandara.count({
      where: { status: "APPROVED" },
    });
  } catch (err) {
    probeError = err instanceof Error ? err.message : String(err);
  }
  const elapsedMs = Date.now() - started;

  type Tone = "fresh" | "stale" | "dead";
  const state: { tone: Tone; label: string } = probeError
    ? { tone: "dead", label: "DB · offline" }
    : approvedCount === 0
      ? { tone: "dead", label: "DB · no data" }
      : elapsedMs > SLOW_MS
        ? { tone: "stale", label: `DB · slow ${elapsedMs}ms` }
        : { tone: "fresh", label: "DB · online" };

  const COLOURS: Record<Tone, string> = {
    fresh: "bg-leaf-600/10 border-leaf-600/40 text-leaf-600",
    stale: "bg-saffron-500/[0.14] border-saffron-500/40 text-saffron-300",
    dead: "bg-alert-500/10 border-alert-500/45 text-alert-500",
  };
  const DOT: Record<Tone, string> = {
    fresh: "bg-leaf-600",
    stale: "bg-saffron-500",
    dead: "bg-alert-500",
  };

  // Use a coalesce on the success-path branch so TS narrows past
  // the `approvedCount: number | null` initial type, the failure
  // case (`probeError !== null`) is handled above so by the time
  // we read approvedCount it's a real number, but TS can't infer
  // that from the implicit `else` of an unrelated `if`.
  const title = probeError
    ? `DB probe rejected: ${probeError}\nElapsed: ${elapsedMs} ms`
    : approvedCount === 0
      ? `DB reachable but 0 APPROVED bhandaras.\nHomepage will render "All 0".\nElapsed: ${elapsedMs} ms`
      : `Approved bhandaras: ${(approvedCount ?? 0).toLocaleString("en-IN")}\nQuery: ${elapsedMs} ms`;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-mukta uppercase tracking-[0.18em] font-semibold ${COLOURS[state.tone]}`}
    >
      <span
        aria-hidden
        className={`block w-1.5 h-1.5 rounded-full ${state.tone === "fresh" ? "motion-safe:animate-pulse " : ""}${DOT[state.tone]}`}
      />
      {state.label}
    </span>
  );
}
