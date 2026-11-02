import Image from "next/image";
import { T } from "@/components/T";
import { GADA_PIN } from "@/content/home-art";
import type { ThreadMessage } from "@/lib/home-community";
import LocaleLink from "./LocaleLink";
import Head from "./Head";

// No WhatsApp join links for now (founder, 1 Nov 2026: "Don't add link
// to join the whatsapp community now"). The invite links live in the
// WhatsAppGroup table if they come back. No sender names either
// (founder, same day): bubbles show the message, photo and locality only.

/**
 * 4 · Community (comp C): the WhatsApp group as one moment. Real
 * messages and photos from the bot's ingest, real member counts.
 */
export default function CommunitySection({
  thread,
  communityTotal,
  groupCounts,
  isPastSeason,
}: {
  thread: ThreadMessage[];
  communityTotal: number;
  groupCounts: Record<string, number>;
  isPastSeason: boolean;
}) {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  void groupCounts;
  return (
    <section className="sec comm wash" id="live-chat" aria-labelledby="comm-h">
      <div className="wrap comm-grid">
        <div>
          <h2 className="kick" id="comm-h" data-rv>
            <T
              en="Bhandaras near me, on the map and live in chat"
              hi={<span className="hi">नक़्शे पर और लाइव चैट में, आस-पास के भंडारे</span>}
            />
          </h2>
          <Head en="Spotted a bhandara? Drop it in the group." hi="भंडारा दिखा? ग्रुप में डालो" />
          <p className="lede" data-rv>
            <T
              en="Every pin on the map started as a message like these. A photo, a locality, what is being served. The neighbours did the rest."
              hi="नक़्शे का हर पिन ऐसे ही एक मैसेज से शुरू हुआ। एक फ़ोटो, एक इलाक़ा, क्या बँट रहा है। बाक़ी पड़ोसियों ने किया।"
            />
          </p>
          {communityTotal > 0 ? (
            <>
              <p className="big-n" data-count={communityTotal}>
                {fmt(communityTotal)}
              </p>
              <p className="big-n-l" id="join-community-heading">
                <T en="neighbours in the BadaMangal WhatsApp community" hi="पड़ोसी BadaMangal के WhatsApp समुदाय में" />
              </p>
            </>
          ) : null}
          <div className="ctas" data-rv>
            <LocaleLink href="/spot" className="b b-p" data-ga="home_spot_bhandara">
              <T en="Spot a bhandara" hi="भंडारा स्पॉट करें" />
            </LocaleLink>
          </div>
        </div>

        <div className="chat" data-rv aria-label="Messages from the BadaMangal WhatsApp group">
          <div className="chat-h">
            <span className="av">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GADA_PIN} alt="" width={26} height={26} />
            </span>
            <span>
              <b>BadaMangal Lucknow</b>
              <span>
                {communityTotal > 0 ? (
                  <T
                    en={`${fmt(communityTotal)} neighbours${isPastSeason ? " · 2026 season archive" : ""}`}
                    hi={`${fmt(communityTotal)} पड़ोसी${isPastSeason ? " · 2026 सीज़न" : ""}`}
                  />
                ) : null}
              </span>
            </span>
          </div>
          <div className="tl" data-thread>
            <span className="day">
              <T en="Bada Mangal · from the group" hi="बड़ा मंगल · ग्रुप से" />
            </span>
            {thread.map((m, i) => {
              const last = i === thread.length - 1;
              const body = (
                <>
                  {m.photoUrl ? (
                    <span className="pic">
                      <Image
                        src={m.photoUrl}
                        alt={m.locality ? `Bhandara photo from ${m.locality}` : "Bhandara photo shared in the group"}
                        fill
                        sizes="260px"
                      />
                    </span>
                  ) : null}
                  {m.text ? <p>{m.text}</p> : null}
                  {m.locality ? (
                    <span className="where">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={GADA_PIN} alt="" width={15} height={15} />
                      {m.locality}
                    </span>
                  ) : null}
                </>
              );
              return (
                <div key={m.id} style={{ display: "contents" }}>
                  {last ? (
                    <div className="typing" aria-hidden>
                      <i />
                      <i />
                      <i />
                    </div>
                  ) : null}
                  {m.href ? (
                    <a className={`msg${last ? " late" : ""}`} href={m.href}>
                      {body}
                    </a>
                  ) : (
                    <div className={`msg${last ? " late" : ""}`}>{body}</div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="chat-f">
            {isPastSeason ? (
              <T
                en="Season archive. The group wakes up again next Jyeshtha."
                hi="सीज़न का संग्रह। अगले ज्येष्ठ ग्रुप फिर से जागेगा।"
              />
            ) : (
              <T en="Live every Bada Mangal Tuesday." hi="हर बड़े मंगल पर लाइव।" />
            )}
          </p>
          <div className="chat-links">
            <LocaleLink href="/gallery" className="tlink">
              <T en="See every photo" hi="सारी तस्वीरें" />
              <svg viewBox="0 0 24 24" className="ic" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </LocaleLink>
            <a href="/live" className="tlink">
              <T en="Open the live feed" hi="लाइव फ़ीड खोलें" />
              <svg viewBox="0 0 24 24" className="ic" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
