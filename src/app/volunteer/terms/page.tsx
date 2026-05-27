import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/seo";

/**
 * /volunteer/terms: public Terms & Conditions for the volunteer
 * programme.
 *
 * Reviewed and improved against Indian legal framework:
 *   • DPDP Act 2023: explicit consent + purpose + retention +
 *     grievance officer per §§ 5-10
 *   • Indian Contract Act 1872: § 23 carve-out for gross
 *     negligence (otherwise broad disclaimer is void as against
 *     public policy)
 *   • Copyright Act 1957 § 57: volunteer retains moral rights;
 *     BadaMangal gets perpetual non-exclusive license (not
 *     "irrevocable" which can fail without consideration)
 *   • POCSO Act 2012: guardian-consent rule for photos
 *     featuring identifiable minors
 *
 * 2026-05-27: stripped honorarium / payout / UPI references.
 * Programme is now framed as pure seva, no money flow.
 *
 * Standard practice still applies: a Lucknow lawyer should
 * review before any actual dispute. This page is best-effort
 * compliance, not legal advice.
 *
 * Last updated: 2026-05-27. When any clause materially changes,
 * bump the date below + the TERMS_VERSION export AND notify
 * active volunteers 14 days in advance via WhatsApp.
 */

const TERMS_VERSION = "2026-05-27";

export const metadata: Metadata = {
  title: "Volunteer terms & conditions · BadaMangal Lucknow",
  description:
    "Terms and conditions for joining the BadaMangal community volunteer programme. Data, photo usage, conduct, and safety.",
  alternates: { canonical: `${SITE_URL}/volunteer/terms` },
  robots: { index: true, follow: true },
};

export default function VolunteerTermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 pb-24">
      <header className="pt-8 sm:pt-12">
        <p className="text-xs uppercase tracking-[0.2em] text-saffron-600 font-medium">
          🚩 Volunteer programme
        </p>
        <h1 className="font-fraunces text-3xl sm:text-4xl text-sindoor-700 mt-2">
          Terms &amp; conditions
        </h1>
        <p className="mt-2 text-sm text-ink-600 font-mukta">
          Last updated: <strong>27 May 2026</strong>. By signing up
          you confirm you have read and agreed to these terms.
        </p>
        <p className="mt-1 text-sm">
          <Link
            href="/volunteer/signup"
            className="text-saffron-600 hover:text-saffron-700 underline decoration-dotted underline-offset-4"
          >
            ← Back to signup
          </Link>
        </p>
      </header>

      {/* Full English text */}
      <article className="mt-8 prose-quiet font-mukta text-ink-800 leading-relaxed">
        <Section number={1} title="About the programme">
          <p>
            BadaMangal is a community initiative documenting Bada
            Mangal bhandaras in Lucknow. Volunteers help by
            spotting bhandaras on Tuesdays, verifying organizer
            phone numbers, photographing banners, and supporting
            community coordination on WhatsApp. <strong>This is a
            community seva arrangement, not employment, agency,
            partnership, or contractor engagement.</strong>
          </p>
        </Section>

        <Section number={2} title="Eligibility">
          <p>
            You must be <strong>18 years of age or older</strong>{" "}
            (per § 11 of the Indian Contract Act, 1872, which
            voids contracts entered into by minors) and currently
            resident in or familiar with Lucknow district. By
            submitting the signup form you confirm both.
          </p>
        </Section>

        <Section number={3} title="Data we collect and how we use it">
          <p>At signup we collect:</p>
          <ul>
            <li><strong>Name:</strong> for coordination and ID card</li>
            <li>
              <strong>WhatsApp phone number:</strong> for delivery
              of your volunteer code and weekly Tuesday plans
            </li>
            <li>
              <strong>Areas you can cover:</strong> for team
              assignment
            </li>
          </ul>
          <p>After your first call with us, you may additionally share:</p>
          <ul>
            <li><strong>A photograph</strong> for your ID card</li>
            <li><strong>Postal address</strong> for ID card delivery</li>
            <li>
              <strong>Last four digits of any government photo
              ID</strong> (Aadhaar, voter ID, driving licence) as
              a trust signal. <strong>We never ask for or store
              the full ID number.</strong>
            </li>
            <li><strong>Year of birth</strong> for the 18+ check</li>
            <li><strong>Emergency contact name and number</strong></li>
          </ul>
          <p>
            <strong>Purpose limitation:</strong> we use this data
            solely for the volunteer-coordination purposes
            described in these terms. We do not sell, rent, or
            share it with third parties.
          </p>
          <p>
            <strong>Retention:</strong> we retain your data for{" "}
            <strong>24 months after your last activity</strong>{" "}
            with the programme (i.e. last submission or last
            response on the coordination channel, whichever is
            most recent). After that we delete it, except records
            we are statutorily required to retain.
          </p>
          <p>
            <strong>Your rights under the Digital Personal Data
            Protection Act, 2023:</strong> you have the right to
            (a) access your data, (b) correct inaccuracies, (c)
            request deletion, (d) nominate someone to act on your
            behalf, and (e) grievance redressal. Contact details
            for our Grievance Officer are in § 12 below.
          </p>
        </Section>

        <Section number={4} title="Communication consent">
          <p>
            By signing up, you consent to receive WhatsApp
            messages from the BadaMangal coordination number for
            (a) sending your volunteer code, (b) sharing weekly
            Tuesday plans, and (c) live coordination during a
            Bada Mangal Tuesday.
          </p>
          <p>
            You may opt out at any time by replying{" "}
            <strong>STOP</strong> to any message. Opting out does
            not require you to delete your volunteer record; it
            simply pauses outbound coordination.
          </p>
        </Section>

        <Section number={5} title="Photos and content you capture">
          <p>
            Photographs, videos, captions, location pins, and
            other content you capture during seva activities for
            the programme may be used by BadaMangal on its
            website (badamangal.com), social media channels,
            press materials, sponsor pitches, physical pamphlets,
            and any other community-purpose surface.
          </p>
          <p>
            <strong>You retain ownership and copyright in your
            photographs.</strong> You grant BadaMangal a{" "}
            <strong>perpetual, worldwide, non-exclusive,
            royalty-free license</strong> to use, reproduce,
            adapt, modify, publish, display, and distribute such
            content for community purposes connected to the
            BadaMangal programme. Your moral rights of attribution
            and integrity under § 57 of the Copyright Act, 1957
            are preserved.
          </p>
          <p>
            <strong>Photographs featuring identifiable
            individuals:</strong> if a photograph prominently
            features an identifiable adult, please obtain their
            verbal consent before submission. If a photograph
            features an identifiable minor, you must obtain{" "}
            <strong>verbal consent from a parent or guardian</strong>{" "}
            before submission (we recommend not photographing
            minors closely; wide shots of crowds are fine).
            BadaMangal will remove any photograph from its
            surfaces within seven (7) days of a written request
            from the depicted person or their guardian.
          </p>
        </Section>

        <Section number={6} title="Conduct expectations">
          <p>Every volunteer agrees to:</p>
          <ul>
            <li>
              Be <strong>respectful</strong> to organizers,
              community members, and other volunteers, regardless
              of caste, religion, gender, or social standing
            </li>
            <li>
              Use the volunteer code only for <strong>genuine
              submissions</strong>; fake, fabricated, duplicate,
              or speculative submissions are grounds for
              suspension
            </li>
            <li>
              <strong>Not impersonate</strong> other volunteers,
              organizers, BadaMangal staff, or any third party
            </li>
            <li>
              Not spam community WhatsApp groups, not contact
              organizers outside the coordination channel, and{" "}
              <strong>not collect payment from any organizer
              under BadaMangal's name</strong>
            </li>
            <li>
              Comply with applicable Indian law, including but
              not limited to § 67 of the Information Technology
              Act, 2000 (prohibiting transmission of obscene
              content), and the Protection of Children from
              Sexual Offences Act, 2012
            </li>
          </ul>
        </Section>

        <Section number={7} title="Suspension and termination">
          <p>
            BadaMangal may suspend or terminate your participation
            at our discretion, including for:
          </p>
          <ul>
            <li>Conduct violations under § 6</li>
            <li>Failure to verify your WhatsApp number</li>
            <li>Inactivity for eight (8) or more consecutive Tuesdays during a Bada Mangal season</li>
            <li>A pattern of low-quality or duplicate submissions</li>
            <li>Any conduct that brings the programme into disrepute</li>
          </ul>
          <p>
            <strong>Natural justice:</strong> where reasonably
            possible, we will communicate the reason for
            suspension on the coordination channel and provide
            an opportunity to respond before any final
            termination.
          </p>
          <p>
            You may opt out at any time by sending a WhatsApp
            message to the coordination number. There is no
            notice period and no penalty.
          </p>
        </Section>

        <Section number={8} title="Safety and limitation of liability">
          <p>
            Seva participation involves walking, riding two-
            wheelers, photographing, and interacting with
            community members in public spaces.{" "}
            <strong>You participate at your own risk.</strong>
          </p>
          <p>
            <strong>Save and except for direct losses arising
            from BadaMangal's gross negligence or wilful
            misconduct,</strong> BadaMangal shall not be liable
            for:
          </p>
          <ul>
            <li>Personal injury, accident, or health issues during seva</li>
            <li>Loss or damage of personal belongings (phone, scooter, camera, etc.)</li>
            <li>Disputes between you and any organizer, community member, or third party</li>
            <li>Any indirect, consequential, special, exemplary, or incidental damages</li>
          </ul>
          <p>
            Please take normal urban-mobility precautions: a
            helmet if you ride a two-wheeler, situational
            awareness in crowds, and your own medical/accident
            insurance. The above limitation is intended to
            allocate ordinary risks of public participation; it
            does not purport to disclaim liability that cannot be
            disclaimed under Indian law.
          </p>
        </Section>

        <Section number={9} title="Indemnification">
          <p>
            You agree to indemnify and hold BadaMangal harmless
            from any claim, loss, or expense (including
            reasonable legal fees) arising out of (a) your
            breach of these terms, (b) your breach of any
            applicable law during seva, (c) any false,
            misleading, or infringing content you submit, or (d)
            any claim by a third party arising from your conduct
            during the programme.
          </p>
        </Section>

        <Section number={10} title="Children's safety">
          <p>
            The BadaMangal volunteer programme is exclusively for
            adults aged 18 and over. Bhandaras themselves are
            public events open to all ages, but the coordination,
            travel, and operational decisions of the volunteer
            programme are not appropriate for minors.
          </p>
        </Section>

        <Section number={11} title="Changes to these terms">
          <p>
            BadaMangal may update these terms from time to time.
            Where a change is material, including but not
            limited to changes to data collection, retention, or
            your rights, we will provide at least{" "}
            <strong>fourteen (14) days' advance notice</strong>{" "}
            via WhatsApp to active volunteers and update the
            "Last updated" date at the top of this page.
            Continued participation after the notice period
            constitutes acceptance of the revised terms.
          </p>
        </Section>

        <Section number={12} title="Grievance officer and contact">
          <p>
            For any question, opt-out request, data deletion
            request, photo takedown request, or grievance related
            to your data, write to:
          </p>
          <p className="ml-4 my-3">
            <strong>Prateek Saini · Grievance Officer</strong>
            <br />
            BadaMangal · Lucknow
            <br />
            Email:{" "}
            <a
              href="mailto:namaste@badamangal.com"
              className="text-saffron-600 hover:text-saffron-700 underline"
            >
              namaste@badamangal.com
            </a>
            <br />
            WhatsApp: the BadaMangal coordination number you
            received your volunteer code from
          </p>
          <p>
            We will acknowledge any request within{" "}
            <strong>seven (7) business days</strong> and resolve
            it within thirty (30) days, in line with DPDP Act
            timelines.
          </p>
        </Section>

        <Section number={13} title="General provisions">
          <p>
            <strong>Entire agreement.</strong> These terms
            constitute the entire agreement between you and
            BadaMangal regarding your participation in the
            volunteer programme, and supersede any prior oral or
            written understandings.
          </p>
          <p>
            <strong>Severability.</strong> If any provision of
            these terms is held by a court of competent
            jurisdiction to be invalid, illegal, or
            unenforceable, the remaining provisions shall
            continue in full force and effect.
          </p>
          <p>
            <strong>No third-party beneficiaries.</strong> These
            terms create rights and obligations only between you
            and BadaMangal. No third party is a beneficiary.
          </p>
          <p>
            <strong>Assignment.</strong> You may not assign your
            participation rights. BadaMangal may assign these
            terms in connection with a transfer of the programme
            to a successor entity, subject to materially
            equivalent protections for volunteers.
          </p>
          <p>
            <strong>Force majeure.</strong> Neither party is
            liable for failure to perform due to causes beyond
            reasonable control, including but not limited to
            natural disasters, pandemics, government action, or
            telecommunications outages.
          </p>
        </Section>

        <Section number={14} title="Governing law and dispute resolution">
          <p>
            These terms are governed by and construed in
            accordance with the laws of India. Any disputes
            arising out of or in connection with these terms
            shall be subject to the <strong>exclusive
            jurisdiction of the courts of Lucknow, Uttar
            Pradesh</strong>.
          </p>
          <p>
            The parties shall first attempt to resolve any
            dispute through good-faith discussion on the
            coordination channel for thirty (30) days before
            initiating any legal proceedings.
          </p>
        </Section>

        <p className="text-xs text-ink-500 italic mt-12">
          BadaMangal · Lucknow · India ·{" "}
          <span>
            Version <strong>{TERMS_VERSION}</strong>
          </span>
        </p>
      </article>

      <footer className="mt-12 flex items-center justify-between gap-3 flex-wrap text-sm">
        <Link
          href="/volunteer/signup"
          className="inline-flex items-center gap-1.5 rounded-full bg-saffron-500 hover:bg-saffron-600 text-cream-50 font-semibold px-5 py-2.5 shadow-sm transition-colors"
        >
          ← Back to signup
        </Link>
        <Link
          href="/volunteer"
          className="text-ink-600 hover:text-saffron-600 underline decoration-dotted underline-offset-4"
        >
          About the volunteer programme
        </Link>
      </footer>
    </main>
  );
}

/** Numbered section heading used throughout the T&C. Pulls the
 *  numbering out of the content so reordering sections doesn't
 *  require renumbering by hand. */
function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="font-fraunces text-lg sm:text-xl text-sindoor-700 mb-2">
        <span className="text-saffron-600 mr-1.5 tabular-nums">
          {number}.
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-sm sm:text-[15px] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_a]:text-saffron-600 [&_a]:underline [&_strong]:text-ink-900">
        {children}
      </div>
    </section>
  );
}
