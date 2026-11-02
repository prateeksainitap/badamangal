import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import ContactHero from "@/components/ContactHero";
import { InnerShell, Plate } from "@/components/v2";
import { HOME_ART } from "@/content/home-art";
import { localised, DEFAULT_OG_IMAGE } from "@/lib/seo";

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
    images: [DEFAULT_OG_IMAGE],
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
    <InnerShell>
      <ContactHero />
      <section className="bmi-sec tight" style={{ paddingTop: 0 }}>
        <div className="bmi-wrap bmi-formgrid">
          <div>
            <ContactForm />
          </div>
          <div className="bmi-formart" aria-hidden>
            <Plate
              src={HOME_ART.aliganjDusk.src}
              width={HOME_ART.aliganjDusk.width}
              height={HOME_ART.aliganjDusk.height}
              alt=""
            />
          </div>
        </div>
      </section>
    </InnerShell>
  );
}
