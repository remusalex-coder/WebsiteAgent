# Design Intelligence — calibration and review

_2026-08-06. Closes the industry-palette work left unfinished at the previous
context limit, and reviews the result across twenty generated sites._

Reproduce everything here with:

```bash
npx tsx scripts/generate-examples.ts && npx tsx scripts/screenshot-examples.ts after
```

---

## 1. What was completed

### The calibration itself

Seventeen industry fallback hues, re-derived from real reference colours rather
than picked as numbers. The previous session had found that OKLCH hue values do
not transfer from HSL intuition — law's `258°` was reading as a mid periwinkle,
medical's `225°` as a flat cyan — and had corrected two of them before running
out of context. All seventeen are now traced to an anchor colour recorded in a
comment beside the number, and `scripts/hue-report.ts` prints what each one
actually renders to.

| Industry | Was | Now | Anchor | Reads as |
| --- | --- | --- | --- | --- |
| bakery | 45° | **76°** | `#c8860d` 73.6° | honey gold |
| restaurant | 20° | **28°** | `#9c3b2e` 30.2° | brick / wine |
| cafe | 35° | **52°** | `#6f4e37` 55.6° | roasted sienna |
| bar | 300° | **18°** | `#7b2d43` 5.8° | wine |
| gym | 32° | **42°** | `#ff5a1f` 37.7° | electric orange |
| construction | 40° | **88°** | `#cc7722` 59.6° | hard-hat amber |
| spa | 150° | **142°** | `#7d9b76` 139.7° | eucalyptus sage |
| professional-services | 255° | **170°** | `#047857` 165.6° | deep emerald |
| hotel | 240° | **186°** | `#0f5257` 202.6° | heritage petrol |
| dental | 205° | **208°** | `#00a3b4` 207.8° | fresh aqua |
| medical | 225° | **242°** | `#2b6cb0` 252.3° | clinical blue |
| automotive | 250° | **246°** | `#4682b4` 245.7° | steel blue |
| general | 250° | **258°** | — | plain blue |
| law | 258° | **265°** | `#1a2b5f` 267° | navy |
| real-estate | 255° | **283°** | — | slate indigo |
| retail | 292° | **298°** | `#7c3aed` 293° | boutique violet |
| beauty | 340° | **352°** | `#d99ab0` 356.5° | rose |

Two of those moved for a reason worth recording:

- **bar** went to the wine end of red rather than to plum. 300° rendered an
  electric violet that belonged to a software product; 330° — nominally plum —
  came out of the `bold` direction's 0.22 chroma as a hot magenta. Nothing in
  the magenta band survives that chroma at the solid step's lightness.
- **professional-services** went to emerald rather than to an indigo one step
  from law's navy. Both categories lead with the `corporate` direction, so the
  theme hands them identical type, spacing and form, and colour is the only
  thing left to tell a consultancy from a law firm. A new test now enforces a
  20° minimum between any two industries that share a first direction — it is
  what caught this.

### Defects found while validating, and fixed

Validating the calibration meant looking at rendered pages, and the pages showed
that most of the design layer was not reaching them.

| # | Defect | Evidence |
| --- | --- | --- |
| 1 | **Page background was the card grey on every design-driven site.** The design token block is appended after the base `:root`, so its `--color-surface` (which means "a card") silently overrode the base's (which means "the page"). | `body` computed `#eeeeee` where the design said canvas `#fcfcfc`, on all 20 |
| 2 | **Section rhythm was identical on every site.** `--space-section` was emitted and never read; `.section` read `--space-xl`, which the design block also overrode with a much smaller step. | 96px on all 20, against emitted values spanning 4.5–9rem |
| 3 | **The type scale was inert.** `--text-*-size` was emitted; `h1`, `h3` and body used hard-coded clamps. Eleven directions with ratios from 1.2 to 1.5 all produced the same headline. | h1 = 56px on all 20 |
| 4 | **Container width was inert.** `--container-max` emitted, `--content-width` used. | 1152px on all 20, against 64–76rem emitted |
| 5 | **Card and quote padding collapsed.** The design's `--space-md` (0.75rem) overrode the base's (1.25rem). | 12px, down from 20px before the design layer existed |
| 6 | **Elevation was inert.** `--shadow-*` emitted; components used a fixed `--shadow-card`, so `flat` directions were not flat. | identical shadow on `editorial`, `luxury`, `bold`, `minimal` |
| 7 | **Every generated site failed WCAG AA in the same three places.** Brand-filled buttons measured 3.9–4.5:1 because `onBrand` was graded against the 3:1 large-text floor, and hero eyebrows measured 3.2–3.7:1 because the brand colour was used as body-sized text without ever being validated as a foreground. | 61 elements below AA across 20 sites |

Every one of these is a token-vocabulary collision rather than a missing
feature: the design block reused names the base stylesheet already owned with
different meanings. The fix throughout is the two-name form
`var(--design-token, old-value)`, which lets a caller with no design render
exactly what it always did.

### Token calibration that followed

- **Spacing base 0.5rem → 0.8rem.** The scale's shape comes from the ratio; the
  base only decides where it sits, and at 0.5 the whole thing sat a step low
  relative to the components sharing its `--space-*` names.
- **Section spacing reduced** (airy 9rem → 6rem at the wide anchor). It is
  padding at *each* edge, so a section holding one line of text was opening a
  288px hole above it and another below.
- **Solid ramp step 0.62 → 0.55 lightness**, with the two steps below it moved
  to match. This is what makes law read as navy rather than periwinkle, and it
  is also what gives a button label enough room to clear 4.5:1.
- **New `brandText` semantic slot** — the brand hue pushed dark enough to be
  read as type, measured against `surface` rather than `canvas` because links
  appear inside cards, not only on the page's lightest ground.
- **`onBrand`/`onAccent`/`onInverted` are now constructed rather than picked.**
  The old code took the better of two poles, which is not the same as taking one
  that works; it now pushes the winner until it clears, and switches poles when
  the natural one is pinned at the end of the lightness range with nowhere to go.

### Verification

| Check | Result |
| --- | --- |
| Test suite | **233 passing, 0 failing** (was 222) |
| New tests | `test/design/palette.test.ts` — 11 cases pinning the intended read, band membership across every direction, hue separation, and contrast for all 17 industries × 11 directions |
| Typecheck | clean (`tsc -p tsconfig.test.json`) |
| Build | clean (`tsc -p tsconfig.json`) |
| Determinism | `generate-examples` run twice → byte-identical, `diff -r` clean |
| Rendered WCAG AA | **0 elements below AA across all 20 sites** (was 61) |
| Mobile overflow at 390px | none on any of the 20 |

---

## 2. Before vs after, measured

Every figure is the computed value on the rendered page, not the declared token.

| Measurement | Before | After |
| --- | --- | --- |
| Page background | `#eeeeee` on 20/20 — wrong | canvas, correct on 20/20 |
| Section padding | 96px on 20/20 | 52 / 72 / 96px — three densities |
| Container width | 1152px on 20/20 | 1024–1216px, 7 distinct |
| Hero headline | 56px on 20/20 | 39.8–143.5px, 9 distinct |
| Card padding | 12px | 19.2 / 20.7px |
| Elements below WCAG AA | 61 | 0 |
| Distinct hero variants | 3 | 5 |
| Distinct brand colours | 19 (2 categories collided) | 18 across 16 industries |

The single most telling line is the third: before this session, **every
structural measurement on all twenty sites was identical.** The design layer was
computing eleven directions' worth of type scale, spacing and form, and the
renderer was reading two things from it — colours and font family names.

Screenshots for each site, desktop and mobile, before and after, are in
`output/examples/_shots/`.

---

## 3. Critical review

Read as a creative director would, not as the author.

### The honest answer to "genuinely different, or cosmetically different?"

**Cosmetically different — and still cosmetically different after this session,
though the cosmetics now include structure.**

The evidence is not a matter of taste:

- **47 distinct CSS classes across all twenty sites, and not one of them carries
  a layout decision.** No `hero--split`, no `gallery--masonry`, no
  `services--feature-grid`, no emphasis modifier. The `LayoutPlan` assigns a
  variant to every section, a hero variant, a footer variant and an emphasis
  level, and the renderer consumes none of it.
- **The section order the design computes is discarded.** The photography site's
  plan reorders to `hero → about → services → contact → gallery → testimonials`;
  the page renders `hero → gallery → services → about → testimonials → contact`,
  which is the writer's original order.
- **All nine "distinct heading typefaces" are two.** No font is ever fetched —
  a deliberate decision, documented — and none of Inter, Manrope, Archivo,
  Playfair Display, Cormorant Garamond, Lora, Outfit, Jost, Fredoka, Space
  Grotesk, Nunito Sans or IBM Plex Sans is present on a default Windows or
  headless-Chromium install. Measured: every one falls through. A visitor sees
  Georgia for the five serif directions and the system sans for the other six.
  The theme library's font pairings are, in practice, a binary.

So the twenty sites differ in palette, type *scale*, spacing rhythm, radius,
elevation, motion budget and container width — which is more than "colours", and
after this session it is visibly more. They do not differ in **composition**.
Every page is the same object: sticky header, hero with optional right-hand
image, then N sections each of which is an H2 at top-left followed by content,
alternating between two background tints, then a two-column footer.

### What is genuinely good

- **The colour system.** Perceptually even ramps, constructed rather than
  checked contrast, industry hues that now read as their category, and zero AA
  failures across 20 rendered pages. This part is professional.
- **The type scale, now that it reaches the page.** The law firm at 143px
  Playfair-slot display against the medical clinic at 40px IBM-Plex-slot is a
  real difference in voice, and it comes out of one ratio rather than a table of
  hand-picked sizes.
- **Determinism.** Byte-identical across runs, no clock, no randomness. That is
  worth more than it sounds: a visual regression here is a readable diff.
- **Mobile.** No horizontal overflow at 390px on any of the twenty, images stack,
  type scales down, tap targets clear 44px.
- **The rationale trail.** Every decision carries a `rationale` string and the
  notes array records compromises. A bad output is diagnosable.

### What is amateur, and why

**1. Left-rail syndrome.** Every section is a heading and a block of content
pinned to the left of a 1000–1200px container, with 40–60% of the width empty
and unused. Look at the spa's "The idea", "Open" and "Booking": three sections,
each a heading and one line, each occupying a full screen band. A designer would
have set those as a three-column strip, or run the type across the measure, or
paired them with the image. Nothing in the system can do that, because nothing in
the system knows a section is thin.

**2. Ragged grid tails.** `repeat(auto-fit, minmax(16rem, 1fr))` on a six-item
gallery at 1440px gives four then two, with a visibly unbalanced last row.
Five items gives four then one — an orphan. The layout planner *computes* a
column count per section and the CSS ignores it, so the browser picks whatever
fits and the result is a tail on most pages.

**3. The card treatment is a Bootstrap alert.** A 1px border, a 4px coloured
left bar, a small radius, one line of text. It appears on services, on
testimonials, on contact, on every site, and it is the single most template-
looking element in the output.

**4. The hero is one composition wearing five names.** `split`, `centered`,
`full-bleed`, `editorial` and `minimal` all render as `.hero` — text left, image
right if there is one. The spa's 95px headline wrapping to four lines while a
small image sits centred beside it, leaving a void underneath, is what happens
when a hero variant is named but not implemented.

**5. Hierarchy has a hole in the middle.** Display type is 40–143px, body is
16–19px, and there is nothing between them doing work. The section subheading
is a hard-coded `clamp(1.0625rem, …, 1.25rem)` on every site regardless of the
direction, so a 143px editorial headline is followed by a 19px subheading — a
7:1 jump with no intermediate step. Section H2s are the only mid-tier element,
and they all sit at the same place in every layout.

**6. Alt text is rendered as visible captions.** Every gallery image gets a
`figcaption` from its alt text. With honest alt text this reads as a numbered
list under a grid; on a real profile it will read as whatever the collector
scraped. A gallery should caption deliberately or not at all.

**7. Two categories produce identical sites.** Jewellery and Retail both
classify as `retail` and land on the same direction, the same hue, the same
everything. Photography classifies as `general` — the rule list has no keyword
for it — so a documentary photographer gets the neutral small-business default.
The 20 businesses collapse into 16 industry ids, and the taxonomy has no slot
for creative or portfolio-led work at all.

**8. The `bold` direction is not loud enough and `luxury` is not quiet enough.**
Both are constrained by the same skeleton. The gym gets a 122px headline and a
dense rhythm, which is as far as it can go; a bold direction should be doing
things with colour blocks and full-bleed bands that the markup has no way to
express. The luxury spa's restraint reads as emptiness rather than as
confidence, for the same reason.

**9. Complementary accents that argue with the brand.** The `friendly`
direction's `accentHueShift: 200` gives every friendly site a cool accent
opposite its warm brand — the bakery is honey gold with a periwinkle accent.
It is a defensible complementary scheme in the abstract and reads as arbitrary
on the page.

**10. The header and footer are unstyled by the design.** Sticky header with
brand left and nav right, thin border; footer with © left and tagline right.
Identical on all twenty, and `footer: 'minimal' | 'corporate' | 'rich'` is
computed and unused. On mobile the nav wraps to two full rows above the fold,
where a real site would have a disclosure button.

---

## 4. Top 10 improvements for the next iteration

Ordered by how much visible quality each buys per unit of work.

1. **Consume the `LayoutPlan` in the renderer.** Emit `section--{kind}
   section--{variant} section--emphasis-{level}` and render each variant
   properly. This is the single change that converts the output from cosmetic
   difference to compositional difference, and the plan is already computed,
   tested and deterministic.
2. **Honour `layout.order`.** Render `content.sections` through the plan's index
   order instead of in written order. Roughly five lines, and it makes the
   industry priority lists — already built and tested — actually reorder pages.
3. **Ship the fonts.** Subset and inline the theme faces as base64 `@font-face`
   in the stylesheet, or accept the fallback and rewrite the theme library
   around faces that are genuinely available. Right now nine typefaces render as
   two, and the theme library's pairings are decorative.
4. **Implement the hero variants.** Five names, one composition. `full-bleed`,
   `split`, `editorial` and `magazine` are the difference between a hotel and a
   law firm at first glance.
5. **Give thin sections a layout.** Detect a section with one short body and no
   media, and set it as a two- or three-column strip or an inline pair. This is
   what fixes left-rail syndrome, and it needs the section shape data the layout
   planner already collects.
6. **Use the computed column count.** `SectionDesign.columns` exists; the CSS
   uses `auto-fit`. Emitting `--columns` and using `repeat(var(--columns), 1fr)`
   removes the ragged tails, and lets a five-item gallery be 3+2 rather than
   4+1.
7. **Add a mid-tier to the type scale on the page.** Wire `--text-h4-size`,
   `--text-body-large-size` and `--text-eyebrow-*` into the subheading, lead
   paragraph and eyebrow rules so the hierarchy has steps between 143px and
   19px.
8. **Redesign the card, or vary it by direction.** One bordered box with a
   coloured left bar is doing service lists, testimonials and contact details on
   every site. At minimum it should follow `elevation` and `radius` into three
   genuinely different treatments.
9. **Extend the industry taxonomy.** Add `creative` (photography, design,
   film), split `retail` from `jewellery`/`florist`, and add keywords for the
   categories that currently fall through to `general`. Sixteen ids for twenty
   businesses is the classification limiting the design, not the design layer.
10. **Reconsider the complementary accent shifts.** `friendly` at +200° and
    `corporate` at +150° produce accents that fight their brand. Analogous or
    triadic shifts, or a per-industry override, would stop a bakery from having
    a periwinkle accent.

---

## 5. Is this approaching professional agency quality?

**No — but the distance is now measurable, and it is one layer, not many.**

Where it stands honestly:

- **Colour, contrast and token generation: professional.** A studio would not do
  this better by hand, and would not do it consistently across twenty sites at
  all.
- **Typography: competent, and hobbled.** The scale is right; the faces never
  arrive.
- **Composition: template.** Twenty businesses, one page object. This is the
  gap, and it is entirely the unimplemented half of a layer that already exists
  in `lib/design/layout.ts` — planned, tested, and thrown away at the renderer
  boundary.

A fair summary: the output would now pass as a competent, accessible, small-
business website — the kind a good template produces when the palette has been
chosen carefully. It would not pass as designed. The difference between those
two is items 1, 2, 4 and 5 above, and all four consume decisions the system
already makes.
