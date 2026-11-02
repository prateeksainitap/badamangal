import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/seo";
import { InnerShell, PageHero, Kicker, Breadcrumb, ProseDoc, Actions, Button } from "@/components/v2";

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

const TOC = [
  { id: "terms-1", label: "1. About the programme" },
  { id: "terms-2", label: "2. Eligibility" },
  { id: "terms-3", label: "3. Data we collect and how we use it" },
  { id: "terms-4", label: "4. Communication consent" },
  { id: "terms-5", label: "5. Photos and content you capture" },
  { id: "terms-6", label: "6. Conduct expectations" },
  { id: "terms-7", label: "7. Suspension and termination" },
  { id: "terms-8", label: "8. Safety and limitation of liability" },
  { id: "terms-9", label: "9. Indemnification" },
  { id: "terms-10", label: "10. Children's safety" },
  { id: "terms-11", label: "11. Changes to these terms" },
  { id: "terms-12", label: "12. Grievance officer and contact" },
  { id: "terms-13", label: "13. General provisions" },
  { id: "terms-14", label: "14. Governing law and dispute resolution" },
];

export const metadata: Metadata = {
  title: "Volunteer terms & conditions · BadaMangal Lucknow",
  description:
    "Terms and conditions for joining the BadaMangal community volunteer programme. Data, photo usage, conduct, and safety.",
  alternates: { canonical: `${SITE_URL}/volunteer/terms` },
  robots: { index: true, follow: true },
};

export default function VolunteerTermsPage() {
  return (
    <InnerShell>
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              { label: "Volunteer", href: "/volunteer" },
              { label: "Terms" },
            ]}
          />
        }
        kicker={<Kicker>Volunteer programme</Kicker>}
        title={{ en: "Terms & conditions", hi: "Terms & conditions" }}
        lede={
          <>
            Last updated: <strong>27 May 2026</strong>. By signing up you
            confirm you have read and agreed to these terms.
          </>
        }
        actions={
          <Actions>
            <Button href="/volunteer/signup" variant="text" icon="back" iconEnd={null}>
              Back to signup
            </Button>
          </Actions>
        }
      />
      <section className="bmi-sec tight" style={{ paddingTop: 0 }}>
        <div className="bmi-wrap">
          <ProseDoc toc={TOC} tocTitle="On this page" lang="en">
      {/* Full English text */}
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

        <p className="bmi-fine" style={{ marginTop: 40 }}>
          BadaMangal, Lucknow, India. Version <strong>{TERMS_VERSION}</strong>
        </p>
          </ProseDoc>
          <div className="bmi-sub">
            <Actions>
              <Button href="/volunteer/signup" icon="back" iconEnd={null}>
                Back to signup
              </Button>
              <Button href="/volunteer" variant="text">
                About the volunteer programme
              </Button>
            </Actions>
          </div>
        </div>
      </section>
    </InnerShell>
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
    <section>
      <h2 id={`terms-${number}`}>
        <span className="tabular-nums" style={{ color: "var(--saffron-ink)", marginRight: 6 }}>
          {number}.
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
