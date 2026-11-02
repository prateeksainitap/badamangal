import Image from "next/image";
import { T } from "@/components/T";
import { HOME_PRESS, HOME_VOICES, REDDIT_STATS } from "@/content/testimonials";
import Head from "./Head";

/** Source label shown alone, so it starts with a capital ("On WhatsApp"). */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** 7 · Voices (comp A): on air, in print, in the chats. Quotes show
 *  where they came from, never who said them (Founder, 2 Nov 2026). */
export default function VoicesSection() {
  const f = HOME_VOICES.feature;
  return (
    <section className="sec voices" id="voices" aria-labelledby="testimonials-heading">
      <div className="wrap">
        <div className="sec-head c">
          <p className="kick" data-rv>
            <T en="On air, in print, in the chats" hi={<span className="hi">रेडियो पर, अख़बार में, चैट में</span>} />
          </p>
          <Head as="h2" id="testimonials-heading" en="Lucknow is talking." hi="लखनऊ बोल रहा है" />
        </div>
        <div className="press">
          <div className="press-g">
            <span>
              <T en="On air" hi="रेडियो पर" />
            </span>
            {HOME_PRESS.radio.map((p) => (
              <Image
                key={p.name}
                src={p.src}
                alt={p.name}
                width={p.width}
                height={p.height}
                style={{ ["--lh" as string]: `${p.h}px` }}
                sizes="140px"
              />
            ))}
          </div>
          <span className="sep" aria-hidden />
          <div className="press-g">
            <span>
              <T en="In print" hi="अख़बार में" />
            </span>
            {HOME_PRESS.print.map((p) => (
              <Image
                key={p.name}
                src={p.src}
                alt={p.name}
                width={p.width}
                height={p.height}
                style={{ ["--lh" as string]: `${p.h}px` }}
                sizes="140px"
              />
            ))}
          </div>
        </div>
        <div className="voices-grid">
          <figure className="feature" data-rv>
            <svg className="qmark" viewBox="0 0 44 34" aria-hidden>
              <path d="M0 34V20C0 9 6 2 17 0l2 5c-6 2-9 6-9 12h8v17H0zm25 0V20c0-11 6-18 17-20l2 5c-6 2-9 6-9 12h8v17H25z" fill="#E9C77A" />
            </svg>
            <blockquote style={{ margin: 0 }}>
              <q>{f.quote}</q>
            </blockquote>
            <figcaption className="src">
              <small>
                <T en={cap(f.sourceEn)} hi={f.sourceHi} />
              </small>
            </figcaption>
            <div className="stat10k">
              <b>{REDDIT_STATS.views}</b>
              <span>
                <T en={`views on our ${REDDIT_STATS.community} post`} hi={`${REDDIT_STATS.community} पोस्ट पर व्यूज़`} />
              </span>
            </div>
          </figure>
          <ul className="qlist">
            {HOME_VOICES.list.map((q, i) => (
              <li key={i} data-rv style={{ ["--rd" as string]: `${i * 0.08}s` }}>
                <p>&ldquo;{q.quote}&rdquo;</p>
                <div className="src">
                  <small>
                    <T en={cap(q.sourceEn)} hi={q.sourceHi} />
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
