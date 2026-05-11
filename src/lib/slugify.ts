import { prisma } from "@/lib/db";

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
