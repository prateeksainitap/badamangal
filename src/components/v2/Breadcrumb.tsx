import Link from "next/link";
import type { ReactNode } from "react";

export type Crumb = {
  label: ReactNode;
  /** Omit for the current page (last crumb). */
  href?: string;
  /** A custom element instead of a plain link (e.g. BackToHomeLink). */
  node?: ReactNode;
};

/**
 * Human readable trail above a page hero. Keep the hrefs the page
 * already had (SEO); the JSON-LD BreadcrumbList stays in the route.
 *
 *   <Breadcrumb items={[{ label: <T en="Home" hi="होम" />, href: "/?lang=en" },
 *                       { label: areaName }]} />
 */
export default function Breadcrumb({ items, label = "Breadcrumb" }: { items: Crumb[]; label?: string }) {
  return (
    <nav aria-label={label} className="bmi-crumbs" data-rv>
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i}>
              {c.node ? (
                c.node
              ) : c.href && !last ? (
                <Link href={c.href} prefetch={false}>
                  {c.label}
                </Link>
              ) : c.href ? (
                <Link href={c.href} prefetch={false} aria-current="page">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page">{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
