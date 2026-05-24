"use client";

/**
 * Client-side discovery UI for /admin/discover — dark-themed
 * rewrite that lives inside the new <AdminShell>.
 *
 * Query form (top) → run discovery → results list. Each candidate
 * card has an "Add as PENDING" form that hands the row to
 * addDiscoveredBhandaraAction (server action), which inserts a
 * PENDING Bhandara and redirects to its edit page.
 */
import { useMemo, useState, type FormEvent } from "react";
import { addDiscoveredBhandaraAction } from "@/app/admin/actions";
import AdminListbox from "@/components/admin/AdminListbox";

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

/** Candidates under 0.3 confidence are hidden by default — they're
 *  usually noise. Admins can click "show low-confidence" to expand. */
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
    <div>
      {/* Query form — full-width search panel */}
      <form
        onSubmit={runDiscovery}
        className="rounded-2xl border border-cream-50/10 bg-cream-50/[0.03] backdrop-blur-sm p-4 sm:p-5"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.16em] text-cream-50/55 font-semibold">
              Search query
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Bada Mangal bhandara Lucknow 2026"
              maxLength={200}
              className="rounded-xl border border-cream-50/15 bg-cream-50/[0.05] px-3 py-2 text-sm text-cream-50 placeholder:text-cream-50/35 focus:outline-none focus:ring-2 focus:ring-saffron-500/40 focus:border-saffron-500/40"
            />
          </label>
          <div className="grid gap-1.5">
            <AdminListbox
              name="year"
              label="Season"
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              options={[currentYear, currentYear + 1, currentYear - 1].map(
                (y) => ({ value: String(y), label: String(y) }),
              )}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 font-semibold border border-cyan-300/40 px-4 py-2 text-sm shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
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
        </div>
      </form>

      {/* Status strip */}
      {loading ? (
        <p className="mt-4 text-sm text-cream-50/55 italic">
          Asking Gemini to scour the web for matches — this can take 5–10
          seconds.
        </p>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-2xl border border-sindoor-700/40 bg-sindoor-700/[0.10] p-4 text-sm text-sindoor-700">
          <strong>Discovery failed:</strong> {error}
        </div>
      ) : null}
      {resp && !loading ? (
        <div className="mt-4 grid gap-1.5">
          {resp.summary ? (
            <p className="text-sm text-cream-50/65 italic">{resp.summary}</p>
          ) : null}
          <p className="text-xs text-cream-50/55">
            <span className="font-numerals tabular-nums text-cream-50/85">
              {visibleCandidates.length}
            </span>{" "}
            candidate{visibleCandidates.length === 1 ? "" : "s"} shown
            {hiddenCount > 0 ? (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setShowLowConfidence((v) => !v)}
                  className="underline decoration-dotted underline-offset-2 text-saffron-500 hover:text-saffron-500/80"
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

      {/* Empty + results */}
      {resp && !loading && visibleCandidates.length === 0 ? (
        <p className="mt-6 text-sm text-cream-50/55 italic">
          No candidates above the confidence threshold. Try a different
          query or toggle &quot;show low-confidence&quot;.
        </p>
      ) : null}
      <ul className="mt-4 grid gap-3">
        {visibleCandidates.map((c, idx) => (
          <CandidateCard key={`${c.name}-${idx}`} candidate={c} index={idx} />
        ))}
      </ul>
    </div>
  );
}

function CandidateCard({
  candidate,
  index,
}: {
  candidate: Candidate;
  index: number;
}) {
  const lowConfidence = candidate.confidence < 0.5;
  return (
    <li
      style={{ ["--i" as string]: Math.min(index, 6) }}
      className="admin-row-in rounded-2xl border border-cream-50/10 bg-cream-50/[0.03] backdrop-blur-sm p-4 sm:p-5 grid gap-3"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start gap-2 justify-between">
        <div className="grid gap-1 min-w-0">
          <h3 className="font-fraunces text-cream-50 text-lg break-words leading-tight">
            {candidate.name}
            {candidate.nameHi ? (
              <span className="ml-2 text-cream-50/55 text-base font-tiro">
                ({candidate.nameHi})
              </span>
            ) : null}
          </h3>
          <div className="flex flex-wrap gap-1.5 items-center text-xs">
            {candidate.area ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cream-50/[0.06] text-cream-50/85 border border-cream-50/10">
                📍 {candidate.area}
              </span>
            ) : null}
            <span
              className={[
                "inline-flex items-center px-2 py-0.5 rounded-full border font-numerals tabular-nums",
                lowConfidence
                  ? "bg-saffron-500/[0.10] text-saffron-500 border-saffron-500/30"
                  : "bg-leaf-400/[0.14] text-leaf-400 border-leaf-400/30",
              ].join(" ")}
            >
              conf {candidate.confidence.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {candidate.address ? (
        <p className="text-sm text-cream-50/85">
          <span className="text-cream-50/45">Address:</span>{" "}
          {candidate.address}
          {candidate.landmark ? ` · ${candidate.landmark}` : ""}
        </p>
      ) : null}

      {candidate.timeStart || candidate.organizerName ? (
        <p className="text-sm text-cream-50/85">
          {candidate.timeStart ? (
            <>
              <span className="text-cream-50/45">Timing:</span>{" "}
              {candidate.timeStart}
              {candidate.timeEnd ? ` — ${candidate.timeEnd}` : ""}
            </>
          ) : null}
          {candidate.timeStart && candidate.organizerName ? " · " : ""}
          {candidate.organizerName ? (
            <>
              <span className="text-cream-50/45">Host:</span>{" "}
              {candidate.organizerName}
              {candidate.organizerPhone
                ? ` (${candidate.organizerPhone})`
                : ""}
            </>
          ) : null}
        </p>
      ) : null}

      {candidate.tuesdayDates.length > 0 ? (
        <p className="text-sm text-cream-50/85">
          <span className="text-cream-50/45">Dates:</span>{" "}
          {candidate.tuesdayDates.join(", ")}
        </p>
      ) : null}

      {candidate.description ? (
        <p className="text-sm text-cream-50/65 whitespace-pre-wrap break-words">
          {candidate.description}
        </p>
      ) : null}

      {candidate.sources.length > 0 ? (
        <div className="text-xs text-cream-50/55 flex flex-wrap gap-x-3 gap-y-1">
          <span className="font-medium text-cream-50/85">Sources:</span>
          {candidate.sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 text-saffron-500 hover:text-saffron-500/80 break-all"
            >
              {s.title || new URL(s.url).hostname} ↗
            </a>
          ))}
        </div>
      ) : null}

      {/* Add as PENDING bhandara */}
      <form
        action={addDiscoveredBhandaraAction}
        className="pt-3 mt-1 border-t border-cream-50/10 flex flex-wrap gap-2 items-center justify-end"
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 font-semibold border border-cyan-300/40 px-4 py-2 text-sm shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] transition-all"
        >
          + Add as PENDING
        </button>
      </form>
    </li>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
