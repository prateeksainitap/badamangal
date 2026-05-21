/**
 * /volunteer/signup, public signup form for the volunteer programme.
 *
 * Server-rendered shell with metadata; the actual form is the
 * client component <VolunteerSignupForm /> so React state can
 * handle the in-place "you're in! here's your code" success
 * screen without a navigation round-trip.
 */
import type { Metadata } from "next";
import Link from "next/link";
import VolunteerSignupForm from "@/components/volunteer/VolunteerSignupForm";
import { JaliCorner } from "@/components/ornaments";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign up as a BadaMangal volunteer | Lucknow",
  description:
    "30-second signup. Get your volunteer code, earn ₹50 per documented bhandara on Tuesdays + Saturdays this Bada Mangal season.",
  alternates: { canonical: `${SITE_URL}/volunteer/signup` },
  robots: { index: false, follow: true },
};

export default function VolunteerSignupPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 pb-24">
      <header className="pt-8 sm:pt-12 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-saffron-600 font-medium">
          🚩 Volunteer · स्वयंसेवक
        </p>
        <h1 className="font-fraunces text-3xl sm:text-4xl text-sindoor-700 mt-2">
          अभी जुड़ें · Sign up
        </h1>
        <p className="mt-3 text-sm text-ink-600 max-w-md mx-auto leading-relaxed">
          30 seconds का form भरिए। आपका volunteer code तुरंत मिल जाएगा
          और आप उसी समय भण्डारे document करना शुरू कर सकते हैं।
        </p>
        <p className="mt-1.5 text-xs text-ink-600">
          30-second form. You'll get your volunteer code instantly and can start submitting bhandaras right away.{" "}
          <Link
            href="/volunteer"
            data-ga="volunteer_signup_about_link"
            className="underline decoration-dotted underline-offset-4 hover:text-saffron-600"
          >
            What's this?
          </Link>
        </p>
      </header>

      <section className="relative mt-6 rounded-3xl border border-gold-500/40 bg-cream-50 p-6 sm:p-8 shadow-sm overflow-hidden">
        <JaliCorner position="tl" className="absolute top-3 left-3 w-9 h-9 text-gold-500/60" />
        <JaliCorner position="tr" className="absolute top-3 right-3 w-9 h-9 text-gold-500/60" />
        <JaliCorner position="bl" className="absolute bottom-3 left-3 w-9 h-9 text-gold-500/60" />
        <JaliCorner position="br" className="absolute bottom-3 right-3 w-9 h-9 text-gold-500/60" />
        <VolunteerSignupForm />
      </section>
    </main>
  );
}
