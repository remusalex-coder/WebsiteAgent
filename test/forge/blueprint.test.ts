/**
 * `compileBlueprint`'s conversion-strategy derivation.
 *
 * Documented in the module itself: this used to be four hardcoded string
 * literals — River Park Events Drăgășani's own reservation copy, in
 * Romanian, applied to every business regardless of category or language.
 * These tests are the contract that regression protects: the action type
 * follows the business's own category, the label follows the dossier's own
 * language, and reassurance points are never invented beyond what the
 * dossier actually verified.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { compileBlueprint } from '../../lib/forge/blueprint.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';
import { DEFAULT_EXPERIENCE_STRATEGY } from '../../lib/forge/experienceStrategy.js';

import type { ExperienceSignature, FactualDossier } from '../../lib/forge/types.js';

const logger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });

function dossier(overrides: Partial<FactualDossier> = {}): FactualDossier {
  return {
    businessName: 'Ridgeway Motors',
    category: 'Auto repair',
    verifiedFacts: [],
    inferences: [],
    creativeInterpretations: [],
    conflicts: [],
    forbiddenAssumptions: [],
    realPhotoAssets: [],
    location: { fullAddress: '1 Workshop Lane, Ridgeway, RG12 4AB', street: '1 Workshop Lane', city: 'Ridgeway', region: 'Berkshire' },
    contact: {},
    verifiedReviews: [],
    primaryLanguage: 'en',
    ...overrides,
  };
}

function signature(overrides: Partial<ExperienceSignature> = {}): ExperienceSignature {
  return {
    selectedTerritoryId: 't1',
    selectionRationale: 'r',
    businessTruth: 'truth',
    humanInsight: 'insight',
    creativeMetaphor: 'metaphor',
    centralMechanism: 'mechanism',
    signatureMoment: '',
    interactionGrammar: { paceAndMotion: '', openingMoment: '', scrollChoreography: '', microInteractions: [], selectedPatterns: [], rejectedPatterns: [] },
    visualGrammar: { moodWords: [], colorPalette: { primary: '#000', secondary: '#111', background: '#fff', surface: '#eee', textPrimary: '#000', textMuted: '#555', accent: '#f00' }, typography: { displayFamily: 'Serif', bodyFamily: 'Sans', styleNote: '' }, spatialComposition: '' },
    restraintContract: { forbiddenAntiPatterns: [], mandatoryDesignRules: [] },
    experienceStrategy: DEFAULT_EXPERIENCE_STRATEGY,
    scenes: [],
    ...overrides,
  };
}

test('an auto-repair category converts on "call", not on a hardcoded reservation flow', () => {
  const bp = compileBlueprint(dossier({ category: 'Auto repair' }), signature(), logger);
  assert.equal(bp.conversionStrategy.primaryActionType, 'call');
  assert.equal(bp.conversionStrategy.primaryActionLabel, 'Call Now');
});

test('a venue/event category converts on "reserve" — the category this bug was found on', () => {
  const bp = compileBlueprint(dossier({ category: 'Event & wedding venue' }), signature(), logger);
  assert.equal(bp.conversionStrategy.primaryActionType, 'reserve');
});

test('a bakery converts on "order"', () => {
  const bp = compileBlueprint(dossier({ category: 'Bakery' }), signature(), logger);
  assert.equal(bp.conversionStrategy.primaryActionType, 'order');
});

test('an unrecognised category falls back to "visit" rather than guessing', () => {
  const bp = compileBlueprint(dossier({ category: 'Something entirely novel' }), signature(), logger);
  assert.equal(bp.conversionStrategy.primaryActionType, 'visit');
});

test('the label follows the dossier\'s own language — Romanian evidence gets Romanian copy', () => {
  const bp = compileBlueprint(dossier({ category: 'Bakery', primaryLanguage: 'ro' }), signature(), logger);
  assert.equal(bp.conversionStrategy.primaryActionLabel, 'Comandă acum');
});

test('reassurance points cite only what the dossier actually verified — no rating means no rating line', () => {
  const bp = compileBlueprint(dossier(), signature({ signatureMoment: '' }), logger);
  assert.ok(bp.conversionStrategy.reassurancePoints.every((p) => !p.includes('★')));
});

test('a verified rating produces its own real count, never an invented one', () => {
  const bp = compileBlueprint(
    dossier({ verifiedRating: { rating: 4.6, reviewCount: 84, source: 'maps', timestamp: '2026-01-01' } }),
    signature(),
    logger,
  );
  assert.ok(bp.conversionStrategy.reassurancePoints.some((p) => p.includes('4.6') && p.includes('84')));
});

test('the signature moment becomes a reassurance point only when the signature actually names one', () => {
  const withMoment = compileBlueprint(dossier(), signature({ signatureMoment: 'the live diagnostic readout' }), logger);
  assert.ok(withMoment.conversionStrategy.reassurancePoints.includes('the live diagnostic readout'));

  const withoutMoment = compileBlueprint(dossier(), signature({ signatureMoment: '' }), logger);
  assert.equal(withoutMoment.conversionStrategy.reassurancePoints.includes(''), false);
});

test('the blueprint carries the dossier and signature through unmodified — it composes, it does not re-derive', () => {
  const d = dossier();
  const s = signature();
  const bp = compileBlueprint(d, s, logger);
  assert.equal(bp.factualDossier, d);
  assert.equal(bp.signature, s);
  assert.equal(bp.brandName, d.businessName);
});
