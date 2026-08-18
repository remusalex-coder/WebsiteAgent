/**
 * Forge's final PASS/FAIL decision — combines the pre-vision structural gate
 * (`anti-ai-gate.ts`) with the post-vision Craft Critic (`critic.ts`) into
 * one explainable verdict.
 *
 * Reuses `lib/qa/verdict.ts`'s lexicographic combination (F-06: quality and
 * distinctness are separate dimensions, never a weighted sum) rather than
 * inventing a second scoring rule for Forge. This is the answer to Phase 3's
 * "for every FAIL, why; for every PASS, why" — every dimension below is
 * already computed elsewhere in the pipeline; this module only combines.
 *
 * Five dimensions, two blocking:
 *
 * - `structural` (blocking) — the anti-AI gate: forbidden-assumption
 *   hallucinations, restraint-contract violations, and structural
 *   convergence against the real peer corpus.
 * - `genericity` (blocking) — the Craft Critic's own verdict on whether the
 *   rendered pixels read as `OBVIOUSLY_AI_GENERATED`, `uncertain` when the
 *   critic itself degraded (no vision-capable vendor reachable —
 *   `critic.ts`'s `uncertainReport`, identifiable by its own `rawNotes`).
 *   A degraded critique is a flat `criteriaScores: 5` on every axis with no
 *   real issues found — indistinguishable from a genuinely mediocre site
 *   unless this dimension reads `rawNotes` and blocks rather than scores
 *   it. Found live on the five-business benchmark run (2026-08-19): a
 *   repair-loop re-critique lost its vision vendor mid-run (the daily
 *   Gemini free-tier quota exhausted) and this dimension, before this
 *   fix, silently reported a passing 50/100 HYBRID_SOME_GENERIC rather
 *   than the missing-evidence verdict F-07 requires elsewhere in this
 *   repository.
 * - `craft` (non-blocking) — the critic's 0–100 composite score.
 * - `businessSpecificity` (non-blocking) — how specifically the page speaks
 *   to *this* business, on the critic's own axis.
 * - `distinctiveness` (non-blocking) — the critic's distinctiveness axis;
 *   this is also the value used for the verdict's `distinctness` tie-break.
 */

import { combineVerdicts } from '../qa/verdict.js';

import type { CombinedVerdict, DimensionVerdict, VerdictableCandidate } from '../qa/verdict.js';
import type { AntiAIGateResult, VisionCritiqueReport } from './types.js';

export function computeForgeVerdict(
  antiAiGate: AntiAIGateResult,
  critique: VisionCritiqueReport,
): CombinedVerdict {
  const structuralFails = antiAiGate.flags.filter((f) => f.severity === 'fail');

  const structuralReason = structuralFails.map((f) => f.message).join('; ');
  const critiqueDegraded = critique.rawNotes !== undefined;
  const genericityStatus = critiqueDegraded
    ? 'uncertain'
    : critique.feelsArtDirectedVsAi === 'OBVIOUSLY_AI_GENERATED' ? 'fail' : 'pass';
  const genericityReason = critiqueDegraded
    ? `Craft Critic could not evaluate the rendered pixels: ${critique.rawNotes}.`
    : critique.feelsArtDirectedVsAi === 'OBVIOUSLY_AI_GENERATED'
      ? `Craft Critic judged the rendered site AI-generic: ${critique.issues.map((i) => i.description).join('; ') || 'no specific issues given'}.`
      : '';

  const dimensions: DimensionVerdict[] = [
    {
      name: 'structural',
      blocking: true,
      status: antiAiGate.passed ? 'pass' : 'fail',
      score: antiAiGate.score,
      ...(structuralReason ? { reason: structuralReason } : {}),
    },
    {
      name: 'genericity',
      blocking: true,
      status: genericityStatus,
      score: critique.criteriaScores.humanArtDirection * 10,
      ...(genericityReason ? { reason: genericityReason } : {}),
    },
    {
      name: 'craft',
      blocking: false,
      status: 'pass',
      score: critique.score,
    },
    {
      name: 'businessSpecificity',
      blocking: false,
      status: 'pass',
      score: critique.criteriaScores.businessSpecificity * 10,
    },
    {
      name: 'distinctiveness',
      blocking: false,
      status: 'pass',
      score: critique.criteriaScores.distinctiveness * 10,
    },
  ];

  const candidate: VerdictableCandidate = {
    id: 'forge-build',
    index: 0,
    dimensions,
    distinctness: critique.criteriaScores.distinctiveness * 10,
  };

  return combineVerdicts(candidate);
}
