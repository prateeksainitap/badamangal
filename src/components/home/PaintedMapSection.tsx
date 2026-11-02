import Image from "next/image";
import type { ComponentProps } from "react";
import { T } from "@/components/T";
import { strings } from "@/content/strings";
import { GADA_PIN, HOME_ART } from "@/content/home-art";
import type { LocalityGroup, PaintedMapModel, ProjectedPin } from "@/lib/home-map";
import { withLangEn } from "./lang-href";
import LocalityExplorer from "./LocalityExplorer";
import MapStage from "./MapStage";
import Head from "./Head";

type StageProps = Omit<ComponentProps<typeof MapStage>, "children">;

/** `photos` only on the desktop set: the hover card is for mouse pointers. */
function Pins({ pins, className, photos = false }: { pins: ProjectedPin[]; className: string; photos?: boolean }) {
  return (
    <div className={className}>
      {pins.map((p) => (
        <a
          key={p.key}
          href={withLangEn(p.href)}
          data-ll=""
          className={`pin${p.count >= 3 ? " big" : ""}`}
          aria-label={p.label}
          // Out of the Tab order: 240 pins would bury the page for
          // keyboard users. The locality list below links every page.
          tabIndex={-1}
          data-photo={photos && p.photo ? p.photo : undefined}
          style={{
            ["--x" as string]: `${p.x}%`,
            ["--y" as string]: `${p.y}%`,
            ["--d" as string]: `${Math.min(0.15 + p.order * 0.014, 2.6).toFixed(2)}s`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={GADA_PIN} alt="" width={28} height={28} loading="lazy" decoding="async" />
        </a>
      ))}
    </div>
  );
}

/**
 * 3 · The map (comp B, on the v2 painted plate). `#map` lives on this
 * section. Every gada is a real link to its bhandara page, locality
 * labels link to the area pages, and the fold-out list below carries a
 * plain link to every bhandara so search engines keep finding them all.
 */
export default function PaintedMapSection({
  model,
  groups,
  totalCount,
  stage,
}: {
  model: PaintedMapModel;
  groups: LocalityGroup[];
  totalCount: number;
  stage: StageProps;
}) {
  const past = stage.isPastSeason;
  return (
    <section className="sec mapsec" id="map" aria-labelledby="map-h">
      <div className="wrap">
        <div className="map-head">
          <div>
            <p className="kick" data-rv>
              <T en={past ? "The 2026 map" : "This season's map"} hi={<span className="hi">{past ? "2026 का नक़्शा" : "इस सीज़न का नक़्शा"}</span>} />
            </p>
            <Head en="One map. All of Lucknow." hi="एक नक़्शा, पूरा लखनऊ" />
          </div>
          <h2 className="count" id="map-h" data-rv>
            <b data-count={totalCount}>{totalCount.toLocaleString("en-IN")}</b>{" "}
            <span>
              <T
                en={
                  past
                    ? "Bada Mangal bhandaras from the 2026 season, on one map"
                    : strings.en.map.sectionHeading(totalCount).replace(/^All\s+/, "").replace(`${totalCount} `, "")
                }
                hi={past ? "बड़े मंगल भंडारे, 2026 के सीज़न से, एक नक़्शे पर" : "बड़े मंगल भंडारे लखनऊ भर से, एक नक़्शे पर"}
              />
            </span>
          </h2>
        </div>

        <div className="sheet-wrap">
          <MapStage {...stage}>
            <div className="map-scroll" data-focus={model.focusX}>
              <div className="map" data-map role="group" aria-label="Painted map of Lucknow with every 2026 bhandara as Hanuman ji's gada">
                <Image
                  className="plate"
                  src={HOME_ART.paintedMap.src}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 1240px, (min-width: 720px) 94vw, 720px"
                />
                <span className="wash" aria-hidden />
                <Pins pins={model.pinsDesktop} className="pins pins-d" photos />
                <Pins pins={model.pinsMobile} className="pins pins-m" />
                {model.labels.map((l) => (
                  <span
                    key={l.key}
                    className="loc"
                    style={{ ["--x" as string]: `${l.x}%`, ["--y" as string]: `${l.y}%` }}
                  >
                    {l.href ? (
                      <a href={withLangEn(l.href)} data-ll="" aria-label={`${l.en}, Bada Mangal bhandaras`}>
                        <T en={<b>{l.en}</b>} hi={<b lang="hi">{l.hi}</b>} />
                      </a>
                    ) : (
                      <span className="lbl">
                        <T en={<b>{l.en}</b>} hi={<b lang="hi">{l.hi}</b>} />
                      </span>
                    )}
                  </span>
                ))}
                <span
                  className="loc river"
                  aria-hidden
                  style={{ ["--x" as string]: `${model.riverLabel.x}%`, ["--y" as string]: `${model.riverLabel.y}%` }}
                >
                  <span className="lbl">
                    <T en={<b>Gomti</b>} hi={<b lang="hi">गोमती</b>} />
                  </span>
                </span>
              </div>
            </div>
            <p className="swipe-hint" aria-hidden>
              <svg viewBox="0 0 24 24" className="ic">
                <path d="M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3" />
              </svg>
              <T en="Swipe to explore the city" hi="शहर देखने के लिए स्वाइप करें" />
            </p>
          </MapStage>
        </div>

        <div className="map-foot">
          <p className="legend" data-rv>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={GADA_PIN} alt="" width={26} height={26} />
            <T
              en="Every gada is a real bhandara. Tap one to open it."
              hi="हर गदा एक असली भंडारा है। खोलने के लिए टैप करें।"
            />
          </p>
          <a className="tlink" href="/list-bhandara" data-ga="map_add_bhandara">
            <T en="Add your bhandara to the map" hi="अपना भंडारा नक़्शे पर जोड़ें" />
            <svg viewBox="0 0 24 24" className="ic" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </a>
        </div>

        <details className="all-list">
          <summary>
            <span>
              <T
                en="Every listed bhandara, by locality"
                hi="हर सूचीबद्ध भंडारा, इलाक़े के हिसाब से"
              />
            </span>
            <span className="pm" aria-hidden>
              <svg viewBox="0 0 24 24" className="ic" width="16" height="16">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </summary>
          <LocalityExplorer groups={groups} />
          <p className="all-more">
            <a href="/live" className="tlink">
              <T en="See what the city spotted live" hi="शहर ने लाइव क्या देखा" />
            </a>
          </p>
        </details>
      </div>
    </section>
  );
}
