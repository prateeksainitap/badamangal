"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Public header, footer and floating extras around every page except
 * /admin, which owns its own viewport.
 *
 * The admin check used to live in the root layout via headers(), which
 * made every route render per request (no cache, 3 to 4 s first byte on
 * the live homepage). Reading the path here, on the client side of the
 * boundary, keeps the layout static so the ISR `revalidate` set on each
 * page actually applies. usePathname also works during server render,
 * so admin pages get no flash of public chrome.
 */
export default function PublicChrome({
  before,
  header,
  after,
  children,
}: {
  before: ReactNode;
  header: ReactNode;
  after: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return <>{children}</>;
  return (
    <>
      {before}
      {header}
      <main id="main" className="flex-1">
        {children}
      </main>
      {after}
    </>
  );
}
