import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODEL_CATALOG,
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

test('every catalogue entry declares a price confidence', () => {
  for (const record of MODEL_CATALOG) {
    assert.ok(
      record.priceConfidence === 'observed' || record.priceConfidence === 'estimated',
      `${record.provider}:${record.id} has no priceConfidence`,
    );
  }
});

test('Cerebras and Groq are the only catalogue entries marked estimated — their pricing is an unverified placeholder', () => {
  // Both vendors' primary-source pricing pages returned no per-model rate
  // table on a live fetch (Cerebras: inference-docs.cerebras.ai; Groq:
  // groq.com/pricing is client-rendered) — the same gap, not a coincidence.
  // Every other catalogue entry's price is OBSERVED from a primary source.
  const observedOnly = MODEL_CATALOG.filter((record) => record.priceConfidence !== 'observed');
  assert.deepEqual(
    observedOnly.map((record) => `${record.provider}:${record.id}`).sort(),
    ['cerebras:gpt-oss-120b', 'groq:openai/gpt-oss-120b'].sort(),
  );
});

test('supportsVision reflects the declared modalities', () => {
  const vision = resolveModel('gemini', 'vision');
  const enumModel = resolveModel('gemini', 'enum');
  assert.ok(vision && enumModel);
  assert.equal(supportsVision(vision), true);
  assert.equal(supportsVision(enumModel), false);
});
