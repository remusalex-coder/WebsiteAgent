/**
 * The design-driven half of the stylesheet.
 *
 * `css.ts` emits the base sheet and the token block: names and values. This
 * file emits the rules that *read* them — every hero treatment, every section
 * variant, the grid engine, the card and button styles, the footer layouts and
 * the motion budget. It is only emitted when a `WebsiteDesign` was supplied, so
 * the pre-design output is untouched to the byte and nothing here needs the
 * two-name `var(--new, old)` fallback form the base sheet does.
 *
 * Two things this file is not:
 *
 * - **Not a theme.** No colour, size or duration is written here. Every value
 *   is either a token reference or is derived from a decision the design made.
 *   A hard-coded `#333` in this file would be the design layer being overruled
 *   by the renderer, which is the exact failure this pass exists to remove.
 * - **Not sixteen templates.** The variants share one grid engine, one card, one
 *   list and one media treatment. What differs between them is composition —
 *   what spans what, what sits beside what — because that is what a variant name
 *   means.
 */

import type {
  ImageCrop,
  ImageTreatment,
  WebsiteDesign,
} from '../design/types.js';

/** Three decimal places: enough for CSS, and stable across platforms. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * How much air each density level asks for, on one scale.
 *
 * Used only as a ratio. `--space-section` already carries the page's density,
 * so a section's own density is expressed as a deviation from the page's — the
 * factor for a section that agrees with its page is exactly 1.
 */
const DENSITY_FACTOR: Readonly<Record<'airy' | 'balanced' | 'dense', number>> = {
  airy: 1.22,
  balanced: 1,
  dense: 0.78,
};

/** A crop name as an `aspect-ratio` value. `natural` lets the file decide. */
function aspect(crop: ImageCrop): string {
  switch (crop) {
    case 'square': return '1 / 1';
    case 'landscape': return '4 / 3';
    case 'portrait': return '3 / 4';
    case 'wide': return '16 / 9';
    case 'natural': return 'auto';
  }
}

/**
 * A treatment as a `filter`.
 *
 * Deliberately gentle. The point is that a spa's photographs and a gym's do not
 * look like they came out of the same stock library, not that either one looks
 * processed — a filter strong enough to notice is a filter that will ruin
 * somebody's product photo.
 */
function treatmentFilter(treatment: ImageTreatment): string {
  switch (treatment) {
    case 'warm': return 'saturate(1.08) sepia(0.14) hue-rotate(-6deg)';
    case 'cool': return 'saturate(0.94) hue-rotate(8deg) brightness(1.02)';
    case 'monochrome': return 'grayscale(1) contrast(1.05)';
    case 'muted': return 'saturate(0.72) contrast(0.96)';
    case 'natural': return 'none';
  }
}

/* ------------------------------------------------------------------ */

export function designRules(design: WebsiteDesign): string {
  const { color, typography, radius, elevation, motion } = design.tokens;
  const { layout, imagery, icons, responsive, accessibility, personality } = design;
  const { smRem, mdRem, lgRem } = responsive.breakpoints;

  const weights = typography.heading.weights;
  const weightMin = Math.min(...weights);
  const weightMax = Math.max(...weights);

  // How hard a rule between two things is drawn. The contrast decision is about
  // more than text legibility — a soft palette with hairline rules and a high
  // one with the same hairline are not the same design.
  const rule = personality.contrast === 'high'
    ? 'var(--color-border-strong)'
    : 'var(--color-border)';

  // Depth is either a shadow or a border, never both. `prefersBorders` is the
  // design saying which, and a direction that says borders and then gets a
  // shadow reads as a template that ignored it.
  const cardDepth = elevation.prefersBorders
    ? `border: 1px solid ${rule};\n  box-shadow: none;`
    : `border: 1px solid transparent;\n  box-shadow: var(--shadow-md);`;

  const cardHoverDepth = elevation.prefersBorders
    ? `border-color: var(--color-brand);`
    : `box-shadow: var(--shadow-lg);`;

  const lifts = motion.effects.includes('scale') || motion.effects.includes('rise');
  const staggers = motion.effects.includes('stagger');
  const animates = motion.level !== 'none' && motion.effects.includes('fade');

  // A marker's shape is the form language's, not its own. A direction that
  // squares every corner and then draws circular bullets is two design systems
  // on one page.
  const iconRadius = radius.style === 'sharp'
    ? '0'
    : radius.style === 'round'
      ? 'var(--radius-pill)'
      : 'var(--radius-sm)';

  // How far the sticky header separates itself from the page under it. A flat
  // direction lifts it with a rule; a dramatic one with the deepest shadow it
  // has.
  const headerLift = elevation.style === 'flat'
    ? 'none'
    : elevation.style === 'subtle'
      ? 'var(--shadow-sm)'
      : elevation.style === 'lifted'
        ? 'var(--shadow-md)'
        : 'var(--shadow-lg)';

  return `
/* ------------------------------------------------------------------ */
/* Design rules — every decision in WebsiteDesign, applied              */
/* ------------------------------------------------------------------ */

:root {
  color-scheme: ${color.scheme};

  /* Grid engine */
  --mobile-columns: ${responsive.mobileColumns};
  --grid-gap: var(--space-md);

  /* Imagery */
  --image-radius: ${imagery.radius === 'none' ? '0' : `var(--radius-${imagery.radius})`};
  --image-filter: ${treatmentFilter(imagery.treatment)};
  --hero-aspect: ${aspect(imagery.heroCrop)};
  --gallery-aspect: ${aspect(imagery.galleryCrop)};
  --overlay-opacity: ${imagery.overlayOpacity === null ? 0 : round(imagery.overlayOpacity)};

  /* Icons */
  --icon-size: ${round(icons.sizeRem)}rem;
  --icon-stroke: ${round(icons.strokeWidth)}px;

  /* Type roles beyond the scale's own steps */
  --weight-heading-min: ${weightMin};
  --weight-heading-max: ${weightMax};

  /* Rules and separators */
  --rule: ${rule};
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

body {
  background: var(--color-canvas);
}

/*
 * The measure is a computed decision, not a habit.
 *
 * The base sheet caps prose at a hard 62ch. A luxury direction wants 62 and an
 * editorial one at 1.125rem base wants something else entirely, and the type
 * system already worked out which — so prose reads the token.
 */
.section__body,
.section__subheading,
.editorial__body p {
  max-width: var(--measure);
}

.section__body--lede > p:first-child {
  font-size: var(--text-body-large-size);
  line-height: var(--text-body-large-height);
  font-weight: var(--text-body-large-weight);
  color: var(--color-text);
}

/* Header ----------------------------------------------------------- */

.site-header {
  position: static;
  background: var(--color-canvas);
  border-bottom: 1px solid ${rule};
}

.site-header--sticky {
  position: sticky;
  top: 0;
  background: color-mix(in srgb, var(--color-surface-raised) 92%, transparent);
  box-shadow: ${headerLift};
}

.brand {
  font-weight: var(--weight-heading-max);
  color: var(--color-brand-text);
}

.brand:hover,
a:hover {
  color: var(--color-brand-hover);
}

.site-nav__link {
  min-height: var(--tap-target);
  display: inline-flex;
  align-items: center;
  font-size: var(--text-small-size);
  transition: color var(--duration-fast) var(--easing);
}

/*
 * A touch target is a measurement, and the buttons on this page take it from
 * the accessibility decision rather than from a 44px constant this file would
 * have to keep in step with it.
 */
.button {
  min-height: var(--tap-target);
  gap: var(--space-3xs);
  border-radius: var(--radius-sm);
  font-weight: var(--weight-heading-max);
  transition:
    background-color var(--duration-fast) var(--easing),
    border-color var(--duration-fast) var(--easing),
    transform var(--duration-fast) var(--easing);
}

/*
 * A label on the accent fill takes the foreground computed *for the accent*.
 *
 * The base sheet reuses the brand's foreground here, which is a different
 * colour on every direction whose accent hue is shifted from its brand hue —
 * and on the shifted ones it measures below the contrast target the design
 * promised.
 */
.button:hover {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-on-accent);
}
${personality.mood.formality === 'casual' ? `
.button {
  border-radius: var(--radius-pill);
}
` : ''}${lifts ? `
.button:hover {
  transform: translateY(-2px);
}
` : ''}
/* Focus ------------------------------------------------------------ */

${accessibility.focusStyle === 'ring' ? `:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-canvas), 0 0 0 6px var(--color-accent);
  border-radius: var(--radius-sm);
}` : `:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}`}

${accessibility.targetLevel === 'AAA' ? `.section__body a,
.detail-list a,
.site-footer a {
  text-decoration: underline;
}` : `.section__body a,
.detail-list a {
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
}`}

/* ------------------------------------------------------------------ */
/* Typography hierarchy                                                */
/* ------------------------------------------------------------------ */

/*
 * Ten steps were computed and four were used. The six below are what turn a
 * page into a hierarchy: an eyebrow that is noticed and not read, a card title
 * that is not an h2 in disguise, a caption that recedes.
 */
.eyebrow {
  margin: 0 0 var(--space-xs);
  font-family: var(--font-heading);
  font-size: var(--text-eyebrow-size);
  line-height: var(--text-eyebrow-height);
  font-weight: var(--text-eyebrow-weight);
  letter-spacing: var(--text-eyebrow-tracking, 0.08em);
  color: var(--color-brand-text);
}

${personality.mood.formality === 'formal' ? `.eyebrow {
  text-transform: uppercase;
}` : personality.mood.formality === 'casual' ? `.eyebrow {
  text-transform: none;
  letter-spacing: 0.01em;
}` : `.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.06em;
}`}

.card__title,
.feature__title,
.timeline__title,
.alternating__text h3,
.site-footer__title {
  margin: 0 0 var(--space-2xs);
  font-family: var(--font-heading);
  font-size: var(--text-h4-size);
  line-height: var(--text-h4-height);
  font-weight: var(--text-h4-weight);
  letter-spacing: var(--text-h4-tracking, normal);
  color: var(--color-heading);
}

.card__text,
.feature__text,
.detail-list__value,
.quote__source {
  font-size: var(--text-small-size);
  line-height: var(--text-small-height);
  font-weight: var(--text-small-weight);
  color: var(--color-text-muted);
}

.gallery figcaption {
  font-size: var(--text-caption-size);
  line-height: var(--text-caption-height);
  font-weight: var(--text-caption-weight);
  letter-spacing: var(--text-caption-tracking, normal);
  color: var(--color-text-muted);
}

body {
  font-weight: var(--text-body-weight);
}

h1, h2, h3, h4 {
  color: var(--color-heading);
}

h3 {
  letter-spacing: var(--text-h3-tracking, normal);
}

h4 {
  font-size: var(--text-h4-size);
  line-height: var(--text-h4-height);
  font-weight: var(--text-h4-weight);
}

.site-footer__title {
  font-weight: var(--weight-heading-min);
}

/*
 * The rule under a section head is set by the heading face's character.
 *
 * A serif heading has always been set over a hairline; a display face is strong
 * enough to carry a block; a monospaced one takes a dotted rule. Sans takes
 * none, because a rule under a geometric sans is decoration pretending to be
 * typography.
 */
[data-heading-character="serif"] .section__head::after {
  content: "";
  display: block;
  width: 100%;
  margin-top: var(--space-sm);
  border-top: 1px solid ${rule};
}

[data-heading-character="display"] .section__head::after {
  content: "";
  display: block;
  width: 3.5rem;
  margin-top: var(--space-sm);
  border-top: 4px solid var(--color-brand);
}

[data-heading-character="mono"] .section__head::after {
  content: "";
  display: block;
  width: 100%;
  margin-top: var(--space-sm);
  border-top: 2px dotted ${rule};
}

.section__head {
  margin-bottom: var(--space-lg);
}

.section__head > :last-child {
  margin-bottom: 0;
}

/* ------------------------------------------------------------------ */
/* Density, emphasis and ground                                        */
/* ------------------------------------------------------------------ */

/*
 * Section rhythm is the loudest density signal a page has. The design decides
 * density per section rather than per page, so a lead section breathes and the
 * quiet one after it does not — which is what stops a page reading as a stack
 * of equal blocks.
 *
 * The factors are *relative to this page's own density*, not absolute.
 * \`--space-section\` was already computed from \`personality.density\`, so an
 * absolute multiplier would count it twice — and on an airy direction that is
 * the difference between a spacious page and one where a single line of copy
 * floats in three hundred pixels of nothing.
 */
.section[data-density="airy"] {
  padding-block: calc(var(--space-section) * ${round(1.22 / DENSITY_FACTOR[personality.density])});
}

.section[data-density="balanced"] {
  padding-block: calc(var(--space-section) * ${round(1 / DENSITY_FACTOR[personality.density])});
}

.section[data-density="dense"] {
  padding-block: calc(var(--space-section) * ${round(0.78 / DENSITY_FACTOR[personality.density])});
  --grid-gap: var(--space-sm);
}

.section[data-emphasis="lead"] {
  --grid-gap: var(--space-lg);
}

.section[data-emphasis="quiet"] {
  --grid-gap: var(--space-sm);
}

.section[data-emphasis="quiet"] .section__head h2 {
  font-size: var(--text-h3-size);
  line-height: var(--text-h3-height);
}

.section[data-emphasis="lead"]:not(.section--hero) .section__head h2 {
  font-size: var(--text-h1-size);
  line-height: var(--text-h1-height);
  letter-spacing: var(--text-h1-tracking, normal);
}

/* Ground ----------------------------------------------------------- */

.section[data-bg="canvas"] { background: var(--color-canvas); }
.section[data-bg="subtle"] { background: var(--color-canvas-subtle); }
.section[data-bg="surface"] {
  background: var(--color-surface);
  border-block: 1px solid ${rule};
}

.section[data-bg="brand"] {
  background: var(--color-brand);
  color: var(--color-on-brand);
}

.section[data-bg="inverted"] {
  background: var(--color-inverted);
  color: var(--color-on-inverted);
}

.section[data-bg="brand"] h1,
.section[data-bg="brand"] h2,
.section[data-bg="brand"] h3,
.section[data-bg="brand"] .eyebrow,
.section[data-bg="brand"] .section__subheading,
.section[data-bg="inverted"] h1,
.section[data-bg="inverted"] h2,
.section[data-bg="inverted"] h3,
.section[data-bg="inverted"] .eyebrow,
.section[data-bg="inverted"] .section__subheading {
  color: inherit;
}

.section[data-bg="brand"] .button,
.section[data-bg="inverted"] .button {
  background: var(--color-on-brand);
  border-color: var(--color-on-brand);
  color: var(--color-brand);
}

/* A bleeding section keeps its copy measured and lets only its media out. */
.container--wide {
  max-width: var(--container-wide);
}

/* Specificity, not order: the per-section density rule is also two selectors. */
.section.section--bleed {
  padding-block: var(--space-4xl);
}

.section--bleed .section__head,
.section--bleed .section__body {
  max-width: var(--measure);
  margin-inline: auto;
}

/* ------------------------------------------------------------------ */
/* Frames — the envelope around a variant                              */
/* ------------------------------------------------------------------ */

/*
 * The axis that stops a page being one silhouette repeated.
 *
 * Every section used to be head-above-content-full-width, so six sections were
 * six identical shapes down the left edge however different their variants
 * were. A frame moves the head instead of the items, which is the relationship
 * a reader actually perceives as "a different kind of section".
 *
 * Below the medium breakpoint every frame collapses to stacked, because on a
 * phone there is one column and a rail beside it is not one of the choices.
 */

.frame--stacked > .section__head {
  margin-bottom: var(--space-lg);
}

.frame--centered {
  text-align: center;
}

.frame--centered > .section__head,
.frame--centered > .section__body {
  margin-inline: auto;
}

.frame--centered .section__head::after {
  margin-inline: auto;
}

.frame--centered .section__actions {
  display: flex;
  justify-content: center;
}

@media (min-width: ${round(mdRem)}rem) {
  /*
   * aside: the head in a narrow rail, held in place while the content passes.
   *
   * The stick is what makes it read as a rail rather than as a short first
   * column — a heading that scrolls out of the top of its own section is a
   * two-column layout, not an aside. \`align-self: start\` is required for it:
   * a grid item stretches by default and a stretched item has nothing to stick
   * within.
   */
  .frame--aside {
    display: grid;
    grid-template-columns: minmax(0, 0.72fr) minmax(0, 1.68fr);
    gap: var(--space-2xl);
    align-items: start;
  }

  .frame--aside .frame__head {
    position: sticky;
    top: var(--space-xl);
    align-self: start;
  }

  /*
   * The content column starts level with the head, not a gap below it.
   *
   * Grids, lists and the contact block all carry a \`margin-top\` sized to
   * separate them from a heading directly above — which is the stacked case.
   * Beside a head there is nothing above them to separate from, and the margin
   * showed up as a hundred-point drop between "Contact" and the address.
   */
  .frame--aside .frame__content > :first-child,
  .frame--offset .frame__content > :first-child {
    margin-top: 0;
  }

  .frame--aside .section__head {
    margin-bottom: var(--space-md);
  }

  .frame--aside .section__head::after {
    width: 100%;
  }

  /*
   * offset: the head indented, the content starting past it and running out.
   *
   * The asymmetry is the point — the content block is wider than the container's
   * centre line and its left edge does not agree with the head's, which is the
   * cheapest way a layout signals that somebody positioned it.
   */
  .frame--offset {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2.4fr);
    column-gap: var(--space-xl);
    row-gap: var(--space-lg);
  }

  .frame--offset .frame__head {
    grid-column: 1 / span 2;
    max-width: 34ch;
  }

  .frame--offset .frame__content {
    grid-column: 2 / span 1;
    margin-right: calc(var(--space-2xl) * -1);
  }

  .frame--offset .section__head::after {
    width: 100%;
  }

  .frame--centered > .section__head,
  .frame--centered > .section__body {
    max-width: 46ch;
  }
}

/* Statement -------------------------------------------------------- */

/*
 * A section that has one thing to say, set as one thing.
 *
 * The heading drops to the eyebrow step and becomes a label in the margin; the
 * sentence takes the h3 size and carries the section. A location that is an
 * address and a about-us that is a sentence stop being display headings over
 * near-empty bands and become what they are.
 */
.section[data-frame="statement"] {
  padding-block: calc(var(--space-section) * 0.5);
}

.statement {
  display: grid;
  gap: var(--space-sm);
}

.statement__label h1,
.statement__label h2 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: var(--text-eyebrow-size);
  line-height: var(--text-eyebrow-height);
  font-weight: var(--weight-heading-max);
  letter-spacing: var(--text-eyebrow-tracking, 0.08em);
  text-transform: uppercase;
  color: var(--color-brand-text);
}

.statement__line p {
  margin: 0;
  max-width: 34ch;
  font-family: var(--font-heading);
  font-size: var(--text-h3-size);
  line-height: var(--text-h3-height);
  font-weight: var(--weight-heading-min);
  letter-spacing: var(--text-h3-tracking, normal);
  color: var(--color-heading);
}

.statement__line > :last-child {
  margin-bottom: 0;
}

@media (min-width: ${round(mdRem)}rem) {
  .statement {
    grid-template-columns: minmax(0, 0.72fr) minmax(0, 2.4fr);
    gap: var(--space-xl);
    align-items: baseline;
  }
}

/* ------------------------------------------------------------------ */
/* Grid engine                                                         */
/* ------------------------------------------------------------------ */

/*
 * One engine, five consumers. Columns come from the design as an inline
 * --columns; the breakpoints it steps at come from ResponsiveSystem, so a
 * design that widens its medium breakpoint moves every grid on the page.
 */
.card-grid,
.feature-grid,
.bento,
.quote-list,
.gallery--grid,
.gallery--collage {
  display: grid;
  grid-template-columns: repeat(var(--mobile-columns), minmax(0, 1fr));
  gap: var(--grid-gap);
  margin: var(--space-lg) 0 0;
  padding: 0;
  list-style: none;
}

@media (min-width: ${round(smRem)}rem) {
  .card-grid,
  .feature-grid,
  .quote-list,
  .gallery--grid,
  .gallery--collage {
    grid-template-columns: repeat(min(var(--columns, 2), 2), minmax(0, 1fr));
  }
}

@media (min-width: ${round(mdRem)}rem) {
  .card-grid,
  .feature-grid,
  .quote-list,
  .gallery--grid,
  .gallery--collage {
    grid-template-columns: repeat(var(--columns, 3), minmax(0, 1fr));
  }

  .bento {
    grid-template-columns: repeat(var(--columns, 3), minmax(0, 1fr));
    grid-auto-rows: minmax(9rem, auto);
  }
}

@media (min-width: ${round(lgRem)}rem) {
  .section--bleed .gallery {
    gap: calc(var(--grid-gap) * 1.5);
  }
}

/* ------------------------------------------------------------------ */
/* Hero variants                                                       */
/* ------------------------------------------------------------------ */

.hero {
  display: grid;
  gap: var(--space-lg);
  align-items: center;
}

.hero__content {
  display: grid;
  gap: var(--space-md);
}

.hero__content > :last-child,
.hero__support > :last-child {
  margin-bottom: 0;
}

.hero__headline > :last-child,
.hero__support > * {
  margin-bottom: 0;
}

.hero__support {
  display: grid;
  gap: var(--space-sm);
  align-content: start;
  max-width: var(--measure);
}

.section--hero h1 {
  margin: 0;
  font-size: var(--text-display-size);
  line-height: var(--text-display-height);
  font-weight: var(--text-display-weight);
  letter-spacing: var(--text-display-tracking, normal);
  /*
   * A display line is measured in characters, not in the body's measure.
   *
   * At the display step 62ch is nine hundred points of heading and a line that
   * breaks after seven words; the measure token was built for prose and applying
   * it to type six times the size is what made every hero either one enormous
   * line or four ragged ones. Around twenty characters is where a display
   * setting breaks the way a person would break it.
   */
  max-width: 20ch;
  /* Even lines, so a three-word headline never leaves one word on line two. */
  text-wrap: balance;
}

/*
 * A text-only hero sets its headline and its lede side by side.
 *
 * Stacked, the two leave the right half of the first screen empty on every
 * direction that leads with type — which is five of the eleven. Beside each
 * other they compose, and the asymmetric split is what stops the result reading
 * as two equal columns.
 */
@media (min-width: ${round(mdRem)}rem) {
  .hero--minimal .hero__content,
  .hero--editorial .hero__content,
  .hero--centered .hero__content {
    gap: var(--space-xl);
  }

  /*
   * The headline gets nearly two thirds.
   *
   * At 1.5fr the display step — which on a dramatic scale is around 135px —
   * had about three characters of room per line, and "Advice you can act on"
   * set five lines deep. The lede needs a measure, not a half of the page.
   */
  .hero--minimal .hero__content,
  .hero--editorial .hero__content {
    grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr);
    align-items: end;
  }

  /*
   * Beside a lede the headline has less room, but not much less.
   *
   * At thirteen characters "Advice you can act on" set five lines deep and read
   * as a ransom note. The column already constrains it; this only stops a short
   * headline from running the full width of a 1.5fr track.
   */
  .hero--minimal h1,
  .hero--editorial h1 {
    max-width: 17ch;
  }

  .hero--minimal .hero__support,
  .hero--editorial .hero__support {
    padding-bottom: var(--space-2xs);
  }
}

.hero__media img {
  width: 100%;
  aspect-ratio: var(--hero-aspect);
  object-fit: cover;
  border-radius: var(--image-radius);
  filter: var(--image-filter);
  box-shadow: var(--shadow-lg);
}

/* centered: type on the axis, media as a band beneath it. */
.hero--centered {
  justify-items: center;
  text-align: center;
}

.hero--centered .hero__content {
  max-width: var(--measure);
}

.hero--centered .section__actions {
  display: flex;
  justify-content: center;
}

.hero__media--band img {
  aspect-ratio: var(--hero-aspect);
}

/* split: copy and photograph side by side, copy leading. */
.hero--split {
  align-items: center;
}

/* editorial: a display line over a narrow measure, media demoted to a column. */
.hero--editorial {
  align-items: end;
}

.hero--editorial .hero__content {
  max-width: var(--measure);
}

.hero--editorial .hero__media--column img {
  aspect-ratio: 3 / 4;
}

/* image-first: the photograph is the opening statement. */
.hero--image-first .hero__media {
  order: -1;
}

.hero--image-first .hero__content {
  max-width: var(--measure);
}

@media (min-width: ${round(mdRem)}rem) {
  .hero--split {
    grid-template-columns: 1.05fr 0.95fr;
  }

  .hero--editorial {
    grid-template-columns: 1.6fr 0.8fr;
  }

  .hero--magazine {
    grid-template-columns: 0.9fr 1.1fr;
    align-items: center;
  }
}

/*
 * full-bleed: type over the photograph.
 *
 * The backdrop is positioned against the *section*, not against the measured
 * container, which is the whole difference between a full-bleed hero and a
 * boxed one. The scrim is its own element at the opacity ImageStrategy
 * specified, so the contrast the design promised survives whatever the
 * photograph turns out to be.
 */
.section--hero-full-bleed {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--color-inverted);
}

/*
 * Anchored to the bottom, not centred.
 *
 * A centred block in a 58vh band left the photograph's top third empty above the
 * type and its bottom third empty below, which reads as a caption floating in a
 * grey field rather than as a hero. Type sitting on the floor of the image is
 * the convention every editorial cover uses, and it is what gives the scrim
 * somewhere to be — a gradient that is dense where the words are and clear where
 * the picture is.
 */
.hero--full-bleed {
  min-height: min(78vh, 46rem);
  align-content: end;
  padding-block: var(--space-3xl) var(--space-2xl);
  color: var(--color-on-inverted);
}

.hero--full-bleed .hero__backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.hero--full-bleed .hero__content {
  position: relative;
  z-index: 1;
}

.hero--full-bleed .hero__backdrop img,
.hero--full-bleed .hero__backdrop .media-fill {
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  object-fit: cover;
  border-radius: 0;
  filter: var(--image-filter);
}

/*
 * Dense at the floor, clear at the top.
 *
 * The old scrim was a diagonal wash at a flat opacity across the whole frame: it
 * dimmed the photograph everywhere and still left the type sitting on whatever
 * happened to be behind it. Running it bottom-up buys the contrast exactly where
 * the words are and gives the picture its own top two thirds back.
 */
.hero--full-bleed .hero__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      to top,
      color-mix(in srgb, var(--color-inverted) 92%, transparent) 0%,
      color-mix(in srgb, var(--color-inverted) 62%, transparent) 38%,
      color-mix(in srgb, var(--color-inverted) 12%, transparent) 78%,
      transparent 100%
    ),
    linear-gradient(
      ${personality.mood.temperature === 'warm' ? '100deg' : '260deg'},
      color-mix(in srgb, var(--color-inverted) 55%, transparent) 0%,
      transparent 60%
    );
  opacity: calc(0.55 + var(--overlay-opacity) * 0.45);
}

.hero--full-bleed h1,
.hero--full-bleed .eyebrow,
.hero--full-bleed .section__subheading,
.hero--full-bleed .section__body {
  color: var(--color-on-inverted);
}

.hero--full-bleed .hero__content {
  max-width: var(--measure);
}

/* magazine: copy in one cell, a mosaic of photographs in the rest. */
.hero--magazine .hero__mosaic {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
}

.hero--magazine .hero__tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--image-radius);
  filter: var(--image-filter);
}

.hero--magazine .hero__tile--0 {
  grid-column: span 2;
  aspect-ratio: var(--hero-aspect);
}

.hero--magazine .hero__tile--1,
.hero--magazine .hero__tile--2 {
  aspect-ratio: 1 / 1;
}

/* minimal: type and nothing else, deliberately. */
.hero--minimal .hero__content {
  max-width: var(--measure);
}

/* ------------------------------------------------------------------ */
/* Section variants                                                    */
/* ------------------------------------------------------------------ */

/* Cards ------------------------------------------------------------ */

/*
 * Padding at \`lg\`, not \`md\`.
 *
 * A card is a piece of paper, and the whole reason it reads as one is the air
 * between its edge and its type. At \`md\` the title sat about eighteen points
 * from the border on every direction, which is close enough that the border
 * reads as a box drawn around some text — the tell that separates a designed
 * card from a \`<div>\` with a stroke.
 */
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  padding: var(--space-lg) var(--space-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  ${cardDepth}
  transition:
    box-shadow var(--duration-base) var(--easing),
    border-color var(--duration-base) var(--easing),
    transform var(--duration-base) var(--easing);
}

/* The detail is what the card is for; it should not read as a footnote. */
.card__text,
.feature__text {
  margin-top: var(--space-3xs);
}

.card:hover {
  ${cardHoverDepth}${lifts ? `
  transform: translateY(-3px);` : ''}
}

.card > :last-child {
  margin-bottom: 0;
}

/* Bento ------------------------------------------------------------ */

/*
 * The leading cell is tinted from the ramp rather than filled with the brand.
 *
 * A mid-low ramp step is the right weight for a surface that should read as
 * brand-coloured without competing with the button beside it — which is the
 * whole reason a twelve-step ramp exists rather than one brand colour.
 */
.bento__cell {
  justify-content: flex-end;
}

.bento__cell--wide {
  background: var(--primary-2);
}

@media (min-width: ${round(mdRem)}rem) {
  .bento__cell--wide { grid-column: span 2; }
  .bento__cell--tall { grid-row: span 2; }

  .bento__cell--wide .card__title,
  .bento__cell--tall .card__title {
    font-size: var(--text-h3-size);
    line-height: var(--text-h3-height);
  }
}

/* Feature grid ----------------------------------------------------- */

/*
 * A hairline, and the index carries the brand.
 *
 * This was a 2px brand-coloured rule over every cell. With six features that is
 * six heavy brand rules in one band — the colour stops being an accent and
 * becomes the section's background noise. One rule the width of the column, plus
 * a brand-coloured index above it, says the same thing once.
 */
.feature {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  padding-top: var(--space-sm);
  border-top: 1px solid ${rule};
}

.feature .index {
  margin-bottom: var(--space-xs);
}

/* Timeline --------------------------------------------------------- */

.timeline {
  margin: var(--space-lg) 0 0;
  padding: 0 0 0 var(--space-lg);
  list-style: none;
  border-left: 2px solid var(--primary-6);
}

.timeline__step {
  position: relative;
  padding-bottom: var(--space-lg);
  padding-left: var(--space-md);
}

.timeline__step:last-child {
  padding-bottom: 0;
}

.timeline__marker {
  position: absolute;
  left: calc(var(--space-lg) * -1 - 1px);
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-pill);
  background: var(--color-brand);
  color: var(--color-on-brand);
  font-family: var(--font-heading);
  font-size: var(--text-caption-size);
  font-weight: var(--weight-heading-max);
}

/* Split ------------------------------------------------------------ */

.split {
  display: grid;
  gap: var(--space-xl);
  align-items: start;
}

.split__media img {
  width: 100%;
  aspect-ratio: var(--gallery-aspect);
  object-fit: cover;
  border-radius: var(--image-radius);
  filter: var(--image-filter);
}

.split__media {
  margin: 0;
}

.split__media figcaption {
  margin-top: var(--space-xs);
  font-size: var(--text-caption-size);
  color: var(--color-text-muted);
}

@media (min-width: ${round(mdRem)}rem) {
  .split {
    grid-template-columns: repeat(var(--columns, 2), minmax(0, 1fr));
  }
}

/* Detail list ------------------------------------------------------ */

/*
 * The layout that makes a menu read as a menu.
 *
 * A price set right against a leader is a four-hundred-year-old convention and
 * the single strongest signal that a page belongs to a restaurant rather than
 * to a consultancy — and it costs one grid rule, not a bespoke section type.
 */
.detail-list {
  margin: var(--space-lg) 0 0;
  padding: 0;
  list-style: none;
}

.detail-list__row {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  padding-block: var(--space-sm);
  border-bottom: 1px solid ${rule};
}

.detail-list__row:last-child {
  border-bottom: 0;
}

.detail-list__label {
  font-family: var(--font-heading);
  font-weight: var(--weight-heading-min);
  color: var(--color-heading);
}

.detail-list__row--split .detail-list__label::after {
  content: "";
  flex: 1;
  min-width: var(--space-md);
  margin-inline: var(--space-xs);
  border-bottom: 1px dotted ${rule};
  transform: translateY(-0.25em);
}

.detail-list__row--split .detail-list__label {
  display: flex;
  flex: 1;
  align-items: baseline;
}

.detail-list__value--figure {
  font-variant-numeric: tabular-nums;
  color: var(--color-brand-text);
  font-weight: var(--weight-heading-max);
}

.detail-list--faq .detail-list__row {
  display: block;
}

.detail-list--faq .detail-list__value {
  display: block;
  margin-top: var(--space-2xs);
}

/* Quotes ----------------------------------------------------------- */

/*
 * A testimonial is somebody's words, so it is set as words.
 *
 * It was a grey rounded box with a big translucent quotation mark parked in the
 * corner — the decoration was the loudest thing in it, and one testimonial in a
 * full-width grey slab is the single most template-looking block a small
 * business site can carry. Here the words take the h3 step in the heading face
 * and the box goes away; a rule and an attribution do the rest.
 */
.quote {
  position: relative;
  margin: 0;
  padding: var(--space-md) 0 0;
  /* Reset first: the base sheet draws a full box, and setting only the top
     edge here would leave the other three sides of it on the page. */
  border: 0;
  border-top: 1px solid ${rule};
  border-radius: 0;
  background: none;
  box-shadow: none;
}

.quote blockquote {
  margin: 0;
  font-family: var(--font-heading);
  font-size: var(--text-h4-size);
  line-height: var(--text-h3-height);
  font-weight: var(--weight-heading-min);
  letter-spacing: var(--text-h4-tracking, normal);
  color: var(--color-heading);
  text-wrap: pretty;
}

.quote blockquote p {
  margin: 0 0 var(--space-xs);
}

.quote blockquote > :last-child {
  margin-bottom: 0;
}

/*
 * The attribution reads as a byline: a short brand-coloured rule, then the name.
 *
 * An em dash before a name is what a pull quote has always used, and it costs a
 * pseudo-element rather than a character the writer has to remember to type.
 */
.quote__source {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  margin-top: var(--space-md);
  font-style: normal;
  font-size: var(--text-caption-size);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.quote__source::before {
  content: "";
  flex: none;
  width: 1.5rem;
  border-top: 1px solid var(--color-brand);
}

/* A single testimonial is a pull quote, so it is set like one. */
.quote-list:not([style*="--columns"]) .quote blockquote,
.quote-list .quote:only-child blockquote {
  font-size: var(--text-h3-size);
  max-width: 26ch;
}

/* Alternating ------------------------------------------------------ */

.alternating {
  display: grid;
  gap: var(--space-xl);
  margin: var(--space-lg) 0 0;
  padding: 0;
  list-style: none;
}

.alternating__row {
  display: grid;
  gap: var(--space-lg);
  align-items: center;
}

.alternating__media img,
.alternating__media .media-fill {
  width: 100%;
  aspect-ratio: var(--gallery-aspect);
  object-fit: cover;
  border-radius: var(--image-radius);
  filter: var(--image-filter);
}

@media (min-width: ${round(mdRem)}rem) {
  .alternating__row {
    grid-template-columns: 1fr 1fr;
  }

  .alternating__row:nth-child(even) .alternating__media {
    order: 2;
  }
}

/* Editorial -------------------------------------------------------- */

.editorial {
  display: grid;
  gap: var(--space-lg);
}

.editorial__head {
  align-self: start;
}

@media (min-width: ${round(mdRem)}rem) {
  .editorial {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.6fr);
    gap: var(--space-2xl);
  }

  .editorial__head .section__head::after {
    width: 100%;
  }
}

/* Rail: carousel and slider ---------------------------------------- */

.rail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(15rem, 40%);
  gap: var(--grid-gap);
  margin: var(--space-lg) 0 0;
  padding: 0 0 var(--space-sm);
  list-style: none;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
}

.rail__item {
  scroll-snap-align: start;
}

.rail--media .rail__item figure {
  margin: 0;
}

.rail--media img {
  width: 100%;
  aspect-ratio: var(--gallery-aspect);
  object-fit: cover;
  border-radius: var(--image-radius);
  filter: var(--image-filter);
}

.rail--media figcaption {
  margin-top: var(--space-xs);
  font-size: var(--text-caption-size);
  color: var(--color-text-muted);
}

/* Banner ----------------------------------------------------------- */

.banner {
  display: grid;
  justify-items: center;
  gap: var(--space-sm);
  text-align: center;
}

.banner .section__body,
.banner .section__head {
  max-width: var(--measure);
}

.banner .section__head::after {
  margin-inline: auto;
}

/* ------------------------------------------------------------------ */
/* Gallery layouts                                                     */
/* ------------------------------------------------------------------ */

.gallery {
  margin: var(--space-lg) 0 0;
  padding: 0;
  list-style: none;
}

.gallery figure {
  margin: 0;
}

.gallery img {
  width: 100%;
  aspect-ratio: var(--gallery-aspect);
  object-fit: cover;
  border-radius: var(--image-radius);
  filter: var(--image-filter);
  transition: transform var(--duration-slow) var(--easing);
}

${lifts ? `.gallery__item:hover img {
  transform: scale(1.02);
}
` : ''}
.gallery figcaption {
  margin-top: var(--space-xs);
}

/*
 * A grid with a rhythm rather than a contact sheet.
 *
 * Six photographs at one aspect ratio in three equal columns is what a folder
 * listing looks like, and it was what every gallery on every generated site
 * looked like — the single clearest "template" signal after the repeated section
 * silhouette. Giving the first frame two columns and alternating the proportion
 * of the rest costs nothing, invents nothing, and turns the same six files into
 * a composition.
 *
 * Positional and fixed, not random: the emphasis has to fall in the same place
 * every time the same content renders, or the layout is noise rather than a
 * decision. \`--gallery-aspect\` still supplies the base, so a direction that
 * asked for portraits still gets portraits — taller and shorter ones.
 */
@media (min-width: ${round(mdRem)}rem) {
  .gallery--grid {
    /* Dense, so a span that will not fit a row is backfilled rather than
       leaving the hole that makes an asymmetric grid look broken. */
    grid-auto-flow: row dense;
    grid-auto-rows: minmax(6.5rem, auto);
  }

  .gallery--grid .gallery__item {
    grid-row: span 3;
  }

  .gallery--grid .gallery__item--0 {
    grid-column: span 2;
    grid-row: span 4;
  }

  .gallery--grid .gallery__item--4 {
    grid-row: span 4;
  }

  /*
   * The frame takes the cell; the photograph takes what the caption leaves.
   *
   * A fixed aspect ratio cannot coexist with a row span — one of the two has to
   * decide the height, and here it is the grid, so the images crop to the
   * composition rather than the composition stretching to the images.
   */
  .gallery--grid .gallery__item,
  .gallery--grid .gallery__item figure {
    height: 100%;
  }

  .gallery--grid .gallery__item figure {
    display: flex;
    flex-direction: column;
  }

  .gallery--grid .gallery__item img {
    flex: 1;
    min-height: 0;
    aspect-ratio: auto;
    object-fit: cover;
  }
}

/*
 * Masonry, by columns rather than by grid.
 *
 * A column layout is the only masonry that keeps the images at their own
 * proportions, which is the entire reason a direction asks for one — a grid
 * masonry with a fixed aspect ratio is a grid.
 */
.gallery--masonry {
  display: block;
  columns: var(--mobile-columns);
  column-gap: var(--grid-gap);
}

.gallery--masonry .gallery__item {
  break-inside: avoid;
  margin-bottom: var(--grid-gap);
}

.gallery--masonry img {
  aspect-ratio: auto;
}

@media (min-width: ${round(smRem)}rem) {
  .gallery--masonry { columns: 2; }
}

@media (min-width: ${round(mdRem)}rem) {
  .gallery--masonry { columns: var(--columns, 3); }
}

/* Collage: one image leads and the rest fill around it. */
@media (min-width: ${round(mdRem)}rem) {
  .gallery--collage .gallery__item--0 {
    grid-column: span 2;
    grid-row: span 2;
  }

  .gallery--collage .gallery__item--0 img {
    height: 100%;
    aspect-ratio: auto;
  }

  .gallery--collage .gallery__item--3 {
    grid-column: span 2;
  }
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

/*
 * Set in the heading face, not drawn from a border.
 *
 * The previous mark was a square or a circle made out of \`border\`, and at any
 * size it read as an unticked checkbox rather than as a bullet — a services
 * grid looked like a form nobody had filled in. An index is the oldest way an
 * editorial page enumerates a set: it gives the grid a scan order, it belongs to
 * the type system rather than sitting outside it, and it cannot be mistaken for
 * a control.
 *
 * IconSystem still decides. \`none\` emits no element at all, and the three
 * styles differ in weight and rule the way the direction that chose them does.
 */
.index {
  display: block;
  margin-bottom: var(--space-2xs);
  font-family: var(--font-heading);
  /*
   * A floor, because the caption step is not always a readable size.
   *
   * On a dramatic scale — 1.414 and up — the caption step lands near 0.6rem,
   * which is about ten pixels. Two digits at ten pixels do not read as an
   * index; they read as dirt on the screen, which is what they looked like on
   * every luxury and editorial page. The scale still decides, but not below
   * where the mark stops being legible.
   */
  font-size: max(0.8125rem, var(--text-caption-size));
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
  color: var(--color-brand-text);
}

.index--line {
  font-weight: var(--weight-heading-min);
  padding-bottom: var(--space-3xs);
  border-bottom: var(--icon-stroke) solid var(--color-brand);
  /* Only as wide as the two digits: a full-width rule is a divider, not a mark. */
  width: max-content;
}

.index--solid {
  font-weight: var(--weight-heading-max);
}

.index--duotone {
  font-weight: var(--weight-heading-max);
  padding: var(--space-3xs) var(--space-2xs);
  width: max-content;
  border-radius: ${iconRadius};
  background: color-mix(in srgb, var(--color-brand) 12%, transparent);
}

/* A cell the design gave extra span gets an index sized to match its title. */
.bento__cell--wide .index,
.bento__cell--tall .index {
  font-size: var(--text-small-size);
}

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */

/*
 * The one block on the page a visitor came to use.
 *
 * It rendered as bordered grey rows that looked like disabled form fields, with
 * the address and the telephone number as plain text — the most useful line on
 * the site was the one thing on it that could not be clicked. Set large, in the
 * heading face, as links.
 */
.contact-block {
  display: grid;
  gap: var(--space-lg);
  margin: var(--space-lg) 0 0;
  padding: 0;
  list-style: none;
}

.contact-block__row {
  display: grid;
  gap: var(--space-3xs);
}

.contact-block__caption {
  font-size: var(--text-caption-size);
  line-height: var(--text-caption-height);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.contact-block__value {
  font-family: var(--font-heading);
  font-size: var(--text-h4-size);
  line-height: var(--text-h4-height);
  font-weight: var(--weight-heading-min);
  letter-spacing: var(--text-h4-tracking, normal);
  color: var(--color-heading);
  text-decoration: none;
  word-break: break-word;
}

a.contact-block__value {
  border-bottom: 1px solid color-mix(in srgb, var(--color-brand) 45%, transparent);
  padding-bottom: 0.08em;
  transition: border-color var(--duration-fast) var(--easing), color var(--duration-fast) var(--easing);
}

a.contact-block__value:hover {
  color: var(--color-brand-text);
  border-bottom-color: var(--color-brand);
}

@media (min-width: ${round(smRem)}rem) {
  .contact-block {
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-lg) var(--space-xl);
  }
}

/* ------------------------------------------------------------------ */
/* Media fallback                                                      */
/* ------------------------------------------------------------------ */

/*
 * What an image-led layout shows when the profile supplied no photograph.
 *
 * Not decoration: an image-first hero with nothing in its media column is a
 * page that looks broken rather than a page that looks image-free, and
 * ImageStrategy.fallback is the design's decision about which of the four
 * answers to that this site takes.
 */
.media-fill {
  width: 100%;
  aspect-ratio: var(--hero-aspect);
  border-radius: var(--image-radius);
}

.media-fill--solid {
  background: var(--color-canvas-subtle);
  border: 1px solid ${rule};
}

.media-fill--gradient {
  background: linear-gradient(
    ${personality.mood.temperature === 'warm' ? '135deg' : '215deg'},
    var(--color-brand) 0%,
    var(--color-accent) 100%
  );
  opacity: 0.85;
}

.media-fill--pattern {
  background-color: var(--color-canvas-subtle);
  background-image: repeating-linear-gradient(
    45deg,
    var(--primary-4) 0 0.5rem,
    transparent 0.5rem 1rem
  );
}

.media-fill--panel {
  aspect-ratio: var(--gallery-aspect);
}

/* ------------------------------------------------------------------ */
/* Footer variants                                                     */
/* ------------------------------------------------------------------ */

.site-footer {
  padding-block: var(--space-xl);
  background: var(--color-canvas-subtle);
  border-top: 1px solid ${rule};
  color: var(--color-text-muted);
  font-size: var(--text-small-size);
}

.site-footer__grid {
  display: grid;
  gap: var(--space-lg);
  grid-template-columns: repeat(var(--mobile-columns), minmax(0, 1fr));
}

.site-footer__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: var(--space-2xs);
}

.site-footer__name {
  font-family: var(--font-heading);
  font-size: var(--text-h4-size);
  font-weight: var(--weight-heading-max);
  color: var(--color-heading);
  margin: 0 0 var(--space-2xs);
}

.site-footer .site-nav__list {
  display: grid;
  gap: var(--space-2xs);
}

.site-footer__colophon {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
  padding-top: var(--space-md);
  border-top: 1px solid ${rule};
  font-size: var(--text-caption-size);
}

/*
 * The minimal footer, given something to be minimal about.
 *
 * It rendered as two grey sentences at caption size — not restraint, just the
 * end of the document. The name takes the heading face at the h4 step and the
 * tagline sits under it at the measure, which is the same amount of information
 * arranged so the page closes rather than stops.
 */
.site-footer--minimal .site-footer__inner {
  display: grid;
  gap: var(--space-2xs);
  padding-top: var(--space-lg);
  border-top: 1px solid ${rule};
}

.site-footer--minimal .site-footer__inner > p:first-child {
  margin: 0;
  font-family: var(--font-heading);
  font-size: var(--text-h4-size);
  line-height: var(--text-h4-height);
  font-weight: var(--weight-heading-max);
  letter-spacing: var(--text-h4-tracking, normal);
  color: var(--color-heading);
}

.site-footer--minimal .site-footer__inner > p + p {
  margin: 0;
  max-width: var(--measure);
}

@media (min-width: ${round(smRem)}rem) {
  .site-footer--minimal .site-footer__inner {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: baseline;
    gap: var(--space-lg);
  }

  .site-footer--minimal .site-footer__inner > p + p {
    text-align: right;
  }
}

.site-footer--rich {
  background: var(--color-inverted);
  color: var(--color-on-inverted);
}

.site-footer--rich .site-footer__name,
.site-footer--rich .site-footer__title,
.site-footer--rich a {
  color: inherit;
}

@media (min-width: ${round(smRem)}rem) {
  .site-footer__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: ${round(mdRem)}rem) {
  .site-footer--corporate .site-footer__grid {
    grid-template-columns: 2fr 1fr 1fr;
  }

  .site-footer--rich .site-footer__grid {
    grid-template-columns: 1.6fr repeat(4, minmax(0, 1fr));
  }
}

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

/*
 * The motion budget, spent where it is noticed and nowhere else.
 *
 * No scroll-linked animation: an element that is invisible until it is scrolled
 * past is an element that is invisible to anything that does not scroll — a
 * printer, a crawler, a full-page screenshot. The entry animation runs once on
 * load, and everything else is a transition on something the visitor did.
 */
${animates ? `@keyframes forge-enter {
  from {
    opacity: 0;${motion.effects.includes('rise') ? `
    transform: translateY(1.25rem);` : ''}${motion.effects.includes('scale') ? `
    transform: scale(0.98);` : ''}
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .section--hero .hero__content > *,
  .section--hero .hero__media {
    animation: forge-enter var(--duration-slow) var(--easing) both;
  }
${staggers ? `
  .section--hero .hero__content > *:nth-child(1) { animation-delay: 0ms; }
  .section--hero .hero__content > *:nth-child(2) { animation-delay: calc(var(--duration-fast) * 0.5); }
  .section--hero .hero__content > *:nth-child(3) { animation-delay: var(--duration-fast); }
  .section--hero .hero__content > *:nth-child(4) { animation-delay: calc(var(--duration-fast) * 1.5); }
  .section--hero .hero__content > *:nth-child(5) { animation-delay: calc(var(--duration-fast) * 2); }
` : ''}}
` : '/* This direction spends no motion budget on entry. */'}

a {
  transition: color var(--duration-fast) var(--easing);
}

/* ------------------------------------------------------------------ */
/* Category conventions                                                */
/* ------------------------------------------------------------------ */

/*
 * The one thing the industry decides directly.
 *
 * Everything else about a category reaches the page through the direction, the
 * palette and the section order the design layer already chose — duplicating
 * that knowledge here would give the renderer a second, competing opinion about
 * what a law firm looks like. What it does own is how one section is divided
 * from the next, which is a convention rather than a judgement.
 */
/*
 * A rule between sections that already differ in ground is a rule too many.
 *
 * The backgrounds alternate, so two adjacent sections are already separated —
 * drawing a line as well was belt and braces, and at 3px in the brand colour it
 * turned a gym's page into a stack of banded boxes. Both treatments now apply
 * only where the ground does *not* change, which is where a separator has
 * something to do, and the emphatic one is a short mark rather than a full-width
 * bar.
 */
[data-industry="law"] .section[data-bg="canvas"] + .section[data-bg="canvas"],
[data-industry="professional-services"] .section[data-bg="canvas"] + .section[data-bg="canvas"],
[data-industry="medical"] .section[data-bg="canvas"] + .section[data-bg="canvas"],
[data-industry="dental"] .section[data-bg="canvas"] + .section[data-bg="canvas"] {
  border-top: 1px solid ${rule};
}

[data-industry="construction"] .section + .section,
[data-industry="gym"] .section + .section,
[data-industry="automotive"] .section + .section {
  position: relative;
}

[data-industry="construction"] .section + .section:not([data-bg="brand"])::before,
[data-industry="gym"] .section + .section:not([data-bg="brand"])::before,
[data-industry="automotive"] .section + .section:not([data-bg="brand"])::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 4.5rem;
  border-top: 3px solid var(--color-brand);
}

/* ------------------------------------------------------------------ */
/* Print                                                               */
/* ------------------------------------------------------------------ */

@media print {
  .hero__scrim,
  .media-fill,
  .icon {
    display: none;
  }

  .gallery img,
  .hero__media img {
    filter: none;
  }
}
`;
}
