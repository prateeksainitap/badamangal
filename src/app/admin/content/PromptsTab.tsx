import { prisma } from "@/lib/db";
import {
  archivePromptAction,
  deletePromptAction,
  restorePromptAction,
  runPromptAction,
} from "./actions";
import SubmitButton from "@/components/admin/SubmitButton";
import CopyButtonClient from "./CopyButtonClient";
import PromptEditor from "./PromptEditor";
import { EmptyState } from "./PitchesTab";
import { extractVariables, AVAILABLE_MODELS } from "@/lib/openai";

/**
 * Prompts tab — saved AI prompts the operator can Run inline.
 *
 * Each row is a card with:
 *   • Title + tags + default model
 *   • Body preview (collapsed)
 *   • Run form — one text input per {{variable}} extracted from the
 *     body, plus a model picker. Submits to runPromptAction which
 *     calls OpenAI Chat Completions and stores the result in the row.
 *   • lastRunOutput — collapsed details panel showing the most recent
 *     assistant response (truncated to 8k chars in the DB).
 *
 * No streaming for V1 — the form submits, the server action awaits
 * OpenAI, writes back, revalidates the path. Streaming UI can be a
 * follow-up if the wait feels too long.
 *
 * If OPENAI_API_KEY isn't set, runs fail with a friendly error
 * surfaced inline in the lastRunOutput panel (the server action
 * captures errors and writes them as the result string).
 */
export default async function PromptsTab() {
  const rows = await prisma.prompt.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });

  const apiKeyConfigured = Boolean(process.env.OPENAI_API_KEY);

  return (
    <div className="space-y-4">
      {/* API key callout — shown when OPENAI_API_KEY is unset so the
          admin knows the runner won't work yet. Disappears once the
          key is added to .env.local + dev server is restarted. */}
      {!apiKeyConfigured ? (
        <div className="rounded-2xl border border-saffron-500/30 bg-saffron-500/[0.05] p-4 sm:p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-saffron-300 mb-1.5">
            Heads up · API key
          </div>
          <div className="text-sm text-cream-50">
            <code className="text-saffron-300">OPENAI_API_KEY</code> isn&apos;t
            set in <code className="text-saffron-300">.env.local</code>. Add it,
            restart the dev server, and the Run button will start working.
            You can still create / edit / archive prompts without it.
          </div>
        </div>
      ) : null}

      <PromptEditor />

      {rows.length === 0 ? (
        <EmptyState
          title="No prompts yet"
          hint="Save reusable prompts here — outreach drafts, IG caption generators, sponsor follow-ups. Use {{double-brace}} placeholders for variables."
        />
      ) : (
        <div className="grid gap-4">
          {rows.map((p) => (
            <PromptCard key={p.id} row={p} />
          ))}
        </div>
      )}
    </div>
  );
}

type PromptRow = {
  id: string;
  title: string;
  body: string;
  systemPrompt: string | null;
  defaultModel: string;
  tags: string[];
  lastRunAt: Date | null;
  lastRunModel: string | null;
  lastRunOutput: string | null;
  lastRunVars: string | null;
  status: string;
  updatedAt: Date;
};

function PromptCard({ row }: { row: PromptRow }) {
  const vars = extractVariables(`${row.body}\n${row.systemPrompt ?? ""}`);
  const lastVars: Record<string, string> = (() => {
    try {
      return row.lastRunVars ? JSON.parse(row.lastRunVars) : {};
    } catch {
      return {};
    }
  })();
  const isArchived = row.status === "ARCHIVED";
  const isError = row.lastRunOutput?.startsWith("Error: ") ?? false;

  return (
    <article
      className={[
        "rounded-2xl border bg-[#0B0E16]/85 backdrop-blur-sm overflow-hidden",
        isArchived
          ? "border-cream-50/10 opacity-60"
          : "border-cyan-400/15 hover:border-cyan-400/30",
      ].join(" ")}
    >
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="inline-flex items-center rounded-md border bg-cyan-400/[0.10] border-cyan-400/30 text-cyan-200 text-[10px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 font-mono">
            Prompt
          </span>
          <span className="inline-flex items-center rounded-md border bg-violet-400/[0.10] border-violet-400/30 text-violet-200 text-[10px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 font-mono">
            {row.defaultModel}
          </span>
          {row.lastRunAt ? (
            <span className="font-mono text-[10px] text-cream-50/45 uppercase tracking-[0.12em]">
              · last run {row.lastRunAt.toISOString().slice(0, 10)}
            </span>
          ) : null}
        </div>
        <h3 className="font-fraunces text-lg text-cream-50 leading-tight">
          {row.title}
        </h3>
        {row.tags.length > 0 ? (
          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
            {row.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-md bg-cream-50/[0.04] border border-cream-50/10 px-1.5 py-0.5 text-[10px] text-cream-50/55 font-mono"
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}

        {/* Body preview */}
        <details className="mt-3 group">
          <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs text-cyan-300/85 hover:text-cyan-200 font-mono">
            <span aria-hidden className="inline-block w-3 transition-transform group-open:rotate-90">
              ▸
            </span>
            <span>Show prompt body</span>
          </summary>
          {row.systemPrompt ? (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-cream-50/45 mb-1">
                System
              </div>
              <pre className="whitespace-pre-wrap text-[13px] text-cream-50/85 font-mono bg-[#080A10]/60 rounded-lg border border-cyan-400/10 p-3">
                {row.systemPrompt}
              </pre>
            </div>
          ) : null}
          <div className="mt-2">
            <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-cream-50/45 mb-1">
              User
            </div>
            <pre className="whitespace-pre-wrap text-[13px] text-cream-50/85 font-mono bg-[#080A10]/60 rounded-lg border border-cyan-400/10 p-3">
              {row.body}
            </pre>
          </div>
        </details>

        {/* Last-run output — only shown after at least one run. */}
        {row.lastRunOutput ? (
          <details className="mt-3 group" open={isError}>
            <summary
              className={[
                "cursor-pointer list-none flex items-center gap-1.5 text-xs font-mono",
                isError
                  ? "text-alert-400 hover:text-alert-300"
                  : "text-leaf-400 hover:text-leaf-300",
              ].join(" ")}
            >
              <span aria-hidden className="inline-block w-3 transition-transform group-open:rotate-90">
                ▸
              </span>
              <span>
                {isError ? "Error from last run" : `Last response · ${row.lastRunModel ?? row.defaultModel}`}
              </span>
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-[13px] text-cream-50/90 font-mono bg-[#080A10]/60 rounded-lg border border-cyan-400/10 p-3 max-h-96 overflow-y-auto">
              {row.lastRunOutput}
            </pre>
            <div className="mt-2 flex items-center gap-2">
              <CopyButtonClient text={row.lastRunOutput} />
            </div>
          </details>
        ) : null}

        {/* Run form — one input per {{variable}} extracted from the
            prompt body + model picker + Run button. */}
        {!isArchived ? (
          <form
            action={runPromptAction.bind(null, row.id)}
            className="mt-4 rounded-xl border border-cyan-400/20 bg-[#080A10]/60 p-3 sm:p-4 space-y-3"
          >
            <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-cyan-300/85">
              Run with ChatGPT
            </div>

            {vars.length === 0 ? (
              <p className="text-[12px] text-cream-50/55 font-mono">
                No <code>{`{{`}variables{`}}`}</code> — the prompt runs as-is.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {vars.map((name) => (
                  <label key={name} className="grid">
                    <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-cream-50/55 mb-1">
                      {`{{`}{name}{`}}`}
                    </span>
                    <input
                      name={`var:${name}`}
                      type="text"
                      defaultValue={lastVars[name] ?? ""}
                      maxLength={2000}
                      placeholder={`value for ${name}`}
                      className="rounded-lg bg-[#0B0E16]/70 border border-cyan-400/20 px-3 py-1.5 text-sm text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45"
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-cream-50/55">
                  Model
                </span>
                <select
                  name="model"
                  defaultValue={row.defaultModel}
                  className="rounded-lg bg-[#0B0E16]/70 border border-cyan-400/20 px-2.5 py-1.5 text-xs text-cream-50 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400/45"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton variant="primary-saffron" pendingLabel="Running…">
                ▶ Run
              </SubmitButton>
            </div>
          </form>
        ) : null}

        {/* Action row */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {!isArchived ? (
            <details className="inline-block">
              <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-3 py-1.5 text-xs font-medium font-mono transition-colors">
                ✎ Edit
              </summary>
              <div className="mt-3 w-full">
                <PromptEditor editing={row} />
              </div>
            </details>
          ) : (
            <form action={restorePromptAction.bind(null, row.id)}>
              <SubmitButton variant="primary-green" pendingLabel="Restoring…">
                Restore
              </SubmitButton>
            </form>
          )}
          <CopyButtonClient text={row.body} />
          {!isArchived ? (
            <form action={archivePromptAction.bind(null, row.id)}>
              <SubmitButton
                variant="outline-ink"
                pendingLabel="Archiving…"
                confirm="Archive this prompt? You can restore it later."
              >
                Archive
              </SubmitButton>
            </form>
          ) : (
            <form action={deletePromptAction.bind(null, row.id)}>
              <SubmitButton
                variant="outline-alert"
                pendingLabel="Deleting…"
                confirm="Permanently delete this prompt? Cannot be undone."
              >
                Delete
              </SubmitButton>
            </form>
          )}
          <span className="ml-auto text-[11px] text-cream-50/40 font-mono">
            updated {row.updatedAt.toISOString().slice(0, 10)}
          </span>
        </div>
      </div>
    </article>
  );
}
