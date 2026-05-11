"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/ga";

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

  if (isEmpty) return null;

  // Duplicate so the CSS marquee loops seamlessly.
  const train = [...posts, ...posts];

  return (
    <section className="bg-cream-50 border-y border-gold-500/30 py-6 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mb-3 flex items-center justify-between gap-3">
        <p className="font-cormorant uppercase tracking-[0.32em] text-gold-500 text-xs">
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
      <div
        className="relative group"
        aria-label="Latest comments from devotees"
      >
        <div className="flex w-max gap-3 motion-safe:animate-marquee-slow motion-reduce:animate-none group-hover:[animation-play-state:paused]">
          {train.map((p, i) => (
            <FeedCard key={`${p.id}-${i}`} post={p} />
          ))}
        </div>
        {/* Edge fades */}
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
  const inner = (
    <article className="w-[260px] sm:w-[300px] shrink-0 rounded-2xl bg-white border border-gold-100 shadow-warm px-4 py-3 flex flex-col gap-2">
      {/* Author row, author chip on the left, bhandara label below
          (instead of squished side-by-side, so neither gets cropped). */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden
          className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-full bg-saffron-600 text-cream-50 font-semibold text-sm"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900 truncate">
            {post.authorName}
          </p>
          <p className="text-[10px] text-ink-600 mt-0.5">
            {relative(post.createdAt)}
          </p>
        </div>
      </div>

      {post.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-24 w-full object-cover rounded-lg border border-gold-100"
        />
      ) : null}
      {post.text ? (
        <p className="text-sm text-ink-900/85 leading-snug line-clamp-3">
          {post.text}
        </p>
      ) : null}
    </article>
  );

  // Cards are no longer linked to a bhandara, the post-card body stays
  // self-contained on the marquee.
  return inner;
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
