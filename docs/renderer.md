# The renderer

_Last updated: 2026-08-06._

`WebsiteContent` → a complete static site. One `index.html`, one `styles.css`, and the
image files the page refers to.

```ts
import { renderSite, writeRenderedSite } from '../lib/render/index.js';

const site = renderSite(content);
// site.files    [{ path: 'index.html', contents }, { path: 'styles.css', contents }]
// site.assets   [{ sourcePath: 'assets/logo-a1b2.png', path: 'assets/logo-a1b2.png' }]
// site.warnings ['image has no usable location and was omitted: …']

await writeRenderedSite(site, { sourceDir: runDir, targetDir: `${runDir}/site` });
```

## Why it is not an agent

An agent takes an `AgentContext` because it needs a model, a browser, a logger or an
output directory. The renderer needs none of those — it is a pure function of its input.
Making it an agent would have bought a stage boundary and cost the property that
matters most about it: that you can call it from anywhere, including from a deployment
target, and get the same bytes.

It runs in `main.ts` immediately after stage 5, writing to `output/<runId>/site/`.

## Determinism

The same spec renders to the same bytes on any machine, on any day.

Nothing reads the clock, nothing is random, no iteration order depends on a hash. The
three places that could have broken this are handled explicitly:

- **No copyright year.** A year from the clock would make the same spec render
  differently on New Year's Eve — and it is a claim about the business that nothing in
  the profile supports.
- **JSON-LD keys are sorted** before serialisation, so two semantically identical
  payloads serialise identically regardless of the order the writer emitted them in.
- **Asset placement is by first reference**, and a filename collision between two
  different sources is resolved with a counter. The mapping depends only on the order
  images appear in the spec.

This is what makes a rendered site diffable, and what makes the snapshot tests in
`test/__snapshots__/` worth having: an unintended change to the template shows up as a
diff a reviewer reads.

## Everything from the spec is untrusted

A `WebsiteContent` is written by a model, from data scraped off the open web. None of
it is trusted, and the escaping is enforced by the type system rather than by
discipline: `Html` is a branded string, and the element builders accept nothing else.
To put content on a page you either escape it with `text()` or opt out explicitly with
`raw()` — and `raw()` is greppable.

| Input | Treatment |
|---|---|
| Text content | `escapeText` — `&`, `<`, `>` |
| Attribute values | `escapeAttribute` — the above plus `"` and `'` |
| `callToAction.href` | Allow-list: `http`, `https`, `mailto`, `tel`, fragments, relative paths. Anything else renders the label as plain text |
| Image `url` | Allow-list: `http`, `https`. No `data:` |
| `localPath` | Rejected if absolute or containing `..` |
| `voice.palette` entries | Allow-list of hex, functional and named CSS colours. A rejected entry falls back to a default |
| `voice.typography` names | Stripped to letters, digits, spaces and hyphens, then quoted |
| `seo.structuredData` | `<`, `>` and `&` escaped as `\uXXXX`, so `</script>` cannot close its own element |

Two of these are subtler than they look. A URL is checked **after** the characters a
browser ignores are stripped, because `java\nscript:alert(1)` is a working
`javascript:` URL that defeats a naive prefix check — and the stripped form is what
gets written, so the check and the output can never disagree. Protocol-relative URLs
(`//host/x`) are refused: they inherit a scheme nobody approved, and a rendered site
may well be opened over `file:`.

An unsafe call to action keeps its label and loses its link. Dropping the label would
lose content the writer chose to show; keeping the link would ship whatever the model
put in that field.

## It reports rather than throws

Every call returns; nothing about bad content raises. A malformed colour, a refused
link, an image with nowhere to load from — each is worked around and appended to
`site.warnings`, which `main.ts` writes to the run log.

The reasoning is the same as the platform's `CapabilityOutcome`: a spec comes from a
model, and failing an entire site over one bad field would be the wrong trade. The
problems end up in the log rather than silently in the output.

## Two paths

`renderSite(content)` and `renderSite(content, { design })` are different renderers
sharing one entry point.

Without a design the renderer decides the page's shape itself, from `kind` alone: this
is what it did before the design layer existed, and its output is **byte-identical** to
what it was. Existing callers see no diff until they opt in.

With a design the renderer decides nothing. `WebsiteDesign` says which hero, which
variant per section, what order, what ground, how dense, how many columns; this module
owns only what those names look like in markup. That split is the contract — the design
is a decision document, not a second template engine, and the renderer is a component
library, not a source of taste.

## Sections — the no-design path

Every `WebsiteSection` carries the same six fields whatever its `kind` is, so **`kind`
decides presentation and nothing else**. That is the whole separation between layout
and content — `sections.ts` chooses how a list of strings is shown and never what the
strings say.

| Kind | `bullets` become | Notes |
|---|---|---|
| `hero` | a plain list | First image is the hero media, loaded eagerly; the tagline sits above the heading |
| `services`, `menu` | a card grid | |
| `testimonials` | blockquotes | |
| `about`, `hours`, `location`, `contact`, `faq`, `gallery` | a plain list | |
| `cta` | a plain list | Inverted banner in the brand colour |

Adding a kind is one entry in `BULLET_LAYOUTS` — no new markup, no new stylesheet rule.

Images with role `logo` or `favicon` are consumed by the page shell (the header and
`<link rel="icon">`) and skipped by the section that carried them, so a logo is never
rendered twice.

## Sections — under a design

`LayoutPlan.order` is the render sequence, as indices into `content.sections`. It is
validated rather than trusted: an index out of range or repeated is dropped, and any
section the plan forgot is appended in written order. **A design that omits a section
never deletes the writer's copy.** Fragment ids are assigned in *written* order, so
reordering a page never renames its anchors.

Each `SectionDesign` reaches the markup as attributes a reviewer can read straight off
the page and check against `design.json`:

```html
<section id="what-we-bake" class="section section--services section--bento"
         data-variant="bento" data-emphasis="primary"
         data-density="airy" data-bg="subtle">
```

### Hero variants

Seven trees, not one tree with seven class names. The first screen is most of what a
visitor judges, so each is composed differently.

| Variant | Composition |
|---|---|
| `centered` | Type on the axis, media as a band beneath |
| `split` | Copy and photograph side by side, copy leading |
| `editorial` | A display line over a narrow measure, media demoted to a portrait column |
| `image-first` | The photograph is the opening statement |
| `full-bleed` | Type over the photograph, behind a scrim at `imagery.overlayOpacity`. The backdrop is positioned against the *section*, not the measured container — that is the whole difference between a full-bleed hero and a boxed one |
| `magazine` | Copy in one cell, a mosaic of two or three photographs in the rest |
| `minimal` | Type and nothing else, deliberately — the media the section has is dropped |

### Section variants

All sixteen members of `SectionVariant` are implemented. A variant the renderer
silently treated as `stack` would be worse than one the design never chose: the page
would look generic while the artifact claimed it was not.

`stack` · `cards` · `bento` · `feature-grid` · `alternating` · `timeline` · `split` ·
`list` · `masonry` · `grid` · `collage` · `carousel` · `slider` · `quotes` ·
`editorial` · `banner`

They share one grid engine, one card, one list and one media treatment. What differs is
composition — what spans what, what sits beside what — because that is what a variant
name means. Each degrades on its own: a `masonry` with no images falls through to
whatever the section does have rather than emitting an empty grid.

### Bullets carry structure the contract does not

`bullets` is `readonly string[]`, but writers consistently produce two shapes that mean
something: `Espresso — 2.60` and `Do I need a referral? No.` The list variants split on
those separators, so a price sets right against a leader and a question sets over its
answer. **Nothing is invented** — a bullet with no separator becomes a label with no
detail.

That one rule is most of why a restaurant's menu stops looking like a consultancy's
services grid.

## Coverage

`WebsiteDesign` publishing a decision the renderer ignores is the failure mode this
layer is prone to, and it is invisible in review. `scripts/renderer-coverage.ts`
measures it by perturbation rather than by reading the code: every leaf field is
mutated to a different legal value, the site is re-rendered, and the output compared.

```
npx tsx scripts/renderer-coverage.ts        # table + summary
npx tsx scripts/renderer-coverage.ts --md   # markdown
```

- **USED** — the mutation changed markup, or changed a custom property some rule reads.
- **PARTIALLY USED** — it changed only declarations nothing consumes. The value is
  published to the page and then ignored.
- **IGNORED** — byte-identical output.

Measured across all twenty example sites, because a field only a masonry gallery reads
is invisible on a site with no gallery. Fields are labelled `visual`, `documentation`
or `structural`, and only `visual` counts toward the headline number — a percentage
that mixes `layout.hero` with `personality.rationale` measures nothing.

## Accessibility

- One `<h1>` per document. The **first** section carries it whatever its kind, so a
  spec that opens with `about` because it had no hero still has a valid outline.
- `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`; every section landmark is
  named by its own heading via `aria-labelledby`, so a screen reader's region list
  reads as the site's outline.
- A skip link to `<main id="main" tabindex="-1">`. Without the tabindex the browser
  moves the scroll position but not the focus, and the next Tab returns to the
  navigation the user just skipped.
- A section with no heading gets a visually hidden one, so the landmark still has a
  name.
- `alt` is **never invented**. An image the collector found no alt text for is marked
  decorative with `alt=""`. The one exception is the logo, whose alt is the business
  name — a fact, not a guess.
- Buttons and navigation links clear the 44px touch target. Focus is always visible.
- `prefers-reduced-motion` is honoured.

## The stylesheet

Three blocks, in this order, in one file:

1. **The base sheet** — reset, shell, the pre-design layout. Every reference to a
   design token here takes the two-name `var(--new, old)` form, so a caller with no
   design renders exactly what it always did. A bare reference would silently drop the
   declaration for them, and `renderer.test.ts` asserts none exists.
2. **The token block** (`css.ts`) — everything `DesignTokens` decided, as custom
   properties. Emitted only under a design.
3. **The design rules** (`variants.ts`) — the rules that *read* those tokens: every
   hero and section variant, the grid engine, cards, gallery, footer, icons, imagery
   and the motion budget. Also design-only, so it needs no fallback form.

No colour, size or duration is written in block 3. A hard-coded value there would be
the design layer being overruled by the renderer, which is the thing this split exists
to prevent.

The root carries the four loudest decisions as attributes, so rules that vary by
direction or category key off the document rather than off a class name the stylesheet
would have to invent:

```html
<html lang="en" data-direction="editorial" data-industry="law"
      data-density="airy" data-scheme="light" …>
```

The design's reasoning ships as a comment at the top of the stylesheet — every
`rationale`, its `evidence`, and any `notes` the composer emitted. The answer to "why
is this hero centred" travels with the site instead of living in a JSON file somebody
has to still have.

## Layout and theme

Mobile-first, fluid. `clamp()` carries the type and space scales. Grid columns come
from the design as an inline `--columns` and step at the breakpoints
`ResponsiveSystem` specifies, so widening the medium breakpoint moves every grid on the
page at once.

Motion is spent on transitions and one entry animation, never on scroll position.
An element invisible until it is scrolled past is invisible to anything that does not
scroll — a printer, a crawler, a full-page screenshot.

Without a design the palette is positional, because an ordered list of colours is all
`BrandVoice` gives us: `[0]` primary, `[1]` accent, `[2]` alternate surface. Entries
beyond that are published as `--brand-4`, `--brand-5`, … which nothing the renderer
emits uses — they are exposed so a hand-written override can, rather than being
discarded.

Foreground colour on the brand colour is **computed**, not guessed: WCAG relative
luminance decides between black and white. A non-hex brand colour gets white, which
is never worse than picking arbitrarily.

**No web fonts, no external requests of any kind.** A typeface name becomes the first
entry in a stack whose fallback matches its character — a serif name falls back to
Georgia, not Arial. A rendered site is a folder you can open from disk, and it looks
the same offline.

## Options

```ts
renderSite(content, {
  lang: 'pt-PT',            // <html lang>, default 'en'
  assetDirName: 'assets',   // where images are placed
  htmlFileName: 'index.html',
  cssFileName: 'styles.css',
});
```

All four names are sanitised: a path separator or a `..` cannot escape the site root.

## Tests

`npm test` — 245 assertions. Five suites in `test/render/`, plus
`test/design/renderer.test.ts` for the seam between the two layers.

`html.test.ts` covers escaping and serialisation; `theme.test.ts` covers colour and
font validation including CSS injection; `assets.test.ts` covers URL safety and asset
placement; `site.test.ts` covers the document end to end — structure, every section
kind, missing optional fields, escaping, links and determinism; `write.test.ts` covers
the filesystem half.

`snapshot.test.ts` holds the whole template still. Regenerate deliberately with
`UPDATE_SNAPSHOTS=1 npm test`, and read the diff before committing it: a snapshot that
changes without an intended template change is exactly what the suite exists to catch.

## Related

- [Architecture](architecture.md)
- [Folder structure](folder-structure.md)
