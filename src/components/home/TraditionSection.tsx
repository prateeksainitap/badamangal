import Image from "next/image";
import { T } from "@/components/T";
import { GADA_PIN, HOME_ART } from "@/content/home-art";
import Head from "./Head";

const TEMPLES = [
  { art: HOME_ART.templePuranaAliganj, en: "Purana Hanuman Mandir", hi: "पुराना हनुमान मंदिर", where: "Aliganj", whereHi: "अलीगंज", pos: "50% 40%" },
  { art: HOME_ART.templeHazratganj, en: "Dakshinmukhi Hanuman Mandir", hi: "दक्षिणमुखी हनुमान मंदिर", where: "Hazratganj", whereHi: "हज़रतगंज", pos: "50% 55%" },
  { art: HOME_ART.templeNayaAliganj, en: "Naya Hanuman Mandir", hi: "नया हनुमान मंदिर", where: "Aliganj", whereHi: "अलीगंज", pos: "50% 45%" },
];

const ARROW = (
  <svg viewBox="0 0 24 24" className="ic" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/**
 * 5 · The tradition (comp C) with comp A's three arched temples.
 * The painted lane fades into the cream and the type rises out of it.
 */
export default function TraditionSection() {
  return (
    <section className="sec trad" id="tradition" aria-labelledby="trad-h">
      <figure className="pano" data-rv="unveil">
        <div className="px" data-par>
          <Image
            src={HOME_ART.oldLucknowBand.src}
            alt="Painted old Lucknow lane: a bhandara under a saffron canopy outside a Hanuman mandir"
            fill
            sizes="100vw"
          />
        </div>
      </figure>
      <div className="wrap trad-grid">
        <div>
          <p className="kick" data-rv>
            <T en="The tradition" hi={<span className="hi">परंपरा</span>} />
          </p>
          <div className="yrs" data-rv>
            <b>400</b>
            <T en={<span>years</span>} hi={<span lang="hi">साल</span>} />
          </div>
          <Head en="One city. One kitchen." hi="पूरा शहर, एक रसोई" />
          <h2 className="h2-en" id="trad-h" data-rv>
            <T
              en="A 400-year-old Lucknow tradition, rooted in Hanuman ji."
              hi="हनुमान जी में रची, लखनऊ की 400 साल पुरानी परंपरा।"
            />
          </h2>
          <p className="lede" data-rv>
            <T
              en="Every Tuesday of Jyeshtha, Lucknow becomes one giant kitchen. Families, shopkeepers, offices and temple samitis lay out pattals on the pavement, and anyone who walks past is fed. Koi bhookha na jaaye."
              hi="ज्येष्ठ के हर मंगलवार लखनऊ एक बड़ी रसोई बन जाता है। परिवार, दुकानदार, दफ़्तर और मंदिर समितियाँ फ़ुटपाथ पर पत्तल बिछाते हैं, और जो भी गुज़रे, प्रसाद पाता है। कोई भूखा न जाए।"
            />
          </p>
        </div>
        <div data-rv>
          <figure className="teach">
            <span className="plate">
              <Image src={HOME_ART.pattal.src} alt="A gold-rimmed pattal with a single marigold" fill sizes="180px" />
            </span>
            <div>
              <q>
                <T en="Feed the hungry." hi={<span lang="hi">भूखे को खाना खिलाओ</span>} />
              </q>
              <cite>
                <T en="Neem Karoli Baba" hi="नीम करोली बाबा" />
              </cite>
            </div>
          </figure>
          <ul className="trad-pts">
            <li>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GADA_PIN} alt="" width={24} height={24} />
              <span>
                <T
                  en={<><b>Every Tuesday of Jyeshtha.</b> Mangal is Hanuman ji&apos;s day, and in Jyeshtha it becomes Bada Mangal.</>}
                  hi={<><b>ज्येष्ठ का हर मंगलवार।</b> मंगल हनुमान जी का दिन है, और ज्येष्ठ में यह बड़ा मंगल बन जाता है।</>}
                />
              </span>
            </li>
            <li>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GADA_PIN} alt="" width={24} height={24} />
              <span>
                <T
                  en={<><b>Every corner of the city.</b> Temple steps, chauraha, office gates and gali corners.</>}
                  hi={<><b>शहर का हर कोना।</b> मंदिर की सीढ़ियाँ, चौराहे, दफ़्तरों के गेट और गली के मोड़।</>}
                />
              </span>
            </li>
            <li>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GADA_PIN} alt="" width={24} height={24} />
              <span>
                <T
                  en={<><b>Every plate, seva.</b> Puri sabji, chhole chawal, sharbat. No one asks who you are.</>}
                  hi={<><b>हर थाली, सेवा।</b> पूरी सब्ज़ी, छोले चावल, शरबत। कोई नहीं पूछता आप कौन हैं।</>}
                />
              </span>
            </li>
          </ul>
        </div>
      </div>
      <div className="wrap">
        <ul className="mandirs">
          {TEMPLES.map((m, i) => (
            <li className="mandir" key={m.en} data-rv style={{ ["--rd" as string]: `${i * 0.1}s` }}>
              <a href="/resources/temples" data-ga="home_temples_link">
                <span className="arch">
                  <Image
                    src={m.art.src}
                    alt={`Painted ${m.en}, ${m.where}`}
                    fill
                    sizes="(min-width: 1024px) 380px, 64vw"
                    style={{ objectPosition: m.pos }}
                  />
                </span>
                <b>
                  <T en={m.en} hi={m.hi} />
                </b>
                <small>
                  <T en={m.where} hi={m.whereHi} />
                </small>
              </a>
            </li>
          ))}
        </ul>
        <div className="trad-more" data-rv>
          <a className="tlink" href="/history" data-ga="home_history_link">
            <T en="Read the 400-year story" hi="400 साल की पूरी कहानी पढ़ें" />
            {ARROW}
          </a>
        </div>
      </div>
    </section>
  );
}
