import test from 'node:test';
import assert from 'node:assert/strict';

import { freeModelIds, probeFreeModels } from '../../scripts/probe-openrouter-free.js';
import { MODEL_CATALOG } from '../../lib/capability/models.js';

// This file deliberately never calls the live OpenRouter API — per T06's own
// acceptance criteria, the script is the artifact and this test only proves
// its shape (a checkable, catalogue-driven function), not live liveness.
// `probeFreeModels` is still exercised for real, with `apiKey` omitted so it
// takes the same "skipped, no network call" path a missing credential does
// in production — the one behaviour this test CAN prove without a key.

test('freeModelIds reads live from MODEL_CATALOG, not a hardcoded copy', () => {
  const ids = freeModelIds();
  const expected = MODEL_CATALOG.filter(
    (record) => record.provider === 'openrouter' && record.id.endsWith(':free'),
  ).map((record) => record.id);
  assert.deepEqual([...ids], expected);
});

test('every id returned is an OpenRouter :free id', () => {
  for (const id of freeModelIds()) {
    assert.ok(id.endsWith(':free'), `${id} does not end in :free`);
  }
});

test('the catalogue currently configures at least one free id to probe', () => {
  // Guards against this test silently doing nothing if models.ts ever drops
  // its last :free entry — that would be real news, not a passing test.
  assert.ok(freeModelIds().length > 0, 'expected at least one OpenRouter :free catalogue entry');
});

test('probeFreeModels reports "skipped" (no network call) with no credential', async () => {
  const ids = freeModelIds();
  const results = await probeFreeModels(ids, { apiKey: '' });
  assert.equal(results.length, ids.length);
  for (const result of results) {
    assert.equal(result.status, 'skipped');
    assert.equal(result.servedModel, null);
    assert.equal(result.latencyMs, null);
    assert.match(result.error ?? '', /OPENROUTER_API_KEY is not set/);
  }
});

test('probeFreeModels resolves to an empty array for an empty id list without touching the network', async () => {
  const results = await probeFreeModels([], { apiKey: 'irrelevant-because-no-ids' });
  assert.deepEqual(results, []);
});
