/**
 * The redesigned Anti-AI-Generic Gate.
 *
 * The old `checkStructuralConvergence` predecessor compared the current
 * build's `<section id>` list against ONE hardcoded prior run
 * (`forge-da56c149`, the Go Sweet bakery) and failed anything over 80%
 * overlap. It scored Ridgeway Motors — an auto-repair shop — "100%
 * identical" to that bakery, because both used the same sequential
 * `scene-1`, `scene-2`, … id convention every business gets by default: an
 * artifact of the builder prompt, not a structural signal.
 *
 * `checkStructuralConvergence` replaces it: scoped to whatever real peer
 * corpus exists under `outputDir` (never a fixed file), compared on the
 * signature's own identity-bearing creative fields (never a DOM id). These
 * tests prove both halves of the fix — the false positive is gone, and a
 * genuine near-duplicate is still caught — and the other three checks in
 * this module are untouched by the rewrite.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { auditAntiAIGeneric, checkStructuralConvergence } from '../../lib/forge/anti-ai-gate.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';

import type { ExperienceBlueprint, ExperienceSignature, GeneratedCode } from '../../lib/forge/types.js';

const logger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });

function tmpOutputDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bf-anti-ai-gate-'));
}

function signature(overrides: Partial<ExperienceSignature> = {}): ExperienceSignature {
  return {
    selectedTerritoryId: 't1',
    selectionRationale: 'r',
    businessTruth: 'truth',
    humanInsight: 'insight',
    creativeMetaphor: 'A workshop that operates like a diagnostic theatre.',
    centralMechanism: 'Live telemetry readout of the vehicle under repair.',
    signatureMoment: 'moment',
    interactionGrammar: {
      paceAndMotion: '',
      openingMoment: '',
      scrollChoreography: '',
      microInteractions: [],
      selectedPatterns: ['ECU fault decoder', 'booking terminal'],
      rejectedPatterns: [],
    },
    visualGrammar: {
      moodWords: [],
      colorPalette: { primary: '#0a0a0a', secondary: '#111', background: '#050505', surface: '#111', textPrimary: '#fff', textMuted: '#999', accent: '#ff6a00' },
      typography: { displayFamily: 'Serif', bodyFamily: 'Sans', styleNote: '' },
      spatialComposition: '',
    },
    restraintContract: { forbiddenAntiPatterns: [], mandatoryDesignRules: [] },
    scenes: [
      { id: 'clinical-enter', actName: 'ACT I', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'split-screen', keyInteraction: 'none', assetIds: [] },
      { id: 'diagnostics', actName: 'ACT II', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'two-column', keyInteraction: 'none', assetIds: [] },
    ],
    ...overrides,
  };
}

async function writePeer(outputDir: string, runId: string, sig: ExperienceSignature): Promise<void> {
  const dir = path.join(outputDir, runId, 'forge');
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, '3-signature.json'), JSON.stringify(sig), 'utf8');
}

function blueprint(sig: ExperienceSignature): ExperienceBlueprint {
  return {
    brandName: 'Ridgeway Motors',
    factualDossier: {
      businessName: 'Ridgeway Motors',
      category: 'Auto repair',
      verifiedFacts: [],
      inferences: [],
      creativeInterpretations: [],
      conflicts: [],
      forbiddenAssumptions: [],
      realPhotoAssets: [],
      location: { fullAddress: '', street: '', city: '', region: '' },
      contact: {},
      verifiedReviews: [],
      primaryLanguage: 'en',
    },
    signature: sig,
    conversionStrategy: { primaryActionLabel: 'Book a slot', primaryActionType: 'book', reassurancePoints: [] },
  };
}

function code(html = '<html><body></body></html>'): GeneratedCode {
  return { html, css: '', js: '' };
}

/* -------------------------------------------------------------------- */
/* checkStructuralConvergence                                            */
/* -------------------------------------------------------------------- */

test('with zero peers on disk, verdict is NO_PEERS — never a disguised pass or fail', async () => {
  const outputDir = tmpOutputDir();
  const result = await checkStructuralConvergence(signature(), outputDir, 'self');
  assert.equal(result.verdict, 'NO_PEERS');
  assert.equal(result.peersCompared, 0);
});

test('a genuinely different business (different mechanism, metaphor, layout, palette) is DISTINCT, not flagged', async () => {
  const outputDir = tmpOutputDir();
  const bakery = signature({
    creativeMetaphor: 'The rhythm of the oven and the rise of the dough.',
    centralMechanism: 'A live proofing timer that ticks down to the oven spring.',
    interactionGrammar: { paceAndMotion: '', openingMoment: '', scrollChoreography: '', microInteractions: [], selectedPatterns: ['proofing timer'], rejectedPatterns: [] },
    visualGrammar: { moodWords: [], colorPalette: { primary: '#f5e6c8', secondary: '#eee', background: '#fffdf7', surface: '#fff', textPrimary: '#3a2a1a', textMuted: '#8a7a6a', accent: '#c9822a' }, typography: { displayFamily: 'Serif', bodyFamily: 'Sans', styleNote: '' }, spatialComposition: '' },
    scenes: [
      { id: 'first-rise', actName: 'ACT I', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'full-bleed', keyInteraction: 'none', assetIds: [] },
    ],
  });
  await writePeer(outputDir, 'bakery-run', bakery);

  const result = await checkStructuralConvergence(signature(), outputDir, 'self');

  assert.equal(result.verdict, 'DISTINCT');
  assert.equal(result.peersCompared, 1);
  assert.equal(result.closestPeer, null);
});

test('THE REGRESSION: an auto shop built after a bakery is no longer "100% identical" to it merely because both use sequential scene ids', async () => {
  const outputDir = tmpOutputDir();
  // This is exactly the shape of the old bug: two unrelated businesses whose
  // only shared trait is the generic scene-1/scene-2 id convention. Under the
  // old GENERIC_SIMILARITY_FAIL check (raw <section id> string overlap) this
  // scored 100%. The new check never looks at ids at all.
  const bakeryWithGenericIds = signature({
    creativeMetaphor: 'The rhythm of the oven and the rise of the dough.',
    centralMechanism: 'A live proofing timer.',
    scenes: [
      { id: 'scene-1', actName: 'ACT I', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'split-screen', keyInteraction: 'none', assetIds: [] },
      { id: 'scene-2', actName: 'ACT II', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'two-column', keyInteraction: 'none', assetIds: [] },
    ],
  });
  await writePeer(outputDir, 'bakery-run', bakeryWithGenericIds);

  const ridgeway = signature({
    scenes: [
      { id: 'scene-1', actName: 'ACT I', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'split-screen', keyInteraction: 'none', assetIds: [] },
      { id: 'scene-2', actName: 'ACT II', purpose: 'p', title: 't', bodyText: 'b', layoutPattern: 'two-column', keyInteraction: 'none', assetIds: [] },
    ],
  });

  const result = await checkStructuralConvergence(ridgeway, outputDir, 'ridgeway-run');

  assert.equal(result.verdict, 'DISTINCT', `should not flag on id/layoutPattern overlap alone; got ${JSON.stringify(result)}`);
});

test('a genuine near-duplicate — same mechanism, metaphor, layout sequence, interaction and palette — IS flagged', async () => {
  const outputDir = tmpOutputDir();
  const original = signature();
  await writePeer(outputDir, 'earlier-run', original);

  const result = await checkStructuralConvergence(signature(), outputDir, 'later-run');

  assert.equal(result.verdict, 'TEMPLATE_CONVERGENCE');
  assert.equal(result.closestPeer, 'earlier-run');
  assert.equal(result.matchedAxes.length, 5);
});

test('one shared axis alone (e.g. coincidentally the same layout pattern) is not enough to flag', async () => {
  const outputDir = tmpOutputDir();
  const peer = signature({
    creativeMetaphor: 'unrelated metaphor entirely',
    centralMechanism: 'unrelated mechanism entirely',
    interactionGrammar: { paceAndMotion: '', openingMoment: '', scrollChoreography: '', microInteractions: [], selectedPatterns: ['something else'], rejectedPatterns: [] },
    visualGrammar: { moodWords: [], colorPalette: { primary: '#111111', secondary: '#222', background: '#333333', surface: '#444', textPrimary: '#fff', textMuted: '#999', accent: '#00ff00' }, typography: { displayFamily: 'Serif', bodyFamily: 'Sans', styleNote: '' }, spatialComposition: '' },
    // same layout sequence as the default signature() on purpose
  });
  await writePeer(outputDir, 'peer-run', peer);

  const result = await checkStructuralConvergence(signature(), outputDir, 'self');

  assert.equal(result.verdict, 'DISTINCT');
});

test('a directory entry that is not a Forge run (no forge/3-signature.json) is silently skipped, not an error', async () => {
  const outputDir = tmpOutputDir();
  await fs.promises.mkdir(path.join(outputDir, 'not-a-forge-run'), { recursive: true });
  await fs.promises.writeFile(path.join(outputDir, 'not-a-forge-run', 'some-other-file.json'), '{}', 'utf8');

  const result = await checkStructuralConvergence(signature(), outputDir, 'self');

  assert.equal(result.verdict, 'NO_PEERS');
  assert.equal(result.peersCompared, 0);
});

/* -------------------------------------------------------------------- */
/* auditAntiAIGeneric — the other three checks, unaffected by the rewrite */
/* -------------------------------------------------------------------- */

test('flags a forbidden-assumption keyword that leaked into the rendered HTML', async () => {
  const outputDir = tmpOutputDir();
  const sig = signature();
  const bp: ExperienceBlueprint = {
    ...blueprint(sig),
    factualDossier: { ...blueprint(sig).factualDossier, forbiddenAssumptions: ['Never claim "24-hour service" — not verified'] },
  };

  const result = await auditAntiAIGeneric({
    code: code('<html><body>We offer 24-hour service every day.</body></html>'),
    blueprint: bp,
    outputDir,
    runId: 'self',
    logger,
  });

  assert.equal(result.passed, false);
  assert.ok(result.flags.some((f) => f.code === 'FACTUAL_HALLUCINATION_DETECTED'));
});

test('a build with no violations and no peers passes clean', async () => {
  const outputDir = tmpOutputDir();
  const sig = signature();

  const result = await auditAntiAIGeneric({
    code: code(),
    blueprint: blueprint(sig),
    outputDir,
    runId: 'self',
    logger,
  });

  assert.equal(result.passed, true);
  assert.equal(result.score, 100);
  assert.deepEqual(result.flags, []);
  assert.equal(result.structuralConvergence?.verdict, 'NO_PEERS');
});
