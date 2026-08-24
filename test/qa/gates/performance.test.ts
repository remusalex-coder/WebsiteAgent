/**
 * P4-5 â€” Performance budgets: over-budget is a caveat, not a hard fail (N-13).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { gatePerformance, DEFAULT_BUDGETS } from '../../../lib/qa/gates/performance.js';
import type { PerformanceEvidence } from '../../../lib/qa/gates/performance.js';

const SLIM: PerformanceEvidence = {
  pageBytes: 300_000,
  largestImageBytes: 120_000,
  domNodes: 800,
  lcpMs: 1_100,
  cls: 0.02,
};

test('a slim page is within budget with no caveats', () => {
  const result = gatePerformance(SLIM);
  assert.equal(result.withinBudget, true);
  assert.equal(result.caveats.length, 0);
});

test('an over-budget page produces caveats, never a hard fail', () => {
  const result = gatePerformance({
    pageBytes: 5_000_000,
    largestImageBytes: 2_000_000,
    domNodes: 9_000,
    lcpMs: 4_000,
    cls: 0.3,
  });
  assert.equal(result.withinBudget, false);
  assert.equal(result.caveats.length, 5);
  const ids = result.caveats.map((c) => c.id);
  assert.ok(ids.includes('perf.page-weight'));
  assert.ok(ids.includes('perf.largest-image'));
  assert.ok(ids.includes('perf.dom-nodes'));
  assert.ok(ids.includes('perf.lcp'));
  assert.ok(ids.includes('perf.cls'));
});

test('a caveat names measured and budget values', () => {
  const result = gatePerformance({ pageBytes: 3_000_000, largestImageBytes: 100_000, domNodes: 500 });
  assert.equal(result.caveats.length, 1);
  assert.equal(result.caveats[0]?.measured, 3_000_000);
  assert.equal(result.caveats[0]?.budget, DEFAULT_BUDGETS.maxPageBytes);
});

test('missing LCP/CLS are not asserted, not assumed', () => {
  const result = gatePerformance({ pageBytes: 100_000, largestImageBytes: 50_000, domNodes: 400 });
  assert.equal(result.withinBudget, true, 'absent metrics mean no caveat, not a pass-by-luck');
});

test('a fixture exactly at the threshold passes', () => {
  const atBudget: PerformanceEvidence = {
    pageBytes: DEFAULT_BUDGETS.maxPageBytes,
    largestImageBytes: DEFAULT_BUDGETS.maxImageBytes,
    domNodes: DEFAULT_BUDGETS.maxDomNodes,
    lcpMs: DEFAULT_BUDGETS.maxLcpMs,
    cls: DEFAULT_BUDGETS.maxCls,
  };
  const result = gatePerformance(atBudget);
  assert.equal(result.withinBudget, true);
});

test('over-budget uses the default budgets when none are supplied', () => {
  const result = gatePerformance({ pageBytes: 3_000_000, largestImageBytes: 100_000, domNodes: 500 });
  assert.equal(result.caveats.length, 1);
});
