/**
 * WQ-019 step 1: the documented concrete-to-abstract stage mapping.
 *
 * `lib/workflow/state.ts` (F-03) is "the ONE state vocabulary" — twelve
 * abstract job states plus the transition table that owns them — but its own
 * doc comment is explicit that it does not yet replace anything: `JobStage`
 * (`jobState.ts`, the persisted `job.json` field, 17 values) and `StageName`
 * (`scripts/n8n/stage.ts`, the n8n HTTP dispatch keys, 23 values) remain the
 * vocabularies actually written to disk and actually driving the control
 * surface. WQ-006's audit found that `state.ts`'s 12 states are NOT a strict
 * superset of either — only `created`/`evidence`/`diverge` match by exact
 * name. This module is the missing mapping, derived by reading every
 * `saveJob(outputDir, { stage: ... })` call in `scripts/n8n/stage.ts`
 * directly (not inferred from names), so it reflects what the pipeline
 * actually writes, not what the two vocabularies' names suggest.
 *
 * ## Why this is additive, not a migration
 *
 * WQ-019's outputs are, in order: (1) this mapping, documented; (2) a
 * back-compat reader; (3) `summary.ts`/`controlSurfacePage.ts`/
 * `build-workflow-json.ts` updated in lockstep so the control surface and
 * the n8n contract never silently break mid-migration. This module is (1)
 * and doubles as (2) — `abstractStageOf` IS the back-compat reader: it reads
 * whatever `JobStage` string is actually on disk (old run or new) and
 * projects it to the abstract vocabulary, without changing what
 * `saveJob` ever writes. Nothing about `JobState.stage`'s persisted format
 * changes, so no existing `job.json` needs migrating and no existing reader
 * of `job.stage` (the n8n control surface above all) is at any risk of
 * breaking. (3) is deliberately NOT done by this module: `controlSurfacePage.ts`'s
 * `STAGE_LABELS`/`STAGE_ORDER` and `build-workflow-json.ts`'s generated
 * workflow are both keyed directly on the 17-value `JobStage` today, so they
 * are unaffected by this addition — wiring the abstract vocabulary into them
 * is real remaining work (see the bottom of this comment), not done here,
 * because getting it wrong would break a live n8n contract this module has
 * no way to test against.
 *
 * ## The mapping (verified against every `saveJob` call in stage.ts, 2026-08-25)
 *
 * jobState.ts's 17 `JobStage` values, and the `StageName` (stage.ts) cases
 * that actually write each one:
 *
 *  - `created`            ← `create`
 *  - `research`           ← `intake`, `router`, `synthesize` (and `research`
 *    itself, which never calls `saveJob`'s `stage` field and so leaves
 *    whatever `research`-phase value was already there)
 *  - `evidence`           ← `source`
 *  - `character`          ← `analyze`
 *  - `content`            ← `write`
 *  - `creative`           ← `direct`
 *  - `diverge`            ← `diverge`, `jury`
 *  - `build`              ← `assets`, `build`, `repair`
 *  - `browser`            ← `browser`, `layout` (both — layout's audit is
 *    still part of the same deterministic-measurement phase as the capture)
 *  - `visual-critic`      ← `critic`
 *  - `distinctness-gate`  ← `gate`
 *  - `hermes`             ← `hermes`, when its decision is `continue`
 *  - `delivery`           ← `hermes` (decision `deliver`), `experience-forge`;
 *    also what `preflight`/`deploy`/`report` leave unchanged on the success
 *    path (none of the three writes `stage` on success — they only ever
 *    write it to downgrade to `human`)
 *  - `human`              ← `hermes` (decision `escalate`), `preflight` (a
 *    blocking finding downgrades a pending deliver), `deploy` (a failed
 *    deploy downgrades the same way)
 *  - `experience`, `asset`, `design` — never written by any live case in
 *    `scripts/n8n/stage.ts` today. Not dead code to delete: `main.ts`'s own
 *    `STAGE_TO_JOB_STAGE` (a parallel, already-precedented mapping for the
 *    classic CLI pipeline) folds `design` into `'design'` conceptually via
 *    its own `design` stage, and `JobState.assetPlan`/`experienceIntent`/
 *    `experiencePlan` fields exist and are read by Forge's orchestrator —
 *    these three `JobStage` values are reserved for producers that exist but
 *    do not currently call `saveJob` with them.
 *
 * These 17 fold onto `state.ts`'s 12 as follows. The three unused values
 * are mapped by the same reasoning `main.ts`'s comment gives for its own
 * `design`/`enhance` best-fit choices — what the artifact IS, not a
 * renumbering:
 *
 *  - `created`                                          → `created`
 *  - `research`, `evidence`                              → `evidence`
 *  - `character`                                         → `understanding`
 *  - `creative`, `content`, `experience`*, `asset`*, `design`* → `plan`
 *    (everything produced before the diverge battle spends anything —
 *    creative direction, copy, and the three reserved pre-build artifacts
 *    all describe what will be built, not the built thing itself)
 *  - `diverge`                                           → `diverge`
 *  - `build`                                             → `candidate_build`
 *  - `browser`                                           → `verify`
 *    (screenshot capture + layout audit: both are measurement, not
 *    judgement — `state.ts`'s own doc distinguishes exactly this)
 *  - `visual-critic`, `distinctness-gate`                → `judge`
 *    (both produce a verdict; `state.ts`'s `judge` is "verdicts are
 *    produced, then DECIDE applies them")
 *  - `hermes`                                            → `decide`
 *  - `delivery`                                          → `delivered`
 *  - `human`                                             → `escalated`
 *
 * (* = one of the three `JobStage` values no live case currently writes.)
 *
 * ## A real gap this mapping surfaces, not fixed here
 *
 * `state.ts`'s `aborted` has NO `JobStage` equivalent at all. An
 * unrecoverable failure in the current pipeline throws (see `stage.ts`'s
 * catch block around the whole switch, which calls `recordStage(..., {
 * failed: true })` and re-throws) rather than ever persisting a terminal
 * `job.stage`. `abstractStageOf` therefore never returns `'aborted'` for any
 * value read off a real `job.json` — that abstract state is currently
 * unreachable from the concrete pipeline. Worth a follow-up once the
 * `aborted` transitions in `TRANSITION_TABLE` are actually wired to
 * something that writes state, which is out of this task's scope.
 *
 * ## Remaining work for WQ-019's output (3)
 *
 * Not done here, and deliberately so (see "why this is additive" above):
 * `scripts/n8n/controlSurfacePage.ts`'s `STAGE_LABELS`/`STAGE_ORDER` would
 * need a parallel `ABSTRACT_STAGE_LABELS`/`ABSTRACT_STAGE_ORDER` (12 entries)
 * alongside the existing 17-value ones — replacing rather than adding would
 * lose the finer-grained progress detail the control surface currently
 * shows per concrete stage. `scripts/n8n/build-workflow-json.ts`'s generated
 * workflow would need the same care: it is a live n8n contract, and this
 * module has no way to test against a real n8n instance, so wiring it in
 * is real remaining work for a task that can verify against one.
 */

import type { JobStage } from './jobState.js';
import type { JobState as AbstractJobState } from './state.js';

/**
 * The exhaustive, compile-time-checked mapping. `satisfies Record<JobStage,
 * AbstractJobState>` means adding a `JobStage` value without updating this
 * map is a type error, not a silent gap — the same discipline `state.ts`'s
 * own `TRANSITION_TABLE` and `main.ts`'s `STAGE_TO_JOB_STAGE` already use.
 */
export const JOB_STAGE_TO_ABSTRACT = {
  created: 'created',
  research: 'evidence',
  evidence: 'evidence',
  character: 'understanding',
  creative: 'plan',
  experience: 'plan',
  diverge: 'diverge',
  content: 'plan',
  asset: 'plan',
  design: 'plan',
  build: 'candidate_build',
  browser: 'verify',
  'visual-critic': 'judge',
  'distinctness-gate': 'judge',
  hermes: 'decide',
  delivery: 'delivered',
  human: 'escalated',
} as const satisfies Record<JobStage, AbstractJobState>;

/**
 * The three `JobStage` values no live `scripts/n8n/stage.ts` case writes
 * today — see the module doc comment. Reserved, not dead.
 */
export const UNUSED_JOB_STAGES: readonly JobStage[] = ['experience', 'asset', 'design'];

/**
 * The back-compat reader (WQ-019 output 2): projects whatever `JobStage`
 * string is actually on a loaded `job.json` — an old run or a new one, since
 * `saveJob`'s persisted format is unchanged by this module — onto the
 * abstract vocabulary.
 *
 * Takes `string`, not `JobStage`, on purpose: `loadJob` parses `job.json`
 * with `JSON.parse(...) as JobState`, an assertion, not a validation, so a
 * `stage` value on disk that predates today's `JobStage` type (a genuinely
 * old run, a hand-edited fixture, a future producer) is a real possibility
 * this reader must survive. Same defensive posture as `summary.ts`'s
 * `summarizeBattle`/`summarizeGate`: an unrecognised value reports as `null`
 * ("cannot place this run on the abstract vocabulary") rather than throwing
 * or silently guessing.
 */
export function abstractStageOf(stage: string): AbstractJobState | null {
  return Object.prototype.hasOwnProperty.call(JOB_STAGE_TO_ABSTRACT, stage)
    ? JOB_STAGE_TO_ABSTRACT[stage as JobStage]
    : null;
}
