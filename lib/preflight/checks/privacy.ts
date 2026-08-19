/**
 * Privacy and compliance: whether the site collects anything that obliges it
 * to disclose or gate that collection.
 */

import { analyticsNeedsConsent, check, detectAnalytics, hasConsentMechanism } from '../helpers.js';
import type { CheckFn } from '../types.js';

function collectsData(html: string): boolean {
  return detectAnalytics(html).length > 0 || /<form[\s>]/i.test(html);
}

const privacyPolicy: CheckFn = (ctx) => {
  const c = check('privacy.privacy-policy', 'privacy-compliance', 'Privacy policy disclosure', 'high');
  if (!collectsData(ctx.html)) {
    return c.na('no analytics, tracking or form is rendered; a purely static informational page collects nothing to disclose');
  }
  if (/privacy/i.test(ctx.html)) {
    return c.pass(['the rendered page references "privacy" (a policy link or mention)']);
  }
  return c.fail(
    ['data-collecting functionality (analytics or a form) is present, but no privacy policy reference appears anywhere in the rendered page'],
    'Publish a privacy policy and link it from the footer before shipping analytics or a data-collecting form.',
  );
};

const analyticsConsent: CheckFn = (ctx) => {
  const c = check('privacy.analytics-consent', 'privacy-compliance', 'Consent gating for analytics', 'critical');
  const found = detectAnalytics(ctx.html);
  if (found.length === 0) {
    return c.na('no analytics vendor is present in the rendered output; there is nothing for consent to gate');
  }
  if (!analyticsNeedsConsent(ctx.html)) {
    return c.pass([`analytics vendor detected (${found.join(', ')}) is a consent-exempt, cookieless provider`]);
  }
  if (hasConsentMechanism(ctx.html)) {
    return c.pass([`analytics vendor detected (${found.join(', ')})`, 'a consent mechanism is referenced in the rendered output']);
  }
  return c.fail(
    [`analytics vendor requiring consent detected (${found.join(', ')})`, 'no cookie-consent banner, GDPR notice, or consent-mode default was found'],
    'Gate the analytics script behind a consent banner, or switch to a consent-exempt provider (e.g. Plausible, Fathom) before shipping it.',
  );
};

export const privacyChecks: readonly CheckFn[] = [privacyPolicy, analyticsConsent];
