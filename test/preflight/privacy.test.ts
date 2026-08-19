import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { privacyChecks } from '../../lib/preflight/checks/privacy.js';
import { buildContext } from './support.js';

import type { PreflightContext } from '../../lib/preflight/types.js';

function runOn(ctx: PreflightContext, id: string) {
  const result = privacyChecks.map((check) => check(ctx)).find((r) => r.id === id);
  assert.ok(result, `no check registered with id "${id}"`);
  return result;
}

const GA_SCRIPT = '<script src="https://www.googletagmanager.com/gtag/js?id=G-TEST"></script>';
const CONSENT_BANNER = '<div class="cookie-consent">We use cookies. Accept cookies to continue.</div>';

describe('privacy.privacy-policy', () => {
  it('is not applicable for a static page with no analytics and no form', () => {
    const ctx = buildContext();
    assert.equal(runOn(ctx, 'privacy.privacy-policy').status, 'NOT_APPLICABLE');
  });

  it('fails when analytics is present with no privacy policy reference', () => {
    const base = buildContext();
    const ctx = { ...base, html: `${GA_SCRIPT}${base.html}` };
    assert.equal(runOn(ctx, 'privacy.privacy-policy').status, 'FAIL');
  });

  it('passes when a privacy policy is referenced alongside analytics', () => {
    const base = buildContext();
    const ctx = { ...base, html: `${GA_SCRIPT}<a href="/privacy">Privacy Policy</a>${base.html}` };
    assert.equal(runOn(ctx, 'privacy.privacy-policy').status, 'PASS');
  });
});

describe('privacy.analytics-consent (required: missing consent handling when analytics requires it)', () => {
  it('is not applicable when no analytics vendor is present', () => {
    const ctx = buildContext();
    assert.equal(runOn(ctx, 'privacy.analytics-consent').status, 'NOT_APPLICABLE');
  });

  it('fails critically when a consent-requiring vendor ships with no consent mechanism', () => {
    const base = buildContext();
    const ctx = { ...base, html: `${GA_SCRIPT}${base.html}` };
    const result = runOn(ctx, 'privacy.analytics-consent');
    assert.equal(result.status, 'FAIL');
    assert.equal(result.severity, 'critical');
  });

  it('passes when a consent mechanism accompanies the analytics vendor', () => {
    const base = buildContext();
    const ctx = { ...base, html: `${GA_SCRIPT}${CONSENT_BANNER}${base.html}` };
    assert.equal(runOn(ctx, 'privacy.analytics-consent').status, 'PASS');
  });

  it('passes for a consent-exempt, cookieless vendor with no banner', () => {
    const base = buildContext();
    const ctx = { ...base, html: `<script src="https://plausible.io/js/script.js"></script>${base.html}` };
    assert.equal(runOn(ctx, 'privacy.analytics-consent').status, 'PASS');
  });
});
