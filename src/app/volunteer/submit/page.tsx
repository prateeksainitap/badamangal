/**
 * /volunteer/submit?code=BM-LKO-XXXXXX
 *
 * Server shell for the bhandara submission form. The form itself is
 * a client component because:
 *   • GPS capture needs navigator.geolocation
 *   • File uploads stream individually via fetch, with per-file state
 *   • Volunteer code is read from URL ?code= OR localStorage so the
 *     volunteer doesn't need the URL param after their first submit
 */
import type { Metadata } from "next";
import Link from "next/link";
import VolunteerSubmitForm from "@/components/volunteer/VolunteerSubmitForm";
import { JaliCorner } from "@/components/ornaments";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Submit a bhandara | BadaMangal Volunteer",
  description:
    "Upload 10 photos + 2 videos + 1 live spot photo + the listing fields. Earn ₹50 if approved.",
  alternates: { canonical: `${SITE_URL}/volunteer/submit` },
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<{ code?: string }> };

export default async function VolunteerSubmitPage({ searchParams }: PageProps) {
  const { code } = await searchParams;
  const initialCode = typeof code === "string" ? code.trim().toUpperCase() : "";

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 pb-24">
      <header className="pt-8 sm:pt-12 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-saffron-600 font-medium">
          🚩 Submit a bhandara
        </p>
        <h1 className="font-fraunces text-3xl sm:text-4xl text-sindoor-700 mt-2">
          भण्डारा भेजें
        </h1>
        <p className="mt-3 text-sm text-ink-600">
          Take 10 photos + 2 videos + 1 live spot.{" "}
          <Link href="/volunteer" className="underline decoration-dotted underline-offset-4 hover:text-saffron-600">
            See full guide
          </Link>
        </p>
      </header>

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
