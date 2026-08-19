/**
 * Functional readiness: does the site do the mechanical things a production
 * site is expected to do, given what this run actually rendered.
 */

import { check, hasFile } from '../helpers.js';
import type { CheckFn } from '../types.js';

const custom404: CheckFn = (ctx) => {
  const c = check('functional.custom-404', 'functional-readiness', 'Custom 404 page', 'medium');
  if (hasFile(ctx, /^404\.html$/i)) {
    return c.pass(['404.html is present in the rendered output']);
  }
  return c.fail(
    [`rendered site has ${ctx.site.files.length} file(s): ${ctx.site.files.map((f) => f.path).join(', ')}; no 404.html among them`],
    'Serve a branded 404 — render one from the same design system, or configure the hosting platform\'s custom error page once a host is chosen.',
  );
};

const primaryCta: CheckFn = (ctx) => {
  const c = check('functional.primary-cta', 'functional-readiness', 'Primary call to action', 'high');
  const withCta = ctx.content.sections.filter((section) => section.callToAction !== null);
  if (withCta.length === 0) {
    return c.fail(
      ['no section in the content spec carries a callToAction'],
      'Give the hero or a closing cta section a clear primary action (call, book, get directions) grounded in a real contact channel.',
    );
  }
  return c.pass(withCta.map((section) => `"${section.kind}" section links to "${section.callToAction?.href}"`));
};

/** Phone-shaped hrefs, matched the same way the renderer resolves a "phone" CTA target. */
const TEL_HREF = /^tel:/i;

const mobileCta: CheckFn = (ctx) => {
  const c = check('functional.mobile-cta', 'functional-readiness', 'Reachable phone CTA', 'high');
  if (ctx.profile.phones.length === 0) {
    return c.na('no phone number is published for this business; there is nothing to call');
  }

  // Reachable without scrolling past the first screen or the closing pitch:
  // hero, the section immediately after it, or the cta/contact sections.
  const early = ctx.content.sections.slice(0, 2);
  const closing = ctx.content.sections.filter((s) => s.kind === 'cta' || s.kind === 'contact');
  const candidates = [...early, ...closing];

  const found = candidates.find((section) => TEL_HREF.test(section.callToAction?.href ?? ''));
  if (found !== undefined) {
    return c.pass([`"${found.kind}" section carries a tel: call to action reachable early in the page`]);
  }

  const anywhere = ctx.content.sections.find((section) => TEL_HREF.test(section.callToAction?.href ?? ''));
  if (anywhere !== undefined) {
    return c.warn(
      [`a tel: call to action exists only in the "${anywhere.kind}" section, not within reach of the hero or the closing sections`],
      'Move (or add) a "Call" button into the hero or the cta/contact section so a mobile visitor can act without scrolling the whole page.',
    );
  }

  return c.fail(
    [`profile lists a phone number (${ctx.profile.phones[0]?.value.formatted}) but no section links to it`],
    'Add a tel: call to action, grounded in the verified phone number, to the hero or the closing section.',
  );
};

const internalLinking: CheckFn = (ctx) => {
  const c = check('functional.internal-linking', 'functional-readiness', 'Internal linking between sections', 'low');
  const linkable = ctx.content.sections.filter((s) => s.kind !== 'hero' && s.kind !== 'cta' && s.heading.trim() !== '');
  if (linkable.length < 2) {
    return c.na(`only ${linkable.length} section(s) are link targets; a single-topic page has nothing to link between`);
  }
  // The renderer builds nav from exactly these sections (see lib/render/site.ts
  // buildNav); a design that suppresses navigation is the one way the page can
  // still have zero cross-links despite having the sections for it.
  const navSuppressed = !ctx.design.layout.showNavigation;
  if (navSuppressed) {
    return c.warn(
      [`design.layout.showNavigation is false with ${linkable.length} linkable sections`],
      'Enable in-page navigation, or provide another way to move between sections, so a visitor is not limited to scrolling.',
    );
  }
  return c.pass([`${linkable.length} sections are reachable from the header navigation`]);
};

const thankYouState: CheckFn = (ctx) => {
  const c = check('functional.thank-you-state', 'functional-readiness', 'Thank-you / success state', 'medium');
  const hasForm = /<form[\s>]/i.test(ctx.html);
  if (!hasForm) {
    return c.na('the rendered page has no <form>; there is no submission to confirm');
  }
  return c.fail(
    ['a <form> is present in the rendered output, but the renderer emits no confirmation or success state'],
    'Add a thank-you state (a confirmation section, a redirect, or an inline message) for the form the page now has.',
  );
};

const breadcrumbs: CheckFn = (ctx) => {
  const c = check('functional.breadcrumbs', 'functional-readiness', 'Breadcrumb navigation', 'low');
  return c.na(
    `the renderer emits one document (${ctx.site.files.filter((f) => f.path.endsWith('.html')).length} HTML file); breadcrumbs orient a visitor across pages, which this site does not have`,
  );
};

const loadingErrorSuccessStates: CheckFn = (ctx) => {
  const c = check(
    'functional.loading-error-success-states',
    'functional-readiness',
    'Loading, error and success states',
    'medium',
  );
  const interactive = /<form[\s>]/i.test(ctx.html) || /type="submit"/i.test(ctx.html);
  if (!interactive) {
    return c.na('no form or submission control is rendered; there is no asynchronous state to cover');
  }
  return c.fail(
    ['an interactive submission control is rendered, but the page is static HTML with no script to show loading, error or success states'],
    'Either remove the interactive control or implement the states it implies before shipping it.',
  );
};

const mobileBehavior: CheckFn = (ctx) => {
  const c = check('functional.mobile-behavior', 'functional-readiness', 'Mobile-first responsive behaviour', 'medium');
  const evidence: string[] = [];
  const problems: string[] = [];

  if (/<meta name="viewport" content="width=device-width, initial-scale=1">/.test(ctx.html)) {
    evidence.push('viewport meta tag is present');
  } else {
    problems.push('no responsive viewport meta tag');
  }

  const mediaQueries = (ctx.css.match(/@media/g) ?? []).length;
  if (mediaQueries > 0) {
    evidence.push(`stylesheet declares ${mediaQueries} @media rule(s)`);
  } else {
    problems.push('stylesheet declares no @media rules');
  }

  if (!ctx.design.responsive.fluid) {
    problems.push('design.responsive.fluid is false');
  } else {
    evidence.push(`fluid type/spacing between ${ctx.design.responsive.breakpoints.smRem}rem and ${ctx.design.responsive.breakpoints.lgRem}rem breakpoints`);
  }

  if (problems.length > 0) {
    return c.fail([...evidence, ...problems], 'Restore a responsive viewport meta tag and fluid, breakpoint-aware styling.');
  }
  return c.pass(evidence);
};

export const functionalChecks: readonly CheckFn[] = [
  custom404,
  primaryCta,
  mobileCta,
  internalLinking,
  thankYouState,
  breadcrumbs,
  loadingErrorSuccessStates,
  mobileBehavior,
];
