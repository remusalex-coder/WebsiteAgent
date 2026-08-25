/**
 * The Ridgeway A/B regression benchmark (Phase 4 of the anti-AI-gate fix).
 *
 * `scripts/design-director-ab-proof.ts` ran one real business — Ridgeway
 * Motors, an auto-repair shop, `output/mechanic` — through both engines on
 * identical evidence:
 *
 *   A = `composeStandalone` alone: the deterministic floor. Zero model
 *       calls; category-driven design tokens (`5b-design-floor.json`).
 *   B = the same evidence, then `runExperienceForge` overlaid: real
 *       `creative_direction` calls formulate an Experience Signature
 *       (`3-signature.json`) and a real `craft_judging` call critiques the
 *       rendered result (`6-critique-final.json`).
 *
 * That run is where the bug this session fixes was found: the OLD
 * anti-AI-generic gate scored B "100% identical" to an unrelated bakery
 * built weeks earlier (`5-anti-ai-gate.old-buggy-result.json`, kept here as
 * the historical record of the defect) — not because the sites were alike,
 * but because both used the generic `scene-1`, `scene-2`, … id convention
 * every business got by default. See `lib/forge/anti-ai-gate.ts`'s module
 * docstring and `test/forge/anti-ai-gate.test.ts` for the mechanism fix.
 *
 * This file is the permanent regression: it freezes the real captured
 * artifacts from that run as fixtures and asserts the properties a future
 * architectural change must not be able to silently break —
 * never re-deriving them from a live model call, and never comparing
 * pixels, per the session's own instruction. All fixture JSON here is
 * synthetic placeholder data (`0700 000 000`, `1 Workshop Lane, Ridgeway`)
 * with no real PII, safe to commit.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditAntiAIGeneric, checkStructuralConvergence } from '../../lib/forge/anti-ai-gate.js';
import { computeForgeVerdict } from '../../lib/forge/verdict.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';

import type { AntiAIGateResult, ExperienceBlueprint, ExperienceSignature, VisionCritiqueReport } from '../../lib/forge/types.js';
import type { WebsiteDesign } from '../../lib/types.js';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'forge');
const logger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });

function loadJson<T>(...parts: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, ...parts), 'utf8')) as T;
}

const ridgewaySignature = loadJson<ExperienceSignature>('ridgeway', '3-signature.json');
const ridgewayBlueprint = loadJson<ExperienceBlueprint>('ridgeway', '4-blueprint.json');
const ridgewayCritiqueB = loadJson<VisionCritiqueReport>('ridgeway', '6-critique-final.json');
const oldBuggyResult = loadJson<{ passed: boolean; flags: readonly { code: string }[]; comparisonWithBaseline?: { structureSimilarityScore: number } }>(
  'ridgeway',
  '5-anti-ai-gate.old-buggy-result.json',
);
const designA = loadJson<WebsiteDesign>('ridgeway', '5b-design-floor.json');

/** A fresh output dir seeded with the real peers that existed alongside the Ridgeway run — two builds of an event venue, never Ridgeway. */
function realPeerCorpus(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-ridgeway-regression-'));
  for (const peer of ['eventvenue-a-3-signature.json', 'eventvenue-b-3-signature.json']) {
    const runDir = path.join(dir, peer.replace('-3-signature.json', ''), 'forge');
    fs.mkdirSync(runDir, { recursive: true });
    fs.copyFileSync(path.join(FIXTURES, 'peers', peer), path.join(runDir, '3-signature.json'));
  }
  return dir;
}

test('THE HISTORICAL DEFECT, on record: the old gate really did fail this build at "100% identical"', () => {
  assert.equal(oldBuggyResult.passed, false);
  assert.ok(oldBuggyResult.flags.some((f) => f.code === 'GENERIC_SIMILARITY_FAIL'));
  assert.equal(oldBuggyResult.comparisonWithBaseline?.structureSimilarityScore, 100);
});

test('THE FIX: the same real Experience Signature, compared against the real peer corpus that existed at the time, is DISTINCT', async () => {
  const outputDir = realPeerCorpus();
  const result = await checkStructuralConvergence(ridgewaySignature, outputDir, 'ab-proof-mechanic');

  assert.equal(result.verdict, 'DISTINCT', `regression: an unrelated business scored convergent again — ${JSON.stringify(result)}`);
  assert.equal(result.peersCompared, 2);
});

test('the full gate passes clean on the real build: no forbidden-assumption leaks, no restraint violations, no card-grid smell, and (with the fix) no false structural convergence', async () => {
  const outputDir = realPeerCorpus();
  const html = fs.readFileSync(path.join(FIXTURES, 'ridgeway', 'site-B-index.html'), 'utf8');

  const result = await auditAntiAIGeneric({
    code: { html, css: '', js: '' },
    blueprint: ridgewayBlueprint,
    outputDir,
    runId: 'ab-proof-mechanic',
    logger,
  });

  // This fixture is a frozen, real capture from before the content-safety
  // gate (WQ-017, `docs/IMPLEMENTATION_GAP.md` P2-4) existed, and it really
  // does contain two inline `onsubmit="return false;"` handlers the model
  // wrote — see the dedicated test below. That is a genuine, separately
  // tracked finding about this specific historical build, not a defect in
  // what THIS test asserts (structural convergence / forbidden assumptions /
  // restraint / card-grid smell), so those flags are excluded here rather
  // than either editing the frozen fixture or silently weakening the gate.
  const relevantFails = result.flags.filter((f) => f.severity === 'fail' && !f.code.startsWith('CONTENT_SAFETY_'));
  assert.deepEqual(relevantFails, [], `expected no non-content-safety fails; flags: ${JSON.stringify(result.flags)}`);
  assert.equal(result.structuralConvergence?.verdict, 'DISTINCT');
});

test('the real Ridgeway build genuinely contains inline onsubmit handlers — the content-safety gate (WQ-017) catching a real, previously-undetected defect in a real Forge run, not a synthetic example', async () => {
  const outputDir = realPeerCorpus();
  const html = fs.readFileSync(path.join(FIXTURES, 'ridgeway', 'site-B-index.html'), 'utf8');

  const result = await auditAntiAIGeneric({
    code: { html, css: '', js: '' },
    blueprint: ridgewayBlueprint,
    outputDir,
    runId: 'ab-proof-mechanic',
    logger,
  });

  const contentSafetyFails = result.flags.filter((f) => f.code === 'CONTENT_SAFETY_INLINE_EVENT_HANDLER');
  assert.equal(contentSafetyFails.length, 1);
  assert.equal(contentSafetyFails[0]?.evidence, 'onsubmit');
  // The gate is whole-document, not per-instance: this run predates
  // WQ-017 and would have failed the (now correctly stricter) gate had it
  // existed at the time — the frozen fixture is left as-is precisely so
  // this stays true and this test keeps proving it.
  assert.equal(result.passed, false);
});

test('the final combined verdict no longer blocks Ridgeway on a structural false positive', () => {
  const cleanAntiAiGate: AntiAIGateResult = {
    passed: true,
    score: 100,
    flags: [],
    structuralConvergence: { peersCompared: 2, closestPeer: null, matchedAxes: [], verdict: 'DISTINCT' },
  };

  const result = computeForgeVerdict(cleanAntiAiGate, ridgewayCritiqueB);

  // The real critique this run produced read HYBRID_SOME_GENERIC, not
  // OBVIOUSLY_AI_GENERATED — genuinely polish-needed, never a blocking
  // genericity verdict. Combined with a clean structural gate, the build
  // must be allowed to proceed to delivery/polish rather than being
  // rejected outright, which is what the old false positive did.
  assert.notEqual(ridgewayCritiqueB.feelsArtDirectedVsAi, 'OBVIOUSLY_AI_GENERATED');
  assert.equal(result.verdict, 'PASS');
});

test('B (Experience Signature) carries a business-specific creative rationale that A (the deterministic floor) structurally cannot — the effect this fix protects', () => {
  // A's design vocabulary is category-driven pattern ids — the same ids
  // every "automotive" business gets — with no per-business free-text
  // creative concept at all.
  assert.ok(Array.isArray(designA.patterns));
  assert.ok(designA.patterns.length > 0);

  // B's signature is a real model-authored creative concept, grounded in
  // this specific business's evidence (an auto-repair shop's diagnostic /
  // workshop vocabulary), which a category-driven pattern id cannot carry.
  const concept = `${ridgewaySignature.creativeMetaphor} ${ridgewaySignature.centralMechanism}`.toLowerCase();
  const automotiveVocabulary = ['diagnostic', 'workshop', 'vehicle', 'telemetry', 'repair', 'mechanic', 'garage', 'car'];
  assert.ok(
    automotiveVocabulary.some((word) => concept.includes(word)),
    `expected B's creative concept to reference this business's own domain, got: "${concept}"`,
  );
});

test('B clears a minimum business-specificity floor on the real critic verdict, not merely "not generic"', () => {
  // A floor, not the exact recorded value (6/10) — this is the property
  // that must survive a future re-run of the same proof with a different
  // model response, not a pinned score from one specific call.
  assert.ok(
    ridgewayCritiqueB.criteriaScores.businessSpecificity >= 5,
    `businessSpecificity floor regression: ${ridgewayCritiqueB.criteriaScores.businessSpecificity}/10`,
  );
});
