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

/* ------------------------------------------------------------------ */
/* Grounds and ink                                                     */
/* ------------------------------------------------------------------ */

/**
 * The four text roles a ground has to answer for.
 *
 * Not "a colour": a ground that names only its strongest ink is the bug this
 * type exists to prevent. Every one of these is read by some component that has
 * no idea what band it landed in.
 */
interface Ink {
  readonly text: string;
  readonly heading: string;
  readonly muted: string;
  readonly accent: string;
}

/**
 * A ground and the ink that goes on it, emitted as one declaration.
 *
 * ## Why this is a function and not four rules
 *
 * `.card` painted `--color-surface` and named no ink. Inside a dark band it
 * therefore inherited the band's near-white text and rendered its titles at
 * 1.13:1 — light type on a light card. The menu failed from the other side:
 * `.detail-list__label` hard-coded `--color-heading`, which is the *page's*
 * near-black, and sat on the dark band at 1.23:1. Neither component was wrong
 * about anything it could see. The ground and the ink were simply decided in
 * different places, and nothing made them agree.
 *
 * So they stop being two decisions. Everything that paints a ground calls this,
 * and the ink travels with the paint.
 *
 * ## Why it rebinds the token names rather than introducing new ones
 *
 * The alternative was an `--ink-*` layer that components would read instead.
 * That works only as long as every future component remembers to reach for the
 * new name, and the failure mode when one forgets is exactly the failure being
 * fixed here — silently invisible text. Rebinding the names components already
 * read means a component cannot get this wrong, because it is not being asked
 * anything: `var(--color-heading)` means "the heading ink where I am", which is
 * what it always should have meant.
 *
 * This is the opposite of the `--color-surface` collision recorded in `css.ts`.
 * That name genuinely held two concepts — the page and a card — and the fix was
 * to separate them. This one is a single concept that was being resolved in the
 * wrong scope.
 *
 * Literal values rather than `var()` references, because a ground has to be able
 * to restore the page's ink after a darker band has overridden it, and
 * `--color-text: var(--color-text)` is a cycle rather than a reset.
 */
function ground(background: string | null, ink: Ink): string {
  return [
    ...(background === null ? [] : [`background: ${background};`]),
    `--color-text: ${ink.text};`,
    `--color-heading: ${ink.heading};`,
    // Both names, because the two sheets disagree about what to call it. The
    // base sheet's `.section__subheading` and `figcaption` read `--color-muted`
    // while the design layer's read `--color-text-muted`, and rebinding one of
    // them leaves half the secondary type on the band still set in the other.
    `--color-text-muted: ${ink.muted};`,
    `--color-muted: ${ink.muted};`,
    `--color-brand-text: ${ink.accent};`,
    'color: var(--color-text);',
  ].join('\n  ');
}

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

  /*
   * The three inks this page has, named once.
   *
   * `brand` gets no dimmed role at all, and that is a measurement rather than an
   * oversight: `onBrand` is constructed to clear the body target against the
   * brand fill and lands just above it, so dimming it by even a tenth puts it
   * under. On a brand band the secondary roles are the primary ink — the
   * hierarchy there has to come from size and weight, because the colour has no
   * room left to carry it.
   */
  const pageInk: Ink = {
    text: color.semantic.text,
    heading: color.semantic.heading,
    muted: color.semantic.textMuted,
    accent: color.semantic.brandText,
  };

  const invertedInk: Ink = {
    text: color.semantic.onInverted,
    heading: color.semantic.onInverted,
    muted: color.semantic.onInvertedMuted,
    accent: color.semantic.onInvertedAccent,
  };

  const brandInk: Ink = {
    text: color.semantic.onBrand,
    heading: color.semantic.onBrand,
    muted: color.semantic.onBrand,
    accent: color.semantic.onBrand,
  };

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
/*
 * A hairline above the section head, not under it.
 *
 * Under a 31px heading it read as a divider; under a 36px serif display it read
 * as an *underline*, which is the one thing a rule beneath type must never look
 * like. Above the eyebrow it becomes what it was always meant to be — the line
 * that opens a section in a printed page — and it does a second job the page
 * needed anyway, marking where one band ends and the next begins without
 * another change of ground.
 */
[data-heading-character="serif"] .section__head::before {
  content: "";
  display: block;
  width: 100%;
  margin-bottom: var(--space-lg);
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

/*
 * The signature beat is set larger than anything but the hero.
 *
 * A page with a beginning, a development, a peak and a close only reads that
 * way if the peak is *visibly* the peak. Before this rule the narrative layer
 * nominated a signature moment, the layout gave it \`lead\` emphasis — and it
 * arrived at the same h1 step as the about section three bands above it, while
 * a contact heading elsewhere in the stylesheet was set half again as large.
 * The story was in the artifact and not on the page.
 *
 * Keyed on \`data-role\`, so it applies to whichever kind of section this
 * business's evidence made its signature. Capped against the viewport because
 * the heading is the business's own words and their length is not ours to
 * choose: a fifty-character line at display scale would otherwise fill a
 * screen on its own.
 *
 * The \`:not(.section--hero)\` is not decoration — it is what gives this rule the
 * same specificity as the \`data-emphasis="lead"\` rule above, which a signature
 * beat always also matches. Written without it, the earlier rule won and the
 * page's peak came out at 67px against its reveal section's 62px: a difference
 * nobody can see, on the one decision the whole narrative layer exists to make.
 */
.section[data-role="signature"]:not(.section--hero) .section__head h2 {
  font-size: min(var(--text-display-size), 7.5vw);
  line-height: 1.02;
  letter-spacing: var(--text-display-tracking, -0.02em);
  max-width: 18ch;
}

/* Ground ----------------------------------------------------------- */

/*
 * Five grounds, each carrying its own ink. See \`ground()\`.
 *
 * The list of \`color: inherit\` overrides that used to sit here — headings,
 * eyebrows and subheadings named one by one for the two dark grounds — is gone
 * with it. That list was the workaround: it existed because \`--color-heading\`
 * meant the page's near-black even on a black band, so every element that read
 * it had to be individually told not to. It also only ever covered the elements
 * somebody remembered, which is why \`.card__title\` and \`.detail-list__label\`
 * were not on it.
 */
.section[data-bg="canvas"] {
  ${ground('var(--color-canvas)', pageInk)}
}

.section[data-bg="subtle"] {
  ${ground('var(--color-canvas-subtle)', pageInk)}
}

.section[data-bg="surface"] {
  ${ground('var(--color-surface)', pageInk)}
  border-block: 1px solid ${rule};
}

.section[data-bg="brand"] {
  ${ground('var(--color-brand)', brandInk)}
}

.section[data-bg="inverted"] {
  ${ground('var(--color-inverted)', invertedInk)}
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

/*
 * Let the hero shrink below the width of its longest word.
 *
 * Grid and flex children default to min-width:auto, which means they cannot be
 * narrower than their min-content size. At the display step one long word is
 * enough: "Accommodations" set at the hotel's headline size measures 384px,
 * so a 390px phone rendered a 400px document and every page got a horizontal
 * scrollbar. The words that trigger it are ordinary trade vocabulary —
 * Orthodontics, Physiotherapy, Representation, Accommodations — so this is a
 * mobile defect on a large share of industries rather than an edge case.
 *
 * min-width:0 lets the track shrink; overflow-wrap lets the word itself break
 * as the last resort rather than punching out of the layout.
 */
.hero__content,
.hero__headline,
.hero__support {
  min-width: 0;
}

.section--hero h1,
.hero .eyebrow,
.hero__support {
  overflow-wrap: break-word;
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
  /*
   * Clamped with min(), not the measure alone.
   *
   * The measure is a reading width in ch units, which on a generous type scale
   * computes to about 384px — wider than the 358px a 390px phone leaves after
   * container padding. Setting max-width to the measure alone therefore acts as
   * a *minimum* on a small screen: the hero pushed the document to 400px and
   * gave the page a horizontal scrollbar on mobile.
   *
   * Capping at 100% keeps the measure where there is room for it and yields
   * where there is not.
   */
  max-width: min(var(--measure), 100%);
}

.section--hero h1 {
  margin: 0;
  /*
   * Capped, and it must stay capped here.
   *
   * This block is emitted after the base stylesheet, so an uncapped
   * var(--text-display-size) silently overrides the viewport cap the base sets
   * at the same specificity — which is how a 390px phone ended up with a 77px
   * headline nine lines deep, reading "Seaso / nal / organ / ic". The base rule
   * and this one have to agree; the colour tokens failed the same way once.
   *
   * It happened a second time, with the column cap. The base sheet learned to
   * limit the display size to what the headline's longest word can occupy in
   * its own column, this rule did not, and Zuni Café shipped a hero reading
   * "Californi / an / restauran / t". Both caps belong in both places. Third
   * occurrence of INF-007, and the reason the guard test now exists.
   */
  font-size: min(
    var(--text-display-size),
    11vw,
    calc(100cqi / var(--headline-chars, 8) * 1.8)
  );
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
  /* Long trade words — Accommodations, Orthodontics, Representation — set the
   * min-content floor of the whole hero grid. Allow the break as a last resort;
   * the viewport cap above means it almost never fires. */
  overflow-wrap: break-word;
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

  /*
   * A hero that splits into columns hands its headline a fraction of the page,
   * and the display token knows nothing about that.
   *
   * The editorial hero's headline track measured 372px against a 133px font:
   * thirteen lines, roughly one word each. Capping against the viewport rather
   * than the track is approximate — it is the only relationship CSS can express
   * without measuring the box — but it turns thirteen lines into four.
   */
  .hero--editorial h1,
  .hero--minimal h1,
  .hero--split h1,
  .hero--magazine h1 {
    font-size: min(var(--text-display-size), 5.2vw);
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

/*
 * Every hero holds the first screen, whatever treatment it uses.
 *
 * Only the full-bleed hero had a floor, so a hero without a photograph big enough to
 * justify one was simply as tall as its own words. Paradise Dental Care opened
 * at **40% of the fold** — a headline, three lines and a button, with the
 * bottom of the screen already showing the section beneath. The creative review
 * scored it weak and it was right: an opening that does not fill the screen
 * reads as the top of a document rather than the front of a place.
 *
 * The obvious repair was to promote every industry to a cinematic hero, and it
 * would have been wrong. A hotel leads with a photograph because a guest is
 * deciding whether they can picture themselves there; a dental practice is
 * selling the opposite feeling, and a full-width photograph of a surgery is
 * precisely the image a nervous patient does not want. The industry table says
 * so in as many words — anxiety-reducing rather than clinical.
 *
 * So the floor is on the *hero*, not on the photograph. A text-led opening can
 * hold a screen perfectly well; it simply has to be given the room. A split
 * hero gains it too, because its media column stretches to the new height —
 * which is what lifts the dentist's photograph from 13% of the fold without
 * changing what the page leads with.
 *
 * Slightly under the full-bleed hero's 78vh: a text hero that exactly fills the
 * viewport hides the fact that the page continues, and a visible edge of the
 * next section is what invites the scroll.
 *
 * Set on the hero block itself and not on the section around it. The first
 * attempt put it on the section, which simply grew the padding: the section
 * measured 612px and the hero inside it was still 360px, which is a taller
 * band containing the same small opening. The layout grid is what has to hold
 * the screen.
 */
.hero {
  min-height: min(68vh, 40rem);
  align-content: center;
}

/*
 * The split hero's photograph fills the height it has been given.
 *
 * Centring left the image at its aspect ratio in a taller row, so the hero grew
 * and the photograph did not — 13% of the fold either way. Stretching the track
 * and letting the image cover it is what turns a floor on the hero into a
 * larger picture, without promoting the industry to a treatment its customers
 * would not thank it for.
 */
.hero--split .hero__media,
.hero--split .hero__media img {
  height: 100%;
}

.hero--split .hero__media img {
  aspect-ratio: auto;
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

/*
 * split: copy and photograph side by side, copy leading.
 *
 * Stretched rather than centred, so the photograph fills the height the hero
 * floor gives it. Centring left the image at its own aspect ratio inside a
 * taller row: the hero grew and the picture stayed 13% of the fold.
 *
 * Both properties, and that is not redundancy. The hero floor sets
 * align-content: center, which sizes the row track to its contents and centres
 * it — leaving align-items: stretch with nothing to stretch into. The track has
 * to be told to fill before the items in it can.
 */
.hero--split {
  align-content: stretch;
  align-items: stretch;
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
/*
 * The scrim is this block's ground, so the ink is declared here.
 *
 * No \`background\`: what the copy actually sits on is the gradient in
 * \`.hero__scrim\`, painted by a sibling behind it. The section's own colour is
 * only what shows if the photograph never arrives. Either way the ground under
 * these words is dark, and the whole ink family has to say so — not just the
 * body colour, or the eyebrow goes back to being the page's brown on a
 * photograph at dusk.
 */
.hero--full-bleed {
  min-height: min(78vh, 46rem);
  align-content: end;
  padding-block: var(--space-3xl) var(--space-2xl);
  ${ground(null, invertedInk)}
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

/*
 * A cinematic hero is set to the picture, not to a reading measure.
 *
 * The measure is a *prose* width — around 60 characters, which computes to
 * roughly 568px here. Applied to a full-bleed hero it forced Tartine's
 * headline into five stacked lines at 75px over a 1440px photograph of falling
 * sourdough, which is a caption on a beautiful image rather than a title over
 * it.
 *
 * Reference library, rules 3 and 4: one dominant mood, and large simple fields
 * carry art direction better than many small elements. A display line over a
 * photograph is one of those fields and wants the room.
 *
 * The supporting copy underneath keeps the measure — that text is read, and a
 * 60-character line is where it stays readable.
 */
.hero--full-bleed .hero__headline {
  /* No cap here. A ch unit on this block resolves in the body font, not the
     display face, so any value set here silently under-measures the headline —
     68ch computed to 603px and kept the five stacked lines. The h1 carries its
     own display measure and is the right place for it. */
  max-width: none;
}

.hero--full-bleed .hero__content {
  max-width: none;
}

/*
 * A headline over a full-bleed photograph is set to the picture, not to the
 * document.
 *
 * The type scale governs a page of prose: the display token is the body
 * size compounded by the theme's ratio five times, which on the friendlier
 * themes lands around 48px. That is the right size for the largest heading in a
 * *document*, and it is much too small for the only words on a 1440px
 * photograph. Tartine's hero set "Bakery in San Francisco" at 45px across a
 * full-width picture of falling sourdough, and it read as a caption that had
 * been placed on the image rather than a title that owned it.
 *
 * A cinematic hero is a poster. Its headline is competing with a photograph for
 * the first three seconds, and losing that competition is what makes a page
 * read as a template with a picture in it.
 *
 * Applied only to the full-bleed treatment, and that restriction is the whole
 * argument. The other treatments set their headline beside or above content
 * that has to hold its own; only this one has an entire photograph behind it
 * and nothing else on the screen to balance against.
 *
 * ## All three caps, again
 *
 * INF-007 has now cost this project three production defects, every one of them
 * a hero headline that overrode a cap it did not restate. So this rule carries
 * the viewport cap and the longest-word cap alongside the scaled display size,
 * even though the multiplier is the only part that is new. A rule that raises a
 * font size and drops a bound is the exact shape of that bug.
 *
 * The word cap is loosened from 1.8 to 1.9 rather than removed: a poster
 * setting tolerates slightly tighter side bearings than a heading in text.
 */
.hero--full-bleed h1 {
  /*
   * Four bounds, and the last one is what keeps a long headline on the screen.
   *
   * A poster setting wants to be as large as the words allow, and "as large as
   * the words allow" is two different questions: how wide the longest word is,
   * and how much text there is in total. Zuni Café is the case that separated
   * them — no word longer than "Californian", so the word cap was happy, and
   * thirty-nine characters, which at 169px set four lines and pushed the hero
   * to one and a half screens.
   *
   * The factor is deliberately loose. It binds only on headlines long enough to
   * run past three lines: Tartine at twenty-three characters and the hotel at
   * twenty-eight are both unaffected, and only Zuni is brought down.
   */
  font-size: min(
    calc(var(--text-display-size) * 1.55),
    13vw,
    calc(100cqi / var(--headline-chars, 8) * 1.9)
  );
  /* A poster line closes up: the display leading that suits a heading inside a
     document leaves a two-line hero looking like two separate statements. */
  line-height: 1.04;
  max-width: 16ch;
}

/*
 * On a wide screen, a long headline also yields to its total length.
 *
 * Scoped to the desktop breakpoint because this is a *poster-scale* constraint
 * and poster scale only exists where there is room for it. On a phone the 13vw
 * cap already governs — Zuni sets at 51px there and reads well — and applying
 * the length rule at that width drove the same headline down to 28px, which is
 * barely larger than the body text beneath it.
 *
 * The factor is loose enough to bind only on headlines long enough to run past
 * three lines: Tartine at twenty-three characters is untouched, and Zuni at
 * thirty-nine comes down from 169px over four lines to 75px over two.
 */
@media (min-width: ${round(mdRem)}rem) {
  .hero--full-bleed h1 {
    font-size: min(
      calc(var(--text-display-size) * 1.55),
      13vw,
      calc(100cqi / var(--headline-chars, 8) * 1.9),
      calc(100cqi / var(--headline-length, 24) * 3)
    );
  }
}

.hero--full-bleed .hero__support {
  max-width: min(var(--measure), 100%);
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
/*
 * A card is a light ground wherever it lands, so it carries the page's ink with
 * it.
 *
 * This is the half of the rule that is easy to forget. A band that goes dark is
 * visibly a decision; a card that stays light *inside* that band is the same
 * decision made silently, and it has the same obligation. Without this the card
 * kept its own paper colour and inherited the band's near-white type, which is
 * the 1.13:1 the services cards shipped at.
 */
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  padding: var(--space-lg) var(--space-md);
  ${ground('var(--color-surface)', pageInk)}
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

/* Step 2 of the ramp is a near-white tint, so this cell is a light ground too. */
.bento__cell--wide {
  ${ground('var(--primary-2)', pageInk)}
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
/*
 * Aligning the bylines across a row of quotations.
 *
 * Three reviews are never the same length, and as plain grid items their
 * attributions land wherever each quotation happened to stop — three names at
 * three different heights, which reads as an unfinished layout rather than a
 * considered one. The first page ever to render real testimonials showed this
 * immediately.
 *
 * It takes both rules below, and the first attempt used only the second.
 * The grid item is the *list item*; the quote is a figure inside it. Making
 * only the figure a column achieves nothing — the item stretches to the row,
 * the figure stops at its own content, and the auto margin further down has no
 * leftover space to claim. Laying the item out as a grid hands the figure the
 * item's full height, which is the height the alignment is measured against.
 *
 * Measured, not eyeballed: the three bylines sit within a pixel of each other
 * in the DOM. A screenshot was what made the first fix look finished.
 */
.quote-list > li {
  display: grid;
}

.quote {
  position: relative;
  display: flex;
  flex-direction: column;
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
  /* An auto top margin aligns the bylines across the row; the padding keeps
     the minimum gap a plain margin used to provide, for the quotation that is
     tallest in its row and has no leftover space to claim. */
  margin-top: auto;
  padding-top: var(--space-md);
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

/*
 * Collage: an art-directed sequence, not a grid with one big cell.
 *
 * The masonry it replaces produced eight photographs at **two sizes** —
 * 687x474 twice and 334x350 six times — which is a contact sheet. A sequence
 * has a lead, a rest, and a change of pace, and it gets that from three things
 * a uniform grid has none of: different footprints, different aspect ratios,
 * and one image allowed to break the rhythm near the end.
 *
 * Three scales across six cells on a four-column grid, packed so no cell is
 * left empty:
 *
 *   0  the lead    two columns, two rows — one photograph held longer
 *   1  a detail    two columns, beside the lead
 *   2  a detail    two columns, beside the lead
 *   3  a detail    two columns
 *   4  a detail    two columns, beside it
 *   5  the close   four columns, cinematic
 *
 * The first arrangement gave the lead three columns of four and two rows, which
 * left a single free column on its second row that nothing could fill. The grid
 * pushed the rest down and the gallery grew to 3,572px — four screens, half the
 * page. A composition that leaves holes is not more expressive, it is just
 * taller.
 *
 * The close is the point. A grid that never changes width reads as a grid
 * however good the photographs are; one image at the full measure, at the end,
 * is what makes the set read as an edit somebody made — and putting it last
 * gives the sequence somewhere to arrive instead of trailing off.
 */
@media (min-width: ${round(mdRem)}rem) {
  .gallery--collage {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .gallery--collage .gallery__item--0 {
    grid-column: span 2;
    grid-row: span 2;
  }

  /*
   * The figure has to stretch before the image inside it can.
   *
   * The grid item spans two rows and stretches by default, but the figure
   * between it and the image does not, so height:100% on the image resolved
   * against a box that was only as tall as one row. The lead measured 433px —
   * exactly the height of the details it was supposed to tower over — and the
   * whole point of the composition was lost to one missing declaration.
   */
  .gallery--collage .gallery__item--0 figure {
    height: 100%;
  }

  .gallery--collage .gallery__item--0 img {
    height: 100%;
    aspect-ratio: auto;
  }

  .gallery--collage .gallery__item--1,
  .gallery--collage .gallery__item--2,
  .gallery--collage .gallery__item--3,
  .gallery--collage .gallery__item--4 {
    grid-column: span 2;
  }

  /* 16/10 rather than 4/3: two of these stack beside the lead, and a taller
     crop is what pushed the whole sequence past three screens. */
  .gallery--collage .gallery__item--1 img,
  .gallery--collage .gallery__item--2 img,
  .gallery--collage .gallery__item--3 img,
  .gallery--collage .gallery__item--4 img {
    aspect-ratio: 16 / 10;
  }

  /* The close: full measure, cinematic crop. */
  .gallery--collage .gallery__item--5 {
    grid-column: 1 / -1;
  }

  .gallery--collage .gallery__item--5 img {
    aspect-ratio: 21 / 9;
  }
}

/*
 * On a phone the sequence keeps its shape rather than becoming a stack.
 *
 * Eight photographs in a single column was 1.9 screens on desktop and far worse
 * on a phone — the gallery simply became the page. Two columns with the lead
 * and the turn spanning both preserves the rhythm at a third of the height,
 * which is the mobile-first version of the same composition rather than the
 * desktop one folded up.
 */
@media (max-width: ${round(mdRem)}rem) {
  .gallery--collage {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gallery--collage .gallery__item--0,
  .gallery--collage .gallery__item--5 {
    grid-column: 1 / -1;
  }

  .gallery--collage .gallery__item--0 img {
    aspect-ratio: 4 / 3;
  }

  .gallery--collage .gallery__item--5 img {
    aspect-ratio: 16 / 9;
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
  ${ground('var(--color-inverted)', invertedInk)}
}

/* Links keep the band's ink rather than the page's brand brown. */
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
/* Composition — measure, scale and rhythm                             */
/* ------------------------------------------------------------------ */

/*
 * Every section used to start at the same x and run to the same width.
 *
 * Measured on Tartine: eight sections, all of them at x=160 and 1120 wide.
 * That is the single loudest tell of generated work, and no amount of colour or
 * typeface fixes it — a page where every band has the same measure reads as a
 * document template with content poured into it, because that is exactly what
 * it is.
 *
 * A designed page varies its measure with the *job* of the section. Prose wants
 * a narrow column and photography wants the page. So the measure is assigned
 * per kind rather than globally:
 *
 * - **gallery** runs wider than the text, because photographs are what the
 *   visitor came to look at;
 * - **about** runs narrow and offset, because it is the only part of the page
 *   anybody actually reads;
 * - **statement** takes the full width, because the sentence is the section;
 * - **contact and hours** keep the standard measure, since they are scanned.
 *
 * These are overrides on the section, not on the container class itself, so the base
 * sheet's cap still holds everywhere it was not deliberately changed.
 */
.section--gallery .container {
  max-width: min(88rem, 100%);
}

/*
 * A section head aligns with the thing it introduces.
 *
 * The stacked frame centres its head on a reading measure, which is right above
 * a column of prose and wrong above a full-measure grid: the head sat at x=403
 * over photographs starting at x=56, and the offset read as a mistake rather
 * than as a decision. Left-aligned, and with the hairline running the full width
 * of the grid, it becomes the rule that opens a section in a printed page.
 */
.section--gallery .section__head {
  max-width: none;
  margin-inline: 0;
  text-align: left;
}

/*
 * The about block reads, so it gets a reading measure — but not a cramped one.
 *
 * The first pass narrowed the whole container to 62rem and the prose landed in
 * a 330px column beside its photograph, which is under 40 characters a line.
 * That is narrower than a newspaper column and it made the best copy on the
 * page look like a caption. The container stays generous and the *text* takes
 * the measure, which is where a measure belongs.
 */
.section--about .container {
  max-width: min(72rem, 100%);
}

.section--about .frame__content p,
.section--about .split__copy p {
  max-width: 38rem;
}

.section--statement .container {
  max-width: 100%;
}

/*
 * The type scale had two sizes on it, and a page needs a range.
 *
 * Measured: the hero at 76px and then every section heading at 25 to 31px, with
 * nothing between. The reader's eye has no ladder to climb, so the page feels
 * flat however good the typeface is.
 *
 * Section headings move up to a genuine display step — still well below the
 * hero, so the opening keeps its primacy, but far enough above the body that
 * each section announces itself. Capped by the longest word for the same reason
 * the hero is: scale must never break the words.
 */
.section:not(.section--hero) .section__head h2 {
  font-size: min(
    calc(var(--text-h1-size) * 0.92),
    7vw,
    calc(100cqi / var(--headline-chars, 10) * 1.6)
  );
  line-height: 1.06;
  letter-spacing: -0.015em;
  max-width: 18ch;
}

/*
 * The eyebrow was a small orange label above every heading, and it read as a
 * content-management field rather than as typography. Set in the body face,
 * widely tracked and muted, it becomes a caption — which is what it is.
 */
.section__head .eyebrow {
  font-family: var(--font-body);
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  opacity: 0.75;
}

/*
 * Section bands vary in height with their weight.
 *
 * Uniform padding is the other half of the flatness problem: a contact block
 * and an editorial passage were given the same air, so nothing on the page felt
 * more important than anything else.
 */
.section--about {
  padding-block: clamp(5rem, 11vw, 10rem);
}

.section--contact,
.section--hours {
  padding-block: clamp(3rem, 6vw, 5.5rem);
}

/* ------------------------------------------------------------------ */
/* Statement band — editorial-statement-break                          */
/* ------------------------------------------------------------------ */

/*
 * One sentence of the business's own words, set large, alone on an inverted
 * ground.
 *
 * The Tartine benchmark scored storytelling 3/10 against a premium reference,
 * and the cause was that every word on the page arrived at the same size on the
 * same surface. A reader scrolling had nothing to catch on. This is the catch:
 * the page stops, says one thing, and continues.
 *
 * Sized by its own length rather than by a type step. A statement is a
 * different length on every business — "It felt like fate." and a
 * thirty-word sentence both have to look deliberate — so the size is derived
 * from the character count, which keeps a short line enormous and stops a long
 * one becoming a paragraph in a large font.
 *
 * The 3.2 factor and the 7rem ceiling were measured against the benchmark set:
 * Tartine's eighteen-character line reaches the cap, and a hundred-character
 * line settles near the ordinary h1 step, which is where a sentence that long
 * stops being a statement and starts being prose.
 */
/*
 * The band holds a screen, because a moment that scrolls past is not a moment.
 *
 * The first build gave it ordinary section padding and it measured **193px —
 * 0.21 of a screen**. At that height a sentence on a dark ground is a coloured
 * stripe with words in it, and the reader passes it without stopping. What
 * makes an editorial break work is the *emptiness around the line*, not the
 * line: the page has to visibly give up half a screen to say one thing.
 *
 * Under a full screen on purpose, so the band never behaves like a slide the
 * reader has to get past, and so the section beneath it stays visible at the
 * bottom edge.
 */
.section--statement {
  display: grid;
  align-content: center;
  min-height: min(62vh, 34rem);
  padding-block: clamp(5rem, 14vw, 11rem);
}

.pronouncement {
  margin: 0 auto;
  max-width: 20ch;
  text-align: center;
  font-family: var(--font-heading);
  font-size: min(
    calc(100cqi / var(--statement-length, 40) * 4.4),
    9rem,
    11vw
  );
  line-height: 1.04;
  font-weight: var(--text-display-weight);
  letter-spacing: var(--text-display-tracking, normal);
  text-wrap: balance;
  /* Long words in a short sentence set the min-content floor of the band. */
  overflow-wrap: break-word;
}

/* ------------------------------------------------------------------ */
/* Facts marquee — marquee-verified-facts                              */
/* ------------------------------------------------------------------ */

/*
 * A rule of verified facts, directly under the hero.
 *
 * Section rhythm scored 4/10 because every band on the page was the same
 * height and the same weight. This one is deliberately the shortest thing on
 * the page — it is a rule, not a section — and it is where the committed brand
 * colour first arrives.
 *
 * Every item is a fact the profile proved. Nothing here is an adjective, and
 * nothing appears only here: the same facts reach the contact block and the
 * JSON-LD, so a reader who never sees this band loses nothing.
 */
.facts-bar {
  overflow: hidden;
  ${ground('var(--color-brand)', brandInk)}
}

/*
 * The two tracks run side by side, not one under the other.
 *
 * The first build left the viewport as a block, so the duplicate track — which
 * exists only to make the loop seamless — wrapped onto a second line and the
 * band rendered the same three facts twice, stacked. It read as a bug because
 * it was one.
 *
 * The animation belongs on the viewport rather than on either track: shifting
 * the pair by exactly half its width lands the second track where the first
 * began, which is what makes the repeat invisible.
 */
.facts-bar__viewport {
  display: flex;
  width: max-content;
}

.facts-bar__track {
  display: flex;
  flex: none;
  gap: var(--space-lg);
  padding-block: var(--space-sm);
  padding-inline: var(--space-lg);
}

.facts-bar__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-lg);
  font-family: var(--font-heading);
  font-size: var(--text-caption-size);
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* The separator is decoration and must not be announced or selected. */
.facts-bar__item::after {
  content: "\\2022";
  opacity: 0.55;
}

/*
 * Movement only where the visitor has not asked for stillness, and only where
 * there is enough content that the loop is seamless. The duplicated track is
 * aria-hidden in the markup, so a screen reader hears the facts once.
 */
@media (prefers-reduced-motion: no-preference) {
  .facts-bar__viewport {
    animation: facts-drift 60s linear infinite;
  }

  .facts-bar:hover .facts-bar__viewport,
  .facts-bar:focus-within .facts-bar__viewport {
    animation-play-state: paused;
  }
}

@keyframes facts-drift {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-50%, 0, 0); }
}

/* ------------------------------------------------------------------ */
/* Wordmark close — marquee-wordmark                                   */
/* ------------------------------------------------------------------ */

/*
 * The name at the foot of the page, at a size nothing else reaches.
 *
 * Visual identity scored 4/10, and the cheapest honest way to raise it is to
 * let the business's own name be the largest thing on the page exactly once.
 * It invents nothing — the name is already in the header, the title and the
 * structured data — and it gives the page a full stop.
 *
 * Sized to the width by character count rather than to a type step, so a short
 * name fills the measure and a long one reduces instead of wrapping into a
 * three-line block that stops reading as a wordmark.
 */
.wordmark {
  margin: var(--space-xl) 0 0;
  font-family: var(--font-heading);
  font-size: min(calc(100cqi / var(--wordmark-length, 12) * 1.42), 12rem);
  line-height: 0.86;
  font-weight: var(--text-display-weight);
  letter-spacing: -0.03em;
  color: var(--color-brand-text, var(--color-primary));
  /* Raised from 0.16: at that value it read as a printing fault rather than as
     a deliberate mark, which is the difference between restraint and an error. */
  opacity: 0.22;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
  /* Decorative: the name is already announced in the header and the colophon. */
  user-select: none;
}

/* ------------------------------------------------------------------ */
/* Call to action hierarchy — closing-invitation                       */
/* ------------------------------------------------------------------ */

/*
 * Five identical buttons is not a hierarchy.
 *
 * Measured on Tartine: every call to action rendered as the same 112px pill, so
 * the closing invitation — the one the whole page has been building toward —
 * carried exactly the weight of a link in the middle of an about section.
 *
 * The closing action takes real size. The mid-page ones become text with a
 * drawn rule under them: still obviously interactive, still a full touch
 * target, but no longer competing with the close. That is the pattern's own
 * rule — a mid-page action belongs to the argument above it, and a filled pill
 * is a bigger claim than a paragraph can support.
 */
.section--cta .button {
  min-height: 3.5rem;
  padding-inline: clamp(2rem, 5vw, 3.5rem);
  font-size: var(--text-bodyLarge-size, 1.125rem);
}

.section--about .button,
.section--services .button,
.section--menu .button {
  min-height: 2.75rem;
  padding-inline: 0;
  background: transparent;
  border-color: transparent;
  color: var(--color-brand-text, var(--color-primary));
  border-radius: 0;
  border-bottom: 2px solid currentColor;
}

.section--about .button:hover,
.section--services .button:hover,
.section--menu .button:hover {
  background: transparent;
  color: var(--color-accent);
  border-bottom-color: currentColor;
}

/* ------------------------------------------------------------------ */
/* Motion — motion-enter-rise, motion-hover-response                   */
/* ------------------------------------------------------------------ */

/*
 * Sections arrive as they are scrolled to.
 *
 * Motion scored 2/10 and it was the correct score: the page had one load
 * animation and nothing else. The obvious fix is an IntersectionObserver that
 * adds a class, and this file has always refused it for a good reason — an
 * element hidden until a script says otherwise is an element that never appears
 * if the script fails, and the renderer's promise is that a site opens from
 * disk with no JavaScript at all.
 *
 * Scroll-driven CSS animations keep the promise. Where the browser supports a
 * view timeline the section rises as it enters; where it does not, the
 * @supports block never applies and the content is simply visible, which is the
 * correct degradation rather than a fallback that has to be maintained.
 *
 * The hero is excluded: it is already on screen when the page loads, and
 * animating it delays the one thing the visitor came for.
 */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .section:not(.section--hero):not(.section--statement) > .container > * {
      animation: forge-rise linear both;
      animation-timeline: view();
      /* Starts as the section's top edge enters and finishes a third of the way
         up, so the movement is over before the reader is reading it. */
      animation-range: entry 0% cover 22%;
    }

    /* Media travels slightly further than type, which reads as depth. */
    .section:not(.section--hero) figure,
    .section:not(.section--hero) .gallery {
      animation: forge-rise-media linear both;
      animation-timeline: view();
      animation-range: entry 0% cover 26%;
    }

    /* The statement is the page's one interruption and earns its own entrance. */
    .pronouncement {
      animation: forge-rise-statement linear both;
      animation-timeline: view();
      animation-range: entry 5% cover 30%;
    }
  }
}

@keyframes forge-rise {
  from { opacity: 0; transform: translate3d(0, 1.25rem, 0); }
  to { opacity: 1; transform: none; }
}

@keyframes forge-rise-media {
  from { opacity: 0; transform: translate3d(0, 2.5rem, 0); }
  to { opacity: 1; transform: none; }
}

@keyframes forge-rise-statement {
  from { opacity: 0; transform: translate3d(0, 2rem, 0); }
  to { opacity: 1; transform: none; }
}

/* ------------------------------------------------------------------ */
/* Moment transition — .section--moment                                */
/* ------------------------------------------------------------------ */

/*
 * A brief wash marking entry to the one section ComposeOptions.momentSection
 * nominated, when momentTransition was also requested. See ADR 0005 and
 * lib/design/directive.ts's applyExperienceIntent.
 *
 * One pseudo-element, one keyframe: a low-opacity tint that fades to nothing
 * as the section arrives. Generated content paints before an element's real
 * children by construction, so the wash sits under the section's type without
 * a z-index — a stacking rule rather than a convention someone could get
 * wrong. pointer-events: none keeps it from ever intercepting a click or a
 * tap; a decorative layer cannot trap a visitor. Bounded to the same
 * @supports/prefers-reduced-motion guard as every scroll-driven effect above:
 * unsupported or reduced, the section simply has no wash, which is the
 * correct degradation, not a fallback to maintain separately.
 */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .section--moment {
      position: relative;
    }

    .section--moment::before {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--color-brand);
      pointer-events: none;
      animation: forge-moment-wash linear both;
      animation-timeline: view();
      /* Over well before the section is actually being read, the same
         principle the entrance animations above already use. */
      animation-range: entry 0% entry 45%;
    }
  }
}

@keyframes forge-moment-wash {
  0% { opacity: 0.22; }
  100% { opacity: 0; }
}

/*
 * Hover responses, so interactive things feel interactive.
 *
 * Scoped to (hover: hover) because a touch device has no hover state and
 * applying one there leaves a card stuck in its lifted position after a tap.
 * Every effect here is on something that is genuinely a link or a control —
 * promising a click that does not exist is worse than no affordance at all.
 */
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .card,
  .feature {
    transition: transform 150ms var(--easing), box-shadow 150ms var(--easing);
  }

  .card:hover,
  .feature:hover {
    transform: translate3d(0, -3px, 0);
  }

  /* The frame is clipped, so the image scales inside it and the grid never
     reflows around a hovered cell. */
  .gallery figure {
    overflow: hidden;
  }

  .gallery figure img {
    transition: transform 220ms var(--easing);
  }

  .gallery figure:hover img {
    transform: scale(1.04);
  }
}

/* ------------------------------------------------------------------ */
/* The ember world — before light                                      */
/* ------------------------------------------------------------------ */

/*
 * The page is a sunrise.
 *
 * A bakery's day starts hours before the city's. The ovens are lit in the dark,
 * the room is warm before anyone is in it, and the door opens into morning. So
 * the page opens in near-black, warms through the middle, and arrives in
 * daylight at the counter — the scroll itself carries the day.
 *
 * This is invention, and it is the *permitted* kind. It claims nothing about
 * when Tartine opens, how long it has existed or who works there; every one of
 * those remains a verified fact in the sections that carry them. What is
 * invented is the experience of arriving, which is the only thing a photograph
 * of bread on a white page has never been able to give.
 *
 * The ember itself is not chosen. It is the colour read off the business's own
 * photographs — crust brown — so the world is warm because the bread is.
 */
[data-world="ember"] {
  --ember-night: #12100e;
  --ember-dusk: #1c1815;
  --ember-dawn: #efe7dc;
  color-scheme: dark light;
}

/*
 * Night is the default ground, not an exception.
 *
 * Every previous page began white and stayed white with bands painted on it.
 * Here the dark *is* the page for its first three scenes, so the photographs
 * are lit objects in a room rather than pictures on paper.
 */
/*
 * Night and dawn keep the ink the base ground already established: night is
 * darker than \`--color-inverted\` and dawn is lighter than \`--color-canvas\`, so
 * each moves *away* from the type sitting on it. The ink is a floor, and this
 * world only ever raises it.
 */
[data-world="ember"] .section[data-bg="inverted"] {
  background: var(--ember-night);
}

[data-world="ember"] .section[data-bg="subtle"] {
  background: var(--ember-dawn);
}

/*
 * Dusk: the second dark band, and the reason there can be one.
 *
 * The journey wants to hold the dark across two scenes, and two scenes painted
 * the same black are one scene with a heading adrift in it. So night's
 * companion ground is painted here as the warming rather than as the pale card
 * it is in a light world — the ovens are on, the sky has moved, and the room is
 * still dark. The band is a stage of the arc, so it takes night's text
 * treatment with it and its rules go to the light instead of against it.
 */
/*
 * Dusk is the one band in this world that reverses its ground.
 *
 * \`surface\` is a pale card everywhere else, so it is the only ember ground that
 * has to bring the whole inverted ink with it rather than inherit what the base
 * rule already set. It used to do that by naming five selectors and setting them
 * to \`inherit\`; the ground now carries its own ink and the list is unnecessary.
 */
[data-world="ember"] .section[data-bg="surface"] {
  ${ground('var(--ember-dusk)', invertedInk)}
  border-block-color: color-mix(in srgb, var(--ember-dawn) 14%, transparent);
}

[data-world="ember"] .section[data-bg="surface"] .button {
  background: var(--color-on-brand);
  border-color: var(--color-on-brand);
  color: var(--color-brand);
}

/*
 * The seam between night and morning.
 *
 * A hard edge between a black band and a cream one reads as two pages stapled
 * together. A tall gradient in the join makes the change feel like light
 * arriving rather than a section ending, and it is the one place on the page
 * where a gradient earns its keep.
 *
 * Both dark grounds get one, because either can be the last band before the
 * light: the arc normally hands over at dusk, but a page short enough to skip
 * that stage hands over straight from night. Each fades from the colour
 * actually above it, or the join advertises a band that is not there.
 */
[data-world="ember"] .section[data-bg="inverted"] + .section[data-bg="subtle"],
[data-world="ember"] .section[data-bg="surface"] + .section[data-bg="subtle"] {
  position: relative;
}

[data-world="ember"] .section[data-bg="inverted"] + .section[data-bg="subtle"]::before,
[data-world="ember"] .section[data-bg="surface"] + .section[data-bg="subtle"]::before {
  content: "";
  position: absolute;
  inset-inline: 0;
  top: 0;
  height: clamp(6rem, 18vh, 14rem);
  pointer-events: none;
}

[data-world="ember"] .section[data-bg="inverted"] + .section[data-bg="subtle"]::before {
  background: linear-gradient(to bottom, var(--ember-night), transparent);
}

[data-world="ember"] .section[data-bg="surface"] + .section[data-bg="subtle"]::before {
  background: linear-gradient(to bottom, var(--ember-dusk), transparent);
}

/*
 * The hero holds the whole screen and darkens as it leaves.
 *
 * A cinematic opening that stops at 78vh is a picture with a page under it. At
 * full height the photograph *is* the first thing, and the scrim deepening as
 * the reader scrolls hands the page to the dark band beneath rather than
 * cutting to it.
 */
[data-world="ember"] .section--hero {
  background: var(--ember-night);
}

[data-world="ember"] .hero {
  min-height: min(92vh, 56rem);
}

/*
 * Display type at the scale the world allows.
 *
 * Playfair carries this and Lora would not: at ninety points a high-contrast
 * serif has hairlines to lose against a photograph, which is the drama. The
 * eyebrow beneath it goes the other way — Space Grotesk, small, widely tracked,
 * upper case — so the two faces are doing visibly different jobs rather than
 * agreeing with each other.
 */
/*
 * The opening is a poster, and it was still a page with a picture on it.
 *
 * v1 of this world kept the hero at its old proportions: a 76px headline in the
 * bottom-left eighth of the frame, with the photograph doing all the work
 * behind it. The photograph is good enough that the page looked fine — and
 * "fine" is the whole problem. Nothing about the first three seconds said a
 * person had made a decision.
 *
 * So the headline takes the frame. Roughly twice the display step, capped by
 * both the viewport and the longest word so the words never break, sitting on
 * the baseline of a full-height photograph. At this size Playfair's hairlines
 * are the drama, which is why this world chose it over a text serif.
 */
[data-world="ember"] .section--hero h1 {
  font-size: min(
    calc(var(--text-display-size) * 2.3),
    17vw,
    calc(100cqi / var(--headline-chars, 8) * 2.3),
    calc(100cqi / var(--headline-length, 24) * 3.6)
  );
  line-height: 0.94;
  letter-spacing: -0.04em;
  max-width: 14ch;
}

/*
 * The scrim is a graded floor, not a wash over the whole picture.
 *
 * A flat 45% overlay across a photograph is what every generated page does, and
 * it dulls the image everywhere in order to make text legible in one corner.
 * A gradient from the bottom leaves the top of the photograph at full strength
 * and puts the density exactly where the words are.
 */
[data-world="ember"] .hero__scrim {
  background: linear-gradient(
    to top,
    rgb(6 5 4 / 88%) 0%,
    rgb(6 5 4 / 62%) 28%,
    rgb(6 5 4 / 12%) 62%,
    transparent 100%
  );
}

/*
 * Scenes, numbered.
 *
 * The eyebrow said "gallery" and "about" — the names of the fields in a content
 * model, printed on the page. In a world built as a journey they become scene
 * numbers, which is the cheapest possible change that makes a reader feel they
 * are moving through something rather than scrolling past blocks.
 *
 * A counter rather than authored labels, because a number invents nothing. It
 * says "this is the second thing", which is true by construction, where a name
 * like "Our Craft" would be a claim nobody at the business ever made.
 */
[data-world="ember"] main {
  counter-reset: scene;
}

[data-world="ember"] .section:not(.section--hero):not(.section--cta) .eyebrow {
  counter-increment: scene;
}

[data-world="ember"] .section:not(.section--hero):not(.section--cta) .eyebrow::before {
  content: counter(scene, upper-roman) " — ";
  opacity: 0.55;
}

[data-world="ember"] .eyebrow,
[data-world="ember"] .facts-bar__item,
[data-world="ember"] .detail__label {
  font-family: var(--font-body);
  letter-spacing: 0.28em;
  font-size: 0.68rem;
}

/*
 * The statement is the darkest, emptiest thing on the page.
 *
 * It sits in the middle of the night scenes, holds three quarters of a screen,
 * and carries one sentence of the business's own words at a size nothing else
 * reaches. The line rises as it is scrolled to — slowly, and only once.
 */
[data-world="ember"] .section--statement {
  background: var(--ember-night);
  min-height: min(78vh, 40rem);
}

[data-world="ember"] .pronouncement {
  font-size: min(
    calc(100cqi / var(--statement-length, 40) * 5.4),
    11rem,
    13vw
  );
  letter-spacing: -0.035em;
}

/*
 * The gallery is a room in the dark, not a grid on paper.
 *
 * Same six photographs, same composition, no gutters between the two largest
 * cells — the sequence reads as one object lit from within rather than as tiles
 * with space around them.
 */
[data-world="ember"] .section--gallery {
  padding-block: clamp(5rem, 12vw, 10rem);
}

[data-world="ember"] .gallery--collage {
  gap: 0.5rem;
}

[data-world="ember"] .gallery img {
  border-radius: 0;
}

/*
 * The sequence ends by leaving the page.
 *
 * The closing photograph breaks its container and runs the full width of the
 * viewport — no gutter, no radius, nothing beside it. After five images held
 * inside a margin, one that ignores the margin entirely is the moment the
 * composition has been building toward, and it costs one rule.
 *
 * A half-width negative margin rather than a fixed one, so it stays exact at
 * every viewport and cannot introduce a horizontal scrollbar the way a viewport
 * width does when a scrollbar is present.
 */
[data-world="ember"] .gallery--collage .gallery__item--5 {
  margin-inline: calc(50% - 50vw);
  width: 100vw;
}

[data-world="ember"] .gallery--collage .gallery__item--5 img {
  aspect-ratio: 2.4;
}

/*
 * The scene title steps aside for it — unless the title is worth reading.
 *
 * Written when every gallery on every page was headed **"Photographs"**: a
 * content-model label wearing a serif, which the scene number and the
 * photographs both said better. That is still true of a supporting gallery, so
 * the rule stays for one.
 *
 * It is no longer true of the *signature* beat. Its heading is now the
 * business's own words about what the photograph shows — "Sala mare cu
 * candelabru floral și arcade filigranate" — and hiding it threw away the one
 * line on the page that only this venue could have written. A later layer must
 * not erase an earlier one's intelligence; the exception is the fix.
 */
[data-world="ember"] .section--gallery:not([data-role="signature"]) .section__head h2 {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/*
 * The closing band is the ember, and the wordmark burns through it.
 *
 * The footer wordmark was a pale tint on white and read as a printing fault.
 * On the dawn ground at full width it is the last thing the page says, and it
 * says the name.
 */
/*
 * Daylight is still part of the world.
 *
 * v2 opened beautifully and then, three scenes in, reverted to the page it had
 * always been: small type, a four-column label/value contact table, a hairline
 * under a 25px heading. The world stopped exactly where the reader starts
 * looking for the useful information, which is the worst possible place to stop
 * caring.
 *
 * The morning scenes get the same treatment as the night ones — the display
 * face at real scale, the address set as something worth reading rather than a
 * cell in a table, and air around it. The information does not become less
 * useful for being composed; it becomes findable because it looks deliberate.
 */
[data-world="ember"] .section--contact,
[data-world="ember"] .section--hours {
  padding-block: clamp(4.5rem, 9vw, 8rem);
}

/*
 * Large, but never the largest.
 *
 * This was \`display * 1.15\`, which put the word "Contact" at 109px on a page
 * whose signature beat was set at 67px — a practical, closing label shouting
 * over the moment the whole narrative builds to. The intent behind the rule was
 * right (the contact scene had been a grey table nobody could find) and it is
 * kept: the address below is still set at reading scale. Only the heading is
 * brought back under the peak, which is what makes the peak one.
 */
[data-world="ember"] .section--contact .section__head h2 {
  font-size: min(var(--text-display-size), 6vw);
  line-height: 1;
}

/*
 * The address is the largest thing in the contact scene.
 *
 * It is also the single most useful string on the page for a bakery — someone
 * reading this is deciding whether to walk there. Setting it at caption size in
 * a grey table beside three other cells was an information-architecture
 * decision made by a stylesheet, not by anyone thinking about the visitor.
 */
[data-world="ember"] .section--contact .detail:first-child .detail__value {
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2.4rem);
  line-height: 1.15;
}

[data-world="ember"] .site-footer {
  background: var(--ember-dawn);
}

[data-world="ember"] .wordmark {
  opacity: 0.3;
  letter-spacing: -0.05em;
}

/* ------------------------------------------------------------------ */
/* Print                                                               */
/* ------------------------------------------------------------------ */

@media print {
  .facts-bar,
  .wordmark {
    display: none;
  }

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
