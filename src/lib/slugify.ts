import { prisma } from "@/lib/db";
import type { Bhandara } from "@prisma/client";

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "bhandara";
}

export async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let suffix = 1;
  // up to ~200 iterations is plenty; Prisma findUnique is cheap on indexed slug
  while (await prisma.bhandara.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
    if (suffix > 200) {
      slug = `${base}-${Date.now()}`;
      break;
    }
  }
  return slug;
}

/**
 * Race-safe variant of: ensureUniqueSlug + prisma.bhandara.create.
 *
 * The two operations have a TOCTOU race: two concurrent submitters
 * with the same name (Bhandara form, bot ingest, public scan)
 * could both pass the ensureUniqueSlug check, then collide on the
 * INSERT and the second one would throw P2002 (unique constraint
 * violation) and the row would be lost. The user would see a 500
 * with no explanation.
 *
 * Strategy: retry once with a timestamp suffix on the colliding
 * slug. Two concurrent sub-millisecond writes with identical names
 * could still collide on the timestamp, but the probability is
 * effectively zero at our submission rate.
 *
 * Returns the created Bhandara row. Caller passes the build-the-
 * data callback so we can swap in a different slug on retry.
 */
export async function createBhandaraWithSlugRetry(
  base: string,
  build: (slug: string) => Parameters<typeof prisma.bhandara.create>[0]["data"],
): Promise<Bhandara> {
  const firstSlug = await ensureUniqueSlug(base);
  try {
    return await prisma.bhandara.create({ data: build(firstSlug) });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "P2002") throw err;
    const retrySlug = `${base}-${Date.now()}`;
    return await prisma.bhandara.create({ data: build(retrySlug) });
  }
}
