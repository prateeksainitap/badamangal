# UPGRADE prompts for Claude Code

> The MVP exists but feels generic. This file lifts it to launch quality.
>
> Read every doc in this `upgrade/` folder before starting. Follow the phases in order.
>
> **Setup:**
> ```
> cd "/Users/prateeksaini/Documents/Personal/Bada Mangal/badamangal-app"
> claude
> ```

---

## PHASE 0 — Read every brief before touching code

```
Before you write any code, read these files in this order and confirm you understand them by replying with a 6-bullet summary back to me:

1. CLAUDE.md (project context — already in your memory)
2. upgrade/design-system-v2.md
3. upgrade/content/history-story.md
4. upgrade/content/ai-image-prompts.md
5. upgrade/content/aarti-chalisa.md
6. upgrade/specs/map-quick-add.md
7. upgrade/specs/live-feed-moderation.md

Also list every brand SVG file in upgrade/brand/ and confirm dimensions.

Do NOT write any code in this phase. Only confirm the briefs.
```

When the summary is correct, proceed.

---

## PHASE A — Logo, design tokens, ornament library

Goal: visual foundation for the rest of the upgrade.

```
Implement Phase A:

1. Copy upgrade/brand/logo-primary.svg, logo-mark.svg, logo-horizontal.svg into public/brand/. Reference logo-mark.svg in the favicon link tag of the root layout.

2. Replace the current Header component:
   - Use logo-horizontal.svg on desktop, logo-mark.svg + the wordmark "बड़ा मंगल" in tiro on mobile.
   - Add a sticky behavior with a subtle gold border-bottom that fades in on scroll.
   - Right side: Hindi/EN pill toggle, "Add a bhandara" CTA in saffron-600.

3. Add the textured-saffron utility from design-system-v2.md §1 to globals.css. Replace flat saffron-600 backgrounds in the hero with this gradient.

4. Add public/textures/paper-grain.svg (small SVG with feTurbulence noise filter). Apply a body class .paper that uses it as a 240px-tiled background-image with multiply blend, ~5% effective opacity.

5. Build the ornament library at src/components/ornaments/:
   - MarigoldDivider.tsx
   - JaliCorner.tsx (4 rotated variants via prop)
   - DiyaCluster.tsx
   - SunburstSpark.tsx (small version of the 8-ray sun)
   - OmWatermark.tsx (large pale-gold ॐ for section bg)
   - GadaBullet.tsx (replaces • in story lists)
   Each is a pure SVG component accepting className and color props.

6. Update tailwind.config.ts with the typography mix from design-system-v2.md §2: tiro, fraunces (with optical-size variable), mukta, cormorant. Wire fonts via next/font/google in src/app/layout.tsx as CSS variables.

7. Replace every plain <hr /> in the codebase with <MarigoldDivider />.

8. Update the homepage hero:
   - Asymmetric 60/40 split.
   - Left 60%: Devanagari headline (drop cap), English subline, two CTAs.
   - Right 40%: placeholder PNG /illustrations/hero-hanuman.png (see PHASE F note below; for now use a styled placeholder block with the SunburstSpark + JaliCorner ornaments so it doesn't look empty).
   - Add the textured-saffron background to the hero band.
   - Add a single first-visit "Jay Shri Ram" 1.2s greeting watermark, top-right, fade in then fade out, gated by a sessionStorage flag (this is the ONLY sessionStorage usage allowed).

Run typecheck. Take screenshots in 360px and 1280px widths. Stop and report.
```

---

## PHASE B — History page (long-form story)

```
Implement Phase B:

1. Create src/content/history.ts that exports the structured article from upgrade/content/history-story.md as typed sections (heading, body paragraphs, pull-quote, timeline). Bring the prose verbatim — do NOT paraphrase or shorten.

2. Build src/app/history/page.tsx as a long-form editorial layout:
   - Single column, max 65ch.
   - 96px Cormorant Garamond drop cap on the first paragraph.
   - <MarigoldDivider /> between every section.
   - Pull quote in its own row, full-width, Cormorant italic 32px, gold-500 left border 4px.
   - Timeline component: render the five date markers as a horizontal row of jali-pattern nodes on desktop, vertical chain on mobile.
   - Banner image slots between sections 3-4, 5-6, and after section 8 — each with the appropriate /illustrations/*.png path (see PHASE F).

3. Set the page <title>, meta description, and OG image per upgrade/content/aarti-chalisa.md §9 standards.

4. Add a "Read the story" CTA on the homepage's story-teaser section that links here.

Run typecheck. Visual QA. Stop and report.
```

---

## PHASE C — Map quick-add and Google Maps deep links

```
Implement Phase C per upgrade/specs/map-quick-add.md.

1. Refactor /list-bhandara to a multi-step flow:
   Step 1: Drop the pin (full-screen map step — geolocation permission, draggable pin, autocomplete search, reverse-geocode the address).
   Step 2: Bhandara name (Hindi + English) and area dropdown.
   Step 3: Tuesday dates and time window.
   Step 4: Menu and capacity.
   Step 5: Organizer credits and UPI ID.
   Step 6: Optional photo.
   Step 7: Review and submit.

   Use the 8-lamp progress indicator from design-system-v2.md §8.

2. For week-1 launch use Leaflet + Nominatim. Add a debounced (250ms) search autocomplete using https://nominatim.openstreetmap.org/search. Implement reverse-geocoding via https://nominatim.openstreetmap.org/reverse on pin drop.

3. Update the Bhandara Prisma model to add googlePlaceId, googleMapsUrl, geo_neighborhood, geo_district, geo_state. Run prisma db push and seed accordingly.

4. Update the bhandara detail page to include:
   - Sticky bottom CTA bar on mobile: Directions / WhatsApp / Sponsor (per spec §5).
   - Directions button opens Google Maps via the api=1 deep link from spec §1 Flow B.
   - Shareable Google Maps URL also shown as a copy-to-clipboard option for organizers.

5. Replace the default Leaflet pin with a gada-shaped SVG pin (build a small inline SVG component matching ai-image-prompts.md §4).

6. Apply the warm map tile filter from spec §6 to .leaflet-tile.

Run typecheck. Test the "60-second submit" acceptance test from spec §8. Stop and report.
```

---

## PHASE D — Live moderated comment feed

```
Implement Phase D per upgrade/specs/live-feed-moderation.md.

1. Add the data model from spec §5: Post and PhoneVerification. Run prisma migrate.

2. Build the moderation pipeline at src/lib/moderation/:
   - structural.ts (Stage 1 checks)
   - profanity.ts (Stage 2 — install @2toad/profanity, plus a hand-curated Hindi banned-terms list at src/lib/moderation/banned-terms.ts; do not commit the full list to public repo, gate by env or a private file)
   - llm.ts (Stage 3 — call Anthropic Haiku with the prompt from spec §3 Stage 3; cache decisions by content hash for 7 days)
   - image.ts (Stage 4 — install nsfwjs; reject Porn/Hentai/Sexy ≥ 0.4)
   - rateLimit.ts (Stage 5 — Postgres-backed counter on PhoneVerification)
   Compose them into a runModeration({text, photoUrl, phoneHash, ipHash}) function.

3. Add OTP verification:
   - POST /api/otp/send — sends an OTP to the given phone via MSG91 (gated by env MSG91_API_KEY); fall back to a console.log in dev.
   - POST /api/otp/verify — checks the OTP and sets a signed httpOnly cookie "bm-phone-verified" with a phoneHash claim, valid 30 days.

4. Build the comment submission flow:
   - POST /api/posts validates with zod, verifies cookie, runs moderation, inserts row.
   - Photos upload to Netlify Image CDN or Cloudflare R2 (gate by env).

5. Build the live feed UI:
   - <LiveFeedMarquee /> on the homepage: horizontal scroll of last 12 approved posts, paused on hover, respects prefers-reduced-motion.
   - <BhandaraComments bhandaraId={...} /> on every detail page: paginated list + inline submit form.

6. For week-1 launch use polling (`/api/feed?since=...` every 8s) — SSE in Phase F.

7. Add /admin/feed override panel per spec §7.

Run typecheck. Run the acceptance test inputs from spec §10 and confirm each passes. Stop and report.
```

---

## PHASE E — Resources hub (news, chalisa, aarti, rituals, temples)

```
Implement Phase E per upgrade/content/aarti-chalisa.md.

CRITICAL: do NOT generate or paraphrase devotional Sanskrit/Hindi verses. The user (Prateek) will paste in canonical text from Gita Press / Wikisource. For now, scaffold with a "Text being verified" placeholder block per page, plus working layouts.

1. Create the /resources hub page (magazine index with 4 featured cards).

2. Build /resources/news with a manual editor's-pick layout — render from src/content/news.ts (Prateek-curated entries). Each entry: headline, 2-line excerpt, source name + date, link out.

3. Build /resources/chalisa and /resources/aarti:
   - Two-column layout (Devanagari left / Translation right) per spec §3.
   - <DevotionalPlayer /> component at the top — reusable across both pages — embedding YouTube IFrame Player for audio/video. Style per spec §8 (saffron play button, gold progress).
   - Speed selector and language toggle.
   - Source attribution caption.
   - Use placeholder content blocks until canonical text is supplied.

4. Build /resources/rituals — write the Tuesday vrat guide content per spec §5. Use plain, factual, neutral tone.

5. Build /resources/temples (directory) and 5 temple sub-pages (Aliganj Naya, Aliganj Purana, Hanuman Setu, Sankat Mochan, Bada Hanuman). Each page: hero photo placeholder, address, map snippet, history (1 paragraph), aarti timings, tuesday-crowd note, nearby bhandaras.

6. Add JSON-LD structured data to each resource page per spec §9.

7. Add the resources teaser section to the homepage (3 cards: Chalisa, Aarti, This Week in Lucknow).

Run typecheck. Verify all pages render with placeholder content. Stop and report.
```

---

## PHASE F — Imagery, polish, microinteractions

```
Implement Phase F (final polish).

1. Generate AI imagery per upgrade/content/ai-image-prompts.md prompts. Save to public/illustrations/ as listed:
   - hero-hanuman.png
   - aliganj-dusk.png
   - bhandara-line.png
   - eight-mandala.png
   - empty-state-plate.png
   - 404-diya-smoke.png
   - og-default.png

   (You — Claude Code — cannot generate images. Output the exact prompts to a file public/illustrations/PROMPTS.txt and tell me to generate them externally, then drop them in. Use placeholder gradient blocks until images are dropped in.)

2. Implement microinteractions from design-system-v2.md §7:
   - Hindi headline letter-by-letter fade-in (framer-motion).
   - Card hover: lift, gold-glow, ornament rotate.
   - Countdown flipboard digits.
   - Map pin scale + gold ring pulse on click.
   - Sponsor button marigold-spawn celebration.
   - Form-submit diya transformation.
   All gated by prefers-reduced-motion.

3. Implement the broken-brick card grid on the homepage featured-bhandaras section.

4. Switch the live feed delivery from polling to SSE (per spec §4).

5. Generate dynamic OG images via next/og:
   - /opengraph-image.tsx (default site OG)
   - /bhandara/[slug]/opengraph-image.tsx (per-bhandara OG with bhandara name, area, and saffron+sindoor brand band)
   - /history/opengraph-image.tsx
   - /resources/[type]/opengraph-image.tsx

6. Run a Lighthouse pass. Fix anything below 90 on Accessibility or Performance, especially:
   - Image lazy-loading
   - Font preload
   - Hindi-text contrast (Tiro at sm sizes can fail contrast; bump to ink-900 always)
   - Tap target sizes (≥ 44px on mobile)

7. Final visual QA against the design-system-v2.md §10 acid test, every page.

Run typecheck and lint. Stop and report.
```

---

## DEPLOY

After Phase F:

```
1. Push to GitHub (private repo).
2. Connect Netlify, configure:
   - Environment variables (DATABASE_URL, ANTHROPIC_API_KEY, MSG91_API_KEY, MAPS_KEY, NEXT_PUBLIC_GA_ID, ADMIN_PASSWORD, OTP_SECRET, COOKIE_SECRET, NEXT_PUBLIC_SITE_URL).
   - Domain: BadaMangal.com (primary).
   - Domain redirect: BadaMangalBhandara.com → 301 → BadaMangal.com.
   - SSL on both.
3. Run prisma db push against the production Postgres (Neon free tier).
4. Seed first 30-50 listings.
5. Submit sitemap to Google Search Console.
6. Set up Google Analytics 4 property and paste the measurement ID into NEXT_PUBLIC_GA_ID.
7. Go live before Tuesday May 19.
```

---

## ROLLBACK PLAN

If anything breaks the night before launch:

- Roll back to last known-good Netlify deploy (one click).
- Disable the live feed via `LIVE_FEED_ENABLED=false` env var.
- Switch organizer form to a Google Form fallback if the database fails (keep the URL handy: a static `/list-bhandara-fallback` page with the Form embed).
