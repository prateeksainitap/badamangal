/**
 * /organise-bhandara, full-service organising landing page.
 *
 * Lead-capture surface for organisers who don't want to DIY a bhandara
 * and would rather have the BadaMangal team arrange logistics for
 * them (tent, catering, plates, transport, etc.). Three published
 * tiers (Small / Medium / Large) + a custom-request path; both feed
 * the same OrganiseRequest table + admin email.
 *
 * Server-rendered shell so the SEO metadata, hero copy, and packages
 * grid all sit in static HTML. The interactive form lives in
 * <OrganiseBhandaraView /> (client) so the React state can be
 * scoped tightly and the LocaleProvider context flips Hindi labels
 * without a server refresh.
 *
 * ISR with 5-minute revalidate, same cadence as the rest of the site;
 * the page is essentially static (no per-visit data), the revalidate
 * is just so an admin copy tweak picks up quickly without a deploy.
 */
import type { Metadata } from "next";
import OrganiseBhandaraView from "@/components/OrganiseBhandaraView";
import { localised, SITE_URL } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title:
    "Organise a Bada Mangal bhandara, full-service tent + catering + logistics, Lucknow",
  description:
    "Want to host a Bada Mangal bhandara but don't have the bandwidth to arrange tent, catering, prasad and crowd flow yourself? The BadaMangal team handles every piece end-to-end, you pick a package or build a custom one and we do the rest. Free quote, callback within a day.",
  alternates: localised("/organise-bhandara"),
  openGraph: {
    title: "Organise a Bada Mangal bhandara · BadaMangal Lucknow",
    description:
      "Tent, catering, plates, transport, prasad. Pick a package or build your own, we handle the logistics end-to-end. Free quote.",
    url: `${SITE_URL}/organise-bhandara`,
    type: "website",
    locale: "hi_IN",
    alternateLocale: "en_IN",
  },
};

export default function OrganiseBhandaraPage() {
  return <OrganiseBhandaraView />;
}
