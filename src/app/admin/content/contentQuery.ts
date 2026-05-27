import { prisma } from "@/lib/db";

/**
 * Shared "fetch Content rows safely" helper. Centralises the
 * "what if the send-tracking migration hasn't been applied yet?"
 * fallback so PitchesTab / TemplatesTab / StrategyTab all degrade
 * identically.
 *
 * The problem this solves:
 *   A plain `prisma.content.findMany({ where, orderBy })` issues a
 *   SELECT for EVERY column the regenerated Prisma client knows
 *   about, including `lastSentAt`, `lastSentTo`, and
 *   `awaitingReply`. If those columns don't exist in Postgres
 *   (i.e. the manual SQL migration at
 *   prisma/migrations/manual/add_content_send_tracking.sql hasn't
 *   been applied), every page that lists Content rows throws
 *   `PrismaClientKnownRequestError: column does not exist`.
 *
 * The fix:
 *   Try the full-fat query first. On any error, fall back to a
 *   query with an explicit `select` of ONLY the pre-migration
 *   columns, then synthesise the send-tracking fields as
 *   null/false. The card renderers handle missing send-tracking
 *   gracefully (`row.lastSentAt ?? null` etc.).
 *
 * Once the migration is applied this helper's catch branch
 * never fires; both paths return the full row shape.
 */

export type ContentRow = Awaited<
  ReturnType<typeof prisma.content.findMany>
>[number];

/** OrderBy shape Prisma's findMany accepts — either a single
 *  object or an array, with the send-tracking columns allowed
 *  alongside the legacy ones. */
type OrderBy =
  | Parameters<typeof prisma.content.findMany>[0] extends
      | { orderBy?: infer T }
      | undefined
    ? T
    : never;

/** Legacy column set, excludes lastSentAt / lastSentTo /
 *  awaitingReply so the fallback query doesn't crash when those
 *  columns don't exist in Postgres yet. */
const LEGACY_SELECT = {
  id: true,
  kind: true,
  audience: true,
  channel: true,
  language: true,
  title: true,
  body: true,
  summary: true,
  tags: true,
  source: true,
  status: true,
  lastEditor: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Legacy-shape orderBy, never references send-tracking columns. */
const LEGACY_ORDER_BY = { updatedAt: "desc" } as const;

export async function safeContentFindMany({
  where,
  orderBy,
}: {
  where: Record<string, unknown>;
  orderBy: OrderBy;
}): Promise<ContentRow[]> {
  try {
    return await prisma.content.findMany({
      where: where as Parameters<typeof prisma.content.findMany>[0] extends
        | { where?: infer W }
        | undefined
        ? W
        : never,
      orderBy,
    });
  } catch (err) {
    console.error(
      "[contentQuery] Content findMany rejected, falling back to legacy column-explicit shape. Run `npx prisma db push` or apply prisma/migrations/manual/add_content_send_tracking.sql to enable send-tracking:",
      err instanceof Error ? err.message : err,
    );
    // Re-run with explicit select + legacy orderBy. We have to
    // strip any new-column references from `where` too because a
    // WHERE clause that names `awaitingReply` will still trip
    // Postgres even when SELECT only names legacy columns.
    const sanitisedWhere = stripNewColumns(where);
    const legacyRows = await prisma.content.findMany({
      where: sanitisedWhere as Parameters<
        typeof prisma.content.findMany
      >[0] extends { where?: infer W } | undefined
        ? W
        : never,
      orderBy: LEGACY_ORDER_BY,
      select: LEGACY_SELECT,
    });
    return legacyRows.map(
      (r) =>
        ({
          ...r,
          lastSentAt: null,
          lastSentTo: null,
          awaitingReply: false,
        }) as unknown as ContentRow,
    );
  }
}

/** Recursively walk a where clause and remove any reference to the
 *  post-migration columns. Keeps every other predicate intact so
 *  audience / channel / status filters still apply in the legacy
 *  fallback. */
function stripNewColumns(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node
      .map((n) => stripNewColumns(n))
      .filter((n) => n !== null && !(typeof n === "object" && n !== null && Object.keys(n as object).length === 0));
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "lastSentAt" || k === "lastSentTo" || k === "awaitingReply") {
        continue;
      }
      const cleaned = stripNewColumns(v);
      if (
        cleaned !== null &&
        !(typeof cleaned === "object" &&
          cleaned !== null &&
          !Array.isArray(cleaned) &&
          Object.keys(cleaned as object).length === 0)
      ) {
        out[k] = cleaned;
      }
    }
    return out;
  }
  return node;
}
