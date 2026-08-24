/**
 * P4-3 â€” Accessibility gate (N-12): DOM checks, keyboard sweep, rendered
 * contrast, axe consumption. A fixture with a known violation must fail.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { gateAccessibility, CONTRAST_BODY, CONTRAST_LARGE } from '../../../lib/qa/gates/accessibility.js';
import type { AccessibilityEvidence } from '../../../lib/qa/gates/accessibility.js';

const CLEAN: AccessibilityEvidence = {
  hasMainLandmark: true,
  hasSkipLink: true,
  lang: 'en',
  imagesMissingAlt: 0,
  totalImages: 4,
  headingGaps: [],
  keyboard: [
    { index: 0, target: 'a.skip-link', reachable: true },
    { index: 1, target: 'nav', reachable: true },
    { index: 2, target: 'a#main-content', reachable: true },
    { index: 3, target: 'a.button--primary', reachable: true },
    { index: 4, target: 'form input', reachable: true },
    { index: 5, target: 'footer a', reachable: true },
    { index: 6, target: 'a.back-to-top', reachable: true },
    { index: 7, target: 'body', reachable: true },
  ],
  contrast: [
    { selector: 'body', ratio: 12.4, large: false },
    { selector: 'h1', ratio: 7.1, large: true },
    { selector: 'a', ratio: 4.9, large: false },
  ],
  axeViolations: [],
};

function check(result: { checks: readonly { id: string; passed: boolean }[] }, id: string): boolean {
  const match = result.checks.find((c) => c.id === id);
  assert.ok(match, `check ${id} ran`);
  return match.passed;
}

test('a clean page passes every check', () => {
  const result = gateAccessibility(CLEAN);
  assert.equal(result.passed, true);
  assert.equal(result.checks.length, 8);
});

test('missing alt on images fails (fixture with a known violation)', () => {
  const result = gateAccessibility({ ...CLEAN, imagesMissingAlt: 2 });
  assert.equal(result.passed, false);
  assert.equal(check(result, 'a11y.image-alt'), false);
});

test('no main landmark fails', () => {
  const result = gateAccessibility({ ...CLEAN, hasMainLandmark: false });
  assert.equal(result.passed, false);
  assert.equal(check(result, 'a11y.main-landmark'), false);
});

test('a keyboard trap fails the sweep', () => {
  const result = gateAccessibility({
    ...CLEAN,
    keyboard: CLEAN.keyboard.map((s) => (s.target === 'form input' ? { ...s, reachable: false, reason: 'focus never leaves the input' } : s)),
  });
  assert.equal(result.passed, false);
  assert.equal(check(result, 'a11y.keyboard'), false);
});

test('body text below 4.5:1 fails contrast', () => {
  const result = gateAccessibility({
    ...CLEAN,
    contrast: [{ selector: 'body', ratio: CONTRAST_BODY - 0.1, large: false }],
  });
  assert.equal(result.passed, false);
  assert.equal(check(result, 'a11y.contrast'), false);
});

test('large text uses the 3:1 floor', () => {
  const passLarge = gateAccessibility({ ...CLEAN, contrast: [{ selector: 'h1', ratio: CONTRAST_LARGE, large: true }] });
  assert.equal(check(passLarge, 'a11y.contrast'), true);
  const failLarge = gateAccessibility({ ...CLEAN, contrast: [{ selector: 'h1', ratio: CONTRAST_LARGE - 0.1, large: true }] });
  assert.equal(check(failLarge, 'a11y.contrast'), false);
});

test('serious axe violations block even when DOM checks pass', () => {
  const result = gateAccessibility({
    ...CLEAN,
    axeViolations: [
      { id: 'color-contrast', impact: 'serious', nodes: [{ html: '<a>' }] },
    ],
  });
  assert.equal(result.passed, false);
  assert.equal(check(result, 'a11y.axe'), false);
});

test('minor axe violations are recorded but do not block', () => {
  const result = gateAccessibility({
    ...CLEAN,
    axeViolations: [
      { id: 'landmark-unique', impact: 'moderate', nodes: [{ html: '<nav>' }] },
    ],
  });
  assert.equal(result.passed, true, 'minor axe violations do not block');
});
