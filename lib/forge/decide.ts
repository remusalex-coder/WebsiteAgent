/**
 * The two decisions that turn Forge from "code that exists" into "what
 * actually ships" — extracted so `main.ts`'s `'enhance'` pipeline step and
 * `scripts/benchmark-10.ts`'s benchmark harness share one rule instead of
 * two that can silently drift apart, which is exactly what happened before
 * this module existed: the benchmark harness called `composeDesign →
 * renderSite` directly and never exercised Forge at all, so it never showed
 * what the real default pipeline actually ships.
 */

import type { BudgetTier } from '../capability/budget.js';
import type { CombinedVerdict } from '../qa/verdict.js';

/**
 * Whether the enhancement pass (Forge's Experience Signature Factory) is
 * even worth attempting for this run.
 *
 * `tier0` (the default) never attempts it: System 1's deterministic,
 * `lib/design`/`lib/render` output is the guaranteed €0 baseline, and
 * attempting a many-model-call pipeline under a €0 policy would either
 * degrade to weak free-tier models or fail outright — burning free-tier
 * quota on a pipeline unlikely to produce a shippable result under that
 * budget anyway.
 */
export function shouldAttemptEnhance(
  experienceEngine: 'signature' | 'template',
  budgetTier: BudgetTier,
): boolean {
  return experienceEngine === 'signature' && budgetTier !== 'tier0';
}

/**
 * Whether an attempted Forge build's output should replace the deterministic
 * baseline already sitting in `site/`.
 *
 * `finalVerdict.verdict` is already the single lexicographically-combined
 * PASS/FAIL decision (`lib/qa/verdict.ts`'s `combineVerdicts`, F-06) — this
 * function adds no second threshold on top of it. A `FAIL` (structural gate,
 * registry gate, or a genuinely `OBVIOUSLY_AI_GENERATED` craft critique)
 * means the deterministic baseline ships instead, silently to the visitor
 * but never silently to the run's own artifact record — see `main.ts`'s
 * `5c-experience.json`.
 */
export function shouldShipEnhancedSite(verdict: CombinedVerdict): boolean {
  return verdict.verdict === 'PASS';
}
