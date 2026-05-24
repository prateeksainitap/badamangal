/**
 * OpenAI client + prompt runner for the Content Hub.
 *
 * Why this file exists:
 *   /admin/content lets the admin save prompts to the `Prompt` table
 *   and re-run them with one click. The "Run" button posts to a
 *   server action that calls runChatPrompt() here, which:
 *     1. substitutes {{variables}} in the prompt body with the values
 *        the admin entered in the runner form
 *     2. sends [system?, user] messages to OpenAI's Chat Completions
 *     3. returns the assistant message text
 *   The server action then writes `lastRunOutput` / `lastRunAt` /
 *   `lastRunVars` back to the Prompt row so the admin can re-read
 *   the latest result without paying for another API call.
 *
 * API key:
 *   The OpenAI SDK reads `process.env.OPENAI_API_KEY` automatically.
 *   The admin needs to add it to `.env.local` before the runner works:
 *     OPENAI_API_KEY="sk-..."
 *   When the env var is missing we throw a friendly "OPENAI_API_KEY
 *   not set" error that the UI catches and shows instead of crashing
 *   the request. That way unwired prompts still render — just the
 *   Run button surfaces the helpful error.
 *
 * Model selection:
 *   Default model is "gpt-4o-mini" (cheap + fast, ~$0.15 / 1M input
 *   tokens). The Prompt row stores `defaultModel` and the runner UI
 *   can override per-run via a model picker. We allow any string the
 *   SDK accepts so new models (gpt-5, o1, …) just work without code
 *   changes here.
 */

import OpenAI from "openai";

/** Lazy singleton — only instantiated when a runner actually fires
 *  so importing this module never explodes if the key is unset. */
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY not set. Add it to .env.local and restart the dev server.",
    );
  }
  if (_client) return _client;
  _client = new OpenAI({ apiKey: key });
  return _client;
}

/** Replace {{name}} placeholders in `template` with values from
 *  `vars`. Unknown placeholders are left as-is so the admin can see
 *  what they forgot to fill in. Whitespace inside the braces is
 *  tolerated ({{ name }} == {{name}}). */
export function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, key) => {
    const val = vars[key];
    return val === undefined ? m : val;
  });
}

/** Extract the variable names referenced inside `template` (the
 *  things between {{ }}). Used by the UI to render a text input for
 *  each one before the admin hits Run. Returns each unique name in
 *  the order they first appear. */
export function extractVariables(template: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export interface RunChatPromptInput {
  body: string;
  systemPrompt?: string | null;
  model: string;
  vars: Record<string, string>;
  /** Optional cap on output tokens. Default 1500 (roughly 1100
   *  words). Higher = longer responses + higher cost. */
  maxTokens?: number;
}

export interface RunChatPromptResult {
  ok: true;
  text: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface RunChatPromptError {
  ok: false;
  error: string;
}

/** Fire the prompt at OpenAI and return the assistant text. Errors
 *  are caught + returned as { ok: false, error } so the server
 *  action can hand the string to the UI directly without a 500. */
export async function runChatPrompt(
  input: RunChatPromptInput,
): Promise<RunChatPromptResult | RunChatPromptError> {
  try {
    const client = getClient();
    const filled = fillTemplate(input.body, input.vars);
    const messages: { role: "system" | "user"; content: string }[] = [];
    if (input.systemPrompt && input.systemPrompt.trim().length > 0) {
      messages.push({
        role: "system",
        content: fillTemplate(input.systemPrompt, input.vars),
      });
    }
    messages.push({ role: "user", content: filled });

    const completion = await client.chat.completions.create({
      model: input.model,
      messages,
      max_completion_tokens: input.maxTokens ?? 1500,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return {
        ok: false,
        error: `Empty response from ${input.model}. Try a different model or check the prompt.`,
      };
    }
    return {
      ok: true,
      text,
      model: completion.model,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Surface OpenAI SDK errors as-is — they're already human-friendly
    // (e.g. "Incorrect API key provided", "Rate limit reached").
    return { ok: false, error: message };
  }
}

/** Convenience: ordered list of models offered in the runner UI.
 *  Adding a new model here makes it appear in the dropdown without
 *  touching the component. */
export const AVAILABLE_MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o mini · fast & cheap" },
  { id: "gpt-4o", label: "GPT-4o · smartest" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini · long-context" },
  { id: "gpt-4.1", label: "GPT-4.1 · long-context smart" },
] as const;
