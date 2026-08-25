/**
 * `lib/workflow/summary.ts` — the read model behind the control surface
 * (WORK_QUEUE.json WQ-014).
 *
 * `summarizeJob` is pure, so most cases here build a `JobState` by hand and
 * assert on the projection directly. `discoverJobIds`/`summarizeRun`/
 * `summarizeAllRuns` do real I/O, so those are exercised against a temp
 * `output/`-shaped directory, mirroring `test/workflow/candidates.test.ts`'s
 * `tmpRun()` pattern.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createJob, saveJob, type JobState, type WorkerCall } from '../../lib/workflow/jobState.js';
import { recordCandidate } from '../../lib/workflow/candidates.js';
import { discoverJobIds, summarizeAllRuns, summarizeJob, summarizeRun } from '../../lib/workflow/summary.js';

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bf-summary-'));
}

function call(over: Partial<WorkerCall> & Pick<WorkerCall, 'stage' | 'capability'>): WorkerCall {
  return { provider: null, outcome: 'ok', at: '2026-08-25T00:00:00.000Z', ...over };
}

test('summarizeJob: worker tallies split by outcome and provider, null provider keyed as (deterministic)', () => {
  const job: JobState = {
    ...createJob('job-1', 'Acme Bakery'),
    providerLog: [
      call({ stage: 'research', capability: 'web_search', provider: 'groq', outcome: 'ok' }),
      call({ stage: 'research', capability: 'web_search', provider: 'groq', outcome: 'ok' }),
      call({ stage: 'evidence', capability: 'extraction', provider: 'groq', outcome: 'failed' }),
      call({ stage: 'content', capability: 'prose_writing', provider: 'anthropic', outcome: 'ok' }),
      call({ stage: 'design', capability: 'layout', provider: null, outcome: 'ok' }),
    ],
  };

  const summary = summarizeJob(job);

  assert.equal(summary.workers.total, 5);
  assert.equal(summary.workers.ok, 4);
  assert.equal(summary.workers.failed, 1);
  assert.deepEqual(summary.workers.byProvider, {
    groq: { ok: 2, failed: 1, totalDurationMs: null, totalRetries: 0 },
    anthropic: { ok: 1, failed: 0, totalDurationMs: null, totalRetries: 0 },
    '(deterministic)': { ok: 1, failed: 0, totalDurationMs: null, totalRetries: 0 },
  });
});

test('summarizeJob: WQ-027 -- durationMs/retryCount accumulate per provider; a provider with no timed calls stays null, not 0', () => {
  const job: JobState = {
    ...createJob('job-durations', 'Acme Bakery'),
    providerLog: [
      call({ stage: 'research', capability: 'web_search', provider: 'groq', outcome: 'failed', durationMs: 400 }),
      call({ stage: 'research', capability: 'web_search', provider: 'groq', outcome: 'ok', durationMs: 900, retryCount: 1 }),
      call({ stage: 'content', capability: 'prose_writing', provider: 'anthropic', outcome: 'ok' }),
      call({ stage: 'design', capability: 'layout', provider: null, outcome: 'ok' }),
    ],
  };

  const summary = summarizeJob(job);

  assert.deepEqual(summary.workers.byProvider, {
    groq: { ok: 1, failed: 1, totalDurationMs: 1300, totalRetries: 1 },
    anthropic: { ok: 1, failed: 0, totalDurationMs: null, totalRetries: 0 },
    '(deterministic)': { ok: 1, failed: 0, totalDurationMs: null, totalRetries: 0 },
  });
});

test('summarizeJob: recentFailures keeps only the last 5, oldest-of-the-kept-set first', () => {
  const failures: WorkerCall[] = Array.from({ length: 8 }, (_unused, i) =>
    call({ stage: 'content', capability: 'prose_writing', provider: 'groq', outcome: 'failed', at: `attempt-${i}` }),
  );
  const job: JobState = { ...createJob('job-2', 'Acme Bakery'), providerLog: failures };

  const summary = summarizeJob(job);

  assert.equal(summary.workers.recentFailures.length, 5);
  assert.deepEqual(
    summary.workers.recentFailures.map((c) => c.at),
    ['attempt-3', 'attempt-4', 'attempt-5', 'attempt-6', 'attempt-7'],
  );
});

test('summarizeJob: battle is null when the job never reached diverge', () => {
  const job: JobState = createJob('job-3', 'Acme Bakery');
  assert.equal(job.designDirections, null);
  const summary = summarizeJob(job);
  assert.equal(summary.battle, null);
});

test('summarizeJob: battle is null for a malformed/foreign designDirections shape rather than throwing', () => {
  const job: JobState = { ...createJob('job-4', 'Acme Bakery'), designDirections: 'not-an-object' };
  assert.equal(summarizeJob(job).battle, null);

  const jobArr: JobState = { ...createJob('job-4b', 'Acme Bakery'), designDirections: [1, 2, 3] };
  // Arrays are typeof 'object' — summarizeBattle should still degrade gracefully via its field checks.
  const summary = summarizeJob(jobArr);
  assert.equal(summary.battle?.count, 0);
  assert.equal(summary.battle?.winnerId, null);
});

test('summarizeJob: battle extracts count/winner/bestQuality/judgeCount from the real diverge-writer shape', () => {
  const job: JobState = {
    ...createJob('job-5', 'Acme Bakery'),
    designDirections: {
      count: 3,
      winner: 'direction-B',
      jury: { bestQuality: 87.5, judgeCount: 2 },
    },
  };

  const summary = summarizeJob(job);
  assert.deepEqual(summary.battle, { count: 3, winnerId: 'direction-B', bestQuality: 87.5, judgeCount: 2 });
});

test('summarizeJob: battle tolerates a present but empty jury object', () => {
  const job: JobState = {
    ...createJob('job-6', 'Acme Bakery'),
    designDirections: { count: 1, winner: null, jury: {} },
  };
  const summary = summarizeJob(job);
  assert.deepEqual(summary.battle, { count: 1, winnerId: null, bestQuality: null, judgeCount: null });
});

test('summarizeJob: forgeBattle is null when the run did not use Forge battle mode — the default', () => {
  const job: JobState = createJob('job-fb-1', 'Acme Bakery');
  assert.equal(job.forgeBattle, null);
  assert.equal(summarizeJob(job).forgeBattle, null);
});

test('summarizeJob: forgeBattle is null for a job.json written before this field existed (the key is simply absent)', () => {
  // Mirrors an old on-disk record: no `forgeBattle` key at all, not `null`.
  const { forgeBattle: _drop, ...withoutField } = createJob('job-fb-legacy', 'Acme Bakery');
  const job = withoutField as JobState;
  assert.equal(summarizeJob(job).forgeBattle, null);
});

test('summarizeJob: forgeBattle is null for a malformed/foreign shape rather than throwing', () => {
  const job: JobState = { ...createJob('job-fb-2', 'Acme Bakery'), forgeBattle: 'not-an-object' };
  assert.equal(summarizeJob(job).forgeBattle, null);
});

test('summarizeJob: forgeBattle extracts the real WQ-018 writer shape (runJob.ts battle-mode build hook)', () => {
  const job: JobState = {
    ...createJob('job-fb-3', 'Acme Bakery'),
    forgeBattle: {
      count: 2,
      winnerId: 'candidate-1',
      allCandidatesWeak: false,
      convergenceWarning: null,
      candidates: [
        { id: 'candidate-0', verdict: 'PASS', quality: 72, repairIterations: 1 },
        { id: 'candidate-1', verdict: 'PASS', quality: 88, repairIterations: 0 },
      ],
    },
  };

  const summary = summarizeJob(job);
  assert.deepEqual(summary.forgeBattle, {
    count: 2,
    winnerId: 'candidate-1',
    allCandidatesWeak: false,
    convergenceWarning: null,
    candidates: [
      { id: 'candidate-0', verdict: 'PASS', quality: 72, repairIterations: 1 },
      { id: 'candidate-1', verdict: 'PASS', quality: 88, repairIterations: 0 },
    ],
  });
});

test('summarizeJob: forgeBattle reports allCandidatesWeak/convergenceWarning/null winner when the battle produced no usable winner', () => {
  const job: JobState = {
    ...createJob('job-fb-4', 'Acme Bakery'),
    forgeBattle: {
      count: 2,
      winnerId: null,
      allCandidatesWeak: true,
      convergenceWarning: 'candidate-1 converged with candidate-0 on 4 identity axes (metaphor, mechanism) — these are variations on one idea, not distinct directions.',
      candidates: [
        { id: 'candidate-0', verdict: 'FAIL', quality: 40, repairIterations: 2 },
        { id: 'candidate-1', verdict: 'FAIL', quality: 38, repairIterations: 2 },
      ],
    },
  };

  const summary = summarizeJob(job);
  assert.equal(summary.forgeBattle?.winnerId, null);
  assert.equal(summary.forgeBattle?.allCandidatesWeak, true);
  assert.match(summary.forgeBattle?.convergenceWarning ?? '', /candidate-1 converged with candidate-0/);
});

test('summarizeJob: forgeBattle and battle (the classic diverge mechanism) are never conflated — both can be present, independently', () => {
  const job: JobState = {
    ...createJob('job-fb-5', 'Acme Bakery'),
    designDirections: { count: 3, winner: 'direction-B', jury: { bestQuality: 80, judgeCount: 2 } },
    forgeBattle: { count: 2, winnerId: 'candidate-0', allCandidatesWeak: false, convergenceWarning: null, candidates: [] },
  };

  const summary = summarizeJob(job);
  assert.ok(summary.battle);
  assert.ok(summary.forgeBattle);
  assert.equal(summary.battle?.winnerId, 'direction-B');
  assert.equal(summary.forgeBattle?.winnerId, 'candidate-0');
});

test('summarizeJob: gate is null before the distinctness-gate stage has run', () => {
  const job: JobState = createJob('job-gate-1', 'Acme Bakery');
  assert.equal(job.distinctnessScore, null);
  assert.equal(summarizeJob(job).gate, null);
});

test('summarizeJob: gate extracts verdict/score from the real distinctness-gate writer shape', () => {
  const job: JobState = { ...createJob('job-gate-2', 'Acme Bakery'), distinctnessScore: { verdict: 'PASS', overallScore: 88 } };
  assert.deepEqual(summarizeJob(job).gate, { verdict: 'PASS', score: 88 });
});

test('summarizeJob: gate is null for a malformed distinctnessScore shape rather than throwing', () => {
  assert.equal(summarizeJob({ ...createJob('job-gate-3', 'Acme Bakery'), distinctnessScore: 'not-an-object' }).gate, null);
  assert.equal(summarizeJob({ ...createJob('job-gate-4', 'Acme Bakery'), distinctnessScore: { verdict: 'PASS' } }).gate, null);
});

test('summarizeJob: budgetCents passes through the job\'s real spend ceiling', () => {
  const job: JobState = createJob('job-budget', 'Acme Bakery');
  assert.equal(summarizeJob(job).budgetCents, job.budgetCents);
});

test('summarizeJob: tolerates a hand-written/partial job object missing providerLog or errors, rather than throwing', () => {
  // A raw fixture (e.g. one written directly to job.json by a test, or a legacy
  // file) may omit fields `createJob` always sets. This must degrade, not crash —
  // stage-server.ts's GET /job reads exactly such fixtures in its own test suite.
  const partial = { jobId: 'job-partial', business: 'Acme Bakery', stage: 'browser', maxIter: 3 } as unknown as JobState;
  const summary = summarizeJob(partial);
  assert.deepEqual(summary.workers, { total: 0, ok: 0, failed: 0, byProvider: {}, recentFailures: [] });
  assert.deepEqual(summary.errors, []);
  assert.equal(summary.budgetCents, 0);
  assert.equal(summary.gate, null);
  assert.equal(summary.battle, null);
  assert.equal(summary.abstractStage, 'verify'); // stage 'browser' -> abstract 'verify' (WQ-019)
});

test('summarizeJob: abstractStage is null for a stage value that is not a recognised JobStage (WQ-019 back-compat reader)', () => {
  // Simulates a job.json written by a since-renamed or hand-authored producer
  // — abstractStageOf must degrade to null rather than throw, so a reader of
  // an old/foreign job.json never crashes on this field.
  const foreign = { ...createJob('job-foreign', 'Acme Bakery', 3), stage: 'some-future-stage' } as unknown as JobState;
  const summary = summarizeJob(foreign);
  assert.equal(summary.abstractStage, null);
  assert.equal(summary.stage, 'some-future-stage'); // the raw field is untouched — only the derived one degrades
});

test('summarizeJob: carries stage/iteration/decision/phases/errors/finalOutput straight through', () => {
  const job: JobState = {
    ...createJob('job-7', 'Acme Bakery', 5),
    stage: 'build',
    iteration: 2,
    decision: 'reconcept',
    implementationStatus: 'built',
    browserStatus: 'shot',
    qaStatus: 'failed',
    errors: ['browser: viewport overflow on mobile'],
    finalOutput: null,
  };

  const summary = summarizeJob(job, 4);

  assert.equal(summary.jobId, 'job-7');
  assert.equal(summary.business, 'Acme Bakery');
  assert.equal(summary.stage, 'build');
  assert.equal(summary.abstractStage, 'candidate_build');
  assert.equal(summary.iteration, 2);
  assert.equal(summary.maxIter, 5);
  assert.equal(summary.decision, 'reconcept');
  assert.deepEqual(summary.phases, { implementation: 'built', browser: 'shot', qa: 'failed' });
  assert.equal(summary.candidateCount, 4);
  assert.deepEqual(summary.errors, ['browser: viewport overflow on mobile']);
  assert.equal(summary.finalOutput, null);
});

test('discoverJobIds: returns [] for a nonexistent output root instead of throwing', async () => {
  const root = tmpRoot();
  const missing = path.join(root, 'does-not-exist');
  assert.deepEqual(await discoverJobIds(missing), []);
});

test('discoverJobIds: only lists run directories that actually have a job.json', async () => {
  const root = tmpRoot();
  await saveJob(path.join(root, 'run-with-job'), { jobId: 'run-with-job', business: 'Acme' });
  await fsp.mkdir(path.join(root, 'run-partial'), { recursive: true });
  await fsp.writeFile(path.join(root, 'run-partial', '5b-design.json'), '{}', 'utf8');
  await fsp.mkdir(path.join(root, 'run-empty'), { recursive: true });

  const ids = await discoverJobIds(root);
  assert.deepEqual(ids.sort(), ['run-with-job']);
});

test('summarizeRun: null for a run id with no job.json', async () => {
  const root = tmpRoot();
  await fsp.mkdir(path.join(root, 'run-partial'), { recursive: true });
  assert.equal(await summarizeRun(root, 'run-partial'), null);
  assert.equal(await summarizeRun(root, 'never-existed'), null);
});

test('summarizeRun: candidateCount reflects the real on-disk candidate index, not designDirections.count', async () => {
  const root = tmpRoot();
  const outputDir = path.join(root, 'run-with-candidates');
  await saveJob(outputDir, {
    jobId: 'run-with-candidates',
    business: 'Acme Bakery',
    designDirections: { count: 99, winner: 'direction-A', jury: { bestQuality: 70, judgeCount: 3 } },
  });
  await recordCandidate({
    outputDir,
    iteration: 0,
    scores: { quality: 70, distinctness: 0, blockingClean: true },
  });

  const summary = await summarizeRun(root, 'run-with-candidates');
  assert.ok(summary !== null);
  assert.equal(summary.candidateCount, 1);
  assert.equal(summary.battle?.count, 99);
});

test('summarizeAllRuns: summarizes every discoverable run and skips job-less directories', async () => {
  const root = tmpRoot();
  await saveJob(path.join(root, 'run-a'), { jobId: 'run-a', business: 'Acme Bakery' });
  await saveJob(path.join(root, 'run-b'), { jobId: 'run-b', business: 'Beta Cafe' });
  await fsp.mkdir(path.join(root, 'run-c-partial'), { recursive: true });

  const summaries = await summarizeAllRuns(root);
  assert.equal(summaries.length, 2);
  assert.deepEqual(
    summaries.map((s) => s.jobId).sort(),
    ['run-a', 'run-b'],
  );
});
