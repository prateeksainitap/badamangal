/**
 * Read-only data for the v2 homepage's LIVE map (MapBoard).
 *
 * The homepage used to send every listing and every season spot inside
 * its initial RSC payload (about 440 KB decoded, more once escaped into
 * the HTML) although most visitors only ever see the painted map. The
 * live map now fetches this on demand, when the visitor reaches for it.
 *
 * GET only, no cookies, no params: the response is the same for every
 * visitor, so it is cached exactly like the homepage (ISR, revalidate
 * 60) and shared by the CDN. Nothing here writes to the database.
 */
import { NextResponse } from "next/server";
import { loadLiveMapData } from "@/lib/home-data";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  const data = await loadLiveMapData();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
