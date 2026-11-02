"use client";

import { useLocaleFromContext } from "@/lib/locale-context";
import Words from "./Words";

/**
 * A section's display heading in ONE language: Hindi when the visitor
 * reads in Hindi, English otherwise (founder, 29 Oct 2026: "Either keep
 * Hindi or English. Not both."). Words rise in one by one.
 */
export default function Head({
  as: Tag = "p",
  en,
  hi,
  id,
  className = "h2 words",
}: {
  as?: "p" | "h2";
  className?: string;
  en: string;
  hi: string;
  id?: string;
}) {
  const isHi = useLocaleFromContext() === "hi";
  return (
    <Tag className={`${className}${isHi ? "" : " h2-latin"}`} id={id} lang={isHi ? "hi" : "en"}>
      <Words text={isHi ? hi : en} />
    </Tag>
  );
}
