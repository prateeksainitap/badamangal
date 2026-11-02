"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";
import { withLangEn } from "./lang-href";


/**
 * Internal link that carries `?lang=en` while the visitor reads in
 * English, exactly like HomeHero, OrganisePromo and HomeResourcesTeaser
 * always did. The server renders English, so crawlers see the same
 * `?lang=en` URLs production links to today; Hindi readers get the bare
 * path and their cookie decides.
 */
export default function LocaleLink({
  href,
  children,
  ...rest
}: { href: string; children: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  const locale = useLocaleFromContext();
  return (
    <Link href={locale === "en" ? withLangEn(href) : href} prefetch={false} {...rest}>
      {children}
    </Link>
  );
}
