/**
 * P4-4 â€” Functional + security gate promotion (N-11).
 *
 * The three collected-but-unasserted fields (`dataUrls`, `iframes`,
 * `formsWithoutAction`) are asserted, and a CSP assertion gates inline/scripted
 * pages.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { gateFunctionalSecurity } from '../../../lib/qa/gates/technical.js';
import type { SecurityEvidence, FunctionalEvidence } from '../../../lib/qa/gates/technical.js';

const CLEAN_SEC: SecurityEvidence = {
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
};

const CLEAN_FUNC: FunctionalEvidence = {
  pageErrors: [],
  consoleErrors: [],
  failedRequests: [],
};

function check(result: { checks: readonly { id: string; passed: boolean }[] }, id: string): boolean {
  const match = result.checks.find((c) => c.id === id);
  assert.ok(match, `check ${id} ran`);
  return match.passed;
}

test('a clean page passes every check', () => {
  const result = gateFunctionalSecurity(CLEAN_FUNC, CLEAN_SEC);
  assert.equal(result.passed, true);
  assert.equal(result.checks.length, 12);
});

test('data: hrefs are asserted (P4-4)', () => {
  const result = gateFunctionalSecurity(CLEAN_FUNC, { ...CLEAN_SEC, dataUrls: ['data:text/html;base64,xxx'] });
  assert.equal(result.passed, false);
  assert.equal(check(result, 'security.no-data-urls'), false);
});

test('an unapproved iframe fails the gate — the default posture is unchanged (P4-4)', () => {
  const result = gateFunctionalSecurity(CLEAN_FUNC, { ...CLEAN_SEC, iframes: ['https://evil.example.com/embed'] });
  assert.equal(result.passed, false);
  assert.equal(check(result, 'security.no-unapproved-iframes'), false);
});

test('an iframe with no src (or a malformed one) is treated as unapproved, never as harmless', () => {
  for (const src of ['', 'not a url', '/relative/path']) {
    const result = gateFunctionalSecurity(CLEAN_FUNC, { ...CLEAN_SEC, iframes: [src] });
    assert.equal(check(result, 'security.no-unapproved-iframes'), false, `"${src}" must fail`);
  }
});

test('an iframe from the approved OpenStreetMap embed origin passes — the allow-list actually allows something', () => {
  const result = gateFunctionalSecurity(CLEAN_FUNC, {
    ...CLEAN_SEC,
    iframes: ['https://www.openstreetmap.org/export/embed.html?bbox=1,2,3,4'],
  });
  assert.equal(result.passed, true);
  assert.equal(check(result, 'security.no-unapproved-iframes'), true);
});

test('one approved iframe alongside one unapproved iframe still fails — allow-listing one origin does not open the gate to others', () => {
  const result = gateFunctionalSecurity(CLEAN_FUNC, {
    ...CLEAN_SEC,
    iframes: [
      'https://www.openstreetmap.org/export/embed.html?bbox=1,2,3,4',
      'https://evil.example.com/embed',
    ],
  });
  assert.equal(result.passed, false);
  assert.equal(check(result, 'security.no-unapproved-iframes'), false);
});

test('a subdomain or look-alike of an approved origin is not approved — origin match is exact', () => {
  const result = gateFunctionalSecurity(CLEAN_FUNC, {
    ...CLEAN_SEC,
    iframes: ['https://www.openstreetmap.org.evil.com/embed.html'],
  });
  assert.equal(check(result, 'security.no-unapproved-iframes'), false);
});

test('forms without an action are asserted (P4-4)', () => {
  const result = gateFunctionalSecurity(CLEAN_FUNC, { ...CLEAN_SEC, formsWithoutAction: 2 });
  assert.equal(result.passed, false);
  assert.equal(check(result, 'security.forms-have-action'), false);
});

test('an inline-scripted page without a CSP fails', () => {
  const result = gateFunctionalSecurity(CLEAN_FUNC, { ...CLEAN_SEC, inlineEventHandlers: ['a[onclick]'], scriptTags: 1 });
  assert.equal(result.passed, false);
  assert.equal(check(result, 'security.content-security-policy'), false);
});

test('a CSP declared on the page satisfies the assertion', () => {
  const result = gateFunctionalSecurity(CLEAN_FUNC, {
    ...CLEAN_SEC,
    inlineEventHandlers: ['a[onclick]'],
    contentSecurityPolicy: "default-src 'self'",
  });
  assert.equal(check(result, 'security.content-security-policy'), true);
});

test('console errors fail the functional gate', () => {
  const result = gateFunctionalSecurity({ ...CLEAN_FUNC, consoleErrors: ['Failed to load resource'] }, CLEAN_SEC);
  assert.equal(result.passed, false);
  assert.equal(check(result, 'page.no-console-errors'), false);
});

test('every check carries a detail', () => {
  const result = gateFunctionalSecurity(CLEAN_FUNC, CLEAN_SEC);
  for (const check of result.checks) {
    assert.ok(check.detail.length > 0, `${check.id} has a detail`);
  }
});
