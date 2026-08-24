/**
 * `lib/forge/decide.ts` — the two decisions `main.ts`'s `'enhance'` step and
 * `scripts/benchmark-10.ts`'s benchmark harness share, so they cannot
 * silently disagree about when Forge runs or what it means to ship, the way
 * the benchmark harness and the real pipeline used to.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldAttemptEnhance, shouldShipEnhancedSite } from '../../lib/forge/decide.js';

import type { CombinedVerdict } from '../../lib/qa/verdict.js';

function verdict(overrides: Partial<CombinedVerdict> = {}): CombinedVerdict {
  return { verdict: 'PASS', blockingFailure: null, uncertain: null, quality: 80, reasons: [], ...overrides };
}

test('tier0 (the default) never attempts enhance, even with engine=signature', () => {
  assert.equal(shouldAttemptEnhance('signature', 'tier0'), false);
});

test('engine=template never attempts enhance, at any budget tier', () => {
  assert.equal(shouldAttemptEnhance('template', 'tier1'), false);
  assert.equal(shouldAttemptEnhance('template', 'tier2'), false);
  assert.equal(shouldAttemptEnhance('template', 'tier3'), false);
});

test('engine=signature with a non-tier0 budget attempts enhance', () => {
  assert.equal(shouldAttemptEnhance('signature', 'tier1'), true);
  assert.equal(shouldAttemptEnhance('signature', 'tier2'), true);
  assert.equal(shouldAttemptEnhance('signature', 'tier3'), true);
});

test('a PASS verdict ships the enhanced site', () => {
  assert.equal(shouldShipEnhancedSite(verdict({ verdict: 'PASS' })), true);
});

test('a FAIL verdict — structural, genericity, or uncertain — never ships the enhanced site', () => {
  assert.equal(shouldShipEnhancedSite(verdict({ verdict: 'FAIL', blockingFailure: 'structural' })), false);
  assert.equal(shouldShipEnhancedSite(verdict({ verdict: 'FAIL', blockingFailure: 'genericity' })), false);
  assert.equal(shouldShipEnhancedSite(verdict({ verdict: 'FAIL', uncertain: 'genericity' })), false);
});
