import type { Metadata } from "next";
import StyleGuide from "@/components/StyleGuide";

// The living style guide is statically prerendered and intentionally
// light on metadata — it shouldn't appear in search results, and the
// team uses it as an internal QA surface.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Design system · BadaMangal",
  description:
    "Internal style guide for the BadaMangal design system — colour, type, ornaments, primitives.",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return <StyleGuide />;
}
