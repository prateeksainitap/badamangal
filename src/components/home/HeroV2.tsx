import Image from "next/image";
import { T } from "@/components/T";
import { GADA_PIN, HOME_ART } from "@/content/home-art";
import type { HeroPrint } from "@/lib/home-community";
import HeroChantCta from "./HeroChantCta";
import LocaleLink from "./LocaleLink";

const NAME_TONES = ["n1", "n2", "n3", "n4"] as const;
const SLOTS = ["s1", "s2", "s3", "s4"] as const;

/**
 * 1 · Hero (comp C, "Mohalla"). The only h1 on the page. Hanuman ji is
 * never covered and never cropped at the face or gada; the community
 * prints float around him, each one a REAL recent spot.
 */
export default function HeroV2({
  prints,
  faces,
  communityTotal,
  totalOnMap,
  isPastSeason,
}: {
  prints: HeroPrint[];
  faces: string[];
  communityTotal: number;
  totalOnMap: number;
  isPastSeason: boolean;
}) {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  return (
    <section className="hero" aria-labelledby="bmh-h1">
      <div className="wrap hero-grid">
        <div className="h-top">
          <p className="invoc" lang="hi">
            <span>
              ॥ जय श्री राम<i className="sep" aria-hidden />जय हनुमान ॥
            </span>
          </p>
          <h1 className="h1" id="bmh-h1" lang="hi">
            <span>जहाँ भक्ति,</span> <span>वहाँ भंडारा</span>
          </h1>
        </div>

        <div className="h-stage">
          <div className="hanu">
            <div className="halo" aria-hidden>
              <div className="ring">
                <Image
                  src={HOME_ART.ramNaamHalo.src}
                  alt=""
                  width={HOME_ART.ramNaamHalo.width}
                  height={HOME_ART.ramNaamHalo.height}
                  sizes="(min-width: 1024px) 640px, 360px"
                  priority
                  unoptimized
                />
              </div>
            </div>
            <div className="murti">
              <Image
                src={HOME_ART.hanumanStanding.src}
                alt="Hanuman ji, painted, holding his gada, with a saffron lotus aura"
                fill
                priority
                fetchPriority="high"
                sizes="(min-width: 1024px) 420px, (min-width: 768px) 340px, 230px"
              />
            </div>
          </div>
        </div>

        {prints.length > 0 ? (
          <div className="h-snaps" aria-label={isPastSeason ? "Spotted by the community, Bada Mangal 2026" : "Spotted by the community"}>
            {prints.map((p, i) => (
              <div key={p.id} className={`snap ${SLOTS[i]}`}>
                <LocaleLink
                  href={p.href}
                  className="print"
                  aria-label={`${p.name ?? "A spotter"}: ${p.caption}${p.locality ? `, ${p.locality}` : ""}`}
                >
                  <span className="ph">
                    <Image
                      src={p.photoUrl}
                      alt={p.locality ? `A bhandara spotted in ${p.locality}` : "A bhandara spotted in Lucknow"}
                      fill
                      sizes="150px"
                    />
                  </span>
                  <span className="cap">
                    {p.locality ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={GADA_PIN} alt="" width={14} height={14} />
                        <span className="cap-t">{p.locality}</span>
                      </>
                    ) : null}
                  </span>
                </LocaleLink>
                <div className={`bub ${i === 2 || i === 3 ? "tr" : "tl"}`} aria-hidden>
                  <b className={NAME_TONES[i % NAME_TONES.length]}>
                    {p.name ?? <T en="Spotter" hi="स्पॉटर" />}
                  </b>
                  <span>{p.caption}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="h-bot">
          <p className="lede">
            <T
              en="Every Bada Mangal bhandara in Lucknow, on one map, spotted by the mohalla."
              hi="लखनऊ का हर बड़ा मंगल भंडारा, एक नक़्शे पर, मोहल्ले की नज़र से।"
            />
          </p>
          <div className="ctas">
            <HeroChantCta
              label={
                isPastSeason ? (
                  <T en="See the 2026 map" hi="2026 का नक़्शा देखें" />
                ) : (
                  <T en="Find a bhandara" hi="भंडारा खोजें" />
                )
              }
            />
            <LocaleLink
              href="/list-bhandara"
              className="b b-s"
              data-ga="cta_hero_list_bhandara"
              data-ga-source="hero"
            >
              <T en="Add a bhandara" hi="भंडारा जोड़ें" />
            </LocaleLink>
          </div>
          {communityTotal > 0 || totalOnMap > 0 ? (
            <a className="h-meta" href="#live-chat" data-ga="hero_meta_to_chat">
              {faces.length ? (
                <span className="faces" aria-hidden>
                  {faces.slice(0, 3).map((f) => (
                    <span key={f}>
                      <Image src={f} alt="" fill sizes="32px" />
                    </span>
                  ))}
                </span>
              ) : null}
              <span>
                {communityTotal > 0 ? (
                  <>
                    <T
                      en={<><b>{fmt(communityTotal)} neighbours</b> on WhatsApp</>}
                      hi={<><b>{fmt(communityTotal)} पड़ोसी</b> WhatsApp पर</>}
                    />
                    <br />
                  </>
                ) : null}
                <T
                  en={isPastSeason ? `${fmt(totalOnMap)} bhandaras tracked in 2026` : `${fmt(totalOnMap)} bhandaras on the map`}
                  hi={isPastSeason ? `2026 में ${fmt(totalOnMap)} भंडारे दर्ज हुए` : `नक़्शे पर ${fmt(totalOnMap)} भंडारे`}
                />
              </span>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
