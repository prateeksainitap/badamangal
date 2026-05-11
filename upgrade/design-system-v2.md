# Design System v2 — the "100x better" brief

> The current build looks AI-generic. This brief is how we escape that. Read every section before re-touching the UI.

The diagnosis of "looks AI-generated" almost always comes down to four things: (1) flat blocks of solid color with no depth, (2) generic geometric icons instead of culture-specific illustration, (3) one-size body type with no editorial drama, and (4) no microinteractions. We fix all four.

---

## 0. North-star reference moods

When the team ships pixels, they should feel:

- **An old Awadhi handwritten invitation card** — gold ink on cream, ornamental borders, calligraphic Hindi.
- **A modern boutique hotel website in Banaras** — dignified, slow, generous whitespace, photography-led.
- **A National Geographic feature on faith festivals** — real faces, dust in the light, no overlay filters.

It must NOT feel:
- A generic SaaS dashboard with saffron repaint
- A government portal
- A startup pitch site with hero gradients
- A wedding card template

---

## 1. Color — same tokens, deeper application

The tokens are unchanged from STRATEGY.md. What changes is **how** we use them.

| Surface | Use |
|---|---|
| Page background | `cream-50` (#FBF7F0) — warmer than white, never `#FFFFFF` |
| Primary card surface | `#FFFFFF` with 1px gold-100 border + 0.04 opacity warm shadow |
| Brand band / hero | a hand-textured saffron gradient (see "textured-saffron" below), not flat orange |
| Text | `ink-900` (#1A1410) headings; `ink-600` (#5A4F46) body — NEVER pure black |
| Section dividers | Hand-drawn gold-500 ornament line, NOT a 1px hr |
| Status pills | `leaf-600` for Open, `alert-500` for Closed, `gold-500` for Sponsored |

### Textured saffron gradient (replace flat orange anywhere we use saffron-600)

```css
background:
  radial-gradient(circle at 20% 0%, rgba(255, 246, 238, 0.9), transparent 40%),
  radial-gradient(circle at 80% 100%, rgba(156, 42, 42, 0.25), transparent 40%),
  linear-gradient(180deg, #F2944C 0%, #E07A1F 100%);
```

Add a 5% noise overlay (SVG noise filter, see §6) for paper texture. This single change kills 80% of the "AI flat" feeling.

---

## 2. Typography — make it editorial, not uniform

Most AI-generated sites use one font at three sizes. We do the opposite.

| Element | Font | Size | Notes |
|---|---|---|---|
| H1 Devanagari | Tiro Devanagari Hindi | 56–80px | letter-spacing 1px |
| H1 Latin | Fraunces, italic optical-size 144 | 56–80px | use the optical-size variable |
| H2 | Fraunces 600 | 36–44px | |
| Drop cap (article opens) | Cormorant Garamond, 700 | 96px | floats left, 3 lines |
| Body Devanagari | Mukta 400 | 18–19px | line-height 1.7 |
| Body Latin | Mukta 400 | 17–18px | line-height 1.7 |
| Caption | Mukta 500 | 13px | uppercase, letter-spacing 8px |
| Pull quote | Cormorant Garamond, italic | 28–34px | left-bordered with gold-500 |
| Numbers (countdown, capacity) | Cormorant Garamond, 600 | display sizes | tabular-nums |

**Rules:**
- Mix scripts in one heading: `बड़ा मंगल · Bada Mangal` reads as bilingual confidence, not translation.
- Long form pages always have a drop cap on the opening paragraph.
- Captions are ALL CAPS with wide letter-spacing — they carry the editorial mood.

---

## 3. Ornament library — replace generic dividers

Build these once as inline SVG components in `src/components/ornaments/`. Use them everywhere the current site has horizontal rules, plain section gaps, or empty space.

1. **Marigold string divider** — three stylized marigold heads on a thin gold thread. Used as `<MarigoldDivider />` between sections.
2. **Jali corner motif** — Awadhi lattice corner ornament (top-left + top-right of major sections).
3. **Diya cluster** — small oil-lamp cluster, glowing — used at the foot of cards or pages.
4. **Sun-burst gold spark** — short version of the logo's 8-ray sun, used as a "loading" indicator and section-anchor.
5. **Devanagari "ॐ" emboss** — pale gold-100, very large, set behind a section as background watermark at 8% opacity.
6. **Gada bullet point** — tiny gada glyph instead of a `•` for bulleted lists in storytelling sections.

All ornaments live as SVG in `src/components/ornaments/` and accept `color` and `size` props.

---

## 4. Illustration & photography — kill the stock look

### Hero illustration (homepage)
Replace the current hero with a **single hand-painted-style Hanuman Ji illustration** (see `content/ai-image-prompts.md`). Place it bleeding into the right edge of the hero, with the bilingual headline overlapping its left margin. Add a soft `cream-50 → transparent` mask at the bottom so it dissolves into the page.

### Photography rules
- **Real Lucknow only.** First season: even 12 phone-shot photos of real bhandaras beat any stock or AI image.
- Crop tight on hands, plates, faces — never wide group shots.
- Color-grade with a warm filter: saturate oranges/yellows by ~10%, lift shadows, keep green natural.
- Apply a subtle film grain (~3% opacity) on top.

### Avoid forever
- AI-generated photorealistic Hanuman Ji "portraits" — uncanny, religiously inappropriate, and they all look the same.
- Hands-around-a-globe / multicultural-stock images.
- Saturated festival "Diwali stock" overlays.

---

## 5. Layout — break the perfect grid

AI sites give themselves away with: equal-width 3-column grids, perfectly centered hero, identical card heights. We break this.

- Asymmetric heroes: 60/40 split, illustration overflows the grid.
- Cards in a "broken brick" mason layout, not equal heights.
- One-off pull-quote moments: a single pull quote on its own row, full-width, gold ornament above and below.
- Use whitespace **vertically** — sections breathe with `py-32` minimums on desktop, never crowded.

---

## 6. Texture & depth

Add to `globals.css`:

```css
/* Paper grain — tile a 200x200 SVG noise once */
.paper {
  background-image: url("/textures/paper-grain.svg");
  background-blend-mode: multiply;
  background-size: 240px;
  opacity: 1;
}

/* Warm shadow — never use Tailwind's default gray shadow */
.shadow-warm {
  box-shadow:
    0 1px 0 rgba(201,162,74,0.15),
    0 8px 24px -8px rgba(156,42,42,0.10),
    0 24px 48px -24px rgba(26,20,16,0.12);
}
```

Save `public/textures/paper-grain.svg` with a `<feTurbulence>` filter at low opacity. Apply `paper` class to the page body for an unmistakable cream-paper feel.

---

## 7. Microinteractions

These are tiny and they sell the polish. Implement with Tailwind transitions or framer-motion (only motion lib we add).

- **Page enter:** Hindi headline animates in letter-by-letter from 0 → 1 opacity, 24px → 0px y-offset, 80ms stagger.
- **Hover on a bhandara card:** card lifts 4px, gold border glows from 1px to 2px, marigold ornament at the corner gently rotates 8°.
- **Countdown:** seconds digit flips like a flipboard (CSS-only, transform-style preserve-3d).
- **Map pin click:** pin briefly scales 1 → 1.2 → 1, gold ring pulses outward.
- **First-visit greeting:** 1.2-second-only `Jay Shri Ram` watermark fades in then out, top-right. Never repeats in the session.
- **Sponsor button:** on click, a small marigold flower spawns, floats up, fades out (single celebratory micro-animation).
- **Form submit success:** the submit button transforms into a glowing diya with smoke, "Pranam — your seva is queued for review" appears.

All animations respect `prefers-reduced-motion: reduce` — no exceptions.

---

## 8. Page-by-page direction

### Homepage
- **Hero:** asymmetric. Left: bilingual headline with drop cap, two CTAs (saffron primary, sindoor outline). Right: large hand-painted Hanuman Ji illustration bleeding past the gutter, optional gold-particle overlay for the diya glow.
- **Below the fold:** "8 Bada Mangals of 2026" — a horizontal mandala of 8 nodes, each a Tuesday. Past Tuesdays glow gold, the next one pulses saffron. Click a node to filter the map.
- **Map section:** full-bleed (edge to edge), framed top and bottom by marigold dividers. Pins are gada-shaped, not generic Leaflet drops.
- **Featured bhandaras:** broken-brick grid, 3-2-3 with a pull quote in the gap.
- **Live feed strip:** auto-scrolling marquee of latest comments + photos (see live-feed spec).
- **Story teaser:** 1-paragraph excerpt of the 400-year history, with a Cormorant pull quote and "Read the full story" button.
- **Resources teaser:** 3 cards — Hanuman Chalisa (audio play), Aarti (video), This week in Lucknow (news).
- **Footer:** double-deck. Top deck: ornament + closing devotional line "॥ जय श्री राम  ।  जय हनुमान ॥" centered in sindoor red. Bottom deck: links + small print.

### /history
- Long-form editorial. Wide single-column, max 65ch.
- Drop cap on opening.
- Period photography or commissioned ink illustrations between sections (see prompts file).
- Inline quotes with gold-500 left border.
- A timeline component near the end ("1798 → 2026") rendered as a horizontal jali pattern with date markers.

### /bhandara/[slug]
- Hero photo full-bleed (use placeholder if absent: a stylized illustrated background with the gada motif).
- Sticky CTA bar on mobile: [Get Directions] [WhatsApp] [Sponsor].
- Below: organizer credits as a "scroll" panel — looks like a Mughal firman.
- Comments live feed below — see spec.

### /list-bhandara
- Treat this as a sacred ritual, not a form. One question per screen on mobile, multi-step.
- Progress indicator: 8 small lamps that light up as you advance.
- Final step: drop a pin on the map (see map quick-add spec).
- Submit screen: a diya animation + "Pranam — queued for moderation" — no generic checkmark.

### /resources (chalisa, aarti, etc.)
- Two-column on desktop: left = lyric/text, right = audio/video player.
- Big play button styled as a Hanuman gada head.
- Background: a faint ॐ watermark at 6% opacity.

### /news
- Editorial blog feel. Magazine layout: lead story 60% width with hero image, side stack of 3 secondary stories, bottom row of 6 small links.

---

## 9. Component conventions (Tailwind / Next.js)

- **Cards:** `bg-white border border-gold-100 shadow-warm rounded-2xl p-6` + a 4px gold-500 border-l on the active state.
- **Primary button:** `bg-saffron-600 text-cream-50 hover:bg-saffron-500 shadow-warm rounded-full px-6 py-3 font-mukta tracking-wide`.
- **Secondary button:** `bg-transparent border border-sindoor-700 text-sindoor-700 hover:bg-sindoor-700 hover:text-cream-50`.
- **Section heading combo:** a `<Caption>` (uppercase tracked) + `<H2>` (Fraunces) + small gold ornament between them.
- **Status pill:** `inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium tracking-wider uppercase`.

---

## 10. The acid test

Before merging any UI change, ask:

1. **Would I find this on a generic Notion-template SaaS site?** If yes → reject.
2. **Does it have one ornament, illustration, or texture that ties it to Lucknow / Hanuman / Awadh?** If no → reject.
3. **Does it work in 360px width with Hindi text?** If no → reject.
4. **Does any animation play if `prefers-reduced-motion`?** If yes → fix.
5. **Is there a single block of pure flat color with no texture or ornament?** If yes → soften it.

If all five pass, it's ready.
