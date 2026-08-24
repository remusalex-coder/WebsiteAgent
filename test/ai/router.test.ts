/**
 * P3-2 / P3-3 â€” Capability Router: filter â†’ rank â†’ select â†’ failover.
 *
 * The router's guarantees, from the freeze: a licence-incompatible provider is
 * *unreachable*, not merely low-ranked; providers rank on observed telemetry;
 * a non-retryable failure on vendor A moves to vendor B and then to the
 * terminal deterministic floor.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { routeCapability, withFloor, isFloor } from '../../lib/ai/router.js';
import type { ProviderEligibility } from '../../lib/ai/router.js';

function eligible(name: string, overrides: Partial<ProviderEligibility> = {}): ProviderEligibility {
  return {
    provider: name as ProviderEligibility['provider'],
    capabilities: ['generate'],
    credentialled: true,
    jurisdictionAllowed: true,
    licenceAllowed: true,
    leased: true,
    modelMayWriteOutput: false,
    ...overrides,
  };
}

test('a licence-incompatible provider is unreachable, not merely low-ranked', () => {
  const providers = [
    eligible('openai', { licenceAllowed: false }),
    eligible('gemini'),
  ];
  const decision = routeCapability({ capability: 'generate', providers });
  assert.equal(decision.chain.length, 1);
  assert.equal(decision.chain[0]?.provider, 'gemini');
  const excluded = decision.considered.find((c) => c.provider === 'openai');
  assert.equal(excluded?.excluded, 'licence-incompatible');
});

test('a provider with no credential is dropped', () => {
  const providers = [eligible('anthropic', { credentialled: false }), eligible('gemini')];
  const decision = routeCapability({ capability: 'generate', providers });
  assert.deepEqual(decision.chain.map((c) => c.provider), ['gemini']);
});

test('a provider without a lease is dropped', () => {
  const providers = [eligible('openai', { leased: false }), eligible('gemini')];
  const decision = routeCapability({ capability: 'generate', providers });
  assert.deepEqual(decision.chain.map((c) => c.provider), ['gemini']);
});

test('a provider that lacks the capability is excluded', () => {
  const providers = [eligible('gemini', { capabilities: ['vision'] }), eligible('openai')];
  const decision = routeCapability({ capability: 'generate', providers });
  assert.deepEqual(decision.chain.map((c) => c.provider), ['openai']);
});

test('providers rank on observed availability first', () => {
  const providers = [eligible('gemini'), eligible('openai')];
  const decision = routeCapability({
    capability: 'generate',
    providers,
    telemetry: {
      openai: { calls: 100, failures: 95, availability: 0.05, latencyMs: { avg: 50, p50: 40, p95: 80, max: 90, last: 50, samples: 100 }, lastError: 'x', lastCallAt: 'y' },
      gemini: { calls: 100, failures: 10, availability: 0.9, latencyMs: { avg: 200, p50: 150, p95: 400, max: 500, last: 200, samples: 100 }, lastError: null, lastCallAt: 'y' },
    },
  });
  // gemini has far better availability despite being slower.
  assert.deepEqual(decision.chain.map((c) => c.provider), ['gemini', 'openai']);
});

test('an untested provider ranks behind every tested one', () => {
  const providers = [eligible('gemini'), eligible('openai')];
  const decision = routeCapability({
    capability: 'generate',
    providers,
    telemetry: {
      // openai is tested and slow but available; gemini has never been called.
      openai: { calls: 10, failures: 0, availability: 1, latencyMs: { avg: 900, p50: 800, p95: 1200, max: 1300, last: 900, samples: 10 }, lastError: null, lastCallAt: 'y' },
    },
  });
  assert.deepEqual(decision.chain.map((c) => c.provider), ['openai', 'gemini']);
});

test('a perfect telemetry tie breaks on preference, then declaration order', () => {
  const providers = [eligible('gemini'), eligible('openai'), eligible('anthropic')];
  const metrics = { calls: 1, failures: 0, availability: 1, latencyMs: { avg: 100, p50: 90, p95: 110, max: 120, last: 100, samples: 1 }, lastError: null, lastCallAt: 'y' };
  const decision = routeCapability({
    capability: 'generate',
    providers,
    telemetry: { gemini: metrics, openai: metrics, anthropic: metrics },
    preference: ['openai'],
  });
  assert.equal(decision.chain[0]?.provider, 'openai', 'the deployment-preferred vendor wins a perfect tie');
});

test('the failover chain ends in the deterministic floor', () => {
  const providers = [eligible('gemini')];
  const decision = routeCapability({ capability: 'generate', providers });
  const chain = withFloor(decision.chain);
  assert.equal(chain.length, 2);
  assert.equal(isFloor(chain[1]!), true);
  assert.equal(chain[1]!.modelMayWriteOutput, false, 'F-08: the floor never lets a model author bytes');
});

test('an empty chain still ends in the floor when asked', () => {
  const chain = withFloor([]);
  assert.equal(chain.length, 1);
  assert.equal(isFloor(chain[0]!), true);
});

test('the deterministic floor is not a provider', () => {
  assert.equal(isFloor({ provider: null, capability: 'deterministic-floor', modelMayWriteOutput: false, order: 99, excluded: null }), true);
  assert.equal(isFloor({ provider: 'gemini', capability: 'generate', modelMayWriteOutput: false, order: 0, excluded: null }), false);
});
