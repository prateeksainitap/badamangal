import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import ContactHero from "@/components/ContactHero";
import { localised } from "@/lib/seo";

// ISR. Was force-dynamic for cookies()-based locale; the page now
// renders statically and both the hero + form pull the actual locale
// from <LocaleProvider /> client-side. Form submission still POSTs to
// /api/contact dynamically. Navigation to /contact is now instant.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Contact BadaMangal, Lucknow's Bada Mangal directory",
  description:
    "Reach the BadaMangal team for listing corrections, sponsorship, partnership, or any question about Lucknow's Bada Mangal bhandaras.",
  alternates: localised("/contact"),
  openGraph: {
    title: "Contact BadaMangal",
    description:
      "Questions, corrections, or partnership ideas, reach the team.",
    type: "website",
    locale: "hi_IN",
    alternateLocale: "en_IN",
  },
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-14">
      <ContactHero />
      <div className="mt-8">
        <ContactForm />
      </div>
    </main>
  );
}
