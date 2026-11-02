import { existsSync } from "node:fs";
import { join } from "node:path";

/** True when a temple painting is actually in /public. A temple whose
 *  art is still being made keeps its imagePath in content, and the pages
 *  show their painted placeholder until the file lands. */
export function templeImageOnDisk(imagePath: string | undefined): boolean {
  if (!imagePath) return false;
  return existsSync(join(process.cwd(), "public", imagePath));
}
