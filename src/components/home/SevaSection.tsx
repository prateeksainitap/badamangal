import Image from "next/image";
import { T } from "@/components/T";
import { HOME_ART } from "@/content/home-art";
import LocaleLink from "./LocaleLink";
import SupportPanel from "./SupportPanel";

/** The "Help keep BadaMangal running" platform donation. Off since 1 Nov 2026. */
const SHOW_PLATFORM_DONATIONS = false;
import Head from "./Head";

const ARROW = (
  <svg viewBox="0 0 24 24" className="ic" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** 8 · Seva (comp B): three paths, one section. */
export default function SevaSection() {
  return (
    <section className="sec seva wash" id="seva" aria-labelledby="seva-h">
      <div className="wrap seva-grid">
        <figure className="seva-fig">
          <div className="seva-art" data-rv="unveil">
            <Image
              src={HOME_ART.sevaHands.src}
              alt="Painted hands serving puri, chhole and sharbat at a bhandara"
              fill
              sizes="(min-width: 1000px) 480px, 92vw"
            />
          </div>
          <figcaption data-rv>
            <T en="Hands that serve." hi={<span lang="hi">कोई भूखा न जाए</span>} />
          </figcaption>
        </figure>
        <div>
          <p className="kick" data-rv>
            <T en="Seva" hi={<span className="hi">सेवा</span>} />
          </p>
          <Head en="Three ways to serve" hi="सेवा के तीन रास्ते" />
          <p className="h2-en" id="seva-h" data-rv>
            <T en="No one leaves hungry. Be part of the next Bada Mangal." hi="कोई भूखा न जाए। अगले बड़े मंगल का हिस्सा बनिए।" />
          </p>
          <ol className="paths">
            <li className="path" data-rv>
              <span className="w" aria-hidden>
                <T en="Organise" hi={<span lang="hi">आयोजन</span>} />
              </span>
              <h2 className="path-h" id="organise-promo-heading">
                <T en="Want to organise a bhandara? We'll handle the rest." hi="भंडारा आयोजित करना चाहते हैं? बाक़ी सब हम पर।" />
              </h2>
              <p>
                <T
                  en="Tent, catering, plates, prasad, transport. Pick a package or build your own."
                  hi="टेंट, कैटरिंग, थाली, प्रसाद, परिवहन। पैकेज चुनें या अपना बनाएँ।"
                />
              </p>
              <div className="path-links">
                <LocaleLink href="/organise-bhandara?from=banner" className="tlink" data-ga="organise_banner_cta">
                  <T en="Plan it with us" hi="हमारे साथ योजना बनाएँ" />
                  {ARROW}
                </LocaleLink>
                <LocaleLink href="/organise-bhandara?from=banner#packages" className="tlink" data-ga="organise_banner_packages">
                  <T en="See packages" hi="पैकेज देखें" />
                  {ARROW}
                </LocaleLink>
              </div>
            </li>
            <li className="path" data-rv>
              <span className="w" aria-hidden>
                <T en="Volunteer" hi={<span lang="hi">सेवा</span>} />
              </span>
              <h2 className="path-h" id="volunteer-promo-heading">
                <T en="Be a season volunteer" hi="इस सीज़न के स्वयंसेवक बनें" />
              </h2>
              <p>
                <T
                  en="Spot bhandaras in your area on Tuesdays: a photo, the time, the place. Pure seva."
                  hi="मंगलवार को अपने इलाक़े के भंडारे दर्ज करें: एक फ़ोटो, समय, जगह। केवल सेवा।"
                />
              </p>
              <div className="path-links">
                <a href="/volunteer#signup" className="tlink" data-ga="volunteer_strip_learn">
                  <T en="Join the seva" hi="सेवा में जुड़ें" />
                  {ARROW}
                </a>
              </div>
            </li>
            {/* Platform donations are off (founder, 1 Nov 2026) until
                BadaMangal's legal place inside Shubhkritya Technologies
                is settled. Flip SHOW_PLATFORM_DONATIONS to bring back. */}
            {SHOW_PLATFORM_DONATIONS ? (
            <li className="path" id="support" data-rv>
              <span className="w" aria-hidden>
                <T en="Support" hi={<span lang="hi">सहयोग</span>} />
              </span>
              <h2 className="path-h" id="support-heading">
                <T en="Help keep BadaMangal running" hi="BadaMangal को चलाए रखें" />
              </h2>
              <p>
                <T
                  en="Servers, maps and upkeep cost real money every month. Your support keeps the map open for all of Lucknow."
                  hi="सर्वर, नक़्शे और देखभाल में हर महीने असली ख़र्च आता है। आपका सहयोग पूरे लखनऊ के लिए नक़्शा खुला रखता है।"
                />
              </p>
              <div className="path-links">
                <SupportPanel />
              </div>
            </li>
            ) : null}
          </ol>
        </div>
      </div>
    </section>
  );
}
