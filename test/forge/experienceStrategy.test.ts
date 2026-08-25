/**
 * `normalizeExperienceStrategy` — the closed-set validator for
 * `ExperienceSignature.experienceStrategy`, matching the discipline
 * `docs/decisions/0004-the-directors-influence-is-one-enum.md` already
 * established for the classic pipeline: the model proposes a value for a
 * closed field, this module decides whether it is real. Anything invalid
 * degrades to `DEFAULT_EXPERIENCE_STRATEGY`, never reaches the builder
 * unchecked.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_EXPERIENCE_STRATEGY, normalizeExperienceStrategy } from '../../lib/forge/experienceStrategy.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';

const logger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });
const dossier = { businessName: 'Test Co' };

test('a fully valid response passes through unchanged', () => {
  const raw = {
    motionIntensity: 'expressive',
    motionIntensityRationale: 'The product configurator is the central interaction; expressive transitions carry state changes the user must track.',
    navigationModel: 'sticky-minimal',
    loadingModel: 'skeleton',
    typographyBehavior: 'kinetic-headlines',
    cursorBehavior: 'magnetic',
    scrollBehavior: 'smooth-native',
    layoutGrammar: 'asymmetric-editorial',
    mediaStrategy: 'photography-only',
    requires3D: false,
    requires3DRationale: '',
    requiresVideo: false,
    requiresVideoRationale: '',
    functionalModules: ['enquiry-form'],
    mobileBehavior: 'simplified',
    accessibilityStrategy: 'wcag-aa-floor',
    performanceTier: 2,
    reducedMotionStrategy: 'instant-state-only',
    rationale: 'Because the evidence says so.',
  };

  const result = normalizeExperienceStrategy(raw, dossier, logger);

  assert.equal(result.motionIntensity, 'expressive');
  assert.equal(result.motionIntensityRationale, raw.motionIntensityRationale);
  assert.equal(result.navigationModel, 'sticky-minimal');
  assert.equal(result.performanceTier, 2);
});

test('null/non-object input degrades entirely to the deterministic default', () => {
  assert.deepEqual(normalizeExperienceStrategy(null, dossier, logger), DEFAULT_EXPERIENCE_STRATEGY);
  assert.deepEqual(normalizeExperienceStrategy(undefined, dossier, logger), DEFAULT_EXPERIENCE_STRATEGY);
  assert.deepEqual(normalizeExperienceStrategy('a string', dossier, logger), DEFAULT_EXPERIENCE_STRATEGY);
});

test('an invented value outside the closed set falls back to the default for that field, not the whole object', () => {
  const raw = { motionIntensity: 'wildly-cinematic', navigationModel: 'inline' };
  const result = normalizeExperienceStrategy(raw, dossier, logger);
  assert.equal(result.motionIntensity, DEFAULT_EXPERIENCE_STRATEGY.motionIntensity);
  assert.equal(result.navigationModel, 'inline'); // the one valid field survives
});

test('requires3D=true with an empty rationale is treated as false — an unjustified 3D claim is discarded, not trusted', () => {
  const result = normalizeExperienceStrategy({ requires3D: true, requires3DRationale: '' }, dossier, logger);
  assert.equal(result.requires3D, false);
  assert.equal(result.requires3DRationale, '');
});

test('requires3D=true with a real rationale is honored, and raises performanceTier to at least 3', () => {
  const result = normalizeExperienceStrategy(
    { requires3D: true, requires3DRationale: 'The product is inherently three-dimensional and a photo cannot show it.', performanceTier: 1 },
    dossier,
    logger,
  );
  assert.equal(result.requires3D, true);
  assert.equal(result.performanceTier, 3);
});

test('performanceTier is never lowered by the 3D consistency rule if the model already asked for more', () => {
  const result = normalizeExperienceStrategy(
    { requires3D: true, requires3DRationale: 'real reason', performanceTier: 4 },
    dossier,
    logger,
  );
  assert.equal(result.performanceTier, 4);
});

test('motionIntensity "expressive"/"immersive" with an empty rationale is downgraded to the restrained default — an unjustified motion claim is discarded, not trusted (A5)', () => {
  const expressive = normalizeExperienceStrategy({ motionIntensity: 'expressive', motionIntensityRationale: '' }, dossier, logger);
  assert.equal(expressive.motionIntensity, DEFAULT_EXPERIENCE_STRATEGY.motionIntensity);
  assert.equal(expressive.motionIntensityRationale, '');

  const immersive = normalizeExperienceStrategy({ motionIntensity: 'immersive' }, dossier, logger);
  assert.equal(immersive.motionIntensity, DEFAULT_EXPERIENCE_STRATEGY.motionIntensity);
  assert.equal(immersive.motionIntensityRationale, '');

  const whitespaceOnly = normalizeExperienceStrategy({ motionIntensity: 'immersive', motionIntensityRationale: '   ' }, dossier, logger);
  assert.equal(whitespaceOnly.motionIntensity, DEFAULT_EXPERIENCE_STRATEGY.motionIntensity);
});

test('motionIntensity "none"/"subtle" never require a rationale — restraint needs no justification', () => {
  assert.equal(normalizeExperienceStrategy({ motionIntensity: 'none' }, dossier, logger).motionIntensity, 'none');
  assert.equal(normalizeExperienceStrategy({ motionIntensity: 'subtle' }, dossier, logger).motionIntensity, 'subtle');
});

test('motionIntensity "immersive" with a real rationale is honored, and raises performanceTier to at least 2', () => {
  const result = normalizeExperienceStrategy(
    { motionIntensity: 'immersive', motionIntensityRationale: 'The signature interaction is a 3D product spin the user drives by scroll.', performanceTier: 0 },
    dossier,
    logger,
  );
  assert.equal(result.motionIntensity, 'immersive');
  assert.equal(result.performanceTier, 2);
});

test('an unjustified "immersive" claim does not raise performanceTier — the tier-raise rule reads the gated value, not the raw claim', () => {
  const result = normalizeExperienceStrategy({ motionIntensity: 'immersive', performanceTier: 0 }, dossier, logger);
  assert.equal(result.motionIntensity, 'subtle');
  assert.equal(result.performanceTier, 0);
});

test('functionalModules: an invalid array collapses to the default; a mix of "none" and a real module keeps only the real module', () => {
  assert.deepEqual(normalizeExperienceStrategy({ functionalModules: 'not-an-array' }, dossier, logger).functionalModules, DEFAULT_EXPERIENCE_STRATEGY.functionalModules);
  assert.deepEqual(normalizeExperienceStrategy({ functionalModules: ['none', 'booking-request'] }, dossier, logger).functionalModules, ['booking-request']);
  assert.deepEqual(normalizeExperienceStrategy({ functionalModules: ['bogus-module'] }, dossier, logger).functionalModules, ['none']);
});

test('functionalModules deduplicates', () => {
  const result = normalizeExperienceStrategy({ functionalModules: ['enquiry-form', 'enquiry-form', 'booking-request'] }, dossier, logger);
  assert.deepEqual([...result.functionalModules].sort(), ['booking-request', 'enquiry-form']);
});

test('performanceTier travels as a string digit ("0".."5") — Gemini rejects enum on a numeric type (found live, 2026-08-19)', () => {
  assert.equal(normalizeExperienceStrategy({ performanceTier: '3' }, dossier, logger).performanceTier, 3);
  assert.equal(normalizeExperienceStrategy({ performanceTier: 3 }, dossier, logger).performanceTier, 3, 'a numeric value is still accepted, for callers that construct one directly rather than via the wire schema');
});

test('performanceTier outside 0-5, or not a plausible digit, falls back to the default', () => {
  assert.equal(normalizeExperienceStrategy({ performanceTier: 99 }, dossier, logger).performanceTier, DEFAULT_EXPERIENCE_STRATEGY.performanceTier);
  assert.equal(normalizeExperienceStrategy({ performanceTier: '9' }, dossier, logger).performanceTier, DEFAULT_EXPERIENCE_STRATEGY.performanceTier);
  assert.equal(normalizeExperienceStrategy({ performanceTier: 'two' }, dossier, logger).performanceTier, DEFAULT_EXPERIENCE_STRATEGY.performanceTier);
});

test('an empty rationale string falls back to the documented default rationale, never an empty one', () => {
  const result = normalizeExperienceStrategy({ rationale: '   ' }, dossier, logger);
  assert.equal(result.rationale, DEFAULT_EXPERIENCE_STRATEGY.rationale);
});

test('the default strategy itself is internally consistent: "none" motion at tier 1, no 3D/video, one safe functional module', () => {
  assert.equal(DEFAULT_EXPERIENCE_STRATEGY.requires3D, false);
  assert.equal(DEFAULT_EXPERIENCE_STRATEGY.requiresVideo, false);
  assert.deepEqual(DEFAULT_EXPERIENCE_STRATEGY.functionalModules, ['enquiry-form']);
  assert.equal(DEFAULT_EXPERIENCE_STRATEGY.accessibilityStrategy, 'wcag-aa-floor');
  // The default is 'subtle', which needs no rationale — consistent with the A5 gate below.
  assert.equal(DEFAULT_EXPERIENCE_STRATEGY.motionIntensityRationale, '');
});
