/**
 * The runtime ladder must climb only when the evidence justifies it — never on
 * an industry guess, a flag, or a tier the operator bought — and the library
 * register must keep every rejection's reasoning attached rather than just
 * omitting the entry.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIBRARY_REGISTER,
  RUNTIME_TIERS,
  decideRuntimeTier,
  librariesAt,
  tierRank,
  weightBudgetKb,
} from '../../lib/capability/experience.js';

import type { ExperienceEvidence } from '../../lib/capability/experience.js';

const THIN: ExperienceEvidence = {
  photographCount: 1,
  offeringCount: 1,
  quotableReviewCount: 0,
  hasNarrative: false,
  visuallyLed: false,
  hasLargeImagery: false,
};

test('thin evidence never climbs off the floor', () => {
  const decision = decideRuntimeTier(THIN);
  assert.equal(decision.tier, 'none');
  assert.equal(decision.earnedBy.length, 0);
});

test('material without a sequence stops at css', () => {
  const decision = decideRuntimeTier({ ...THIN, offeringCount: 5, photographCount: 4 });
  assert.equal(decision.tier, 'css');
});

test('a narrative across enough offerings earns js', () => {
  const decision = decideRuntimeTier({
    ...THIN,
    offeringCount: 5,
    hasNarrative: true,
  });
  assert.equal(decision.tier, 'js');
});

test('many photographs alone earn js even without a narrative', () => {
  const decision = decideRuntimeTier({ ...THIN, offeringCount: 3, photographCount: 8 });
  assert.equal(decision.tier, 'js');
});

test('visually-led with large imagery and enough photographs earns webgl', () => {
  const decision = decideRuntimeTier({
    ...THIN,
    offeringCount: 3,
    photographCount: 12,
    hasNarrative: true,
    visuallyLed: true,
    hasLargeImagery: true,
  });
  assert.equal(decision.tier, 'webgl');
});

test('a visually-led business with small imagery is held at js, not promoted to webgl', () => {
  const decision = decideRuntimeTier({
    ...THIN,
    offeringCount: 3,
    photographCount: 12,
    hasNarrative: true,
    visuallyLed: true,
    hasLargeImagery: false,
  });
  assert.equal(decision.tier, 'js');
  assert.match(decision.heldBackBy, /too small/);
});

test('a text-led business never reaches webgl no matter how many photographs it has', () => {
  const decision = decideRuntimeTier({
    ...THIN,
    offeringCount: 3,
    photographCount: 50,
    hasNarrative: true,
    visuallyLed: false,
    hasLargeImagery: true,
  });
  assert.equal(decision.tier, 'js');
});

test('decideRuntimeTier is deterministic: identical evidence produces an identical decision', () => {
  const evidence = { ...THIN, offeringCount: 5, hasNarrative: true };
  const a = decideRuntimeTier(evidence);
  const b = decideRuntimeTier(evidence);
  assert.deepEqual(a, b);
});

test('every rejected library states a reason and permits nothing', () => {
  for (const entry of LIBRARY_REGISTER) {
    if (entry.status !== 'rejected') continue;
    assert.equal(entry.minimumTier, null);
    assert.ok(entry.justification.length > 20, `${entry.id} has a suspiciously thin justification`);
  }
});

test('librariesAt never includes a rejected library, and is monotone with the tier rank', () => {
  for (const tier of RUNTIME_TIERS) {
    const libs = librariesAt(tier);
    assert.ok(libs.every((entry) => entry.status !== 'rejected'));
  }
  const noneCount = librariesAt('none').length;
  const cssCount = librariesAt('css').length;
  const jsCount = librariesAt('js').length;
  const webglCount = librariesAt('webgl').length;
  assert.ok(noneCount <= cssCount);
  assert.ok(cssCount <= jsCount);
  assert.ok(jsCount <= webglCount);
});

test('weightBudgetKb grows or holds as the tier climbs, never shrinks', () => {
  let previous = 0;
  for (const tier of RUNTIME_TIERS) {
    const weight = weightBudgetKb(tier);
    assert.ok(weight >= previous, `weight dropped at tier ${tier}`);
    previous = weight;
  }
});

test('tierRank orders the ladder as declared', () => {
  assert.equal(tierRank('none'), 0);
  assert.equal(tierRank('webgl'), RUNTIME_TIERS.length - 1);
});
