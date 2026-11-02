/** Adds `lang=en` before any #fragment, keeping existing query params.
 *  Plain module so server and client components can both use it. */
export function withLangEn(href: string): string {
  const [pathAndQuery, hash] = href.split("#");
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  return `${pathAndQuery}${sep}lang=en${hash ? `#${hash}` : ""}`;
}
