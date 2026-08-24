/**
 * Hermes — the control plane's decision function.
 *
 * Sole owner of the delivery/escalate/continue decision. Reads the job's
 * single `iteration`/`maxIter` counter (the real, implemented bound — see
 * the 2026-08-24 correction note below) and evaluates the stop conditions
 * in frozen order, writing `decision` exactly once, at a terminal state.
 *
 * ## What `decide` is and what it is not
 *
 * `decide` is the function the production loop (`scripts/n8n/stage.ts`'s
 * `hermes` stage, and `lib/workflow/runJob.ts`'s local loop) calls after the
 * gate: it maps a gate verdict onto a Hermes action (`deliver` / `escalate` /
 * `continue`). It is a pure function — it never writes `job.json`; the caller
 * persists the returned `nextStage` / `iteration`.
 *
 * ## 2026-08-24 correction — the `Hermes` class was removed
 *
 * `ARCHITECTURE_FREEZE.md` §F-04 originally specified three separate ceiling
 * counters (retry / rebuild / reconcept). An earlier pass added a `Hermes`
 * class implementing exactly that (`retryAllowed`/`rebuildAllowed`/
 * `reconceptAllowed`/`isSurvivable`, plus `CapabilityProvider`/
 * `WorkerFailure`/`HermesTransition` types) as scaffolding ahead of use. It
 * was never wired into the real loop: the loop that was actually built and
 * shipped (`stage.ts`'s `runJobFullWith`, `runJob.ts`'s `runJob`) bounds
 * iteration with a single flat `job.iteration >= job.maxIter` check inside
 * `decide` below, not three separate ceilings. Verified zero real importers
 * of the class or its types anywhere outside this file (grep across
 * `lib/`, `scripts/`, `agents/`, `main.ts`, and `test/` — none found; no
 * `new Hermes(` call site anywhere). Removed as dead scaffolding rather than
 * wired in, per the standing "do not invent a role for a component just
 * because it looks removable" rule read the other way: its role was
 * genuinely never adopted by the implementation, so keeping it risked a
 * future reader treating it as the real ceiling mechanism when it is not.
 * If a future need arises for per-kind (retry/rebuild/reconcept) ceilings
 * distinct from the single iteration counter, re-add it deliberately against
 * that real requirement rather than resurrecting unused scaffolding.
 *
 * See ARCHITECTURE_FREEZE.md §F-02, §F-04, §U, task P1-3 / P1-4.
 */

import type { DistinctnessResult } from '../qa/distinctness-gate.js';
import type { JobState as JobRecord } from './jobState.js';

export type HermesAction = 'deliver' | 'escalate' | 'continue';

export interface HermesDecision {
  readonly action: HermesAction;
  /** Where the job goes next: a stage name for `continue`, `human` for escalate. */
  readonly nextStage: string;
  /** The iteration number the caller should persist. */
  readonly iteration: number;
  /** Why Hermes decided this, so the job record is self-explanatory. */
  readonly rationale: string;
}

/**
 * Decides one job's fate after the gate.
 *
 * Stop conditions, evaluated in frozen order:
 *   1. DELIVER   — the gate passed.
 *   2. ESCALATE  — the gate routed to escalate (thin evidence, zero survivors,
 *                  or the deterministic floor reaching an unfixable state), or
 *                  the loop bound `job.maxIter` is exhausted: a PASS at max
 *                  iterations still delivers, a FAIL at max iterations escalates
 *                  rather than spinning.
 *   3. CONTINUE  — the gate failed with a rebuildable diagnosis; `nextStage` is
 *                  the stage that owns the fix.
 *
 * `iteration` is the loop counter Hermes owns: it is the only writer of
 * iteration progress, and it is the field the caller must persist.
 */
export function decide(args: { readonly gate: DistinctnessResult; readonly job: JobRecord }): HermesDecision {
  const { gate, job } = args;

  if (gate.verdict === 'PASS') {
    return {
      action: 'deliver',
      nextStage: 'delivery',
      iteration: job.iteration,
      rationale: `Gate passed with overall score ${gate.overallScore}.`,
    };
  }

  if (job.iteration >= job.maxIter) {
    return {
      action: 'escalate',
      nextStage: 'human',
      iteration: job.iteration,
      rationale:
        `Gate still failing after ${job.maxIter} iterations (overall score ${gate.overallScore}); ` +
        `escalating rather than spinning. Last diagnosis: ${gate.diagnosis}.`,
    };
  }

  if (gate.route === 'escalate' || gate.route === 'deliver') {
    return {
      action: 'escalate',
      nextStage: 'human',
      iteration: job.iteration,
      rationale: `Gate routed to ${gate.route} (${gate.diagnosis}) on iteration ${job.iteration}.`,
    };
  }

  return {
    action: 'continue',
    nextStage: gate.route,
    iteration: job.iteration + 1,
    rationale: `Gate failed (${gate.diagnosis}); routing to ${gate.route} for another iteration.`,
  };
}