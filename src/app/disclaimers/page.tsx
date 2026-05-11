import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Disclaimers · BadaMangal",
  description:
    "What BadaMangal.com is, what it isn't, and what you should verify on the ground before relying on the information here.",
  alternates: { canonical: "/disclaimers" },
  robots: { index: true, follow: true },
};

export default function DisclaimersPage() {
  return (
    <LegalPage
      kicker="Disclaimers"
      title="Disclaimers"
      intro="BadaMangal is a community-run directory. The information on this site is offered in good faith but is not guaranteed. Please read the items below before relying on a listing, especially before traveling to one."
      lastUpdated="10 May 2026"
    >
      <h2>1. We are not affiliated with any temple or organiser</h2>
      <p>
        BadaMangal.com is an independent, community-run directory. We are not
        affiliated with, endorsed by, or speaking on behalf of any Hanuman
        temple, mandir trust, religious authority, neighbourhood committee,
        sevak group, or government body in Lucknow. Use of any temple name on
        this site is purely for identification of public landmarks; trademarks
        and naming rights remain with their respective owners.
      </p>

      <h2>2. Listings are user-submitted</h2>
      <p>
        Bhandara details, name, location, dates, timings, menu, capacity,
        organiser contact, are submitted by organisers themselves or, in the
        case of &ldquo;spots&rdquo;, by passers-by. We do our best to moderate
        and verify, but we cannot independently confirm every listing. Always
        check the latest details directly with the organiser before traveling,
        especially for evening or out-of-area bhandaras.
      </p>

      <h2>3. Timings and menus may change</h2>
      <p>
        Bhandaras are community-run events. Timings can shift, menus can be
        substituted at short notice, capacity can be reached early, and a
        bhandara can be cancelled altogether due to weather, civic
        restrictions, or organiser circumstances. The information shown on
        BadaMangal reflects what was submitted at the time of listing, it is
        not a real-time confirmation that a bhandara is open right now.
      </p>

      <h2>4. We are not a food-safety authority</h2>
      <p>
        We do not inspect kitchens, taste prasad, verify ingredients, or
        confirm hygiene practices at any listed bhandara. If you have food
        allergies, dietary restrictions (jain food, vegan options, gluten,
        nuts, dairy, onion-garlic), or pre-existing health conditions, ask the
        organiser directly before consuming. Children, elderly attendees, and
        anyone with compromised immunity should take extra care during peak
        hours.
      </p>

      <h2>5. Map locations are best-effort</h2>
      <p>
        Latitude/longitude coordinates and the map embedded on the site are
        provided to help you find a bhandara, not to navigate inside it. Pins
        may be slightly off, especially for &ldquo;neighbourhood&rdquo;
        listings that span multiple blocks (HAL Township, Damodar Nagar, Chowk
        and Nakkhas, etc.) or for new pandals that have not been geocoded
        precisely. Always cross-check with a landmark before driving, and
        prefer parking on the periphery during peak hours.
      </p>

      <h2>6. Devotional content is traditional</h2>
      <p>
        Texts published in our Resources section (Hanuman Chalisa, Hanuman
        Aarti, Sankat Mochan Hanuman Ashtak, Bajrang Baan and similar) are
        traditional, public-domain devotional works. Audio recordings linked
        on those pages are sourced from publicly available recordings; we do
        not claim authorship or ownership of either. If you are the rights
        holder of any specific recording and would like it removed, please
        write to <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
        and we&apos;ll act promptly.
      </p>

      <h2>7. News and external links</h2>
      <p>
        Where we link to news articles, social posts, blog coverage, or
        external maps, we do not control those pages and are not responsible
        for their content, accuracy, or how they may change after we link to
        them. Links open in new tabs to make this clear.
      </p>

      <h2>8. Visitor counts and live counters</h2>
      <p>
        The visitor count, &ldquo;X bhandaras spotted live&rdquo;, &ldquo;X of
        8 Tuesdays served&rdquo; and similar numbers shown on the homepage are
        derived from real database events but are presented as friendly
        approximations. They are intended as ambient context, not as audited
        metrics. Tuesdays-served is a calendar-derived number (it counts
        Bada Mangal dates that have already passed in the current season),
        not an attendance count.
      </p>

      <h2>9. Sponsored listings</h2>
      <p>
        Listings marked with a sponsor badge or saffron ring may be promoted
        to the top of relevant lists. Sponsorship affects visibility, but not
        editorial accuracy: a sponsored listing is held to the same content
        standards as any other and can be reported, corrected or removed in
        the same way.
      </p>

      <h2>10. Religious sentiment and respectful conduct</h2>
      <p>
        BadaMangal is a celebration of seva and bhakti. We expect contributors
        and attendees to treat every bhandara, organiser, volunteer and fellow
        attendee with respect, regardless of caste, community, sect or
        background. The site is moderated to remove content that violates this
        spirit (see <a href="/terms">Terms &amp; Conditions</a>). The acts
        of attending, photographing, or commenting on a bhandara are public
        acts; do not photograph or quote people who have not given their
        consent.
      </p>

      <h2>11. No guarantee of fitness for purpose</h2>
      <p>
        BadaMangal is provided <strong>&ldquo;as is&rdquo;</strong> and
        without warranty of any kind. We do not guarantee that the site will
        be available at any specific time, that any listing will match
        on-the-ground reality, or that the directory is exhaustive. Use the
        information at your own discretion.
      </p>

      <h2>12. Reporting problems</h2>
      <p>
        Spotted a wrong address, an outdated timing, a listing that
        misrepresents a bhandara, or content that violates these disclaimers?
        Tell us at <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
        or via the <a href="/contact">contact form</a>. We act on credible
        reports quickly, usually within a day during the season.
      </p>

      <h2>13. Related documents</h2>
      <p>
        These Disclaimers should be read together with our{" "}
        <a href="/terms">Terms &amp; Conditions</a> and{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalPage>
  );
}
