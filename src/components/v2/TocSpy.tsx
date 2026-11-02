"use client";

import { useEffect } from "react";

/** Marks the contents link of the section in view (aria-current). */
export default function TocSpy({ ids }: { ids: string[] }) {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const links = () => document.querySelectorAll<HTMLAnchorElement>(".bmi-toc a[data-toc]");
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!vis) return;
        links().forEach((a) => a.setAttribute("aria-current", String(a.dataset.toc === vis.target.id)));
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids]);
  return null;
}
