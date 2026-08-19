/**
 * DeepSeek adapter registration — mirrors xai-provider.test.ts. Proves the
 * adapter is correctly wired into the closed `AIProviderName` vocabulary,
 * the adapter table, and the model catalog, not that api.deepseek.com
 * actually answers as documented (no live call here).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADAPTERS } from '../../lib/ai/providers/index.js';
import { AI_PROVIDER_NAMES } from '../../lib/ai/types.js';
import { adapter as deepseekAdapter } from '../../lib/ai/providers/deepseek.js';
import { DEFAULT_MODELS } from '../../lib/config.js';
import { MODEL_CATALOG, catalogFor } from '../../lib/capability/models.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';

const noopLogger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });

test('"deepseek" is in the closed provider vocabulary', () => {
  assert.ok(AI_PROVIDER_NAMES.includes('deepseek'));
});

test('the adapter table has a real deepseek entry, not a placeholder', () => {
  assert.equal(ADAPTERS.deepseek.name, 'deepseek');
  assert.equal(ADAPTERS.deepseek.apiKeyVariable, 'DEEPSEEK_API_KEY');
  assert.equal(typeof ADAPTERS.deepseek.create, 'function');
});

test('deepseek is honest about not offering native schema enforcement', () => {
  const provider = deepseekAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 1000, headers: {} });
  assert.equal(provider.supportsNativeSchema, false);
  assert.equal(deepseekAdapter.supportsNativeSchema, false);
});

test('lib/config.ts has a default model for deepseek', () => {
  assert.equal(DEFAULT_MODELS.deepseek, 'deepseek-v4-flash');
});

test('the capability model catalog carries real, non-free pricing for deepseek — no accidental free allowance', () => {
  const entries = catalogFor('deepseek');
  assert.ok(entries.length > 0, 'expected at least one deepseek model in the catalog');
  for (const entry of entries) {
    assert.equal(entry.freeAllowance, null, `${entry.id} must not claim a free allowance — DeepSeek has none`);
    assert.ok(entry.centsPerMillionInput > 0);
    assert.equal(entry.structuredOutput, 'instructed');
  }
});

test('deepseek is registered in the catalog under its own provider name, with both a workhorse and a frontier class', () => {
  const entries = catalogFor('deepseek');
  assert.ok(entries.some((m) => m.modelClass === 'workhorse'));
  assert.ok(entries.some((m) => m.modelClass === 'frontier'));
  assert.ok(MODEL_CATALOG.some((m) => m.provider === 'deepseek'));
});
