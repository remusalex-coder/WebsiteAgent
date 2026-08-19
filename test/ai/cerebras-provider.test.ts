/**
 * Cerebras adapter registration — mirrors xai-provider.test.ts. Proves the
 * adapter is correctly wired into the closed `AIProviderName` vocabulary,
 * the adapter table, and the model catalog, not that api.cerebras.ai
 * actually answers as documented (no live call here).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADAPTERS } from '../../lib/ai/providers/index.js';
import { AI_PROVIDER_NAMES } from '../../lib/ai/types.js';
import { adapter as cerebrasAdapter } from '../../lib/ai/providers/cerebras.js';
import { DEFAULT_MODELS } from '../../lib/config.js';
import { MODEL_CATALOG, catalogFor } from '../../lib/capability/models.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';

const noopLogger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });

test('"cerebras" is in the closed provider vocabulary', () => {
  assert.ok(AI_PROVIDER_NAMES.includes('cerebras'));
});

test('the adapter table has a real cerebras entry, not a placeholder', () => {
  assert.equal(ADAPTERS.cerebras.name, 'cerebras');
  assert.equal(ADAPTERS.cerebras.apiKeyVariable, 'CEREBRAS_API_KEY');
  assert.equal(typeof ADAPTERS.cerebras.create, 'function');
});

test('cerebras is honest about not offering native schema enforcement', () => {
  const provider = cerebrasAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 1000, headers: {} });
  assert.equal(provider.supportsNativeSchema, false);
  assert.equal(cerebrasAdapter.supportsNativeSchema, false);
});

test('lib/config.ts has a default model for cerebras', () => {
  assert.equal(DEFAULT_MODELS.cerebras, 'gpt-oss-120b');
});

test('the capability model catalog carries a real entry for cerebras, with no free allowance claimed', () => {
  const entries = catalogFor('cerebras');
  assert.ok(entries.length > 0, 'expected at least one cerebras model in the catalog');
  for (const entry of entries) {
    // The observed "$5 free trial" is a wallet credit, not a requests/day allowance —
    // it does not fit freeAllowance's shape and must not be claimed as one.
    assert.equal(entry.freeAllowance, null, `${entry.id} must not claim a requests/day free allowance`);
    assert.ok(entry.centsPerMillionInput > 0);
    assert.equal(entry.structuredOutput, 'instructed');
  }
});

test('cerebras is registered in the catalog under its own provider name, not merged into another vendor', () => {
  assert.ok(MODEL_CATALOG.some((m) => m.provider === 'cerebras'));
});
