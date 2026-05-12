"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import NearMeButton, { type NearMeState } from "@/components/NearMeButton";
import { haversineKm } from "@/lib/geo";
import { trackEvent } from "@/lib/ga";
import { useToast } from "@/components/Toast";
import type { Locale } from "@/content/strings";

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
  language: string;
  createdAt: string;
};

type Bhandara = { slug: string; name: string };

type Props = {
  initial: FeedPost[];
  bhandaras: Bhandara[];
  /** Optional override — when present, takes priority over the URL.
   *  Kept for tests / non-routed callers. The /live page no longer
   *  passes this so the page can stay statically cached; the value
   *  is read from `window.location.search` on mount instead. */
  activeBhandara?: string | null;
  locale: Locale;
  kicker: string;
  emptyHi: string;
  emptyEn: string;
};

const POLL_MS = 8000;
const MAX_KEEP = 60;

export default function LiveFeedTimeline({
  initial,
  bhandaras,
  activeBhandara: activeBhandaraProp,
  locale,
  emptyHi,
  emptyEn,
}: Props) {
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

    // Poll-only. SSE was removed when we migrated to Netlify Functions —
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

      {/* Filters + status — single row: bhandara filter pills on the left,
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
          <div className="rounded-3xl border border-dashed border-gold-500/45 bg-cream-50 px-6 py-12 text-center">
            <p className="text-ink-600">
              {near.status === "active"
                ? isHi
                  ? "आपके 3 कि.मी. के दायरे में अभी कोई पोस्ट नहीं है।"
                  : "No posts within 3 km of you yet."
                : isHi
                  ? emptyHi
                  : emptyEn}
            </p>
          </div>
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

      {/* Lightbox modal — mounted once at the parent. Closes on
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
      {/* Close button — top right of viewport */}
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
          should NOT close — only clicks on the backdrop do. */}
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
  return (
    <li
      className={`group rounded-2xl border bg-cream-50 shadow-warm overflow-hidden transition-shadow ${
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

      {post.photoUrl ? (
        // Image well: blurred backdrop of the same image (so portrait
        // posters and landscape photos both look intentional, never
        // cropped) + the real image rendered with `object-contain` on
        // top. Click anywhere to open the full image in a lightbox.
        <button
          type="button"
          onClick={() => post.photoUrl && onOpenLightbox(post.photoUrl)}
          aria-label="View full image"
          className="group/img relative block w-full overflow-hidden cursor-zoom-in"
          style={{ aspectRatio: "auto" }}
        >
          {/* Blurred backdrop — same image, scaled up, blurred, dimmed
              so it acts as a colour-aware fill behind the contained
              foreground image. Inline style avoids needing to add a
              Tailwind arbitrary-property class for every URL. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-center bg-cover scale-110"
            style={{
              backgroundImage: `url(${JSON.stringify(post.photoUrl).slice(1, -1)})`,
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
          {/* The actual image — `object-contain` keeps the whole image
              visible regardless of aspect ratio. Min-height keeps very
              wide landscape photos from collapsing to a sliver. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.photoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="relative block w-full h-auto max-h-[420px] min-h-[180px] object-contain mx-auto"
          />
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
      <PostActions post={post} isHi={isHi} />
    </li>
  );
}

function PostActions({ post, isHi }: { post: FeedPost; isHi: boolean }) {
  const toast = useToast();
  const hasCoords =
    typeof post.bhandaraLat === "number" && typeof post.bhandaraLng === "number";
  const dirUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${post.bhandaraLat},${post.bhandaraLng}`
    : null;
  // Sharable URL: prefer the linked bhandara's detail page; fall back to
  // the live feed when there's no bhandara link.
  const detailUrl =
    typeof window !== "undefined"
      ? post.bhandaraSlug
        ? `${window.location.origin}/bhandara/${post.bhandaraSlug}`
        : `${window.location.origin}/live`
      : "";
  const shareText = `${post.authorName}: ${post.text ?? "Live update"}, ${detailUrl}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

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
            await navigator.clipboard.writeText(detailUrl);
            trackEvent("live_feed_copy_link", { post_id: post.id });
            toast.show(isHi ? "लिंक कॉपी हो गया" : "Link copied");
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
