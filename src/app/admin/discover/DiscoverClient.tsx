"use client";

/**
 * Client-side discovery UI for /admin/discover.
 *
 * Three layers:
 *   1. Query form — single text input + year picker + "Run discovery"
 *      button. Defaults to "Bada Mangal bhandara Lucknow {currentYear}"
 *      so admins can hit the button immediately.
 *   2. Results list — cards for each candidate Gemini returned.
 *      Sorted by confidence desc. Per-card pieces: name, area pill,
 *      timing line, organiser line, description, source links, the
 *      "Add as PENDING bhandara" form (POSTs to
 *      addDiscoveredBhandaraAction with hidden inputs carrying the
 *      full candidate payload).
 *   3. Status strip — between form and results: spinner during fetch,
 *      error message on failure, or summary + result count after a
 *      successful discovery run.
 *
 * Why client-side: a server-action discovery flow would refresh the
 * whole page on each "Run" click, which feels sluggish for a 5-10s
 * Gemini round-trip. Client-side fetch + local state keeps the form
 * snappy and lets us show a spinner.
 *
 * The Add action IS a server action though (no client JS for the
 * write path) — each card has its own <form action={…}> with hidden
 * inputs serialising the candidate. Browser navigates straight to
 * /admin/edit/[id] after the action completes, no JSON round-trip.
 */
import { useMemo, useState, type FormEvent } from "react";
import { addDiscoveredBhandaraAction } from "@/app/admin/actions";

/** Shape returned by /api/admin/discover-bhandaras — mirror of the
 *  DiscoveredBhandara Zod schema in lib/vision.ts. Kept here as a
 *  local type so the component doesn't depend on server-only modules. */
type Candidate = {
  name: string;
  nameHi: string;
  area: string;
  address: string;
  landmark: string;
  tuesdayDates: string[];
  timeStart: string;
  timeEnd: string;
  organizerName: string;
  organizerPhone: string;
  description: string;
  sources: { url: string; title: string }[];
  confidence: number;
};

type DiscoveryResponse = {
  ok?: boolean;
  query?: string;
  year?: number;
  summary?: string;
  candidates?: Candidate[];
  error?: string;
  detail?: string;
};

/** Below this confidence we hide the candidate entirely. The endpoint
 *  doesn't filter — Gemini can legitimately mark a low-confidence
 *  candidate that the admin might still want to see — but cards under
 *  0.3 are usually so speculative they're noise. Admins who want
 *  everything can click "Show low-confidence" to relax this. */
const HIDE_BELOW_CONFIDENCE = 0.3;

export default function DiscoverClient() {
  const currentYear = new Date().getFullYear();
  const [query, setQuery] = useState<string>(
    `Bada Mangal bhandara Lucknow ${currentYear}`,
  );
  const [year, setYear] = useState<number>(currentYear);
  const [loading, setLoading] = useState<boolean>(false);
  const [resp, setResp] = useState<DiscoveryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLowConfidence, setShowLowConfidence] = useState<boolean>(false);

  async function runDiscovery(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResp(null);
    try {
      const res = await fetch("/api/admin/discover-bhandaras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), year }),
      });
      const data = (await res.json()) as DiscoveryResponse;
      if (!res.ok || !data.ok) {
        setError(data.detail ?? data.error ?? "Discovery failed");
        setResp(null);
      } else {
        setResp(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  // Filter + sort the candidates for display. Low-confidence are
  // hidden by default; the toggle exposes them when the admin wants
  // to triage everything Gemini found.
  const visibleCandidates = useMemo(() => {
    if (!resp?.candidates) return [];
    const arr = [...resp.candidates].sort(
      (a, b) => b.confidence - a.confidence,
    );
    if (showLowConfidence) return arr;
    return arr.filter((c) => c.confidence >= HIDE_BELOW_CONFIDENCE);
  }, [resp, showLowConfidence]);

  const hiddenCount =
    (resp?.candidates?.length ?? 0) - visibleCandidates.length;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
      <header className="pt-8 pb-4">
        <p className="text-xs uppercase tracking-wider text-ink-600">
          Moderation
        </p>
        <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
          🔎 Discover bhandaras on the web
        </h1>
        <p className="mt-2 text-sm text-ink-600 max-w-2xl">
          Search Google via Gemini for Bada Mangal bhandaras happening
          this season. Candidates surface as cards below; click{" "}
          <strong>Add as PENDING</strong> to drop one into the moderation
          queue, where you can fix coordinates, menu, and timings before
          publishing.
        </p>
        <div className="mt-3">
          <a
            href="/admin"
            className="text-sm text-saffron-600 hover:text-saffron-700 underline decoration-dotted underline-offset-4"
          >
            ← Back to main admin
          </a>
        </div>
      </header>

      {/* Query form. Plain HTML form posting onSubmit so Enter in
          the text field triggers Run, same UX as Google itself. */}
      <form
        onSubmit={runDiscovery}
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      >
        <label className="grid gap-1.5">
          <span className="text-sm text-ink-600">Search query</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bada Mangal bhandara Lucknow 2026"
            maxLength={200}
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-ink-600">Season year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900"
          >
            {[currentYear, currentYear + 1, currentYear - 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-5 py-2.5 text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Spinner />
              Searching the web…
            </>
          ) : (
            "Run discovery"
          )}
        </button>
      </form>

      {/* Status strip: loading hint, error, or summary line. */}
      {loading ? (
        <p className="mt-6 text-sm text-ink-600 italic">
          Asking Gemini to scour the web for matches — this can take 5-10
          seconds for a thorough grounded search.
        </p>
      ) : null}
      {error ? (
        <div className="mt-6 rounded-2xl border border-alert-500/40 bg-alert-50 p-4 text-sm text-alert-700">
          <strong>Discovery failed:</strong> {error}
        </div>
      ) : null}
      {resp && !loading ? (
        <div className="mt-6 grid gap-2">
          {resp.summary ? (
            <p className="text-sm text-ink-600 italic">{resp.summary}</p>
          ) : null}
          <p className="text-xs text-ink-600">
            {visibleCandidates.length} candidate
            {visibleCandidates.length === 1 ? "" : "s"} shown
            {hiddenCount > 0 ? (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setShowLowConfidence((v) => !v)}
                  className="underline decoration-dotted underline-offset-4 text-saffron-600 hover:text-saffron-700"
                >
                  {showLowConfidence
                    ? `hide ${hiddenCount} low-confidence`
                    : `show ${hiddenCount} low-confidence`}
                </button>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {/* Results grid. Empty state explains the most common failure
          (no candidates returned) without scaring the admin into
          thinking the tool is broken. */}
      {resp && !loading && visibleCandidates.length === 0 ? (
        <p className="mt-6 text-sm text-ink-600 italic">
          No candidates above the confidence threshold. Try a different
          query (e.g. narrow by area, or drop the year if you&apos;re
          searching past seasons) or toggle &quot;show low-confidence&quot;
          if there are hidden results.
        </p>
      ) : null}
      <ul className="mt-6 grid gap-3">
        {visibleCandidates.map((c, idx) => (
          <CandidateCard key={`${c.name}-${idx}`} candidate={c} />
        ))}
      </ul>
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const lowConfidence = candidate.confidence < 0.5;
  return (
    <li className="rounded-2xl border border-gold-500/40 bg-white p-4 grid gap-3">
      <div className="flex flex-wrap items-start gap-2 justify-between">
        <div className="grid gap-1 min-w-0">
          <h3 className="font-fraunces text-lg text-sindoor-700 break-words">
            {candidate.name}
            {candidate.nameHi ? (
              <span className="ml-2 text-ink-600 text-base">
                ({candidate.nameHi})
              </span>
            ) : null}
          </h3>
          <div className="flex flex-wrap gap-2 items-center text-xs">
            {candidate.area ? (
              <span className="px-2 py-0.5 rounded-full bg-cream-50 text-ink-700 border border-gold-500/40">
                📍 {candidate.area}
              </span>
            ) : null}
            {lowConfidence ? (
              <span className="px-2 py-0.5 rounded-full bg-saffron-100 text-saffron-700 border border-saffron-300">
                low confidence ({candidate.confidence.toFixed(2)})
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-leaf-100 text-leaf-700 border border-leaf-300">
                conf {candidate.confidence.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>

      {candidate.address ? (
        <p className="text-sm text-ink-900">
          <strong>Address:</strong> {candidate.address}
          {candidate.landmark ? ` · ${candidate.landmark}` : ""}
        </p>
      ) : null}

      {candidate.timeStart || candidate.organizerName ? (
        <p className="text-sm text-ink-900">
          {candidate.timeStart ? (
            <>
              <strong>Timing:</strong> {candidate.timeStart}
              {candidate.timeEnd ? ` — ${candidate.timeEnd}` : ""}
            </>
          ) : null}
          {candidate.timeStart && candidate.organizerName ? " · " : ""}
          {candidate.organizerName ? (
            <>
              <strong>Host:</strong> {candidate.organizerName}
              {candidate.organizerPhone
                ? ` (${candidate.organizerPhone})`
                : ""}
            </>
          ) : null}
        </p>
      ) : null}

      {candidate.tuesdayDates.length > 0 ? (
        <p className="text-sm text-ink-900">
          <strong>Dates:</strong> {candidate.tuesdayDates.join(", ")}
        </p>
      ) : null}

      {candidate.description ? (
        <p className="text-sm text-ink-600 whitespace-pre-wrap break-words">
          {candidate.description}
        </p>
      ) : null}

      {candidate.sources.length > 0 ? (
        <div className="text-xs text-ink-600 flex flex-wrap gap-x-3 gap-y-1">
          <span className="font-medium text-ink-900">Sources:</span>
          {candidate.sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-4 text-saffron-600 hover:text-saffron-700 break-all"
            >
              {s.title || new URL(s.url).hostname} ↗
            </a>
          ))}
        </div>
      ) : null}

      {/* Add action — server action, plain HTML form. Hidden inputs
          serialise the candidate so the action can rebuild it
          server-side. Arrays go through JSON.stringify because
          FormData can't carry structured types. */}
      <form
        action={addDiscoveredBhandaraAction}
        className="pt-2 mt-1 border-t border-gold-500/20 flex flex-wrap gap-2 items-center justify-end"
      >
        <input type="hidden" name="name" value={candidate.name} />
        <input type="hidden" name="nameHi" value={candidate.nameHi} />
        <input type="hidden" name="area" value={candidate.area} />
        <input type="hidden" name="address" value={candidate.address} />
        <input type="hidden" name="landmark" value={candidate.landmark} />
        <input type="hidden" name="timeStart" value={candidate.timeStart} />
        <input type="hidden" name="timeEnd" value={candidate.timeEnd} />
        <input
          type="hidden"
          name="organizerName"
          value={candidate.organizerName}
        />
        <input
          type="hidden"
          name="organizerPhone"
          value={candidate.organizerPhone}
        />
        <input
          type="hidden"
          name="description"
          value={candidate.description}
        />
        <input
          type="hidden"
          name="tuesdayDates"
          value={JSON.stringify(candidate.tuesdayDates)}
        />
        <input
          type="hidden"
          name="sources"
          value={JSON.stringify(candidate.sources)}
        />
        <button
          type="submit"
          className="rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm"
        >
          + Add as PENDING bhandara
        </button>
      </form>
    </li>
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
