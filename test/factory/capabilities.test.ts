/**
 * Factory capability routing (lib/factory/capabilities.ts).
 *
 * The bridge between the factory's capability vocabulary and the provider
 * router: a capability resolves to an ordered failover chain ending at the
 * deterministic floor, plus an exclusion ledger naming who was dropped and why.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  routeForCapability,
  exclusionLedger,
  routedMembers,
  capabilityPoolRole,
  capabilityRouterName,
  isFactoryCapability,
} from '../../lib/factory/capabilities.js';

import type { AiConfig } from '../../lib/config.js';
import type { PoolMember } from '../../lib/factory/pool.js';

const baseConfig: AiConfig = {
  provider: 'gemini',
  apiKeys: { anthropic: '', openai: 'key', gemini: 'key', openrouter: '', xai: '', deepseek: '', cerebras: '', groq: '', ollama: '' },
  baseUrls: { anthropic: null, openai: null, gemini: null, openrouter: null, xai: null, deepseek: null, cerebras: null, groq: null, ollama: null },
  requestTimeoutMs: 300_000,
  maxRetries: 3,
  retryBaseDelayMs: 1_000,
  openRouterReferer: null,
  openRouterTitle: null,
};

const members: readonly PoolMember[] = [
  { role: 'research', provider: 'gemini', model: 'gemini-3.6-flash' },
  { role: 'research', provider: 'openai', model: 'gpt-5.2' },
];

test('capabilityPoolRole maps factory capabilities to the design pool', () => {
  assert.equal(capabilityPoolRole('design.concept'), 'design');
  assert.equal(capabilityPoolRole('coding.frontend'), 'design');
  assert.equal(capabilityPoolRole('research'), 'research');
  assert.equal(capabilityPoolRole('content'), 'content');
  assert.equal(capabilityPoolRole('vision'), null);
});

test('capabilityRouterName maps design/concept/coding to generate, vision to vision', () => {
  assert.equal(capabilityRouterName('design.concept'), 'generate');
  assert.equal(capabilityRouterName('coding.frontend'), 'generate');
  assert.equal(capabilityRouterName('vision'), 'vision');
  assert.ok(isFactoryCapability('design.concept'));
  assert.ok(!isFactoryCapability('nonsense'));
});

test('routeForCapability returns an ordered chain ending at the floor', () => {
  process.env.BF_POOL_RESEARCH = 'openai,gemini';
  try {
    const route = routeForCapability({
      capability: 'research',
      config: baseConfig,
      preference: ['openai', 'gemini'],
    });
    assert.equal(route.capability, 'generate');
    const providers = route.chain.filter((m) => m.provider !== null).map((m) => m.provider);
    assert.equal(providers[0], 'openai', 'preferred provider routes first');
    assert.equal(route.chain[route.chain.length - 1]?.provider, null, 'chain ends at the floor');
  } finally {
    delete process.env.BF_POOL_RESEARCH;
  }
});

test('exclusionLedger maps router exclusions to a runnable record', () => {
  // The router only sees credentialled pool members, so a full eligibility set
  // yields an empty ledger — but the mapper still translates any exclusion that
  // DOES reach it (licence/jurisdiction/lease, added by future integrations).
  const route = routeForCapability({
    capability: 'research',
    config: baseConfig,
    preference: ['openai', 'gemini'],
  });
  const ledger = exclusionLedger(route.considered);
  assert.deepEqual(ledger, []);

  const synthetic = exclusionLedger([
    { provider: 'openai', capability: 'generate', modelMayWriteOutput: true, order: -1, excluded: 'no-lease' },
    { provider: 'gemini', capability: 'generate', modelMayWriteOutput: true, order: 0, excluded: null },
  ]);
  assert.deepEqual(synthetic, [{ provider: 'openai', reason: 'no-lease' }]);
});

test('routedMembers resolves the chain back to pool members in routed order', () => {
  process.env.BF_POOL_RESEARCH = 'openai,gemini';
  try {
    const route = routeForCapability({
      capability: 'research',
      config: baseConfig,
      preference: ['openai', 'gemini'],
    });
    const ordered = routedMembers(route.chain, members);
    assert.equal(ordered[0]?.provider, 'openai');
    assert.equal(ordered[0]?.model, 'gpt-5.2');
  } finally {
    delete process.env.BF_POOL_RESEARCH;
  }
});

test('vision routes with no pool members and only the floor', () => {
  const route = routeForCapability({ capability: 'vision', config: baseConfig });
  assert.equal(route.capability, 'vision');
  assert.equal(route.chain.length, 1);
  assert.equal(route.chain[0]?.provider, null);
});