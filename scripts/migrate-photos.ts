/**
 * Phase 2b — One-shot Supabase Storage → Cloudflare R2 photo migration.
 *
 * What it does:
 *   1. Walks every row in the 5 models that hold photo/file URLs.
 *   2. For each URL that points at supabase.co/storage/... :
 *        a. Downloads the file from Supabase Storage.
 *        b. Uploads it to R2 with the same filename.
 *        c. Updates the DB row to point at the new
 *           cdn.badamangal.com URL.
 *   3. Writes a JSON migration log (migration-log-<timestamp>.json
 *      at repo root) capturing every old URL -> new URL mapping
 *      so a rollback is straightforward.
 *   4. Does NOT delete the original file from Supabase. The user
 *      explicitly asked to keep Supabase as a permanent backup.
 *
 * Idempotency:
 *   Safe to re-run. Skips URLs that aren't on supabase.co (already
 *   migrated, external URLs, or local /uploads/ paths). Re-uploading
 *   the same file to R2 is also idempotent — same key, same body.
 *
 * NewsItem.imageUrl is intentionally NOT touched. Those URLs are
 * scraped from publisher CDNs (Hindustan Times, Amar Ujala, etc),
 * not from our Supabase bucket; migrating them would just leave us
 * re-hosting press images we have no rights to and breaking the
 * Source-pointed credit.
 *
 * Required env vars (loaded from .env.local via @next/env):
 *   DATABASE_URL                — Postgres URL (Supabase or wherever)
 *   SUPABASE_URL                — https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   — service-role key for Storage read
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME              — defaults to badamangal-photos
 *   R2_PUBLIC_URL               — defaults to https://cdn.badamangal.com
 *
 * Run:
 *   npm run migrate:photos
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { PrismaClient } from "@prisma/client";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

// ── env wiring ──────────────────────────────────────────────────
const R2_ACCOUNT_ID = required("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID = required("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = required("R2_SECRET_ACCESS_KEY");
const R2_BUCKET = process.env.R2_BUCKET_NAME ?? "badamangal-photos";
const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL ?? "https://cdn.badamangal.com";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required env var: ${key}`);
    console.error(
      "Add it to .env.local and re-run. See script header for the full list.",
    );
    process.exit(1);
  }
  return value;
}

// ── migration log ──────────────────────────────────────────────
type LogEntry = {
  table: string;
  rowId: string;
  field: string;
  oldUrl: string;
  newUrl: string;
  ts: string;
};
type ErrorEntry = {
  table: string;
  rowId: string;
  field: string;
  url: string;
  error: string;
};

const log: LogEntry[] = [];
const errors: ErrorEntry[] = [];
let skipped = 0; // counts URLs that were already on R2 / external / local

// ── helpers ────────────────────────────────────────────────────
function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https:\/\/[^/]+\.supabase\.co\/storage\//.test(url);
}

function extractFilename(url: string): string {
  // e.g. https://abc.supabase.co/storage/v1/object/public/bhandara-photos/uuid.webp
  // → uuid.webp
  const parts = url.split("/");
  return parts[parts.length - 1] ?? "";
}

function inferContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "webp":
      return "image/webp";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "pdf":
      return "application/pdf";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

/**
 * Download from Supabase, upload to R2, return new public URL.
 * Returns null on any failure (caller can leave the DB row unchanged
 * and the original Supabase URL keeps working as fallback).
 */
async function copyToR2(
  supabaseUrl: string,
  ctx: { table: string; rowId: string; field: string },
): Promise<string | null> {
  const filename = extractFilename(supabaseUrl);
  if (!filename) return null;

  try {
    // Skip if already present on R2 (idempotent re-run safety net).
    try {
      await r2.send(
        new HeadObjectCommand({ Bucket: R2_BUCKET, Key: filename }),
      );
      // Object exists, skip the download/upload and just return the URL.
      // We still want to update the DB row to point at R2.
      return `${R2_PUBLIC_URL}/${filename}`;
    } catch {
      // HeadObject 404 → object isn't there, proceed with upload.
    }

    const res = await fetch(supabaseUrl);
    if (!res.ok) {
      throw new Error(`download ${res.status} ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType =
      res.headers.get("content-type") ?? inferContentType(filename);

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    const newUrl = `${R2_PUBLIC_URL}/${filename}`;
    log.push({ ...ctx, oldUrl: supabaseUrl, newUrl, ts: new Date().toISOString() });
    return newUrl;
  } catch (err) {
    errors.push({
      ...ctx,
      url: supabaseUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Migrate a JSON-encoded array-of-URLs field. Returns the new JSON
 *  string when any URL was rewritten, or null if nothing changed
 *  (caller skips the DB write in that case). */
async function migrateJsonArrayField(
  raw: string,
  ctx: { table: string; rowId: string; field: string },
): Promise<string | null> {
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return null; // malformed JSON, leave it alone
  }
  if (!Array.isArray(arr)) return null;

  const next: string[] = [];
  let changed = false;
  for (const url of arr) {
    if (typeof url !== "string") continue;
    if (!isSupabaseStorageUrl(url)) {
      next.push(url);
      skipped++;
      continue;
    }
    const newUrl = await copyToR2(url, ctx);
    if (newUrl) {
      next.push(newUrl);
      changed = true;
    } else {
      next.push(url); // keep original on failure, fallback still works
    }
  }
  return changed ? JSON.stringify(next) : null;
}

// ── per-model migrators ────────────────────────────────────────

async function migrateBhandaras() {
  console.log("\n[Bhandara]");
  const rows = await prisma.bhandara.findMany({
    where: { photoUrl: { not: null } },
    select: { id: true, photoUrl: true },
  });
  console.log(`  ${rows.length} rows with photoUrl`);
  for (const row of rows) {
    if (!row.photoUrl) continue;
    if (!isSupabaseStorageUrl(row.photoUrl)) {
      skipped++;
      continue;
    }
    const newUrl = await copyToR2(row.photoUrl, {
      table: "Bhandara",
      rowId: row.id,
      field: "photoUrl",
    });
    if (newUrl) {
      await prisma.bhandara.update({
        where: { id: row.id },
        data: { photoUrl: newUrl },
      });
      console.log(`  ✓ ${row.id}`);
    }
  }
}

async function migrateSpots() {
  console.log("\n[Spot]");
  const rows = await prisma.spot.findMany({
    select: { id: true, photoUrl: true, extraPhotoUrls: true },
  });
  console.log(`  ${rows.length} total rows`);
  for (const row of rows) {
    const updates: { photoUrl?: string; extraPhotoUrls?: string } = {};
    if (row.photoUrl && isSupabaseStorageUrl(row.photoUrl)) {
      const newUrl = await copyToR2(row.photoUrl, {
        table: "Spot",
        rowId: row.id,
        field: "photoUrl",
      });
      if (newUrl) updates.photoUrl = newUrl;
    }
    if (row.extraPhotoUrls && row.extraPhotoUrls !== "[]") {
      const newJson = await migrateJsonArrayField(row.extraPhotoUrls, {
        table: "Spot",
        rowId: row.id,
        field: "extraPhotoUrls",
      });
      if (newJson) updates.extraPhotoUrls = newJson;
    }
    if (Object.keys(updates).length) {
      await prisma.spot.update({ where: { id: row.id }, data: updates });
      console.log(`  ✓ ${row.id}: ${Object.keys(updates).join(", ")}`);
    }
  }
}

async function migrateContactMessages() {
  console.log("\n[ContactMessage]");
  const rows = await prisma.contactMessage.findMany({
    where: { attachmentUrl: { not: null } },
    select: { id: true, attachmentUrl: true },
  });
  console.log(`  ${rows.length} rows with attachmentUrl`);
  for (const row of rows) {
    if (!row.attachmentUrl) continue;
    if (!isSupabaseStorageUrl(row.attachmentUrl)) {
      skipped++;
      continue;
    }
    const newUrl = await copyToR2(row.attachmentUrl, {
      table: "ContactMessage",
      rowId: row.id,
      field: "attachmentUrl",
    });
    if (newUrl) {
      await prisma.contactMessage.update({
        where: { id: row.id },
        data: { attachmentUrl: newUrl },
      });
      console.log(`  ✓ ${row.id}`);
    }
  }
}

async function migrateVolunteerSubmissions() {
  console.log("\n[VolunteerSubmission]");
  const rows = await prisma.volunteerSubmission.findMany({
    select: {
      id: true,
      photoUrls: true,
      videoUrls: true,
      spotPhotoUrl: true,
    },
  });
  console.log(`  ${rows.length} total rows`);
  for (const row of rows) {
    const updates: {
      photoUrls?: string;
      videoUrls?: string;
      spotPhotoUrl?: string;
    } = {};

    if (row.photoUrls && row.photoUrls !== "[]") {
      const next = await migrateJsonArrayField(row.photoUrls, {
        table: "VolunteerSubmission",
        rowId: row.id,
        field: "photoUrls",
      });
      if (next) updates.photoUrls = next;
    }
    if (row.videoUrls && row.videoUrls !== "[]") {
      const next = await migrateJsonArrayField(row.videoUrls, {
        table: "VolunteerSubmission",
        rowId: row.id,
        field: "videoUrls",
      });
      if (next) updates.videoUrls = next;
    }
    if (row.spotPhotoUrl && isSupabaseStorageUrl(row.spotPhotoUrl)) {
      const newUrl = await copyToR2(row.spotPhotoUrl, {
        table: "VolunteerSubmission",
        rowId: row.id,
        field: "spotPhotoUrl",
      });
      if (newUrl) updates.spotPhotoUrl = newUrl;
    }

    if (Object.keys(updates).length) {
      await prisma.volunteerSubmission.update({
        where: { id: row.id },
        data: updates,
      });
      console.log(`  ✓ ${row.id}: ${Object.keys(updates).join(", ")}`);
    }
  }
}

async function migrateGalleryPhotos() {
  console.log("\n[GalleryPhoto]");
  const rows = await prisma.galleryPhoto.findMany({
    select: { id: true, imageUrl: true },
  });
  console.log(`  ${rows.length} rows`);
  for (const row of rows) {
    if (!isSupabaseStorageUrl(row.imageUrl)) {
      skipped++;
      continue;
    }
    const newUrl = await copyToR2(row.imageUrl, {
      table: "GalleryPhoto",
      rowId: row.id,
      field: "imageUrl",
    });
    if (newUrl) {
      await prisma.galleryPhoto.update({
        where: { id: row.id },
        data: { imageUrl: newUrl },
      });
      console.log(`  ✓ ${row.id}`);
    }
  }
}

// ── main ───────────────────────────────────────────────────────

async function main() {
  console.log("══════════════════════════════════════════════════════");
  console.log("Phase 2b: Supabase Storage → Cloudflare R2 migration");
  console.log("══════════════════════════════════════════════════════");
  console.log(`Source:      Supabase Storage`);
  console.log(`Destination: ${R2_PUBLIC_URL} (bucket: ${R2_BUCKET})`);
  console.log(`Mode:        COPY (Supabase originals untouched)`);
  console.log("");

  const t0 = Date.now();

  await migrateBhandaras();
  await migrateSpots();
  await migrateContactMessages();
  await migrateVolunteerSubmissions();
  await migrateGalleryPhotos();

  const seconds = ((Date.now() - t0) / 1000).toFixed(1);

  // Persist the log so a rollback can be scripted from it.
  const logFile = join(
    process.cwd(),
    `migration-log-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(
    logFile,
    JSON.stringify(
      { migratedAt: new Date().toISOString(), log, errors },
      null,
      2,
    ),
  );

  console.log("\n══════════════════════════════════════════════════════");
  console.log(`Migrated:  ${log.length} files`);
  console.log(`Skipped:   ${skipped} URLs (already R2, external, or local)`);
  console.log(`Errors:    ${errors.length}`);
  console.log(`Duration:  ${seconds}s`);
  console.log(`Log:       ${logFile}`);

  if (errors.length) {
    console.log("\nErrors:");
    for (const e of errors) {
      console.log(`  ${e.table}/${e.rowId}/${e.field}`);
      console.log(`    url:   ${e.url}`);
      console.log(`    err:   ${e.error}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("\nFATAL:", err);
  await prisma.$disconnect();
  process.exit(1);
});
