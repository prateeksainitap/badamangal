import type { Metadata } from "next";
import Link from "next/link";
import HomeFAQ from "@/components/HomeFAQ";
import { faqSchema, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "FAQ · BadaMangal Lucknow",
  description:
    "Common questions about Bada Mangal — the 400-year-old Tuesday meal tradition of Lucknow, the rare 8-Tuesday 2026 cycle, how to find a bhandara near you, and how to list your own.",
  alternates: {
    canonical: "/faq",
    languages: {
      "hi-IN": "/faq",
      "en-IN": "/faq?lang=en",
    },
  },
  openGraph: {
    title: "FAQ · BadaMangal Lucknow",
    description:
      "Common questions about Bada Mangal — the tradition, the dates, the bhandaras.",
    url: `${SITE_URL}/faq`,
    type: "website",
    siteName: "BadaMangal",
  },
};

export default function FAQPage() {
  // Reuse the same FAQPage JSON-LD that the homepage emits — the
  // /faq page IS the FAQ surface, so the rich-snippet eligibility
  // belongs here as much as on /.
  const jsonLd = faqSchema();

  return (
    <main className="relative pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Soft saffron radial wash at the top edge */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-64 -z-10"
        style={{
          background:
            "radial-gradient(900px 320px at 50% -10%, rgba(242,148,76,0.15), transparent 70%)",
        }}
      />

      <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 sm:pt-16 pb-6 text-center">
        <Link
          href="/"
          className="inline-block text-sm text-ink-600 hover:text-saffron-600 transition-colors"
        >
          ← Back to home
        </Link>
        <p className="mt-4 font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold inline-flex items-center gap-2 justify-center">
          <span aria-hidden className="block w-1.5 h-1.5 rounded-full bg-saffron-600" />
          FAQ
        </p>
        <h1 className="mt-3 font-fraunces font-bold text-3xl sm:text-5xl text-sindoor-700 leading-tight [text-wrap:balance]">
          Common questions about Bada Mangal
        </h1>
        <p className="mt-4 text-ink-600 leading-relaxed max-w-2xl mx-auto">
          The tradition, the dates, the bhandaras, and the site — all
          in one place, in English and Hindi.
        </p>
      </header>

      {/* HomeFAQ in standalone mode drops its own section chrome
          (eyebrow + headline) since this page already has them. */}
      <HomeFAQ variant="standalone" />
    </main>
  );
}
