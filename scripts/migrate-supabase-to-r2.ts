/**
 * One-off: move every Bhandara.photoUrl and Spot.photoUrl pointing
 * at the legacy Supabase storage bucket onto Cloudflare R2 / the
 * cdn.badamangal.com CDN. Every new upload already goes R2-first
 * (see /api/uploads, /api/bot/ingest, /api/admin/upload-image,
 * /api/admin/scan, /api/public/scan-bhandara, /api/volunteer/upload-
 * media) - this script reconciles the historical rows so the public
 * surfaces never serve a Supabase URL.
 *
 * For each row:
 *   1. Fetch the image bytes from the existing public Supabase URL.
 *   2. Re-upload to R2 with the SAME filename so any [bot:…] hash
 *      tags / cross-reference paths still resolve.
 *   3. Update the row's photoUrl in the DB.
 * The Supabase object is NOT deleted - operators may want to roll
 * back. Schedule a separate sweep when confidence is high.
 *
 * Idempotent: rows already on cdn.badamangal.com (or any non-
 * supabase host) are skipped.
 *
 * Usage:
 *   npx tsx scripts/migrate-supabase-to-r2.ts            (dry-run)
 *   npx tsx scripts/migrate-supabase-to-r2.ts --execute  (apply)
 */
import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnv(filename: string) {
  try {
    const raw = readFileSync(path.resolve(process.cwd(), filename), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, k, v] = m;
      if (process.env[k]) continue;
      process.env[k] = v.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* missing file → fall through to existing env */
  }
}
loadEnv(".env.local");
loadEnv(".env");

import { prisma } from "../src/lib/db";
import { uploadToR2 } from "../src/lib/r2";

const SUPABASE_HOST_FRAGMENT = "supabase.co";

type RowKind = "bhandara" | "spot";
type Row = { kind: RowKind; id: string; photoUrl: string };

function isSupabaseUrl(u: string | null | undefined): u is string {
  return typeof u === "string" && u.includes(SUPABASE_HOST_FRAGMENT);
}

function extractFilename(url: string): string | null {
  // Supabase public URLs look like
  // https://<id>.supabase.co/storage/v1/object/public/<bucket>/<filename>
  const tail = url.split("/").pop();
  if (!tail) return null;
  return decodeURIComponent(tail.split("?")[0]);
}

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "webp") return "image/webp";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "image/webp";
}

async function migrateOne(
  row: Row,
  execute: boolean,
): Promise<{ ok: boolean; from: string; to?: string; reason?: string }> {
  const filename = extractFilename(row.photoUrl);
  if (!filename) {
    return { ok: false, from: row.photoUrl, reason: "no-filename" };
  }

  // Fetch the original
  let bytes: Buffer;
  try {
    const res = await fetch(row.photoUrl);
    if (!res.ok) {
      return {
        ok: false,
        from: row.photoUrl,
        reason: `supabase-fetch-${res.status}`,
      };
    }
    const ab = await res.arrayBuffer();
    bytes = Buffer.from(ab);
  } catch (err) {
    return {
      ok: false,
      from: row.photoUrl,
      reason: `fetch-error:${(err as Error).message}`,
    };
  }

  if (!execute) {
    return {
      ok: true,
      from: row.photoUrl,
      to: `(dry-run) cdn → ${filename} (${bytes.length} B)`,
    };
  }

  // Re-upload to R2 with the same filename
  let r2Url: string | null;
  try {
    r2Url = await uploadToR2({
      filename,
      buffer: bytes,
      contentType: guessContentType(filename),
    });
  } catch (err) {
    return {
      ok: false,
      from: row.photoUrl,
      reason: `r2-error:${(err as Error).message}`,
    };
  }
  if (!r2Url) {
    return {
      ok: false,
      from: row.photoUrl,
      reason: "r2-misconfigured-or-null",
    };
  }

  // Update the DB
  if (row.kind === "bhandara") {
    await prisma.bhandara.update({
      where: { id: row.id },
      data: { photoUrl: r2Url },
    });
  } else {
    await prisma.spot.update({
      where: { id: row.id },
      data: { photoUrl: r2Url },
    });
  }
  return { ok: true, from: row.photoUrl, to: r2Url };
}

async function main() {
  const execute = process.argv.includes("--execute");
  const targets: Row[] = [];

  const bhandaras = await prisma.bhandara.findMany({
    where: { photoUrl: { contains: SUPABASE_HOST_FRAGMENT } },
    select: { id: true, photoUrl: true },
  });
  for (const b of bhandaras) {
    if (isSupabaseUrl(b.photoUrl)) {
      targets.push({ kind: "bhandara", id: b.id, photoUrl: b.photoUrl });
    }
  }

  const spots = await prisma.spot.findMany({
    where: { photoUrl: { contains: SUPABASE_HOST_FRAGMENT } },
    select: { id: true, photoUrl: true },
  });
  for (const s of spots) {
    if (isSupabaseUrl(s.photoUrl)) {
      targets.push({ kind: "spot", id: s.id, photoUrl: s.photoUrl });
    }
  }

  console.log(
    `\nfound ${targets.length} row(s) with Supabase photo URLs (${bhandaras.length} bhandara + ${spots.length} spot).`,
  );
  if (targets.length === 0) {
    console.log("nothing to migrate. R2-first uploads are already in place for new rows.");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const row of targets) {
    const res = await migrateOne(row, execute);
    if (res.ok) {
      ok += 1;
      console.log(`  ✓ ${row.kind} ${row.id}`);
      console.log(`    from: ${res.from}`);
      console.log(`    to:   ${res.to}`);
    } else {
      fail += 1;
      console.log(`  ✗ ${row.kind} ${row.id}  reason=${res.reason}`);
      console.log(`    from: ${res.from}`);
    }
  }
  console.log(
    `\n${execute ? "[execute]" : "[dry-run]"} ok=${ok} fail=${fail} of ${targets.length}.`,
  );
  if (!execute) {
    console.log("\nRe-run with --execute to actually re-upload + update the DB.");
  }
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
