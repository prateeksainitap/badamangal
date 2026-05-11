# Build prompts for Claude Code

Paste these into Claude Code (`claude` in this directory) one phase at a time. Wait for each phase to finish and `npm run dev` cleanly before moving on.

> **Setup:**
> ```bash
> cd "/Users/prateeksaini/Documents/Personal/Bada Mangal/badamangal-app"
> npm install
> claude
> ```

---

## PHASE 0 — Read context (one-line first prompt)

```
Read CLAUDE.md and ../STRATEGY.md fully before doing anything. Then summarize back to me in 5 bullets what we're building, the stack, the brand tokens, and what Phase 1 will produce. Do NOT write any code yet.
```

When the summary is correct, proceed.

---

## PHASE 1 — Visual baseline (homepage renders, no DB)

```
Build Phase 1 per CLAUDE.md.

Concretely:

1. Create the missing config files:
   - .gitignore (Next.js standard + .env*, prisma/dev.db, .netlify)
   - .env.example with: DATABASE_URL="file:./dev.db", NEXT_PUBLIC_GA_ID="", ADMIN_PASSWORD="changeme", NEXT_PUBLIC_SITE_URL="http://localhost:3000"
   - postcss.config.js (tailwindcss + autoprefixer)
   - tailwind.config.ts with the brand tokens from CLAUDE.md (saffron, sindoor, gold, ink, cream, leaf, alert) and font families (tiro, fraunces, mukta, cormorant) referencing CSS variables
   - netlify.toml configured for Next.js (publish .next, build command "npm run build", @netlify/plugin-nextjs)

2. Create src/app/layout.tsx:
   - Load Tiro Devanagari Hindi, Fraunces, Mukta, Cormorant Garamond via next/font/google as CSS variables (--font-tiro, --font-fraunces, --font-mukta, --font-cormorant)
   - bg-cream-50 text-ink-900 font-mukta
   - Default lang="hi"
   - Header + Footer components
   - GA gtag snippet gated on process.env.NEXT_PUBLIC_GA_ID

3. Create src/app/globals.css with Tailwind directives and CSS variables for fonts. Set body color and bg.

4. Create src/content/strings.ts with hi/en dictionaries. Cover: site name, tagline (hi: "जहाँ भक्ति, वहाँ भंडारा", en: "Lucknow's table is always set."), CTAs ("Find a bhandara near me", "List your bhandara"), countdown labels, area names.

5. Create src/lib/i18n.ts with a simple useT() hook that reads ?lang= from URL (default "hi"), and a getLocale() helper for server components.

6. Create src/lib/dates.ts with the 8 Bada Mangal 2026 dates (May 5, 12, 19, 26; June 2, 9, 16, 23) and helpers: nextBadaMangal(now), msUntil(date), formatHindiDate(date).

7. Create src/lib/lucknow.ts with: AREAS array (Aliganj, Hazratganj, Aminabad, Chowk, Gomti Nagar, Indira Nagar, Mahanagar, Alambagh, University Road, Hanuman Setu / Daliganj, Naka Hindola, Charbagh) and DEFAULT_CENTER = { lat: 26.8467, lng: 80.9462 } (Lucknow center).

8. Create src/components/Header.tsx — sticky, cream bg, sindoor brand name "बड़ा मंगल" + saffron underline accent, language toggle, "List your bhandara" CTA on the right.

9. Create src/components/Footer.tsx — gold border-top, copy in both languages, Jay Shri Ram closing line.

10. Create src/components/CountdownTimer.tsx — client component, uses dates.ts, shows days/hours/minutes/seconds to next Bada Mangal. Big saffron number, ink-600 labels.

11. Create src/components/LangToggle.tsx — small pill toggle, "हिन्दी / EN".

12. Create src/components/BhandaraCard.tsx — saffron-50 bg, gold-500 border-l-4, name in tiro for hi / fraunces for en, area + time + menu pills, "Get directions" + WhatsApp share buttons (hardcoded handlers for now, real wiring in Phase 2).

13. Create src/components/BhandaraMap.tsx — client, uses dynamic import for Leaflet inside useEffect (do NOT import leaflet at module top level — that breaks SSR). Render a div, init the map on mount with OSM tiles, place pins for each bhandara passed via props. Pin: saffron circle marker. Tooltip on hover with name + area.

14. Create a temporary src/data/seed-listings.ts with 6 hard-coded sample listings spread across Aliganj, Hazratganj, Indira Nagar, Gomti Nagar, Chowk, Alambagh — each with realistic name, address, lat/lng, time, menu.

15. Create src/app/page.tsx (homepage):
    - Hero: bilingual tagline (hi headline, en subline), 2 CTAs
    - Section: "8 Bada Mangals in 2026 — the rarest cycle in 19 years" + countdown
    - Section: live map (BhandaraMap with seed listings, dynamic SSR off)
    - Section: 6 sample BhandaraCards in a grid below the map
    - Section: tiny footer note pointing to /history

After this phase, `npm run dev` must show a polished, on-brand homepage with a working map and countdown. No DB yet. Run `npm run typecheck` and fix any errors. Then stop and tell me what to verify.
```

---

## PHASE 2 — Real data + detail pages

```
Phase 2 per CLAUDE.md.

1. Create prisma/schema.prisma with the Bhandara model from CLAUDE.md (use String for status, not enum, since SQLite). Add Organizer model later — for MVP just include organizerName/Phone/Whatsapp/upiId on Bhandara.

2. Create src/lib/db.ts — Prisma client singleton (export prisma).

3. Create prisma/seed.ts that inserts ~25 realistic Lucknow bhandaras spread across all 12 areas in src/lib/lucknow.ts. Vary: Tuesday dates (some on every Tuesday, some only on specific dates), time windows (mostly 10am–4pm), menus, capacity. Use real-ish street names and reasonable lat/lng inside Lucknow bounds. All status APPROVED.

4. Run `npm run db:push && npm run db:seed`. If it fails, fix and retry.

5. Update src/app/page.tsx to fetch APPROVED bhandaras from DB instead of seed-listings.ts. Server Component reading prisma directly. Pass to BhandaraMap and the card grid.

6. Create src/app/bhandara/[slug]/page.tsx:
   - Fetch by slug
   - Hero: name in chosen language, area + landmark, time window, status pill
   - Photo if present (placeholder if not)
   - Big saffron "Get directions" button (Google Maps deep link with lat,lng)
   - WhatsApp share button — opens wa.me with prefilled message in current language
   - "Sponsor 100 plates" button — if upiId present, deep link upi://pay?pa=...&pn=...&am=251&cu=INR (₹251 default suggested)
   - Menu, capacity, organizer credits
   - Map snippet centered on this bhandara
   - "Other bhandaras in {area}" section below

7. Create src/app/api/bhandaras/route.ts — GET returns approved bhandaras as JSON (for future API/embed use).

8. Update BhandaraMap to accept onPinClick that navigates to /bhandara/[slug].

After this phase: homepage shows real data from DB, every pin and card links to a real detail page, sponsor + WhatsApp share work. Run typecheck. Stop and report.
```

---

## PHASE 3 — Submissions + admin

```
Phase 3 per CLAUDE.md.

1. Create src/app/list-bhandara/page.tsx — bilingual organizer form:
   - Fields: organizer name, phone, optional whatsapp, optional UPI ID, bhandara name (hi + en), description (optional), area (dropdown from lucknow.ts), address, landmark, lat/lng (use a small Leaflet "drop a pin" map), Tuesday dates (multi-select checkboxes from dates.ts), time window, menu (multi-checkbox: puri, sabzi, halwa, sherbet, water, fruit, prasad, biryani — make this list configurable), capacity plates, photo URL (optional, paste URL for MVP — file upload Phase 4)
   - Server action submits to /api/bhandaras (POST)
   - Validate with zod
   - On success, show "Thank you, your bhandara is in moderation" screen with a share-back QR or link

2. Update /api/bhandaras/route.ts:
   - POST: validates body with zod, generates slug from name, status=PENDING, returns { id, slug }
   - Optional: also POST /api/bhandaras/track-share to bump shareCount

3. Create src/app/admin/page.tsx — moderation queue:
   - Gate by simple cookie: if cookie "admin"=process.env.ADMIN_PASSWORD, show queue; else show password form that sets the cookie
   - Show all PENDING bhandaras as cards with full info + Approve/Reject buttons (server actions)
   - Approve sets status=APPROVED and approvedAt=now
   - Reject sets status=REJECTED

4. Add a "List your bhandara" CTA in Header that links to /list-bhandara.

Run typecheck. Stop and report.
```

---

## PHASE 4 — Polish + history + deploy

```
Phase 4 per CLAUDE.md.

1. Create src/app/history/page.tsx — long-form story page:
   - 400-year history of Bada Mangal: Nawab Saadat Ali Khan, the Begum, Aliya Begum, Aliganj Hanuman Mandir, why Tuesdays in Jyeshtha
   - Multi-faith origin story
   - The 2026 8-Tuesday cycle and why 19 years
   - Bilingual prose (use the i18n approach)
   - Big drop caps in Cormorant Garamond, gold-100 highlight blocks for key dates
   - This is an SEO pillar page — write rich, accurate copy (~1500 words)

2. Add OpenGraph image generation:
   - src/app/opengraph-image.tsx using next/og — saffron bg, sindoor headline "बड़ा मंगल", small subline, gold gada motif (SVG)
   - Per-bhandara OG: src/app/bhandara/[slug]/opengraph-image.tsx

3. Add favicon (saffron square with gada silhouette — produce a simple SVG and convert).

4. Add robots.txt and a basic sitemap.xml route.

5. Wire GA4: actually fire pageview on route changes.

6. Verify Hindi/English toggle works on every page; default is Hindi; preference saved in cookie not localStorage.

7. Check Lighthouse on desktop + mobile. Fix anything < 90 on accessibility or performance.

8. Write README.md with: what this is, how to run, env vars, deploy to Netlify, swap SQLite → Postgres (Neon) for prod, common Claude Code prompts going forward.

After this phase: ready to deploy. Push to GitHub, connect Netlify, set env vars, deploy.
```

---

## After deploy

- Add NEXT_PUBLIC_SITE_URL=https://badamangal.com to Netlify env
- DNS: BadaMangal.com → Netlify; BadaMangalBhandara.com → 301 redirect via Netlify domain settings
- Submit sitemap to Google Search Console
- Manually seed 30–50 real listings from news, FB, walking the city
- Soft launch in 5–10 Lucknow WhatsApp groups
- DM Lucknow Buzz, Knocksense, Lucknow Pulse for May 19 coverage
