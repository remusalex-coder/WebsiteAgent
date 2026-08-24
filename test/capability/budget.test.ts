/**
 * Budget tiers are sugar over `CapabilityPolicy.allowPaid`/`budgetCentsRemaining`
 * — these assert the mapping is what the tier names promise, and that `tier3`
 * refuses to run without an explicit budget rather than defaulting one in.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveBudgetTier, TIER_CENTS, isBudgetTier } from '../../lib/capability/budget.js';

test('tier0 is exactly the zero-budget policy', () => {
  const resolved = resolveBudgetTier('tier0');
  assert.deepEqual(resolved, { allowPaid: false, budgetCentsRemaining: 0 });
});

test('tier1 (micro) allows paid, capped at the research doc\'s €1–5 ceiling', () => {
  const resolved = resolveBudgetTier('tier1');
  assert.equal(resolved.allowPaid, true);
  assert.equal(resolved.budgetCentsRemaining, TIER_CENTS.tier1);
  assert.equal(resolved.budgetCentsRemaining, 500);
});

test('tier2 (premium) allows paid, capped at the research doc\'s €5–20 ceiling', () => {
  const resolved = resolveBudgetTier('tier2');
  assert.equal(resolved.allowPaid, true);
  assert.equal(resolved.budgetCentsRemaining, TIER_CENTS.tier2);
  assert.equal(resolved.budgetCentsRemaining, 2_000);
});

test('tier3 (custom) uses exactly the caller-supplied cents, never a silent default', () => {
  const resolved = resolveBudgetTier('tier3', 750);
  assert.deepEqual(resolved, { allowPaid: true, budgetCentsRemaining: 750 });
});

test('tier3 without customCents throws rather than picking a number', () => {
  assert.throws(() => resolveBudgetTier('tier3'), /requires an explicit positive budgetCustomCents/);
});

test('tier3 with a zero or negative customCents throws', () => {
  assert.throws(() => resolveBudgetTier('tier3', 0));
  assert.throws(() => resolveBudgetTier('tier3', -5));
});

test('customCents passed to a fixed tier is ignored, never widening the cap', () => {
  const resolved = resolveBudgetTier('tier1', 999_999);
  assert.equal(resolved.budgetCentsRemaining, TIER_CENTS.tier1);
});

test('isBudgetTier is a proper type guard over the closed set', () => {
  assert.equal(isBudgetTier('tier0'), true);
  assert.equal(isBudgetTier('tier1'), true);
  assert.equal(isBudgetTier('tier2'), true);
  assert.equal(isBudgetTier('tier3'), true);
  assert.equal(isBudgetTier('premium'), false);
  assert.equal(isBudgetTier(''), false);
});
