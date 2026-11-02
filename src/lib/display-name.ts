/**
 * Bhandara names as organisers typed them often carry dashes
 * ("Vishal Bhandara — Hanuman Mandir, Mahanagar"). The site never
 * shows a dash (founder, 29 Oct 2026), so public surfaces read names
 * through this: a spaced dash or any em or en dash becomes a comma.
 * The database keeps the organiser's original text.
 */
export function cleanName(name: string): string;
export function cleanName(name: string | null | undefined): string | null;
export function cleanName(name: string | null | undefined): string | null {
  if (name == null) return null;
  return name
    .replace(/\s*[–—―]+\s*/g, ", ")
    .replace(/\s+-+\s+/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/^\s*,\s*|\s*,\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
