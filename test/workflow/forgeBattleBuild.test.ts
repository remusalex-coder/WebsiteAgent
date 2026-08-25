/**
 * `runForgeBattleBuild` — the WQ-018 battle-mode build hook wired into
 * `runJob.ts`.
 *
 * Hermetic, same pattern as `test/forge/battle.test.ts`: `creative_direction`/
 * `structured_generation` route through the real capability planner/executor
 * with a fake `AIProviderFactory`; `craft_judging` (the vision critic) and
 * `reasoning` (the dossier-compile step `buildRunDossier` runs before the
 * battle itself) are both intercepted at the orchestrator boundary with
 * canned/degraded results, because neither speaks a shape a hermetic test
 * should try to fake through raw HTTP or guess the exact queue position of.
 *
 * This is the seam `runExperienceForge`'s single-build path does NOT get an
 * equivalent test for either (see `test/workflow/runJob.test.ts`'s own doc
 * comment — every existing test there overrides `hooks.build` rather than
 * exercising the real `cfg.experienceEngine === 'signature'` branch), so
 * this test is deliberately narrower in scope than a full pipeline proof:
 * it exists to prove the two things WQ-018 actually added — the winner's
 * site lands at the run's canonical `site/` path, and `job.forgeBattle` is
 * persisted in the real writer shape `summary.ts`'s `summarizeForgeBattle`
 * reads — not to re-prove `runExperienceBattle`'s own candidate-selection
 * logic, which `battle.test.ts` already covers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runForgeBattleBuild } from '../../lib/workflow/runJob.js';
import { loadJob } from '../../lib/workflow/jobState.js';
import { summarizeJob } from '../../lib/workflow/summary.js';
import { fakeCapabilityOrchestrator, noopLogger } from '../forge/fixtures/routing.js';
import { ok } from '../../lib/platform/types.js';
import { DEFAULT_EXPERIENCE_STRATEGY } from '../../lib/forge/experienceStrategy.js';
import { loadConfig } from '../../lib/config.js';

import type { AppConfig } from '../../lib/config.js';
import type { CapabilityOrchestrator } from '../../lib/capability/orchestrator.js';
import type { ExecutionRecord } from '../../lib/capability/execute.js';
import type { VisionCritiqueReport } from '../../lib/forge/types.js';
import type { AIProviderFactory } from '../../lib/ai/factory.js';

function tmpRunDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-forge-battle-build-'));
  fs.writeFileSync(
    path.join(root, '3-profile.json'),
    JSON.stringify({ name: { value: 'Ridgeway Motors' }, category: { value: 'Auto repair' }, description: null }),
    'utf8',
  );
  return root;
}

function fakeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig(),
    ai: { provider: 'gemini', apiKeys: { gemini: 'x', openai: '', anthropic: '', openrouter: '' }, baseUrls: { gemini: null, openai: null, anthropic: null, openrouter: null }, requestTimeoutMs: 30_000, maxRetries: 0, retryBaseDelayMs: 100, openRouterReferer: null, openRouterTitle: null } as AppConfig['ai'],
    analyst: { model: 'm' } as AppConfig['analyst'],
    writer: { model: 'm' } as AppConfig['writer'],
    director: { model: 'm' } as AppConfig['director'],
    logLevel: 'silent',
    forgeBattleMode: true,
    forgeBattleCandidateCount: 1,
    ...overrides,
  } as AppConfig;
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

/** Queues canned generate() responses in call order for `creative_direction`/`structured_generation` calls only. */
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

function critique(overrides: Partial<VisionCritiqueReport> = {}): VisionCritiqueReport {
  return {
    score: 92, verdict: 'EXCEPTIONAL', feelsArtDirectedVsAi: 'INTENTIONALLY_ART_DIRECTED',
    criteriaScores: { conceptualCoherence: 9, businessSpecificity: 9, humanArtDirection: 9, visualHierarchy: 9, composition: 9, interactionRestraint: 9, memorability: 9, distinctiveness: 9, factualFidelity: 9, mobileExperience: 9 },
    positiveHighlights: [], issues: [],
    ...overrides,
  };
}

/**
 * Intercepts `craft_judging` (canned critiques) and `reasoning` (the
 * dossier-compile step) at the orchestrator boundary; every other capability
 * — `creative_direction`, `structured_generation` — goes to the real
 * planner/executor with `queuedProviderFactory`'s fake vendor. See the
 * module doc comment for why these two specifically are intercepted rather
 * than queued.
 */
function battleBuildOrchestrator(real: CapabilityOrchestrator, critiques: readonly VisionCritiqueReport[]): CapabilityOrchestrator {
  let i = 0;
  return {
    ...real,
    async run<T>(capability: Parameters<CapabilityOrchestrator['run']>[0], invoke: unknown, overrides?: unknown) {
      if (capability === 'craft_judging') {
        const c = critiques[i] ?? critiques[critiques.length - 1]!;
        i++;
        const record: ExecutionRecord = { capability, attempts: [], servedBy: 'fake', costLines: [], totalCents: 0, degraded: false };
        return { outcome: ok({ data: c, model: 'fake-model' }, 0), record } as unknown as Awaited<ReturnType<CapabilityOrchestrator['run']>> & { outcome: { data: T } };
      }
      if (capability === 'reasoning') {
        // The dossier's own writer shape — every field this stage reads
        // tolerates omission and falls back to a hardcoded default
        // (grounding.ts's own reasoning), so an empty object is a genuine,
        // realistic "no vendor had anything to add" result, not a stub that
        // only works because nothing downstream reads it.
        const record: ExecutionRecord = { capability, attempts: [], servedBy: 'fake', costLines: [], totalCents: 0, degraded: false };
        return { outcome: ok({ data: {}, model: 'fake-model' }, 0), record } as unknown as Awaited<ReturnType<CapabilityOrchestrator['run']>> & { outcome: { data: T } };
      }
      return real.run(capability, invoke as never, overrides as never);
    },
  };
}

test('WQ-018: a winning single-candidate battle copies the winner site into the run\'s canonical site/ directory', async () => {
  const outputDir = tmpRunDir();
  const html = '<!DOCTYPE html><html><body>battle winner</body></html>';
  const responses = [
    { territories: [{ id: 't1', name: 'n', conceptThesis: 'c', metaphor: 'm', emotionalTarget: 'e', visualLanguage: 'v', interactionLanguage: 'i', signatureMoment: 's', risks: [], reasonsNotToChoose: 'r' }] },
    signatureData(),
    { html }, { css: 'body{}', js: '' },
  ];
  const routing = {
    capabilities: battleBuildOrchestrator(fakeCapabilityOrchestrator({ credentials: new Set(['GEMINI_API_KEY']) }), [critique()]),
    providers: queuedProviderFactory(responses),
  };

  await runForgeBattleBuild('testrun', fakeConfig(), outputDir, noopLogger, routing);

  const siteIndexPath = path.join(outputDir, 'site', 'index.html');
  assert.ok(fs.existsSync(siteIndexPath), 'the winner\'s index.html must land at the canonical site/ path');
  assert.equal(fs.readFileSync(siteIndexPath, 'utf8'), html);

  const job = await loadJob(outputDir);
  assert.ok(job, 'runForgeBattleBuild must persist job.json via saveJob');
  const summary = summarizeJob(job!);
  assert.ok(summary.forgeBattle, 'forgeBattle must be populated, not left null, after a battle build ran');
  assert.equal(summary.forgeBattle!.count, 1);
  assert.equal(summary.forgeBattle!.winnerId, 'candidate-0');
  assert.equal(summary.forgeBattle!.allCandidatesWeak, false);
  assert.equal(summary.forgeBattle!.candidates.length, 1);
  assert.equal(summary.forgeBattle!.candidates[0]!.id, 'candidate-0');
  assert.equal(summary.forgeBattle!.candidates[0]!.repairIterations, 0, 'a clean first-pass critique needs no repair');

  // The classic diverge battle's own field must be untouched by this path.
  assert.equal(job!.designDirections, null);
});

test('WQ-018: an all-weak battle leaves the template build\'s site/ unreplaced and still records forgeBattle', async () => {
  const outputDir = tmpRunDir();
  // Pre-seed the site dir the way composeStandalone's template build already
  // would have, before the battle-mode hook runs — this is what "the
  // template build stands unreplaced" means concretely.
  fs.mkdirSync(path.join(outputDir, 'site'), { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'site', 'index.html'), '<!doctype html><title>template</title>', 'utf8');

  const html = '<!DOCTYPE html><html><body>weak candidate</body></html>';
  const responses = [
    { territories: [{ id: 't1', name: 'n', conceptThesis: 'c', metaphor: 'm', emotionalTarget: 'e', visualLanguage: 'v', interactionLanguage: 'i', signatureMoment: 's', risks: [], reasonsNotToChoose: 'r' }] },
    signatureData(),
    { html }, { css: '', js: '' },
    // One repair attempt's combined response, still weak — repair.ts issues
    // exactly one model call per iteration.
    { html, css: '', js: '' },
  ];
  const routing = {
    capabilities: battleBuildOrchestrator(fakeCapabilityOrchestrator({ credentials: new Set(['GEMINI_API_KEY']) }), [
      critique({ score: 20, verdict: 'REPAIR_REQUIRED', feelsArtDirectedVsAi: 'OBVIOUSLY_AI_GENERATED', issues: [{ severity: 'critical', area: 'concept', description: 'generic template', fixInstruction: 'start over' }] }),
      critique({ score: 20, verdict: 'REPAIR_REQUIRED', feelsArtDirectedVsAi: 'OBVIOUSLY_AI_GENERATED', issues: [{ severity: 'critical', area: 'concept', description: 'still generic', fixInstruction: 'start over' }] }),
    ]),
    providers: queuedProviderFactory(responses),
  };

  await runForgeBattleBuild('testrun', fakeConfig({ forgeBattleCandidateCount: 1 }), outputDir, noopLogger, routing);

  const siteIndexPath = path.join(outputDir, 'site', 'index.html');
  assert.equal(fs.readFileSync(siteIndexPath, 'utf8'), '<!doctype html><title>template</title>', 'an all-weak battle must never overwrite the template build');

  const job = await loadJob(outputDir);
  const summary = summarizeJob(job!);
  assert.equal(summary.forgeBattle!.winnerId, null);
  assert.equal(summary.forgeBattle!.allCandidatesWeak, true);
});
