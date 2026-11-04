"use client";

import Link from "next/link";
import { useState } from "react";
import { FAQ_ITEMS } from "@/content/faq";
import { useLocaleFromContext } from "@/lib/locale-context";
import Head from "./Head";

/**
 * 9 · FAQ, restyled. The questions and answers are exactly the text in
 * src/content/faq.ts (and the FAQPage JSON-LD in src/lib/seo.ts), all of
 * it in the server HTML; collapsed answers are only visually folded.
 * Keeps #faq, every item id, and the faq-q-* / faq-a-* ids.
 */
export default function HomeFaqV2() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

  return (
    <section className="sec faq" id="faq" aria-labelledby="homepage-faq-heading">
      <div className="wrap">
        <div className="sec-head c">
          <p className="kick" data-rv>
            {isHi ? <span className="hi">आपके सवाल</span> : "Frequently asked"}
          </p>
          <Head as="h2" id="homepage-faq-heading" en="Common questions about Bada Mangal" hi="पूछिए, बताते हैं" />
        </div>
        <ul className="faq-list">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            const q = isHi ? item.questionHi : item.questionEn;
            const a = isHi ? item.answerHi : item.answerEn;
            return (
              <li key={item.id} id={item.id}>
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${item.id}`}
                    className="faq-q"
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${item.id}`}
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                  >
                    <span>{q}</span>
                    <span className="pm" aria-hidden>
                      <svg viewBox="0 0 24 24" className="ic" width="16" height="16">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-a-${item.id}`}
                  role="region"
                  aria-labelledby={`faq-q-${item.id}`}
                  className={`faq-a${isOpen ? " open" : ""}`}
                >
                  <div>
                    <div className="in">
                      {a}
                      {item.relatedLinks?.length ? (
                        <span className="rel">
                          {item.relatedLinks.map((l) => (
                            <Link key={l.href} href={l.href} className="tlink" tabIndex={isOpen ? 0 : -1} prefetch={false} data-ga="home_faq_link">
                              {isHi ? l.labelHi : l.labelEn}
                              <svg viewBox="0 0 24 24" className="ic" aria-hidden>
                                <path d="M9 6l6 6-6 6" />
                              </svg>
                            </Link>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="faq-all">
          <Link href={isHi ? "/faq" : "/faq?lang=en"} className="b b-s" prefetch={false} data-ga="home_faq_all">
            {isHi ? "सभी सवाल देखें" : "View all questions"}
          </Link>
        </div>
      </div>
    </section>
  );
}
