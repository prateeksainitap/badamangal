import { PrismaClient, type Bhandara as DbBhandara } from "@prisma/client";
import type { Area } from "@/lib/lucknow";
import type { Bhandara } from "@/types/bhandara";
import { stripBotProvenance } from "@/lib/sanitize";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/* ────────────────────────────────────────────────────────────────────
   Transient-connection retry middleware.

   Why this exists:
     The Supabase pooler at aws-1-ap-southeast-1.pooler.supabase.com
     occasionally drops a single connection during recycle / failover /
     pool-saturation. When that happens a perfectly-formed Prisma query
     comes back as `PrismaClientKnownRequestError: Can't reach database
     server`, the route 500s, and the admin sees the DATABASE HICCUP
     error boundary card. The pooler is back up by the time the card
     renders — clicking Retry succeeds — but it's a constant friction
     under any reasonable load.

   What this does:
     Wraps every Prisma read operation (findUnique / findFirst /
     findMany / count / aggregate / groupBy) with a one-shot retry on
     known transient errors. The delay (250ms) is long enough for the
     pool to free / failover to complete in the vast majority of cases.

   What this does NOT do:
     Skip mutations. Retrying a `create` / `update` / `delete` on a
     transient error risks double-writes (the original may have
     succeeded server-side but the client dropped the response). Those
     surface to the user as before — which is correct: a write failure
     during moderation is a real signal, not noise.

   Why $use (deprecated in v6) and not $extends:
     $extends returns a different runtime client type that breaks the
     `export const prisma: PrismaClient` contract every call site
     depends on. $use stays type-stable. When we eventually migrate to
     Prisma 6, the equivalent is `$extends({ query: { $allModels: {
     $allOperations } } })` with the same predicate inside.

   Read-vs-write classifier:
     We treat anything matching the `safeReadOps` set as retryable.
     `findRaw` / `aggregateRaw` are intentionally NOT included (they're
     usually used for migrations, and the retry semantics differ).
   ──────────────────────────────────────────────────────────────── */

const SAFE_READ_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

function isTransientConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg =
    "message" in err && typeof err.message === "string" ? err.message : "";
  const code =
    "code" in err && typeof (err as { code?: unknown }).code === "string"
      ? (err as { code: string }).code
      : "";
  // Prisma surfaces transient pool / pgbouncer failures with a few
  // distinct shapes:
  //   • PrismaClientInitializationError — "Can't reach database server"
  //   • P1001 / P1002 / P1008 / P1017 codes — connection-layer issues
  //   • "Server has closed the connection" — pgbouncer recycling
  return (
    /Can't reach database server/i.test(msg) ||
    /Server has closed the connection/i.test(msg) ||
    /Timed out fetching a new connection/i.test(msg) ||
    /Connection terminated unexpectedly/i.test(msg) ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1008" ||
    code === "P1017"
  );
}

function createPrismaWithRetry(): PrismaClient {
  const client = new PrismaClient();
  client.$use(async (params, next) => {
    if (!SAFE_READ_OPS.has(params.action)) {
      return next(params);
    }
    try {
      return await next(params);
    } catch (err) {
      if (isTransientConnectionError(err)) {
        // Brief backoff — long enough for the pool to recycle, short
        // enough that the user doesn't notice. One retry only;
        // hammering past that just delays surfacing a real outage.
        await new Promise((resolve) => setTimeout(resolve, 250));
        try {
          return await next(params);
        } catch (retryErr) {
          // Annotate the retry-failure for the admin error boundary
          // so a persistent outage is distinguishable from a single
          // blip in the logs.
          if (retryErr instanceof Error) {
            retryErr.message = `${retryErr.message} (after 1 retry)`;
          }
          throw retryErr;
        }
      }
      throw err;
    }
  });
  return client;
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaWithRetry();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function safeJsonArray(input: string): string[] {
  try {
    const parsed: unknown = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/* ────────────────────────────────────────────────────────────────────
   Module-level "all approved bhandaras" cache.

   Why this exists:
     Netlify's production deploy of Wave 5 failed during static page
     generation with:
       Error [PrismaClientKnownRequestError]:
         Invalid `prisma.bhandara.findMany()` invocation:
         Timed out fetching a new connection from the connection pool.
         (Current connection pool timeout: 10, connection limit: 1)
       Export encountered an error on /area/[slug]/page: /area/gomti-nagar
     Next.js generates 36 area pages in parallel during build, and each
     page made 2 separate Prisma calls (generateMetadata count +
     page-body findMany), 72 concurrent queries against a Supabase
     pooler configured with connection_limit=1. The queue overflowed
     and the build crashed at page 56/112.

   The fix:
     Cache the "all approved bhandaras" query at the MODULE level so
     every page generation during a single build process shares ONE
     query result. 72 parallel queries → 1.

     React's `cache()` only dedupes per request; what we need is
     dedup ACROSS pages in the same Node process. A plain module
     scoped Promise is the simplest primitive that works: import is
     evaluated once per process; the Promise resolves once; every
     caller awaits the same handle.

   Runtime behaviour:
     - During `next build`: 1 query for all 36 area pages.
     - In production ISR (revalidate=300): the cache survives across
       page regenerations inside a WARM Netlify Function (the
       previous comment claimed otherwise, that was the bug). The
       Promise lives at module scope, the module is evaluated once
       per JS realm, and warm Functions reuse the realm. So a
       revalidatePath() that re-renders /bhandara/[slug] will hit
       this same stale Promise and re-render with stale photoUrl /
       fields, fixed waves later but seen first when an admin
       photo-replace didn't propagate to the public detail page.
     - In dev: persists for the dev process lifetime; restart to clear.

   Callers can ALSO pass `{ fresh: true }` to skip the cache (used by
   the admin /admin page which needs the absolute-latest list, not a
   build-time snapshot).

   MUTATION CONTRACT:
     Every server action that creates / updates / deletes a Bhandara
     row MUST call `invalidateBhandaraQueryCache()` alongside its
     `revalidatePath()` calls. Without that pairing, the page is
     marked stale + regenerates + reads the cached Promise + renders
     the old data. The two helpers are codependent: revalidatePath
     handles Next's HTML cache, invalidateBhandaraQueryCache handles
     our in-process DB cache.
   ──────────────────────────────────────────────────────────────── */

let allApprovedBhandarasPromise: Promise<DbBhandara[]> | null = null;

export function getAllApprovedBhandaras(opts?: {
  fresh?: boolean;
}): Promise<DbBhandara[]> {
  if (opts?.fresh || !allApprovedBhandarasPromise) {
    allApprovedBhandarasPromise = prisma.bhandara.findMany({
      where: { status: "APPROVED" },
      orderBy: [
        { isSponsored: "desc" },
        { isVerified: "desc" },
        { createdAt: "asc" },
      ],
    });
  }
  return allApprovedBhandarasPromise;
}

/** Same data shape as `getAllApprovedBhandaras` but mapped through
 *  `toBhandara` so callers don't have to remember the conversion.
 *  Cheap to call repeatedly, the underlying query is deduped. */
export async function getAllApprovedBhandarasMapped(opts?: {
  fresh?: boolean;
}): Promise<Bhandara[]> {
  const records = await getAllApprovedBhandaras(opts);
  return records.map(toBhandara);
}

/**
 * Drop the module-level Bhandara query cache so the next caller
 * fetches fresh from the DB. MUST be called from every server
 * action that mutates a Bhandara row, alongside the usual
 * revalidatePath() calls.
 *
 * Why this exists:
 *   `getAllApprovedBhandaras` memoizes a Promise at module scope to
 *   collapse 72 build-time queries into one (see the big comment
 *   above). That Promise survives across page regenerations in a
 *   warm Netlify Function, so an admin photo-replace would write
 *   the new URL to the DB, revalidatePath would mark the page
 *   stale, the page would regenerate, but the regeneration call
 *   would receive the SAME cached Promise and render the OLD
 *   photoUrl. The fix is this explicit hook: clear the Promise the
 *   moment we mutate, so the next render fetches fresh.
 *
 * If you forget to call this from a new admin action, the symptom
 * is: admin save succeeds, DB row updates correctly, but the public
 * /bhandara/[slug] keeps showing old data until the Function cold-
 * starts (could be minutes, could be never on a busy server).
 */
export function invalidateBhandaraQueryCache(): void {
  allApprovedBhandarasPromise = null;
}

export function toBhandara(record: DbBhandara): Bhandara {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    nameHi: record.nameHi ?? record.name,
    // Strip the WhatsApp-bot provenance tag (e.g.
    //   "[bot:whatsapp · from:… · msg:… · 2026-…Z]")
    // that /api/bot/ingest embeds into description for the admin
    // moderation view. The admin view bypasses toBhandara and reads
    // the raw Prisma record so it still sees the tag (and parses it
    // via parseBotTag); every public surface goes through this
    // mapper and therefore gets the cleaned prose only.
    description: stripBotProvenance(record.description),
    descriptionHi: stripBotProvenance(record.descriptionHi),
    area: record.area as Area,
    address: record.address,
    addressHi: record.addressHi ?? undefined,
    landmark: record.landmark ?? undefined,
    lat: record.lat,
    lng: record.lng,
    tuesdayDates: safeJsonArray(record.tuesdayDates),
    timeStart: record.timeStart,
    timeEnd: record.timeEnd,
    menu: safeJsonArray(record.menu),
    menuHi: safeJsonArray(record.menuHi),
    organizerName: record.organizerName,
    organizerPhone: record.organizerPhone,
    organizerWhatsapp: record.organizerWhatsapp ?? undefined,
    upiId: record.upiId ?? undefined,
    upiQrUrl: record.upiQrUrl ?? undefined,
    photoUrl: record.photoUrl ?? undefined,
    isSponsored: record.isSponsored,
    isVerified: record.isVerified,
    isFeatured: record.isFeatured,
    geoNeighborhood: record.geoNeighborhood ?? undefined,
    geoDistrict: record.geoDistrict ?? undefined,
    geoState: record.geoState ?? undefined,
    googlePlaceId: record.googlePlaceId ?? undefined,
    googleMapsUrl: record.googleMapsUrl ?? undefined,
  };
}
