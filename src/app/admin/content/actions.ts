"use server";

/**
 * Server actions for /admin/content (the Content Hub).
 *
 * Co-located with the route rather than living in the global
 * `app/admin/actions.ts` because they touch tables (Content, Prompt,
 * GalleryPhoto.tags) that nothing else in the admin currently does.
 * Keeping them local makes them easy to delete if the hub ever
 * deprecates, and avoids bloating the already-large actions.ts.
 *
 * Every action is admin-gated via `requireAdmin()` so an
 * unauthenticated POST returns "Unauthorized" instead of mutating
 * the DB. Revalidation: each mutation `revalidatePath("/admin/content")`
 * so the next page load reflects the change without a hard refresh.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import {
  runChatPrompt,
  extractVariables,
  AVAILABLE_MODELS,
} from "@/lib/openai";

/* ────────────────────────── Content CRUD ────────────────────────── */

// Allowed enum values for Content metadata. Defined in ./types so
// they can be exported alongside the actions ("use server" files
// can only export async functions). Re-imported here to use in
// validation helpers below.
import {
  CONTENT_KINDS,
  CONTENT_AUDIENCES,
  CONTENT_CHANNELS,
  CONTENT_LANGUAGES,
  type ContentKind,
  type ContentAudience,
  type ContentChannel,
  type ContentLanguage,
} from "./types";

function readString(fd: FormData, key: string, max = 8000): string {
  const v = fd.get(key);
  if (typeof v !== "string") return "";
  return v.slice(0, max).trim();
}
function readEnum<T extends readonly string[]>(
  fd: FormData,
  key: string,
  set: T,
  fallback: T[number],
): T[number] {
  const v = readString(fd, key, 64);
  return (set as readonly string[]).includes(v) ? (v as T[number]) : fallback;
}
function readTags(fd: FormData, key: string): string[] {
  const raw = readString(fd, key, 500);
  if (!raw) return [];
  // Comma OR whitespace separated. Lower-cased, deduped, capped.
  const out = new Set<string>();
  for (const t of raw.split(/[,\s]+/)) {
    const norm = t.trim().toLowerCase();
    if (norm) out.add(norm);
    if (out.size >= 20) break;
  }
  return Array.from(out);
}

/** Create a new Content row. Used by the "+ New" buttons inside
 *  each tab. Returns void; the form redirects via revalidatePath. */
export async function createContentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const title = readString(formData, "title", 200);
  if (!title) return;
  await prisma.content.create({
    data: {
      title,
      body: readString(formData, "body", 50000),
      summary: readString(formData, "summary", 280) || null,
      kind: readEnum(formData, "kind", CONTENT_KINDS, "PITCH"),
      audience: readEnum(formData, "audience", CONTENT_AUDIENCES, "OTHER"),
      channel: readEnum(formData, "channel", CONTENT_CHANNELS, "OTHER"),
      language: readEnum(formData, "language", CONTENT_LANGUAGES, "en"),
      tags: readTags(formData, "tags"),
      lastEditor: readString(formData, "lastEditor", 80) || "Prateek",
    },
  });
  revalidatePath("/admin/content");
}

/** Update an existing Content row. */
export async function updateContentAction(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const title = readString(formData, "title", 200);
  if (!title) return;
  await prisma.content.update({
    where: { id },
    data: {
      title,
      body: readString(formData, "body", 50000),
      summary: readString(formData, "summary", 280) || null,
      kind: readEnum(formData, "kind", CONTENT_KINDS, "PITCH"),
      audience: readEnum(formData, "audience", CONTENT_AUDIENCES, "OTHER"),
      channel: readEnum(formData, "channel", CONTENT_CHANNELS, "OTHER"),
      language: readEnum(formData, "language", CONTENT_LANGUAGES, "en"),
      tags: readTags(formData, "tags"),
      lastEditor: readString(formData, "lastEditor", 80) || "Prateek",
    },
  });
  revalidatePath("/admin/content");
}

/** Archive (soft-delete) a Content row. */
export async function archiveContentAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.content.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
  revalidatePath("/admin/content");
}

/** Restore an archived row. */
export async function restoreContentAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.content.update({
    where: { id },
    data: { status: "ACTIVE" },
  });
  revalidatePath("/admin/content");
}

/** Hard delete, only for accidental rows. Archived → Delete is
 *  the two-step path the UI exposes. */
export async function deleteContentAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.content.delete({ where: { id } });
  revalidatePath("/admin/content");
}

/* ──────────────── Content send-tracking ────────────────────────────
 * Four actions powering the Mission Strip + per-card status pills.
 * All operator-driven (no auto-detection) because outbound happens
 * outside the platform: email, WhatsApp, Instagram DM, press email
 * chains. The operator owns the truth.
 * ─────────────────────────────────────────────────────────────────── */

/** Mark a Content row as sent — captures the timestamp, optional
 *  recipient note, and flips awaitingReply=true. If the row was a
 *  DRAFT it flips to ACTIVE so "sent" automatically promotes work
 *  out of the drafts pile. Surfaces in the row pill as
 *  "Sent N days ago to X". */
export async function markSentAction(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const lastSentTo = readString(formData, "lastSentTo", 200) || null;
  await prisma.content.update({
    where: { id },
    data: {
      lastSentAt: new Date(),
      lastSentTo,
      awaitingReply: true,
      // If the row was DRAFT, promote it to ACTIVE — the act of
      // sending is the strongest possible signal that it's
      // production-ready. ARCHIVED rows are left as-is so an
      // operator who clicks "Mark sent" on an archived row by
      // accident doesn't accidentally un-archive it.
      ...(await isContentDraft(id) ? { status: "ACTIVE" } : {}),
    },
  });
  revalidatePath("/admin/content");
}

/** Mark the awaited reply as received (or closed). Doesn't touch
 *  lastSentAt — the row still shows "Sent 5 days ago" until it gets
 *  re-sent. Just clears the awaitingReply flag so the Mission
 *  Strip's count goes down. */
export async function markRepliedAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.content.update({
    where: { id },
    data: { awaitingReply: false },
  });
  revalidatePath("/admin/content");
}

/** Undo a "Mark sent" — clears every send-tracking field. Use case:
 *  operator clicked Sent on the wrong row, or wants to reset a row
 *  back to "never sent" before a new season. */
export async function unmarkSentAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.content.update({
    where: { id },
    data: {
      lastSentAt: null,
      lastSentTo: null,
      awaitingReply: false,
    },
  });
  revalidatePath("/admin/content");
}

/** Toggle between DRAFT and ACTIVE status. The Mission Strip's
 *  Drafts tile counts DRAFT rows; the Ready tile counts ACTIVE rows
 *  with no recent send. Operator flips a row to DRAFT when it's
 *  still being written, back to ACTIVE when ready to send. */
export async function toggleDraftAction(id: string): Promise<void> {
  await requireAdmin();
  const row = await prisma.content.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!row) return;
  const next = row.status === "DRAFT" ? "ACTIVE" : "DRAFT";
  await prisma.content.update({
    where: { id },
    data: { status: next },
  });
  revalidatePath("/admin/content");
}

/** Internal helper for markSentAction — checks if the row is
 *  currently a DRAFT so we can auto-promote on send. Extracted to
 *  keep the action body readable. */
async function isContentDraft(id: string): Promise<boolean> {
  const row = await prisma.content.findUnique({
    where: { id },
    select: { status: true },
  });
  return row?.status === "DRAFT";
}

/* ────────────────────────── Prompt CRUD ─────────────────────────── */

export async function createPromptAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const title = readString(formData, "title", 200);
  const body = readString(formData, "body", 12000);
  if (!title || !body) return;
  const model = readString(formData, "defaultModel", 64);
  const validModel = AVAILABLE_MODELS.find((m) => m.id === model)?.id;
  await prisma.prompt.create({
    data: {
      title,
      body,
      systemPrompt: readString(formData, "systemPrompt", 4000) || null,
      defaultModel: validModel ?? "gpt-4o-mini",
      tags: readTags(formData, "tags"),
    },
  });
  revalidatePath("/admin/content");
}

export async function updatePromptAction(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const title = readString(formData, "title", 200);
  const body = readString(formData, "body", 12000);
  if (!title || !body) return;
  const model = readString(formData, "defaultModel", 64);
  const validModel = AVAILABLE_MODELS.find((m) => m.id === model)?.id;
  await prisma.prompt.update({
    where: { id },
    data: {
      title,
      body,
      systemPrompt: readString(formData, "systemPrompt", 4000) || null,
      defaultModel: validModel ?? "gpt-4o-mini",
      tags: readTags(formData, "tags"),
    },
  });
  revalidatePath("/admin/content");
}

export async function archivePromptAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.prompt.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
  revalidatePath("/admin/content");
}

export async function restorePromptAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.prompt.update({
    where: { id },
    data: { status: "ACTIVE" },
  });
  revalidatePath("/admin/content");
}

export async function deletePromptAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.prompt.delete({ where: { id } });
  revalidatePath("/admin/content");
}

/** Run a prompt against OpenAI. Reads {{var}} values from the
 *  submitted FormData (one input per variable extracted from the
 *  prompt body) + optional model override. Writes the result back
 *  into the Prompt row so it's persisted across reloads. */
export async function runPromptAction(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const prompt = await prisma.prompt.findUnique({ where: { id } });
  if (!prompt) return;

  // Per-run model override (defaults to row's defaultModel).
  const modelOverride = readString(formData, "model", 64);
  const validModel = AVAILABLE_MODELS.find((m) => m.id === modelOverride)?.id;
  const model = validModel ?? prompt.defaultModel;

  // Pull each {{var}} input out of the form. Keys are prefixed with
  // `var:` to avoid colliding with `id` / `model` / etc.
  const vars: Record<string, string> = {};
  const names = extractVariables(
    `${prompt.body}\n${prompt.systemPrompt ?? ""}`,
  );
  for (const name of names) {
    const v = formData.get(`var:${name}`);
    vars[name] = typeof v === "string" ? v.slice(0, 2000) : "";
  }

  const result = await runChatPrompt({
    body: prompt.body,
    systemPrompt: prompt.systemPrompt,
    model,
    vars,
  });

  // Persist outcome, including errors, so the UI can re-show the
  // last attempt on next render without re-firing the API call.
  const output = result.ok
    ? result.text
    : `Error: ${result.error}`;
  await prisma.prompt.update({
    where: { id },
    data: {
      lastRunAt: new Date(),
      lastRunModel: model,
      lastRunOutput: output.slice(0, 8000),
      lastRunVars: JSON.stringify(vars),
    },
  });
  revalidatePath("/admin/content");
}

/* ─────────────────────── GalleryPhoto tagging ───────────────────── */

/** Set the channel-tags on a GalleryPhoto so it surfaces in the
 *  Content Hub Images tab with the matching filter chip. The same
 *  row stays usable by the public homepage gallery. */
export async function setGalleryTagsAction(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const tags = readTags(formData, "tags");
  await prisma.galleryPhoto.update({
    where: { id },
    data: { tags },
  });
  revalidatePath("/admin/content");
  revalidatePath("/admin/gallery");
  revalidatePath("/");
}

/* ─────────────────────── Import from /notes/ ────────────────────── */

/** Read /notes/*.md from the repo and seed Content rows. Idempotent:
 *  skips inserts where a row with the same `source` already exists.
 *
 *  The /notes/ folder is gitignored but exists on the operator's
 *  machine. Filename → kind/audience/channel mapping is encoded
 *  below, add a new entry when you drop a new .md in there. */
type NoteSeed = {
  file: string;
  title: string;
  kind: ContentKind;
  audience: ContentAudience;
  channel: ContentChannel;
  language: ContentLanguage;
  summary: string;
  tags: string[];
};

const NOTE_SEEDS: NoteSeed[] = [
  {
    file: "00-OVERNIGHT-REVIEW.md",
    title: "Overnight review, shipped features summary",
    kind: "STRATEGY",
    audience: "INTERNAL",
    channel: "INTERNAL",
    language: "en",
    summary:
      "Shipping summary: Sponsor/Donate flow, Pamphlet builder, keyboard accessibility, dashboard redesign.",
    tags: ["overnight", "shipping", "internal"],
  },
  {
    file: "01-off-season-strategy.md",
    title: "Off-season 11-month strategy",
    kind: "STRATEGY",
    audience: "INTERNAL",
    channel: "INTERNAL",
    language: "en",
    summary:
      "Year-round Hindu liturgical calendar strategy: Jyeshtha, Sawan, Navratri, Diwali, Makar Sankranti, Holi.",
    tags: ["off-season", "calendar", "strategy"],
  },
  {
    file: "02-visitor-personas.md",
    title: "Visitor personas: organiser, walker, spotter, volunteer",
    kind: "STRATEGY",
    audience: "INTERNAL",
    channel: "INTERNAL",
    language: "en",
    summary:
      "Four primary personas with pain points + jobs-to-be-done. Used to frame outreach + product copy.",
    tags: ["personas", "research", "strategy"],
  },
  {
    file: "03-pitch-sponsors.md",
    title: "Sponsor pitch, Lucknow bhandara network",
    kind: "PITCH",
    audience: "SPONSOR",
    channel: "EMAIL",
    language: "en",
    summary:
      "One-pager for local/pan-India brands. S1 metrics: 139 bhandaras, 9.6k WhatsApp, 3.7k web visitors.",
    tags: ["sponsor", "pitch", "outreach"],
  },
  {
    file: "04-pitch-influencers.md",
    title: "Influencer pitch, Lucknow food/lifestyle creators",
    kind: "PITCH",
    audience: "INFLUENCER",
    channel: "INSTAGRAM",
    language: "en",
    summary:
      "Trade = early access + co-creation + seva association. Tier-1 targets: @lucknow.foodie, @gomti.diaries, @lkonews.",
    tags: ["influencer", "instagram", "outreach"],
  },
  {
    file: "05-pitch-newspapers.md",
    title: "Press pitch: TOI, HT, Indian Express, Jagran, Amar Ujala",
    kind: "PITCH",
    audience: "PRESS",
    channel: "EMAIL",
    language: "bilingual",
    summary:
      "Email-ready angle: 'AI + WhatsApp mapping centuries-old tradition'. Subject lines in EN + HI.",
    tags: ["press", "newspaper", "outreach"],
  },
  {
    file: "06-marketing-strategy.md",
    title: "Marketing strategy + content calendar",
    kind: "STRATEGY",
    audience: "INTERNAL",
    channel: "INTERNAL",
    language: "en",
    summary:
      "3-channel strategy (Instagram primary, WhatsApp community, press). 60% reels / 30% carousels / 10% stories.",
    tags: ["marketing", "strategy", "calendar"],
  },
];

/** Form-compatible wrapper: matches `(formData: FormData) => void` so
 *  it can be passed directly to a Next.js `<form action>`. The return
 *  shape from the underlying importer is discarded, the admin sees
 *  the imported rows after the page revalidates. */
export async function importNotesAction(
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  const notesDir = path.join(process.cwd(), "notes");
  let imported = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const seed of NOTE_SEEDS) {
    const existing = await prisma.content.findFirst({
      where: { source: seed.file },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    let body: string;
    try {
      body = await fs.readFile(path.join(notesDir, seed.file), "utf8");
    } catch {
      missing.push(seed.file);
      continue;
    }
    await prisma.content.create({
      data: {
        title: seed.title,
        body,
        summary: seed.summary,
        kind: seed.kind,
        audience: seed.audience,
        channel: seed.channel,
        language: seed.language,
        tags: seed.tags,
        source: seed.file,
        lastEditor: "import",
      },
    });
    imported++;
  }
  revalidatePath("/admin/content");
  // Result counters intentionally discarded so this matches the
  // void-returning shape Next.js form actions require. If a
  // programmatic caller ever needs the counts back, factor the
  // body out into a separate helper that returns them.
  void imported;
  void skipped;
  void missing;
}
