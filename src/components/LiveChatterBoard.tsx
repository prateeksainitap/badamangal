"use client";

/**
 * "What people are talking about?" — homepage live chatter section.
 *
 * Dark band, frosted-glass cards, designed to feel alive: bg breathes,
 * ember sparks pulse on independent clocks, map cells breathe + ripple
 * on fresh mentions, freshly-arrived chat bubbles slide in with a
 * saffron halo, community counters tick up smoothly when the bot
 * pushes new totals.
 *
 * Section layout:
 *   1. Header (title + LIVE / photos / members chips)
 *   2. Active-area chips strip
 *   3. Two-column body: map LEFT (~60%), chat panel RIGHT (~40%)
 *   4. Schedule notice (Tue/Sat live chat note)
 *   5. Full-width "Join the chat on WhatsApp" panel with 4 glossy
 *      community cards showing exact member counts
 *
 * Tuesday / Saturday chat schedule:
 *   The community is most active on Bada Mangal Tuesdays and on
 *   Saturdays (Shani / Hanuman). The bot actively forwards on those
 *   days; the rest of the week the live chat is "offline". We detect
 *   the current day in IST and render either:
 *     - LIVE state: pulsing green "connected" dot, chat populates
 *       from the polling loop as usual.
 *     - OFFLINE state: muted "Offline · resumes <day>" indicator,
 *       static banner over the chat body, last N mentions still
 *       visible as recent history. No autoscroll, no new-bubble glow.
 *   Either way the WhatsApp CTAs below are always visible (joining
 *   the chat is a non-time-sensitive action).
 *
 * Glass effect: every card uses a layered backdrop:
 *   - dark base (ink-900/70 with backdrop-blur)
 *   - top-left highlight (subtle white linear-gradient overlay)
 *   - inner light line (inset 1px ring with cream-50/8)
 *   - drop shadow for depth
 * The combination reads as "frosted glass with a soft sheen" without
 * a heavy CSS dependency.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MentionHeatmap from "@/components/MentionHeatmap";

export type ChatterMention = {
  id: string;
  kind: "mention" | "spot";
  text: string;
  language: string;
  intent: "ASKING" | "SHARING" | "MENTIONING";
  locationLabel: string | null;
  lat: number | null;
  lng: number | null;
  locationSource: string;
  photoUrl: string | null;
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  senderName: string | null;
  createdAt: string;
};

type FeedResp = { count: number; mentions: ChatterMention[] };

const POLL_MS = 12_000;
const TIME_TICK_MS = 15_000;
const MAX_CARDS = 24;
const NEW_GLOW_MS = 6_000;
const AUTOSCROLL_THRESHOLD_PX = 80;
const COUNTUP_DURATION_MS = 1200;

/** Days of the IST week when the bot actively forwards messages and
 *  the live chat is "open". 0 = Sunday, 2 = Tuesday, 6 = Saturday.
 *  Bada Mangal is Tuesday-centric; Saturday added per operator note
 *  (Shani / Hanuman community activity). */
const LIVE_CHAT_OPEN_DAYS = new Set<number>([2, 6]);
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Each WhatsApp CTA carries a stable counterKey that matches the
 *  SiteCounter row id (`community_count_<key>`) the bot writes via
 *  /api/bot/community-stats. Adding a new CTA = add the entry here +
 *  add an id to the SSR `findMany` filter in page.tsx.
 *
 *  iconUrl is the community/group/channel profile picture. WhatsApp
 *  doesn't expose these via a public API, so the bot fetches them
 *  via Baileys (groupMetadata + profilePictureUrl) and pushes once
 *  to our R2 storage on first sight; the URL is then hardcoded here.
 *  Until the bot wires that up, leave as null and the card falls
 *  back to a coloured WhatsApp glyph tile. */
const WHATSAPP_CTAS: ReadonlyArray<{
  counterKey: string;
  label: string;
  blurb: string;
  href: string;
  kind: "community" | "group" | "channel";
  iconUrl: string | null;
}> = [
  {
    counterKey: "bada_mangal_community",
    label: "Bada Mangal Community",
    blurb:
      "The biggest Lucknow circle for Bada Mangal news and bhandara invites.",
    href: "https://chat.whatsapp.com/H3HqNV4rOPi6xWU5O93fFv",
    kind: "community",
    iconUrl: null,
  },
  {
    counterKey: "balaji_bhandara_community",
    label: "Balaji ka Bhandara",
    blurb:
      "Volunteer-run hub for Balaji bhandara coordination across the city.",
    href: "https://chat.whatsapp.com/GACGY3qEiIHA5tCxV3FQzB",
    kind: "community",
    iconUrl: null,
  },
  {
    counterKey: "bhandara_group",
    label: "Bhandara Group",
    blurb:
      "Standalone group with real-time location and photo drops from the field.",
    href: "https://chat.whatsapp.com/FNtgNhFUmqaI6MMUt1M673",
    kind: "group",
    iconUrl: null,
  },
  {
    counterKey: "bada_mangal_channel",
    label: "Bada Mangal Channel",
    blurb:
      "One-way broadcast for official updates, prep guides and prasad timings.",
    href: "https://whatsapp.com/channel/0029Vb7wV4g9sBI6xxYsDw0C",
    kind: "channel",
    iconUrl: null,
  },
];

/** Avatar palette — keyed off the sender name hash so the same person
 *  consistently gets the same swatch. Six dark-mode tuned gradients. */
const AVATAR_PALETTE: ReadonlyArray<{
  bg: string;
  ring: string;
  text: string;
}> = [
  { bg: "bg-gradient-to-br from-saffron-500 to-saffron-600", ring: "ring-saffron-500/40", text: "text-cream-50" },
  { bg: "bg-gradient-to-br from-leaf-600 to-leaf-600/80", ring: "ring-leaf-600/40", text: "text-cream-50" },
  { bg: "bg-gradient-to-br from-sindoor-700 to-sindoor-700/80", ring: "ring-sindoor-700/40", text: "text-cream-50" },
  { bg: "bg-gradient-to-br from-rose-500 to-rose-600", ring: "ring-rose-500/40", text: "text-cream-50" },
  { bg: "bg-gradient-to-br from-sky-500 to-sky-600", ring: "ring-sky-500/40", text: "text-cream-50" },
  { bg: "bg-gradient-to-br from-amber-500 to-amber-600", ring: "ring-amber-500/40", text: "text-cream-50" },
];

function avatarSlot(seed: string): (typeof AVATAR_PALETTE)[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function intentLabel(intent: ChatterMention["intent"]): {
  text: string;
  className: string;
} {
  switch (intent) {
    case "ASKING":
      return { text: "is asking", className: "text-saffron-500" };
    case "SHARING":
      // leaf-400 (not -600) on the dark chatter band so the inline
      // intent label clears WCAG AA 4.5:1 contrast on ink-900.
      return { text: "is sharing", className: "text-leaf-400" };
    default:
      return { text: "mentioned", className: "text-gold-500" };
  }
}

function avatarInitial(name: string | null | undefined): string {
  if (!name) return "?";
  const cleaned = name.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const first = cleaned.charAt(0);
  return first ? first.toUpperCase() : "?";
}

function displayName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Anonymous";
  return trimmed.length > 22 ? trimmed.slice(0, 21) + "…" : trimmed;
}

/** IST day of week, 0–6 (Sun–Sat). Uses Intl rather than computing
 *  manually so we don't have to know the current UTC offset (IST is
 *  fixed +5:30 but Intl is the future-proof primitive). */
function todayDayIST(): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });
  const day = fmt.format(new Date());
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[day] ?? 0;
}

/** Returns the next IST day (0-6) on which the live chat reopens.
 *  When called on an open day, returns that day (same-day open).
 *  When called on a closed day, walks forward to the next open day. */
function nextOpenDayIST(): number {
  const today = todayDayIST();
  for (let offset = 0; offset < 7; offset++) {
    const d = (today + offset) % 7;
    if (LIVE_CHAT_OPEN_DAYS.has(d)) return d;
  }
  return 2; // shouldn't reach here; fallback to Tuesday
}

export default function LiveChatterBoard({
  initial,
  communityMembers,
  communityCountsByKey,
}: {
  initial: ChatterMention[];
  /** Total participant count across allowlisted WhatsApp groups +
   *  channel. From SiteCounter `community_total_members` (bot push). */
  communityMembers: number;
  /** Per-group/-channel counts keyed by `WHATSAPP_CTAS[].counterKey`.
   *  Missing keys render as "—" in the card. */
  communityCountsByKey: Record<string, number>;
}) {
  const [mentions, setMentions] = useState<ChatterMention[]>(initial);
  const firstSeenRef = useRef<Map<string, number>>(new Map());
  if (firstSeenRef.current.size === 0 && initial.length > 0) {
    const past = Date.now() - NEW_GLOW_MS - 1000;
    for (const m of initial) firstSeenRef.current.set(m.id, past);
  }
  const lastFetchAtRef = useRef<string>(new Date().toISOString());
  const aliveRef = useRef<boolean>(true);
  const [, forceTick] = useState(0);
  const [newSinceScrollAway, setNewSinceScrollAway] = useState(0);
  const chatBodyRef = useRef<HTMLUListElement | null>(null);

  // Compute the chat-open state ONCE per render. Re-renders happen
  // on every poll tick (12s) + the 15s time tick, so the state
  // refreshes naturally without needing a midnight-IST cron — it
  // flips on the next render after the day changes.
  const today = todayDayIST();
  const isChatOpen = LIVE_CHAT_OPEN_DAYS.has(today);
  const nextOpenDay = nextOpenDayIST();
  const nextOpenLabel = isChatOpen ? "today" : DAY_NAMES[nextOpenDay];

  const tick = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL("/api/mentions/feed", window.location.origin);
      url.searchParams.set("since", lastFetchAtRef.current);
      url.searchParams.set("limit", "30");
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data = (await res.json()) as FeedResp;
      if (!aliveRef.current) return;
      lastFetchAtRef.current = new Date().toISOString();
      if (data.mentions.length === 0) return;
      const body = chatBodyRef.current;
      const userAtTop = body ? body.scrollTop <= AUTOSCROLL_THRESHOLD_PX : true;
      setMentions((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = data.mentions.filter((m) => !seen.has(m.id));
        if (fresh.length === 0) return prev;
        const now = Date.now();
        for (const f of fresh) firstSeenRef.current.set(f.id, now);
        if (!userAtTop) {
          setNewSinceScrollAway((n) => n + fresh.length);
        }
        return [...fresh, ...prev].slice(0, MAX_CARDS);
      });
    } catch {
      // Silent retry next tick.
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void tick();
    const pollId = window.setInterval(tick, POLL_MS);
    const timeTickId = window.setInterval(
      () => forceTick((n) => n + 1),
      TIME_TICK_MS,
    );
    return () => {
      aliveRef.current = false;
      window.clearInterval(pollId);
      window.clearInterval(timeTickId);
    };
  }, [tick]);

  useEffect(() => {
    const body = chatBodyRef.current;
    if (!body) return;
    const onScroll = () => {
      if (body.scrollTop <= AUTOSCROLL_THRESHOLD_PX) {
        setNewSinceScrollAway(0);
      }
    };
    body.addEventListener("scroll", onScroll, { passive: true });
    return () => body.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const body = chatBodyRef.current;
    if (!body) return;
    if (body.scrollTop <= AUTOSCROLL_THRESHOLD_PX) {
      body.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [mentions]);

  // Heatmap input — exclude ASKING messages.
  // An ASKING bubble's coords (e.g. "anyone know about a bhandara in
  // Hazratganj?") describe the place the SENDER is wondering about,
  // not a place where a bhandara is happening. Putting a pin there
  // would falsely advertise activity. We keep the row's lat/lng in
  // the DB (admins need it for triage) and filter only on the public
  // map surface.
  const geoMentions = useMemo(
    () =>
      mentions.filter(
        (m): m is ChatterMention & { lat: number; lng: number } =>
          m.intent !== "ASKING" && m.lat !== null && m.lng !== null,
      ),
    [mentions],
  );

  // Same rule for the "Active areas:" chip strip. An asking mention
  // about Hazratganj shouldn't add to Hazratganj's bhandara-activity
  // tally, "asking about" is a question, not a sighting.
  const areaCounts = useMemo(() => {
    const counts = new Map<
      string,
      { display: string; count: number; mostRecent: number }
    >();
    for (const m of mentions) {
      if (m.intent === "ASKING") continue;
      const label = m.locationLabel?.trim();
      if (!label) continue;
      const k = label.toLowerCase();
      const ts = new Date(m.createdAt).getTime();
      const existing = counts.get(k);
      if (existing) {
        existing.count += 1;
        if (ts > existing.mostRecent) existing.mostRecent = ts;
      } else {
        counts.set(k, { display: label, count: 1, mostRecent: ts });
      }
    }
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || b.mostRecent - a.mostRecent)
      .slice(0, 8);
  }, [mentions]);

  const spotCount = useMemo(
    () => mentions.filter((m) => m.kind === "spot").length,
    [mentions],
  );
  const totalToday = mentions.length;

  const scrollToTop = useCallback(() => {
    chatBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setNewSinceScrollAway(0);
  }, []);

  return (
    <section className="relative bg-ink-900 text-cream-50 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none chatter-bg-breathe"
        style={{
          background:
            "radial-gradient(ellipse at 85% 0%, rgba(242,148,76,0.30) 0%, transparent 50%), radial-gradient(ellipse at 5% 100%, rgba(156,42,42,0.22) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(242,148,76,0.05) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-50"
      >
        <span className="chatter-ember chatter-ember-1" />
        <span className="chatter-ember chatter-ember-2" />
        <span className="chatter-ember chatter-ember-3" />
        <span className="chatter-ember chatter-ember-4" />
        <span className="chatter-ember chatter-ember-5" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
        {/* Section header */}
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1.5">
            <h2 className="font-fraunces font-bold text-2xl sm:text-3xl lg:text-4xl text-cream-50 inline-flex items-center flex-wrap gap-x-3 gap-y-1.5 leading-tight">
              <span>What people are talking about?</span>
              <SectionLiveBadge />
            </h2>
            <p className="text-sm sm:text-base text-cream-50/75 leading-snug">
              The pulse of Lucknow&apos;s Bada Mangal community.{" "}
              <span className="text-saffron-500 font-medium">Every share</span>,{" "}
              <span className="text-saffron-500 font-medium">every photo</span>,{" "}
              the second it lands. Auto-curated, profanity-filtered, always on.
            </p>
          </div>
          {/* Section-header chips. LIVE pill moved into the chat
              panel header below (it belongs next to "Live chat" so
              the connection state and the live count read together).
              These chips remain for at-a-glance photo + community
              totals across the whole section. */}
          <div className="flex items-center gap-2 flex-wrap">
            {spotCount > 0 ? <PhotoCountChip count={spotCount} /> : null}
            {communityMembers > 0 ? (
              <CommunityCountChip count={communityMembers} />
            ) : null}
          </div>
        </header>

        {/* Active area chips. Borderless per design — the dark fill +
            saffron text + saffron count badge already differentiate
            them from the surrounding chrome. */}
        {areaCounts.length > 0 ? (
          <div className="mb-6 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-cream-50/60 mr-1">Active areas:</span>
            {areaCounts.map((a) => (
              <span
                key={a.display}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-saffron-500 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)]"
              >
                <PinIcon />
                <span className="font-medium">{a.display}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-br from-saffron-500 to-saffron-600 text-cream-50 text-[10px] font-semibold leading-none">
                  {a.count}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        {/* Two-column body merged into ONE shared frosted-glass card.
            Map sits on the left (60%), chat on the right (40%),
            separated by a hairline divider on lg+ and stacked with a
            cream rule on narrow viewports. Previously these were two
            adjacent cards each with their own glass border, which read
            as "two unrelated panels parked next to each other"; the
            shared frame ties them visually so they read as "the live
            chat + its map" one instrument. */}
        <div className="chatter-glass relative grid rounded-2xl overflow-hidden lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:h-[40rem]">
          <MentionHeatmap mentions={geoMentions} />

          {/* Chat panel — no glass / no border / no rounded chrome of
              its own anymore. Just a left-side hairline divider on lg+
              and a top divider on stacked layouts so the two halves
              still read as separate instruments inside the shared card.
              Mobile gets a FIXED height (28rem) so the inner chat body
              scrolls in place instead of expanding the page; lg lets
              it fill the parent's lg:h-[40rem] cell. */}
          <div className="relative flex flex-col h-[28rem] sm:h-[32rem] lg:h-full lg:min-h-0 border-t border-cream-50/10 lg:border-t-0 lg:border-l lg:border-cream-50/10">
            {/* Header — ChatBubble SVG + title + LIVE pill on the left,
                connection state on the right. The LIVE pill that used
                to sit in the section header above moves here so the
                live count + connected indicator read together as one
                instrument. flex-wrap so narrow mobiles can stack the
                connection state below if needed. */}
            <div className="px-4 py-3 border-b border-cream-50/10 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <span aria-hidden className="text-cream-50/85 shrink-0">
                  <ChatBubbleGlyph size={18} />
                </span>
                <span className="font-fraunces text-cream-50 text-base shrink-0">
                  Live chat
                </span>
                {/* Hide the LIVE pill on a cold-load with no chatter
                    yet — otherwise the header reads "LIVE · 0 mentions"
                    which looks broken. Reappears the instant a poll
                    lands a fresh row. */}
                {totalToday > 0 ? (
                  <LivePulseBadge count={totalToday} />
                ) : null}
              </div>
              {isChatOpen ? (
                <span className="text-[11px] text-cream-50/70 inline-flex items-center gap-1.5">
                  <span className="relative inline-block w-2 h-2 text-leaf-400">
                    <span
                      aria-hidden
                      className="live-pulse-dot absolute inset-0 rounded-full bg-leaf-400"
                    />
                  </span>
                  connected
                </span>
              ) : (
                <span className="text-[11px] text-cream-50/55 inline-flex items-center gap-1.5">
                  <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-cream-50/40" />
                  offline · resumes {nextOpenLabel}
                </span>
              )}
            </div>

            {/* Offline banner */}
            {!isChatOpen ? (
              <div className="px-4 py-3 border-b border-cream-50/10 bg-gradient-to-r from-cream-50/5 via-cream-50/[0.02] to-cream-50/5 text-xs text-cream-50/75">
                <span className="font-semibold text-cream-50">
                  Live chat is on Tuesdays and Saturdays.
                </span>{" "}
                Today is {DAY_NAMES[today]}. Recent mentions below stay visible.
                Chat picks up again on{" "}
                <span className="text-saffron-500">{nextOpenLabel}</span>.
              </div>
            ) : null}

            {/* Scrollable body. `chatter-scroll` styles the webkit
                scrollbar to a saffron-tinted thumb on a near-invisible
                track so it disappears into the dark card unless the
                user is actively scrolling. */}
            <ul
              ref={chatBodyRef}
              className="chatter-scroll flex-1 overflow-y-auto px-1 py-1 relative"
              aria-live="polite"
              aria-label="Live WhatsApp chatter feed"
            >
              {mentions.length === 0 ? (
                <li className="m-auto text-center text-sm text-cream-50/60 italic px-6 py-12 grid gap-2">
                  <span aria-hidden className="text-3xl opacity-50">💬</span>
                  <span>
                    {isChatOpen
                      ? "Quiet on WhatsApp right now. New mentions and photos will slide in here as they arrive."
                      : `Live chat resumes on ${nextOpenLabel}. Recent mentions will appear here when activity restarts.`}
                  </span>
                </li>
              ) : (
                mentions.map((m, idx) => {
                  const firstSeenAt = firstSeenRef.current.get(m.id);
                  // Suppress the new-glow when chat is offline — no
                  // genuinely "new" messages should be landing then.
                  const isNew =
                    isChatOpen &&
                    typeof firstSeenAt === "number" &&
                    Date.now() - firstSeenAt < NEW_GLOW_MS;
                  return (
                    <ChatBubble
                      key={m.id}
                      mention={m}
                      isNew={isNew}
                      isLast={idx === mentions.length - 1}
                    />
                  );
                })
              )}
            </ul>

            {newSinceScrollAway > 0 && isChatOpen ? (
              <button
                type="button"
                onClick={scrollToTop}
                className="absolute top-14 left-1/2 -translate-x-1/2 z-10 rounded-full bg-gradient-to-br from-saffron-500 to-saffron-600 text-cream-50 text-xs font-medium px-3 py-1.5 shadow-warm chatter-new-pill"
              >
                ↑ {newSinceScrollAway} new{" "}
                {newSinceScrollAway === 1 ? "message" : "messages"}
              </button>
            ) : null}
          </div>
        </div>

        {/* Full-width WhatsApp community section */}
        <WhatsappCommunitySection countsByKey={communityCountsByKey} />
      </div>

      <style jsx>{`
        @keyframes chatter-slide-in {
          from { transform: translateY(-12px) scale(0.985); opacity: 0; }
          to   { transform: translateY(0)     scale(1);     opacity: 1; }
        }
        @keyframes chatter-glow-fade {
          0% {
            box-shadow: 0 0 20px 2px rgba(242, 148, 76, 0.35);
            background-color: rgba(242, 148, 76, 0.10);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(242, 148, 76, 0);
            background-color: transparent;
          }
        }
        @keyframes live-pulse {
          0%, 100% { transform: scale(1);   opacity: 0.95; }
          50%      { transform: scale(1.7); opacity: 0; }
        }
        @keyframes new-pill-pop {
          from { transform: translate(-50%, -6px) scale(0.92); opacity: 0; }
          to   { transform: translate(-50%, 0)    scale(1);    opacity: 1; }
        }
        @keyframes chatter-bg-breathe {
          0%, 100% { opacity: 0.85; background-size: 100% 100%; }
          50%      { opacity: 1;    background-size: 110% 110%; }
        }
        :global(.chatter-bg-breathe) {
          animation: chatter-bg-breathe 9s ease-in-out infinite;
        }
        @keyframes chatter-ember-pulse {
          0%, 100% { opacity: 0;    transform: scale(0.6); }
          50%      { opacity: 0.65; transform: scale(1); }
        }
        :global(.chatter-ember) {
          position: absolute;
          width: 4px; height: 4px;
          border-radius: 9999px;
          background: rgba(242, 148, 76, 0.85);
          box-shadow: 0 0 10px rgba(242, 148, 76, 0.7);
        }
        :global(.chatter-ember-1) { top: 18%; left: 12%; animation: chatter-ember-pulse 4.5s ease-in-out 0s   infinite; }
        :global(.chatter-ember-2) { top: 64%; left: 22%; animation: chatter-ember-pulse 5.5s ease-in-out 1.2s infinite; background: rgba(201,162,74,0.85); box-shadow: 0 0 10px rgba(201,162,74,0.7); }
        :global(.chatter-ember-3) { top: 30%; left: 78%; animation: chatter-ember-pulse 6s   ease-in-out 0.6s infinite; }
        :global(.chatter-ember-4) { top: 80%; left: 60%; animation: chatter-ember-pulse 4.2s ease-in-out 2.1s infinite; background: rgba(156,42,42,0.85); box-shadow: 0 0 10px rgba(156,42,42,0.7); }
        :global(.chatter-ember-5) { top: 8%;  left: 48%; animation: chatter-ember-pulse 5s   ease-in-out 1.8s infinite; background: rgba(201,162,74,0.85); box-shadow: 0 0 10px rgba(201,162,74,0.7); }

        :global(.chatter-bubble--new) {
          animation:
            chatter-slide-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both,
            chatter-glow-fade 6s ease-out 420ms both;
        }
        :global(.chatter-new-pill) {
          animation: new-pill-pop 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        :global(.live-pulse-dot)::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: currentColor;
          animation: live-pulse 1.8s ease-out infinite;
        }

        /* ── Glossy / glass card treatment ───────────────────────────
           Four layers compose the frosted-dark-glass look from the
           reference UI:
             1. dark base bg
             2. linear gradient overlay (top-left highlight)
             3. inset 1px ring (catches light at the edges)
             4. outer drop shadow for depth
           Single utility class so every card on the section can opt-in
           with the chatter-glass classname instead of duplicating the
           rules. (No backticks in this comment block — they would
           terminate the styled-jsx template literal.) */
        :global(.chatter-glass) {
          background-color: rgba(26, 20, 16, 0.72);
          background-image:
            linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0) 38%),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0));
          backdrop-filter: blur(18px) saturate(140%);
          -webkit-backdrop-filter: blur(18px) saturate(140%);
          /* Subtle cream-tinted border at very low opacity. Previous
             saffron border read as "selected" against the dark band;
             cream-on-dark is cleaner. */
          border: 1px solid rgba(251, 247, 240, 0.08);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.10),
            inset 0 0 0 1px rgba(255, 255, 255, 0.03),
            0 12px 40px -16px rgba(0, 0, 0, 0.7),
            0 6px 18px -10px rgba(0, 0, 0, 0.55);
        }
        :global(.chatter-glass-hover) {
          transition:
            transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
            box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
            border-color 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        :global(.chatter-glass-hover):hover {
          transform: translateY(-2px);
          /* Hover ONLY: faint saffron edge so the card glows when you
             approach it. Default state stays cream-neutral. */
          border-color: rgba(242, 148, 76, 0.35);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.14),
            inset 0 0 0 1px rgba(255, 255, 255, 0.04),
            0 16px 48px -16px rgba(0, 0, 0, 0.75),
            0 8px 24px -10px rgba(242, 148, 76, 0.22);
        }

        /* ── Themed scrollbar for the chat panel + any other dark
           overflow container in this section. Webkit: thin track with
           a saffron-tinted thumb that brightens on hover. Firefox:
           uses its own scrollbar-color/width primitives.
           Applied via the chatter-scroll utility class. */
        :global(.chatter-scroll) {
          scrollbar-width: thin;
          scrollbar-color: rgba(242, 148, 76, 0.4) rgba(255, 255, 255, 0.03);
        }
        :global(.chatter-scroll)::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        :global(.chatter-scroll)::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
          margin: 4px 0;
        }
        :global(.chatter-scroll)::-webkit-scrollbar-thumb {
          background: linear-gradient(
            to bottom,
            rgba(242, 148, 76, 0.55),
            rgba(224, 122, 31, 0.5)
          );
          border-radius: 8px;
          border: 2px solid transparent;
          background-clip: padding-box;
          transition: background 180ms ease;
        }
        :global(.chatter-scroll)::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(
            to bottom,
            rgba(242, 148, 76, 0.85),
            rgba(224, 122, 31, 0.8)
          );
          background-clip: padding-box;
        }
        :global(.chatter-scroll)::-webkit-scrollbar-corner {
          background: transparent;
        }
      `}</style>
    </section>
  );
}

/** Full-width WhatsApp community section. Sits below the chat panel
 *  in the same dark band. No outer card wrapper per design — the four
 *  cards do the visual lifting themselves; the heading sits flush.
 *
 *  Subheading total is computed by summing the per-group counts (not
 *  the separate `community_total_members` row) so the headline number
 *  always matches what's visible in the cards below — no risk of
 *  divergence between the two SiteCounter sources. */
function WhatsappCommunitySection({
  countsByKey,
}: {
  countsByKey: Record<string, number>;
}) {
  const total = WHATSAPP_CTAS.reduce(
    (sum, cta) => sum + (countsByKey[cta.counterKey] ?? 0),
    0,
  );
  return (
    <section
      aria-labelledby="join-community-heading"
      className="mt-8 sm:mt-10"
    >
      <div className="mb-5 sm:mb-6 grid gap-3">
        <h3
          id="join-community-heading"
          className="font-fraunces text-xl sm:text-2xl text-cream-50 inline-flex items-center gap-2"
        >
          <span className="text-leaf-400 inline-flex">
            <WhatsappGlyph size={22} />
          </span>
          Join the chat on WhatsApp
        </h3>
        {total > 0 ? (
          // Hero number block: enormous WHITE count with a brighter
          // emerald glow underneath, plus a LIVE pulse pill. On the
          // dark chatter band the leaf-green-on-dark we tried first
          // read as muddy and low-contrast (user feedback). White
          // + emerald-shadow keeps the brand colour relationship but
          // delivers the contrast a hero number needs.
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="font-numerals font-extrabold tabular-nums leading-none text-white drop-shadow-[0_0_18px_rgba(74,222,128,0.5)]"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}
            >
              {total.toLocaleString("en-IN")}
            </span>
            <p className="text-sm sm:text-base text-cream-50/85 leading-snug font-medium">
              Lucknow neighbours already in the chat, sharing live bhandara drops, photos and pins.{" "}
              <span className="text-cream-50">
                Pick your circle and join in.
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm sm:text-base text-cream-50/80 leading-snug">
            Hop into the community that fits. Ask where today&apos;s
            bhandara is, share what you find, or just listen in.
          </p>
        )}
      </div>

      <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {WHATSAPP_CTAS.map((cta) => (
          <li key={cta.href}>
            <WhatsappCard
              cta={cta}
              count={countsByKey[cta.counterKey] ?? null}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function WhatsappCard({
  cta,
  count,
}: {
  cta: (typeof WHATSAPP_CTAS)[number];
  count: number | null;
}) {
  const isChannel = cta.kind === "channel";
  const kindLabel =
    cta.kind === "community"
      ? "Community"
      : cta.kind === "group"
        ? "Group"
        : "Channel";
  return (
    <a
      href={cta.href}
      target="_blank"
      rel="noopener noreferrer"
      className="chatter-glass chatter-glass-hover relative block rounded-2xl p-4 h-full focus:outline-none focus:ring-2 focus:ring-saffron-500/60"
    >
      {/* Top row: kind-specific tile (community=WA glyph, group=people
          glyph + WA badge, channel=megaphone + WA badge) + textual
          kind chip on the right. The composite tile makes the kind
          scannable without reading the chip text. */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <WhatsappKindTile kind={cta.kind} iconUrl={cta.iconUrl} label={cta.label} />
        <span className="text-[9px] font-bold uppercase tracking-wider rounded-full bg-black/50 backdrop-blur-sm text-cream-50/85 px-2 py-0.5">
          {kindLabel}
        </span>
      </div>

      <h4 className="font-fraunces text-base sm:text-lg text-cream-50 leading-tight mb-1">
        {cta.label}
      </h4>
      <p className="text-xs text-cream-50/65 leading-snug mb-3">
        {cta.blurb}
      </p>

      {/* Bottom row: HERO member count + join CTA. The count is the
          single most-actionable signal on this card ("3,975 people are
          already here") so it gets the biggest, boldest typography on
          the card. Gradient + drop-shadow give it visual lift over the
          frosted glass; the subscribers/members label sits tucked
          underneath so the number reads alone at a glance. */}
      <div className="flex items-end justify-between gap-3 mt-auto">
        {count !== null && count > 0 ? (
          <span className="inline-flex flex-col items-start leading-none">
            <span
              className="font-numerals font-extrabold tabular-nums leading-none text-white drop-shadow-[0_0_18px_rgba(74,222,128,0.55)]"
              style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.5rem)" }}
            >
              {count.toLocaleString("en-IN")}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.16em] font-semibold text-emerald-300/90">
              {isChannel ? "subscribers" : "members"}
            </span>
          </span>
        ) : (
          <span className="text-xs text-cream-50/50" aria-hidden>
            ·
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-3 py-1.5 text-xs font-semibold shadow-[0_4px_14px_-4px_rgba(16,185,129,0.7)] ring-1 ring-emerald-400/50 shrink-0 hover:from-emerald-400 hover:to-emerald-500 transition-colors">
          {isChannel ? "Follow" : "Join"} →
        </span>
      </div>
    </a>
  );
}

/** "LIVE · 12 mentions" badge. Solid-black pill with a green
 *  pulsing dot. Reads like a broadcast-control tally: the green dot
 *  is the universal "on-air" signal, the black pill keeps it from
 *  competing visually with the saffron palette used everywhere else
 *  in the section. Border + shadow give it just enough lift to read
 *  as interactive on a busy backdrop. */
function LivePulseBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-black text-cream-50 px-3 py-1.5 border border-cream-50/15 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <span className="relative inline-block w-2 h-2 text-leaf-600">
        <span
          aria-hidden
          className="live-pulse-dot absolute inset-0 rounded-full bg-leaf-600"
        />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream-50">
        Live
      </span>
      <span aria-hidden className="h-3 w-px bg-cream-50/20" />
      <span className="text-xs font-semibold tabular-nums text-cream-50/95">
        {count} mention{count === 1 ? "" : "s"}
      </span>
    </span>
  );
}

/** Section-level LIVE pill that sits inline with the main "What people
 *  are talking about?" heading. Marks the whole section as live —
 *  previously this pill sat next to the 9,652 community total; moved
 *  here so the live-state signal reads as section-wide rather than
 *  tied to that single number. */
function SectionLiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-emerald-400/15 text-emerald-300 text-[9px] font-semibold uppercase tracking-[0.16em] ring-1 ring-emerald-400/40 leading-none">
      <span className="relative inline-block w-1.5 h-1.5">
        <span
          aria-hidden
          className="live-pulse-dot absolute inset-0 rounded-full bg-emerald-400"
        />
      </span>
      <span className="leading-none py-0.5">live</span>
    </span>
  );
}

function PhotoCountChip({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-leaf-400/50 text-leaf-400 px-2.5 py-1 text-xs font-medium shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)]">
      <span aria-hidden>📷</span>
      <span className="tabular-nums">{count}</span>
      <span className="text-cream-50/80">live photo{count === 1 ? "" : "s"}</span>
    </span>
  );
}

function CommunityCountChip({ count }: { count: number }) {
  const display = useCountUp(count);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-cream-50/25 text-cream-50 px-2.5 py-1 text-xs font-medium shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)]">
      <span aria-hidden className="text-leaf-400">
        <PeopleIcon />
      </span>
      <span className="tabular-nums font-semibold">
        {display.toLocaleString("en-IN")}
      </span>
      <span className="text-cream-50/75">members</span>
    </span>
  );
}

function useCountUp(target: number): number {
  const [display, setDisplay] = useState(target);
  useEffect(() => {
    const from = display;
    const delta = target - from;
    if (delta === 0) return;
    const startedAt = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const elapsed = t - startedAt;
      const progress = Math.min(1, elapsed / COUNTUP_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(from + delta * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return display;
}

function ChatBubble({
  mention,
  isNew,
  isLast,
}: {
  mention: ChatterMention;
  isNew: boolean;
  isLast: boolean;
}) {
  const intent = intentLabel(mention.intent);
  const avatar = avatarSlot(mention.senderName ?? mention.id);
  const initial = avatarInitial(mention.senderName);
  const name = displayName(mention.senderName);
  const hasCoords = mention.lat !== null && mention.lng !== null;
  // ASKING bubbles must not surface ANY location-based action —
  // no Directions CTA, no map-deep-link on the photo, no location
  // pill below the message. The user is asking IF something's
  // happening there; exposing a "Get directions" or pin pill would
  // misread as "there IS a bhandara here". Same rule that filters
  // them out of the heatmap + active-areas chips. Locations stay on
  // the DB row for admin triage.
  const showLocationActions = mention.intent !== "ASKING";
  const directionsHref =
    showLocationActions && hasCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${mention.lat},${mention.lng}`
      : null;
  const photoHref =
    showLocationActions && hasCoords
      ? `https://www.google.com/maps?q=${mention.lat},${mention.lng}&z=17`
      : null;
  const showLocationPill = showLocationActions && !!mention.locationLabel;

  return (
    <li
      className={[
        "relative px-3 py-2.5",
        "transition-colors hover:bg-cream-50/[0.035]",
        !isLast ? "border-b border-cream-50/10" : "",
        isNew ? "chatter-bubble--new" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full ${avatar.bg} ${avatar.text} ring-1 ${avatar.ring} text-[10px] font-bold leading-none shadow-[0_2px_6px_-2px_rgba(0,0,0,0.6)]`}
          aria-hidden
        >
          {initial}
        </span>
        <div className="flex items-baseline gap-1.5 min-w-0 flex-1 leading-tight">
          <span className="text-sm font-semibold text-cream-50 truncate">
            {name}
          </span>
          <span className={`text-[11px] ${intent.className} truncate`}>
            {intent.text}
          </span>
        </div>
        {directionsHref ? (
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-saffron-500 to-saffron-600 hover:from-saffron-500 hover:to-saffron-500 text-cream-50 px-2.5 py-1 text-[11px] font-medium shadow-[0_2px_8px_-2px_rgba(242,148,76,0.55)] transition-all"
            title="Get directions"
          >
            <ArrowIcon />
            <span className="hidden sm:inline">Directions</span>
          </a>
        ) : null}
      </div>

      <div className="pl-8 mt-1 grid gap-1">
        {mention.photoUrl ? (
          <a
            href={photoHref ?? mention.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block rounded-xl overflow-hidden border border-cream-50/15 bg-ink-900 max-w-[11rem] hover:border-saffron-500/60 transition-colors"
            aria-label="Open photo / location"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mention.photoUrl}
              alt={mention.text}
              loading="lazy"
              className="w-full h-auto max-h-36 object-cover group-hover:scale-[1.03] transition-transform duration-300"
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] font-medium text-cream-50 opacity-0 group-hover:opacity-100 transition-opacity">
              Open ↗
            </span>
          </a>
        ) : null}
        <p className="text-sm text-cream-50/95 leading-snug whitespace-pre-wrap break-words">
          {mention.text}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-cream-50/55 mt-0">
          {showLocationPill ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-cream-50/85">
              <PinIcon />
              {mention.locationLabel}
            </span>
          ) : null}
          <span>{relativeTime(new Date(mention.createdAt))}</span>
          {mention.bhandaraSlug ? (
            <a
              href={`/bhandara/${mention.bhandaraSlug}`}
              className="ml-0.5 inline-flex items-center gap-0.5 text-leaf-400 hover:text-leaf-400/80 underline decoration-dotted underline-offset-2"
            >
              View bhandara →
            </a>
          ) : null}
          {mention.kind === "spot" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-leaf-400">
              <span aria-hidden>📷</span>
              Photo
            </span>
          ) : null}
        </div>
      </div>

      {isNew ? (
        <span className="absolute top-1.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-br from-saffron-500 to-saffron-600 text-cream-50 text-[9px] font-bold uppercase tracking-wider shadow">
          New
        </span>
      ) : null}
    </li>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  );
}

/** WhatsApp brand glyph. Canonical Simple Icons path (viewBox 24×24),
 *  cleaner curves than the hand-simplified version we were using
 *  before — at 16-22px the old path's tail rendered as a wobbly
 *  squashed "W" against the leaf-green tile. Defaults to filling its
 *  natural 16×16, parents can override via inline width/height. */
function WhatsappGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.825 9.825 0 0 1 6.988 2.898 9.831 9.831 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.465 3.488" />
    </svg>
  );
}

/** People / group glyph for the "group" kind tile. Solid silhouettes —
 *  three heads + shoulders — to read instantly at 22px on a busy card
 *  thumbnail. ViewBox 24×24 so it lines up with the WhatsApp + chat
 *  glyphs in this file. */
function PeopleGroupGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
    >
      <path d="M12 12.75a3.375 3.375 0 1 0 0-6.75 3.375 3.375 0 0 0 0 6.75ZM5.25 9.75a2.625 2.625 0 1 0 0-5.25 2.625 2.625 0 0 0 0 5.25Zm13.5 0a2.625 2.625 0 1 0 0-5.25 2.625 2.625 0 0 0 0 5.25ZM4.5 11.25c-1.74 0-3.25.86-4.18 2.18A1 1 0 0 0 1.14 15h3.42c.13-1.18.68-2.27 1.52-3.13A4.86 4.86 0 0 0 4.5 11.25Zm15 0c-.6 0-1.16.11-1.68.3.84.86 1.39 1.95 1.52 3.13h3.42a1 1 0 0 0 .82-1.57A4.96 4.96 0 0 0 19.5 11.25Zm-7.5 2.25c-2.92 0-5.47 1.55-6.74 3.83a1 1 0 0 0 .87 1.42h11.74a1 1 0 0 0 .87-1.42C17.47 15.05 14.92 13.5 12 13.5Z" />
    </svg>
  );
}

/** Megaphone / loudspeaker glyph for the "channel" kind tile. A
 *  broadcast horn pointed up-right with a faint sound wave — reads as
 *  "one-to-many announcement" at a glance, the right metaphor for a
 *  WhatsApp Channel (broadcast-only, no replies). */
function MegaphoneGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
    >
      <path d="M20.25 4.533a.75.75 0 0 1 1.16-.628c.36.227.59.6.59 1.015v14.16a1.2 1.2 0 0 1-.59 1.015.75.75 0 0 1-1.16-.628V18.5a17.9 17.9 0 0 0-8.25-2.13v2.13a3.75 3.75 0 1 1-7.5 0v-2.43a3.75 3.75 0 0 1-1.5-3v-2.14a3.75 3.75 0 0 1 3.75-3.75H12a17.9 17.9 0 0 0 8.25-2.13V4.533ZM6.75 16.5v2a2.25 2.25 0 0 0 4.5 0v-1.94c-1.5-.04-3-.07-4.5-.06Z" />
    </svg>
  );
}

/** Chat bubble outline glyph. Replacement for the 💬 emoji in the
 *  Live chat panel header — sharper, single-color, and inherits
 *  currentColor so it tints cleanly with the cream-50 text it sits
 *  next to. */
function ChatBubbleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a8.5 8.5 0 0 1-12.4 7.55L3.5 21l1.45-5.1A8.5 8.5 0 1 1 21 12Z" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
    </svg>
  );
}

/** Composite kind tile for the homepage WhatsApp cards.
 *  - community: a single WA glyph in the leaf-green tile
 *  - group:     people glyph in the tile + small WA badge bottom-right
 *  - channel:   megaphone glyph in the tile + small WA badge bottom-right
 *  Optional `iconUrl` (community/group/channel profile picture) wins
 *  over the glyph when present so we can later swap in real WA avatars
 *  the bot fetches. Badge is ringed in the card background so it reads
 *  as floating over the tile, not a flat overlay. */
function WhatsappKindTile({
  kind,
  iconUrl,
  label,
}: {
  kind: "community" | "group" | "channel";
  iconUrl: string | null;
  label: string;
}) {
  if (iconUrl) {
    return (
      <span className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          className="w-10 h-10 rounded-xl object-cover ring-1 ring-cream-50/15 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.6)]"
        />
        {kind !== "community" ? <WhatsappBadge /> : null}
      </span>
    );
  }
  return (
    <span
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-leaf-600 to-leaf-600/80 text-cream-50 shadow-[0_4px_14px_-4px_rgba(63,122,63,0.7)] ring-1 ring-leaf-600/40"
      aria-label={`${kind === "community" ? "Community" : kind === "group" ? "Group" : "Channel"}: ${label}`}
    >
      {kind === "community" ? (
        <WhatsappGlyph size={20} />
      ) : kind === "group" ? (
        <PeopleGroupGlyph size={22} />
      ) : (
        <MegaphoneGlyph size={20} />
      )}
      {kind !== "community" ? <WhatsappBadge /> : null}
    </span>
  );
}

/** Small floating WA brand badge that sits on the bottom-right of the
 *  group / channel kind tiles to keep the platform identity clear when
 *  the primary glyph is a people group or megaphone. White disc with
 *  a leaf-green WA glyph, ringed in the card background for contrast. */
function WhatsappBadge() {
  return (
    <span
      aria-hidden
      className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-cream-50 text-leaf-600 ring-2 ring-[#1a1410] shadow-[0_2px_6px_-1px_rgba(0,0,0,0.5)]"
    >
      <WhatsappGlyph size={11} />
    </span>
  );
}

function relativeTime(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
