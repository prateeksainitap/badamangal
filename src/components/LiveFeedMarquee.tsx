"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/ga";
import { JaliCorner, SunburstSpark } from "@/components/ornaments";

type FeedPost = {
  id: string;
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  authorName: string;
  text: string | null;
  photoUrl: string | null;
  language: string;
  createdAt: string;
};

type Props = {
  initial: FeedPost[];
};

const POLL_MS = 8000;
const MAX_KEEP = 24;

export default function LiveFeedMarquee({ initial }: Props) {
  const [posts, setPosts] = useState<FeedPost[]>(initial);
  const seenIds = useRef<Set<string>>(new Set(initial.map((p) => p.id)));

  // Poll-only (Netlify Functions can't keep long-lived SSE streams
  // open past ~26 s, so we removed the EventSource branch entirely).
  useEffect(() => {
    const merge = (incoming: FeedPost | FeedPost[]) => {
      const arr = Array.isArray(incoming) ? incoming : [incoming];
      setPosts((prev) => {
        const next = [...prev];
        for (const p of arr) {
          if (seenIds.current.has(p.id)) continue;
          seenIds.current.add(p.id);
          next.unshift(p);
        }
        return next.slice(0, MAX_KEEP);
      });
    };
    const stopPolling = startPolling(merge);
    return () => stopPolling();
  }, []);

  // Marquee needs visual rhythm to read as "moving"; below 3 entries
  // it returns null. The empty-state preview lives inside HappeningNow
  // (just above this section on the homepage) so we never carry two
  // "be the first to spot one" panels at the same time.
  const isEmpty = posts.length < 3;

  // Render the post list twice so the CSS marquee animation loops
  // seamlessly, when the first copy has fully translated out of view,
  // the second identical copy is already in position, then the
  // animation resets without a visible jump.
  const train = useMemo(() => [...posts, ...posts], [posts]);

  if (isEmpty) return null;

  return (
    <section className="bg-cream-50 border-y border-gold-500/30 py-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mb-3 flex items-center justify-between gap-3">
        <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold inline-flex items-center gap-2">
          <span aria-hidden className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-saffron-600 opacity-50 motion-safe:animate-ping" />
            <span className="relative h-2 w-2 rounded-full bg-saffron-600" />
          </span>
          Live from Lucknow · auto-moderated
        </p>
        <Link
          href="/live"
          className="inline-flex items-center gap-1.5 text-[11px] text-saffron-600 hover:underline"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-saffron-600 opacity-50 motion-safe:animate-ping" />
            <span className="relative h-2 w-2 rounded-full bg-saffron-600" />
          </span>
          Open live feed →
        </Link>
      </div>

      {/* Continuous CSS marquee, the cards translate left at a steady
          rate, no scrollbar, no arrows. Pauses on hover so the user can
          read a card mid-flight.

          `overflow-x-clip` (not `overflow-hidden`) so the off-screen
          cards on either side are still clipped, but the cards' bottom
          shadows can extend below the row without being chopped off.
          Padding-y on the wrapper gives shadows additional headroom
          above the section's lower border. */}
      <div
        className="relative group overflow-x-clip py-3"
        aria-label="Latest comments from devotees"
      >
        <div className="flex items-stretch w-max gap-3 motion-safe:animate-marquee-slow motion-reduce:animate-none group-hover:[animation-play-state:paused]">
          {train.map((p, i) => (
            <FeedCard key={`${p.id}-${i}`} post={p} />
          ))}
        </div>

        {/* Edge fades. Pointer-events disabled so they don't block
            anything underneath. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-cream-50 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-cream-50 to-transparent" />
      </div>
    </section>
  );
}

function startPolling(onPosts: (posts: FeedPost[]) => void): () => void {
  let alive = true;
  const tick = async () => {
    try {
      const res = await fetch("/api/feed?limit=12", { cache: "no-store" });
      if (!alive || !res.ok) return;
      const data = (await res.json()) as { posts: FeedPost[] };
      onPosts(data.posts);
    } catch {
      /* ignore */
    }
  };
  const id = window.setInterval(tick, POLL_MS);
  return () => {
    alive = false;
    window.clearInterval(id);
  };
}

function FeedCard({ post }: { post: FeedPost }) {
  const initial = post.authorName.trim().charAt(0).toUpperCase() || "•";
  const isHi = post.language === "hi";
  // Editorial card design: image hero up top with a floating "live N
  // hours ago" pill, caption as a curly-quoted pull-quote in the
  // middle, author as a quiet em-dash byline at the bottom. Jali
  // corners + a warm cream→saffron gradient backdrop carry the
  // brand identity without leaning on the generic "tweet card" feel.
  return (
    <article
      className="group relative w-[260px] sm:w-[290px] h-[268px] shrink-0 flex flex-col overflow-hidden rounded-2xl
        bg-gradient-to-br from-white via-cream-50 to-saffron-50/30
        border border-gold-500/30
        shadow-[0_8px_22px_rgba(26,20,16,0.08)]
        hover:shadow-[0_14px_36px_rgba(156,42,42,0.12)] hover:border-saffron-500/50
        motion-safe:hover:-translate-y-0.5
        transition-all duration-300"
    >
      {/* Jali corner ornaments, small, subtle, only at top corners. */}
      <JaliCorner
        position="tl"
        className="absolute top-1.5 left-1.5 w-4 h-4 text-gold-500/55 z-10 pointer-events-none"
      />
      <JaliCorner
        position="tr"
        className="absolute top-1.5 right-1.5 w-4 h-4 text-gold-500/55 z-10 pointer-events-none"
      />

      {/* IMAGE WELL, slightly shorter than before so the body has more
          presence and the card overall reads sleeker. */}
      <div className="relative w-full h-[136px] overflow-hidden">
        {post.photoUrl ? (
          <>
            <span
              aria-hidden
              className="absolute inset-0 bg-center bg-cover scale-110"
              style={{
                backgroundImage: `url(${JSON.stringify(post.photoUrl).slice(1, -1)})`,
                filter: "blur(22px) saturate(1.15)",
                opacity: 0.6,
              }}
            />
            <span aria-hidden className="absolute inset-0 bg-cream-50/25" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.photoUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="relative w-full h-full object-contain"
            />
          </>
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background:
                "radial-gradient(260px 160px at 50% 45%, rgba(242,148,76,0.30), transparent 70%), linear-gradient(135deg, #FFF7EB 0%, #FFE3BE 100%)",
            }}
          >
            <SunburstSpark
              size={56}
              className="text-saffron-600 opacity-75 motion-safe:group-hover:rotate-[12deg] motion-safe:group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        {/* Floating "LIVE · 2h" pill on the image */}
        <div className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm text-cream-50 pl-2 pr-2.5 py-1 shadow-warm">
          <span aria-hidden className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-saffron-500 opacity-80 motion-safe:animate-ping" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-saffron-500" />
          </span>
          <span className="text-[9.5px] uppercase tracking-[0.22em] font-bold leading-none">
            Live · {relative(post.createdAt)}
          </span>
        </div>

        {/* Subtle bottom gradient so the well's bottom edge feels
            integrated with the body below instead of a hard line. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-cream-50/80 to-transparent pointer-events-none"
        />
      </div>

      {/* BODY, caption pull-quote + author byline */}
      <div className="flex-1 px-3.5 pt-2.5 pb-2.5 flex flex-col min-h-0">
        {post.text ? (
          <p
            className={`leading-snug line-clamp-3 text-[13.5px] text-sindoor-700 ${
              isHi ? "font-mukta" : "font-fraunces italic"
            }`}
          >
            {`“${post.text}”`}
          </p>
        ) : (
          <p className="text-xs italic text-ink-600/70">
            Live from the streets of Lucknow.
          </p>
        )}

        {/* Author byline, tighter avatar + em-dash + name. */}
        <div className="mt-auto pt-2 flex items-center gap-1.5 border-t border-gold-500/20">
          <span
            aria-hidden
            className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full text-cream-50 font-semibold text-[10px]"
            style={{
              background: "linear-gradient(135deg, #F2944C 0%, #9C2A2A 100%)",
            }}
          >
            {initial}
          </span>
          <p className="text-[11px] text-ink-900 font-semibold truncate">
            {/* Middot prefix (was an em-dash) keeps the editorial "by-line"
                feel without using the em-dash punctuation we're phasing
                out across the site. */}
            <span className="text-ink-600/60 mr-1">·</span>
            {post.authorName}
          </p>
        </div>
      </div>
    </article>
  );
}

function relative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}
