# Resources hub — News, Hanuman Chalisa, Aarti, and more

> Goal: a section of BadaMangal.com that becomes the canonical place to read, listen to, and watch Hanuman-related devotional content tied to the Bada Mangal season — plus a curated news feed of "what's happening in Lucknow this week".
>
> Builds trust, drives organic SEO, gives devotees a reason to return year-round.

---

## 1. Information architecture

```
/resources
├── /news               ← This week in Lucknow (curated + auto)
├── /chalisa            ← Hanuman Chalisa (text + audio + video)
├── /aarti              ← Hanuman Aarti (text + audio + video)
├── /sundar-kand        ← Sundar Kand (text + audio + video) [Phase 2]
├── /bajrang-baan       ← Bajrang Baan (text + audio + video) [Phase 2]
├── /rituals            ← Tuesday vrat & puja vidhi guide
└── /temples            ← Aliganj, Hanuman Setu, Sankat Mochan etc.
```

Hub page `/resources` is a magazine-style index showing four featured cards (Chalisa, Aarti, Latest News, Today's Tuesday Vidhi).

---

## 2. /news — "This week in Lucknow"

### Content sources

Mixed approach for week-1 launch:

- **Curated by you (manual):** 1 hand-picked article per Tuesday — major news outlets covering Bada Mangal in Lucknow. Headline, 2-line summary, source attribution, link.
- **Aggregated (semi-auto):** RSS feeds from local outlets — pull headlines, store summaries, manually approve before publishing.

Recommended local feeds to monitor:
- Hindustan Times Lucknow city section
- Times of India Lucknow
- Lucknow Buzz
- Knocksense Lucknow
- Lucknow Pulse
- Amar Ujala Lucknow (Hindi)
- Aaj Tak Lucknow (Hindi)

### Layout
- Magazine-style: lead story (60% width with photo), three secondary stacked beside, then a row of six text-only links.
- Each entry: headline, 2-line excerpt, source name + date, **read on source site** button.
- Never reproduce article body — link out only. Respects copyright and pushes traffic to original publishers (good will when we want them to write about us).

### Auto-summary (Phase 2)
Summarize headlines with Anthropic Haiku to produce a 2-line excerpt in our brand voice. Always link to source.

---

## 3. /chalisa — Hanuman Chalisa

### Source the canonical text — DO NOT type it from memory

Tulsidas's Hanuman Chalisa is centuries-old public-domain text, but exact orthography matters. Do NOT reproduce verses from memory or generate them — they will be subtly wrong and devotees will notice immediately.

**Correct sourcing process:**
1. Pull text from a verified scholarly source: **Gita Press Gorakhpur** publication, or the **Sacred Texts archive**, or **Wikisource Hindi** (`hi.wikisource.org`).
2. Verify against at least one second source.
3. Save the canonical Devanagari text in `src/content/chalisa.devanagari.ts` with explicit verse numbers.
4. Provide an English transliteration (IAST or simple romanization) in `src/content/chalisa.roman.ts`.
5. Provide a faithful English meaning in `src/content/chalisa.translation.ts`.
6. Note the source and date of the pulled text in a comment at the top of each file.

This must be done by **you (Prateek) or an editor**, not by Claude Code generation. Devotional text cannot be hallucinated.

### Layout

Two-column on desktop, stacked on mobile:

```
[ Verse number . Devanagari ]  [ Verse number . Translation ]
```

Above the verses, a player bar:

```
[ ▶ Play audio ]   [ ⌖ Sync verses ]   Speed: 0.75x | 1x | 1.25x   Lang: हिंदी | Roman | English
```

### Audio
- Embed an audio player from a verified source. Options:
  - **Anuradha Paudwal**'s recording (Tulsidas Hanuman Chalisa) — widely available; license per source.
  - **Hariharan**'s recording.
  - **Jagjit Singh**'s recording (devotional).
  - **Gulshan Kumar / T-Series** recordings — popular but verify licensing.
- **Critical:** do not host audio without rights. Either link out to YouTube official channels, embed the YouTube IFrame Player, OR commission a fresh recitation from a Lucknow priest (clean rights, supports a local pandit).

For the launch: embed YouTube's IFrame Player from official artist channels using their video IDs. Provide a fallback link if YouTube blocks embedding.

### Video
- Same approach: embed YouTube videos from verified channels (T-Series Bhakti Sagar, Anuradha Paudwal Official, etc.).
- Use the responsive embed pattern: 16:9 wrapper with absolute-positioned iframe.

### Sync feature (Phase 2)
- Build a verse-sync mode where the current verse highlights as the audio plays. Requires manually timed cue points per recording. Good Phase 2 feature, skip for launch.

---

## 4. /aarti — Hanuman Aarti

Same structure as /chalisa.

- Canonical text: "Aarti Kije Hanuman Lala Ki" — verify from Gita Press source.
- Layout: same two-column.
- Audio: link out to verified versions; popular renditions by Hariharan, Lakhbir Singh Lakkha, Jagjit Singh.
- Video: same embed approach.

---

## 5. /rituals — Tuesday vrat & puja vidhi

A simple, practical guide. Sections:

- **Why fast on Tuesday?** (1 paragraph; faith-respecting)
- **What to do on a Bada Mangal:** wake before sunrise, bathe, visit a Hanuman temple, recite Chalisa, offer red flowers / sindoor / boondi laddoo, distribute / receive prasad at a bhandara.
- **What NOT to do:** salt-free fast, avoid non-veg, avoid alcohol, avoid harm-thoughts.
- **Mantras (short):** ॐ हं हनुमते नमः · ॐ हं हनुमते रुद्रात्मकाय हुं फट · the simple "Jai Hanuman Gyan Gun Sagar" line.

Source mantras from the same verified-text process as the Chalisa. Don't generate.

Style: plain, factual, no proselytizing. Useful even for someone who's never observed the day before.

---

## 6. /temples — Hanuman temples of Lucknow

A directory page. Each temple has its own sub-page.

Featured temples (launch with these 5):

- **Aliganj Hanuman Mandir (Naya Hanuman Mandir)** — flagship.
- **Aliganj Old Hanuman Mandir** — the "purana" Hanuman temple.
- **Hanuman Setu Mandir, Daliganj** — riverside, hugely visited.
- **Sankat Mochan Hanuman Mandir, Hazratganj** — historic.
- **Bada Hanuman Mandir, Khun Khun Ji Road** — old city.

Each temple page includes: photo, address with map, history (1 paragraph), aarti / darshan timings (verify locally), the Tuesday crowd size estimate, the bhandaras typically near it.

This is heavy SEO real estate — every "Hanuman temple Lucknow" search term should land here.

---

## 7. Content sourcing checklist (apply to every page)

For every devotional or factual claim:

- [ ] Source named (e.g., "Gita Press Gorakhpur, Hanuman Chalisa, 2018 edition")
- [ ] Verified against a second source
- [ ] No invented Sanskrit or Hindi verses
- [ ] No invented English translations — use established translators (Hawley, Lutgendorf for Tulsidas)
- [ ] No statement about a temple's history without a citation
- [ ] No claims about ritual purity or impurity from non-traditional sources

Whenever in doubt, **say less, link to source**. The site's authority is built on accuracy.

---

## 8. Player UI

The audio/video player is a brand moment. Style it specifically:

- Container: cream-50 bg, gold-100 border, rounded-2xl, paper texture, `shadow-warm`.
- Big circular play button: 64px, saffron-600 fill, white triangle, on hover scales to 1.05 with a subtle glow.
- Progress bar: gold-500 fill, ink-600 track.
- Speed selector: simple chip group "0.75x · 1x · 1.25x".
- Language toggle: pill set "हिंदी / Roman / English".
- Below the player: artist credit + source link in caption type.

Build as a single `<DevotionalPlayer />` component reused across Chalisa, Aarti, etc.

---

## 9. SEO meta for each page

Every resource page MUST set:

- `<title>` — `"Hanuman Chalisa — हनुमान चालीसा (with audio) — BadaMangal.com"` style
- `<meta name="description">` — 155 chars, naturally including target query
- OpenGraph image with the relevant illustration
- JSON-LD structured data:
  - `Article` schema for /news entries
  - `FAQPage` schema for /rituals
  - `Place` schema for /temples
- Hreflang tags for Hindi/English variants

This single section can drive 30–40% of the site's organic traffic year-round if done well.

---

## 10. Editorial cadence (after launch)

Manually publish weekly:

- **Every Monday morning:** "This week's Bada Mangal" news roundup (5 stories).
- **Every Tuesday morning:** highlight one bhandara that's particularly notable.
- **Every Wednesday:** photo/video recap from that week's Tuesday.

Build a small `/admin/editorial` panel for queueing and publishing these.

---

## 11. Things explicitly OUT of scope for week-1 launch

- Verse-sync animation
- Live-stream player (Phase 3)
- User-uploaded covers / arrangements
- Translations into more than English
- Comment threads on chalisa/aarti pages

Ship: text in two scripts + a working YouTube embed + a clean player UI. That's enough to be useful and credible at launch.
