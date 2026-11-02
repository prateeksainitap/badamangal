import Image from "next/image";
import { T } from "@/components/T";
import { HOME_ART } from "@/content/home-art";
import Head from "./Head";
import MaharajjiMedallion from "./MaharajjiMedallion";

/** 10 · Benediction (comp A), closing on the Gomti at dusk, which melts
 *  into the dark footer below. */
export default function BenedictionSection() {
  return (
    <section className="sec close" aria-labelledby="bless-h">
      <div className="wrap">
        <p className="invoc" lang="hi" data-rv>
          <span>
            ॥ जय श्री राम<i className="sep" aria-hidden />जय हनुमान ॥
          </span>
        </p>
        <MaharajjiMedallion />
        <Head
          as="h2"
          id="bless-h"
          className="bless-inv words"
          en="Hanuman ji's grace on every plate, and every hand that serves."
          hi="हर थाली पर, हर हाथ पर, हनुमान जी की कृपा"
        />
        <p className="bless-who" data-rv>
          <T en="Sitaram. See you next Jyeshtha." hi="सीताराम। अगले ज्येष्ठ फिर मिलेंगे।" />
        </p>
      </div>
      <figure className="dusk" aria-hidden>
        <div className="px" data-par>
          <Image src={HOME_ART.gomtiDusk.src} alt="" fill sizes="100vw" />
        </div>
      </figure>
    </section>
  );
}
