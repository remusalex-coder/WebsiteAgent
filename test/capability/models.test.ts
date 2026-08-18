import test from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateCents,
  modelKey,
  resolveModel,
  supportsVision,
} from '../../lib/capability/models.js';

test('resolveModel returns null for a vendor with no entry in a class', () => {
  // OpenRouter has no vision entry in the catalogue.
  assert.equal(resolveModel('openrouter', 'vision'), null);
});

test('BF_MODEL_<PROVIDER> overrides the id for every class on that vendor', () => {
  const env = { BF_MODEL_GEMINI: 'gemini-custom' };
  const workhorse = resolveModel('gemini', 'workhorse', env);
  const enumModel = resolveModel('gemini', 'enum', env);
  assert.equal(workhorse?.id, 'gemini-custom');
  assert.equal(enumModel?.id, 'gemini-custom');
});

test('BF_MODEL_<PROVIDER>_<CLASS> overrides only that one class', () => {
  const env = { BF_MODEL_GEMINI_ENUM: 'gemini-enum-custom' };
  const workhorse = resolveModel('gemini', 'workhorse', env);
  const enumModel = resolveModel('gemini', 'enum', env);
  assert.notEqual(workhorse?.id, 'gemini-enum-custom');
  assert.equal(enumModel?.id, 'gemini-enum-custom');
});

test('estimateCents is zero when the call is covered by a free allowance', () => {
  const model = resolveModel('gemini', 'workhorse');
  assert.ok(model);
  const cents = estimateCents(model, { inputTokens: 100_000, outputTokens: 50_000 }, {
    onFreeAllowance: true,
  });
  assert.equal(cents, 0);
});

test('estimateCents is positive for a paid model with real token volume', () => {
  const model = resolveModel('anthropic', 'frontier');
  assert.ok(model);
  const cents = estimateCents(model, { inputTokens: 100_000, outputTokens: 50_000 });
  assert.ok(cents > 0, `expected a positive cost estimate, got ${cents}`);
});

test('modelKey is stable and human-legible', () => {
  const model = resolveModel('gemini', 'workhorse');
  assert.ok(model);
  assert.equal(modelKey(model), `gemini:${model.id}`);
});

test('supportsVision reflects the declared modalities', () => {
  const vision = resolveModel('gemini', 'vision');
  const enumModel = resolveModel('gemini', 'enum');
  assert.ok(vision && enumModel);
  assert.equal(supportsVision(vision), true);
  assert.equal(supportsVision(enumModel), false);
});
