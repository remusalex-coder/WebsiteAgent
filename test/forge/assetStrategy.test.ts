/**
 * Asset Intelligence — `lib/forge/assetStrategy.ts`.
 *
 * The layer this pipeline did not have before this pass: a real decision,
 * per asset slot, between "use the real photo", "no real photo — vector
 * mark", "no real photo — non-depictive texture", and "unavailable",
 * plus signature-level decisions for video/3D. Every test here proves the
 * decision, not the prose — `planAssetStrategy` is pure and deterministic,
 * and never calls a network or executes a gated capability itself.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { planAssetStrategy, assetStrategyPrompt } from '../../lib/forge/assetStrategy.js';
import { DEFAULT_EXPERIENCE_STRATEGY } from '../../lib/forge/experienceStrategy.js';

import type { ExperienceSignature, FactualDossier, SourcedAsset } from '../../lib/forge/types.js';

function realAsset(overrides: Partial<SourcedAsset> = {}): SourcedAsset {
  return {
    id: 'hero-shot',
    role: 'hero',
    url: 'https://example.com/hero.jpg',
    localPath: 'assets/hero.jpg',
    alt: 'The workshop floor',
    realDescription: 'The workshop floor, two lifts visible',
    provenanceSource: 'google_maps',
    ...overrides,
  };
}

function dossier(overrides: Partial<FactualDossier> = {}): FactualDossier {
  return {
    businessName: 'Test Co', category: 'Test', verifiedFacts: [], inferences: [], creativeInterpretations: [],
    conflicts: [], forbiddenAssumptions: [], realPhotoAssets: [],
    location: { fullAddress: '', street: '', city: '', region: '' }, contact: {}, verifiedReviews: [], primaryLanguage: 'en',
    ...overrides,
  };
}

function signature(overrides: Partial<ExperienceSignature> = {}): ExperienceSignature {
  return {
    selectedTerritoryId: 't1', selectionRationale: 'r', businessTruth: 'truth', humanInsight: 'insight',
    creativeMetaphor: 'metaphor', centralMechanism: 'mechanism', signatureMoment: 'moment',
    interactionGrammar: { paceAndMotion: '', openingMoment: '', scrollChoreography: '', microInteractions: [], selectedPatterns: [], rejectedPatterns: [] },
    visualGrammar: { moodWords: [], colorPalette: { primary: '#000', secondary: '#111', background: '#fff', surface: '#eee', textPrimary: '#000', textMuted: '#555', accent: '#f00' }, typography: { displayFamily: 'Serif', bodyFamily: 'Sans', styleNote: '' }, spatialComposition: '' },
    restraintContract: { forbiddenAntiPatterns: [], mandatoryDesignRules: [] },
    experienceStrategy: DEFAULT_EXPERIENCE_STRATEGY,
    scenes: [],
    ...overrides,
  };
}

/* -------------------------------------------------------------------- */
/* Real asset present                                                    */
/* -------------------------------------------------------------------- */

test('an assetId that matches a real photo is used as-is, no capability, $0', () => {
  const d = dossier({ realPhotoAssets: [realAsset()] });
  const sig = signature({ scenes: [{ id: 's1', actName: 'A', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'l', keyInteraction: 'k', assetIds: ['hero-shot'] }] });
  const strategy = planAssetStrategy(d, sig);
  const decision = strategy.decisions.find((dc) => dc.assetId === 'hero-shot');
  assert.ok(decision);
  assert.equal(decision!.source, 'real');
  assert.equal(decision!.capability, null);
  assert.equal(decision!.gate, 'none');
  assert.equal(strategy.realAssetsUsed, 1);
});

test('a real asset is routed to image_editing (human-gated) when mediaStrategy calls for altering it', () => {
  const d = dossier({ realPhotoAssets: [realAsset()] });
  const sig = signature({
    experienceStrategy: { ...DEFAULT_EXPERIENCE_STRATEGY, mediaStrategy: 'cinematic-hero-media' },
    scenes: [{ id: 's1', actName: 'A', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'l', keyInteraction: 'k', assetIds: ['hero-shot'] }],
  });
  const strategy = planAssetStrategy(d, sig);
  const decision = strategy.decisions.find((dc) => dc.assetId === 'hero-shot');
  assert.equal(decision!.source, 'edited-real');
  assert.equal(decision!.capability, 'image_editing');
  assert.equal(decision!.gate, 'human');
});

/* -------------------------------------------------------------------- */
/* No real asset backing the id                                          */
/* -------------------------------------------------------------------- */

test('an assetId with no matching real photo, and no mark/icon language, falls back to non-depictive — never a fabricated photo', () => {
  const d = dossier({ realPhotoAssets: [] });
  const sig = signature({ scenes: [{ id: 's1', actName: 'A', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'l', keyInteraction: 'scroll reveal', assetIds: ['missing-photo'] }] });
  const strategy = planAssetStrategy(d, sig);
  const decision = strategy.decisions.find((dc) => dc.assetId === 'missing-photo');
  assert.equal(decision!.source, 'non-depictive');
  assert.equal(decision!.capability, 'image_nondepictive');
  assert.equal(decision!.gate, 'none');
  assert.equal(strategy.nonDepictiveSubstitutes, 1);
});

test('an assetId with no matching real photo, but mark/icon language in the scene, is routed to vector_generation instead', () => {
  const d = dossier({ realPhotoAssets: [] });
  const sig = signature({ scenes: [{ id: 's1', actName: 'A', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'l', keyInteraction: 'reveals the brand mark', assetIds: ['brand-mark'] }] });
  const strategy = planAssetStrategy(d, sig);
  const decision = strategy.decisions.find((dc) => dc.assetId === 'brand-mark');
  assert.equal(decision!.source, 'vector');
  assert.equal(decision!.capability, 'vector_generation');
  assert.equal(decision!.gate, 'none');
});

test('no assetIds at all produces no per-scene decisions and a $0 summary', () => {
  const d = dossier();
  const sig = signature({ scenes: [{ id: 's1', actName: 'A', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'l', keyInteraction: 'k', assetIds: [] }] });
  const strategy = planAssetStrategy(d, sig);
  assert.deepEqual(strategy.decisions, []);
  assert.equal(strategy.realAssetsUsed, 0);
});

/* -------------------------------------------------------------------- */
/* Signature-level: video and 3D                                         */
/* -------------------------------------------------------------------- */

test('requiresVideo with a real photo available proposes motion_media, human-gated, never executed', () => {
  const d = dossier({ realPhotoAssets: [realAsset()] });
  const sig = signature({ experienceStrategy: { ...DEFAULT_EXPERIENCE_STRATEGY, requiresVideo: true, requiresVideoRationale: 'the product is motion itself' } });
  const strategy = planAssetStrategy(d, sig);
  const decision = strategy.decisions.find((dc) => dc.sceneId === '__signature__' && dc.capability === 'motion_media');
  assert.ok(decision, 'expected a motion_media decision');
  assert.equal(decision!.source, 'animated-real');
  assert.equal(decision!.gate, 'human');
  assert.equal(strategy.humanGatedCandidates, 1);
});

test('requiresVideo with NO real photo available is honestly unavailable — no fabricated video source', () => {
  const d = dossier({ realPhotoAssets: [] });
  const sig = signature({ experienceStrategy: { ...DEFAULT_EXPERIENCE_STRATEGY, requiresVideo: true, requiresVideoRationale: 'x' } });
  const strategy = planAssetStrategy(d, sig);
  const decision = strategy.decisions.find((dc) => dc.sceneId === '__signature__' && dc.source !== undefined && dc.capability === null);
  assert.ok(decision);
  assert.equal(decision!.source, 'unavailable');
  assert.equal(decision!.gate, 'never');
});

test('requires3D always proposes three_d_generation as gate "never" — the capability is frozen, not merely ungated', () => {
  const d = dossier();
  const sig = signature({ experienceStrategy: { ...DEFAULT_EXPERIENCE_STRATEGY, requires3D: true, requires3DRationale: 'the product is inherently 3D' } });
  const strategy = planAssetStrategy(d, sig);
  const decision = strategy.decisions.find((dc) => dc.capability === 'three_d_generation');
  assert.ok(decision);
  assert.equal(decision!.gate, 'never');
  assert.equal(decision!.source, 'unavailable');
});

test('requires3D false and requiresVideo false produce no signature-level decisions at all', () => {
  const d = dossier();
  const sig = signature();
  const strategy = planAssetStrategy(d, sig);
  assert.ok(!strategy.decisions.some((dc) => dc.sceneId === '__signature__'));
});

/* -------------------------------------------------------------------- */
/* Nothing here executes a capability — pure and network-free            */
/* -------------------------------------------------------------------- */

test('planAssetStrategy is pure: identical inputs produce an identical plan, called twice', () => {
  const d = dossier({ realPhotoAssets: [realAsset()] });
  const sig = signature({ scenes: [{ id: 's1', actName: 'A', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'l', keyInteraction: 'k', assetIds: ['hero-shot', 'missing'] }] });
  assert.deepEqual(planAssetStrategy(d, sig), planAssetStrategy(d, sig));
});

/* -------------------------------------------------------------------- */
/* Prompt rendering                                                      */
/* -------------------------------------------------------------------- */

test('assetStrategyPrompt tells the model which asset ids are real and which are not, by name', () => {
  const d = dossier({ realPhotoAssets: [realAsset()] });
  const sig = signature({ scenes: [{ id: 's1', actName: 'A', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'l', keyInteraction: 'k', assetIds: ['hero-shot', 'missing-photo'] }] });
  const prompt = assetStrategyPrompt(planAssetStrategy(d, sig));
  assert.match(prompt, /"hero-shot".*REAL/);
  assert.match(prompt, /"missing-photo".*non-depictive/);
});

test('assetStrategyPrompt never mentions the __signature__ pseudo-scene — that is not a real scene id', () => {
  const d = dossier();
  const sig = signature({ experienceStrategy: { ...DEFAULT_EXPERIENCE_STRATEGY, requires3D: true, requires3DRationale: 'x' } });
  const prompt = assetStrategyPrompt(planAssetStrategy(d, sig));
  assert.doesNotMatch(prompt, /__signature__/);
});
