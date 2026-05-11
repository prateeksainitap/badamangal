# AI image prompts for BadaMangal.com

> Use these in **Midjourney, DALL-E 3 (ChatGPT), Imagen 3, Sora image, or Adobe Firefly**. Each prompt is written to be tool-agnostic. Tool-specific tweaks at the bottom.
>
> **Important religious guidance:** Avoid hyper-photorealistic AI portraits of Hanuman Ji — they read as uncanny and many devotees find them inappropriate. Stick to **stylized, painterly, line-art, mural-inspired, or silhouette** treatments. The prompts below are written that way intentionally.

---

## How to use this file

Each prompt is grouped by where on the site the asset goes. For each, generate **3–5 variations**, then pick the best, upscale, and save to `public/illustrations/` with a clear filename. Output preferred sizes: hero illustrations 2400×1600 PNG, ornaments 800×800 SVG-trace, banner art 1600×900 PNG.

Always append:
- `--ar 3:2` (or appropriate aspect) in Midjourney
- `--style raw` in Midjourney v6 if the result is too saccharine
- For DALL-E / ChatGPT: append "no text, no watermark, no signature"

Prompts use this structure: **subject — style — palette — composition — mood — exclusions**.

---

## 1. HERO — Homepage right side

**Filename target:** `public/illustrations/hero-hanuman.png`
**Aspect:** 3:4 portrait (illustration bleeds off the right edge of an asymmetric hero).

```
A devotional yet modern illustration of Hanuman Ji, painted in the style of a contemporary Indian textile mural — gentle line weight, hand-painted gold leaf accents, warm matte finish. Hanuman is shown in three-quarter view, gada (mace) resting against his shoulder, eyes closed in calm meditation. The background is a soft cream paper texture with a faint 8-pointed sun mandala glowing in saffron behind his silhouette. Marigold strings fall along the edges of the frame. Limited palette: cream, saffron orange, deep sindoor red, Awadhi gold, ink-black outlines. No text. No photorealism. Editorial, dignified, calm. Mughal-Awadh fusion influence. Suitable for a heritage city festival website. No watermark, no signature.
```

Tool tweaks:
- Midjourney: append `--ar 3:4 --style raw --stylize 200`
- DALL-E: prepend `Wide editorial illustration. ` and add `Subtle paper grain texture overlay.`

---

## 2. HISTORY PAGE — three banner illustrations

**Banner A — between sections 3 and 4: "Aliganj at dusk"**
Filename: `aliganj-dusk.png`. Aspect 16:9.

```
A wide painterly illustration of an old north Indian temple courtyard at dusk in summer. Warm saffron sky, silhouettes of devotees walking toward an arched temple gateway, the dome of the Aliganj Hanuman Mandir visible in the background. Foreground: a row of clay diyas glowing on the temple steps. Style: hand-painted gouache with visible brushwork, palette of cream, saffron, sindoor, and Awadhi gold, soft ink outlines. No text. No specific identifiable people. Heritage, calm, devotional. Editorial poster quality.
```

**Banner B — between sections 5 and 6: "The bhandara line"**
Filename: `bhandara-line.png`. Aspect 16:9.

```
A wide painterly illustration of a Lucknow street bhandara in summer. A long row of canopies in saffron and white, a stove with a large kadhai of puris steaming, hands of volunteers and devotees passing plates and cups of cold sherbet. Cropped tight on hands and plates rather than faces. Heat haze, warm afternoon light, some marigold strings overhead. Style: contemporary Indian gouache illustration, bold ink outlines, palette of cream, saffron, sindoor, gold, peepal-leaf green. No text, no logos, no recognizable brand signage. Documentary warmth.
```

**Banner C — after section 8: "Eight Tuesdays mandala"**
Filename: `eight-mandala.png`. Aspect 16:9.

```
A geometric mandala composition with eight equal points around a central sun. Each of the eight points contains a tiny illustrated symbol related to a Bada Mangal: a temple bell, a clay diya, a kadhai, a marigold flower, a glass of sherbet, an open palm offering a plate, a Hanuman gada, and an open Chalisa book. The center holds a stylized 8-pointed sun in saffron and gold. Background: cream paper with subtle jali pattern. Style: line-art with selective gold and saffron fills, like a contemporary Awadhi miniature. No text. Editorial.
```

---

## 3. ORNAMENTS — small SVG-traceable assets

These are best generated as **vector-friendly line art on white**, then converted to SVG.

**Marigold string divider**

```
A horizontal band of three stylized marigold flower heads connected by a thin gold thread, drawn in flat line art with subtle saffron and gold fills. White background, no shading, no gradient, no text. Optimized for SVG conversion: clean continuous lines, no rasterized shadows. Width 5x height. Decorative, devotional, minimal.
```

**Jali corner motif**

```
An ornamental Awadhi jali (lattice screen) corner pattern: a 90-degree corner ornament with interlocking 6-pointed star and quatrefoil shapes, inspired by Mughal stone screens. Flat line art, single color (Awadhi gold), white background, no shading or gradient, no text. Suitable for vector tracing into an SVG. Symmetrical, elegant, sparse.
```

**Diya cluster ornament**

```
A small cluster of three traditional clay oil lamps (diyas), each with a single visible flame, viewed from the front, drawn in flat line art with saffron flames and gold lamp bodies on white. No shading, no gradient, no text. Symmetrical and graceful. Suitable for vector tracing into an SVG.
```

---

## 4. MAP PIN — gada-shaped marker

Filename: `map-pin-gada.svg` (handwrite final SVG, but use this prompt to generate a reference image).

```
A simplified map pin icon shaped like a Hanuman Ji gada (mace), front view, designed to read at 32x32px. Top: rounded gada head with two horizontal bands. Middle: shaft tapering to a point. Color fill: saffron orange (#E07A1F) for the head, deep gold (#C9A24A) for the shaft, sindoor red (#9C2A2A) outlines. Flat icon style, no shadow, no gradient, transparent background. Simple, clean, memorable. No text.
```

---

## 5. EMPTY-STATE / ERROR — gentle illustrations (not generic robots)

**No bhandaras found**

```
A gentle illustration of an empty offering plate in cream and gold, viewed from above, with a single marigold flower placed on it. White cream background, soft ink lines, no text. Mood: hopeful pause, not error. Suitable for an empty-state illustration on a devotional website.
```

**404 / something went wrong**

```
A gentle illustration of a tipped-over clay diya with a thin trail of smoke rising and dissolving into a small marigold blossom. Warm cream background, soft ink lines and saffron-gold fills, no text. Mood: humble apology, not failure.
```

---

## 5b. TEMPLE HERO ILLUSTRATIONS

> Five placeholder hero illustrations for `/resources/temples/[slug]`. Use until verified rights-cleared photography is available. All five share the same visual language so the directory page reads as a set.

**Common style for all five:**

- Hand-painted gouache / contemporary Indian gouache illustration
- Soft ink outlines, brushed colour washes, visible texture (not vector flat)
- Palette: cream `#FBF7F0`, saffron `#E07A1F`, sindoor `#9C2A2A`, Awadhi gold `#C9A24A`, peepal-leaf green `#3F7A3F`, ink `#1A1410`
- Aspect 16:9, 2400×1350 master, exported at 1600×900 WebP @ 80 for web
- Devotional, dignified, calm; warm afternoon or early-morning light
- **Do NOT depict Hanuman Ji's face directly** — show the temple gate, spire, courtyard, devotee silhouettes, ritual objects. The deity is implied by setting, not portrayed photoreal.
- No text, no watermark, no signature, no recognisable real faces
- Subtle paper-grain at 4–6% opacity layered after generation

**File targets (1600×900 WebP):**

```
public/illustrations/temples/aliganj-naya-hanuman.webp
public/illustrations/temples/aliganj-purana-hanuman.webp
public/illustrations/temples/hanuman-setu.webp
public/illustrations/temples/sankat-mochan-hazratganj.webp
public/illustrations/temples/bada-hanuman-khun-khun-ji.webp
```

---

**1. Aliganj Naya Hanuman Mandir — "The Begum's temple"**
Filename: `aliganj-naya-hanuman.webp`

```
A wide painterly illustration of the Aliganj Naya Hanuman Mandir in Lucknow on a Bada Mangal afternoon. Centred on the temple's distinctive arched saffron-and-cream gateway with a single tall white spire crowned by a saffron flag rising behind it. Foreground: an unbroken line of marigold-strung canopies receding down the approach road, the silhouettes of devotees walking toward the gate carrying small clay diyas. A gentle haze of incense and warm summer light drifts across the scene. Style: contemporary Indian gouache, visible brushwork, soft ink outlines. Palette: cream paper background, saffron orange, sindoor red, Awadhi gold, with a single accent of peepal-leaf green in the marigolds' leaves. No text, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Editorial heritage feel.
```

---

**2. Aliganj Purana Hanuman Mandir — "The older shrine"**
Filename: `aliganj-purana-hanuman.webp`

```
A wide painterly illustration of the Aliganj Purana Hanuman Mandir, the older companion shrine to the Naya Mandir. Quieter, more intimate composition than the flagship temple: a low, weathered stone temple wall, an old peepal tree throwing dappled shade across a worn courtyard stone, two clay diyas glowing on the threshold, marigold petals scattered on the steps. A solitary devotee with a covered head sits in profile near the doorway. Early-morning light, longer shadows, calm. Style: contemporary Indian gouache, soft ink outlines, visible brushwork, paper texture. Palette: cream, sindoor, Awadhi gold, ink-black outlines, peepal-leaf green for the tree. No text, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Mood: contemplative, weathered, devotional.
```

---

**3. Hanuman Setu Mandir, Daliganj — "The riverside temple"**
Filename: `hanuman-setu.webp`

```
A wide painterly illustration of Hanuman Setu Mandir on the banks of the Gomti river in Lucknow, viewed in long shot at golden hour. The temple's red-and-cream domes rise on a slight rise just before the bridge; a continuous line of bhandara canopies in saffron and white runs along the riverside walk; the steel girders of the Daliganj bridge hint into the upper-right corner. Foreground: clay matkas of cool water on a low wall, a row of shoes left at the temple entrance, a faint reflection of the temple in the river. Style: contemporary Indian gouache, soft ink outlines, visible brushwork. Palette: cream paper background, saffron, sindoor, gold, and a dusty river-blue (not cold cyan) for the Gomti. No text, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Editorial summer-afternoon mood.
```

---

**4. Sankat Mochan Hanuman Mandir, Hazratganj — "The central-Lucknow gathering point"**
Filename: `sankat-mochan-hazratganj.webp`

```
A wide painterly illustration of Sankat Mochan Hanuman Mandir in Hazratganj, Lucknow's central commercial heart, on a Bada Mangal afternoon. Composition: the temple's modest cream gateway sandwiched between Hazratganj's distinctive colonnaded shopfronts; a Bada Mangal bhandara line in saffron canopies running along the footpath; a 1950s-style storefront sign in painted Devanagari is suggested but not specifically readable; rickshaws and pedestrians fill the lane. Style: contemporary Indian gouache, urban-illustration sensibility, soft ink outlines, visible brushwork. Palette: cream, saffron, sindoor, Awadhi gold, with a hint of café-brown for the colonnade arches. No text legible enough to read, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Mood: dense, civic, warm.
```

---

**5. Bada Hanuman Mandir, Khun Khun Ji Road — "The old-city Hanuman"**
Filename: `bada-hanuman-khun-khun-ji.webp`

```
A wide painterly illustration of the Bada Hanuman Mandir on Khun Khun Ji Road in old-city Chowk, Lucknow. Composition: a narrow bazaar gali at midday, jharokhas and ornamented Awadhi balconies leaning over the lane, the small temple's saffron arched entrance set into the row of shopfronts, a string of marigold lights overhead, a small bhandara stove with a kadhai of puris steaming on the temple step. Two children dart past in the foreground. Style: contemporary Indian gouache, visible brushwork, soft ink outlines, paper texture. Palette: cream paper, saffron, sindoor, Awadhi gold, ink-black, with a sandstone-rose accent for the old-city walls. No text, no watermark, no recognisable faces, no photoreal Hanuman Ji portrait. Mood: tight, nostalgic, lived-in.
```

---

**Tool tweaks for all five:**

- Midjourney v6: append `--ar 16:9 --style raw --stylize 220` (use `--chaos 8` on first batch for variety; pick the most editorial of 4)
- DALL-E 3: prepend "Wide editorial illustration, hand-painted gouache style.", end with "no text, no watermark, no recognizable faces, no photoreal religious figures."
- Imagen 3: explicitly say "painted illustration, not photo" and "cream paper background"
- Firefly: Style → Painting, Effect → Gouache. Avoid Photo content type.

After generation, **review each side-by-side** for set consistency (palette, paper texture, ink-line weight). If one looks like a different artist, regenerate that one before publishing. Save the master prompts + selected seeds in `public/illustrations/temples/_credits.json` so we can re-generate consistently.

---

## 6. SOCIAL / OG IMAGES

Generate one wide OG and reuse for all share previews.

```
A horizontal social card composition for the website "BadaMangal — Lucknow's Bhandara map". Left side: stylized Hanuman Ji silhouette with a glowing 8-pointed sun behind him, hand-painted illustration style with saffron, sindoor, and Awadhi gold on cream paper texture. Right side: empty space (will hold dynamic text). Subtle marigold string at the top edge. No baked-in text. Mood: heritage, modern, devotional.
```

---

## 7. TONE & SAFETY GUARDRAILS (apply to every prompt)

- Avoid the word "realistic" or "photorealistic" when depicting Hanuman Ji.
- Prefer "painterly", "mural", "line art", "hand-painted", "gouache", "miniature" — these tools handle these styles much better than realism without producing uncanny faces.
- Never request "AI", "metallic", "neon", "sci-fi", or "futuristic" in religious imagery — those modifiers break the heritage tone instantly.
- Never depict consumption (eating with mouth open, etc.) of religious figures.
- If a tool refuses on grounds of religious imagery, switch to "stylized line art mural inspired by Indian temple paintings" — same intent, different framing.

---

## 8. POST-PROCESSING

After generation:

1. **Upscale** with the tool's built-in upscaler to ≥ 2400px on the long edge.
2. **Color-grade** in Photoshop or Affinity: nudge saturation +5%, lift shadows, ensure brand palette matches (use eyedropper on the design tokens).
3. **Texture overlay**: add a subtle paper-grain layer at 4–6% opacity to unify with the design system.
4. **Compress**: WebP with 80 quality for site delivery; keep PNG masters.
5. **Document credits**: store generation tool and prompt next to each asset so we can regenerate consistently.

---

## 9. TOOL-SPECIFIC TWEAKS

**Midjourney v6:** `--style raw --stylize 250 --ar 16:9` for banners; `--ar 3:4 --stylize 300` for hero. Consider `--chaos 10` for variety in the first batch.

**DALL-E 3 (ChatGPT):** Lead with "Editorial illustration" and end with "no signature, no watermark, no text". DALL-E sometimes adds devanagari text — explicitly forbid it.

**Imagen 3 / Veo (Google):** Prepend "high-quality editorial illustration" and explicitly request the cream paper background.

**Adobe Firefly:** Set Style to "Painting" and Effect to "Watercolor" or "Gouache". Avoid "Photo" content type for any Hanuman Ji depiction.

**Sora image:** Best for the hero illustration. Lead with "Hand-painted Indian textile mural style" — Sora respects style language strongly.
