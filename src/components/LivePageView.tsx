"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HOME_ART } from "@/content/home-art";
import { strings } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";
import LiveFeedTimeline, { type FeedPost } from "@/components/LiveFeedTimeline";
import {
  Actions,
  Breadcrumb,
  Button,
  FeedList,
  FeedRow,
  Heading,
  InnerShell,
  Kicker,
  KickSep,
  PageHero,
  Plate,
  Section,
  dayMonth,
  longDate,
} from "@/components/v2";

/**
 * /live body (v2 inner page kit). In season the feed of spots from
 * across Lucknow (LiveFeedTimeline, polling every 8 s). Off season a
 * quiet state: the countdown to the next Bada Mangal, its Tuesdays, and
 * the last Tuesday of the latest season as Lucknow posted it.
 *
 * SEO: the h1 ("Live from the bhandara") and the quiet state's h2 ("The
 * bhandaras are quiet right now.") keep their strings; every old link
 * (/spot, /, /list-bhandara, /live) stays.
 */
export type PastPost = {
  id: string;
  photoUrl: string;
  text: string | null;
  area: string | null;
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  bhandaraNameHi: string | null;
  createdAt: string;
};

type Props = {
  liveCount: number;
  initial: FeedPost[];
  bhandaras: { slug: string; name: string }[];
  pastDay: string | null;
  pastDayCount: number;
  pastPosts: PastPost[];
  nextTuesdays: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const istMidnight = (iso: string) => Date.parse(`${iso}T00:00:00+05:30`);

export default function LivePageView({
  liveCount,
  initial,
  bhandaras,
  pastDay,
  pastDayCount,
  pastPosts,
  nextTuesdays,
}: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const q = isHi ? "" : "?lang=en";
  const t = strings[locale];
  const live = liveCount > 0 || initial.length > 0;

  const quiet = (
    <QuietState isHi={isHi} q={q} nextTuesdays={nextTuesdays} />
  );

  return (
    <InnerShell>
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: `/${q}` },
              { label: isHi ? "लाइव" : "Live" },
            ]}
          />
        }
        kicker={
          live ? (
            <Kicker live>
              <span>{isHi ? "लाइव" : "Live"}</span>
              <KickSep />
              <span>
                {isHi ? `${liveCount} अभी लाइव` : `${liveCount} live right now`}
              </span>
            </Kicker>
          ) : (
            <Kicker>
              <span>{isHi ? "लाइव फ़ीड" : "Live feed"}</span>
              <KickSep />
              <span>{isHi ? "बड़ा मंगल लखनऊ" : "Bada Mangal Lucknow"}</span>
            </Kicker>
          )
        }
        title={{ en: "Live from the bhandara", hi: "भंडारा से सीधा" }}
        lede={
          isHi
            ? "लखनऊ के भंडारों से तस्वीरें, संदेश, और सेवा की झलक, हर कुछ सेकंड में नई।"
            : "Photos, blessings, and live updates from Lucknow's bhandaras, refreshed every few seconds."
        }
        art={<Plate {...HOME_ART.gomtiDusk} alt="" fade="edges" priority />}
      />

      <LiveFeedTimeline initial={initial} bhandaras={bhandaras} emptySlot={quiet} />

      {/* Off season: the last Tuesday of the latest season. */}
      {!live && pastDay && pastPosts.length > 0 ? (
        <Section
          id="last-season"
          labelledBy="live-past-h"
          heading={
            <Heading
              as="h2"
              id="live-past-h"
              en={`The last Bada Mangal of ${pastDay.slice(0, 4)}`}
              hi={`${pastDay.slice(0, 4)} का आख़िरी बड़ा मंगल`}
            />
          }
          lede={
            isHi
              ? `${longDate(pastDay, "hi", true)}, जैसा लखनऊ ने भेजा। उस दिन ${pastDayCount} तस्वीरें आईं।`
              : `${longDate(pastDay, "en", true)}, as Lucknow posted it. ${pastDayCount} photos came in that day.`
          }
          action={
            <Button variant="text" href={`/gallery${q}`}>
              {isHi ? "सारी तस्वीरें" : "All photos"}
            </Button>
          }
        >
          <div className="bmi-live-past">
            <FeedList label={isHi ? "पिछले सत्र की फ़ीड" : "Last season's feed"}>
              {pastPosts.map((p) => {
                const name = isHi ? p.bhandaraNameHi || p.bhandaraName : p.bhandaraName;
                const area = p.area ? (t.areas[p.area as keyof typeof t.areas] ?? p.area) : null;
                const where = name || area || (isHi ? "लखनऊ" : "Lucknow");
                const time = istClock(p.createdAt);
                return (
                  <FeedRow
                    key={p.id}
                    meta={
                      <>
                        {p.bhandaraSlug ? (
                          <Link href={`/bhandara/${p.bhandaraSlug}${q}`} prefetch={false} className="bmi-live-where">
                            <b>{where}</b>
                          </Link>
                        ) : (
                          <b>{where}</b>
                        )}
                        {name && area ? <span>{area}</span> : null}
                        <time dateTime={p.createdAt} suppressHydrationWarning>
                          {time}
                        </time>
                      </>
                    }
                    text={p.text ?? undefined}
                  >
                    {/* The whole photo on its own blurred fill: a pamphlet
                        is never cropped. */}
                    <span className="bmi-livepic">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="bg" src={p.photoUrl} alt="" aria-hidden loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="fg"
                        src={p.photoUrl}
                        alt={isHi ? `${where}, बड़ा मंगल ${dayMonth(pastDay, "hi")}` : `${where}, Bada Mangal ${dayMonth(pastDay, "en")}`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    </span>
                  </FeedRow>
                );
              })}
            </FeedList>
          </div>
        </Section>
      ) : null}

      <div className="bmi-sec" aria-hidden />
    </InnerShell>
  );
}

/**
 * The quiet state (nothing live): the old empty state's words, the
 * countdown to the next Bada Mangal, and its Tuesdays.
 */
function QuietState({
  isHi,
  q,
  nextTuesdays,
}: {
  isHi: boolean;
  q: string;
  nextTuesdays: string[];
}) {
  const first = nextTuesdays[0] ?? null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const days = first ? Math.max(0, Math.ceil((istMidnight(first) - now) / DAY_MS)) : null;

  return (
    <Section tight id="quiet" labelledBy="live-quiet-h">
      <div className="bmi-live-quiet" aria-live="polite">
        <div>
          <Kicker>{isHi ? "पहले स्पॉट का इंतज़ार" : "Waiting for the first spot"}</Kicker>
          <Heading
            as="h2"
            id="live-quiet-h"
            en="The bhandaras are quiet right now."
            hi="अभी भंडारे शांत हैं।"
          />
          <p className="bmi-lede" data-rv>
            {isHi
              ? "जैसे ही कोई पासर्बाई कोई भंडारा रिपोर्ट करेगा, उसकी तस्वीर यहाँ हर 8 सेकंड में अपने-आप आ जाएगी। चाहें तो आप पहले हो जाइए।"
              : "The moment a passer-by reports a bhandara from anywhere in Lucknow, their photo will land here within 8 seconds. Want to be the first?"}
          </p>
          <Actions split className="bmi-live-acts">
            <Button href={`/spot${q}`} icon="camera" data-ga="cta_live_empty_spot" data-ga-source="live_empty_all-empty">
              {isHi ? "अभी भंडारा स्पॉट करें" : "Spot a bhandara now"}
            </Button>
          </Actions>
          <div className="bmi-live-links">
            <Button variant="text" href={isHi ? "/" : "/?lang=en"} data-ga="cta_live_empty_browse">
              {isHi ? "लिस्टेड भंडारे देखें" : "Browse listed bhandaras"}
            </Button>
            <Button variant="text" href={`/list-bhandara${q}`} data-ga="cta_live_empty_list">
              {isHi ? "खुद आयोजन कर रहे हैं? लिस्ट करें" : "Hosting one? List it"}
            </Button>
          </div>
          <p className="bmi-sr">{isHi ? "अभी कोई पोस्ट नहीं।" : "No posts yet."}</p>
        </div>

        {first && days !== null ? (
          <div className="bmi-live-count" data-rv>
            <p className="bmi-live-count-k">
              {isHi ? `अगला बड़ा मंगल ${first.slice(0, 4)}` : `Next Bada Mangal ${first.slice(0, 4)}`}
            </p>
            <p className="bmi-live-count-n">
              <span suppressHydrationWarning>{days}</span>
              <small>{isHi ? "दिन बाकी" : days === 1 ? "day to go" : "days to go"}</small>
            </p>
            <ol className="bmi-live-tues" aria-label={isHi ? `${first.slice(0, 4)} के बड़े मंगल` : `Bada Mangal Tuesdays ${first.slice(0, 4)}`}>
              {nextTuesdays.map((d, i) => {
                const [, mm, dd] = d.split("-");
                const mon = dayMonth(d, isHi ? "hi" : "en").replace(/^\d+\s/, "");
                return (
                  <li key={d} className={i === 0 ? "first" : undefined}>
                    <span className="k">{isHi ? (HI_ORD[i] ?? `${i + 1}`) : ordinal(i + 1)}</span>
                    <span className="d">{Number(dd)}</span>
                    <span className="m" data-m={mm}>{mon}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/** "2026-06-23T17:55:00Z" to "11:25 PM" in IST (same shape as the kit's shortTime). */
function istClock(iso: string): string {
  const d = new Date(Date.parse(iso) + 5.5 * 60 * 60 * 1000);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const HI_ORD = ["पहला", "दूसरा", "तीसरा", "चौथा", "पाँचवाँ", "छठा", "सातवाँ", "आठवाँ"];

function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
