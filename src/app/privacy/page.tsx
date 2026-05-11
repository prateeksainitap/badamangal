import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy · BadaMangal",
  description:
    "What BadaMangal.com collects, why we collect it, where it lives, and the rights you have over your data.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Privacy Policy"
      title="Privacy Policy"
      intro="We collect the smallest amount of data that lets BadaMangal stay useful and safe to use. This page explains exactly what we collect, why, where it sits, and how to ask us to delete it."
      lastUpdated="10 May 2026"
    >
      <h2>1. The short version</h2>
      <ul>
        <li>We do not sell your data, ever.</li>
        <li>We do not run third-party advertising trackers.</li>
        <li>Phone numbers are stored only as one-way salted hashes, we cannot read them back.</li>
        <li>Photos you upload are converted to WebP, EXIF stripped, and stored on Supabase Storage.</li>
        <li>You can ask us to delete your contributions at any time by emailing namaste@badamangal.com.</li>
      </ul>

      <h2>2. What we collect</h2>
      <h3>2.1 When you list a bhandara</h3>
      <ul>
        <li>The bhandara details you submit (name, address, area, dates, menu, capacity, organiser name).</li>
        <li>An organiser phone number, used solely for OTP verification at submission time and to let the BadaMangal team reach out privately if a listing needs clarification. The raw number is never shown publicly on the site; only a salted, one-way hash of it is kept in our database for verification lookups.</li>
        <li>Optional UPI ID, used to receive sponsorship contributions. Not displayed publicly unless you explicitly opt in to a public sponsorship card.</li>
        <li>Optional photograph(s) of the bhandara.</li>
      </ul>

      <h3>2.2 When you spot a bhandara</h3>
      <ul>
        <li>The location pin you drop or share via your browser&apos;s geolocation.</li>
        <li>An optional reporter name (first name only is fine), optional caption, and optional photo.</li>
        <li>If you choose to verify by phone, a salted hash of your number; the raw number is never stored.</li>
      </ul>

      <h3>2.3 When you post in the live feed</h3>
      <ul>
        <li>Your chosen display name and optional photo.</li>
        <li>The text of your post.</li>
        <li>A salted hash of your phone number (used for moderation and rate-limiting).</li>
      </ul>

      <h3>2.4 When you fill the contact form</h3>
      <ul>
        <li>Your name, email, optional phone, optional subject, and the message you send us.</li>
      </ul>

      <h3>2.5 Automatic technical data (every visit)</h3>
      <ul>
        <li>A salted hash of your IP address (used to rate-limit submissions and detect abuse). The raw IP is never stored.</li>
        <li>The first ~240 characters of your browser&apos;s user-agent string (used to debug submission issues).</li>
        <li>Standard server logs handled by our hosting provider; these are short-lived and used for operational purposes.</li>
      </ul>

      <h2>3. Cookies and local storage</h2>
      <p>BadaMangal uses very few client-side storage items:</p>
      <ul>
        <li>
          <strong>Language preference</strong> (cookie), remembers whether you
          chose Hindi or English so we can show the right copy on your next
          visit. No tracking value.
        </li>
        <li>
          <strong>Phone-verification token</strong> (cookie, signed), set after
          you complete OTP verification on the listing or post flows so you don&apos;t
          have to re-verify on every submission. Contains only the hash, an
          expiry, and a signature; no raw phone number.
        </li>
        <li>
          <strong>Session-storage flags</strong> (browser-only, never sent to us)
         , small UI state like &ldquo;you dismissed the activity ticker&rdquo;
          so it doesn&apos;t come back during the same browser session.
        </li>
      </ul>

      <h2>4. Analytics</h2>
      <p>
        We use Google Analytics 4 to understand how the site is used in
        aggregate (page views, country, device class, which CTAs are clicked).
        GA4 sets its own first-party cookies and processes data per Google&apos;s
        privacy terms. We do not enable advertising features, remarketing, or
        Google Signals on this property. If you would prefer not to be counted,
        any modern browser&apos;s tracking-protection or an ad-blocker will
        prevent the GA4 script from loading.
      </p>

      <h2>5. Where your data lives</h2>
      <ul>
        <li>
          <strong>Database</strong>, Supabase (managed Postgres, currently in
          the Asia-Pacific Singapore region).
        </li>
        <li>
          <strong>Photo storage</strong>, Supabase Storage in the same region.
          Photos are served via a public CDN URL because the listings page is
          public.
        </li>
        <li>
          <strong>Hosting</strong>, Netlify, edge-cached globally; only
          static assets and pre-rendered pages travel through their network.
          Server-rendered pages and API routes execute as serverless functions
          in the closest available region.
        </li>
        <li>
          <strong>Email</strong>, Contact-form messages are stored in our
          Supabase database; we may also receive a copy by email at
          namaste@badamangal.com.
        </li>
      </ul>

      <h2>6. How long we keep things</h2>
      <ul>
        <li>
          <strong>Bhandara listings</strong>, kept for the lifetime of the
          season they refer to, plus one year for archival reference. After
          that, they are either anonymised (organiser name + phone hash
          removed) or deleted.
        </li>
        <li>
          <strong>Spots</strong>, auto-expire after 8 hours from a public
          surface. The underlying record is kept for up to 30 days for abuse
          analysis, then deleted.
        </li>
        <li>
          <strong>Posts in the live feed</strong>, kept while moderation
          status is &ldquo;approved&rdquo;; rejected or shadowed posts are
          purged after 90 days.
        </li>
        <li>
          <strong>Contact-form messages</strong>, kept for 12 months from
          the date sent so we can refer back during a long conversation.
        </li>
        <li>
          <strong>Phone-verification cookies</strong>, expire after 30 days.
        </li>
      </ul>

      <h2>7. Your rights</h2>
      <p>You may, at any time, ask us to:</p>
      <ul>
        <li>Show you what data of yours we hold.</li>
        <li>Correct anything that is wrong.</li>
        <li>Delete a specific listing, spot, post, or contact-form message you submitted.</li>
        <li>Delete every record we associate with a particular phone-number hash you can prove control of (e.g. by completing an OTP from that number).</li>
        <li>Stop receiving any further email from us.</li>
      </ul>
      <p>
        Email <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
        with the subject line &ldquo;Privacy request&rdquo; and tell us what
        you&apos;d like done. We aim to respond within 14 days.
      </p>

      <h2>8. Children</h2>
      <p>
        BadaMangal is not directed at users under the age of 18 and we do not
        knowingly collect data from minors. If you believe a child has
        submitted information to us, please contact us so we can remove it.
      </p>

      <h2>9. Security</h2>
      <p>
        We use industry-standard precautions: TLS in transit, salted hashes for
        identifiers, server-side validation on every submission, and per-IP
        rate limits on write APIs. No system is perfectly secure; if you spot a
        vulnerability, please write to{" "}
        <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
        before disclosing it publicly so we can fix it.
      </p>

      <h2>10. International transfers</h2>
      <p>
        Our hosting providers may move data across borders for operational
        reasons (caching, backups, fail-over). All such transfers are governed
        by the providers&apos; standard contractual clauses, which we accept on
        your behalf when you contribute.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy as the site evolves. The
        &ldquo;Last updated&rdquo; date at the top of the page reflects the
        most recent change. Material changes will be flagged on the homepage
        for at least seven days.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about your privacy on BadaMangal? Reach the team at{" "}
        <a href="mailto:namaste@badamangal.com">namaste@badamangal.com</a>{" "}
        or via the <a href="/contact">contact form</a>.
      </p>
    </LegalPage>
  );
}
