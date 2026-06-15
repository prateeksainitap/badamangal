"use client";

/**
 * "What people are talking about?", homepage live chatter section.
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
import GalleryLightbox, {
  type GalleryItem,
} from "@/components/GalleryLightbox";
import { useT } from "@/lib/useT";
import { trackEvent } from "@/lib/ga";

export type ChatterMention = {
  id: string;
  kind: "mention" | "spot";
  text: string;
  language: string;
  intent: "ASKING" | "SHARING" | "MENTIONING";
  locationLabel: string | null;
  /** When Gemini extracts MULTIPLE locations from one message ("Kamta,
   *  Chinhat ya amity?"), the server inserts one mention row per
   *  location so the heatmap can plant a pin for each. The chat panel
   *  collapses those rows back into ONE bubble (same text + same sender
   *  shouldn't read as three identical bubbles) and surfaces all
   *  location chips here. Populated client-side by the groupedMentions
   *  rollup below; the API still returns one mention per location.
   *  Null/empty = single-location, fall back to `locationLabel`. */
  locationLabels?: string[];
  lat: number | null;
  lng: number | null;
  locationSource: string;
  /** Primary photo (back-compat). Kept alongside photoUrls so existing
   *  consumers (heatmap, deep-link generators) keep working. */
  photoUrl: string | null;
  /** All photos in display order (primary first, then up to 4 extras
   *  from Spot.extraPhotoUrls). Empty for text mentions. The chat
   *  bubble renders this as an in-card carousel when length > 1. */
  photoUrls?: string[];
  /** When the WA message was a reply, the quoted text + best-effort
   *  sender name. Chat bubble renders these as a small indented
   *  context strip above the main text. */
  quotedText?: string | null;
  quotedSender?: string | null;
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  senderName: string | null;
  createdAt: string;
};

type FeedResp = {
  count: number;
  mentions: ChatterMention[];
  /** Server-clock ISO timestamp captured BEFORE the query ran on
   *  /api/mentions/feed. The polling tick passes this back as
   *  `?since=` next request to avoid a race where a mention whose
   *  approvedAt landed between query-run and response-receive
   *  would be skipped by the next poll. */
  fetchedAt?: string;
};

const POLL_MS = 20_000;
const TIME_TICK_MS = 15_000;
// 500 covers a peak Tuesday with plenty of headroom. Empirically the
// 4th Bada Mangal of 2026 produced 244+ live signals (listed + spots
// + mentions) within the first 12 hours, plus 14 WhatsApp groups
// feeding the bot. 200 (the previous cap) was truncating the panel
// after about a half-day of activity on busy Tuesdays, operators
// scrolling for earlier context lost rows mid-conversation.
// The 24h TTL on mention rows still bounds the natural upper end.
// 500 cards is comfortable for modern mobile browsers (no virtualisation
// needed at this size; React's keyed re-render handles it fine).
const MAX_CARDS = 500;
const NEW_GLOW_MS = 6_000;
const AUTOSCROLL_THRESHOLD_PX = 80;
const COUNTUP_DURATION_MS = 1200;

/** Days of the IST week when the bot actively forwards messages and
 *  the live chat is "open". 0 = Sunday, 2 = Tuesday, 6 = Saturday.
 *  Bada Mangal is Tuesday-centric; Saturday added per operator note
 *  (Shani / Hanuman community activity). */
const LIVE_CHAT_OPEN_DAYS = new Set<number>([2, 6]);
const DAY_NAMES_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_NAMES_HI = [
  "रविवार",
  "सोमवार",
  "मंगलवार",
  "बुधवार",
  "गुरुवार",
  "शुक्रवार",
  "शनिवार",
];
function dayName(day: number, isHi: boolean): string {
  return (isHi ? DAY_NAMES_HI : DAY_NAMES_EN)[day] ?? "";
}

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
  labelHi: string;
  blurb: string;
  blurbHi: string;
  href: string;
  kind: "community" | "group" | "channel";
  iconUrl: string | null;
}> = [
  {
    counterKey: "bada_mangal_community",
    label: "Bada Mangal Community",
    labelHi: "बड़ा मंगल कम्युनिटी",
    blurb:
      "The biggest Lucknow circle for Bada Mangal news and bhandara invites.",
    blurbHi:
      "बड़ा मंगल की ख़बरें और भंडारा निमंत्रण का सबसे बड़ा लखनऊ सर्किल।",
    href: "https://chat.whatsapp.com/H3HqNV4rOPi6xWU5O93fFv",
    kind: "community",
    iconUrl: null,
  },
  {
    counterKey: "balaji_bhandara_community",
    label: "Balaji ka Bhandara",
    labelHi: "बालाजी का भंडारा",
    blurb:
      "Volunteer-run hub for Balaji bhandara coordination across the city.",
    blurbHi:
      "शहर भर में बालाजी भंडारा समन्वय का स्वयंसेवक केंद्र।",
    href: "https://chat.whatsapp.com/GACGY3qEiIHA5tCxV3FQzB",
    kind: "community",
    iconUrl: null,
  },
  {
    counterKey: "bhandara_group",
    label: "Bhandara Group",
    labelHi: "भंडारा ग्रुप",
    blurb:
      "Standalone group with real-time location and photo drops from the field.",
    blurbHi:
      "मैदान से लाइव स्थान और तस्वीरें साझा करने वाला अलग ग्रुप।",
    href: "https://chat.whatsapp.com/FNtgNhFUmqaI6MMUt1M673",
    kind: "group",
    iconUrl: null,
  },
  {
    counterKey: "bada_mangal_channel",
    label: "Bada Mangal Channel",
    labelHi: "बड़ा मंगल चैनल",
    blurb:
      "One-way broadcast for official updates, prep guides and prasad timings.",
    blurbHi:
      "आधिकारिक अपडेट, गाइड और प्रसाद के समय का ब्रॉडकास्ट चैनल।",
    href: "https://whatsapp.com/channel/0029Vb7wV4g9sBI6xxYsDw0C",
    kind: "channel",
    iconUrl: null,
  },
];

/** Avatar palette, keyed off the sender name hash so the same person
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

function intentLabel(
  intent: ChatterMention["intent"],
  isHi: boolean,
): { text: string; className: string } {
  switch (intent) {
    case "ASKING":
      return {
        text: isHi ? "पूछ रहे हैं" : "is asking",
        className: "text-saffron-500",
      };
    case "SHARING":
      // leaf-400 (not -600) on the dark chatter band so the inline
      // intent label clears WCAG AA 4.5:1 contrast on ink-900.
      return {
        text: isHi ? "बता रहे हैं" : "is sharing",
        className: "text-leaf-400",
      };
    default:
      return {
        text: isHi ? "ज़िक्र किया" : "mentioned",
        className: "text-gold-500",
      };
  }
}

function avatarInitial(name: string | null | undefined): string {
  if (!name) return "?";
  const cleaned = name.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const first = cleaned.charAt(0);
  return first ? first.toUpperCase() : "?";
}

function displayName(name: string | null | undefined, isHi: boolean): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return isHi ? "अज्ञात" : "Anonymous";
  // Privacy: only the first name lands on the public chat panel.
  // WhatsApp push-names commonly arrive as `~ First Last`, `~First Last`,
  // or even with emoji prefixes / suffixes, so we strip any leading
  // non-letter-non-digit garbage, then take the first whitespace-
  // separated word. Surnames never appear publicly even though the DB
  // row keeps the full name for admin moderation.
  const cleaned = trimmed.replace(/^[^\p{L}\p{N}]+/u, "");
  const firstWord = cleaned.split(/\s+/)[0] ?? "";
  if (!firstWord) return isHi ? "अज्ञात" : "Anonymous";
  return firstWord.length > 22 ? firstWord.slice(0, 21) + "…" : firstWord;
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
   *  Missing keys render as ", " in the card. */
  communityCountsByKey: Record<string, number>;
}) {
  const [mentions, setMentions] = useState<ChatterMention[]>(initial);
  // Lightbox state shared across all chat bubbles. A click on any
  // photo opens GalleryLightbox with the bubble's photo array as the
  // navigable set, same overlay component the HomepageGallery
  // section uses, so the visual treatment + keyboard nav + escape /
  // arrow shortcuts all match.
  const [lightbox, setLightbox] = useState<{
    items: GalleryItem[];
    index: number;
  } | null>(null);
  const openLightbox = useCallback(
    (items: GalleryItem[], index: number) => {
      setLightbox({ items, index });
    },
    [],
  );
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const navigateLightbox = useCallback((next: number) => {
    setLightbox((prev) =>
      prev ? { items: prev.items, index: next } : prev,
    );
  }, []);
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

  const { locale } = useT();
  const isHi = locale === "hi";

  // Compute the chat-open state ONCE per render. Re-renders happen
  // on every poll tick (12s) + the 15s time tick, so the state
  // refreshes naturally without needing a midnight-IST cron, it
  // flips on the next render after the day changes.
  const today = todayDayIST();
  const isChatOpen = LIVE_CHAT_OPEN_DAYS.has(today);
  const nextOpenDay = nextOpenDayIST();
  const nextOpenLabel = isChatOpen
    ? isHi ? "आज" : "today"
    : dayName(nextOpenDay, isHi);
  // Most-recent past open day used for the off-day chat title
  // ("Saturday's chat", "Tuesday's chat"). On open days this equals
  // today, but we don't use the label on open days anyway.
  let lastOpenDay = today;
  for (let offset = 0; offset < 7; offset++) {
    const d = (today - offset + 7) % 7;
    if (LIVE_CHAT_OPEN_DAYS.has(d)) {
      lastOpenDay = d;
      break;
    }
  }
  const lastOpenLabel = dayName(lastOpenDay, isHi);

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
      // Use the server-provided `fetchedAt` (captured BEFORE the
      // query ran) for the next `?since=`. Fall back to the local
      // clock only if the server didn't return one (old build, etc).
      // Without this, the millisecond-level race between query-run
      // and response-receive silently dropped any mention whose
      // approvedAt landed in that window. id-based dedup further
      // down still collapses any rows the small overlap fetches twice.
      lastFetchAtRef.current =
        data.fetchedAt ?? new Date().toISOString();
      if (data.mentions.length === 0) return;
      const body = chatBodyRef.current;
      const userAtTop = body ? body.scrollTop <= AUTOSCROLL_THRESHOLD_PX : true;
      setMentions((prev) => {
        // Merge polled payload with the existing list in TWO ways:
        //   1. New ids (not in prev)        → prepend to the head
        //   2. Existing ids with new values → update in place
        //
        // The old logic only handled case 1, which meant an admin
        // edit to a spot's caption/area/photo never propagated to
        // the chat panel (the polled object had the new fields but
        // was filtered out by `seen` and discarded). Real production
        // complaint Tuesday-1: operator fixed a spot caption in
        // /admin/edit-spot, but the same row in the public live-chat
        // kept showing Gemini's verbose original until the row
        // expired out of the 200-card window. Now updates flow.
        const polledById = new Map(
          data.mentions.map((m) => [m.id, m] as const),
        );
        const fresh = data.mentions.filter(
          (m) => !prev.some((p) => p.id === m.id),
        );
        // Field-by-field equality check so we only re-render when a
        // polled entry genuinely differs from the cached one. Avoids
        // a wholesale state replace + DOM reconcile every 12 s on
        // an idle feed.
        function sameShape(a: ChatterMention, b: ChatterMention): boolean {
          return (
            a.text === b.text &&
            a.locationLabel === b.locationLabel &&
            a.photoUrl === b.photoUrl &&
            a.senderName === b.senderName &&
            a.intent === b.intent &&
            (a.lat ?? null) === (b.lat ?? null) &&
            (a.lng ?? null) === (b.lng ?? null) &&
            (a.bhandaraSlug ?? null) === (b.bhandaraSlug ?? null) &&
            (a.bhandaraName ?? null) === (b.bhandaraName ?? null) &&
            JSON.stringify(a.photoUrls ?? []) ===
              JSON.stringify(b.photoUrls ?? [])
          );
        }
        let updateCount = 0;
        const merged = prev.map((existing) => {
          const polled = polledById.get(existing.id);
          if (!polled || sameShape(existing, polled)) return existing;
          updateCount++;
          return polled;
        });
        if (fresh.length === 0 && updateCount === 0) return prev;
        const now = Date.now();
        for (const f of fresh) firstSeenRef.current.set(f.id, now);
        if (!userAtTop && fresh.length > 0) {
          setNewSinceScrollAway((n) => n + fresh.length);
        }
        // Cap-hit instrumentation: log when the slice truncates so a
        // future Tuesday where MAX_CARDS is too tight shows up in
        // browser console + Vercel client logs instead of silently
        // dropping the tail. Logged once per merge tick (not per row).
        const combinedLen = fresh.length + merged.length;
        if (combinedLen > MAX_CARDS) {
          console.warn(
            `[LiveChatterBoard] cap hit: ${combinedLen} merged rows clamped to ${MAX_CARDS} (consider bumping MAX_CARDS).`,
          );
        }
        return [...fresh, ...merged].slice(0, MAX_CARDS);
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

  // Section-view event, fires ONCE per page load when the live
  // chat / heatmap section becomes 50%+ visible. Lets us measure
  // how many homepage visitors actually scroll far enough to see
  // the live feature, vs how many bail above the fold. Using the
  // section's root ID (set via id="live-chat" on the outer
  // <section>) means we don't need a separate ref. IntersectionObserver
  // is widely supported; we early-return on environments without it
  // so the rest of the panel still works (a stale Edge / iOS 11
  // user, etc).
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const node = document.getElementById("live-chat");
    if (!node) return;
    let fired = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5 && !fired) {
            fired = true;
            trackEvent("section_view_live_chat", {
              area_chip_count: String(areaCounts.length),
              mention_count: String(mentions.length),
              spot_count: String(spotCount),
            });
            io.disconnect();
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(node);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const body = chatBodyRef.current;
    if (!body) return;
    if (body.scrollTop <= AUTOSCROLL_THRESHOLD_PX) {
      body.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [mentions]);

  // Collapse multi-location splits into single chat bubbles.
  //
  // Gemini's classifier extracts each distinct location from a message
  // ("Kamta, Chinhat ya amity?" → 3 locations) and the server inserts
  // one BhandaraMention row per location so the heatmap can plant a
  // pin for each. The chat panel rendering that data as 3 identical
  // bubbles makes the panel look like the same message is being posted
  // multiple times, confusing.
  //
  // Rollup rule: walk mentions newest-first; rows with the same
  // sender + normalised text within 5 minutes of each other merge
  // into the FIRST (newest) row, accumulating their locationLabels
  // onto the merged entry's `locationLabels` array. The single chat
  // bubble then renders one chip per location.
  //
  // 5-minute window keeps legitimately-repeated messages from the
  // same sender (an hour-apart re-post for emphasis) as separate
  // bubbles. Heatmap still consumes the raw `mentions` array so each
  // location gets its own pin, only the chat panel collapses.
  const groupedMentions = useMemo(() => {
    const normaliseText = (s: string | null | undefined) =>
      (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    const MERGE_WINDOW_MS = 5 * 60 * 1000;
    const out: ChatterMention[] = [];
    const keyToIndex = new Map<string, number>();
    for (const m of mentions) {
      const sender = (m.senderName ?? "").trim();
      const text = normaliseText(m.text);
      if (!sender || !text || m.kind === "spot") {
        // Spots never collapse, every photo is its own event even
        // if two spotters happen to caption the exact same string.
        out.push(m);
        continue;
      }
      const key = sender + "::" + text;
      const existingIdx = keyToIndex.get(key);
      if (existingIdx !== undefined) {
        const existing = out[existingIdx];
        const dt = Math.abs(
          new Date(existing.createdAt).getTime() - new Date(m.createdAt).getTime(),
        );
        if (dt <= MERGE_WINDOW_MS) {
          const labels = existing.locationLabels
            ? [...existing.locationLabels]
            : existing.locationLabel
              ? [existing.locationLabel]
              : [];
          if (m.locationLabel && !labels.includes(m.locationLabel)) {
            labels.push(m.locationLabel);
          }
          out[existingIdx] = { ...existing, locationLabels: labels };
          continue;
        }
      }
      out.push({
        ...m,
        locationLabels: m.locationLabel ? [m.locationLabel] : [],
      });
      keyToIndex.set(key, out.length - 1);
    }
    return out;
  }, [mentions]);

  // Heatmap input, exclude ASKING messages.
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
          // Heatmap is map-only, drop ASKING (questions, not
          // sightings) AND drop 0,0 "null island" spots that the
          // feed deliberately still includes for the chat panel.
          m.intent !== "ASKING" &&
          m.lat !== null &&
          m.lng !== null &&
          m.lat !== 0 &&
          m.lng !== 0,
      ),
    [mentions],
  );

  // Same rule for the "Active areas:" chip strip. An asking mention
  // about Hazratganj shouldn't add to Hazratganj's bhandara-activity
  // tally, "asking about" is a question, not a sighting.
  //
  // Active-areas chip text strips the landmark prefix down to the
  // bare area name: "Kothari Bandhu Park, Rajajipuram" → "Rajajipuram",
  // "2/36 Vibhav Khand, Gomti Nagar" → "Gomti Nagar", "Aashiyana" →
  // "Aashiyana". Mentions across landmarks in the same area roll up
  // to one chip with the combined count. The chat-bubble pill still
  // renders the full precise locationLabel so the reader sees the
  // actual venue inside the message; only the section-level summary
  // collapses to the area.
  //
  // No top-N cap: every area that has at least one mention surfaces
  // a chip. We used to slice to top-8 by count, which silently dropped
  // genuinely-active neighbourhoods (Rajajipuram, etc.) the moment
  // they fell behind a single bigger area. The wrap layout below
  // handles overflow naturally, busy Tuesday days flow to two or
  // three rows of chips instead of hiding signal.
  const areaCounts = useMemo(() => {
    const counts = new Map<
      string,
      { display: string; count: number; mostRecent: number }
    >();
    for (const m of mentions) {
      if (m.intent === "ASKING") continue;
      const full = m.locationLabel?.trim();
      if (!full) continue;
      // Right-most comma segment carries the area. When there's no
      // comma (e.g. "Aashiyana") the whole string IS the area.
      const segments = full.split(",").map((s) => s.trim()).filter(Boolean);
      const area = segments.length > 0 ? segments[segments.length - 1] : full;
      if (!area) continue;
      // Whitespace-insensitive dedupe key so "Rajaji Puram" + "Rajajipuram"
      // and "Gomti Nagar" + "Gomtinagar" roll up into a single chip
      // with the combined count. Without this normalisation, the same
      // neighbourhood would appear twice (each below the threshold to
      // even feature visibly) and the operator misses the real signal.
      const k = area.toLowerCase().replace(/\s+/g, "");
      const ts = new Date(m.createdAt).getTime();
      const existing = counts.get(k);
      if (existing) {
        existing.count += 1;
        if (ts > existing.mostRecent) existing.mostRecent = ts;
      } else {
        counts.set(k, { display: area, count: 1, mostRecent: ts });
      }
    }
    return Array.from(counts.values()).sort(
      (a, b) => b.count - a.count || b.mostRecent - a.mostRecent,
    );
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

  // Click handler for the active-area chips above the chat panel.
  // Finds the FIRST chat bubble whose data-areas attribute contains
  // the chosen area key (lowercased + right-most-comma-segment, same
  // extraction the chip strip uses) and smooth-scrolls it to the top
  // of the chat-body viewport. Bubbles are already sorted newest-
  // first, so "first match" = most recent mention from that area.
  //
  // We scroll inside chatBodyRef (NOT the document) so the page
  // doesn't lurch, the chat panel stays where it is on the
  // viewport while the panel's internal list scrolls to surface
  // the matching bubble. On narrow viewports where the chat panel
  // is below the heatmap, we also bring the panel into the
  // viewport with a one-shot scrollIntoView.
  const scrollToArea = useCallback((displayLabel: string) => {
    const body = chatBodyRef.current;
    if (!body) return;
    // Slugify the same way the bubbles do, whitespace is COLLAPSED
    // (not hyphenated) so "Rajaji Puram" and "Rajajipuram" both
    // resolve to the same key ("rajajipuram") and a click on the
    // merged chip finds bubbles tagged with either spelling.
    // Multi-word areas like "Vrindavan Yojna" become "vrindavanyojna"
    //, ugly as a slug but invisible to the user; it just has to
    // match the bubble's data-areas value exactly via the `~=`
    // selector below, which splits on whitespace.
    const key = displayLabel.toLowerCase().trim().replace(/\s+/g, "");
    if (!key) return;
    // Reset the "new since scroll-away" badge so the user doesn't
    // see a stale "5 new" pill after landing on the matching row.
    setNewSinceScrollAway(0);
    const target = body.querySelector<HTMLElement>(
      `[data-areas~="${CSS.escape(key)}"]`,
    );
    if (target) {
      // Scroll the chat-body container so the target sits a few
      // pixels below the top edge. getBoundingClientRect deltas
      // keep us inside chatBodyRef's scroll context.
      const rect = target.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      body.scrollTo({
        top: body.scrollTop + (rect.top - bodyRect.top) - 8,
        behavior: "smooth",
      });
      // Brief saffron flash on the matched bubble so the user
      // sees the connection between "I tapped Aashiyana" and
      // "this row is from Aashiyana". Re-uses the existing new-
      // bubble glow animation; 1.5s is long enough to register,
      // short enough to not linger as a permanent highlight.
      target.classList.add("chatter-bubble--new");
      window.setTimeout(
        () => target.classList.remove("chatter-bubble--new"),
        1500,
      );
    } else {
      // No bubble matched (rare, the chip is built from the same
      // mentions array, so a mismatch only happens if the data
      // changed mid-render). Fall back to scrolling to the top
      // so the click still does SOMETHING visible.
      body.scrollTo({ top: 0, behavior: "smooth" });
    }
    // On narrow viewports the panel can be below the fold, make
    // sure it's in view before the body-scroll lands. No-op on
    // desktop where chips + panel are already side-by-side.
    const panel = body.closest("[data-chat-panel]");
    if (panel) {
      const pr = panel.getBoundingClientRect();
      if (pr.top < 0 || pr.top > window.innerHeight * 0.5) {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, []);

  return (
    <section id="live-chat" className="relative bg-ink-900 text-cream-50 overflow-hidden">
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

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
        {/* Section header */}
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1.5">
            <h2 className="font-fraunces font-bold text-2xl sm:text-3xl lg:text-4xl text-cream-50 inline-flex items-center flex-wrap gap-x-3 gap-y-1.5 leading-tight">
              {/* SEO-aligned heading. Primary target keywords: "bhandaras
                  near me" + "on the map" + "live". The poetic "What
                  people are talking about?" version is captured in the
                  subtitle's rhythm so we don't lose the warmth. */}
              <span>
                {isHi
                  ? "आपके पास के भंडारे, मानचित्र पर लाइव"
                  : "Bhandaras near me, on the map and live in chat"}
              </span>
              {/* The green "live" pill is only shown on actual
                  live-chat days (Tue/Sat IST). On off-days the
                  heading reads as a feature description rather than
                  a state claim, so the pill would lie. */}
              {isChatOpen ? <SectionLiveBadge isHi={isHi} /> : null}
            </h2>
            <p className="text-sm sm:text-base text-cream-50/75 leading-snug">
              {isHi ? (
                <>
                  लखनऊ के WhatsApp समुदाय से लाइव भंडारा अपडेट।{" "}
                  <span className="text-saffron-500 font-medium">हर शेयर</span>,{" "}
                  <span className="text-saffron-500 font-medium">हर तस्वीर</span>
                  , पल भर में यहाँ। ऑटो-क्यूरेटेड, फ़िल्टर्ड, हमेशा चालू।
                </>
              ) : (
                <>
                  Real-time bhandara updates from Lucknow&apos;s WhatsApp community.{" "}
                  <span className="text-saffron-500 font-medium">Every share</span>,{" "}
                  <span className="text-saffron-500 font-medium">every photo</span>,{" "}
                  the second it lands. Auto-curated, profanity-filtered, always on.
                </>
              )}
            </p>
          </div>
          {/* Section-header chips. LIVE pill moved into the chat
              panel header below (it belongs next to "Live chat" so
              the connection state and the live count read together).
              These chips remain for at-a-glance photo + community
              totals across the whole section. */}
          <div className="flex items-center gap-2 flex-wrap">
            {spotCount > 0 ? <PhotoCountChip count={spotCount} isHi={isHi} /> : null}
            {communityMembers > 0 ? (
              <CommunityCountChip count={communityMembers} isHi={isHi} />
            ) : null}
          </div>
        </header>

        {/* Active area chips. Now clickable, tapping a chip scrolls
            the chat panel to its newest message and fires a GA
            event so we can measure which neighbourhoods drive the
            most attention. Hover lifts the border + saffron text
            into a brighter saffron-500/85 state. */}
        {areaCounts.length > 0 ? (
          <div className="mb-6 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-cream-50/60 mr-1">
              {isHi ? "सक्रिय इलाक़े:" : "Active areas:"}
            </span>
            {areaCounts.map((a, i) => (
              <button
                key={a.display}
                type="button"
                onClick={() => scrollToArea(a.display)}
                aria-label={
                  isHi
                    ? `${a.display}, ${a.count} ज़िक्र`
                    : `${a.display}, ${a.count} mentions`
                }
                data-ga="cta_chatter_area_chip"
                data-ga-area={a.display}
                data-ga-count={String(a.count)}
                data-ga-rank={String(i)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-saffron-500 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)] hover:bg-black/65 hover:text-saffron-500/95 hover:ring-1 hover:ring-saffron-500/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500/60"
              >
                <PinIcon />
                <span className="font-medium">{a.display}</span>
                {/* Count badge, dark text on solid saffron for AAA-level
                    contrast (the previous cream-on-saffron gradient was
                    ~1.6:1 and read as a saffron blur at 10px). min-w +
                    text-center keeps single digits from looking
                    squashed in the round pill. */}
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-saffron-500 text-ink-900 text-[11px] font-bold leading-none tabular-nums ring-1 ring-cream-50/15">
                  {a.count}
                </span>
              </button>
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

          {/* Chat panel, no glass / no border / no rounded chrome of
              its own anymore. Just a left-side hairline divider on lg+
              and a top divider on stacked layouts so the two halves
              still read as separate instruments inside the shared card.
              Mobile gets a FIXED height (28rem) so the inner chat body
              scrolls in place instead of expanding the page; lg lets
              it fill the parent's lg:h-[40rem] cell. */}
          <div className="relative flex flex-col h-[28rem] sm:h-[32rem] lg:h-full lg:min-h-0 border-t border-cream-50/10 lg:border-t-0 lg:border-l lg:border-cream-50/10">
            {/* Header, ChatBubble SVG + title + LIVE pill on the left,
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
                  {isChatOpen
                    ? isHi
                      ? "लाइव चैट"
                      : "Live chat"
                    : isHi
                      ? `${lastOpenLabel} की चैट`
                      : `${lastOpenLabel}'s chat`}
                </span>
                {/* On open days (Tue/Sat) with at least one mention,
                    show the broadcast-style "LIVE · N mentions" pill.
                    On closed days we replace the LIVE prefix with a
                    plain mentions counter so the chrome doesn't lie
                    about the chat being on air. Cold-load with zero
                    mentions hides the pill entirely. */}
                {totalToday > 0 ? (
                  isChatOpen ? (
                    <LivePulseBadge count={totalToday} isHi={isHi} />
                  ) : (
                    <RecentCountBadge count={totalToday} isHi={isHi} />
                  )
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
                  {isHi ? "कनेक्टेड" : "connected"}
                </span>
              ) : (
                <span className="text-[11px] text-cream-50/55 inline-flex items-center gap-1.5">
                  <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-cream-50/40" />
                  {isHi
                    ? `ऑफ़लाइन · ${nextOpenLabel} को फिर शुरू`
                    : `offline · resumes ${nextOpenLabel}`}
                </span>
              )}
            </div>

            {/* Offline banner */}
            {!isChatOpen ? (
              <div className="px-4 py-3 border-b border-cream-50/10 bg-gradient-to-r from-cream-50/5 via-cream-50/[0.02] to-cream-50/5 text-xs text-cream-50/75">
                {isHi ? (
                  <>
                    <span className="font-semibold text-cream-50">
                      लाइव चैट मंगलवार और शनिवार को होती है।
                    </span>{" "}
                    आज {dayName(today, true)} है। नीचे हाल की चर्चाएँ दिखती रहेंगी।
                    चैट{" "}
                    <span className="text-saffron-500">{nextOpenLabel}</span>{" "}
                    को फिर शुरू होगी।
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-cream-50">
                      Live chat is on Tuesdays and Saturdays.
                    </span>{" "}
                    Today is {dayName(today, false)}. Recent mentions below stay visible.
                    Chat picks up again on{" "}
                    <span className="text-saffron-500">{nextOpenLabel}</span>.
                  </>
                )}
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
              {groupedMentions.length === 0 ? (
                <li className="h-full flex items-center justify-center px-4 py-8">
                  <LiveChatEmpty
                    isHi={isHi}
                    isChatOpen={isChatOpen}
                    nextOpenLabel={nextOpenLabel}
                    communityTotal={communityMembers}
                  />
                </li>
              ) : (
                groupedMentions.map((m, idx) => {
                  const firstSeenAt = firstSeenRef.current.get(m.id);
                  // Suppress the new-glow when chat is offline, no
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
                      isLast={idx === groupedMentions.length - 1}
                      isHi={isHi}
                      onOpenLightbox={openLightbox}
                    />
                  );
                })
              )}
            </ul>

            {newSinceScrollAway > 0 && isChatOpen ? (
              <button
                type="button"
                onClick={scrollToTop}
                data-ga="cta_chatter_scroll_new"
                data-ga-count={String(newSinceScrollAway)}
                className="absolute top-14 left-1/2 -translate-x-1/2 z-10 rounded-full bg-gradient-to-br from-saffron-500 to-saffron-600 text-cream-50 text-xs font-medium px-3 py-1.5 shadow-warm chatter-new-pill"
              >
                {isHi
                  ? `↑ ${newSinceScrollAway} ${newSinceScrollAway === 1 ? "नई चर्चा" : "नई चर्चाएँ"}`
                  : `↑ ${newSinceScrollAway} new ${newSinceScrollAway === 1 ? "message" : "messages"}`}
              </button>
            ) : null}
          </div>
        </div>

        {/* Full-width WhatsApp community section */}
        <WhatsappCommunitySection
          countsByKey={communityCountsByKey}
          isHi={isHi}
        />
      </div>

      {/* Chat-photo lightbox. Reused GalleryLightbox so the overlay
          matches the rest of the site (HomepageGallery + /gallery). */}
      {lightbox ? (
        <GalleryLightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
          isHi={isHi}
        />
      ) : null}

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

        /* ── Radar pulse for the empty-state. Three concentric rings
           expand outward from the centre dot at staggered intervals
           so a wave is always in flight; the centre dot pulses on a
           slower clock for a "heartbeat" feel. Pure CSS, no JS. */
        @keyframes chatter-radar-pulse {
          0%   { transform: scale(0.35); opacity: 0.75; }
          80%  { opacity: 0;   }
          100% { transform: scale(2.2);  opacity: 0; }
        }
        @keyframes chatter-radar-core {
          0%, 100% { transform: scale(1);    opacity: 1;   }
          50%      { transform: scale(1.25); opacity: 0.85; }
        }
        :global(.chatter-radar) {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 1px solid rgba(93, 174, 93, 0.55);
          background: radial-gradient(circle, rgba(93,174,93,0.12) 0%, transparent 70%);
          animation: chatter-radar-pulse 3s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
          will-change: transform, opacity;
        }
        :global(.chatter-radar-2) { animation-delay: 1s; }
        :global(.chatter-radar-3) { animation-delay: 2s; }
        :global(.chatter-radar-core) {
          animation: chatter-radar-core 2.4s ease-in-out infinite;
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
           rules. (No backticks in this comment block, they would
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
 *  in the same dark band. No outer card wrapper per design, the four
 *  cards do the visual lifting themselves; the heading sits flush.
 *
 *  Subheading total is computed by summing the per-group counts (not
 *  the separate `community_total_members` row) so the headline number
 *  always matches what's visible in the cards below, no risk of
 *  divergence between the two SiteCounter sources. */
function WhatsappCommunitySection({
  countsByKey,
  isHi,
}: {
  countsByKey: Record<string, number>;
  isHi: boolean;
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
          {isHi ? "व्हाट्सऐप पर जुड़ें" : "Join the chat on WhatsApp"}
        </h3>
        {total > 0 ? (
          // Hero number block: enormous WHITE count with a brighter
          // emerald glow underneath. On the dark chatter band the
          // leaf-green-on-dark we tried first read as muddy and
          // low-contrast (user feedback). White + emerald-shadow
          // keeps the brand colour relationship but delivers the
          // contrast a hero number needs.
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="font-numerals font-extrabold tabular-nums leading-none text-white drop-shadow-[0_0_18px_rgba(74,222,128,0.5)]"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}
            >
              {total.toLocaleString(isHi ? "hi-IN" : "en-IN")}
            </span>
            <p className="text-sm sm:text-base text-cream-50/85 leading-snug font-medium">
              {isHi ? (
                <>
                  लखनऊ के पड़ोसी पहले से ही चैट में जुड़े हैं, लाइव भंडारा अपडेट, तस्वीरें और पिन साझा कर रहे हैं।{" "}
                  <span className="text-cream-50">
                    अपना सर्किल चुनकर जुड़ें।
                  </span>
                </>
              ) : (
                <>
                  Lucknow neighbours already in the chat, sharing live bhandara drops, photos and pins.{" "}
                  <span className="text-cream-50">
                    Pick your circle and join in.
                  </span>
                </>
              )}
            </p>
          </div>
        ) : (
          <p className="text-sm sm:text-base text-cream-50/80 leading-snug">
            {isHi
              ? "जिस सर्किल में सहज लगें वहाँ जुड़ें। आज का भंडारा कहाँ है पूछें, जो दिखे शेयर करें, या बस सुनते रहें।"
              : "Hop into the community that fits. Ask where today's bhandara is, share what you find, or just listen in."}
          </p>
        )}
      </div>

      <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {WHATSAPP_CTAS.map((cta) => (
          <li key={cta.href}>
            <WhatsappCard
              cta={cta}
              count={countsByKey[cta.counterKey] ?? null}
              isHi={isHi}
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
  isHi,
}: {
  cta: (typeof WHATSAPP_CTAS)[number];
  count: number | null;
  isHi: boolean;
}) {
  const isChannel = cta.kind === "channel";
  const kindLabel =
    cta.kind === "community"
      ? isHi ? "कम्युनिटी" : "Community"
      : cta.kind === "group"
        ? isHi ? "ग्रुप" : "Group"
        : isHi ? "चैनल" : "Channel";
  const cardLabel = isHi ? cta.labelHi : cta.label;
  const cardBlurb = isHi ? cta.blurbHi : cta.blurb;
  const ctaVerb = isChannel
    ? isHi ? "फ़ॉलो" : "Follow"
    : isHi ? "जॉइन" : "Join";
  const memberLabel = isChannel
    ? isHi ? "सब्सक्राइबर" : "subscribers"
    : isHi ? "सदस्य" : "members";
  return (
    <a
      href={cta.href}
      target="_blank"
      rel="noopener noreferrer"
      data-ga="cta_chatter_whatsapp"
      data-ga-kind={cta.kind}
      data-ga-key={cta.counterKey}
      data-ga-source="homepage"
      className="chatter-glass chatter-glass-hover relative block rounded-xl p-3 h-full focus:outline-none focus:ring-2 focus:ring-saffron-500/60"
    >
      {/* Top row: kind-specific tile (community=WA glyph, group=people
          glyph + WA badge, channel=megaphone + WA badge) + textual
          kind chip on the right. The composite tile makes the kind
          scannable without reading the chip text. */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <WhatsappKindTile kind={cta.kind} iconUrl={cta.iconUrl} label={cardLabel} />
        <span className="text-[8px] font-bold uppercase tracking-wider rounded-full bg-black/50 backdrop-blur-sm text-cream-50/85 px-1.5 py-0.5">
          {kindLabel}
        </span>
      </div>

      <h4 className="font-fraunces text-sm sm:text-base text-cream-50 leading-tight mb-0.5">
        {cardLabel}
      </h4>
      <p className="text-[11px] text-cream-50/65 leading-snug mb-2.5">
        {cardBlurb}
      </p>

      {/* Bottom row: per-card member count + join CTA. Number is sized
          DOWN from hero, the section total above is the headline; these
          per-card counts are supporting context (which circle is biggest)
          and should stay smaller than the total to keep the visual
          hierarchy. */}
      <div className="flex items-end justify-between gap-2 mt-auto">
        {count !== null && count > 0 ? (
          <span className="inline-flex flex-col items-start leading-none">
            <span
              className="font-numerals font-extrabold tabular-nums leading-none text-white drop-shadow-[0_0_10px_rgba(74,222,128,0.4)]"
              style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.4rem)" }}
            >
              {count.toLocaleString(isHi ? "hi-IN" : "en-IN")}
            </span>
            <span className="mt-0.5 text-[9px] uppercase tracking-[0.14em] font-semibold text-emerald-300/90">
              {memberLabel}
            </span>
          </span>
        ) : (
          <span className="text-xs text-cream-50/50" aria-hidden>
            ·
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-2.5 py-1 text-[11px] font-semibold shadow-[0_3px_10px_-3px_rgba(16,185,129,0.65)] ring-1 ring-emerald-400/50 shrink-0 hover:from-emerald-400 hover:to-emerald-500 transition-colors">
          {ctaVerb} →
        </span>
      </div>
    </a>
  );
}

/** "12 recent mentions" badge, same chrome as LivePulseBadge but
 *  without the green dot + LIVE label. Used on off-days (Sun/Mon/Wed/
 *  Thu/Fri) when the chat isn't taking new messages, so the count
 *  reflects "what's still on the feed from the last open day" rather
 *  than an on-air claim. */
function RecentCountBadge({ count, isHi }: { count: number; isHi: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black text-cream-50 px-3 py-1.5 border border-cream-50/15 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <span aria-hidden>💬</span>
      <span className="text-xs font-semibold tabular-nums text-cream-50/95">
        {isHi
          ? `${count} ${count === 1 ? "हालिया चर्चा" : "हालिया चर्चाएँ"}`
          : `${count} recent mention${count === 1 ? "" : "s"}`}
      </span>
    </span>
  );
}

/** "LIVE · 12 mentions" badge. Solid-black pill with a green
 *  pulsing dot. Reads like a broadcast-control tally: the green dot
 *  is the universal "on-air" signal, the black pill keeps it from
 *  competing visually with the saffron palette used everywhere else
 *  in the section. Border + shadow give it just enough lift to read
 *  as interactive on a busy backdrop. */
function LivePulseBadge({ count, isHi }: { count: number; isHi: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-black text-cream-50 px-3 py-1.5 border border-cream-50/15 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <span className="relative inline-block w-2 h-2 text-leaf-600">
        <span
          aria-hidden
          className="live-pulse-dot absolute inset-0 rounded-full bg-leaf-600"
        />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream-50">
        {isHi ? "लाइव" : "Live"}
      </span>
      <span aria-hidden className="h-3 w-px bg-cream-50/20" />
      <span className="text-xs font-semibold tabular-nums text-cream-50/95">
        {isHi
          ? `${count} ${count === 1 ? "चर्चा" : "चर्चाएँ"}`
          : `${count} mention${count === 1 ? "" : "s"}`}
      </span>
    </span>
  );
}

/** Section-level LIVE pill that sits inline with the main "What people
 *  are talking about?" heading. Marks the whole section as live
 *  previously this pill sat next to the 9,652 community total; moved
 *  here so the live-state signal reads as section-wide rather than
 *  tied to that single number. */
/** Empty-state for the Live chat panel, shown when the feed has
 *  zero mentions, whether the chat is "open" today (Tue/Sat) or not.
 *
 *  Three jobs:
 *    1. Visually prove the system is alive (radar-pulse animation) so
 *       the user trusts it'll fill in when chatter starts.
 *    2. Tell the user what to expect, the community size + the
 *       Tuesday/Saturday rhythm.
 *    3. Offer two ways to make this less quiet themselves: drop a
 *       Spot, or hop into a WhatsApp circle.
 *
 *  Same skeleton serves both connected-but-empty and offline states;
 *  only the headline copy + the dot colour change.
 */
function LiveChatEmpty({
  isHi,
  isChatOpen,
  nextOpenLabel,
  communityTotal,
}: {
  isHi: boolean;
  isChatOpen: boolean;
  nextOpenLabel: string;
  communityTotal: number;
}) {
  const totalDisplay = communityTotal.toLocaleString(isHi ? "hi-IN" : "en-IN");
  return (
    <div className="grid gap-4 text-center max-w-sm">
      {/* Radar pulse, concentric circles expanding out from a
          breathing leaf-green centre. The three rings are offset so
          there's always a wave in flight; the centre dot pulses on
          a slower clock. Reads as "actively scanning" without any
          audio cue. */}
      <div className="relative w-20 h-20 mx-auto" aria-hidden>
        <span className="chatter-radar chatter-radar-1" />
        <span className="chatter-radar chatter-radar-2" />
        <span className="chatter-radar chatter-radar-3" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-leaf-600/15 ring-1 ring-leaf-400/30">
          <span className="inline-flex w-3 h-3 rounded-full bg-leaf-400 shadow-[0_0_18px_rgba(93,174,93,0.65)] chatter-radar-core" />
        </span>
      </div>

      {/* Headline, community-size framing when chat is open today,
          next-open-day framing when it's a quiet day. Either way the
          tone is "we're listening" not "nothing happening". */}
      <h4 className="font-fraunces text-cream-50 text-lg leading-snug">
        {isChatOpen ? (
          isHi ? (
            <>
              <span className="tabular-nums font-bold">{totalDisplay}</span> पड़ोसियों को सुन रहे हैं
            </>
          ) : (
            <>
              Listening to{" "}
              <span className="tabular-nums font-bold">{totalDisplay}</span>{" "}
              neighbours
            </>
          )
        ) : isHi ? (
          <>
            अगली लाइव चैट{" "}
            <span className="text-saffron-500">{nextOpenLabel}</span> को
          </>
        ) : (
          <>
            Next live chat:{" "}
            <span className="text-saffron-500">{nextOpenLabel}</span>
          </>
        )}
      </h4>

      {/* Sub, sets expectations + the Tue/Sat rhythm so the absence
          of activity right now reads as "between waves", not broken. */}
      <p className="text-sm text-cream-50/70 leading-snug">
        {isChatOpen
          ? isHi
            ? "जैसे ही कोई पड़ोसी भंडारा शेयर करे, तस्वीर या पिन भेजे, सब यहाँ पल भर में दिखेगा।"
            : "The moment a neighbour shares a bhandara, drops a photo or a pin, it'll slide in here."
          : isHi
            ? "बड़ा मंगल समुदाय मंगलवार और शनिवार को सबसे ज़्यादा सक्रिय रहता है। तब तक नीचे की लिस्ट देखें।"
            : "Our community is most active on Bada Mangal Tuesdays and Saturdays. Browse the listed bhandaras below in the meantime."}
      </p>

      {/* CTAs, both nudge the user toward making the panel less
          empty: drop a Spot (creates content), or hop into a WhatsApp
          circle (joins the source-of-truth chatter). #join-community-
          heading is the WhatsApp section's <h3>; smooth-scroll handled
          by the browser default. */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <a
          href="/spot"
          data-ga="cta_chatter_empty_spot"
          data-ga-state={isChatOpen ? "open" : "offline"}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-saffron-500 to-saffron-600 hover:from-saffron-500 hover:to-saffron-500 text-cream-50 px-3.5 py-1.5 text-xs font-semibold shadow-[0_4px_14px_-4px_rgba(242,148,76,0.55)] transition-all"
        >
          <PinIcon />
          {isHi ? "भंडारा स्पॉट करें" : "Spot a bhandara"}
        </a>
        <a
          href="#join-community-heading"
          data-ga="cta_chatter_empty_join_whatsapp"
          data-ga-state={isChatOpen ? "open" : "offline"}
          className="inline-flex items-center gap-1.5 rounded-full bg-cream-50/10 hover:bg-cream-50/15 text-cream-50 px-3.5 py-1.5 text-xs font-semibold ring-1 ring-cream-50/15 transition-all"
        >
          <span aria-hidden className="text-leaf-400">
            <WhatsappGlyph size={12} />
          </span>
          {isHi ? "व्हाट्सऐप पर जुड़ें" : "Join WhatsApp"}
        </a>
      </div>
    </div>
  );
}

function SectionLiveBadge({ isHi }: { isHi: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-emerald-400/15 text-emerald-300 text-[9px] font-semibold uppercase tracking-[0.16em] ring-1 ring-emerald-400/40 leading-none">
      <span className="relative inline-block w-1.5 h-1.5">
        <span
          aria-hidden
          className="live-pulse-dot absolute inset-0 rounded-full bg-emerald-400"
        />
      </span>
      <span className="leading-none py-0.5">{isHi ? "लाइव" : "live"}</span>
    </span>
  );
}

function PhotoCountChip({ count, isHi }: { count: number; isHi: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-leaf-400/50 text-leaf-400 px-2.5 py-1 text-xs font-medium shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)]">
      <span aria-hidden>📷</span>
      <span className="tabular-nums">{count}</span>
      <span className="text-cream-50/80">
        {isHi
          ? `लाइव ${count === 1 ? "तस्वीर" : "तस्वीरें"}`
          : `live photo${count === 1 ? "" : "s"}`}
      </span>
    </span>
  );
}

function CommunityCountChip({ count, isHi }: { count: number; isHi: boolean }) {
  const display = useCountUp(count);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-cream-50/25 text-cream-50 px-2.5 py-1 text-xs font-medium shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)]">
      <span aria-hidden className="text-leaf-400">
        <PeopleIcon />
      </span>
      <span className="tabular-nums font-semibold">
        {display.toLocaleString(isHi ? "hi-IN" : "en-IN")}
      </span>
      <span className="text-cream-50/75">{isHi ? "सदस्य" : "members"}</span>
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
  isHi,
  onOpenLightbox,
}: {
  mention: ChatterMention;
  isNew: boolean;
  isLast: boolean;
  isHi: boolean;
  onOpenLightbox: (items: GalleryItem[], index: number) => void;
}) {
  const intent = intentLabel(mention.intent, isHi);
  const avatar = avatarSlot(mention.senderName ?? mention.id);
  const initial = avatarInitial(mention.senderName);
  const name = displayName(mention.senderName, isHi);
  const hasCoords = mention.lat !== null && mention.lng !== null;
  // Carousel state: which photo of the bubble is currently visible.
  // Resets to 0 whenever the bubble's mention.id changes (parent
  // remounts a new bubble; no manual reset needed). Defaults to 0;
  // arrows + dots only render when photos.length > 1.
  const photos: string[] =
    mention.photoUrls && mention.photoUrls.length > 0
      ? mention.photoUrls
      : mention.photoUrl
        ? [mention.photoUrl]
        : [];
  const [photoIdx, setPhotoIdx] = useState(0);
  const safeIdx = Math.max(0, Math.min(photoIdx, photos.length - 1));
  const activePhoto = photos[safeIdx] ?? null;
  const showCarouselControls = photos.length > 1;
  const goPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIdx((i) => (i - 1 + photos.length) % photos.length);
  };
  const goNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIdx((i) => (i + 1) % photos.length);
  };
  // ASKING bubbles must not surface ANY location-based action
  // no Directions CTA, no map-deep-link on the photo, no location
  // pill below the message. The user is asking IF something's
  // happening there; exposing a "Get directions" or pin pill would
  // misread as "there IS a bhandara here". Same rule that filters
  // them out of the heatmap + active-areas chips. Locations stay on
  // the DB row for admin triage.
  const showLocationActions = mention.intent !== "ASKING";
  // Google Maps destination: when we have a precise pin (a WhatsApp
  // location share or a pasted Google Maps URL) we feed the raw
  // lat,lng. Otherwise, Ola's text-to-coords geocode of "Aliganj
  // Purania Chowk" routinely lands a kilometre off the real venue
  // we pass the textual locationLabel + ", Lucknow" and let Google's
  // own (much richer Lucknow corpus) place finder resolve it. For
  // 0,0 "null-island" spots (bot-ingest before admin sets coords)
  // text-based search is the only sensible option.
  const isPrecisePin =
    mention.locationSource === "whatsapp_share" ||
    mention.locationSource === "google_maps_url";
  const validCoords =
    hasCoords && mention.lat !== 0 && mention.lng !== 0;
  const destText = mention.locationLabel?.trim() || null;
  const mapsDestination =
    isPrecisePin && validCoords
      ? `${mention.lat},${mention.lng}`
      : destText
        ? encodeURIComponent(`${destText}, Lucknow, India`)
        : validCoords
          ? `${mention.lat},${mention.lng}`
          : null;
  const directionsHref =
    showLocationActions && mapsDestination
      ? `https://www.google.com/maps/dir/?api=1&destination=${mapsDestination}`
      : null;
  const photoHref =
    showLocationActions && mapsDestination
      ? `https://www.google.com/maps?q=${mapsDestination}${
          isPrecisePin && validCoords ? "&z=17" : ""
        }`
      : null;

  // Space-separated slugified area keys for every location this
  // mention covers, used by the active-area chip click handler to
  // find the first bubble matching the chosen area and scroll it
  // into view. Same right-most-comma-segment rule as the chip
  // strip's area extraction in areaCounts above. Multi-location
  // mentions (Yash's "Aashiyana: Taj jwellers / Near Shubhash /
  // Oyo townhouse" pattern) emit multiple areas separated by
  // spaces so a `[data-areas~="aashiyana"]` selector matches.
  //
  // Each area name is slugified (whitespace COLLAPSED) before joining,
  // because the CSS `[attr~="value"]` selector splits on whitespace
  // and would never match a phrase containing spaces. Collapsing
  // (not hyphenating) also means "Rajaji Puram" and "Rajajipuram"
  // both slug to "rajajipuram" so the merged chip's click finds
  // either spelling. Match-side (scrollToArea) does the same.
  const dataAreas = (() => {
    const labels =
      mention.locationLabels && mention.locationLabels.length > 0
        ? mention.locationLabels
        : mention.locationLabel
          ? [mention.locationLabel]
          : [];
    const areas = labels
      .map((l) => {
        const segs = l
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const area = segs.length > 0 ? segs[segs.length - 1] : l;
        return area.toLowerCase().replace(/\s+/g, "");
      })
      .filter(Boolean);
    return Array.from(new Set(areas)).join(" ");
  })();

  return (
    <li
      data-areas={dataAreas || undefined}
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
            data-ga="cta_chatter_directions"
            data-ga-mention-id={mention.id}
            data-ga-intent={mention.intent}
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-saffron-500 to-saffron-600 hover:from-saffron-500 hover:to-saffron-500 text-cream-50 px-2.5 py-1 text-[11px] font-medium shadow-[0_2px_8px_-2px_rgba(242,148,76,0.55)] transition-all"
            title={isHi ? "रास्ता पाएँ" : "Get directions"}
          >
            <ArrowIcon />
            <span className="hidden sm:inline">{isHi ? "रास्ता" : "Directions"}</span>
          </a>
        ) : null}
      </div>

      <div className="pl-8 mt-1 grid gap-1">
        {activePhoto ? (
          <div className="relative max-w-[11rem]">
            <a
              href={activePhoto}
              // Anchor keeps a real href so middle-click / Cmd-click
              // still opens the photo in a new tab the way browsers
              // expect; plain left-click is intercepted to open the
              // in-page GalleryLightbox overlay instead. Matches the
              // homepage gallery's open behaviour exactly.
              target="_blank"
              rel="noopener noreferrer"
              data-ga="cta_chatter_photo_open"
              data-ga-mention-id={mention.id}
              data-ga-has-coords={hasCoords ? "true" : "false"}
              data-ga-photo-index={String(safeIdx)}
              data-ga-photo-count={String(photos.length)}
              onClick={(e) => {
                if (
                  e.metaKey ||
                  e.ctrlKey ||
                  e.shiftKey ||
                  e.altKey ||
                  e.button === 1
                ) {
                  return; // let the browser open in a new tab
                }
                e.preventDefault();
                const items: GalleryItem[] = photos.map((url, i) => ({
                  id: `${mention.id}:${i}`,
                  url,
                  source: "spot",
                  caption: mention.text,
                  createdAt: mention.createdAt,
                }));
                onOpenLightbox(items, safeIdx);
              }}
              className="group relative block rounded-xl overflow-hidden border border-cream-50/15 bg-ink-900 hover:border-saffron-500/60 transition-colors cursor-zoom-in"
              aria-label={
                showCarouselControls
                  ? `Open photo ${safeIdx + 1} of ${photos.length} in viewer`
                  : "Open photo in viewer"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={activePhoto}
                src={activePhoto}
                alt={mention.text}
                loading="lazy"
                className="w-full h-auto max-h-36 object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] font-medium text-cream-50 opacity-0 group-hover:opacity-100 transition-opacity">
                {isHi ? "खोलें" : "Open"} ↗
              </span>
            </a>
            {showCarouselControls ? (
              <>
                {/* Prev / next chips. Solid black/60 disc so they stay
                    legible over any image. Positioned at left/right
                    edges, vertically centred. Clicks cycle within the
                    bubble and stop propagation so the parent anchor
                    doesn't open the image in a new tab on every nudge. */}
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous photo"
                  data-ga="cta_chatter_photo_prev"
                  data-ga-mention-id={mention.id}
                  data-ga-photo-count={String(photos.length)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/65 hover:bg-black/85 text-cream-50 text-xs leading-none ring-1 ring-cream-50/20 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next photo"
                  data-ga="cta_chatter_photo_next"
                  data-ga-mention-id={mention.id}
                  data-ga-photo-count={String(photos.length)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/65 hover:bg-black/85 text-cream-50 text-xs leading-none ring-1 ring-cream-50/20 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500"
                >
                  ›
                </button>
                {/* Position indicator dots, clickable for direct jump.
                    Active dot is saffron + slightly larger; the rest
                    are cream-translucent. Sits over the bottom of the
                    image with a subtle dark gradient behind for
                    legibility on bright shots. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
                  <div className="pointer-events-auto inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-black/55 backdrop-blur-sm">
                    {photos.map((_, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPhotoIdx(i);
                        }}
                        aria-label={`Show photo ${i + 1}`}
                        data-ga="cta_chatter_photo_dot"
                        data-ga-mention-id={mention.id}
                        data-ga-photo-index={String(i)}
                        data-ga-photo-count={String(photos.length)}
                        className={
                          i === safeIdx
                            ? "w-2 h-2 rounded-full bg-saffron-500 ring-1 ring-saffron-500/60"
                            : "w-1.5 h-1.5 rounded-full bg-cream-50/55 hover:bg-cream-50/85 transition-colors"
                        }
                      />
                    ))}
                  </div>
                </div>
                {/* Count badge in the top-right, at a glance "X / N". */}
                <span
                  aria-hidden
                  className="absolute top-1 right-1 text-[9px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-black/65 text-cream-50 ring-1 ring-cream-50/20"
                >
                  {safeIdx + 1}/{photos.length}
                </span>
              </>
            ) : null}
            {/* When the spot has a Google Maps location deep-link
                available, expose it as a small secondary chip in the
                bottom-left so users can still jump to the pin without
                losing the photo carousel. Only renders for SHARING +
                hasCoords (same gate as the directions CTA). */}
            {photoHref ? (
              <a
                href={photoHref}
                target="_blank"
                rel="noopener noreferrer"
                data-ga="cta_chatter_photo_open_map"
                data-ga-mention-id={mention.id}
                onClick={(e) => e.stopPropagation()}
                className="absolute left-1 bottom-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/65 text-cream-50 text-[9px] font-semibold ring-1 ring-cream-50/20 hover:bg-black/85 transition-colors"
                aria-label={isHi ? "नक़्शे पर देखें" : "Open on map"}
                title={isHi ? "नक़्शे पर देखें" : "Open on map"}
              >
                <PinIcon />
                {isHi ? "नक़्शा" : "Map"}
              </a>
            ) : null}
          </div>
        ) : null}
        {/* Quoted-reply strip, only renders when the WA message was
            a reply. Subtle indented block with a left rail and the
            quoted sender + truncated text, so a one-word reply like
            "Malhaur" lands under the question it's answering and
            reads in context. */}
        {mention.quotedText ? (
          <div className="border-l-2 border-cream-50/30 pl-2 -ml-0.5 mb-1">
            {mention.quotedSender ? (
              <p className="text-[11px] font-semibold text-cream-50/70 leading-tight truncate">
                {displayName(mention.quotedSender, isHi)}
              </p>
            ) : null}
            <p className="text-[11px] text-cream-50/55 italic leading-snug line-clamp-2 whitespace-pre-wrap break-words">
              {mention.quotedText}
            </p>
          </div>
        ) : null}
        <p className="text-sm text-cream-50/95 leading-snug whitespace-pre-wrap break-words">
          {mention.text}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-cream-50/55 mt-0">
          {showLocationActions ? (
            // Multi-location messages ("Kamta, Chinhat ya amity?") get
            // one chip per place, server-split rows are collapsed by
            // the groupedMentions rollup in the parent. Single-location
            // messages render just the one chip via the [locationLabel]
            // singleton fallback.
            (mention.locationLabels && mention.locationLabels.length > 0
              ? mention.locationLabels
              : mention.locationLabel
                ? [mention.locationLabel]
                : []
            ).map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-cream-50/85"
              >
                <PinIcon />
                {label}
              </span>
            ))
          ) : null}
          <span>{relativeTime(new Date(mention.createdAt), isHi)}</span>
          {mention.bhandaraSlug ? (
            <a
              href={`/bhandara/${mention.bhandaraSlug}`}
              data-ga="cta_chatter_view_bhandara"
              data-ga-slug={mention.bhandaraSlug}
              data-ga-mention-id={mention.id}
              className="ml-0.5 inline-flex items-center gap-0.5 text-leaf-400 hover:text-leaf-400/80 underline decoration-dotted underline-offset-2"
            >
              {isHi ? "भंडारा देखें →" : "View bhandara →"}
            </a>
          ) : null}
          {mention.kind === "spot" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-leaf-400">
              <span aria-hidden>📷</span>
              {isHi ? "तस्वीर" : "Photo"}
            </span>
          ) : null}
        </div>
      </div>

      {isNew ? (
        <span className="absolute top-1.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-br from-saffron-500 to-saffron-600 text-cream-50 text-[9px] font-bold uppercase tracking-wider shadow">
          {isHi ? "नई" : "New"}
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
 *  before, at 16-22px the old path's tail rendered as a wobbly
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

/** People / group glyph for the "group" kind tile. Solid silhouettes
 *  three heads + shoulders, to read instantly at 22px on a busy card
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
 *  broadcast horn pointed up-right with a faint sound wave, reads as
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
 *  Live chat panel header, sharper, single-color, and inherits
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
          className="w-8 h-8 rounded-lg object-cover ring-1 ring-cream-50/15 shadow-[0_3px_10px_-3px_rgba(0,0,0,0.55)]"
        />
        {kind !== "community" ? <WhatsappBadge /> : null}
      </span>
    );
  }
  return (
    <span
      className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-leaf-600 to-leaf-600/80 text-cream-50 shadow-[0_3px_10px_-3px_rgba(63,122,63,0.65)] ring-1 ring-leaf-600/40"
      aria-label={`${kind === "community" ? "Community" : kind === "group" ? "Group" : "Channel"}: ${label}`}
    >
      {kind === "community" ? (
        <WhatsappGlyph size={16} />
      ) : kind === "group" ? (
        <PeopleGroupGlyph size={18} />
      ) : (
        <MegaphoneGlyph size={16} />
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

function relativeTime(d: Date, isHi: boolean): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return isHi ? "अभी" : "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return isHi ? `${min} मिनट पहले` : `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return isHi ? `${h} घंटे पहले` : `${h}h ago`;
  const days = Math.floor(h / 24);
  return isHi ? `${days} दिन पहले` : `${days}d ago`;
}
