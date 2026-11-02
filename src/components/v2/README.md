# BadaMangal inner page kit (v2)

The shared parts every redesigned inner page is built from, so all pages look like one site with the new homepage (`/`). Built 1 Nov 2026 for the inner page redesign. Reference pages: `/bhandara/[slug]` (`src/components/BhandaraDetailView.tsx`) and `/area/[slug]` (`src/components/AreaPageView.tsx`). Read those two first, then copy their patterns.

```tsx
import { InnerShell, PageHero, Section, Kicker, Breadcrumb, Button, Actions } from "@/components/v2";
```

## Ground rules (from the Founder, non negotiable)

- Wrap the page body in `<InnerShell>`. It scopes the CSS under `.bmi`, so nothing leaks into the homepage (`.bmh`) or the admin. The global Header and Footer stay in `app/layout.tsx`; never render another header or footer.
- One language per heading: `<Heading en hi>` shows Hindi to Hindi readers, English otherwise. Never a Hindi line with its English under it.
- One heading, at most one line under it, then the content or the action.
- One primary (saffron) button per screen. Never a red button, never a gradient card, no coloured left or top borders, no card inside a card, at most three shadows per screen.
- No emoji, no serif, no em or en dashes (ranges read "9 AM to 2 PM"; use `timeRange`). Bhandara names come cleaned from `toBhandara` / `toPublicBhandaraListItem` (`cleanName`).
- Never show a spotter's or WhatsApp sender's name. No organiser phone in any list. No WhatsApp community join links. No donate or UPI buttons.
- Art: only the existing painted set (`src/content/home-art.ts`, `public/illustrations/v2/`). Never generate new art; note the gap instead.
- SEO: keep every h1 and h2 string, every internal href, every anchor id. Pass the old strings into the kit (`labelAs="h2"`, `heading=`), restyle freely, reorder sections if needed.
- 48px tap targets, visible focus (built in), AA contrast, no horizontal scroll at 390px. Devanagari display text gets line-height 1.3 or more (built into `Heading`).
- Forms: restyle only. Never change field names, validation, submit handlers or API calls.

## Layout and tokens

- Tokens (colour, type, motion, button fills) live in `tokens.css`, shared with the homepage. Use `var(--saffron-2)`, `var(--sindoor)`, `var(--ink-2)`, `var(--line)`, `var(--f-en)`, `var(--f-hi)`, `var(--f-body)`. Never hard code a hex in a page.
- Content width matches the global header and footer exactly (1152px, 16px gutter, 24px from 640px), so a heading's left edge lines up with the logo.
- Section rhythm: `--sec` is 56px on phones, 80px from 900px.
- New CSS goes in `inner-v2.css`, scoped `.bmi .bmi-yourthing`. Prefix every class `bmi-`. Re-read the file before editing (other agents edit it too) and add a line to this README.

## Primitives

| Primitive | For | Key props |
| --- | --- | --- |
| `InnerShell` | Page wrapper: scope, ground, reveal motion | `as` ("div" or "article"), `ground` ("cream" or "paper") |
| `PageHero` | Top of every page: crumbs, kicker, h1, one line, actions, art | `crumbs`, `kicker`, `title {en,hi}` or `heading`, `lede`, `meta`, `actions`, `art`, `align` |
| `Heading` | Any h1, h2, h3 in one language, words rise in | `as`, `size`, `en`, `hi`, or `children` + `lang` for a heading with a link inside, `id` |
| `Kicker`, `KickSep` | The small tracked line above a heading | `live` adds the green pulse (only when truly live) |
| `Breadcrumb` | Trail above the hero (keep old hrefs) | `items: { label, href?, node? }[]` |
| `Section`, `SectionHead` | A page section with an optional head | `id`, `kicker`, `title` or `heading`, `lede`, `action`, `center`, `tone="paper"`, `tight`, `narrow`, `labelledBy` |
| `Button`, `Actions` | The one button: primary, secondary, text link | `variant`, `href`, `external`, `icon`, `iconEnd`, `size="sm"`, `block`; `Actions split` stacks full width on phones |
| `Chip`, `ChipList` | A small fact (date, menu item). Never a CTA | `tone`: default, saffron, gold, leaf, muted; `href` |
| `InfoList`, `InfoRow` | Label and value rows on hairlines (no cards) | `label`, `labelAs="h2"` for SEO headings, `icon`; inside values use `.big`, `.sub`, `ChipList`, `Actions` |
| `RowList`, `ListRow` | Hairline rows for any list (temples, entries) | `href`, `title`, `titleAs`, `kicker`, `meta`, `thumb` ({src,alt} or "gada"), `muted`, `external`; `RowList cols` = two columns on desktop |
| `BhandaraRow` | A bhandara as a `ListRow` from the public list shape | `b`, `date` ("next", "past", "pinned", "none" = time only under a date heading), `pinned` |
| `TileList`, `Tile` | The few places a grid is right (resources, temples) | `grid`, `cols`; tile `href`, `title`, `line`, `art` |
| `Tile` options (group A) | `titleAs` ("h2" or "h3") keeps a tile title as an SEO heading; `kicker` puts a small line above the title (news source and date) | |
| `LinkRow` | Three or four sibling links split by gold hairlines | `items: { href, label }[]` |
| `Plate`, `Print` | Painted art that fades into the ground; a real photo mounted like a print | `Plate fade` ("edges", "bottom", "none"); `Print href caption tilt priority` |
| `PlateMap` | Still painted map window with gada pins, no JS | `pin`, `others`, `labels`, `zoom` ("fit" or number), `href`, `footer`. Points from `placeOnPaintedMap` in `src/lib/home-map.ts` (server) |
| `StickyActions` | Phones only bottom bar, slides up after the hero | `items: { href, label, icon, primary?, external? }[]` (render inside `InnerShell`) |
| `EmptyState` | An empty list, as an invitation (never "0", never red) | `title` or `heading`, `lede`, `actions`, `art` (pattal by default) |
| `Band` | The one closing invitation at the foot of a page | `kicker`, `title` or `heading`, `lede`, `actions`, `art` |
| `Prose` | Long text: history, guides, terms, FAQ answers | `variant="verse"` for chalisa or aarti (centred, line-height 1.9), `lang` |
| `ProseDoc` | Prose with a table of contents (legal, long guides) | `toc: { id, label }[]` (ids match the h2 ids), `tocTitle` |
| `FaqList` | Accessible disclosure list (all answers in the HTML) | `items: { id, q, a, links? }[]`, `headingAs`, `open`, `multiple` |
| `FormSkin`, `FormPanel`, `Field`, `Select`, `Check`, `Stepper` | Forms, wrapping existing inputs | `FormSkin` restyles every control inside; `Field label htmlFor hint error optional`; `Stepper steps current` |
| `PhotoGrid` | Gallery, spots at a bhandara, recap photos | `items: { src, alt, href?, title?, caption?, badge? }[]`, `lead`, `dense` (3 up on phones, 6 on desktop), `onOpen(i)` (client parents: each photo becomes a lightbox button) |
| `FeedList`, `FeedRow` | The live feed | `meta` (area and time, neutral labels), `text`, `photo`, `marker` |
| `BigFigure`, `Figures`, `Meters` | Numbers without tiles (recap, stats): one huge sindoor figure; a hairline grid of figures; solid bars on hairline rows | `BigFigure value label sub center`; `Figures items {value,label,sub} cols` (2 on phones); `Meters items {label,value,display,hot} cols` |
| `Icon` | The kit's line icons | `name`: chevron, back, arrowUpRight, pin, clock, calendar, thali, user, landmark, phone, whatsapp, share, copy, check, camera, plus, map, search |
| `format.ts` | `timeRange`, `shortTime`, `dayMonth`, `longDate`, `servedSpan`, `istToday` | all take a locale |

## One example

```tsx
"use client";
import { useLocaleFromContext } from "@/lib/locale-context";
import { InnerShell, PageHero, Breadcrumb, Kicker, Actions, Button, Section, RowList, ListRow } from "@/components/v2";

export default function TemplesView({ temples }) {
  const isHi = useLocaleFromContext() === "hi";
  const q = isHi ? "" : "?lang=en";
  return (
    <InnerShell>
      <PageHero
        crumbs={<Breadcrumb items={[{ label: isHi ? "होम" : "Home", href: `/${q}` }, { label: isHi ? "मंदिर" : "Temples" }]} />}
        kicker={<Kicker>{isHi ? "लखनऊ" : "Lucknow"}</Kicker>}
        title={{ en: "Hanuman temples of Lucknow", hi: "लखनऊ के हनुमान मंदिर" }}
        lede={isHi ? "..." : "..."}
        actions={<Actions><Button href={`/#map${q}`} icon="map">{isHi ? "नक़्शा" : "Open the map"}</Button></Actions>}
      />
      <Section id="list" title={{ en: "Every temple", hi: "सभी मंदिर" }}>
        <RowList cols>
          {temples.map((t) => (
            <ListRow key={t.slug} href={`/resources/temples/${t.slug}${q}`} title={isHi ? t.nameHi : t.name}
                     meta={t.area} thumb={{ src: t.image, alt: t.name }} />
          ))}
        </RowList>
      </Section>
    </InnerShell>
  );
}
```

## Page level classes (added in phase 2, reuse them)

- Day blocks (gallery, archive): `.bmi-gday` > `.bmi-wrap` > `.bmi-gday-head` (an h2 date via `Heading size="sub"`, then `.bmi-gday-facts` with `.bmi-gday-tag` "Bada Mangal" and `.bmi-gday-count`). Quiet days share a row: `.bmi-grow` > `.bmi-gcell` with `--span` = photo count.
- "Jump to" label before a chip row: `.bmi-gal-jump`.
- Live page: `.bmi-live-quiet` (copy left, countdown right), `.bmi-live-count`, `.bmi-live-tues` (the season's Tuesdays on hairlines), `.bmi-livepic` (whole photo on its own blurred fill, never cropped), `.bmi-live-acts-row`.
- Archive: `.bmi-arch-bar`, `.bmi-arch-tabs` (`.bmi-choice` with `aria-selected`), `.bmi-arch-search`.
- Visible photo captions go through `publicCaption()` in `src/lib/public-caption.ts` (drops AI vision captions and political text); `isPoliticalText()` filters curated photo sets.

## Do and don't

- Do keep the old h1 and h2 strings and hrefs; check with curl before and after.
- Do use `RowList` + `ListRow` for lists. Don't build a stack of identical cards.
- Do use `InfoList` for facts. Don't put a box around a group of facts.
- Do put real photos in `Print` and painted art in `Plate`. Don't put text over Hanuman ji, don't crop a pamphlet.
- Do let reveal motion come from the kit (`data-rv` is already on heads, lists and art). Don't add new animation libraries.
- Don't nest a `FormPanel` in a `FormPanel`, a `Band` in a `Section`, or a `Section` in a `Section`.
- Don't fork a primitive for one page. Add an option, note it here.
- Logos on a white jpg ground use `mix-blend-mode: multiply`; never put `data-rv` on their parent (the reveal animation isolates the group and the white box comes back).
- `ProseDoc` ids: for legal bodies, `LegalPage` (src/components/LegalPage.tsx) gives each h2 `section-N` and builds the contents list itself, without touching the text.
- Reusing a homepage component on an inner page (the recap's Tuesday picker): import `home/home-v2.css` and wrap it in `<div className="bmh" data-fab="on">` (`data-fab` stops the homepage rule that hides the floating Spot button).

## Chrome

Inner pages use the same global Header and Footer as the homepage (dark `#1E1611` footer, "A part of the DharmKriya family" with the real wordmark). `inner-v2.css` also gives inner pages the homepage's phone behaviour: the floating Spot pill collapses to the 52px camera button, the back to top circle goes, and the Spot button steps aside while `StickyActions` shows.

## Classes added by group A (temples, resources, history)

- `.bmi-arch` (+ `.big`): a painted temple plate in the homepage's mandir arch (round top, gold hairline inside). `.bmi-arches`: a row of arches, a snap row on phones, five across on desktop. Temple plates: `templeTallArt(temple)` in `src/components/TemplesView.tsx` gives the tall plate.
- Verse style: inside `Prose variant="verse"`, wrap each line in `<span className="vl">` and comma halves in `<span className="vh">` so a long line breaks at its comma; `.doha` sets a doha in sindoor. Devanagari verse numbers get the Devanagari face.
- `.bmi-gada-list`: a `Prose` list with gada pins as bullets.
- `.bmi-res-feat` (+ `-img`, `-t`, `-x`): a featured story (photo, kicker, headline, excerpt) used on /resources and /resources/news.
- `.bmi-hist-*`: the /history editorial (chapter numerals, pull quote, wide plates, timeline on gada pins, benediction).

## Forms, part 2 (added 2 Nov 2026, group B: list, spot, organise, volunteer, contact, pamphlet)

- `Field asLabel` renders the whole row as a `<label>` around its control (for existing inputs with no id). `className` is passed through.
- Shared custom controls are skinned inside `.bmi-form` through hook classes added to them: `.bm-ctl` (FancySelect and TimeField triggers), `.bm-phone` (PhoneInput), `.bm-ctl-date` (SeasonDatePicker trigger). Native date and time inputs get a drawn calendar or clock; the browser picker still opens on tap.
- New CSS pieces (all in `inner-v2.css`): `bmi-dates`/`bmi-date` (season date tiles to tick), `bmi-choice` now also works on `<button aria-pressed>` and on labels wrapping a radio or checkbox, `bmi-tagbox`/`bmi-tag` (type and press Enter), `bmi-fnote` (icon disc and one line, no box), `bmi-alert` (`.ok` for green; warm, never red), `bmi-step-h`, `bmi-grid2` (two equal columns from 640px), `bmi-form-nav` (Back link left, one saffron action right), `bmi-fieldset`, `bmi-sub` (hairline sub-block), `bmi-done` + `bmi-done-tick` + `bmi-next` (a form's thank-you), `bmi-paths`/`bmi-path` (the /list-bhandara chooser rows), `bmi-drop` (photo or file drop zone), `bmi-file` (attach row), `bmi-fsec`/`bmi-fh` (titled block in a form), `bmi-sbar` (phones: the form's one action pinned to the bottom), `bmi-formgrid` + `bmi-formart` (form on the left edge, painted plate beside it from 1024px), `bmi-vol`/`bmi-stats`/`bmi-steplist` (`.plain`, `.two`, `.three`), `bmi-pkgs`/`bmi-pkg` (package tiers), `bmi-themes`/`bmi-theme` (pamphlet style picker), `bmi-code` (a big code to copy).
- Stepper fix: the current step's label no longer collapses; on phones it shows as a caption under the dots.
