/**
 * /volunteer/submit?code=BM-LKO-XXXXXX
 *
 * Server shell for the bhandara submission form. The form itself is
 * a client component because:
 *   • GPS capture needs navigator.geolocation
 *   • File uploads stream individually via fetch, with per-file state
 *   • Volunteer code is read from URL ?code= OR localStorage so the
 *     volunteer doesn't need the URL param after their first submit
 *   • Locale-aware single-language rendering (English-only when EN,
 *     Hindi-only when HI) needs the React locale context — used to
 *     be a bilingual mixed page, now the LangToggle in the header
 *     controls the entire page including the header eyebrow + H1.
 *
 * The page header used to live here as bilingual ("🚩 Submit a
 * bhandara" + "भण्डारा भेजें" + a bilingual subhead). Moved into
 * VolunteerSubmitHeader (a tiny locale-aware client island next to
 * the form) so the toggle flips the title + subhead in lockstep
 * with the form body.
 */
import type { Metadata } from "next";
import VolunteerSubmitForm from "@/components/volunteer/VolunteerSubmitForm";
import VolunteerSubmitHeader from "@/components/volunteer/VolunteerSubmitHeader";
import { JaliCorner } from "@/components/ornaments";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Submit a bhandara | BadaMangal Volunteer",
  description:
    "Upload 10 photos + 2 videos + 1 live spot photo + the listing fields. Pure seva submission — your contribution lights up the public bhandara map for everyone.",
  alternates: { canonical: `${SITE_URL}/volunteer/submit` },
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<{ code?: string }> };

export default async function VolunteerSubmitPage({ searchParams }: PageProps) {
  const { code } = await searchParams;
  const initialCode = typeof code === "string" ? code.trim().toUpperCase() : "";

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 pb-24">
      <VolunteerSubmitHeader />

      <section className="relative mt-6 rounded-3xl border border-gold-500/40 bg-cream-50 p-5 sm:p-7 shadow-sm overflow-hidden">
        <JaliCorner position="tl" className="absolute top-3 left-3 w-9 h-9 text-gold-500/60" />
        <JaliCorner position="tr" className="absolute top-3 right-3 w-9 h-9 text-gold-500/60" />
        <JaliCorner position="bl" className="absolute bottom-3 left-3 w-9 h-9 text-gold-500/60" />
        <JaliCorner position="br" className="absolute bottom-3 right-3 w-9 h-9 text-gold-500/60" />
        <VolunteerSubmitForm initialCode={initialCode} />
      </section>
    </main>
  );
}
