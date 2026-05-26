"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-segment error boundary for /admin/*.
 *
 * Catches errors thrown during server-rendering or React-rendering of
 * any admin page (dashboard, queues, edit forms, content hub, etc.)
 * and replaces the crash screen with a friendly retry UI on the same
 * dark surface the rest of the admin uses.
 *
 * Why this exists:
 *   The Supabase pooler at `aws-1-ap-southeast-1.pooler.supabase.com:6543`
 *   occasionally hiccups, pool saturation, brief networking blip,
 *   connection-recycling pause, and a single `prisma.bhandara.count`
 *   in the dashboard's `Promise.all` will throw a
 *   `PrismaClientInitializationError`. Without an error boundary the
 *   ENTIRE admin route 500s and the operator has to hard-refresh; the
 *   pooler is back up by the time the dialog renders, but the page is
 *   already dead.
 *
 *   This boundary swaps that crash for: "the database hiccuped, try
 *   again" + a Retry button that calls Next's `reset()` to re-trigger
 *   the segment fetch. 90% of the time the second attempt succeeds
 *   immediately because the pool has freed by then.
 *
 * Failure messages:
 *   We surface the actual error.message in a small details panel so
 *   the operator can debug if a hard failure (e.g. wrong
 *   `DATABASE_URL`) recurs. The error.digest is shown beneath because
 *   that's what Next.js stamps on the server log for the same
 *   request, handy when grepping logs.
 *
 * Why route-segment (not nested per-page):
 *   One file at /admin/error.tsx is enough, Next.js bubbles errors
 *   from any descendant route up to the nearest error.tsx. Less code
 *   to maintain.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Echo to the dev/server console too so the stack survives in
    // Vercel logs even after the operator clicks Retry (which will
    // unmount this component).
    console.error("[admin] route segment error:", error);
  }, [error]);

  const isPrismaConnect =
    /PrismaClientInitializationError/i.test(error.message) ||
    /Can't reach database server/i.test(error.message);

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-[#080A10] text-cream-50">
      <div className="w-full max-w-lg rounded-2xl border border-alert-500/30 bg-[#0B0E16]/90 backdrop-blur-md p-6 sm:p-8 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.7)]">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-3 font-mono text-[10px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-alert-500/[0.10] border border-alert-500/30 px-2.5 py-1 uppercase tracking-[0.18em] text-alert-300">
            <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-alert-500/70 motion-safe:animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-alert-500" />
            </span>
            {isPrismaConnect ? "Database hiccup" : "Admin error"}
          </span>
        </div>

        <h1 className="font-fraunces text-2xl sm:text-3xl leading-tight tracking-tight">
          {isPrismaConnect
            ? "The Supabase pooler took a breath."
            : "Something tripped while rendering this page."}
        </h1>
        <p className="mt-2 text-sm text-cream-50/70 leading-relaxed">
          {isPrismaConnect
            ? "Click Retry, the pool usually frees in a second or two. If it keeps failing, check Supabase → Database → Active connections."
            : "The error is logged. Retry will re-trigger the page; if it persists, the details below help debug."}
        </p>

        {/* Action row */}
        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 border border-cyan-300/40 px-4 py-2 text-sm font-semibold shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] transition-all"
          >
            Retry
          </button>
          <Link
            href="/admin/home"
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm font-medium font-mono transition-colors"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Diagnostic disclosure, collapsed by default, expand to
            see the raw error + digest for log grepping. */}
        <details className="mt-6 group">
          <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.16em] font-mono text-cream-50/55 hover:text-cream-50/80 inline-flex items-center gap-1.5 select-none">
            <span className="inline-block group-open:rotate-90 transition-transform">
              ›
            </span>
            Show technical details
          </summary>
          <div className="mt-3 rounded-lg border border-cream-50/10 bg-[#080A10]/70 p-3 font-mono text-[11px] text-cream-50/70 leading-relaxed">
            <div className="text-cream-50/45 text-[10px] uppercase tracking-[0.16em] mb-1">
              error
            </div>
            <pre className="whitespace-pre-wrap break-words">
              {error.message || "(no message)"}
            </pre>
            {error.digest ? (
              <>
                <div className="text-cream-50/45 text-[10px] uppercase tracking-[0.16em] mt-3 mb-1">
                  digest
                </div>
                <pre className="whitespace-pre-wrap break-words">
                  {error.digest}
                </pre>
              </>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}
