/**
 * `computeForgeVerdict` — Forge's one explainable PASS/FAIL decision,
 * combining the structural gate and the Craft Critic via
 * `lib/qa/verdict.ts`'s lexicographic rule (F-06) rather than a second,
 * duplicated scoring formula.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeForgeVerdict } from '../../lib/forge/verdict.js';

import type { AntiAIGateResult, VisionCritiqueReport } from '../../lib/forge/types.js';

function antiAiGate(overrides: Partial<AntiAIGateResult> = {}): AntiAIGateResult {
  return {
    passed: true,
    score: 100,
    flags: [],
    structuralConvergence: { peersCompared: 0, closestPeer: null, matchedAxes: [], verdict: 'NO_PEERS' },
    ...overrides,
  };
}

function critique(overrides: Partial<VisionCritiqueReport> = {}): VisionCritiqueReport {
  return {
    score: 80,
    verdict: 'POLISH_NEEDED',
    feelsArtDirectedVsAi: 'INTENTIONALLY_ART_DIRECTED',
    criteriaScores: {
      conceptualCoherence: 8,
      businessSpecificity: 8,
      humanArtDirection: 8,
      visualHierarchy: 8,
      composition: 8,
      interactionRestraint: 8,
      memorability: 7,
      distinctiveness: 7,
      factualFidelity: 9,
      mobileExperience: 8,
    },
    positiveHighlights: [],
    issues: [],
    ...overrides,
  };
}

test('a clean structural gate and an art-directed critique PASS', () => {
  const result = computeForgeVerdict(antiAiGate(), critique());
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.blockingFailure, null);
});

test('a structural gate failure blocks even when the critique is glowing', () => {
  const result = computeForgeVerdict(
    antiAiGate({ passed: false, flags: [{ code: 'STRUCTURAL_TEMPLATE_CONVERGENCE', severity: 'fail', message: 'converged' }] }),
    critique({ score: 95, criteriaScores: { ...critique().criteriaScores, businessSpecificity: 10, distinctiveness: 10 } }),
  );
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.blockingFailure, 'structural');
});

test('a critique that reads as obviously AI-generated blocks even when structure is clean — this is the false PASS the freeze names as P4-1', () => {
  const result = computeForgeVerdict(antiAiGate(), critique({ feelsArtDirectedVsAi: 'OBVIOUSLY_AI_GENERATED' }));
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.blockingFailure, 'genericity');
});

test('quality is the best non-blocking dimension (F-06: never a weighted sum), and distinctness carries the critic distinctiveness axis', () => {
  const result = computeForgeVerdict(antiAiGate(), critique({ score: 72 }));
  // Non-blocking dimensions here: craft=72, businessSpecificity=80, distinctiveness=70.
  // bestQuality (lib/qa/verdict.ts) takes the max, not the craft score alone.
  assert.equal(result.quality, 80);
});

test('a degraded critique (no vision vendor reachable) blocks as uncertain, not a passing mediocre score — found live on the 2026-08-19 benchmark run', () => {
  // This is exactly critic.ts's uncertainReport() shape: flat 5s on every
  // axis, HYBRID_SOME_GENERIC, no issues, and a rawNotes explaining why.
  // Before this fix, computeForgeVerdict read this as a genuine (if
  // mediocre) PASS.
  const degraded = critique({
    score: 50,
    feelsArtDirectedVsAi: 'HYBRID_SOME_GENERIC',
    criteriaScores: {
      conceptualCoherence: 5, businessSpecificity: 5, humanArtDirection: 5, visualHierarchy: 5,
      composition: 5, interactionRestraint: 5, memorability: 5, distinctiveness: 5,
      factualFidelity: 5, mobileExperience: 5,
    },
    issues: [],
    rawNotes: 'vision critique unavailable: AI provider "gemini" request failed: HTTP 429',
  });

  const result = computeForgeVerdict(antiAiGate(), degraded);

  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.uncertain, 'genericity');
  assert.equal(result.blockingFailure, null);
});

test('a critique with rawNotes never present (the normal path) is read as a real pass/fail, never as uncertain', () => {
  const real = critique({ feelsArtDirectedVsAi: 'INTENTIONALLY_ART_DIRECTED' });
  assert.equal(real.rawNotes, undefined);
  const result = computeForgeVerdict(antiAiGate(), real);
  assert.equal(result.uncertain, null);
});

test('the reasons list explains a FAIL by name, not just PASS/FAIL', () => {
  const result = computeForgeVerdict(
    antiAiGate({ passed: false, flags: [{ code: 'STRUCTURAL_TEMPLATE_CONVERGENCE', severity: 'fail', message: 'converged with run X' }] }),
    critique(),
  );
  assert.equal(result.verdict, 'FAIL');
  assert.ok(result.reasons.some((r) => r.includes('converged with run X')), `expected a reason naming the cause, got ${JSON.stringify(result.reasons)}`);
});
