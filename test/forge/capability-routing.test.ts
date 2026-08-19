/**
 * Every model-backed Forge stage now routes through the capability layer.
 *
 * Before this session: `signature.ts` and `critic.ts` were capability-routed;
 * `research.ts`, `grounding.ts`, `builder.ts` and `repair.ts` each called
 * `createAIProvider(config.ai, logger)` directly, which is exactly what made
 * Gemini a single point of failure for the whole pipeline (a daily quota
 * exhaustion on any of those four stages had no failover at all, unlike a
 * stage already on the capability layer).
 *
 * Four of the five text/code-generating stages route through
 * `createModelInvoker`, so they are tested here against the *real*
 * `planCapability`/`executeCapability` with a fake `AIProviderFactory` — see
 * `test/forge/fixtures/routing.ts` for why that, rather than a fake
 * `capabilities.run()`, is the strong version of this test. `critic.ts`
 * bypasses `AIProviderFactory` entirely (`createVisionInvoker` speaks raw
 * HTTP directly, documented in `visionInvoker.ts`), so its test only proves
 * `capabilities.run('craft_judging', …)` is the call made — the deeper
 * plan/execute machinery is already exercised by the other five.
 *
 * `research.ts`'s crawl is real Playwright, which the test does not mock —
 * it points at an address nothing listens on so the crawl fails fast and
 * falls through to the synthesis call, which is the part being tested.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { fakeCapabilityOrchestrator, fakeProviderFactory, noopLogger } from './fixtures/routing.js';
import { ok } from '../../lib/platform/types.js';
import { DEFAULT_EXPERIENCE_STRATEGY } from '../../lib/forge/experienceStrategy.js';

import { harvestResearch } from '../../lib/forge/research.js';
import { buildFactualDossier } from '../../lib/forge/grounding.js';
import { buildFrontend } from '../../lib/forge/builder.js';
import { repairCode } from '../../lib/forge/repair.js';
import { evaluateVision } from '../../lib/forge/critic.js';

import type { AppConfig } from '../../lib/config.js';
import type { ExperienceBlueprint, ExperienceSignature, VisionCritiqueReport } from '../../lib/forge/types.js';
import type { CapabilityOrchestrator } from '../../lib/capability/orchestrator.js';
import type { ExecutionRecord } from '../../lib/capability/execute.js';

const GEMINI_ONLY = new Set(['GEMINI_API_KEY']);

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Minimal `AppConfig` slice every rewired stage actually reads. */
function fakeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ai: { provider: 'gemini', apiKeys: { gemini: 'x', openai: '', anthropic: '', openrouter: '' }, baseUrls: { gemini: null, openai: null, anthropic: null, openrouter: null }, requestTimeoutMs: 30_000, maxRetries: 0, retryBaseDelayMs: 100, openRouterReferer: null, openRouterTitle: null },
    analyst: { model: 'pinned-analyst-model' },
    writer: { model: 'pinned-writer-model' },
    outputDir: '.',
    logLevel: 'silent',
    ...overrides,
  } as AppConfig;
}

function signature(): ExperienceSignature {
  return {
    selectedTerritoryId: 't1', selectionRationale: 'r', businessTruth: 'truth', humanInsight: 'insight',
    creativeMetaphor: 'metaphor', centralMechanism: 'mechanism', signatureMoment: 'moment',
    interactionGrammar: { paceAndMotion: '', openingMoment: '', scrollChoreography: '', microInteractions: [], selectedPatterns: [], rejectedPatterns: [] },
    visualGrammar: { moodWords: [], colorPalette: { primary: '#000', secondary: '#111', background: '#fff', surface: '#eee', textPrimary: '#000', textMuted: '#555', accent: '#f00' }, typography: { displayFamily: 'Serif', bodyFamily: 'Sans', styleNote: '' }, spatialComposition: '' },
    restraintContract: { forbiddenAntiPatterns: [], mandatoryDesignRules: [] },
    experienceStrategy: DEFAULT_EXPERIENCE_STRATEGY,
    scenes: [{ id: 's1', actName: 'ACT I', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'split', keyInteraction: 'none', assetIds: [] }],
  };
}

function blueprint(): ExperienceBlueprint {
  return {
    brandName: 'Test Co',
    factualDossier: {
      businessName: 'Test Co', category: 'Test', verifiedFacts: [], inferences: [], creativeInterpretations: [],
      conflicts: [], forbiddenAssumptions: [], realPhotoAssets: [],
      location: { fullAddress: '', street: '', city: '', region: '' }, contact: {}, verifiedReviews: [], primaryLanguage: 'en',
    },
    signature: signature(),
    conversionStrategy: { primaryActionLabel: 'Call', primaryActionType: 'call', reassurancePoints: [] },
  };
}

/* -------------------------------------------------------------------- */
/* #1 research.ts                                                        */
/* -------------------------------------------------------------------- */

test('research.ts routes its synthesis call through the "reasoning" capability', async () => {
  const { factory, calls } = fakeProviderFactory({
    gemini: {
      name: 'Fake Business', taglines: [], category: 'Test', description: 'd', storyAndPhilosophy: 's',
      productsOrServices: [], differentiators: [], location: { address: 'a', city: 'c' }, contact: {},
      hours: [], reviews: [], primaryLanguage: 'en',
    },
  });
  const orchestrator = fakeCapabilityOrchestrator({ credentials: GEMINI_ONLY });
  const runDir = tmpDir('bf-research-');

  const result = await harvestResearch({
    url: 'http://127.0.0.1:1/', // nothing listens here — the crawl fails fast, synthesis still runs
    runDir,
    config: fakeConfig(),
    routing: { capabilities: orchestrator, providers: factory },
    logger: noopLogger,
  });

  assert.equal(result.name, 'Fake Business');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.provider, 'gemini');
});

/* -------------------------------------------------------------------- */
/* #2 grounding.ts                                                       */
/* -------------------------------------------------------------------- */

test('grounding.ts routes its factual-audit call through the "reasoning" capability', async () => {
  const { factory, calls } = fakeProviderFactory({
    gemini: {
      businessName: 'Fake Co', category: 'Test', verifiedFacts: [], inferences: [], creativeInterpretations: [],
      conflicts: [], forbiddenAssumptions: [], location: { fullAddress: 'a', street: 's', city: 'c', region: 'r' },
      contact: {}, primaryLanguage: 'en',
    },
  });
  const orchestrator = fakeCapabilityOrchestrator({ credentials: GEMINI_ONLY });

  const dossier = await buildFactualDossier({
    url: 'https://example.com',
    rawPages: [{ url: 'https://example.com', title: 'Fake Co', text: 'some evidence' }],
    downloadedAssets: [],
    runDir: tmpDir('bf-grounding-'),
    config: fakeConfig(),
    routing: { capabilities: orchestrator, providers: factory },
    logger: noopLogger,
  });

  assert.equal(dossier.businessName, 'Fake Co');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.provider, 'gemini');
});

/* -------------------------------------------------------------------- */
/* #4 builder.ts                                                         */
/* -------------------------------------------------------------------- */

test('builder.ts routes both generation passes through the "structured_generation" capability', async () => {
  // Two passes, two different response shapes ({html}, then {css, js}) — a
  // factory that returns whichever shape matches the call count, so both
  // real capability-routed calls are exercised and distinguishable.
  let callCount = 0;
  const providers = {
    supported: ['gemini'],
    createDefault: () => providers.create('gemini'),
    tryCreateDefault: () => providers.create('gemini'),
    configured: () => ['gemini'],
    selected: () => 'gemini',
    status: async () => [],
    create: (name: 'gemini') => ({
      name,
      version: 'fake-1.0',
      defaultModel: 'fake-model',
      supportsNativeSchema: true,
      async generate(request: { readonly model: string }) {
        callCount++;
        return {
          data: callCount === 1 ? { html: '<!DOCTYPE html><html><body>hi</body></html>' } : { css: 'body{}', js: '' },
          model: request.model,
          usage: { inputTokens: 1, outputTokens: 1 },
          structuredOutput: 'native' as const,
          finishReason: 'stop',
        };
      },
      async health() {
        return { status: 'ready' as const, detail: 'fake', checkedAt: new Date().toISOString(), latencyMs: 0 };
      },
    }),
  };
  const orchestrator = fakeCapabilityOrchestrator({ credentials: GEMINI_ONLY });
  const runDir = tmpDir('bf-builder-');

  const code = await buildFrontend(blueprint(), runDir, fakeConfig(), { capabilities: orchestrator, providers: providers as any }, noopLogger);

  assert.equal(code.html, '<!DOCTYPE html><html><body>hi</body></html>');
  assert.equal(code.css, 'body{}');
  assert.equal(callCount, 2, 'expected two capability-routed calls: HTML pass, then CSS/JS pass');
});

/* -------------------------------------------------------------------- */
/* #5 critic.ts — a structural check, since createVisionInvoker bypasses AIProviderFactory */
/* -------------------------------------------------------------------- */

test('critic.ts calls capabilities.run("craft_judging", …) — the vision-specific routing point', async () => {
  const requestedCapabilities: string[] = [];
  const canned: VisionCritiqueReport = {
    score: 70, verdict: 'POLISH_NEEDED', feelsArtDirectedVsAi: 'HYBRID_SOME_GENERIC',
    criteriaScores: { conceptualCoherence: 7, businessSpecificity: 7, humanArtDirection: 7, visualHierarchy: 7, composition: 7, interactionRestraint: 7, memorability: 7, distinctiveness: 7, factualFidelity: 7, mobileExperience: 7 },
    positiveHighlights: [], issues: [],
  };
  const orchestrator: CapabilityOrchestrator = {
    plan: () => { throw new Error('not exercised'); },
    async run<T>(capability: Parameters<CapabilityOrchestrator['run']>[0], _invoke: unknown) {
      requestedCapabilities.push(capability);
      const record: ExecutionRecord = { capability, attempts: [], servedBy: 'fake', costLines: [], totalCents: 0, degraded: false };
      // This fake always hands back `canned` regardless of the requested T —
      // fine here, since the test knows critic.ts is the only caller and
      // what shape it expects.
      return { outcome: ok({ data: canned, model: 'fake-model' }, 0), record } as unknown as Awaited<ReturnType<CapabilityOrchestrator['run']>> & { outcome: { data: T } };
    },
    board: () => { throw new Error('not exercised'); },
    spend: () => ({ totalCents: 0, byProvider: {}, byCapability: {}, lines: [] }),
    remainingCents: () => 0,
    quota: { used: () => 0, hasRoom: () => true, remaining: () => null, record: async () => {}, snapshot: () => ({ day: 'test', used: {} }) },
    governor: { acquire: async () => {}, release: () => {} } as any,
    policy: { allowPaid: false, budgetCentsRemaining: 0, allowedJurisdictions: ['local'], allowedLicences: ['permissive-local'], autonomous: true, preferFree: true },
  };

  // A 1x1 transparent PNG, base64 — evaluateVision reads real files off disk.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const dir = tmpDir('bf-critic-');
  fs.writeFileSync(path.join(dir, 'desktop.png'), png);
  fs.writeFileSync(path.join(dir, 'mobile.png'), png);

  const result = await evaluateVision({
    desktopShotPath: path.join(dir, 'desktop.png'),
    mobileShotPath: path.join(dir, 'mobile.png'),
    businessName: 'Test Co',
    signature: signature(),
    config: fakeConfig(),
    capabilities: orchestrator,
    logger: noopLogger,
  });

  assert.deepEqual(requestedCapabilities, ['craft_judging']);
  assert.equal(result.score, 70);
});

/* -------------------------------------------------------------------- */
/* #6 repair.ts                                                          */
/* -------------------------------------------------------------------- */

test('repair.ts routes its fix call through the "structured_generation" capability', async () => {
  const { factory, calls } = fakeProviderFactory({
    gemini: { html: '<html>fixed</html>', css: 'body{color:red}', js: 'console.log(1)' },
  });
  const orchestrator = fakeCapabilityOrchestrator({ credentials: GEMINI_ONLY });
  const siteDir = tmpDir('bf-repair-');
  await fsp.writeFile(path.join(siteDir, 'index.html'), '<html>old</html>', 'utf8');
  await fsp.writeFile(path.join(siteDir, 'styles.css'), 'body{}', 'utf8');
  await fsp.writeFile(path.join(siteDir, 'experience.js'), '', 'utf8');

  const repaired = await repairCode({
    siteDir,
    blueprint: blueprint(),
    critique: {
      score: 60, verdict: 'POLISH_NEEDED', feelsArtDirectedVsAi: 'HYBRID_SOME_GENERIC',
      criteriaScores: { conceptualCoherence: 6, businessSpecificity: 6, humanArtDirection: 6, visualHierarchy: 6, composition: 6, interactionRestraint: 6, memorability: 6, distinctiveness: 6, factualFidelity: 6, mobileExperience: 6 },
      positiveHighlights: [], issues: [{ area: 'Layout', severity: 'critical', description: 'broken', fixInstruction: 'fix it' }],
    },
    iteration: 1,
    config: fakeConfig(),
    routing: { capabilities: orchestrator, providers: factory },
    logger: noopLogger,
  });

  assert.equal(repaired.html, '<html>fixed</html>');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.provider, 'gemini');
});
