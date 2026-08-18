/**
 * The rule stated in `bindings.ts`'s header, enforced: every capability whose
 * descriptor declares a terminal ends its binding list with a `deterministic`
 * binding. A terminal that exists only in prose is a terminal that will be
 * missing the day it matters.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CAPABILITY_IDS } from '../../lib/capability/types.js';
import { describeCapability } from '../../lib/capability/registry.js';
import { bindingsFor } from '../../lib/capability/bindings.js';

test('a capability with a declared terminal ends its chain of bindings in a deterministic one', () => {
  for (const id of CAPABILITY_IDS) {
    const descriptor = describeCapability(id);
    if (descriptor.terminal === null) continue;

    const bindings = bindingsFor(id);
    assert.ok(bindings.length > 0, `${id} declares a terminal but has no bindings at all`);
    const last = bindings[bindings.length - 1];
    assert.equal(
      last?.kind,
      'deterministic',
      `${id} declares terminal "${descriptor.terminal}" but its last binding is "${last?.id}" (${last?.kind})`,
    );
  }
});

test('a capability gated no-model has no terminal is either absent or itself deterministic', () => {
  for (const id of CAPABILITY_IDS) {
    const descriptor = describeCapability(id);
    if (descriptor.gate !== 'no-model' || descriptor.terminal !== null) continue;
    // These fail loudly by design (qa_measurement, cost_ledger, rate_governor,
    // human_approval, pii_detection, evidence_collection): every binding must
    // be a real tool, never a model — there is nothing to fail over to.
    for (const binding of bindingsFor(id)) {
      assert.notEqual(binding.kind, 'model', `${id} is gated no-model but declares a model binding`);
    }
  }
});

test('every binding names a capability that actually exists', () => {
  for (const id of CAPABILITY_IDS) {
    for (const binding of bindingsFor(id)) {
      assert.equal(binding.capability, id);
    }
  }
});

test('a model binding always names a provider and a model class', () => {
  for (const id of CAPABILITY_IDS) {
    for (const binding of bindingsFor(id)) {
      if (binding.kind !== 'model') continue;
      assert.notEqual(binding.provider, null, `${binding.id} is a model binding with no provider`);
      assert.notEqual(binding.modelClass, null, `${binding.id} is a model binding with no class`);
    }
  }
});

test('craft_judging and distinctness_judging declare the pairing in opposite vendor order', () => {
  const craft = bindingsFor('craft_judging')
    .filter((b) => b.kind === 'model')
    .map((b) => b.provider);
  const distinctness = bindingsFor('distinctness_judging')
    .filter((b) => b.kind === 'model')
    .map((b) => b.provider);

  assert.ok(craft.length > 0 && distinctness.length > 0);
  assert.notEqual(craft[0], distinctness[0], 'the two judges should not share a first-choice vendor');
});
