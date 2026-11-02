# BadaMangal homepage redesign: design spec

Date: 29 Oct 2026. Owner: Prateek Saini (Founder). Status: approved in chat, awaiting review of this written spec.

## 1. Intent
Rebuild the badamangal.com homepage so it keeps the site's devotional, Hindi-first, community soul and lifts the craft to DharmKriya level: new painted art, advanced hand-built motion, a splash loader with the animated logo, and a "part of the DharmKriya family" line on the splash and in the footer.

Success means:
1. Search position is untouched. The SEO check (`check.mjs`, baseline captured from production on 29 Oct 2026) passes on `/` after the swap.
2. Every existing link, anchor and printed QR target keeps working.
3. It reads as premium on a 390px phone (Samsung Z Fold 6) and on desktop, and as "still ours" to people who love today's site.

## 2. Decisions taken in chat (29 Oct 2026)
- Sections picked from the round 2 comps: hero from C (Mohalla), eight-Tuesday gada beads from A, painted map from B, tradition "400 साल / पूरा शहर, एक रसोई" from C with A's temple arches, "लखनऊ बोल रहा है" from A.
- Splash plays once per browser session, only when the session lands on the homepage. Never for crawlers.
- Splash tagline: "A part of the DharmKriya family" (Hindi: "धर्मक्रिया परिवार का हिस्सा") with the real DharmKriya wordmark for light grounds (`Logo-Final-v6-nobg-english-light.png`, red wordmark).
- Footer: dark (#1E1611) on every page, white BadaMangal and DharmKriya logos (`Logo-Final-v6-nobg-english-white-text@2x.png`), all current links and the legal line unchanged.
- Press shown: Dainik Jagran (print), Radio Mirchi, Fever FM, Big FM (radio). Amar Ujala and Navbharat Times are NOT shown (no story ran).
- Hero art: the new ChatGPT standing Hanuman ji replaces the current one; the old file stays in the repo.
- Build approach B: build at a hidden preview route, then swap `/` in one small change.

## 3. Page structure
Each section keeps the anchor ids listed. English sublines under Hindi display headings are the real h2 so today's keyword phrasing survives.

| # | Section | Source | Art | Anchors and SEO notes |
|---|---|---|---|---|
| 1 | Splash | new | real logo parts | client overlay only, see section 4 |
| 2 | Header | restyle | real logo | all current links, हिंदी / EN toggle, `#main` skip link |
| 3 | Hero | comp C | v2/hero-hanuman.webp, ram-name-halo | the single h1 जहाँ भक्ति, वहाँ भंडारा; prints from real recent spots with photos (first name, real caption, locality only if recorded; AI-tagged captions skipped) |
| 4 | Eight Tuesdays | comp A | gada beads (SVG) | "Next Jyeshtha, Lucknow cooks again." |
| 5 | Map | comp B | v2/map-lucknow.webp | `#map` on this section; pins from real 2026 bhandaras projected from lat/lng, each `<a href="/bhandara/<slug>">`; locality labels link `/area/<slug>`; count from DB; CTA opens the existing interactive MapBoard; `?q=` opens it with the search filled; server-rendered fold-out list (`<details>`) of every bhandara link |
| 6 | Community | comp C | real spot photos | `#live-chat`, `#join-community-heading`; real messages (a read-only query widened so off-season still shows the last season's messages); real member count; `/live?lang=en#spot:<id>` links |
| 7 | Tradition | comp C + A arches | v2/tradition-street.webp, existing temple paintings, pattal | 400 साल, भूखे को खाना खिलाओ (Neem Karoli Baba) |
| 8 | Companion | comp A | v2/hanuman-seated.webp | Hanuman Chalisa player (existing audio), links to resources pages |
| 9 | Voices | comp A | press logos | Dainik Jagran, Radio Mirchi, Fever FM, Big FM; existing testimonials data |
| 10 | Seva | comp B | v2/seva-hands.webp | organise, volunteer, support (existing routes); `#support` |
| 11 | FAQ | restyle | none | `#faq` and the 7 item ids, text identical to `src/content/faq.ts` and the FAQPage JSON-LD (existing answers unchanged, including wording) |
| 12 | Benediction | comp A | existing Maharajji art | MaharajjiBlessing behaviour (hover or tap Ram Ram chant) |
| 13 | Footer | new, site-wide | v2/gomti-dusk.webp band on the homepage only | dark #1E1611, all current links, legal line, DharmKriya family line linking https://dharmkriya.com |

Removed from the homepage (files kept): the duplicate bhandara lists, the second press strip, the second live feed, duplicate promos, the stats block and the other sections the audit flagged.

## 4. Splash loader
- Built from the real logo's own parts (no redraw, no recolour): the sun and gada mark rises, rays unfold, the Ram-naam ring draws in, the wordmark reveals; the DharmKriya family line and wordmark fade in below.
- About 1.7 s; any tap or key skips; self-dismisses by 2.4 s even if JavaScript fails.
- An inline pre-paint script decides: skip for bots (user agent), repeat views in the session (sessionStorage), back and forward navigation, and any landing that is not the homepage. Honours prefers-reduced-motion with a simple fade.
- Page content is fully server rendered underneath: no layout shift, no LCP delay, no scroll lock left behind.

## 5. Motion
Hand-written CSS keyframes plus IntersectionObserver, no motion library. Painted bands with scroll-linked parallax (CSS `animation-timeline: view()` with an observer fallback), masked heading reveals split by word only (never by character, to protect Devanagari), gada pins dropping in sequence, gada beads lighting, chat bubbles arriving, counters ticking, the halo turning slowly, a view transition into bhandara pages where supported. Nothing above the fold starts hidden; prefers-reduced-motion respected.

## 6. Type, colour and assets
- Display: Anek Devanagari and Anek Latin 700 to 800, self-hosted with `next/font/local`. Body: Mukta. No serif on the homepage.
- Colours: cream #FBF7F0, paper #F5EFE3, saffron #F2944C / #E07A1F (primary CTA), gold #C9A24A / #F5EAC9, sindoor #9C2A2A (display headings), ink #1A1410 / #5A4F46, footer #1E1611.
- New art in `public/illustrations/v2/` (ChatGPT, text-free; manifest in the coordinator's scratchpad `art-v2/MANIFEST.md`). Every art path in one file, `src/content/home-art.ts`.
- No emoji, no em or en dashes, no red button fills, real logos only.

## 7. Build and swap (approach B)
1. Extract the homepage data loading in `src/app/page.tsx` (the Promise.allSettled queries and last-good cache) into a shared loader, unchanged in behaviour.
2. Build the new homepage as one component tree (`src/components/home/`) fed by that loader, rendered at `/preview/home` (already disallowed in robots.txt; the route also sets `robots: { index: false, follow: false }`).
3. The founder reviews `/preview/home` on localhost.
4. Swap: `src/app/page.tsx` renders the new tree. Metadata, alternates, keywords, all 11 JSON-LD blocks and `revalidate` stay in `page.tsx`. The preview route is then removed.
5. Run `check.mjs http://localhost:3100` (production build) against `/` and require PASS. Then the founder reviews `/` on localhost and decides on merge.

## 8. Constraints
- Work only in the `badamangal-redesign` worktree, branch `feature/home-redesign`. Nothing committed, pushed or deployed until the founder OKs localhost and says "merge".
- Localhost reads the production database: read only, no seeds, no form submits.
- Out of scope (noted for later): the `layout.tsx` `headers()` call that makes every route dynamic (biggest speed win), the en-IN hreflang fix, the `?lang=en?lang=en` redirect.

## 9. Testing
- `npm run build` passes (types and lint).
- `check.mjs` PASS on `/` after the swap, including all 333 sitemap paths.
- Manual: `?q=` prefills search, `/#map` lands below the sticky header, Hindi toggle translates every new string, splash rules (first homepage landing only, skip, bots, back navigation, reduced motion), audio controls (not heard by a human, say so).
- Screenshots reviewed at 390px, 360px and 1440px, every section, by the coordinator as a designer before the founder sees it.
