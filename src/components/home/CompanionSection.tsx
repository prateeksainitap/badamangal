import Image from "next/image";
import { T } from "@/components/T";
import { HOME_ART } from "@/content/home-art";
import LocaleLink from "./LocaleLink";
import Head from "./Head";

const PRAYERS = [
  { href: "/resources/bajrang-baan", en: "Bajrang Baan", hi: "बजरंग बाण" },
  { href: "/resources/aarti", en: "Aarti", hi: "आरती" },
  { href: "/resources/ashtak", en: "Hanuman Ashtak", hi: "हनुमान अष्टक" },
];

/** 6 · Companion (comp A): seated Hanuman ji and the Chalisa. */
export default function CompanionSection() {
  return (
    <section className="sec comp" id="companion" aria-labelledby="comp-h">
      <div className="wrap comp-grid">
        <div className="sitting" data-rv>
          <Image
            src={HOME_ART.hanumanSitting.src}
            alt="Hanuman ji seated, blessing with an open palm, gada at his side and a manuscript before him"
            fill
            sizes="(min-width: 1024px) 520px, 320px"
          />
        </div>
        <div className="comp-copy">
          <h2 className="kick" id="comp-h" data-rv>
            <T en="The Bada Mangal companion" hi={<span className="hi">बड़ा मंगल साथी</span>} />
          </h2>
          <Head en="Hanuman Chalisa" hi="हनुमान चालीसा" />
          <p className="h2-en" data-rv>
            <T en="Sit with Hanuman ji, wherever you are in Lucknow." hi="लखनऊ में जहाँ भी हों, हनुमान जी के साथ बैठिए।" />
          </p>
          {/* The Chalisa recording was label-owned and is taken down on the
              live site (main 4aa37f0, 31 Oct 2026), so no player here. */}
          <ul className="rpaths" data-rv>
            {PRAYERS.map((p) => (
              <li key={p.href}>
                <LocaleLink href={p.href}>
                  <b>
                    <T en={p.en} hi={p.hi} />
                  </b>
                </LocaleLink>
              </li>
            ))}
          </ul>
          <p className="comp-more" data-rv>
            <LocaleLink href="/resources/chalisa" className="tlink">
              <T en="Read the Chalisa" hi="चालीसा पढ़ें" />
            </LocaleLink>
            <LocaleLink href="/resources" className="tlink">
              <T en="All prayers" hi="सभी पाठ" />
              <svg viewBox="0 0 24 24" className="ic" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </LocaleLink>
          </p>
        </div>
      </div>
    </section>
  );
}
