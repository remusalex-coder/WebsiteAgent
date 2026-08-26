/**
 * The registry is a total function over a closed key type, and this asserts
 * the two properties that make it trustworthy: every declared capability has
 * exactly one row, and every row whose descriptor promises a terminal actually
 * has one in the bindings table (see bindings.test.ts for the second half).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CAPABILITY_IDS } from '../../lib/capability/types.js';
import {
  CAPABILITY_DESCRIPTORS,
  CAPABILITY_REGISTRY,
  autonomouslyPlannable,
  capabilitiesAtTier,
  describeCapability,
} from '../../lib/capability/registry.js';

test('every capability id has exactly one registry row, with the matching id', () => {
  assert.equal(CAPABILITY_DESCRIPTORS.length, CAPABILITY_IDS.length);
  for (const id of CAPABILITY_IDS) {
    const descriptor = describeCapability(id);
    assert.equal(descriptor.id, id);
  }
});

test('a rejected capability is never autonomously plannable', () => {
  for (const descriptor of capabilitiesAtTier('rejected')) {
    assert.equal(autonomouslyPlannable(descriptor), false);
  }
});

test('a human-gated capability is never autonomously plannable', () => {
  const humanGated = CAPABILITY_DESCRIPTORS.filter((entry) => entry.gate === 'human');
  assert.ok(humanGated.length > 0, 'expected at least one human-gated capability to exist');
  for (const descriptor of humanGated) {
    assert.equal(autonomouslyPlannable(descriptor), false);
  }
});

test('a capability that must never be model-authored is marked so, for the F-08 gate', () => {
  const collection = CAPABILITY_REGISTRY.evidence_collection;
  assert.equal(collection.modelMayWriteOutput, false);
  const creative = CAPABILITY_REGISTRY.creative_direction;
  assert.equal(creative.modelMayWriteOutput, false);
});

test('F-18 guardrail: audio_speech and three_d_generation stay frozen at gate never', () => {
  // A regression check, not new behaviour — provider-orchestration work in this
  // repository leaves these two capabilities untouched pending a separate,
  // explicit decision to revisit F-18. If this test fails, someone changed
  // the gate; make sure that was deliberate before touching it further.
  const audio = CAPABILITY_REGISTRY.audio_speech;
  assert.equal(audio.gate, 'never');

  const threeD = CAPABILITY_REGISTRY.three_d_generation;
  assert.equal(threeD.gate, 'never');
  assert.equal(threeD.tier, 'rejected');
});

test('every core capability declares a terminal, or an explicit no-model/human gate', () => {
  for (const descriptor of capabilitiesAtTier('core')) {
    const hasTerminal = descriptor.terminal !== null;
    const failsLoudlyByDesign = descriptor.gate === 'no-model' || descriptor.gate === 'human';
    assert.ok(
      hasTerminal || failsLoudlyByDesign,
      `${descriptor.id} is core but has neither a terminal nor a gate that explains its absence`,
    );
  }
});
