/**
 * Accessibility: what the render and the design tokens guarantee (or do not)
 * for a visitor using a screen reader, keyboard navigation, or reduced motion.
 */

import { allPlacedImages, check, countMatches } from '../helpers.js';
import type { CheckFn } from '../types.js';

const imageAltText: CheckFn = (ctx) => {
  const c = check('a11y.image-alt-text', 'accessibility', 'Image alt text', 'medium');
  const images = allPlacedImages(ctx);
  if (images.length === 0) return c.na('the content spec places no images');

  const described = images.filter((image) => (image.alt ?? '').trim() !== '');
  const ratio = described.length / images.length;

  if (ratio === 0) {
    return c.fail(
      [`0 of ${images.length} placed images carry alt text; the renderer marks all of them decorative (alt="")`],
      'Capture real alt text at collection time, or add it to the images this business actually uses — never invent a description.',
    );
  }
  if (ratio < 0.5) {
    return c.warn(
      [`${described.length} of ${images.length} placed images carry alt text`],
      'Most images on the page are marked decorative. Add real alt text where a photograph carries information a caption would.',
    );
  }
  return c.pass([`${described.length} of ${images.length} placed images carry alt text`]);
};

const headingStructure: CheckFn = (ctx) => {
  const c = check('a11y.heading-structure', 'accessibility', 'Single, well-formed <h1>', 'high');
  const h1Count = countMatches(ctx.html, /<h1[\s>]/g);
  if (h1Count === 1) return c.pass(['exactly one <h1> in the rendered document']);
  if (h1Count === 0) {
    return c.fail(['no <h1> in the rendered document'], 'Every page needs exactly one <h1> naming the page\'s primary subject.');
  }
  return c.fail([`${h1Count} <h1> elements in the rendered document`], 'Collapse to a single <h1>; a document outline needs one top-level heading.');
};

const landmarksSkipLink: CheckFn = (ctx) => {
  const c = check('a11y.landmarks-skip-link', 'accessibility', 'Landmarks and skip link', 'medium');
  const required: readonly [string, RegExp][] = [
    ['skip link', /<a class="skip-link" href="#main">/],
    ['<header>', /<header[\s>]/],
    ['<nav>', /<nav[\s>]/],
    ['<main id="main"', /<main id="main"/],
    ['<footer>', /<footer[\s>]/],
  ];
  const missing = required.filter(([, pattern]) => !pattern.test(ctx.html)).map(([name]) => name);
  if (missing.length === 0) return c.pass(['skip link and all four landmark elements are present']);
  // A page with no linkable sections legitimately has no <nav>; only flag it
  // alongside the others.
  if (missing.length === 1 && missing[0] === '<nav>') {
    return c.pass(['skip link and all four landmark elements are present (no <nav> — the page has nothing to link between)']);
  }
  return c.fail([`missing: ${missing.join(', ')}`], 'Restore the skip link and the landmark elements a screen reader relies on to navigate the page.');
};

const colorContrast: CheckFn = (ctx) => {
  const c = check('a11y.color-contrast', 'accessibility', 'Text contrast', 'high');
  const { contrast } = ctx.design.tokens.color;
  const { minContrastBody } = ctx.design.accessibility;

  const pairs: readonly [string, number][] = [
    ['text on canvas', contrast.textOnCanvas],
    ['text on surface', contrast.textOnSurface],
    ['muted text on canvas', contrast.mutedOnCanvas],
  ];
  const failing = pairs.filter(([, ratio]) => ratio < minContrastBody);

  if (failing.length === 0) {
    return c.pass(pairs.map(([name, ratio]) => `${name}: ${ratio.toFixed(2)}:1 (target ${minContrastBody}:1)`));
  }
  return c.fail(
    failing.map(([name, ratio]) => `${name}: ${ratio.toFixed(2)}:1, below the ${minContrastBody}:1 target for ${ctx.design.accessibility.targetLevel}`),
    'Adjust the colour ramp so every body-text pairing clears the target contrast ratio.',
  );
};

const reducedMotion: CheckFn = (ctx) => {
  const c = check('a11y.reduced-motion', 'accessibility', 'Respects prefers-reduced-motion', 'medium');
  if (ctx.design.tokens.motion.level === 'none') {
    return c.na('design.tokens.motion.level is "none"; there is no motion to gate');
  }
  const hasMediaQuery = /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(ctx.css);
  if (hasMediaQuery && ctx.design.tokens.motion.respectReducedMotion) {
    return c.pass([`motion level "${ctx.design.tokens.motion.level}" is gated by a prefers-reduced-motion media query in the stylesheet`]);
  }
  return c.fail(
    ['stylesheet has no prefers-reduced-motion media query for a design with active motion'],
    'Wrap animation and transition rules in @media (prefers-reduced-motion: reduce) so motion-sensitive visitors can turn it off.',
  );
};

const tapTargets: CheckFn = (ctx) => {
  const c = check('a11y.tap-targets', 'accessibility', 'Minimum tap target size', 'medium');
  const min = ctx.design.accessibility.minTapTargetPx;
  // 44px is the WCAG 2.5.5 (AA, target size minimum) and iOS HIG floor.
  if (min >= 44) return c.pass([`minTapTargetPx is ${min}`]);
  return c.fail([`minTapTargetPx is ${min}, below the 44px accessible minimum`], 'Raise the design\'s minimum tap target to at least 44px.');
};

export const accessibilityChecks: readonly CheckFn[] = [
  imageAltText,
  headingStructure,
  landmarksSkipLink,
  colorContrast,
  reducedMotion,
  tapTargets,
];
