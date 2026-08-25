/**
 * WQ-019 step 1 — the concrete-to-abstract stage mapping.
 *
 * Three things worth proving, in order of how badly a break would hurt:
 * (1) every one of jobState.ts's 17 `JobStage` values maps to one of
 * state.ts's 12 real `JOB_STATES` — a typo here would silently mislabel a
 * whole class of runs on any future dashboard that trusts `abstractStage`;
 * (2) the back-compat reader (`abstractStageOf`) degrades to `null` rather
 * than throwing on a value that is not a recognised `JobStage`, so a
 * genuinely old or hand-written `job.json` never crashes a reader; (3) the
 * specific mapping choices match what `scripts/n8n/stage.ts` actually
 * writes, spot-checked against the real `saveJob` calls this module's own
 * doc comment cites line-by-line.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { JOB_STATES } from '../../lib/workflow/state.js';
import { JOB_STAGE_TO_ABSTRACT, UNUSED_JOB_STAGES, abstractStageOf } from '../../lib/workflow/stageMapping.js';

import type { JobStage } from '../../lib/workflow/jobState.js';

const ALL_JOB_STAGES: readonly JobStage[] = [
  'created',
  'research',
  'evidence',
  'character',
  'creative',
  'experience',
  'diverge',
  'content',
  'asset',
  'design',
  'build',
  'browser',
  'visual-critic',
  'distinctness-gate',
  'hermes',
  'delivery',
  'human',
];

test('every JobStage value is mapped, and every mapped value is a real abstract JOB_STATE', () => {
  const jobStateSet = new Set<string>(JOB_STATES);
  for (const stage of ALL_JOB_STAGES) {
    const mapped = JOB_STAGE_TO_ABSTRACT[stage];
    assert.notEqual(mapped, undefined, `JobStage "${stage}" has no entry in JOB_STAGE_TO_ABSTRACT`);
    assert.ok(jobStateSet.has(mapped), `JobStage "${stage}" maps to "${mapped}", which is not one of state.ts's 12 JOB_STATES`);
  }
  // No stray keys beyond the 17 real JobStage values either.
  assert.deepEqual(Object.keys(JOB_STAGE_TO_ABSTRACT).sort(), [...ALL_JOB_STAGES].sort());
});

test('abstractStageOf matches JOB_STAGE_TO_ABSTRACT for every real JobStage', () => {
  for (const stage of ALL_JOB_STAGES) {
    assert.equal(abstractStageOf(stage), JOB_STAGE_TO_ABSTRACT[stage]);
  }
});

test('abstractStageOf returns null, not a throw, for an unrecognised stage string', () => {
  assert.equal(abstractStageOf('some-stage-from-a-future-refactor'), null);
  assert.equal(abstractStageOf(''), null);
  assert.equal(abstractStageOf('DIVERGE'), null); // case-sensitive: no fuzzy matching
});

test('the three JobStage values no live stage.ts case writes are flagged as unused, not silently mapped as if real', () => {
  assert.deepEqual([...UNUSED_JOB_STAGES].sort(), ['asset', 'design', 'experience']);
  // They still map somewhere sensible (pre-diverge planning) rather than being omitted.
  for (const stage of UNUSED_JOB_STAGES) {
    assert.equal(JOB_STAGE_TO_ABSTRACT[stage], 'plan');
  }
});

test('spot-check against what scripts/n8n/stage.ts actually writes (verified by reading every saveJob call)', () => {
  // source -> stage: 'evidence'
  assert.equal(abstractStageOf('evidence'), 'evidence');
  // analyze -> stage: 'character'
  assert.equal(abstractStageOf('character'), 'understanding');
  // write -> stage: 'content'; direct -> stage: 'creative' -- both pre-diverge
  assert.equal(abstractStageOf('content'), 'plan');
  assert.equal(abstractStageOf('creative'), 'plan');
  // diverge/jury -> stage: 'diverge'
  assert.equal(abstractStageOf('diverge'), 'diverge');
  // assets/build/repair -> stage: 'build'
  assert.equal(abstractStageOf('build'), 'candidate_build');
  // browser/layout -> stage: 'browser' (measurement, not judgement)
  assert.equal(abstractStageOf('browser'), 'verify');
  // critic -> 'visual-critic'; gate -> 'distinctness-gate' -- both verdicts
  assert.equal(abstractStageOf('visual-critic'), 'judge');
  assert.equal(abstractStageOf('distinctness-gate'), 'judge');
  // hermes (continue) -> stage: 'hermes'
  assert.equal(abstractStageOf('hermes'), 'decide');
  // hermes (deliver) / experience-forge -> stage: 'delivery'
  assert.equal(abstractStageOf('delivery'), 'delivered');
  // hermes (escalate) / preflight / deploy (downgrade) -> stage: 'human'
  assert.equal(abstractStageOf('human'), 'escalated');
});

test("state.ts's 'aborted' is unreachable from the current concrete pipeline -- documented gap, not silently hidden", () => {
  const reachable = new Set<string>(Object.values(JOB_STAGE_TO_ABSTRACT));
  assert.ok(!reachable.has('aborted'), "expected 'aborted' to have no JobStage mapping onto it yet (see stageMapping.ts's doc comment)");
});
