"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import NearMeButton, { type NearMeState } from "@/components/NearMeButton";
import { publicCaption } from "@/lib/public-caption";
import { EmptyState, FeedList, FeedRow, Icon } from "@/components/v2";
import { haversineKm } from "@/lib/geo";
import { trackEvent } from "@/lib/ga";
import { useToast } from "@/components/Toast";
import type { Locale } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  hasMapPin,
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
  /** What to show when nothing is live in the city (the /live quiet
   *  state). Rendered at the top level, so it may be a <Section>. */
  emptySlot?: ReactNode;
};

const POLL_MS = 8000;
const MAX_KEEP = 60;

export default function LiveFeedTimeline({
  initial,
  bhandaras,
  activeBhandara: activeBhandaraProp,
  emptyHi,
  emptyEn,
  emptySlot,
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
  }, [posts, near, activeBhandara]);

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

  const nearActive = near.status === "active";
  const allEmpty = visiblePosts.length === 0 && !nearActive && !activeBhandara;

  return (
    <>
      {/* New posts arrived while the visitor was scrolled down. */}
      {newSinceFocus > 0 ? (
        <button type="button" onClick={onJumpToTop} className="bmi-b bmi-b-p sm bmi-live-new">
          <Icon name="chevron" className="up" />
          {isHi
            ? `${newSinceFocus} नई पोस्ट`
            : `${newSinceFocus} new ${newSinceFocus === 1 ? "post" : "posts"}`}
        </button>
      ) : null}

      {allEmpty && emptySlot ? (
        <>
          {emptySlot}
          {/* The "All" filter link stays in the page (same href as before). */}
          <Link href={filterPills[0].href} className="bmi-sr" prefetch={false}>
            {filterPills[0].name}
          </Link>
        </>
      ) : (
        <section className="bmi-sec tight" id="feed" aria-label={isHi ? "लाइव फ़ीड" : "Live feed"}>
          <div className="bmi-wrap">
            <div className="bmi-live-bar">
              <ul className="bmi-live-filters" aria-label={isHi ? "भंडारे से छाँटें" : "Filter by bhandara"}>
                {filterPills.map((b) => {
                  const active = (activeBhandara ?? null) === (b.slug ?? null);
                  return (
                    <li key={b.slug ?? "all"}>
                      <Link
                        href={b.href}
                        prefetch={false}
                        aria-current={active ? "true" : undefined}
                        className="bmi-choice"
                        onClick={() => trackEvent("live_feed_filter", { bhandara: b.slug ?? "all" })}
                      >
                        {b.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <NearMeButton
                isHi={isHi}
                active={nearActive}
                source="live_feed"
                size="sm"
                onChange={setNear}
              />
            </div>
            {nearActive ? (
              <p className="bmi-fine bmi-live-near">
                {isHi
                  ? `3 कि.मी. के दायरे में ${visiblePosts.length} पोस्ट`
                  : `${visiblePosts.length} posts within 3 km`}
              </p>
            ) : null}

            <div className="bmi-live-feed">
              {visiblePosts.length === 0 ? (
                <div aria-live="polite">
                  <EmptyState
                    headingAs="h3"
                    title={
                      nearActive
                        ? { en: "Nothing within 3 km of you yet.", hi: "3 कि.मी. के दायरे में अभी कोई स्पॉट नहीं।" }
                        : { en: "The bhandaras are quiet right now.", hi: "अभी भंडारे शांत हैं।" }
                    }
                    lede={
                      nearActive
                        ? isHi
                          ? "थोड़ा दायरा बढ़ाकर देखिए, या अपने मोहल्ले से पहली रिपोर्ट खुद कीजिए, एक तस्वीर बस।"
                          : "Widen the radius from the All filter, or be the first to post from your own street, one photo is all it takes."
                        : isHi
                          ? emptyHi ?? "अभी कोई पोस्ट नहीं।"
                          : emptyEn ?? "No posts yet."
                    }
                  />
                </div>
              ) : (
                <FeedList label={isHi ? "लाइव फ़ीड" : "Live feed"}>
                  {visiblePosts.map((p) => (
                    <PostRow
                      key={p.id}
                      post={p}
                      locale={locale}
                      onOpenLightbox={(url) => {
                        setLightboxUrl(url);
                        trackEvent("live_feed_image_open", { post_id: p.id });
                      }}
                    />
                  ))}
                </FeedList>
              )}
            </div>
          </div>
        </section>
      )}

      {lightboxUrl ? <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} isHi={isHi} /> : null}
    </>
  );
}

/**
 * Full screen image viewer, portalled to <body> so no transformed
 * ancestor (scroll reveals) can trap the fixed layer. Closes on the
 * backdrop, Escape, or the close button. The whole image always shows.
 */
function Lightbox({ url, onClose, isHi }: { url: string; onClose: () => void; isHi: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isHi ? "तस्वीर" : "Image viewer"}
      onClick={onClose}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={isHi ? "बंद करें" : "Close image viewer"}
        className="absolute top-4 right-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M5 5l14 14" />
          <path d="M19 5L5 19" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onClick={(e) => e.stopPropagation()}
        className="max-w-[96vw] max-h-[92vh] object-contain rounded-lg select-none"
      />
    </div>,
    document.body,
  );
}

/**
 * One spot in the feed: where (the bhandara, never the spotter), when,
 * the spotter's own words (never an AI vision caption), the photo (the
 * whole picture, never cropped: a pamphlet shows in full), and three
 * quiet actions.
 */
function PostRow({
  post,
  locale,
  onOpenLightbox,
}: {
  post: FeedPost;
  locale: Locale;
  onOpenLightbox: (url: string) => void;
}) {
  const isHi = locale === "hi";
  const photos: string[] =
    post.photoUrls && post.photoUrls.length > 0
      ? post.photoUrls
      : post.photoUrl
        ? [post.photoUrl]
        : [];
  const [photoIdx, setPhotoIdx] = useState(0);
  const safeIdx = Math.max(0, Math.min(photoIdx, photos.length - 1));
  const activePhoto = photos[safeIdx] ?? null;
  const text = publicCaption(post.text);
  const where = post.bhandaraName || (isHi ? "स्पॉटर" : "Spotter");

  return (
    <FeedRow
      id={post.id}
      meta={
        <>
          {post.bhandaraSlug && post.bhandaraName ? (
            <Link href={`/bhandara/${post.bhandaraSlug}${isHi ? "" : "?lang=en"}`} prefetch={false} className="bmi-live-where">
              <b>{where}</b>
            </Link>
          ) : (
            <b>{where}</b>
          )}
          <time dateTime={post.createdAt} suppressHydrationWarning>
            {relative(post.createdAt, isHi)}
          </time>
        </>
      }
      text={text ?? undefined}
    >
      {activePhoto ? (
        <>
          <button
            type="button"
            className="bmi-livepic"
            onClick={() => onOpenLightbox(activePhoto)}
            aria-label={
              photos.length > 1
                ? isHi
                  ? `तस्वीर ${safeIdx + 1} / ${photos.length} खोलें`
                  : `Open photo ${safeIdx + 1} of ${photos.length}`
                : isHi
                  ? "पूरी तस्वीर देखें"
                  : "View full image"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bg" src={activePhoto} alt="" aria-hidden loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={activePhoto} className="fg" src={activePhoto} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          </button>
          {photos.length > 1 ? (
            <ul className="bmi-livepic-thumbs" aria-label={isHi ? "इस स्पॉट की तस्वीरें" : "Photos in this spot"}>
              {photos.map((u, i) => (
                <li key={`${u}-${i}`}>
                  <button
                    type="button"
                    aria-pressed={i === safeIdx}
                    aria-label={isHi ? `तस्वीर ${i + 1}` : `Photo ${i + 1}`}
                    onClick={() => setPhotoIdx(i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      <PostActions post={post} isHi={isHi} locale={locale} />
    </FeedRow>
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
  // Same map pin rule as every other surface (never null island).
  const dirUrl = hasMapPin({
    lat: post.bhandaraLat ?? null,
    lng: post.bhandaraLng ?? null,
  })
    ? `https://www.google.com/maps/dir/?api=1&destination=${post.bhandaraLat},${post.bhandaraLng}`
    : null;

  // Share message via the shared helper, so /live words match every
  // other spot share. Copy puts the same full message on the clipboard.
  const shareInput = {
    lat: typeof post.bhandaraLat === "number" ? post.bhandaraLat : 0,
    lng: typeof post.bhandaraLng === "number" ? post.bhandaraLng : 0,
    caption: publicCaption(post.text),
    area: null,
    bhandaraSlug: post.bhandaraSlug,
  };
  const shareText = spotShareText(shareInput, locale);
  const waUrl = whatsappShareUrlForSpot(shareInput, locale);

  return (
    <div className="bmi-live-acts-row">
      {dirUrl ? (
        <a
          href={dirUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="bmi-tl"
          onClick={() => trackEvent("live_feed_get_directions", { post_id: post.id })}
        >
          <Icon name="pin" />
          {isHi ? "रास्ता" : "Directions"}
        </a>
      ) : null}
      <a
        href={waUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="bmi-tl"
        onClick={() => trackEvent("live_feed_share_post", { post_id: post.id })}
        aria-label={isHi ? "व्हाट्सएप पर शेयर" : "Share on WhatsApp"}
      >
        <Icon name="share" />
        {isHi ? "शेयर" : "Share"}
      </a>
      <button
        type="button"
        className="bmi-tl"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(shareText);
            trackEvent("live_feed_copy_link", { post_id: post.id });
            toast.show(isHi ? "संदेश कॉपी हो गया" : "Message copied");
          } catch {
            toast.show(isHi ? "कॉपी नहीं हुआ" : "Couldn't copy", "error");
          }
        }}
      >
        <Icon name="copy" />
        {isHi ? "लिंक" : "Copy link"}
      </button>
    </div>
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
