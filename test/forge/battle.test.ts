/**
 * Design Battle — proves the mechanism, not the taste: N independently
 * formulated candidates, each routed through the real capability layer,
 * compared with the existing structural-convergence check
 * (`anti-ai-gate.ts`, unmodified) and the existing lexicographic comparator
 * (`lib/qa/verdict.ts`, unmodified) rather than a second scoring system.
 *
 * No live model or vision calls: `creative_direction`/`structured_generation`
 * route through the real planner/executor with a fake `AIProviderFactory`
 * (same pattern as `test/forge/fixtures/routing.ts`); `craft_judging` is
 * intercepted at the orchestrator boundary and handed a canned critique,
 * because `createVisionInvoker` speaks raw HTTP and a hermetic test must
 * never attempt a real network call (see `capability-routing.test.ts`'s
 * critic test for the same reasoning).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runExperienceBattle } from '../../lib/forge/battle.js';
import { fakeCapabilityOrchestrator, noopLogger } from './fixtures/routing.js';
import { ok } from '../../lib/platform/types.js';
import { DEFAULT_EXPERIENCE_STRATEGY } from '../../lib/forge/experienceStrategy.js';

import type { AppConfig } from '../../lib/config.js';
import type { CapabilityOrchestrator } from '../../lib/capability/orchestrator.js';
import type { ExecutionRecord } from '../../lib/capability/execute.js';
import type { FactualDossier, VisionCritiqueReport } from '../../lib/forge/types.js';
import type { AIProviderFactory } from '../../lib/ai/factory.js';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fakeConfig(): AppConfig {
  return {
    ai: { provider: 'gemini', apiKeys: { gemini: 'x', openai: '', anthropic: '', openrouter: '' }, baseUrls: { gemini: null, openai: null, anthropic: null, openrouter: null }, requestTimeoutMs: 30_000, maxRetries: 0, retryBaseDelayMs: 100, openRouterReferer: null, openRouterTitle: null },
    analyst: { model: 'm' }, writer: { model: 'm' }, director: { model: 'm' },
    outputDir: '.', logLevel: 'silent',
  } as AppConfig;
}

function dossier(): FactualDossier {
  return {
    businessName: 'Ridgeway Motors', category: 'Auto repair', verifiedFacts: [], inferences: [], creativeInterpretations: [],
    conflicts: [], forbiddenAssumptions: [], realPhotoAssets: [],
    location: { fullAddress: '1 Workshop Lane', street: '1 Workshop Lane', city: 'Ridgeway', region: 'Berkshire' },
    contact: { phone: '0700 000 000' }, verifiedReviews: [], primaryLanguage: 'en',
  };
}

function signatureData(overrides: Record<string, unknown> = {}) {
  return {
    selectedTerritoryId: 't1', selectionRationale: 'r', businessTruth: 'truth', humanInsight: 'insight',
    creativeMetaphor: 'metaphor A', centralMechanism: 'mechanism A', signatureMoment: 'moment',
    interactionGrammar: { paceAndMotion: '', openingMoment: '', scrollChoreography: '', microInteractions: [], selectedPatterns: ['pattern A'], rejectedPatterns: [] },
    visualGrammar: { moodWords: [], colorPalette: { primary: '#000A', secondary: '#111', background: '#fffA', surface: '#eee', textPrimary: '#000', textMuted: '#555', accent: '#f00' }, typography: { displayFamily: 'Serif', bodyFamily: 'Sans', styleNote: '' }, spatialComposition: '' },
    restraintContract: { forbiddenAntiPatterns: [], mandatoryDesignRules: [] },
    experienceStrategy: DEFAULT_EXPERIENCE_STRATEGY,
    scenes: [{ id: 's1', actName: 'ACT I', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'split', keyInteraction: 'none', assetIds: [] }],
    ...overrides,
  };
}

/** Queues canned generate() responses in call order across both capabilities' 4 calls per candidate. */
function queuedProviderFactory(responses: readonly unknown[]): AIProviderFactory {
  let i = 0;
  const build = () => ({
    name: 'gemini' as const, version: 'fake-1.0', defaultModel: 'fake-model', supportsNativeSchema: true,
    async generate(request: { readonly model: string }) {
      const data = responses[i] ?? responses[responses.length - 1];
      i++;
      return { data, model: request.model, usage: { inputTokens: 1, outputTokens: 1 }, structuredOutput: 'native' as const, finishReason: 'stop' };
    },
    async health() { return { status: 'ready' as const, detail: 'fake', checkedAt: new Date().toISOString(), latencyMs: 0 }; },
  });
  return {
    supported: ['gemini'], createDefault: () => build(), tryCreateDefault: () => build(),
    configured: () => ['gemini'], selected: () => 'gemini', status: async () => [],
    create: () => build(),
  };
}

/** Intercepts craft_judging at the orchestrator boundary with a queue of canned critiques; everything else goes to the real planner/executor. */
function battleOrchestrator(real: CapabilityOrchestrator, critiques: readonly VisionCritiqueReport[]): CapabilityOrchestrator {
  let i = 0;
  return {
    ...real,
    async run<T>(capability: Parameters<CapabilityOrchestrator['run']>[0], invoke: unknown, overrides?: unknown) {
      if (capability === 'craft_judging') {
        const critique = critiques[i] ?? critiques[critiques.length - 1]!;
        i++;
        const record: ExecutionRecord = { capability, attempts: [], servedBy: 'fake', costLines: [], totalCents: 0, degraded: false };
        return { outcome: ok({ data: critique, model: 'fake-model' }, 0), record } as unknown as Awaited<ReturnType<CapabilityOrchestrator['run']>> & { outcome: { data: T } };
      }
      return real.run(capability, invoke as never, overrides as never);
    },
  };
}

function critique(overrides: Partial<VisionCritiqueReport> = {}): VisionCritiqueReport {
  return {
    score: 60, verdict: 'POLISH_NEEDED', feelsArtDirectedVsAi: 'HYBRID_SOME_GENERIC',
    criteriaScores: { conceptualCoherence: 6, businessSpecificity: 6, humanArtDirection: 6, visualHierarchy: 6, composition: 6, interactionRestraint: 6, memorability: 6, distinctiveness: 6, factualFidelity: 6, mobileExperience: 6 },
    positiveHighlights: [], issues: [],
    ...overrides,
  };
}

test('two genuinely divergent candidates: the higher-scoring one wins, via the existing lexicographic comparator', async () => {
  const html = '<!DOCTYPE html><html><body>hi</body></html>';
  const responses = [
    { territories: [{ id: 't1', name: 'n', conceptThesis: 'c', metaphor: 'm', emotionalTarget: 'e', visualLanguage: 'v', interactionLanguage: 'i', signatureMoment: 's', risks: [], reasonsNotToChoose: 'r' }] },
    signatureData({ creativeMetaphor: 'metaphor A', centralMechanism: 'mechanism A' }),
    { html }, { css: '', js: '' },
    { territories: [{ id: 't2', name: 'n', conceptThesis: 'c', metaphor: 'm', emotionalTarget: 'e', visualLanguage: 'v', interactionLanguage: 'i', signatureMoment: 's', risks: [], reasonsNotToChoose: 'r' }] },
    signatureData({ creativeMetaphor: 'metaphor B totally different', centralMechanism: 'mechanism B totally different', interactionGrammar: { paceAndMotion: '', openingMoment: '', scrollChoreography: '', microInteractions: [], selectedPatterns: ['pattern B'], rejectedPatterns: [] }, visualGrammar: { moodWords: [], colorPalette: { primary: '#B', secondary: '#B', background: '#B', surface: '#B', textPrimary: '#B', textMuted: '#B', accent: '#B' }, typography: { displayFamily: 'B', bodyFamily: 'B', styleNote: '' }, spatialComposition: '' } }),
    { html }, { css: '', js: '' },
  ];
  const orchestrator = battleOrchestrator(
    fakeCapabilityOrchestrator({ credentials: new Set(['GEMINI_API_KEY']) }),
    [critique({ score: 50, criteriaScores: { ...critique().criteriaScores, businessSpecificity: 5, distinctiveness: 5 } }), critique({ score: 85, criteriaScores: { ...critique().criteriaScores, businessSpecificity: 9, distinctiveness: 9 } })],
  );

  const result = await runExperienceBattle({
    dossier: dossier(),
    config: fakeConfig(),
    routing: { capabilities: orchestrator, providers: queuedProviderFactory(responses) },
    runDir: tmpDir('bf-battle-'),
    logger: noopLogger,
    candidateCount: 2,
  });

  assert.equal(result.candidates.length, 2);
  assert.equal(result.convergenceWarning, null, 'two deliberately different signatures should not be flagged as converging');
  assert.equal(result.allCandidatesWeak, false);
  assert.ok(result.winner);
  assert.equal(result.winner!.id, 'candidate-1', 'the candidate with the higher craft/specificity/distinctiveness scores should win');
});

test('two candidates that land on the same signature are flagged as convergence, not silently accepted as "two directions"', async () => {
  const html = '<!DOCTYPE html><html><body>hi</body></html>';
  const identicalSignature = signatureData();
  const responses = [
    { territories: [{ id: 't1', name: 'n', conceptThesis: 'c', metaphor: 'm', emotionalTarget: 'e', visualLanguage: 'v', interactionLanguage: 'i', signatureMoment: 's', risks: [], reasonsNotToChoose: 'r' }] },
    identicalSignature,
    { html }, { css: '', js: '' },
    { territories: [{ id: 't1', name: 'n', conceptThesis: 'c', metaphor: 'm', emotionalTarget: 'e', visualLanguage: 'v', interactionLanguage: 'i', signatureMoment: 's', risks: [], reasonsNotToChoose: 'r' }] },
    identicalSignature, // the model returned essentially the same signature the second time
    { html }, { css: '', js: '' },
  ];
  const orchestrator = battleOrchestrator(
    fakeCapabilityOrchestrator({ credentials: new Set(['GEMINI_API_KEY']) }),
    [critique(), critique()],
  );

  const result = await runExperienceBattle({
    dossier: dossier(),
    config: fakeConfig(),
    routing: { capabilities: orchestrator, providers: queuedProviderFactory(responses) },
    runDir: tmpDir('bf-battle-converge-'),
    logger: noopLogger,
    candidateCount: 2,
  });

  assert.ok(result.convergenceWarning, 'identical signatures across two candidates should be caught by the existing structural-convergence check');
  assert.match(result.convergenceWarning!, /candidate-0/);
});
