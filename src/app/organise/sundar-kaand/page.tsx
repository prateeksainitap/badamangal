import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SundarKaandForm from "@/components/SundarKaandForm";
import { isSundarKaandLive } from "@/lib/sundarKaand";

export const metadata: Metadata = {
  title: "Organise a Sundar Kaand or Hanuman puja · BadaMangal",
  description:
    "Want to host a Sundar Kaand path or Hanuman puja at your home, society, or local mandir in Lucknow? Share a few details and our team will help arrange pandit, mandali, tent, prasad and everything in between.",
  alternates: {
    canonical: "/organise/sundar-kaand",
  },
  openGraph: {
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
  return (
    <main className="relative">
      {/* Soft saffron / cream backdrop, same warmth as the rest of
          the editorial pages. The form takes the lead, no big hero
          art, just a clean intake that respects organisers' time. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-64 -z-10"
        style={{
          background:
            "radial-gradient(900px 320px at 50% -10%, rgba(242,148,76,0.15), transparent 70%)",
        }}
      />
      <SundarKaandForm />
    </main>
  );
}
