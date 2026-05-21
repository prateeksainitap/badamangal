/**
 * Cloudflare R2 (S3-compatible) object-storage client.
 *
 * Why R2:
 *   Migration target for photo storage (Phase 2 of the great
 *   $0/month migration off Netlify + Supabase Storage). Free tier:
 *     - 10 GB storage (BadaMangal sits at ~300 MB)
 *     - 1M Class A operations / month (writes; we use ~500)
 *     - 10M Class B operations / month (reads; we use ~150K)
 *     - ZERO egress fees — R2's killer feature
 *
 * Public URL scheme:
 *   Photos served from cdn.badamangal.com (a CNAME on Cloudflare
 *   DNS pointed at the R2 bucket, with Cloudflare-issued SSL + CDN
 *   in front). The hostname is wildcard-allowed in next.config.js's
 *   `remotePatterns`, so next/image works without additional setup.
 *
 * Backward-compat contract:
 *   The legacy Supabase Storage upload paths in /api/uploads,
 *   /api/admin/upload-image, /api/volunteer/upload-media remain in
 *   place as a FALLBACK. If R2 env vars are missing (e.g. dev box
 *   without R2 creds, or a Vercel preview where the secret didn't
 *   carry through), uploads still succeed against Supabase Storage.
 *   New uploads land in R2 only when ALL four R2 env vars are set.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID          Your Cloudflare account ID (top-right
 *                          of the R2 dashboard)
 *   R2_ACCESS_KEY_ID       Issued via R2 → Manage API Tokens
 *   R2_SECRET_ACCESS_KEY   Same token's secret
 *   R2_BUCKET_NAME         Defaults to 'badamangal-photos' if unset
 *   R2_PUBLIC_URL          Defaults to https://cdn.badamangal.com
 *                          if unset
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "badamangal-photos";
const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL ?? "https://cdn.badamangal.com";

/** Memoised S3 client; null when env vars are missing. */
let cachedClient: S3Client | null | undefined;

export function getR2Client(): S3Client | null {
  if (cachedClient !== undefined) return cachedClient;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    cachedClient = null;
    return null;
  }
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return cachedClient;
}

/** True if R2 is configured and ready to receive uploads. Cheap; the
 *  upload routes use this to decide whether to write to R2 or fall
 *  back to Supabase Storage. */
export function isR2Configured(): boolean {
  return getR2Client() !== null;
}

/**
 * Upload a buffer to R2. Returns the public URL on success (e.g.
 * https://cdn.badamangal.com/9f3a1c2e.webp). Returns null if R2 is
 * not configured, so the caller can fall back to Supabase. Throws
 * if R2 is configured but the upload itself fails (caller decides
 * whether to surface that as a 500 or fall back).
 *
 * Cache-Control defaults to 1 year + immutable since every uploaded
 * file has a UUID filename, the content for a given URL never
 * changes. Matches the Supabase upload settings we're replacing.
 */
export async function uploadToR2(opts: {
  filename: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<string | null> {
  const client = getR2Client();
  if (!client) return null;

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: opts.filename,
      Body: opts.buffer,
      ContentType: opts.contentType,
      CacheControl:
        opts.cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );

  return `${R2_PUBLIC_URL}/${opts.filename}`;
}

/**
 * Delete an object from R2 by its public URL. No-op (returns false)
 * if the URL doesn't belong to our R2 bucket prefix, so admin code
 * that calls delete on a Supabase-era URL won't accidentally hit
 * R2 with the wrong key.
 */
export async function deleteFromR2(publicUrl: string): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;
  if (!publicUrl.startsWith(R2_PUBLIC_URL + "/")) return false;

  const key = publicUrl.slice(R2_PUBLIC_URL.length + 1);
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      }),
    );
    return true;
  } catch (err) {
    console.error("R2 delete failed", err);
    return false;
  }
}
