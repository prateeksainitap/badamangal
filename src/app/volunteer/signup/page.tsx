/**
 * /volunteer/signup, public signup form for the volunteer programme.
 *
 * Server-rendered shell with metadata; the actual form is the
 * client component <VolunteerSignupForm /> so React state can
 * handle the in-place "you're in! here's your code" success
 * screen without a navigation round-trip.
 */
import type { Metadata } from "next";
import VolunteerSignupForm from "@/components/volunteer/VolunteerSignupForm";
import { InnerShell, FormPanel } from "@/components/v2";
import SignupHero from "./SignupHero";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign up as a BadaMangal volunteer | Lucknow",
  description:
    "30-second signup. Get your volunteer code, join our WhatsApp group for the full 8-Tuesday Bada Mangal season. Pure seva, no fee, no payment. Delivery riders, cab drivers, students, anyone welcome.",
  alternates: { canonical: `${SITE_URL}/volunteer/signup` },
  robots: { index: false, follow: true },
};

export default function VolunteerSignupPage() {
  return (
    <InnerShell>
      <SignupHero />
      <section className="bmi-sec tight" style={{ paddingTop: 0 }}>
        <div className="bmi-wrap bmi-formgrid">
          <div>
            <FormPanel>
              <VolunteerSignupForm />
            </FormPanel>
          </div>
        </div>
      </section>
    </InnerShell>
  );
}
