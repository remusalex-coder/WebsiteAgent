/**
 * Cross-vendor failover and budget safety, proven on `grounding.ts` as the
 * representative stage — the underlying mechanism (`planCapability` /
 * `executeCapability`) is shared by every capability-routed stage in the
 * repository and is not re-derived per stage; what these tests prove is
 * that Forge's own stages actually reach that mechanism with real
 * consequences, using the real planner/executor (see
 * `test/forge/fixtures/routing.ts`).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { fakeCapabilityOrchestrator, fakeProviderFactory, noopLogger, seededQuotaLedger } from './fixtures/routing.js';
import { buildFactualDossier } from '../../lib/forge/grounding.js';

import type { AppConfig } from '../../lib/config.js';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fakeConfig(provider: 'gemini' | 'openai' = 'gemini'): AppConfig {
  return {
    ai: {
      provider,
      apiKeys: { gemini: 'x', openai: 'y', anthropic: '', openrouter: '' },
      baseUrls: { gemini: null, openai: null, anthropic: null, openrouter: null },
      requestTimeoutMs: 30_000, maxRetries: 0, retryBaseDelayMs: 100,
      openRouterReferer: null, openRouterTitle: null,
    },
    analyst: { model: 'pinned-model' },
    writer: { model: 'pinned-model' },
    outputDir: '.',
    logLevel: 'silent',
  } as AppConfig;
}

function groundingCall(routing: { capabilities: ReturnType<typeof fakeCapabilityOrchestrator>; providers: ReturnType<typeof fakeProviderFactory>['factory'] }, config: AppConfig) {
  return buildFactualDossier({
    url: 'https://example.com',
    rawPages: [{ url: 'https://example.com', title: 'Fake Co', text: 'evidence' }],
    downloadedAssets: [],
    runDir: tmpDir('bf-failover-'),
    config,
    routing,
    logger: noopLogger,
  });
}

/* -------------------------------------------------------------------- */
/* #7 Gemini exhaustion excludes Gemini                                  */
/* -------------------------------------------------------------------- */

test('an exhausted Gemini daily quota excludes Gemini from the plan entirely, and the run degrades to the deterministic floor instead of failing', async () => {
  const { factory, calls } = fakeProviderFactory({
    gemini: 'unreachable', // if reached at all, the test should fail loudly
  });
  // reasoning + gemini resolves to the 'frontier' class -> gemini-3.6-pro,
  // whose free allowance is 20 requests/day (lib/capability/models.ts).
  const quota = seededQuotaLedger({ 'gemini:gemini-3.6-pro': 20 });
  const orchestrator = fakeCapabilityOrchestrator({
    credentials: new Set(['GEMINI_API_KEY']),
    quota,
  });

  // Gemini is the only credentialled vendor and its quota is exhausted, so
  // the plan's only remaining step is `reasoning`'s deterministic floor.
  // Before `withDeterministicFloor` (`lib/capability/invokers.ts`) that step
  // could not actually run — reaching it crashed the whole run instead of
  // degrading, exactly the defect this suite now proves fixed: the dossier
  // still comes back, composed from grounding.ts's own defaults.
  const dossier = await groundingCall({ capabilities: orchestrator, providers: factory }, fakeConfig());

  assert.equal(dossier.businessName, 'River Park Events Drăgășani');
  assert.equal(calls.length, 0, 'an exhausted vendor must never actually be called');
});

/* -------------------------------------------------------------------- */
/* #8 OpenAI can serve the capability when Gemini cannot                 */
/* -------------------------------------------------------------------- */

test('when Gemini is unreachable, OpenAI serves the same capability — real cross-vendor failover', async () => {
  const { factory, calls } = fakeProviderFactory({
    gemini: 'unreachable',
    openai: {
      businessName: 'Served By OpenAI', category: 'Test', verifiedFacts: [], inferences: [],
      creativeInterpretations: [], conflicts: [], forbiddenAssumptions: [],
      location: { fullAddress: 'a', street: 's', city: 'c', region: 'r' }, contact: {}, primaryLanguage: 'en',
    },
  });
  const orchestrator = fakeCapabilityOrchestrator({
    credentials: new Set(['GEMINI_API_KEY', 'OPENAI_API_KEY']),
    policy: { allowPaid: true, budgetCentsRemaining: 1_000 }, // OpenAI has no free allowance for reasoning
  });

  const dossier = await groundingCall({ capabilities: orchestrator, providers: factory }, fakeConfig());

  assert.equal(dossier.businessName, 'Served By OpenAI');
  // Gemini is ranked first (free-before-paid) and is genuinely tried, not
  // skipped — the chain only advances to openai because gemini's own call
  // failed, which is what makes this cross-vendor *failover* rather than a
  // plan that never included gemini in the first place.
  assert.deepEqual(calls.map((c) => c.provider), ['gemini', 'openai']);
});

test('an exhausted-but-paid-allowed Gemini is still tried as a paid option, not silently dropped — the planner treats an exhausted free tier as "now costs money", not "gone"', async () => {
  const { factory, calls } = fakeProviderFactory({
    gemini: { businessName: 'Served By Gemini, Paying', category: 'Test', verifiedFacts: [], inferences: [], creativeInterpretations: [], conflicts: [], forbiddenAssumptions: [], location: { fullAddress: 'a', street: 's', city: 'c', region: 'r' }, contact: {}, primaryLanguage: 'en' },
  });
  const quota = seededQuotaLedger({ 'gemini:gemini-3.6-pro': 20 }); // exactly at the 20/day allowance
  const orchestrator = fakeCapabilityOrchestrator({
    credentials: new Set(['GEMINI_API_KEY']),
    quota,
    policy: { allowPaid: true, budgetCentsRemaining: 1_000 },
  });

  const dossier = await groundingCall({ capabilities: orchestrator, providers: factory }, fakeConfig());

  assert.equal(dossier.businessName, 'Served By Gemini, Paying');
  assert.deepEqual(calls.map((c) => c.provider), ['gemini']);
});

/* -------------------------------------------------------------------- */
/* #11 Budget policy prevents unintended paid execution                  */
/* -------------------------------------------------------------------- */

test('zero-budget policy (the default) excludes a paid vendor entirely, and the run degrades to the deterministic floor rather than failing', async () => {
  const { factory, calls } = fakeProviderFactory({
    openai: { businessName: 'Should never be reached', category: 'x', verifiedFacts: [], inferences: [], creativeInterpretations: [], conflicts: [], forbiddenAssumptions: [], location: { fullAddress: '', street: '', city: '', region: '' }, contact: {}, primaryLanguage: 'en' },
  });
  // Only OpenAI credentialled (no Gemini free tier available), default
  // policy (allowPaid: false, budgetCentsRemaining: 0).
  const orchestrator = fakeCapabilityOrchestrator({ credentials: new Set(['OPENAI_API_KEY']) });

  // OpenAI is filtered out before ranking (zero budget), leaving only
  // `reasoning`'s deterministic floor — which now actually runs instead of
  // crashing the run with `createModelInvoker`'s "non-model step" error.
  const dossier = await groundingCall({ capabilities: orchestrator, providers: factory }, fakeConfig('openai'));

  assert.equal(dossier.businessName, 'River Park Events Drăgășani');
  assert.equal(calls.length, 0, 'a zero-budget run must never reach a paid vendor');
});

test('an explicit, scoped paid budget does allow the paid vendor — the exception must be a policy choice, not an accident', async () => {
  const { factory, calls } = fakeProviderFactory({
    openai: { businessName: 'Reached On Purpose', category: 'x', verifiedFacts: [], inferences: [], creativeInterpretations: [], conflicts: [], forbiddenAssumptions: [], location: { fullAddress: '', street: '', city: '', region: '' }, contact: {}, primaryLanguage: 'en' },
  });
  const orchestrator = fakeCapabilityOrchestrator({
    credentials: new Set(['OPENAI_API_KEY']),
    policy: { allowPaid: true, budgetCentsRemaining: 500 },
  });

  const dossier = await groundingCall({ capabilities: orchestrator, providers: factory }, fakeConfig('openai'));

  assert.equal(dossier.businessName, 'Reached On Purpose');
  assert.equal(calls.length, 1);
});
