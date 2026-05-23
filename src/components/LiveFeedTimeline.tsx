"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import NearMeButton, { type NearMeState } from "@/components/NearMeButton";
import { JaliCorner } from "@/components/ornaments";
import { haversineKm } from "@/lib/geo";
import { trackEvent } from "@/lib/ga";
import { useToast } from "@/components/Toast";
import type { Locale } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  spotShareText,
  whatsappShareUrlForSpot,
} from "@/lib/share";

const NEAR_ME_RADIUS_KM = 3;

export type FeedPost = {
  id: string;
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  bhandaraLat?: number | null;
  bhandaraLng?: number | null;
  authorName: string;
  text: string | null;
  photoUrl: string | null;
  /** All photos for this spot (primary first, then Spot.extraPhotoUrls
   *  entries). Empty / undefined → use photoUrl alone. The lightbox
   *  carousel cycles through every entry. */
  photoUrls?: string[];
  language: string;
  createdAt: string;
};

type Bhandara = { slug: string; name: string };

type Props = {
  initial: FeedPost[];
  bhandaras: Bhandara[];
  /** Optional override, when present, takes priority over the URL.
   *  Kept for tests / non-routed callers. The /live page no longer
   *  passes this so the page can stay statically cached; the value
   *  is read from `window.location.search` on mount instead. */
  activeBhandara?: string | null;
  /** Optional, ignored at runtime, locale resolves from the
   *  LocaleProvider context so the Hindi toggle flips every label
   *  here without a server-tree refresh. Kept for back-compat. */
  locale?: Locale;
  kicker?: string;
  emptyHi?: string;
  emptyEn?: string;
};

const POLL_MS = 8000;
const MAX_KEEP = 60;

export default function LiveFeedTimeline({
  initial,
  bhandaras,
  activeBhandara: activeBhandaraProp,
  emptyHi,
  emptyEn,
}: Props) {
  // Locale + isHi come from the LocaleProvider context, the legacy
  // `locale` prop is accepted on the type for back-compat but no
  // longer wired in. emptyHi / emptyEn fall back to the built-in
  // Hindi/English empty-state copy when callers don't pass them.
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const [posts, setPosts] = useState<FeedPost[]>(initial);
  // Filter slug now lives in client state, sourced from the URL. The
  // /live page used to read this on the server, which forced it to be
  // force-dynamic (every navigation paid a Netlify Function cold start
  // -- visible to the user as a ~3s click-to-paint pause). Now the
  // page is statically prerendered with the full active-spot set and
  // we apply the slug filter here, in JS.
  const [activeBhandara, setActiveBhandara] = useState<string | null>(
    activeBhandaraProp ?? null,
  );
  useEffect(() => {
    if (activeBhandaraProp !== undefined) {
      setActiveBhandara(activeBhandaraProp);
      return;
    }
    const read = () => {
      try {
        const u = new URL(window.location.href);
        setActiveBhandara(u.searchParams.get("bhandara"));
      } catch {
        setActiveBhandara(null);
      }
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [activeBhandaraProp]);
  /** Image lightbox state, lifted to the parent so only ONE modal is
   *  ever mounted at a time regardless of how many cards have photos. */
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // Transport mode (SSE vs polling) used to drive a "Real-time / Every 8s"
  // indicator next to the filter row. The indicator was removed because the
  // hero already carries a Live pill, but we still need to know which path
  // we're on so the cleanup branch can tear it down properly.
  const modeRef = useRef<"sse" | "poll">("poll");
  const [newSinceFocus, setNewSinceFocus] = useState(0);
  const [near, setNear] = useState<NearMeState>({ status: "idle", coords: null });
  const seenIds = useRef<Set<string>>(new Set(initial.map((p) => p.id)));
  const isVisibleRef = useRef(true);

  // Apply filters: bhandara-slug from URL first (so the user's pill
  // pick is respected), then the optional "Near me" radius filter.
  const visiblePosts = useMemo(() => {
    let pool = posts;
    if (activeBhandara) {
      pool = pool.filter((p) => p.bhandaraSlug === activeBhandara);
    }
    if (near.status !== "active" || !near.coords) return pool;
    const c = near.coords;
    return pool.filter(
      (p) =>
        typeof p.bhandaraLat === "number" &&
        typeof p.bhandaraLng === "number" &&
        haversineKm(c, { lat: p.bhandaraLat, lng: p.bhandaraLng }) <=
          NEAR_ME_RADIUS_KM,
    );
  }, [posts, near]);

  // Visibility tracking: pause polling when tab is hidden.
  useEffect(() => {
    const onVis = () => {
      isVisibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const merge = (incoming: FeedPost | FeedPost[]) => {
      const arr = Array.isArray(incoming) ? incoming : [incoming];
      const fresh = arr.filter((p) => !seenIds.current.has(p.id));
      if (fresh.length === 0) return;
      for (const p of fresh) seenIds.current.add(p.id);
      setPosts((prev) => [...fresh, ...prev].slice(0, MAX_KEEP));
      // Show "N new" pill if user scrolled away from the top.
      if (window.scrollY > 240) {
        setNewSinceFocus((n) => n + fresh.length);
      }
      trackEvent("live_feed_new_posts", { count: fresh.length });
    };

    // Poll-only. SSE was removed when we migrated to Netlify Functions,
    // their 26-second hard timeout makes long-lived EventSource streams
    // disconnect every ~25 s, which produced more reconnect chatter than
    // it saved. Polling every 8s with visibility-pause is more than
    // enough freshness for a hyperlocal feed.
    modeRef.current = "poll";
    const pollTimer = setInterval(async () => {
      if (!isVisibleRef.current) return;
      try {
        const since = posts[0]?.createdAt;
        const url = new URL("/api/feed", window.location.origin);
        url.searchParams.set("limit", "20");
        if (since) url.searchParams.set("since", since);
        if (activeBhandara) url.searchParams.set("bhandara", activeBhandara);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { posts: FeedPost[] };
        if (data.posts?.length) merge(data.posts);
      } catch {
        /* ignore */
      }
    }, POLL_MS);

    return () => {
      clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBhandara]);

  const onJumpToTop = () => {
    setNewSinceFocus(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
    trackEvent("live_feed_jump_top");
  };

  const filterPills = useMemo(() => {
    const langSuffix = isHi ? "" : "?lang=en";
    return [
      { slug: null, name: isHi ? "सब" : "All" },
      ...bhandaras.map((b) => ({ slug: b.slug, name: b.name })),
    ].map((b) => ({
      ...b,
      href: b.slug
        ? `/live?bhandara=${b.slug}${isHi ? "" : "&lang=en"}`
        : `/live${langSuffix}`,
    }));
  }, [bhandaras, isHi]);

  return (
    <div className="relative">
      {/* New-posts pill (sticky to viewport when scrolled) */}
      {newSinceFocus > 0 ? (
        <button
          type="button"
          onClick={onJumpToTop}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[1500] inline-flex items-center gap-2 rounded-full bg-saffron-600 text-cream-50 shadow-warm px-4 py-2 text-sm font-medium hover:bg-saffron-500"
        >
          <span aria-hidden>↑</span>
          {isHi
            ? `${newSinceFocus} नई पोस्ट`
            : `${newSinceFocus} new ${newSinceFocus === 1 ? "post" : "posts"}`}
        </button>
      ) : null}

      {/* Filters + status, single row: bhandara filter pills on the left,
          Near-me CTA + Real-time tag on the right. All three controls
          share the same `min-h-[36px]` so they sit on one optical baseline. */}
      <div className="mx-auto max-w-xl px-4 sm:px-6 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-1.5">
            {filterPills.map((b) => {
              const active =
                (activeBhandara ?? null) === (b.slug ?? null);
              return (
                <Link
                  key={b.slug ?? "all"}
                  href={b.href}
                  onClick={() =>
                    trackEvent("live_feed_filter", {
                      bhandara: b.slug ?? "all",
                    })
                  }
                  className={`inline-flex items-center min-h-[36px] rounded-full px-3.5 text-[0.8rem] leading-none font-medium border transition-colors ${
                    active
                      ? "bg-saffron-600 border-saffron-600 text-cream-50"
                      : "bg-cream-50 border-gold-500/40 text-ink-900 hover:border-saffron-500"
                  }`}
                >
                  {b.name}
                </Link>
              );
            })}
          </div>
          <NearMeButton
            isHi={isHi}
            active={near.status === "active"}
            source="live_feed"
            size="sm"
            onChange={setNear}
          />
        </div>
        {near.status === "active" ? (
          <p className="mt-2 text-[11px] text-ink-600 text-right">
            {isHi
              ? `3 कि.मी. के दायरे में ${visiblePosts.length} पोस्ट`
              : `${visiblePosts.length} posts within 3 km`}
          </p>
        ) : null}
      </div>

      {/* Timeline */}
      <main className="mx-auto max-w-xl px-4 sm:px-6 pb-20">
        {visiblePosts.length === 0 ? (
          <LiveEmptyState
            isHi={isHi}
            kind={near.status === "active" ? "near-empty" : "all-empty"}
            // emptyHi/emptyEn are kept available for callers that pass
            // legacy fallback copy, but the redesigned card uses the
            // brand-voiced strings below.
            fallbackHi={emptyHi}
            fallbackEn={emptyEn}
          />
        ) : (
          <ol className="space-y-4">
            {visiblePosts.map((p, i) => (
              <PostCard
                key={p.id}
                post={p}
                isFirst={i === 0}
                locale={locale}
                onOpenLightbox={(url) => {
                  setLightboxUrl(url);
                  trackEvent("live_feed_image_open", { post_id: p.id });
                }}
              />
            ))}
          </ol>
        )}
      </main>

      {/* Lightbox modal, mounted once at the parent. Closes on
          Escape, click outside the image, or the explicit ✕ button. */}
      {lightboxUrl ? (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      ) : null}
    </div>
  );
}

/**
 * Full-screen image viewer. Background dims the page, image is centred
 * and contained to the viewport so even very tall posters (often shared
 * on the live feed) read top-to-bottom without scrolling.
 *
 * Closes on:
 *   - Click on the dim backdrop (anywhere outside the image)
 *   - Escape key
 *   - The ✕ close button in the top-right
 */
/**
 * Empty-state card for /live. Two variants:
 *   - "all-empty"  → no live spots in the city right now
 *   - "near-empty" → city has spots but none within 3 km of the visitor
 *
 * Both lean on the empty-state-plate illustration + jali-corner ornaments
 * to match the visual language of the homepage's "no bhandaras yet"
 * state. Each variant gets a clear, brand-voiced headline and a primary
 * "Spot a bhandara" CTA, turning a dead-end into the moment the
 * visitor most plausibly converts into a contributor.
 */
function LiveEmptyState({
  isHi,
  kind,
  fallbackHi = "अभी कोई पोस्ट नहीं।",
  fallbackEn = "No posts yet.",
}: {
  isHi: boolean;
  kind: "all-empty" | "near-empty";
  fallbackHi?: string;
  fallbackEn?: string;
}) {
  const copy =
    kind === "near-empty"
      ? {
          kicker: isHi ? "आपके आसपास सन्नाटा" : "Quiet around you",
          headline: isHi
            ? "3 कि.मी. के दायरे में अभी कोई स्पॉट नहीं।"
            : "Nothing within 3 km of you yet.",
          body: isHi
            ? "थोड़ा दायरा बढ़ाकर देखिए, या अपने मोहल्ले से पहली रिपोर्ट खुद कीजिए, एक तस्वीर बस।"
            : "Widen the radius from the All filter, or be the first to post from your own street, one photo is all it takes.",
        }
      : {
          kicker: isHi ? "पहले स्पॉट का इंतज़ार" : "Waiting for the first spot",
          headline: isHi
            ? "अभी पंडाल शांत हैं।"
            : "The pandals are quiet right now.",
          body: isHi
            ? "जैसे ही कोई पासर्बाई कोई भंडारा रिपोर्ट करेगा, उसकी तस्वीर यहाँ हर 8 सेकंड में अपने-आप आ जाएगी। चाहें तो आप पहले हो जाइए।"
            : "The moment a passer-by reports a bhandara from anywhere in Lucknow, their photo will land here within 8 seconds. Want to be the first?",
        };

  // Fallback strings still travel in the HTML, keep them in a hidden
  // node so a non-JS / SSR snapshot doesn't render an empty card to
  // a crawler that can't run the dynamic copy above.
  const fallback = isHi ? fallbackHi : fallbackEn;

  return (
    <section
      aria-live="polite"
      className="relative overflow-hidden rounded-3xl border border-gold-500/45 bg-gradient-to-br from-saffron-50 via-cream-50 to-cream-50 px-5 sm:px-8 py-8 sm:py-10 shadow-warm"
    >
      {/* Awadhi jali corners, same accent the homepage uses on the
          "no bhandaras yet" card so the empty states feel like a set.
          Toned a notch quieter so they don't fight the refresh-status
          pill that now sits in the top-right corner. */}
      <JaliCorner
        position="tl"
        size={56}
        className="absolute top-0 left-0 text-gold-500/50"
      />
      <JaliCorner
        position="tr"
        size={56}
        className="absolute top-0 right-0 text-gold-500/50"
      />
      <JaliCorner
        position="bl"
        size={56}
        className="absolute bottom-0 left-0 text-gold-500/35"
      />
      <JaliCorner
        position="br"
        size={56}
        className="absolute bottom-0 right-0 text-gold-500/35"
      />

      {/* Status row, kicker pill on the left, "refreshing every 8s"
          chip on the right. Promoting the refresh indicator out of
          the bottom-of-CTAs spot and into the header reads as
          ambient status ("this thing is live, just quiet right now")
          instead of competing with action affordances below. */}
      <div className="relative flex items-center justify-between gap-3 flex-wrap mb-6">
        <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-[0.68rem] font-semibold inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="block w-1.5 h-1.5 rounded-full bg-saffron-600 motion-safe:animate-pulse"
          />
          {copy.kicker}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-50/70 border border-gold-500/40 text-ink-600 text-[0.62rem] uppercase tracking-[0.22em] font-medium px-2.5 py-1">
          <RefreshGlyph />
          {isHi ? "हर 8 सेकंड में ताज़ा" : "Refreshing every 8s"}
        </span>
      </div>

      <div className="relative grid gap-6 sm:gap-8 sm:grid-cols-[180px_1fr] items-center">
        {/* Plate illustration, same asset as the homepage empty state.
            Wrapped in a soft glow disc so it reads as a focal point.
            Sized up slightly so it carries its own weight against the
            longer text column on desktop. */}
        <div className="relative mx-auto sm:mx-0 w-40 sm:w-44 aspect-square shrink-0">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-saffron-500/20 blur-2xl"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/empty-state-plate.webp"
            alt=""
            loading="lazy"
            decoding="async"
            className="relative w-full h-full object-contain drop-shadow-[0_8px_20px_rgba(242,148,76,0.18)]"
          />
        </div>

        <div className="text-center sm:text-left min-w-0">
          <h2
            className={`${
              isHi
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-semibold text-sindoor-700"
            } text-2xl sm:text-[1.7rem] leading-snug [text-wrap:balance]`}
          >
            {copy.headline}
          </h2>
          <p className="mt-3 text-sm sm:text-[0.95rem] text-ink-600 leading-relaxed [text-wrap:pretty]">
            {copy.body}
          </p>

          {/* ONE primary action, "Spot a bhandara now" is the natural
              ask on an empty live feed (visitor → reporter). The
              other two paths (browse listed / list your own) are
              demoted to a single secondary text-link row below so
              the eye lands on the primary first instead of choosing
              between three competing pills. */}
          <div className="mt-5 flex justify-center sm:justify-start">
            <Link
              href={`/spot${isHi ? "" : "?lang=en"}`}
              data-ga="cta_live_empty_spot"
              data-ga-source={`live_empty_${kind}`}
              className="inline-flex items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 px-5 py-2.5 text-sm font-semibold shadow-warm transition-transform hover:-translate-y-0.5"
            >
              <CameraGlyph />
              {isHi ? "अभी भंडारा स्पॉट करें" : "Spot a bhandara now"}
            </Link>
          </div>

          {/* Secondary text links, the two ancillary paths share a
              single row, separated by a quiet gold dot. Compact,
              scannable, and clearly demoted from the primary CTA
              without losing access for the organiser / browser
              segments. */}
          <div className="mt-4 flex items-center justify-center sm:justify-start flex-wrap gap-x-3 gap-y-1 text-sm">
            <Link
              href={isHi ? "/" : "/?lang=en"}
              data-ga="cta_live_empty_browse"
              data-ga-source={`live_empty_${kind}`}
              className="inline-flex items-center gap-1 font-medium text-sindoor-700 hover:text-saffron-600 transition-colors"
            >
              {isHi ? "लिस्टेड भंडारे देखें" : "Browse listed bhandaras"}
              <span aria-hidden>→</span>
            </Link>
            <span aria-hidden className="text-gold-500/55">·</span>
            <Link
              href={`/list-bhandara${isHi ? "" : "?lang=en"}`}
              data-ga="cta_live_empty_list"
              data-ga-source={`live_empty_${kind}`}
              className="inline-flex items-center gap-1 font-medium text-sindoor-700 hover:text-saffron-600 transition-colors"
            >
              {isHi ? "खुद आयोजन कर रहे हैं? लिस्ट करें" : "Hosting one? List it"}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* SR-only fallback so search engines / no-JS clients still see
          the original empty-state copy. */}
      <p className="sr-only">{fallback}</p>
    </section>
  );
}

function CameraGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7h3l2-2h8l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function RefreshGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="motion-safe:animate-spin [animation-duration:8s]"
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock body scroll while open so the page underneath doesn't move
    // when the user pinches to zoom the lightbox image.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={onClose}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 motion-safe:animate-[bm-toast-in_140ms_ease-out]"
    >
      {/* Close button, top right of viewport */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close image viewer"
        className="absolute top-4 right-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/30 transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M5 5l14 14" />
          <path d="M19 5L5 19" />
        </svg>
      </button>

      {/* The image. `object-contain` + max-h capped to viewport ensures
          the whole image is always visible. Click on the image itself
          should NOT close, only clicks on the backdrop do. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onClick={(e) => e.stopPropagation()}
        className="max-w-[96vw] max-h-[92vh] object-contain rounded-lg shadow-2xl select-none"
      />
    </div>
  );
}

function PostCard({
  post,
  isFirst,
  locale,
  onOpenLightbox,
}: {
  post: FeedPost;
  isFirst: boolean;
  locale: Locale;
  onOpenLightbox: (url: string) => void;
}) {
  const isHi = locale === "hi";
  const initial = post.authorName.trim().charAt(0).toUpperCase() || "•";
  // In-card carousel state for multi-photo spots. Falls back to a
  // single-photo array when post.photoUrls isn't populated (legacy
  // callers / text-only posts).
  const photos: string[] =
    post.photoUrls && post.photoUrls.length > 0
      ? post.photoUrls
      : post.photoUrl
        ? [post.photoUrl]
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
  return (
    <li
      // `id` powers deep links from the homepage HappeningNow row,
      // tapping a card there navigates to `/live#spot:<id>` and the
      // browser scrolls this element into view natively.
      // `scroll-mt-24` adds enough top margin so the post isn't
      // clipped by the sticky page header when the browser jumps to
      // it via the hash. (24 ≈ 6rem, comfortably above the header.)
      id={post.id}
      // `target:` styles fire when the URL fragment matches this li's
      // id, i.e. when the user arrived here via /live#spot:<id> from
      // a tap on a HappeningNow card. We brighten the border + drop a
      // soft saffron ring so the eye lands on the correct card after
      // the browser's hash-scroll completes. CSS-only, no JS.
      className={`group scroll-mt-24 rounded-2xl border bg-cream-50 shadow-warm overflow-hidden transition-shadow target:border-saffron-500 target:ring-2 target:ring-saffron-500/40 ${
        isFirst ? "border-saffron-500/45" : "border-gold-500/30"
      }`}
    >
      <div className="px-4 pt-3 pb-2 flex items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-saffron-600 text-cream-50 font-semibold text-sm"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[13px] font-medium text-ink-900 truncate">
            {post.authorName}
          </p>
          <p className="text-[10.5px] text-ink-600">
            <time dateTime={post.createdAt}>{relative(post.createdAt, isHi)}</time>
          </p>
        </div>
      </div>

      {activePhoto ? (
        // Image well: blurred backdrop of the same image (so portrait
        // posters and landscape photos both look intentional, never
        // cropped) + the real image rendered with `object-contain` on
        // top. Click anywhere to open the FULL image in a lightbox.
        // When the spot has extras (>1 photo) prev/next chips render
        // on the photo edges + a "n / N" counter pill bottom-left;
        // their click handlers stopPropagation so cycling doesn't
        // also trigger the lightbox open.
        <button
          type="button"
          onClick={() => activePhoto && onOpenLightbox(activePhoto)}
          aria-label={
            showCarouselControls
              ? `View photo ${safeIdx + 1} of ${photos.length}`
              : "View full image"
          }
          className="group/img relative block w-full overflow-hidden cursor-zoom-in"
          style={{ aspectRatio: "auto" }}
        >
          {/* Blurred backdrop, same image, scaled up, blurred, dimmed
              so it acts as a colour-aware fill behind the contained
              foreground image. Inline style avoids needing to add a
              Tailwind arbitrary-property class for every URL. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-center bg-cover scale-110"
            style={{
              backgroundImage: `url(${JSON.stringify(activePhoto).slice(1, -1)})`,
              filter: "blur(28px) saturate(1.1)",
              opacity: 0.55,
            }}
          />
          {/* Soft scrim so very-saturated posters don't make the
              foreground image's edges blend into the backdrop. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-cream-50/35"
          />
          {/* The actual image, `object-contain` keeps the whole image
              visible regardless of aspect ratio. Min-height keeps very
              wide landscape photos from collapsing to a sliver.
              `key` on the img so React swaps the DOM node when the
              carousel advances — kills a brief flash of the previous
              image while the new src decodes. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={activePhoto}
            src={activePhoto}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="relative block w-full h-auto max-h-[420px] min-h-[180px] object-contain mx-auto"
          />
          {showCarouselControls ? (
            <>
              <span
                role="button"
                tabIndex={0}
                onClick={goPrev}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") goPrev(e as unknown as React.MouseEvent);
                }}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/65 hover:bg-black/85 text-cream-50 text-lg leading-none ring-1 ring-cream-50/20 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500"
              >
                ‹
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={goNext}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") goNext(e as unknown as React.MouseEvent);
                }}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/65 hover:bg-black/85 text-cream-50 text-lg leading-none ring-1 ring-cream-50/20 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500"
              >
                ›
              </span>
              <span
                aria-hidden
                className="absolute bottom-2 left-2 inline-flex items-center text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-black/65 text-cream-50 ring-1 ring-cream-50/20"
              >
                {safeIdx + 1} / {photos.length}
              </span>
            </>
          ) : null}
          {/* Tiny zoom-in glyph that hints at the click-to-expand
              affordance. Only visible on hover for desktop; on mobile
              the entire image is the tap target. */}
          <span
            aria-hidden
            className="absolute bottom-2 right-2 hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/45 text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
              <path d="M11 8v6" />
              <path d="M8 11h6" />
            </svg>
          </span>
        </button>
      ) : null}

      {post.text ? (
        <p
          className={`px-4 pt-2.5 text-[14px] text-ink-900 leading-snug ${
            post.language === "hi" ? "font-mukta" : ""
          }`}
        >
          {post.text}
        </p>
      ) : null}

      {/* Action row, Share / Copy on every post; Get directions when the
          linked bhandara has coords. Stops propagation so the card itself
          doesn't navigate. */}
      <PostActions post={post} isHi={isHi} locale={locale} />
    </li>
  );
}

function PostActions({
  post,
  isHi,
  locale,
}: {
  post: FeedPost;
  isHi: boolean;
  locale: Locale;
}) {
  const toast = useToast();
  const hasCoords =
    typeof post.bhandaraLat === "number" && typeof post.bhandaraLng === "number";
  const dirUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${post.bhandaraLat},${post.bhandaraLng}`
    : null;

  // Share message, built via the shared `spotShareText` helper so the
  // wording on /live matches what every other spot share callsite
  // produces (HappeningNow card, map popup, side list). Caption text
  // becomes the "Spotted:" line; the linked-bhandara URL (or the
  // homepage fallback) becomes the "Details:" / "See live bhandaras:"
  // line; the maps URL is the "Open in Maps:" line. The Copy button
  // gets the same text (NOT just the URL) so a paste into WhatsApp /
  // Telegram / Signal / etc. lands as a complete warm message.
  //
  // We hand the helper post.bhandaraLat/Lng as the coords (every
  // FeedPost in /live has them, falls back to the spot's own coords
  // server-side in src/app/live/page.tsx). caption uses post.text
  // which the API already strips of the [bot:...] tag via
  // stripBotProvenance.
  const shareInput = {
    lat: typeof post.bhandaraLat === "number" ? post.bhandaraLat : 0,
    lng: typeof post.bhandaraLng === "number" ? post.bhandaraLng : 0,
    caption: post.text,
    area: null,
    bhandaraSlug: post.bhandaraSlug,
  };
  const shareText = spotShareText(shareInput, locale);
  const waUrl = whatsappShareUrlForSpot(shareInput, locale);

  return (
    <div className="px-4 pt-2.5 pb-3 flex flex-wrap items-center gap-1.5">
      {dirUrl ? (
        <a
          href={dirUrl}
          target="_blank"
          rel="noreferrer noopener"
          onClick={() =>
            trackEvent("live_feed_get_directions", { post_id: post.id })
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 text-xs font-semibold px-3 py-1.5 transition-colors"
        >
          <IconPin />
          {isHi ? "रास्ता बताएँ" : "Get directions"}
        </a>
      ) : null}
      <a
        href={waUrl}
        target="_blank"
        rel="noreferrer noopener"
        onClick={() =>
          trackEvent("live_feed_share_post", { post_id: post.id })
        }
        className="inline-flex items-center gap-1.5 rounded-full border border-leaf-600/50 bg-cream-50 hover:border-leaf-600 text-leaf-600 text-xs font-semibold px-3 py-1.5 transition-colors"
        aria-label={isHi ? "व्हाट्सएप पर शेयर" : "Share on WhatsApp"}
      >
        <IconWhatsapp />
        {isHi ? "शेयर" : "Share"}
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            // Copy the FULL warm share message (intro + caption +
            // place + maps url + badamangal url + closer), not just
            // the bare bhandara URL. Matches what the WhatsApp share
            // button sends, so a paste anywhere (Telegram, SMS,
            // email, notes app, etc.) produces a complete invite.
            await navigator.clipboard.writeText(shareText);
            trackEvent("live_feed_copy_link", { post_id: post.id });
            toast.show(isHi ? "संदेश कॉपी हो गया" : "Message copied");
          } catch {
            toast.show(
              isHi ? "कॉपी नहीं हुआ" : "Couldn't copy",
              "error",
            );
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-saffron-500/45 bg-cream-50 hover:border-saffron-500 text-saffron-600 text-xs font-semibold px-3 py-1.5 transition-colors"
      >
        <IconCopy />
        {isHi ? "लिंक" : "Copy link"}
      </button>
    </div>
  );
}

function IconPin() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6.5-7-6.5-12a6.5 6.5 0 1 1 13 0c0 5-6.5 12-6.5 12z" />
      <circle cx="12" cy="9" r="2.25" />
    </svg>
  );
}
function IconWhatsapp() {
  return (
    <svg width="13" height="13" viewBox="0 0 32 32" fill="currentColor" aria-hidden>
      <path d="M16 3C8.82 3 3 8.82 3 16c0 2.29.6 4.43 1.65 6.3L3 29l6.86-1.62A12.95 12.95 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 23.5c-1.93 0-3.74-.5-5.32-1.4l-.38-.22-4.07.96.97-3.96-.25-.4A10.5 10.5 0 1 1 16 26.5zm6.06-7.86c-.33-.17-1.96-.97-2.27-1.08-.3-.11-.52-.17-.74.17-.22.33-.85 1.07-1.04 1.29-.19.22-.38.25-.71.08-.33-.17-1.4-.52-2.66-1.65-.98-.88-1.65-1.96-1.84-2.29-.19-.33-.02-.51.15-.67.15-.15.33-.39.5-.58.16-.19.22-.33.33-.55.11-.22.06-.41-.03-.58-.08-.17-.74-1.79-1.01-2.45-.27-.66-.55-.57-.74-.58l-.63-.01a1.21 1.21 0 0 0-.88.41c-.3.33-1.15 1.13-1.15 2.75 0 1.62 1.18 3.19 1.34 3.41.16.22 2.32 3.55 5.62 4.97 2.61 1.13 3.14 1.06 3.71.99.57-.06 1.84-.75 2.1-1.48.26-.73.26-1.36.18-1.49-.08-.13-.3-.21-.63-.38z" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function relative(iso: string, isHi: boolean): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return isHi ? "अभी-अभी" : "just now";
  if (m < 60) return isHi ? `${m} मिनट पहले` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return isHi ? `${h} घंटे पहले` : `${h} hr ago`;
  const d = Math.floor(h / 24);
  return isHi ? `${d} दिन पहले` : `${d} day${d > 1 ? "s" : ""} ago`;
}
