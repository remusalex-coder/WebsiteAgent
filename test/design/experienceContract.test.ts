/**
 * Decision Gate §5/§6, ADR 0008 — the Tier-2 vocabulary additions
 * (`deriveMotionIntensity`, `deriveNavigationMode`) are pure derivations over
 * an already-decided `ExperienceArchitecture`. They are additive precisely
 * because `WebsiteDesign` is snapshotted verbatim
 * (`test/__snapshots__/design.bakery.json`) — these functions exist standalone
 * rather than as new fields on that object, so nothing here can move a
 * snapshot.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveMotionIntensity, deriveNavigationMode, deriveRuntimePrimitives } from '../../lib/design/experience.js';
import type { ExperienceArchitecture } from '../../lib/design/experience.js';

function architecture(overrides: Partial<ExperienceArchitecture>): ExperienceArchitecture {
  return {
    mode: 'brochure',
    signatureMoment: null,
    transition: 'none',
    momentTransition: false,
    galleryLead: false,
    pacing: 'compact',
    rationale: 'test fixture',
    evidence: [],
    ...overrides,
  };
}

test('a brochure with no earned moment gets no motion intensity', () => {
  assert.equal(deriveMotionIntensity(architecture({ mode: 'brochure' })), 'none');
});

test('a showcase with no transition gets subtle motion', () => {
  assert.equal(deriveMotionIntensity(architecture({ mode: 'showcase', transition: 'none' })), 'subtle');
});

test('any earned transition (veil, wipe, or circular-handoff) reads as expressive', () => {
  for (const transition of ['veil', 'wipe', 'circular-handoff'] as const) {
    assert.equal(
      deriveMotionIntensity(architecture({ mode: 'narrative', transition })),
      'expressive',
      `transition=${transition} should be expressive`,
    );
  }
});

test('the reserved immersive mode reads as immersive motion, even though nothing selects immersive mode today', () => {
  assert.equal(deriveMotionIntensity(architecture({ mode: 'immersive', transition: 'none' })), 'immersive');
});

test('navigation is always persistent today — the honest floor until a Tier-2 runtime exists', () => {
  assert.equal(deriveNavigationMode(architecture({ mode: 'narrative', transition: 'veil' })), 'persistent');
  assert.equal(deriveNavigationMode(architecture({ mode: 'immersive' })), 'persistent');
});

/* ------------------------------------------------------------------ */
/* deriveRuntimePrimitives — the Experience Signature → runtime         */
/* declaration seam                                                    */
/* ------------------------------------------------------------------ */

test('a brochure with no earned motion declares no runtime primitive', () => {
  assert.deepEqual(deriveRuntimePrimitives(architecture({ mode: 'brochure', transition: 'none' })), []);
});

test('a narrative with an earned transition declares scroll-reveal and text-reveal (budget-capped at two)', () => {
  assert.deepEqual(
    deriveRuntimePrimitives(architecture({ mode: 'narrative', transition: 'veil' })),
    ['scroll-reveal', 'text-reveal'],
  );
});

test('a showcase (subtle motion, no transition) declares only scroll-reveal — text-reveal is narrative-only', () => {
  assert.deepEqual(
    deriveRuntimePrimitives(architecture({ mode: 'showcase', transition: 'none' })),
    ['scroll-reveal'],
  );
});

test('a craft showcase with an earned transition declares scroll-reveal and magnetic-cursor, not text-reveal', () => {
  assert.deepEqual(
    deriveRuntimePrimitives(architecture({ mode: 'showcase', transition: 'wipe' })),
    ['scroll-reveal', 'magnetic-cursor'],
  );
});

test('the declaration is always a subset of the closed RuntimePrimitiveId vocabulary — never free text', () => {
  const declared = deriveRuntimePrimitives(architecture({ mode: 'narrative', transition: 'wipe' }));
  const closedSet = new Set(['scroll-reveal', 'text-reveal', 'magnetic-cursor']);
  for (const id of declared) {
    assert.equal(typeof id, 'string');
    assert.ok(closedSet.has(id), `${id} is not in the closed RuntimePrimitiveId vocabulary`);
  }
});
