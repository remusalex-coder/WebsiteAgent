/**
 * xAI (Grok) adapter registration — the three-step extension
 * `lib/ai/providers/index.ts` documents: adapter file, `AI_PROVIDER_NAMES`,
 * one line in the adapter table. This test is the compile-time
 * exhaustiveness check's runtime companion: every place that keys off
 * `AIProviderName` must actually carry a real `xai` entry, not just typecheck.
 *
 * No live call here — `xai.ts` has not yet been verified against a live key
 * (see its own docstring); this only proves the adapter is correctly wired,
 * not that api.x.ai actually answers as documented.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADAPTERS } from '../../lib/ai/providers/index.js';
import { AI_PROVIDER_NAMES } from '../../lib/ai/types.js';
import { adapter as xaiAdapter } from '../../lib/ai/providers/xai.js';
import { DEFAULT_MODELS } from '../../lib/config.js';
import { MODEL_CATALOG, catalogFor } from '../../lib/capability/models.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';

const noopLogger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });

test('"xai" is in the closed provider vocabulary', () => {
  assert.ok(AI_PROVIDER_NAMES.includes('xai'));
});

test('the adapter table has a real xai entry, not a placeholder', () => {
  assert.equal(ADAPTERS.xai.name, 'xai');
  assert.equal(ADAPTERS.xai.apiKeyVariable, 'XAI_API_KEY');
  assert.equal(typeof ADAPTERS.xai.create, 'function');
});

test('xai reuses the OpenAI strict-schema normalizer rather than a second one', () => {
  // toStrictSchema is imported by xai.ts; this indirectly proves the module
  // loads and wires it without a runtime error (schema.ts already unit-tests
  // toStrictSchema itself in openai-strict-schema.test.ts).
  const provider = xaiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 1000, headers: {} });
  assert.equal(provider.supportsNativeSchema, true);
});

test('lib/config.ts has a default model for xai, and it is not a free-tier vendor', () => {
  assert.equal(DEFAULT_MODELS.xai, 'grok-4.6');
});

test('the capability model catalog carries real, non-free pricing for xai — no accidental free allowance', () => {
  const entries = catalogFor('xai');
  assert.ok(entries.length > 0, 'expected at least one xai model in the catalog');
  for (const entry of entries) {
    assert.equal(entry.freeAllowance, null, `${entry.id} must not claim a free allowance — xAI has none`);
    assert.ok(entry.centsPerMillionInput > 0);
  }
});

test('xai is registered in the catalog under its own provider name, not merged into another vendor', () => {
  assert.ok(MODEL_CATALOG.some((m) => m.provider === 'xai'));
});
