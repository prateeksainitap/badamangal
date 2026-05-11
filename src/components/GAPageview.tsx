"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function GAPageviewInner({ id }: { id: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }
    const search = searchParams.toString();
    const url = pathname + (search ? `?${search}` : "");
    window.gtag("event", "page_view", {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, searchParams, id]);

  return null;
}

export default function GAPageview({ id }: { id: string }) {
  return (
    <Suspense fallback={null}>
      <GAPageviewInner id={id} />
    </Suspense>
  );
}
