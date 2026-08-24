/**
 * Decision Gate §1.J / §8 item 8 — production preflight combines the
 * technical, accessibility and performance gates into one verdict, and that
 * verdict can downgrade a pending `deliver` decision to `escalate`.
 *
 * These are the pure halves: `gatePreflight`'s combination rule and
 * `applyPreflightToDecision`'s decision transition. Neither launches a
 * browser — `collectPreflightEvidence` (the Playwright half) is exercised
 * only by the wiring proof in `p7-runjobfull.test.ts`, which does not launch
 * one either (it stubs `runStage`), and by a real run of the pipeline.
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { gatePreflight, applyPreflightToDecision } from '../../lib/qa/preflight.js';
import { gateStructuredData } from '../../lib/qa/gates/structuredData.js';
import type { PreflightEvidence } from '../../lib/qa/preflight.js';

const CLEAN_EVIDENCE: PreflightEvidence = {
  functional: { pageErrors: [], consoleErrors: [], failedRequests: [] },
  security: {
    inlineEventHandlers: [],
    javascriptUrls: [],
    dataUrls: [],
    insecureHttpResources: [],
    externalLinksWithoutNoopener: [],
    scriptTags: 0,
    externalScripts: [],
    iframes: [],
    formsWithoutAction: 0,
    contentSecurityPolicy: null,
  },
  accessibility: {
    hasMainLandmark: true,
    hasSkipLink: true,
    lang: 'en',
    imagesMissingAlt: 0,
    totalImages: 4,
    headingGaps: [],
    keyboard: [],
    contrast: [],
  },
  performance: { pageBytes: 100_000, largestImageBytes: 50_000, domNodes: 500 },
  structuredData: {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Padaria Ana',
    address: { '@type': 'PostalAddress', streetAddress: 'Rua X', addressLocality: 'Lisbon' },
  },
};

test('a clean page passes preflight', () => {
  const result = gatePreflight(CLEAN_EVIDENCE);
  assert.equal(result.passed, true);
  assert.equal(result.technical.passed, true);
  assert.equal(result.accessibility.passed, true);
});

test('a security violation fails preflight', () => {
  const evidence: PreflightEvidence = {
    ...CLEAN_EVIDENCE,
    security: { ...CLEAN_EVIDENCE.security, javascriptUrls: ['javascript:alert(1)'] },
  };
  const result = gatePreflight(evidence);
  assert.equal(result.passed, false);
  assert.equal(result.technical.passed, false);
});

test('an accessibility violation fails preflight', () => {
  const evidence: PreflightEvidence = {
    ...CLEAN_EVIDENCE,
    accessibility: { ...CLEAN_EVIDENCE.accessibility, hasMainLandmark: false },
  };
  const result = gatePreflight(evidence);
  assert.equal(result.passed, false);
  assert.equal(result.accessibility.passed, false);
});

test('an over-budget page is a caveat, never a failure — performance cannot block preflight', () => {
  const evidence: PreflightEvidence = {
    ...CLEAN_EVIDENCE,
    performance: { pageBytes: 50_000_000, largestImageBytes: 10_000_000, domNodes: 100_000 },
  };
  const result = gatePreflight(evidence);
  assert.equal(result.passed, true, 'performance alone must never fail preflight (Freeze N-13)');
  assert.ok(result.performance.caveats.length > 0, 'the caveats are still recorded');
});

test('invalid structured data is an issue, never a preflight failure', () => {
  const evidence: PreflightEvidence = {
    ...CLEAN_EVIDENCE,
    structuredData: { '@type': 'LocalBusiness' }, // no @context, no name/address
  };
  const result = gatePreflight(evidence);
  assert.equal(result.passed, true, 'structured-data issues alone must never fail preflight, same tolerance as performance');
  assert.equal(result.structuredData.valid, false);
  assert.ok(result.structuredData.issues.length > 0, 'the issues are still recorded');
});

/* ------------------------------------------------------------------ */
/* gateStructuredData                                                  */
/* ------------------------------------------------------------------ */

describe('gateStructuredData', () => {
  it('an empty object is valid — nothing to check, not itself an issue', () => {
    assert.deepEqual(gateStructuredData({}), { valid: true, issues: [] });
  });

  it('a well-formed LocalBusiness with a nested PostalAddress is valid', () => {
    const result = gateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Padaria Ana',
      address: { '@type': 'PostalAddress', streetAddress: 'Rua X', addressLocality: 'Lisbon' },
    });
    assert.deepEqual(result, { valid: true, issues: [] });
  });

  it('flags a missing @context', () => {
    const result = gateStructuredData({ '@type': 'LocalBusiness', name: 'X', address: 'Y' });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.includes('@context')));
  });

  it('flags a @context that does not reference schema.org', () => {
    const result = gateStructuredData({ '@context': 'https://example.com', '@type': 'LocalBusiness', name: 'X', address: 'Y' });
    assert.ok(result.issues.some((i) => i.includes('@context')));
  });

  it('flags a missing @type', () => {
    const result = gateStructuredData({ '@context': 'https://schema.org' });
    assert.ok(result.issues.some((i) => i.includes('@type')));
  });

  it('flags a LocalBusiness missing required "address"', () => {
    const result = gateStructuredData({ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'X' });
    assert.ok(result.issues.some((i) => i.includes('address')));
  });

  it('a numeric required property (e.g. AggregateRating.ratingValue) counts as present — regression for a real bug found against a live artifact', () => {
    // The original check only accepted strings/objects as "present", which
    // flagged a genuinely correct `ratingValue: 4.9` as missing on every one
    // of a real 10-business benchmark's rendered pages — every business has
    // a rating, and every rating is a number, so this was a systemic false
    // positive, not an edge case.
    const result = gateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'X',
      address: 'Y',
      aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.9, reviewCount: 38 },
    });
    assert.deepEqual(result, { valid: true, issues: [] });
  });

  it('a required property that is the number 0 or the boolean false still counts as present, not missing', () => {
    const result = gateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'AggregateRating',
      ratingValue: 0,
    });
    assert.deepEqual(result, { valid: true, issues: [] });
  });

  it('flags a blank string value as present-but-blank', () => {
    const result = gateStructuredData({
      '@context': 'https://schema.org', '@type': 'Organization', name: '   ',
    });
    assert.ok(result.issues.some((i) => i.includes('present but blank')));
  });

  it('accepts an @type that is an array', () => {
    const result = gateStructuredData({
      '@context': 'https://schema.org', '@type': ['LocalBusiness', 'Restaurant'], name: 'X', address: 'Y',
    });
    assert.deepEqual(result, { valid: true, issues: [] });
  });

  it('does not flag a type outside its known vocabulary — no required-property claim beyond what it knows', () => {
    const result = gateStructuredData({ '@context': 'https://schema.org', '@type': 'SomeUnknownType' });
    assert.deepEqual(result, { valid: true, issues: [] });
  });

  it('recurses into a malformed nested node (e.g. address with no streetAddress)', () => {
    const result = gateStructuredData({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'X',
      address: { '@type': 'PostalAddress', addressLocality: 'Lisbon' },
    });
    assert.ok(result.issues.some((i) => i.includes('streetAddress')));
  });

  it('is deterministic', () => {
    const data = { '@context': 'https://schema.org', '@type': 'Organization', name: 'X' };
    assert.deepEqual(gateStructuredData(data), gateStructuredData(data));
  });
});

/* ------------------------------------------------------------------ */
/* applyPreflightToDecision — the decision transition                  */
/* ------------------------------------------------------------------ */

test('a passing preflight leaves a pending delivery alone', () => {
  const outcome = applyPreflightToDecision({ currentDecision: 'deliver', preflightPassed: true });
  assert.equal(outcome.downgraded, false);
  assert.equal(outcome.decision, 'deliver');
  assert.equal(outcome.clearFinalOutput, false);
});

test('a failing preflight downgrades a pending delivery to escalate — the critical-failure-blocks-deployment rule', () => {
  const outcome = applyPreflightToDecision({ currentDecision: 'deliver', preflightPassed: false });
  assert.equal(outcome.downgraded, true);
  assert.equal(outcome.decision, 'escalate');
  assert.equal(outcome.clearFinalOutput, true, 'a downgraded job must not keep pointing at a finalOutput');
});

test('preflight never touches a job hermes already escalated', () => {
  const outcome = applyPreflightToDecision({ currentDecision: 'escalate', preflightPassed: false });
  assert.equal(outcome.downgraded, false);
  assert.equal(outcome.decision, 'escalate');
  assert.equal(outcome.clearFinalOutput, false);
});

test('preflight never promotes a running or reconcept job to deliver', () => {
  for (const currentDecision of ['running', 'reconcept'] as const) {
    const outcome = applyPreflightToDecision({ currentDecision, preflightPassed: true });
    assert.equal(outcome.decision, currentDecision, `${currentDecision} must not change`);
    assert.equal(outcome.downgraded, false);
  }
});
