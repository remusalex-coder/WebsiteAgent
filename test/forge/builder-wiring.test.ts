/**
 * Proves the new Experience Strategy / Motion System / Functional Module
 * decisions actually reach the builder's prompts — declaring a field on
 * `ExperienceSignature` and never reading it would be exactly the
 * "infrastructure nobody wired up" failure mode this session's audit was
 * asked to rule out.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildFrontend } from '../../lib/forge/builder.js';
import { fakeCapabilityOrchestrator, noopLogger } from './fixtures/routing.js';
import { DEFAULT_EXPERIENCE_STRATEGY } from '../../lib/forge/experienceStrategy.js';
import { planAssetStrategy } from '../../lib/forge/assetStrategy.js';

import type { AppConfig } from '../../lib/config.js';
import type { ExperienceBlueprint } from '../../lib/forge/types.js';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fakeConfig(): AppConfig {
  return {
    ai: { provider: 'gemini', apiKeys: { gemini: 'x', openai: '', anthropic: '', openrouter: '' }, baseUrls: { gemini: null, openai: null, anthropic: null, openrouter: null }, requestTimeoutMs: 30_000, maxRetries: 0, retryBaseDelayMs: 100, openRouterReferer: null, openRouterTitle: null },
    analyst: { model: 'm' },
    writer: { model: 'm' },
    outputDir: '.',
    logLevel: 'silent',
  } as AppConfig;
}

function blueprint(): ExperienceBlueprint {
  const factualDossier = {
    businessName: 'Ridgeway Motors', category: 'Auto repair', verifiedFacts: [], inferences: [], creativeInterpretations: [],
    conflicts: [], forbiddenAssumptions: [], realPhotoAssets: [],
    location: { fullAddress: '', street: '', city: '', region: '' }, contact: { phone: '0700 000 000' }, verifiedReviews: [], primaryLanguage: 'en',
  };
  const signature = {
    selectedTerritoryId: 't1', selectionRationale: 'r', businessTruth: 'truth', humanInsight: 'insight',
    creativeMetaphor: 'metaphor', centralMechanism: 'mechanism', signatureMoment: 'moment',
    interactionGrammar: { paceAndMotion: '', openingMoment: '', scrollChoreography: '', microInteractions: [], selectedPatterns: [], rejectedPatterns: [] },
    visualGrammar: { moodWords: [], colorPalette: { primary: '#000', secondary: '#111', background: '#fff', surface: '#eee', textPrimary: '#000', textMuted: '#555', accent: '#f00' }, typography: { displayFamily: 'Serif', bodyFamily: 'Sans', styleNote: '' }, spatialComposition: '' },
    restraintContract: { forbiddenAntiPatterns: [], mandatoryDesignRules: [] },
    experienceStrategy: {
      ...DEFAULT_EXPERIENCE_STRATEGY,
      motionIntensity: 'expressive' as const,
      functionalModules: ['booking-request' as const],
    },
    scenes: [{ id: 's1', actName: 'ACT I', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'split', keyInteraction: 'none', assetIds: ['hero-shot'] }],
  };
  return {
    brandName: 'Ridgeway Motors',
    factualDossier,
    signature,
    conversionStrategy: { primaryActionLabel: 'Call', primaryActionType: 'call', reassurancePoints: [] },
    assetStrategy: planAssetStrategy(factualDossier, signature),
  };
}

test('the HTML pass prompt names the selected functional module\'s real fields', async () => {
  const prompts: string[] = [];
  const providers = {
    supported: ['gemini'], createDefault: () => providers.create('gemini'), tryCreateDefault: () => providers.create('gemini'),
    configured: () => ['gemini'], selected: () => 'gemini', status: async () => [],
    create: (name: 'gemini') => ({
      name, version: 'fake-1.0', defaultModel: 'fake-model', supportsNativeSchema: true,
      async generate(request: { readonly model: string; readonly prompt: string }) {
        prompts.push(request.prompt);
        const isFirstCall = prompts.length === 1;
        return {
          data: isFirstCall ? { html: '<!DOCTYPE html><html><body>hi</body></html>' } : { css: 'body{}', js: '' },
          model: request.model, usage: { inputTokens: 1, outputTokens: 1 }, structuredOutput: 'native' as const, finishReason: 'stop',
        };
      },
      async health() { return { status: 'ready' as const, detail: 'fake', checkedAt: new Date().toISOString(), latencyMs: 0 }; },
    }),
  };
  const orchestrator = fakeCapabilityOrchestrator({ credentials: new Set(['GEMINI_API_KEY']) });

  await buildFrontend(blueprint(), tmpDir('bf-wiring-'), fakeConfig(), { capabilities: orchestrator, providers: providers as any }, noopLogger);

  assert.equal(prompts.length, 2);
  const [htmlPrompt, cssJsPrompt] = prompts;

  // The functional module spec reached the HTML pass.
  assert.match(htmlPrompt!, /MODULE "booking-request"/);
  assert.match(htmlPrompt!, /preferredDate/);
  assert.match(htmlPrompt!, /mailto/i);

  // The experience-strategy directives reached the HTML pass.
  assert.match(htmlPrompt!, /EXPERIENCE STRATEGY DIRECTIVES/);
  assert.match(htmlPrompt!, new RegExp(DEFAULT_EXPERIENCE_STRATEGY.navigationModel));

  // The motion contract reached the CSS/JS pass, with the expressive-tier tokens.
  assert.match(cssJsPrompt!, /MOTION SYSTEM CONTRACT \(intensity: "expressive"\)/);
  assert.match(cssJsPrompt!, /emphasizedDecelerate/);
  assert.match(cssJsPrompt!, /scroll-hijacking/);

  // The plumbing fix: the HTML pass — not just the CSS/JS pass — now sees the
  // motion library guidance, because a CDN <script> tag has to land in the
  // HTML this pass writes; Pass 2 has no channel back into index.html.
  assert.match(htmlPrompt!, /MOTION LIBRARIES \(intensity: "expressive"\)/);
  assert.match(htmlPrompt!, /GSAP/);
  assert.match(htmlPrompt!, /THIS document/);

  // The asset strategy reached the HTML pass: "hero-shot" has no matching real
  // photo, so it must be told to fall back to a non-depictive treatment, not
  // treated as if a real photograph exists.
  assert.match(htmlPrompt!, /ASSET STRATEGY/);
  assert.match(htmlPrompt!, /"hero-shot"/);
  assert.match(htmlPrompt!, /non-depictive/);
});

test('a "none" motion intensity tells the CSS/JS pass no animated transitions are available', async () => {
  const prompts: string[] = [];
  const providers = {
    supported: ['gemini'], createDefault: () => providers.create('gemini'), tryCreateDefault: () => providers.create('gemini'),
    configured: () => ['gemini'], selected: () => 'gemini', status: async () => [],
    create: (name: 'gemini') => ({
      name, version: 'fake-1.0', defaultModel: 'fake-model', supportsNativeSchema: true,
      async generate(request: { readonly model: string; readonly prompt: string }) {
        prompts.push(request.prompt);
        return {
          data: prompts.length === 1 ? { html: '<!DOCTYPE html><html><body>hi</body></html>' } : { css: '', js: '' },
          model: request.model, usage: { inputTokens: 1, outputTokens: 1 }, structuredOutput: 'native' as const, finishReason: 'stop',
        };
      },
      async health() { return { status: 'ready' as const, detail: 'fake', checkedAt: new Date().toISOString(), latencyMs: 0 }; },
    }),
  };
  const orchestrator = fakeCapabilityOrchestrator({ credentials: new Set(['GEMINI_API_KEY']) });
  const bp = blueprint();
  const noneStrategySig = { ...bp.signature, experienceStrategy: { ...DEFAULT_EXPERIENCE_STRATEGY, motionIntensity: 'none' as const, functionalModules: ['none' as const] } };

  await buildFrontend({ ...bp, signature: noneStrategySig }, tmpDir('bf-wiring-none-'), fakeConfig(), { capabilities: orchestrator, providers: providers as any }, noopLogger);

  assert.match(prompts[1]!, /no animated transitions beyond instant state changes/);
  assert.match(prompts[0]!, /none selected/i);
});
