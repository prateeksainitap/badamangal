import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions · BadaMangal",
  description:
    "The terms that govern your use of BadaMangal.com, listing, spotting, browsing, and contributing to Lucknow's Bada Mangal directory.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Terms & Conditions"
      title="Terms of Use"
      intro="By using BadaMangal.com you agree to the terms below. They are written in plain English so you can actually read them, but they are legally binding once you continue past this page."
      lastUpdated="10 May 2026"
    >
      <h2>1. Who we are</h2>
      <p>
        BadaMangal.com (&ldquo;BadaMangal&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a community-run
        directory of Bada Mangal bhandaras in Lucknow, India, operated as a free
        public-information service. We are not a temple, a religious authority,
        a travel agency, or a food-service provider. We index information
        contributed by organisers and the public so that anyone in the city can
        find a bhandara to attend, sponsor, or report.
      </p>

      <h2>2. Acceptance of these terms</h2>
      <p>
        By accessing the site, listing a bhandara, spotting one, posting in the
        live feed, sending us a contact message, or otherwise interacting with
        BadaMangal you agree to these Terms, our{" "}
        <a href="/privacy">Privacy Policy</a>, and our{" "}
        <a href="/disclaimers">Disclaimers</a>. If you do not agree with any
        part of them, please stop using the site.
      </p>

      <h2>3. Eligibility</h2>
      <p>
        You must be at least 18 years old to submit a listing, photograph,
        comment, or any other contribution. By contributing you confirm that
        you meet this age requirement and that you have the right to publish
        whatever you submit.
      </p>

      <h2>4. Listings, spots, and posts (user-generated content)</h2>
      <p>
        BadaMangal lets you contribute three kinds of content:
      </p>
      <ul>
        <li>
          <strong>Listings</strong>, full bhandara entries, submitted by
          organisers, including the venue, schedule, menu, capacity, organiser
          name and contact, and photographs.
        </li>
        <li>
          <strong>Spots</strong>, quick &ldquo;I just walked past this
          bhandara&rdquo; reports, with a location pin and an optional photo
          and caption.
        </li>
        <li>
          <strong>Posts</strong>, short text and photo updates left under a
          listed bhandara&apos;s page or in the live feed.
        </li>
      </ul>
      <p>
        You retain ownership of everything you submit. By submitting it you
        grant BadaMangal a worldwide, royalty-free, non-exclusive, perpetual
        licence to host, display, reformat, translate, moderate, and
        redistribute that content as part of the BadaMangal service and in any
        public coverage of it (press, social, search snippets). You may ask us
        to take down your contribution at any time by writing to{" "}
        <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>;
        once removed, the licence ends.
      </p>

      <h2>5. What you must not submit</h2>
      <ul>
        <li>
          Photos or text that are not yours and that you do not have permission
          to publish.
        </li>
        <li>
          Photographs of identifiable people without their consent, or any
          photograph of a child without their parent&apos;s consent.
        </li>
        <li>
          False, misleading, or commercially deceptive information about a
          bhandara, fake locations, fake organiser names, inflated plate
          counts, made-up addresses.
        </li>
        <li>
          Hateful, casteist, communal, abusive, or harassing content; content
          that incites violence; content that targets any individual,
          community, organisation or temple.
        </li>
        <li>
          Spam, unrelated promotion, paid links, or any attempt to use a
          listing as a vehicle for unrelated marketing.
        </li>
        <li>
          Content that infringes anyone&apos;s intellectual-property,
          publicity, or privacy rights.
        </li>
        <li>
          Personal information of third parties (their phone numbers, home
          addresses, photographs taken without consent, etc.).
        </li>
      </ul>

      <h2>6. Listing organisers, your responsibilities</h2>
      <p>
        If you list a bhandara on BadaMangal, you are publicly representing
        yourself as the organiser of that bhandara. By submitting a listing
        you confirm that:
      </p>
      <ul>
        <li>You are authorised by the organising group to publish its details.</li>
        <li>The address, dates, timings, menu, and capacity are accurate at the time of submission.</li>
        <li>The contact phone number you provide is yours, you have access to it, and we may verify it via OTP.</li>
        <li>You will keep the listing reasonably up to date if details change before the relevant Tuesday.</li>
        <li>You will respond, within reason, to attendees who reach you via the contact information you provide.</li>
      </ul>

      <h2>7. Moderation</h2>
      <p>
        BadaMangal reserves the right, but accepts no obligation, to review,
        edit, refuse, blur, anonymise, or remove any contribution at any time
        for any reason, including (without limit) suspected violation of
        these Terms, complaints from third parties, requests from temple
        authorities or civic bodies, or our own editorial judgement. Decisions
        are made by humans assisted by automated tools; both make mistakes.
      </p>

      <h2>8. Verification badges</h2>
      <p>
        A &ldquo;Verified&rdquo; badge means the BadaMangal team has spoken to
        the listed organiser by phone and confirmed the basic details. It is
        not a guarantee of food safety, hygiene, capacity, or the conduct of
        the bhandara on the day. The absence of a badge does not imply that a
        listing is unverified or unsafe, it usually just means the team
        hasn&apos;t reached the organiser yet.
      </p>

      <h2>9. Sponsored listings</h2>
      <p>
        Sponsored listings, when present, are visually marked with a sponsor
        ring or badge. Sponsorship affects ordering and prominence on some
        surfaces but does not change the editorial accuracy expectations
        above. We will never accept sponsorship in exchange for hiding
        legitimate complaints or competing bhandaras.
      </p>

      <h2>10. Intellectual property</h2>
      <p>
        The BadaMangal name, brand mark, illustrations, written copy, code,
        and overall design are © BadaMangal and its contributors. All rights
        reserved. You may share screenshots and link to pages freely; you may
        not republish substantial portions of the editorial copy or
        illustrations without prior written permission.
      </p>
      <p>
        Devotional texts (Chalisa, Aarti, Hanuman Ashtak, Bajrang Baan, etc.)
        published on BadaMangal are traditional public-domain works.
      </p>

      <h2>11. Third-party links</h2>
      <p>
        BadaMangal links to Google Maps, WhatsApp, news sources, and other
        third-party services. We do not control these services and are not
        responsible for their content, terms, or behaviour. Following a link
        means you accept the third party&apos;s own terms.
      </p>

      <h2>12. Disclaimers and limitation of liability</h2>
      <p>
        BadaMangal is provided <strong>&ldquo;as is&rdquo;</strong>, without
        warranties of any kind. We don&apos;t guarantee that any bhandara
        listed will run on the day or time advertised, that the food described
        will be served, or that travel directions will lead to the right
        place. Bhandaras are organised independently by community groups. See
        our <a href="/disclaimers">Disclaimers page</a> for the full list.
      </p>
      <p>
        To the maximum extent permitted by law, BadaMangal and its operators
        shall not be liable for any indirect, incidental, special,
        consequential, or punitive damages arising from your use of, or
        inability to use, the site, including (without limit) any loss
        related to attending, missing, or being affected by a bhandara listed
        here.
      </p>

      <h2>13. Indemnity</h2>
      <p>
        You agree to indemnify and hold BadaMangal harmless from any claim,
        loss, or expense arising from content you submit, your violation of
        these Terms, or your violation of any third party&apos;s rights.
      </p>

      <h2>14. Termination</h2>
      <p>
        We may suspend or terminate your access to specific features (e.g.
        ability to post, list, or spot) at any time and without notice if we
        believe you have violated these Terms or applicable law. Where
        practical we will tell you why.
      </p>

      <h2>15. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. The courts of Lucknow,
        Uttar Pradesh, shall have exclusive jurisdiction over any dispute
        arising out of or relating to your use of BadaMangal.
      </p>

      <h2>16. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. We will change the
        &ldquo;Last updated&rdquo; date at the top of this page when we do.
        Continued use of the site after a change means you accept the
        revised Terms.
      </p>

      <h2>17. Contact</h2>
      <p>
        Questions about these Terms? Write to us at{" "}
        <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
        or via the <a href="/contact">contact form</a>.
      </p>
    </LegalPage>
  );
}
