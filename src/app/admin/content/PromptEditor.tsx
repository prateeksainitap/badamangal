"use client";

import { useState, useTransition } from "react";
import {
  createPromptAction,
  updatePromptAction,
} from "./actions";
import { AVAILABLE_MODELS, extractVariables } from "@/lib/openai";

/**
 * PromptEditor — create / edit a Prompt row.
 *
 * Mirrors ContentEditor's disclosure-style layout for visual
 * consistency. Adds two prompt-specific niceties:
 *   1. Live variable detection — as the admin types {{name}} into
 *      the body, the chip strip beneath updates. Makes it obvious
 *      what inputs the runner will ask for.
 *   2. Model dropdown sourced from AVAILABLE_MODELS so adding a new
 *      model to openai.ts auto-populates here.
 */

type PromptRow = {
  id: string;
  title: string;
  body: string;
  systemPrompt: string | null;
  defaultModel: string;
  tags: string[];
};

const FIELD =
  "w-full rounded-lg bg-[#080A10]/70 border border-cyan-400/20 px-3 py-2 text-sm text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55";
const LABEL =
  "text-[10px] uppercase tracking-[0.16em] text-cream-50/55 font-mono mb-1";

export default function PromptEditor({ editing }: { editing?: PromptRow }) {
  const [body, setBody] = useState(editing?.body ?? "");
  const [systemPrompt, setSystemPrompt] = useState(editing?.systemPrompt ?? "");
  const vars = extractVariables(`${body}\n${systemPrompt}`);
  const [, startTransition] = useTransition();

  const action = editing
    ? updatePromptAction.bind(null, editing.id)
    : createPromptAction;
  const titleText = editing ? `Edit · ${editing.title}` : "+ New prompt";
  const buttonText = editing ? "Save changes" : "Create prompt";

  return (
    <details className="rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm overflow-hidden">
      <summary className="cursor-pointer list-none px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-cyan-400/[0.04] transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <span
            aria-hidden
            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-cyan-400/40 text-cyan-200 transition-transform group-open:rotate-90"
          >
            ✎
          </span>
          <div className="min-w-0">
            <div className="font-medium text-cream-50 text-sm truncate">
              {titleText}
            </div>
            <div className="text-[11px] text-cream-50/45 font-mono mt-0.5">
              {editing
                ? `${editing.defaultModel} · ${editing.tags.length} tags`
                : "Save a reusable prompt with {{variable}} placeholders."}
            </div>
          </div>
        </div>
      </summary>

      <form
        action={(formData) => {
          startTransition(() => {
            void action(formData);
          });
        }}
        className="border-t border-cyan-400/15 p-4 sm:p-5 grid gap-3"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="grid">
            <span className={LABEL}>Title</span>
            <input
              name="title"
              type="text"
              required
              maxLength={200}
              defaultValue={editing?.title ?? ""}
              placeholder="e.g. Sponsor follow-up draft"
              className={FIELD}
            />
          </label>
          <label className="grid">
            <span className={LABEL}>Default model</span>
            <select
              name="defaultModel"
              defaultValue={editing?.defaultModel ?? "gpt-4o-mini"}
              className={FIELD}
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid">
          <span className={LABEL}>Tags (space or comma separated)</span>
          <input
            name="tags"
            type="text"
            maxLength={500}
            defaultValue={editing?.tags.join(" ") ?? ""}
            placeholder="e.g. outreach instagram-caption sponsor"
            className={FIELD}
          />
        </label>

        <label className="grid">
          <span className={LABEL}>
            System prompt (optional · sets tone / persona)
          </span>
          <textarea
            name="systemPrompt"
            rows={3}
            maxLength={4000}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.currentTarget.value)}
            placeholder="You are Prateek, a community organiser in Lucknow…"
            className={FIELD + " font-mono text-[13px] resize-y"}
          />
        </label>

        <label className="grid">
          <span className={LABEL}>
            Prompt body{" "}
            <span className="text-cream-50/35">
              · use {`{{`}name{`}}`} for variables
            </span>
          </span>
          <textarea
            name="body"
            required
            rows={10}
            maxLength={12000}
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
            placeholder={
              "Draft a WhatsApp message to {{name}} about organising a bhandara at {{venue}} on {{date}}. Mention {{detail}}. Sign as Prateek."
            }
            className={FIELD + " font-mono text-[13px] leading-relaxed resize-y"}
          />
        </label>

        {/* Live variable chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.16em] text-cream-50/45 font-mono">
            Detected vars:
          </span>
          {vars.length === 0 ? (
            <span className="text-[11px] text-cream-50/40 font-mono">
              none — the prompt will run as-is
            </span>
          ) : (
            vars.map((v) => (
              <span
                key={v}
                className="inline-flex items-center rounded-md bg-cyan-400/[0.10] border border-cyan-400/30 px-1.5 py-0.5 text-[10px] text-cyan-200 font-mono"
              >
                {`{{`}{v}{`}}`}
              </span>
            ))
          )}
        </div>

        <div className="pt-2 flex items-center justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 font-medium border border-cyan-300/40 px-4 py-2 text-sm shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] transition-colors"
          >
            {buttonText}
          </button>
        </div>
      </form>
    </details>
  );
}
