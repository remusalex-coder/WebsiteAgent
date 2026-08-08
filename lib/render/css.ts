/**
 * The stylesheet.
 *
 * One file, no imports, no web fonts, no external requests — a rendered site is
 * a folder you can open from disk or drop on any host, and it looks the same
 * offline. Every value interpolated below came through `theme.ts` and has been
 * validated there; nothing else is ever interpolated.
 *
 * Layout is mobile-first and fluid: `clamp()` and `auto-fit` grids carry the
 * responsiveness, so there are only two breakpoints and neither is load-bearing.
 */

import { designRules } from './variants.js';
import { fontFaceRules } from './fonts.js';

import type { Theme } from './theme.js';
import type { WebsiteDesign } from '../design/types.js';

/** Wider than this and line length hurts reading more than the width helps. */
const CONTENT_WIDTH = '72rem';

/**
 * A fluid value as a `clamp()` between two viewport anchors.
 *
 * The anchors come from the design's `fluidRange` (rem), so every fluid value
 * on the page interpolates over the same span and the whole system scales
 * together rather than each token having its own idea of "wide".
 */
function fluid(minRem: number, maxRem: number, fromRem: number, toRem: number): string {
  if (Math.abs(maxRem - minRem) < 0.001) return `${round(minRem)}rem`;

  const slope = (maxRem - minRem) / (toRem - fromRem);
  const intercept = minRem - slope * fromRem;
  const low = Math.min(minRem, maxRem);
  const high = Math.max(minRem, maxRem);

  return `clamp(${round(low)}rem, ${round(intercept)}rem + ${round(slope * 100)}vw, ${round(high)}rem)`;
}

/** Three decimal places: enough for CSS, and stable across platforms. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * The design token block.
 *
 * Emitted only when a `WebsiteDesign` was supplied. Everything the design layer
 * decided lands here as a custom property, which is what lets the renderer stop
 * deciding: a section rule reads `var(--text-h2-size)` and never computes a
 * size of its own.
 */
function designTokens(design: WebsiteDesign): string {
  const { color, typography, spacing, radius, elevation, motion } = design.tokens;
  const { minRem: from, maxRem: to } = typography.fluidRange;

  const lines: string[] = [];

  lines.push('  /* Colour — semantic */');
  for (const [name, value] of Object.entries(color.semantic)) {
    lines.push(`  --color-${kebab(name)}: ${value};`);
  }

  lines.push('', '  /* Colour — ramps */');
  for (const role of Object.keys(color.ramps).sort()) {
    const ramp = color.ramps[role as keyof typeof color.ramps];
    ramp.steps.forEach((stepColor, index) => {
      lines.push(`  --${role}-${index + 1}: ${stepColor};`);
    });
  }

  lines.push('', '  /* Typography */');
  lines.push(`  --font-heading: ${typography.heading.stack};`);
  lines.push(`  --font-body: ${typography.body.stack};`);
  if (typography.mono !== null) lines.push(`  --font-mono: ${typography.mono.stack};`);
  lines.push(`  --measure: ${typography.measureCh}ch;`);

  for (const name of Object.keys(typography.scale).sort()) {
    const step = typography.scale[name as keyof typeof typography.scale];
    lines.push(`  --text-${kebab(name)}-size: ${fluid(step.minRem, step.maxRem, from, to)};`);
    lines.push(`  --text-${kebab(name)}-height: ${step.lineHeight};`);
    lines.push(`  --text-${kebab(name)}-weight: ${step.weight};`);
    if (step.letterSpacing !== 0) {
      lines.push(`  --text-${kebab(name)}-tracking: ${round(step.letterSpacing)}em;`);
    }
  }

  lines.push('', '  /* Spacing */');
  for (const name of Object.keys(spacing.scale).sort()) {
    const step = spacing.scale[name as keyof typeof spacing.scale];
    lines.push(`  --space-${name}: ${fluid(step.minRem, step.maxRem, from, to)};`);
  }
  lines.push(`  --space-section: ${fluid(spacing.sectionMinRem, spacing.sectionMaxRem, from, to)};`);

  lines.push('', '  /* Form */');
  lines.push(`  --radius-sm: ${radius.sm};`);
  lines.push(`  --radius-md: ${radius.md};`);
  lines.push(`  --radius-lg: ${radius.lg};`);
  lines.push(`  --radius-pill: ${radius.pill};`);
  for (const name of ['sm', 'md', 'lg'] as const) {
    lines.push(`  --shadow-${name}: ${elevation.levels[name].shadow};`);
  }

  lines.push('', '  /* Layout */');
  lines.push(`  --container-max: ${design.responsive.containerMaxRem}rem;`);
  lines.push(`  --container-wide: ${design.responsive.containerWideRem}rem;`);
  // The breakpoints themselves are not published: a media query cannot read a
  // custom property, so the rules in `variants.ts` interpolate the numbers
  // directly. A token nothing can read is a token that misleads.

  lines.push('', '  /* Motion */');
  lines.push(`  --duration-fast: ${motion.durationFastMs}ms;`);
  lines.push(`  --duration-base: ${motion.durationBaseMs}ms;`);
  lines.push(`  --duration-slow: ${motion.durationSlowMs}ms;`);
  lines.push(`  --easing: ${motion.easing};`);

  lines.push('', '  /* Accessibility */');
  lines.push(`  --tap-target: ${design.accessibility.minTapTargetPx}px;`);

  return lines.join('\n');
}

/** `surfaceRaised` → `surface-raised`. */
function kebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * The reasoning behind the page, as a comment at the top of its stylesheet.
 *
 * Every decision in a `WebsiteDesign` carries a `rationale` and its `evidence`,
 * and until now none of it left the artifact. Putting it here costs a few
 * hundred bytes and means the answer to "why is this site's hero centred" ships
 * with the site rather than living in a JSON file somebody has to still have.
 *
 * A CSS comment terminator cannot survive into the output — a rationale is
 * model-written text, and one containing that sequence would close this comment
 * and turn the rest of the prose into declarations.
 */
function designPreamble(design: WebsiteDesign): string {
  const safe = (value: string): string => value.replace(/\*\//g, '* /').trim();

  const lines: string[] = [
    `Direction: ${design.personality.direction} · ${design.personality.mood.temperature}, `
      + `${design.personality.mood.energy}, ${design.personality.mood.formality} · `
      + `${design.personality.density}, ${design.personality.contrast} contrast`,
    `  ${safe(design.personality.rationale)}`,
    ...design.personality.evidence.map((entry) => `    - ${safe(entry)}`),
    '',
    `Industry: ${design.industry.id} (${design.industry.basis}`
      + `${design.industry.matchedOn.length === 0 ? '' : `, matched ${design.industry.matchedOn.map(safe).join(', ')}`})`,
    `  ${safe(design.industry.rationale)}`,
    '',
    `Layout: ${design.layout.hero} hero, ${design.layout.footer} footer, `
      + `contrast target ${design.accessibility.targetLevel} `
      + `(body ${design.accessibility.minContrastBody}:1, large ${design.accessibility.minContrastLarge}:1, `
      + `measured ${design.tokens.color.contrast.textOnCanvas}:1)`,
    `  ${safe(design.layout.rationale)}`,
    ...design.layout.sections.map((section) =>
      `    ${section.kind} → ${section.variant} (${section.emphasis}, ${section.background}): ${safe(section.rationale)}`),
  ];

  if (design.notes.length > 0) {
    lines.push('', 'Compromises the composer reported:');
    lines.push(...design.notes.map((note) => `  - ${safe(note)}`));
  }

  return `/*\n${lines.map((line) => (line === '' ? ' *' : ` * ${line}`)).join('\n')}\n */\n\n`;
}

export function renderStylesheet(theme: Theme, assetDirName = 'assets'): string {
  const { colors, fonts } = theme;

  // Ahead of everything, including the preamble comment: a face declared after
  // the rules that set it still applies, but a stylesheet whose first bytes are
  // its typefaces is the one a person reading it expects.
  const faces = theme.design === null ? '' : fontFaceRules(theme.design, assetDirName);

  const extras = theme.extraColors
    .map((color, index) => `  --brand-${index + 4}: ${color};`)
    .join('\n');

  // Appended rather than interleaved, so the fallback path's output is
  // byte-identical to what it was before the design layer existed.
  const tokens = theme.design === null
    ? ''
    : `\n\n/* ------------------------------------------------------------------ */\n`
      + `/* Design tokens — from WebsiteDesign                                   */\n`
      + `/* ------------------------------------------------------------------ */\n\n`
      + `:root {\n${designTokens(theme.design)}\n}\n`
      + designRules(theme.design);

  const preamble = theme.design === null ? '' : designPreamble(theme.design);

  return `${preamble}${faces}/* Generated by BusinessForge. Edit the WebsiteContent spec, not this file. */

:root {
  --color-primary: ${colors.primary};
  --color-on-primary: ${colors.onPrimary};
  --color-accent: ${colors.accent};
  --color-text: ${colors.text};
  --color-muted: ${colors.muted};
  --color-surface: ${colors.surface};
  --color-surface-alt: ${colors.surfaceAlt};
  --color-border: ${colors.border};
${extras}${extras === '' ? '' : '\n'}
  --font-heading: ${fonts.heading};
  --font-body: ${fonts.body};

  --space-2xs: 0.25rem;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1.25rem;
  --space-lg: 2rem;
  --space-xl: clamp(2.5rem, 6vw, 5rem);

  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --content-width: ${CONTENT_WIDTH};
  --shadow-card: 0 1px 2px rgb(0 0 0 / 6%), 0 8px 24px rgb(0 0 0 / 6%);

  color-scheme: light;
}

/* ------------------------------------------------------------------ */
/* Reset                                                               */
/* ------------------------------------------------------------------ */

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
  /* Anchored sections must clear the sticky header. */
  scroll-padding-top: 5rem;
}

/*
 * Every two-name var() below reads a design token and falls back to the value
 * this stylesheet used before the design layer existed.
 *
 * That form is load-bearing. The design block is appended after this one, so
 * any name it re-declares silently wins — and --color-surface means "the page"
 * here and "a card" there, which is how the page background ended up painted in
 * the card grey. Reading the design's own name with the old value as the
 * fallback keeps the two vocabularies from colliding: a caller with no design
 * renders exactly what it always did, and a caller with one gets the token that
 * was computed for the job rather than the one that happens to share a name.
 */
body {
  margin: 0;
  background: var(--color-canvas, var(--color-surface));
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--text-body-size, clamp(1rem, 0.96rem + 0.2vw, 1.0625rem));
  line-height: var(--text-body-height, 1.65);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  margin: 0 0 var(--space-md);
  font-family: var(--font-heading);
  line-height: 1.15;
  text-wrap: balance;
}

h1 {
  font-size: var(--text-h1-size, clamp(2rem, 1.4rem + 3vw, 3.5rem));
  line-height: var(--text-h1-height, 1.15);
  font-weight: var(--text-h1-weight, 700);
  letter-spacing: var(--text-h1-tracking, normal);
}

h2 {
  font-size: var(--text-h2-size, clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem));
  line-height: var(--text-h2-height, 1.15);
  font-weight: var(--text-h2-weight, 700);
  letter-spacing: var(--text-h2-tracking, normal);
}

h3 {
  font-size: var(--text-h3-size, clamp(1.125rem, 1.05rem + 0.5vw, 1.375rem));
  line-height: var(--text-h3-height, 1.15);
  font-weight: var(--text-h3-weight, 700);
}

p {
  margin: 0 0 var(--space-md);
  text-wrap: pretty;
}

p:last-child {
  margin-bottom: 0;
}

ul, ol {
  margin: 0 0 var(--space-md);
  padding-left: 1.25rem;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

/*
 * Brand-as-text, not brand-as-fill.
 *
 * --color-primary is tuned to carry a label on top of it, which leaves it too
 * light to be read as body-sized type on a near-white page — every one of these
 * five rules measured in the low threes before it read the darker slot.
 */
a {
  color: var(--color-brand-text, var(--color-primary));
  text-underline-offset: 0.15em;
}

a:hover {
  color: var(--color-accent);
}

:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

/* Reachable by keyboard, invisible until it is focused. */
.skip-link {
  position: absolute;
  left: var(--space-xs);
  top: -4rem;
  z-index: 100;
  padding: var(--space-xs) var(--space-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition: top 120ms ease-in-out;
}

.skip-link:focus {
  top: var(--space-xs);
  color: var(--color-on-primary);
}

.container {
  width: 100%;
  max-width: var(--container-max, var(--content-width));
  margin-inline: auto;
  padding-inline: clamp(1rem, 4vw, 2.5rem);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  /* 2.75rem keeps the target at the 44px minimum on a touch screen. */
  min-height: 2.75rem;
  padding: var(--space-xs) var(--space-lg);
  border-radius: var(--radius-sm);
  border: 2px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-family: var(--font-heading);
  font-weight: 600;
  text-decoration: none;
  transition: background-color 120ms ease-in-out, border-color 120ms ease-in-out;
}

.button:hover {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-on-primary);
}

.button--ghost {
  background: transparent;
  color: var(--color-brand-text, var(--color-primary));
}

.button--ghost:hover {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-color: var(--color-primary);
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--color-border);
}

.site-header__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding-block: var(--space-sm);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-family: var(--font-heading);
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-brand-text, var(--color-primary));
  text-decoration: none;
}

.brand__logo {
  max-height: 2.5rem;
  width: auto;
}

.site-nav__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * On a phone the section nav becomes a scroll rail rather than wrapping.
 *
 * Wrapping cost 170px of a 844px screen on an eight-section page — a fifth of
 * the first view spent on links, before the visitor sees anything about the
 * business. Shortening the labels fixed half of it; the other half is that six
 * to eight items simply do not fit on one row at 390px.
 *
 * A rail rather than a disclosure button because it needs no JavaScript and no
 * markup change: the generated site still opens from disk with no script, and
 * every link stays in the tab order instead of being hidden behind a control
 * that would need state. Scroll snapping keeps it from resting mid-label.
 */
@media (max-width: 40rem) {
  .site-nav--header .site-nav__list {
    flex-wrap: nowrap;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    /* Bleed to the container edges so the rail reads as scrollable. */
    margin-inline: calc(var(--space-md) * -1);
    padding-inline: var(--space-md);
  }

  .site-nav--header .site-nav__list::-webkit-scrollbar { display: none; }

  .site-nav--header .site-nav__list > li {
    flex: 0 0 auto;
    scroll-snap-align: start;
  }
}

.site-nav__link {
  display: inline-block;
  padding-block: var(--space-2xs);
  color: var(--color-text);
  font-size: 0.9375rem;
  text-decoration: none;
}

.site-nav__link:hover {
  color: var(--color-brand-text, var(--color-primary));
  text-decoration: underline;
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

/*
 * Section rhythm is the loudest density signal a page has — more than type size
 * or column count — so it reads the density-derived token rather than a step of
 * the generic spacing scale.
 */
.section {
  padding-block: var(--space-section, var(--space-xl));
}

.section--alt {
  background: var(--color-surface-alt);
}

.section__subheading {
  margin: -0.5rem 0 var(--space-md);
  color: var(--color-muted);
  font-size: clamp(1.0625rem, 1rem + 0.4vw, 1.25rem);
}

.section__body {
  max-width: 62ch;
}

.section__actions {
  margin-top: var(--space-lg);
}

/* Hero ------------------------------------------------------------- */

.section--hero {
  padding-block: var(--space-section, clamp(3rem, 8vw, 6rem));
  background: var(--color-surface-alt);
}

/*
 * The hero takes the display step rather than the h1 step.
 *
 * The display step is what the scale reserves for the one piece of type a page is
 * allowed to shout with, and a direction's character lives almost entirely in
 * how far it lets that step run — 2.5rem on corporate, 9rem on editorial.
 * Sending the hero through the h1 step instead flattens all eleven directions
 * into the same headline size.
 */
/*
 * The display step, capped against the viewport it has to fit in.
 *
 * The design layer sizes this per direction and knows nothing about the screen:
 * editorial asks for 9rem, and the token is emitted unchanged at every width.
 * Measured on a 390px phone that produced a 77px headline setting NINE lines at
 * four or five characters each — "Seaso / nal / organ / ic". The direction was
 * being honoured exactly and the result was unreadable.
 *
 * min() keeps the direction's intent wherever there is room for it — at 1280px
 * the token still wins — and stops it from exceeding what a narrow screen can
 * show. 11vw is about three words per line at 390px.
 */
.section--hero h1 {
  font-size: min(var(--text-display-size, clamp(2rem, 1.4rem + 3vw, 3.5rem)), 11vw);
  line-height: var(--text-display-height, 1.05);
  font-weight: var(--text-display-weight, 700);
  letter-spacing: var(--text-display-tracking, normal);
}

/* The column-hero cap lives in the variants sheet, which is emitted after this
 * one and would otherwise override it at equal specificity. */

.hero {
  display: grid;
  gap: var(--space-lg);
  align-items: center;
}

.hero__tagline {
  margin: 0 0 var(--space-sm);
  color: var(--color-brand-text, var(--color-primary));
  font-family: var(--font-heading);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero__media img {
  width: 100%;
  border-radius: var(--radius-md);
  /* A flat direction resolves --shadow-lg to none, which is the point. */
  box-shadow: var(--shadow-lg, var(--shadow-card));
}

/* Cards ------------------------------------------------------------ */

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--space-md);
  margin: var(--space-lg) 0 0;
  padding: 0;
  list-style: none;
}

.card {
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm, none);
}

.section--alt .card {
  background: var(--color-surface);
}

/* Plain and definition lists --------------------------------------- */

.plain-list {
  margin: var(--space-lg) 0 0;
  padding: 0;
  list-style: none;
  max-width: 62ch;
}

.plain-list > li {
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border);
}

.plain-list > li:last-child {
  border-bottom: 0;
}

/* Quotes ----------------------------------------------------------- */

.quote-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: var(--space-md);
  margin: var(--space-lg) 0 0;
  padding: 0;
  list-style: none;
}

.quote {
  margin: 0;
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 1.0625rem;
}

.quote p {
  margin: 0;
}

/* Gallery ---------------------------------------------------------- */

.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--space-md);
  margin: var(--space-lg) 0 0;
  padding: 0;
  list-style: none;
}

.gallery figure {
  margin: 0;
}

.gallery img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: var(--radius-md);
}

.gallery figcaption {
  margin-top: var(--space-xs);
  color: var(--color-muted);
  font-size: 0.875rem;
}

/* Call to action --------------------------------------------------- */

.section--cta {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.section--cta h2,
.section--cta .section__subheading {
  color: var(--color-on-primary);
}

.section--cta .button {
  background: var(--color-on-primary);
  border-color: var(--color-on-primary);
  color: var(--color-primary);
}

.section--cta .button:hover {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-on-primary);
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

.site-footer {
  padding-block: var(--space-lg);
  background: var(--color-surface-alt);
  border-top: 1px solid var(--color-border);
  color: var(--color-muted);
  font-size: 0.9375rem;
}

.site-footer__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.site-footer p {
  margin: 0;
}

/* ------------------------------------------------------------------ */
/* Wide viewports                                                      */
/* ------------------------------------------------------------------ */

@media (min-width: 48rem) {
  .hero--with-media {
    grid-template-columns: 1.1fr 0.9fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@media print {
  .site-header,
  .skip-link,
  .section__actions {
    display: none;
  }

  body {
    color: #000;
  }
}
${tokens}`;
}
