"use client";

import { useState } from "react";

export default function PushComposer({ deviceCount }: { deviceCount: number }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !busy;

  async function send() {
    if (!canSend) return;
    if (
      !window.confirm(
        `Send this notification to ${deviceCount.toLocaleString("en-IN")} device(s)? This can't be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/push/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const j = (await res.json().catch(() => null)) as {
        ok?: boolean;
        sent?: number;
        failed?: number;
        total?: number;
        error?: string;
      } | null;
      if (res.ok && j?.ok) {
        setResult(
          `Delivered ${j.sent ?? 0} · failed ${j.failed ?? 0} (of ${j.total ?? 0}).`,
        );
        setTitle("");
        setBody("");
      } else {
        setError(j?.error ?? "Send failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-cyan-400/20 bg-[#0B0E16]/85 p-5 max-w-2xl">
      <label className="block text-[11px] uppercase tracking-[0.16em] text-cyan-300/70 font-mono mb-1.5">
        Title
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="Jai Shree Ram 🙏"
        className="w-full rounded-lg border border-cyan-400/25 bg-zinc-950/60 px-3 py-2.5 text-sm text-cream-50 placeholder:text-cream-50/35 focus:outline-none focus:border-cyan-400/60"
      />

      <label className="block text-[11px] uppercase tracking-[0.16em] text-cyan-300/70 font-mono mb-1.5 mt-4">
        Message
      </label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={400}
        rows={3}
        placeholder="Thank you for being part of this Bada Mangal. The next one is on…"
        className="w-full rounded-lg border border-cyan-400/25 bg-zinc-950/60 px-3 py-2.5 text-sm text-cream-50 placeholder:text-cream-50/35 focus:outline-none focus:border-cyan-400/60 resize-none"
      />
      <div className="mt-1 text-right text-[10px] text-cream-50/40 font-mono">
        {body.length}/400
      </div>

      <button
        type="button"
        onClick={send}
        disabled={!canSend}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-cream-50 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? "Sending…" : `Broadcast to ${deviceCount.toLocaleString("en-IN")} device(s)`}
      </button>

      {result ? (
        <p className="mt-3 text-sm text-emerald-300">{result}</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
