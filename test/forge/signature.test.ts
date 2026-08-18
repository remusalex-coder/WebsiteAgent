/**
 * `slugifySceneIds` — the deterministic fix for the root cause behind the
 * Ridgeway false positive (see anti-ai-gate.test.ts and
 * ridgeway-regression.test.ts): nothing in the signature prompt told the
 * model what a scene id was for, so it defaulted to `scene-1`, `scene-2`, …
 * on every business, which is what let the old baseline check "detect"
 * 100% structural cloning between an auto shop and a bakery. This module
 * derives the id from content the model actually authors per business
 * instead.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { slugifySceneIds } from '../../lib/forge/signature.js';

import type { ExperienceSignature } from '../../lib/forge/types.js';

function scene(partial: Partial<ExperienceSignature['scenes'][number]> & { actName: string }) {
  return {
    id: 'scene-1',
    purpose: 'test purpose',
    title: 'Test Title',
    bodyText: 'Body text.',
    layoutPattern: 'split-screen',
    keyInteraction: 'none',
    assetIds: [],
    ...partial,
  };
}

function signatureWith(scenes: ExperienceSignature['scenes']): ExperienceSignature {
  return {
    selectedTerritoryId: 't1',
    selectionRationale: 'r',
    businessTruth: 'truth',
    humanInsight: 'insight',
    creativeMetaphor: 'metaphor',
    centralMechanism: 'mechanism',
    signatureMoment: 'moment',
    interactionGrammar: {
      paceAndMotion: '',
      openingMoment: '',
      scrollChoreography: '',
      microInteractions: [],
      selectedPatterns: [],
      rejectedPatterns: [],
    },
    visualGrammar: {
      moodWords: [],
      colorPalette: { primary: '#000', secondary: '#111', background: '#fff', surface: '#eee', textPrimary: '#000', textMuted: '#555', accent: '#f00' },
      typography: { displayFamily: 'Serif', bodyFamily: 'Sans', styleNote: '' },
      spatialComposition: '',
    },
    restraintContract: { forbiddenAntiPatterns: [], mandatoryDesignRules: [] },
    scenes,
  };
}

test('gives every scene a slug derived from its actName, not the model-supplied sequential id', () => {
  const signature = signatureWith([
    scene({ id: 'scene-1', actName: 'ACT I — THE CLINICAL ENTER' }),
    scene({ id: 'scene-2', actName: 'ACT II — COMPUTERISED DIAGNOSTICS & TELEMETRY' }),
  ]);

  const result = slugifySceneIds(signature);

  assert.equal(result.scenes[0]?.id, 'the-clinical-enter');
  assert.equal(result.scenes[1]?.id, 'computerised-diagnostics-telemetry');
});

test('two businesses with generic model-assigned ids no longer collide after slugifying', () => {
  const ridgeway = signatureWith([
    scene({ id: 'scene-1', actName: 'ACT I — THE CLINICAL ENTER' }),
    scene({ id: 'scene-2', actName: 'ACT II — COMPUTERISED DIAGNOSTICS' }),
  ]);
  const bakery = signatureWith([
    scene({ id: 'scene-1', actName: 'ACT I — THE FIRST RISE' }),
    scene({ id: 'scene-2', actName: 'ACT II — THE OVEN SPRING' }),
  ]);

  const a = slugifySceneIds(ridgeway).scenes.map((s) => s.id);
  const b = slugifySceneIds(bakery).scenes.map((s) => s.id);

  assert.equal(a.some((id) => b.includes(id)), false, `expected no shared ids, got a=${a} b=${b}`);
});

test('deduplicates when two scenes reduce to the same slug', () => {
  const signature = signatureWith([
    scene({ id: 'scene-1', actName: 'The Reveal' }),
    scene({ id: 'scene-2', actName: 'The Reveal' }),
  ]);

  const result = slugifySceneIds(signature);

  assert.equal(result.scenes[0]?.id, 'the-reveal');
  assert.equal(result.scenes[1]?.id, 'the-reveal-2');
});

test('falls back to title, then purpose, when actName is empty', () => {
  const signature = signatureWith([
    scene({ id: 'scene-1', actName: '', title: 'Chassis & Brake Precision' }),
    scene({ id: 'scene-2', actName: '', title: '', purpose: 'booking terminal' }),
  ]);

  const result = slugifySceneIds(signature);

  assert.equal(result.scenes[0]?.id, 'chassis-brake-precision');
  assert.equal(result.scenes[1]?.id, 'booking-terminal');
});

test('is total: an empty actName/title/purpose still produces a valid, non-empty id', () => {
  const signature = signatureWith([scene({ id: 'scene-1', actName: '', title: '', purpose: '' })]);
  const result = slugifySceneIds(signature);
  assert.ok(result.scenes[0]!.id.length > 0);
});
