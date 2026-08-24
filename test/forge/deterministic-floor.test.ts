/**
 * Proves the deterministic floor every `bindings.ts` chain declares is
 * actually *reachable*, not just declared.
 *
 * `test/capability/bindings.test.ts` already proves every capability whose
 * descriptor names a terminal ends its chain with a `kind: 'deterministic'`
 * binding. It does not prove that step can run: before `withDeterministicFloor`
 * (`lib/capability/invokers.ts`), every Forge stage built its `invoke` from
 * `createModelInvoker` alone, whose returned function throws
 * `createModelInvoker was handed a non-model step` on anything but
 * `kind: 'model'` — so a chain that actually exhausted every model and
 * reached its own declared floor crashed instead of degrading. In
 * `grounding.ts` and `research.ts` that crash took down the whole run, not
 * just the one capability call, exactly contradicting the reason
 * `bindings.ts` declares a floor at all.
 *
 * Each test here forces that exact scenario — the only credentialled vendor
 * (Gemini) fails, so the plan's chain is `[gemini model step, deterministic
 * floor step]` — and checks the stage survives by whatever its own floor
 * means: `grounding.ts`/`research.ts` compose from their existing per-field
 * defaults, `repair.ts` keeps the code already on disk, and
 * `builder.ts`/`signature.ts` (which have no deterministic content to
 * substitute) fail with a clearly labelled error rather than the internal
 * "non-model step" one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { fakeCapabilityOrchestrator, fakeProviderFactory, noopLogger } from './fixtures/routing.js';
import { DEFAULT_EXPERIENCE_STRATEGY } from '../../lib/forge/experienceStrategy.js';
import { planAssetStrategy } from '../../lib/forge/assetStrategy.js';

import { harvestResearch } from '../../lib/forge/research.js';
import { buildFactualDossier } from '../../lib/forge/grounding.js';
import { buildFrontend } from '../../lib/forge/builder.js';
import { repairCode } from '../../lib/forge/repair.js';
import { formulateExperienceSignature } from '../../lib/forge/signature.js';

import type { AppConfig } from '../../lib/config.js';
import type { ExperienceBlueprint, ExperienceSignature, FactualDossier } from '../../lib/forge/types.js';

const GEMINI_ONLY = new Set(['GEMINI_API_KEY']);

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fakeConfig(): AppConfig {
  return {
    ai: { provider: 'gemini', apiKeys: { gemini: 'x', openai: '', anthropic: '', openrouter: '' }, baseUrls: { gemini: null, openai: null, anthropic: null, openrouter: null }, requestTimeoutMs: 30_000, maxRetries: 0, retryBaseDelayMs: 100, openRouterReferer: null, openRouterTitle: null },
    analyst: { model: 'pinned-analyst-model' },
    writer: { model: 'pinned-writer-model' },
    director: { model: 'pinned-director-model' },
    outputDir: '.',
    logLevel: 'silent',
  } as AppConfig;
}

function dossierFixture(): FactualDossier {
  return {
    businessName: 'Test Co', category: 'Test', verifiedFacts: [], inferences: [], creativeInterpretations: [],
    conflicts: [], forbiddenAssumptions: [], realPhotoAssets: [],
    location: { fullAddress: '', street: '', city: '', region: '' }, contact: {}, verifiedReviews: [], primaryLanguage: 'en',
  } as unknown as FactualDossier;
}

function signatureFixture(): ExperienceSignature {
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

function blueprintFixture(): ExperienceBlueprint {
  const factualDossier = dossierFixture();
  const sig = signatureFixture();
  return {
    brandName: 'Test Co',
    factualDossier,
    signature: sig,
    conversionStrategy: { primaryActionLabel: 'Call', primaryActionType: 'call', reassurancePoints: [] },
    assetStrategy: planAssetStrategy(factualDossier, sig),
  };
}

/* -------------------------------------------------------------------- */
/* grounding.ts — reasoning's floor composes the dossier from defaults    */
/* -------------------------------------------------------------------- */

test('grounding.ts survives every vendor failing by reaching its deterministic floor, not crashing', async () => {
  const { factory, calls } = fakeProviderFactory({ gemini: 'unreachable' });
  const orchestrator = fakeCapabilityOrchestrator({ credentials: GEMINI_ONLY });

  const dossier = await buildFactualDossier({
    url: 'https://example.com',
    rawPages: [{ url: 'https://example.com', title: 'Fake Co', text: 'some evidence' }],
    downloadedAssets: [],
    runDir: tmpDir('bf-grounding-floor-'),
    config: fakeConfig(),
    routing: { capabilities: orchestrator, providers: factory },
    logger: noopLogger,
  });

  // The gemini step was attempted and failed; the run still produced a
  // dossier instead of throwing — the deterministic floor was reached and
  // ran, rather than the chain exhausting on the "non-model step" error.
  assert.equal(calls.length, 1);
  assert.equal(typeof dossier.businessName, 'string');
  assert.ok(dossier.businessName.length > 0);
});

/* -------------------------------------------------------------------- */
/* research.ts — same floor, same reasoning capability                   */
/* -------------------------------------------------------------------- */

test('research.ts survives every vendor failing by reaching its deterministic floor, not crashing', async () => {
  const { factory, calls } = fakeProviderFactory({ gemini: 'unreachable' });
  const orchestrator = fakeCapabilityOrchestrator({ credentials: GEMINI_ONLY });

  const result = await harvestResearch({
    url: 'http://127.0.0.1:1/', // nothing listens here — the crawl fails fast, synthesis still runs
    runDir: tmpDir('bf-research-floor-'),
    config: fakeConfig(),
    routing: { capabilities: orchestrator, providers: factory },
    logger: noopLogger,
  });

  assert.equal(calls.length, 1);
  assert.equal(typeof result.name, 'string');
  assert.ok(result.name.length > 0);
});

/* -------------------------------------------------------------------- */
/* repair.ts — reject-directive's floor is literally "keep current code"  */
/* -------------------------------------------------------------------- */

test('repair.ts survives every vendor failing by reaching its deterministic floor, returning the code unchanged', async () => {
  const { factory, calls } = fakeProviderFactory({ gemini: 'unreachable' });
  const orchestrator = fakeCapabilityOrchestrator({ credentials: GEMINI_ONLY });
  const siteDir = tmpDir('bf-repair-floor-');
  await fsp.writeFile(path.join(siteDir, 'index.html'), '<html>old</html>', 'utf8');
  await fsp.writeFile(path.join(siteDir, 'styles.css'), 'body{}', 'utf8');
  await fsp.writeFile(path.join(siteDir, 'experience.js'), '', 'utf8');

  const repaired = await repairCode({
    siteDir,
    blueprint: blueprintFixture(),
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

  assert.equal(calls.length, 1);
  // Degraded to the floor: the code on disk comes back unchanged, not a
  // "Code repair failed, retaining current code" catch triggered by an
  // internal-invariant error that happened to look like a graceful skip.
  assert.equal(repaired.html, '<html>old</html>');
  assert.equal(repaired.css, 'body{}');
});

/* -------------------------------------------------------------------- */
/* builder.ts — no deterministic markup exists; fails cleanly and clearly */
/* -------------------------------------------------------------------- */

test('builder.ts fails with a clearly labelled error when its deterministic floor is reached, not the internal invoker error', async () => {
  const { factory, calls } = fakeProviderFactory({ gemini: 'unreachable' });
  const orchestrator = fakeCapabilityOrchestrator({ credentials: GEMINI_ONLY });

  await assert.rejects(
    () => {
      const runDir = tmpDir('bf-builder-floor-');
      return buildFrontend(blueprintFixture(), runDir, path.join(runDir, 'site'), fakeConfig(), { capabilities: orchestrator, providers: factory }, noopLogger);
    },
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(!err.message.includes('was handed a non-model step'), `unexpected internal-invariant error leaked through: ${err.message}`);
      assert.ok(err.message.includes('no vendor could generate'));
      return true;
    },
  );

  assert.equal(calls.length, 1);
});

/* -------------------------------------------------------------------- */
/* signature.ts — no deterministic creative direction exists yet          */
/* -------------------------------------------------------------------- */

test('signature.ts fails with a clearly labelled error when its deterministic floor is reached, not the internal invoker error', async () => {
  const { factory, calls } = fakeProviderFactory({ gemini: 'unreachable' });
  const orchestrator = fakeCapabilityOrchestrator({ credentials: GEMINI_ONLY });

  await assert.rejects(
    () => formulateExperienceSignature(dossierFixture(), fakeConfig(), { capabilities: orchestrator, providers: factory }, noopLogger),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(!err.message.includes('was handed a non-model step'), `unexpected internal-invariant error leaked through: ${err.message}`);
      assert.ok(err.message.includes('no vendor could formulate creative territories'));
      return true;
    },
  );

  assert.equal(calls.length, 1);
});
