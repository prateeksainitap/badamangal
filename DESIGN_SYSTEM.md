# BadaMangal Design System

The system that keeps the site feeling like one document — Aliganj at dusk,
not a SaaS dashboard. Read this before adding a new section, picking a
colour, or writing a heading. Every existing page is built from these
primitives; new pages must be too.

Living style guide: visit **`/design-system`** in any environment to see
every token, type scale, and primitive rendered live.

---

## 1. Brand voice

**Devotional, not corporate. Warm, not sentimental. Bilingual, equal weight.**

- Hindi and English are first-class siblings. Neither is a translation
  of the other — both are written natively.
- Speak like a Lucknawi: spare, generous, occasionally playful. Never
  marketing-flat ("Sign up now!"), never devotional-syrupy ("Embark on a
  divine journey…"). When in doubt, say less.
- Lead with verbs the visitor recognises: **find, list, spot, share,
  bring, sponsor**. Not "leverage", "engage", "discover the magic of".
- Capitalisation: brand-style sentence case. **"Bhandaras on Map"**, not
  **"Bhandaras On Map"**. Proper nouns (Lucknow, Aliganj, Hanuman,
  Tuesday) and our brand word **BadaMangal** are exceptions.
- Devanagari headings prefer **Tiro Devanagari Hindi**; long-form prose
  prefers **Mukta**. Never use **Devlys** or **Krutidev** — the site is
  Unicode-only.
- The word **bhandara** never gets translated to "feast" or "free meal".
  We teach the word; we don't dilute it.

---

## 2. Colour tokens

All Tailwind classes live under their semantic name (`saffron-600`,
`sindoor-700`) — never use raw hex. The palette is intentionally tiny;
adding a new colour requires a discussion.

| Token         | Hex       | Where it lives                                           |
| ------------- | --------- | -------------------------------------------------------- |
| `saffron-50`  | `#FFF6EE` | Tinted card backgrounds, kicker pill backdrops          |
| `saffron-500` | `#F2944C` | Hover-up gradient stop, glow accents                    |
| `saffron-600` | `#E07A1F` | **Primary action**, kicker text, focus ring             |
| `sindoor-700` | `#9C2A2A` | **Devotional headlines**, second-line emphasis, devotional CTAs |
| `gold-100`    | `#F5EAC9` | Soft chip backgrounds                                   |
| `gold-500`    | `#C9A24A` | Hairlines, divider strokes, jali corners                |
| `cream-50`    | `#FBF7F0` | **Page background**, on-pill text, ghost button surface |
| `ink-600`     | `#5A4F46` | Body copy, secondary text                               |
| `ink-900`     | `#1A1410` | Headlines (English), high-emphasis text                 |
| `leaf-600`    | `#3F7A3F` | WhatsApp / share / success indicators                   |
| `alert-500`   | `#C44A2C` | Inline form errors, destructive feedback                |

### Rules

1. **Cream is the canvas.** White only inside `<Card>` surfaces. Never
   put a white block on a cream page (looks like a paper cut-out).
2. **Saffron leads, sindoor finishes.** Saffron pulls the eye in,
   sindoor sets the stake. Don't reverse the pairing.
3. **Gold is a hairline, not a fill.** Use it as borders, dividers,
   ornament strokes — never as a button background or large area.
4. **One accent per surface.** A card may have *either* a saffron pill
   *or* a sindoor headline, not both shouting at once.
5. **Always pair text with a contrast-tested companion.** `ink-900` on
   `cream-50` (15.9:1), `cream-50` on `sindoor-700` (8.1:1), and
   `cream-50` on `saffron-600` (4.6:1) are the canonical safe pairs.

---

## 3. Typography

Six font families, each with one job. **Don't introduce a new family
without removing one.**

| Family                  | CSS variable        | Use for                                         |
| ----------------------- | ------------------- | ----------------------------------------------- |
| **Tiro Devanagari Hindi** | `--font-tiro`     | Hindi display headlines (h1, h2, big quotes)   |
| **Fraunces**            | `--font-fraunces`   | English serif display headlines                |
| **Mukta**               | `--font-mukta`      | Body copy in both scripts, button labels       |
| **Cormorant Garamond**  | `--font-cormorant`  | Editorial pull quotes, article kickers (sparingly) |
| **Noto Sans Devanagari**| `--font-noto-deva`  | Hindi sans for body when Mukta feels heavy     |
| **Bricolage Grotesque** | `--font-numerals`   | Big numerals only (counters, stats)            |

### The scale (defined in `tailwind.config.ts`)

```
h1-lg      80 / 102%     hero (desktop only)
h1         56 / 105%     hero (mobile + secondary)
h2-lg      44 / 110%     section heading desktop
h2         36 / 115%     section heading mobile
pull-lg    34 / 130%     desktop pull-quote
pull       28 / 135%     mobile pull-quote
body-hi    18 / 170%     Devanagari body (extra leading needed)
body       17 / 170%     English body
caption    13 / 120%     small-caps eyebrows, kickers (letter-spacing 0.5em)
drop-cap   96 / 85%      editorial article opener
```

### Rules

1. **Hindi body needs 6% more leading than English.** That's why
   `body-hi` is its own size — don't substitute `body`.
2. **Tracking matters.** Kickers always sit at `0.32em–0.5em` letter-
   spacing. Headlines never get tracked out — Fraunces and Tiro
   already have the optical spacing baked in.
3. **Headlines balance.** Use `[text-wrap:balance]` on every h1 / h2
   so the last line never strands a single word.
4. **Body wraps pretty.** Use `[text-wrap:pretty]` on paragraphs over
   ~120 characters.
5. **Number tiles use `font-numerals tabular-nums`.** Never style a
   stat with a serif — they don't align across rows.

---

## 4. Spacing & rhythm

Use Tailwind's default spacing scale (`0`, `0.5`, `1`, …, `8`, `10`,
`12`, `16`, `20`, `24`). Don't introduce arbitrary `[123px]` values
unless you're matching an illustration's dimensions exactly.

### Vertical rhythm of a section

```
section
├── pt-12 sm:pt-16     (top breathing room)
├── kicker             (mb-2)
├── headline           (mb-3)
├── body               (mb-6)
├── divider ornament   (mb-8)
├── content
└── pb-12 sm:pb-16
```

Every section opens with a top-pad ≥ `12` on mobile and ≥ `16` on
desktop. Anything smaller is pretending to be a header it isn't.

### Inside cards

`px-5 py-6` on a regular card; `px-6 py-7` on a hero card. Never less
than `px-4`.

---

## 5. Radii & elevation

| Radius       | Where                                          |
| ------------ | ---------------------------------------------- |
| `rounded-full` | Buttons, pills, kicker chips, tab strips    |
| `rounded-3xl`  | Cards, empty states, hero panels            |
| `rounded-2xl`  | Stat tiles, photo previews, form inputs     |
| `rounded-xl`   | Tiny chips inside cards                     |
| `rounded-md`   | Almost never. Avoid.                        |

| Shadow             | Where                                                |
| ------------------ | ---------------------------------------------------- |
| `shadow-warm`      | Default card / pill shadow (matches our colour temp) |
| `inset 0 1px 0 …`  | Inside button gradients (already baked into `.btn-*`) |
| Default Tailwind   | Don't use. They read cool against our cream canvas.  |

---

## 6. Iconography

We use **inline SVG only**. No icon font, no react-icons, no Lucide
package — we hand-write the few we need so they all share the same
stroke language.

### Specs

- `viewBox="0 0 24 24"`
- `stroke-width="1.7"`
- `stroke-linecap="round"` and `stroke-linejoin="round"`
- `aria-hidden` on every decorative icon
- Width/height in CSS, not the SVG attribute (so the icon scales with
  font-size when used inline)

Pattern lives in `src/components/StatsSection.tsx` (`IconBhandara`,
`IconNeighborhood`, `IconCamera`, `IconMangal`) — copy that style for
any new glyph.

---

## 7. Ornaments

Re-usable hand-drawn motifs that anchor the brand. All live in
`src/components/ornaments/`. Use them sparingly — they're seasoning,
not the dish.

| Ornament         | When to use                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- |
| `<JaliCorner />` | Empty states, archive cards, hero CTAs — wrap a card to feel "framed".                 |
| `<MarigoldDivider />` | Section-to-section breaks. Default size 220–320, gold-500.                       |
| `<SunburstSpark />`   | Devotional moments — under a benediction line, after a CTA.                       |
| `<DiyaCluster />`     | Festive callouts (sponsored bhandara, season opener).                             |
| `<OmWatermark />`     | Editorial pages only (history, resources). Never on transactional surfaces.       |
| `<GadaBullet />`      | List bullets in editorial prose, replaces `<ul>` discs.                           |

---

## 8. Components

### Buttons (`.btn` family in `globals.css`)

| Variant      | Where                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| `.btn-primary` | Default action: "Spot a bhandara", "View details", "Submit". Saffron. |
| `.btn-sindoor` | High-emphasis devotional CTA: "Sponsor a thali", "List my bhandara". Sindoor. |
| `.btn-ghost`   | Secondary action sitting next to a primary. Cream + gold border.      |
| `.btn-soft`    | Tertiary, link-like (back buttons, "Skip", "Cancel").                 |
| `.btn-leaf`    | Share / WhatsApp / success-flavoured actions.                         |

Sizes: `.btn-sm` for inline-with-text, `.btn-lg` for hero CTAs. Default
is the standard 44px-tall pill.

### Primitive React components (`src/components/ui/`)

These wrap the most-repeated visual patterns. **Use these instead of
hand-rolling Tailwind chains when you can.**

- `<Kicker>` — small-caps eyebrow above a headline.
- `<SectionHeader>` — composed kicker + headline + body + divider for
  any new section.
- `<Pill>` — rounded chip for filters, statuses, info dots.
- `<Card>` — base card with optional jali-corner ornaments + photo.
- `<EmptyState>` — illustration + headline + body + CTAs (the homepage
  "no bhandaras yet" / live "no posts yet" / archive empty patterns).

See `/design-system` for live demos and copy-paste examples.

---

## 9. Images

- **Format:** ship `.webp` for every photo. Original `.png` may live in
  `/illustrations/` for archival, but never reference it from a page.
- **Sizing:** illustrations cap at 1920px on the long edge. Anything
  larger gets the `sharp` pipeline (see `/api/uploads`).
- **Compression:** server pipeline forces WebP @ q=80. Client
  compression in `lib/imageCompress.ts` brings camera shots in line
  before upload.
- **Loading:** every `<img>` gets `loading="lazy"` and `decoding="async"`
  unless it's above-the-fold hero, in which case use
  `loading="eager"` + `fetchPriority="high"`.
- **Alt text:** mandatory and descriptive. `alt=""` only for purely
  decorative ornaments (the `<JaliCorner>` family).

---

## 10. Motion

- Default transition curve: `cubic-bezier(0.2, 0.8, 0.2, 1)` ("ease out
  with overshoot") at `180ms`. Defined inside `.btn` and `.bm-card`.
- Cards lift `-translate-y-0.5` on hover.
- Buttons press `translateY(1px)` on `:active`.
- **Wrap any continuous motion in `motion-safe:`.** Anything that
  pulses, spins, or floats must respect `prefers-reduced-motion`. The
  spinning camera glyph in the live empty state, the pulsing live dot,
  the visitor-counter ScrollNumber — all gated.

---

## 11. Accessibility (non-negotiable)

- Every interactive element has a visible focus ring (2px saffron at
  `:focus-visible`). Already wired in `globals.css`.
- Tap targets ≥ 44×44 (the default `.btn` height).
- All form fields have `<label>` (or `aria-label` for inline pickers).
- Bilingual `<html lang>` flips on locale change (handled by
  `LocaleProvider`).
- Heading order is monotonic: `h1` → `h2` → `h3`. No `h2` orphaned
  inside `h3`.
- Don't carry meaning by colour alone. Status pills always pair colour
  with an icon or text label.

---

## 12. Voice & copy patterns

### Section headers

```
KICKER (small caps, gold-500, tracking-wide)
Headline in sentence case
One-sentence body that explains why this section exists.
```

### Empty states

```
[illustration]
KICKER ("Waiting for the first spot")
Headline that reframes the absence ("The pandals are quiet right now.")
Body that says what would change it ("Be the first to share…")
[Primary CTA] [Secondary CTA]
```

### Form fields

```
Label (Hindi above English, both bold)
[input]
Inline error (alert-500, italic, immediately under input)
Helper text (ink-600, sized down)
```

---

## 13. Adding to the system

When you reach for a new pattern, ask in this order:

1. **Is there already a primitive for this?** (Search `src/components/ui/`.)
2. **Is there a `globals.css` class for this?** (`.btn-*`, `.bm-card`.)
3. **Can I express it with existing tokens?** (Use `saffron-600`, not
   `[#E07A1F]`.)
4. **If still no:** add the new primitive to `src/components/ui/`,
   document it in this file's §8, render it in `/design-system`.

A change that fits in those four steps stays in the system. A change
that doesn't is a brand decision — bring it up before merging.
