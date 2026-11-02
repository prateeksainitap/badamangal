import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import { notFound } from "next/navigation";
import SundarKaandForm from "@/components/SundarKaandForm";
import { isSundarKaandLive } from "@/lib/sundarKaand";

export const metadata: Metadata = {
  title: { absolute: "Organise a Sundar Kaand or Hanuman puja · BadaMangal" },
  description:
    "Want to host a Sundar Kaand path or Hanuman puja at your home, society, or local mandir in Lucknow? Share a few details and our team will help arrange pandit, mandali, tent, prasad and everything in between.",
  alternates: {
    canonical: "/organise/sundar-kaand",
  },
  openGraph: {
    images: [DEFAULT_OG_IMAGE],
    title: "Organise a Sundar Kaand or Hanuman puja · BadaMangal",
    description:
      "Hosting a Sundar Kaand path or Hanuman puja in Lucknow? We'll help arrange the rest.",
    type: "website",
    siteName: "BadaMangal",
  },
};

export default function SundarKaandIntakePage() {
  // Date-gated: not publicly reachable until after 23 Jun 2026.
  if (!isSundarKaandLive()) notFound();
  return <SundarKaandForm />;
}
