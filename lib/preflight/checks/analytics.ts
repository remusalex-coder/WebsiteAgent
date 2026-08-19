/**
 * Analytics and measurement: whether the business can see who is visiting.
 * `privacy.analytics-consent` (privacy-compliance) asks the compliance
 * question about the same evidence; this asks the measurement question.
 */

import { analyticsNeedsConsent, check, detectAnalytics, hasConsentMechanism } from '../helpers.js';
import type { CheckFn } from '../types.js';

const analyticsPresence: CheckFn = (ctx) => {
  const c = check('analytics.presence', 'analytics-measurement', 'Traffic measurement', 'low');
  const found = detectAnalytics(ctx.html);

  if (found.length === 0) {
    return c.warn(
      ['no analytics vendor detected in the rendered output'],
      'Add privacy-respecting analytics (e.g. Plausible, Fathom, or consent-gated Google Analytics) so the business can see whether the site gets visited.',
    );
  }
  if (analyticsNeedsConsent(ctx.html) && !hasConsentMechanism(ctx.html)) {
    return c.fail(
      [`analytics vendor detected (${found.join(', ')}) with no consent mechanism`],
      'Fix the consent gap before counting this as shipped — see privacy.analytics-consent.',
    );
  }
  return c.pass([`analytics vendor detected: ${found.join(', ')}`]);
};

export const analyticsChecks: readonly CheckFn[] = [analyticsPresence];
