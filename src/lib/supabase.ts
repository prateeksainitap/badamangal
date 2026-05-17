import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client. Uses the service-role key, so it bypasses
 * Row-Level Security, keep it OUT of any client component.
 *
 * In dev (or any environment without the env vars set), this returns null
 * and the upload route falls back to writing into /public/uploads so local
 * development doesn't require a Supabase project.
 */
let cached: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Name of the Storage bucket that holds organizer pamphlets + spot photos.
 * Configurable via env so you can swap to a separate test bucket if needed.
 */
export const PHOTO_BUCKET =
  process.env.SUPABASE_PHOTO_BUCKET ?? "bhandara-photos";
